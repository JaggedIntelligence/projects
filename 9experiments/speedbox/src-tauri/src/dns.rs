use hickory_resolver::{
    config::{NameServerConfigGroup, ResolverConfig, ResolverOpts},
    TokioAsyncResolver,
};
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

// Whole-race ceiling: any resolver that hasn't returned by this deadline is
// aborted and reported as a timeout failure. Keeps the UI from waiting on
// unreachable servers forever.
const TOTAL_TIMEOUT: Duration = Duration::from_secs(15);
// Per-lookup timeout inside hickory. Individual queries that take longer than
// this count as failures without blocking the rest of the resolver's run.
const LOOKUP_TIMEOUT: Duration = Duration::from_millis(2000);

static CANCEL: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ResolverKind {
    Public,
    Gateway,
    System,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DnsResult {
    pub resolver_name: String,
    pub resolver_addr: String,
    pub resolver_kind: ResolverKind,
    pub system_index: Option<u32>,
    pub response_ms: f64,      // average across all queries
    pub min_ms: f64,
    pub max_ms: f64,
    pub success: bool,
    pub queries_ok: u32,
    pub queries_total: u32,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
struct DnsProgressPayload {
    resolver_name: String,
    resolver_addr: String,
    query_num: u32,
    queries_total: u32,
    latest_ms: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct ResolverInfo {
    pub name: String,
    pub addr: String,
    pub resolver_kind: ResolverKind,
    pub system_index: Option<u32>,
    #[serde(default)]
    pub is_gateway: bool,
    #[serde(default)]
    pub is_system: bool,
}

// Source: https://github.com/qwerty541/dns-bench (IPv4 public resolvers, port 53)
const RESOLVERS: &[(&str, &str)] = &[
    ("Google", "8.8.8.8"),
    ("Google", "8.8.4.4"),
    ("Cloudflare", "1.1.1.1"),
    ("Cloudflare", "1.0.0.1"),
    ("Quad9", "9.9.9.9"),
    ("Quad9", "149.112.112.112"),
    ("Control D", "76.76.2.0"),
    ("Control D", "76.76.10.0"),
    ("OpenDNS Home", "208.67.222.222"),
    ("OpenDNS Home", "208.67.220.220"),
    ("CleanBrowsing", "185.228.168.9"),
    ("CleanBrowsing", "185.228.169.9"),
    ("AdGuard DNS", "94.140.14.14"),
    ("AdGuard DNS", "94.140.15.15"),
    ("Comodo Secure DNS", "8.26.56.26"),
    ("Comodo Secure DNS", "8.20.247.20"),
    ("Level3", "209.244.0.3"),
    ("Level3", "209.244.0.4"),
    ("Verisign", "64.6.64.6"),
    ("Verisign", "64.6.65.6"),
    ("Norton ConnectSafe", "199.85.126.10"),
    ("Norton ConnectSafe", "199.85.127.10"),
    ("SafeDNS", "195.46.39.39"),
    ("SafeDNS", "195.46.39.40"),
    ("NextDNS", "45.90.28.100"),
    ("NextDNS", "45.90.30.100"),
    ("Dyn", "216.146.35.35"),
    ("Dyn", "216.146.36.36"),
    ("Hurricane Electric", "74.82.42.42"),
    ("Surfshark DNS", "162.252.172.57"),
    ("Surfshark DNS", "149.154.159.92"),
    ("SafeServe", "198.54.117.10"),
    ("SafeServe", "198.54.117.11"),
    ("Vercara UltraDNS Public", "156.154.70.2"),
    ("Vercara UltraDNS Public", "156.154.71.2"),
    ("Gcore Public DNS", "95.85.95.85"),
    ("Gcore Public DNS", "2.56.220.2"),
    ("AliDNS", "223.5.5.5"),
    ("AliDNS", "223.6.6.6"),
];

fn detect_gateway() -> Option<String> {
    match netdev::get_default_gateway() {
        Ok(gw) => gw
            .ipv4
            .first()
            .map(|ip| ip.to_string())
            .or_else(|| gw.ipv6.first().map(|ip| ip.to_string())),
        Err(_) => None,
    }
}

fn detect_system_dns() -> Vec<String> {
    #[cfg(target_os = "macos")]
    {
        // `scutil --dns` reflects the live System Configuration state, which
        // `networksetup -setdnsservers` updates immediately. /etc/resolv.conf
        // lags, so we prefer scutil on macOS.
        if let Some(ips) = detect_system_dns_scutil() {
            return ips;
        }
    }
    detect_system_dns_hickory()
}

fn detect_system_dns_hickory() -> Vec<String> {
    use hickory_resolver::system_conf::read_system_conf;
    match read_system_conf() {
        Ok((config, _)) => {
            let mut seen = std::collections::BTreeSet::new();
            let mut out = Vec::new();
            for ns in config.name_servers() {
                let ip = ns.socket_addr.ip().to_string();
                if ip.starts_with("127.") || ip == "::1" {
                    continue;
                }
                if seen.insert(ip.clone()) {
                    out.push(ip);
                }
            }
            out
        }
        Err(_) => vec![],
    }
}

#[cfg(target_os = "macos")]
fn detect_system_dns_scutil() -> Option<Vec<String>> {
    use std::process::Command;
    let out = Command::new("scutil").arg("--dns").output().ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut in_primary = false;
    let mut seen = std::collections::BTreeSet::new();
    let mut ips = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed == "resolver #1" {
            in_primary = true;
            continue;
        }
        if trimmed.starts_with("resolver #") {
            in_primary = false;
            continue;
        }
        if in_primary && trimmed.starts_with("nameserver[") {
            if let Some((_, ip)) = trimmed.split_once(':') {
                let ip = ip.trim().to_string();
                if ip.starts_with("127.") || ip == "::1" {
                    continue;
                }
                if seen.insert(ip.clone()) {
                    ips.push(ip);
                }
            }
        }
    }
    Some(ips)
}

#[tauri::command]
pub fn get_dns_resolvers() -> Vec<ResolverInfo> {
    let gateway = detect_gateway();
    let system_dns = detect_system_dns();

    let mut detected_only: Vec<ResolverInfo> = Vec::new();
    let mut public_list: Vec<ResolverInfo> = RESOLVERS
        .iter()
        .map(|(name, addr)| ResolverInfo {
            name: name.to_string(),
            addr: addr.to_string(),
            resolver_kind: ResolverKind::Public,
            system_index: None,
            is_gateway: false,
            is_system: false,
        })
        .collect();

    // Tag gateway: if matches a public resolver, flag it; else add as new entry.
    if let Some(gw) = gateway.as_ref() {
        match public_list.iter_mut().find(|r| &r.addr == gw) {
            Some(existing) => {
                existing.is_gateway = true;
                existing.resolver_kind = ResolverKind::Gateway;
            }
            None => detected_only.push(ResolverInfo {
                name: "Router (Gateway)".to_string(),
                addr: gw.clone(),
                resolver_kind: ResolverKind::Gateway,
                system_index: None,
                is_gateway: true,
                is_system: false,
            }),
        }
    }

    // Tag system DNS entries similarly.
    let mut system_index: u32 = 0;
    for ip in system_dns {
        if gateway.as_deref() == Some(ip.as_str()) {
            // Already handled as gateway — also mark as system on whichever entry holds it.
            if let Some(entry) = public_list
                .iter_mut()
                .chain(detected_only.iter_mut())
                .find(|r| r.addr == ip)
            {
                entry.is_system = true;
            }
            continue;
        }
        system_index += 1;
        match public_list.iter_mut().find(|r| r.addr == ip) {
            Some(existing) => {
                existing.is_system = true;
            }
            None => {
                let name = if system_index == 1 {
                    "System DNS".to_string()
                } else {
                    format!("System DNS #{system_index}")
                };
                detected_only.push(ResolverInfo {
                    name,
                    addr: ip,
                    resolver_kind: ResolverKind::System,
                    system_index: Some(system_index),
                    is_gateway: false,
                    is_system: true,
                });
            }
        }
    }

    // Detected-only entries first, then public list in declared order.
    detected_only.extend(public_list);
    detected_only
}

// Default test domains (popular public sites). Different domains so resolver-side
// caching doesn't mask real RTT. Users can override via the settings page.
const DEFAULT_TEST_DOMAINS: &[&str] = &[
    "google.com.",
    "youtube.com.",
    "facebook.com.",
    "instagram.com.",
    "chatgpt.com.",
    "x.com.",
    "whatsapp.com.",
    "reddit.com.",
    "wikipedia.org.",
    "amazon.com.",
    "tiktok.com.",
    "pinterest.com.",
];

fn normalize_domains(input: Option<Vec<String>>) -> Vec<String> {
    match input {
        Some(list) if !list.is_empty() => list
            .into_iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .map(|s| if s.ends_with('.') { s } else { format!("{s}.") })
            .collect(),
        _ => DEFAULT_TEST_DOMAINS.iter().map(|s| s.to_string()).collect(),
    }
}

#[tauri::command]
pub fn cancel_dns_test() {
    CANCEL.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub async fn run_dns_test(
    app: AppHandle,
    domains: Option<Vec<String>>,
) -> Result<Vec<DnsResult>, String> {
    CANCEL.store(false, Ordering::SeqCst);
    let domains = std::sync::Arc::new(normalize_domains(domains));
    if domains.is_empty() {
        return Err("no test domains".into());
    }
    let resolvers = get_dns_resolvers();
    let total_queries = domains.len() as u32;
    let tasks: Vec<_> = resolvers
        .into_iter()
        .map(|r| {
            let app = app.clone();
            let domains = domains.clone();
            let resolver = r.clone();
            let handle =
                tokio::spawn(async move { query_resolver(&app, &resolver, &domains).await });
            (r, handle)
        })
        .collect();

    // Overall race deadline. Any handle that doesn't return in time is aborted
    // and surfaced as a timeout failure so the UI can finish the run cleanly.
    let deadline = tokio::time::Instant::now() + TOTAL_TIMEOUT;
    let mut results = Vec::new();
    for (resolver, handle) in tasks {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        match tokio::time::timeout(remaining, handle).await {
            Ok(Ok(result)) => results.push(result),
            Ok(Err(_join_err)) => {
                results.push(DnsResult {
                    resolver_name: resolver.name,
                    resolver_addr: resolver.addr,
                    resolver_kind: resolver.resolver_kind,
                    system_index: resolver.system_index,
                    response_ms: 0.0,
                    min_ms: 0.0,
                    max_ms: 0.0,
                    success: false,
                    queries_ok: 0,
                    queries_total: total_queries,
                    error: Some("task crashed".into()),
                });
            }
            Err(_elapsed) => {
                // timeout fires dropping the handle which aborts the task
                results.push(DnsResult {
                    resolver_name: resolver.name,
                    resolver_addr: resolver.addr,
                    resolver_kind: resolver.resolver_kind,
                    system_index: resolver.system_index,
                    response_ms: 0.0,
                    min_ms: 0.0,
                    max_ms: 0.0,
                    success: false,
                    queries_ok: 0,
                    queries_total: total_queries,
                    error: Some("timeout".into()),
                });
            }
        }
    }

    if CANCEL.load(Ordering::SeqCst) {
        return Err("cancelled".to_string());
    }

    results.sort_by(|a, b| match (a.success, b.success) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a
            .response_ms
            .partial_cmp(&b.response_ms)
            .unwrap_or(std::cmp::Ordering::Equal),
    });

    Ok(results)
}

async fn query_resolver(
    app: &AppHandle,
    resolver: &ResolverInfo,
    domains: &[String],
) -> DnsResult {
    let total = domains.len() as u32;
    let ip: IpAddr = match resolver.addr.parse() {
        Ok(ip) => ip,
        Err(e) => {
            return DnsResult {
                resolver_name: resolver.name.to_string(),
                resolver_addr: resolver.addr.to_string(),
                resolver_kind: resolver.resolver_kind,
                system_index: resolver.system_index,
                response_ms: 0.0,
                min_ms: 0.0,
                max_ms: 0.0,
                success: false,
                queries_ok: 0,
                queries_total: total,
                error: Some(e.to_string()),
            }
        }
    };

    let nameservers = NameServerConfigGroup::from_ips_clear(&[ip], 53, true);
    let config = ResolverConfig::from_parts(None, vec![], nameservers);
    let mut opts = ResolverOpts::default();
    opts.cache_size = 0; // disable resolver-side cache so each query hits the wire
    opts.timeout = LOOKUP_TIMEOUT; // bound individual lookups
    opts.attempts = 1; // fail fast — no retries on slow/dead resolvers
    let dns_resolver = TokioAsyncResolver::tokio(config, opts);

    let mut times: Vec<f64> = Vec::new();
    let mut last_error: Option<String> = None;

    for (i, domain) in domains.iter().enumerate() {
        if CANCEL.load(Ordering::SeqCst) {
            last_error = Some("cancelled".to_string());
            break;
        }
        let start = Instant::now();
        match dns_resolver.lookup_ip(domain.as_str()).await {
            Ok(_) => {
                let ms = start.elapsed().as_secs_f64() * 1000.0;
                times.push(ms);
                app.emit(
                    "dns-test-progress",
                    DnsProgressPayload {
                        resolver_name: resolver.name.to_string(),
                        resolver_addr: resolver.addr.to_string(),
                        query_num: i as u32 + 1,
                        queries_total: total,
                        latest_ms: ms,
                    },
                )
                .ok();
            }
            Err(e) => {
                last_error = Some(e.to_string());
                app.emit(
                    "dns-test-progress",
                    DnsProgressPayload {
                        resolver_name: resolver.name.to_string(),
                        resolver_addr: resolver.addr.to_string(),
                        query_num: i as u32 + 1,
                        queries_total: total,
                        latest_ms: 0.0,
                    },
                )
                .ok();
            }
        }
    }

    if times.is_empty() {
        return DnsResult {
            resolver_name: resolver.name.to_string(),
            resolver_addr: resolver.addr.to_string(),
            resolver_kind: resolver.resolver_kind,
            system_index: resolver.system_index,
            response_ms: 0.0,
            min_ms: 0.0,
            max_ms: 0.0,
            success: false,
            queries_ok: 0,
            queries_total: total,
            error: last_error,
        };
    }

    let avg = times.iter().sum::<f64>() / times.len() as f64;
    let min = times.iter().cloned().fold(f64::INFINITY, f64::min);
    let max = times.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

    DnsResult {
        resolver_name: resolver.name.to_string(),
        resolver_addr: resolver.addr.to_string(),
        resolver_kind: resolver.resolver_kind,
        system_index: resolver.system_index,
        response_ms: avg,
        min_ms: min,
        max_ms: max,
        success: true,
        queries_ok: times.len() as u32,
        queries_total: total,
        error: None,
    }
}
