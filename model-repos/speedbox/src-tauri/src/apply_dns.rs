// Apply / reset system DNS across macOS, Windows, and Linux.
// Elevation is requested per-platform:
//   macOS:   `osascript` "do shell script ... with administrator privileges"
//   Windows: PowerShell `Start-Process -Verb RunAs` (UAC)
//   Linux:   `pkexec` (polkit) — best effort via resolvectl / nmcli / resolv.conf
//
// Inputs are validated as IP literals before being interpolated into any shell
// string, so user-controlled data never reaches a shell parser unparsed.

use std::net::IpAddr;

fn validate_ips(addrs: &[String]) -> Result<Vec<String>, String> {
    let mut out = Vec::with_capacity(addrs.len());
    for a in addrs {
        let parsed: IpAddr = a
            .parse()
            .map_err(|_| format!("invalid IP address: {a}"))?;
        out.push(parsed.to_string());
    }
    Ok(out)
}

#[tauri::command]
pub async fn apply_dns(addrs: Vec<String>) -> Result<(), String> {
    if addrs.is_empty() {
        return Err("no DNS servers provided".into());
    }
    let validated = validate_ips(&addrs)?;
    tokio::task::spawn_blocking(move || platform::apply(&validated))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn reset_dns() -> Result<(), String> {
    tokio::task::spawn_blocking(platform::reset)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn flush_dns_cache() -> Result<(), String> {
    tokio::task::spawn_blocking(platform::flush_cache)
        .await
        .map_err(|e| e.to_string())?
}

// ---------- macOS ----------
#[cfg(target_os = "macos")]
mod platform {
    use std::process::Command;

    pub fn apply(addrs: &[String]) -> Result<(), String> {
        let service = active_service()?;
        // addrs are already validated as IP literals.
        let joined = addrs.join(" ");
        let inner = format!(
            "/usr/sbin/networksetup -setdnsservers {} {}",
            shell_single_quote(&service),
            joined
        );
        run_osascript_admin(&inner)
    }

    pub fn reset() -> Result<(), String> {
        let service = active_service()?;
        let inner = format!(
            "/usr/sbin/networksetup -setdnsservers {} empty",
            shell_single_quote(&service)
        );
        run_osascript_admin(&inner)
    }

    pub fn flush_cache() -> Result<(), String> {
        // Both commands are needed: dscacheutil clears the user-level cache,
        // killall -HUP mDNSResponder reloads the system resolver daemon.
        run_osascript_admin(
            "/usr/bin/dscacheutil -flushcache && /usr/bin/killall -HUP mDNSResponder",
        )
    }

    fn active_service() -> Result<String, String> {
        let out = Command::new("networksetup")
            .arg("-listallnetworkservices")
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).into_owned());
        }
        let text = String::from_utf8_lossy(&out.stdout);
        let candidates: Vec<&str> = text
            .lines()
            .skip(1) // first line describes the asterisk prefix
            .map(str::trim)
            .filter(|l| !l.is_empty() && !l.starts_with('*'))
            .collect();
        for preferred in &["Wi-Fi", "Ethernet"] {
            if candidates.iter().any(|c| c == preferred) && service_has_ip(preferred) {
                return Ok((*preferred).to_string());
            }
        }
        for svc in candidates {
            if service_has_ip(svc) {
                return Ok(svc.to_string());
            }
        }
        Err("no active network service found".into())
    }

    fn service_has_ip(svc: &str) -> bool {
        let out = match Command::new("networksetup").args(["-getinfo", svc]).output() {
            Ok(o) => o,
            Err(_) => return false,
        };
        let text = String::from_utf8_lossy(&out.stdout);
        text.lines().any(|l| {
            let l = l.trim();
            l.starts_with("IP address:") && !l.ends_with("none")
        })
    }

    fn run_osascript_admin(inner_cmd: &str) -> Result<(), String> {
        // Escape for AppleScript double-quoted string.
        let escaped = inner_cmd.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!(
            "do shell script \"{escaped}\" with administrator privileges"
        );
        let out = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            Ok(())
        } else {
            let err = String::from_utf8_lossy(&out.stderr);
            if err.contains("-128") {
                Err("authorization cancelled".into())
            } else {
                Err(err.trim().to_string())
            }
        }
    }

    fn shell_single_quote(s: &str) -> String {
        format!("'{}'", s.replace('\'', "'\\''"))
    }
}

// ---------- Windows ----------
#[cfg(target_os = "windows")]
mod platform {
    use std::process::Command;

    pub fn apply(addrs: &[String]) -> Result<(), String> {
        let iface = active_interface()?;
        // addrs are validated IPs; iface comes from netsh and is quoted.
        let mut parts: Vec<String> = Vec::new();
        parts.push(format!(
            r#"netsh interface ipv4 set dns name="{iface}" static {primary} primary"#,
            iface = iface,
            primary = addrs[0]
        ));
        for (i, ip) in addrs.iter().skip(1).enumerate() {
            parts.push(format!(
                r#"netsh interface ipv4 add dns name="{iface}" {ip} index={idx}"#,
                iface = iface,
                ip = ip,
                idx = i + 2
            ));
        }
        run_elevated(&parts.join(" && "))
    }

    pub fn reset() -> Result<(), String> {
        let iface = active_interface()?;
        let cmd = format!(
            r#"netsh interface ipv4 set dns name="{iface}" dhcp"#,
            iface = iface
        );
        run_elevated(&cmd)
    }

    pub fn flush_cache() -> Result<(), String> {
        // ipconfig /flushdns works without elevation on modern Windows.
        let out = Command::new("ipconfig")
            .arg("/flushdns")
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
        }
    }

    fn active_interface() -> Result<String, String> {
        let out = Command::new("netsh")
            .args(["interface", "show", "interface"])
            .output()
            .map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with("Admin") || line.starts_with("---") {
                continue;
            }
            let mut it = line.split_whitespace();
            let admin = it.next().unwrap_or("");
            let state = it.next().unwrap_or("");
            let _ty = it.next().unwrap_or("");
            let name = it.collect::<Vec<&str>>().join(" ");
            if admin.eq_ignore_ascii_case("Enabled")
                && state.eq_ignore_ascii_case("Connected")
                && !name.is_empty()
            {
                return Ok(name);
            }
        }
        Err("no connected network interface found".into())
    }

    fn run_elevated(cmd: &str) -> Result<(), String> {
        // Escape single-quotes for the outer PowerShell single-quoted string.
        let ps_arglist = cmd.replace('\'', "''");
        let ps_script = format!(
            "$p = Start-Process cmd -Verb RunAs -Wait -WindowStyle Hidden \
             -PassThru -ArgumentList '/c {args}'; exit $p.ExitCode",
            args = ps_arglist
        );
        let out = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &ps_script])
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            Ok(())
        } else {
            let err = String::from_utf8_lossy(&out.stderr);
            if err.contains("canceled") || err.contains("cancelled") {
                Err("UAC prompt cancelled".into())
            } else if err.trim().is_empty() {
                Err("netsh failed (elevation required)".into())
            } else {
                Err(err.trim().to_string())
            }
        }
    }
}

// ---------- Linux ----------
#[cfg(target_os = "linux")]
mod platform {
    use std::process::Command;

    pub fn apply(addrs: &[String]) -> Result<(), String> {
        if which("resolvectl") {
            if let Some(iface) = default_iface() {
                let mut args = vec!["resolvectl".to_string(), "dns".to_string(), iface];
                args.extend(addrs.iter().cloned());
                if pkexec(&args).is_ok() {
                    return Ok(());
                }
            }
        }
        if which("nmcli") {
            if let Some(conn) = active_nm_conn() {
                let joined = addrs.join(",");
                pkexec(&[
                    "nmcli".into(),
                    "connection".into(),
                    "modify".into(),
                    conn.clone(),
                    "ipv4.dns".into(),
                    joined,
                ])?;
                pkexec(&[
                    "nmcli".into(),
                    "connection".into(),
                    "up".into(),
                    conn,
                ])?;
                return Ok(());
            }
        }
        // Last resort: overwrite /etc/resolv.conf. addrs are validated IPs,
        // so they cannot contain shell metacharacters.
        let nameservers: String = addrs.iter().map(|a| format!("nameserver {a}\n")).collect();
        let sh_cmd = format!(
            "printf %s {ns} > /etc/resolv.conf",
            ns = shell_single_quote(&nameservers)
        );
        pkexec(&["sh".into(), "-c".into(), sh_cmd])
    }

    pub fn reset() -> Result<(), String> {
        if which("resolvectl") {
            if let Some(iface) = default_iface() {
                if pkexec(&["resolvectl".into(), "revert".into(), iface]).is_ok() {
                    return Ok(());
                }
            }
        }
        if which("nmcli") {
            if let Some(conn) = active_nm_conn() {
                pkexec(&[
                    "nmcli".into(),
                    "connection".into(),
                    "modify".into(),
                    conn.clone(),
                    "ipv4.dns".into(),
                    "".into(),
                ])?;
                pkexec(&[
                    "nmcli".into(),
                    "connection".into(),
                    "up".into(),
                    conn,
                ])?;
                return Ok(());
            }
        }
        Err("no supported DNS manager (resolvectl/nmcli) detected".into())
    }

    pub fn flush_cache() -> Result<(), String> {
        // Try the common Linux cache-holders in order; succeed on first hit.
        if which("resolvectl") {
            if pkexec(&["resolvectl".into(), "flush-caches".into()]).is_ok() {
                return Ok(());
            }
        }
        if which("systemd-resolve") {
            if pkexec(&["systemd-resolve".into(), "--flush-caches".into()]).is_ok() {
                return Ok(());
            }
        }
        // nscd / dnsmasq are less common but worth a try.
        if which("systemctl") {
            for svc in &["nscd", "dnsmasq"] {
                if pkexec(&[
                    "systemctl".into(),
                    "restart".into(),
                    (*svc).to_string(),
                ])
                .is_ok()
                {
                    return Ok(());
                }
            }
        }
        Err("no DNS cache manager found (resolvectl/systemd-resolve/nscd/dnsmasq)".into())
    }

    fn which(cmd: &str) -> bool {
        Command::new("sh")
            .args(["-c", &format!("command -v {cmd}")])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    fn default_iface() -> Option<String> {
        let out = Command::new("ip")
            .args(["-4", "route", "show", "default"])
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&out.stdout);
        // "default via 192.168.1.1 dev wlp3s0 ..."
        let mut tokens = text.split_whitespace();
        while let Some(t) = tokens.next() {
            if t == "dev" {
                return tokens.next().map(String::from);
            }
        }
        None
    }

    fn active_nm_conn() -> Option<String> {
        let out = Command::new("nmcli")
            .args(["-t", "-f", "NAME,STATE", "connection", "show", "--active"])
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            let (name, state) = line.split_once(':')?;
            if state.trim() == "activated" {
                return Some(name.trim().to_string());
            }
        }
        None
    }

    fn pkexec(args: &[String]) -> Result<(), String> {
        let out = Command::new("pkexec")
            .args(args)
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            Ok(())
        } else {
            let err = String::from_utf8_lossy(&out.stderr);
            Err(err.trim().to_string())
        }
    }

    fn shell_single_quote(s: &str) -> String {
        format!("'{}'", s.replace('\'', "'\\''"))
    }
}

// Fallback stub so `cargo check` still works on other platforms (e.g., BSD).
#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
mod platform {
    pub fn apply(_addrs: &[String]) -> Result<(), String> {
        Err("applying DNS is not supported on this platform".into())
    }
    pub fn reset() -> Result<(), String> {
        Err("resetting DNS is not supported on this platform".into())
    }
    pub fn flush_cache() -> Result<(), String> {
        Err("flushing DNS cache is not supported on this platform".into())
    }
}
