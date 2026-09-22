use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpeedResult {
    pub download_mbps: f64,
    pub upload_mbps: f64,
    pub ping_ms: f64,
    pub jitter_ms: f64,
    pub timestamp: i64,
}

#[derive(Debug, Serialize, Clone)]
struct ProgressPayload {
    phase: String,
    current_mbps: Option<f64>,
    current_ms: Option<f64>,
    progress: f64,
}

fn emit_progress(app: &AppHandle, payload: ProgressPayload) {
    app.emit("speed-test-progress", payload).ok();
}

#[tauri::command]
pub async fn start_speed_test(
    app: AppHandle,
    db: tauri::State<'_, crate::db::DbState>,
) -> Result<SpeedResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let (ping_ms, jitter_ms) = measure_ping(&app, &client).await?;
    let download_mbps = measure_download(&app, &client).await?;
    let upload_mbps = measure_upload(&app, &client).await?;

    emit_progress(
        &app,
        ProgressPayload {
            phase: "done".to_string(),
            current_mbps: Some(download_mbps),
            current_ms: None,
            progress: 1.0,
        },
    );

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let result = SpeedResult {
        download_mbps,
        upload_mbps,
        ping_ms,
        jitter_ms,
        timestamp,
    };

    // Auto-save to history
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO speed_results (timestamp, download_mbps, upload_mbps, ping_ms, jitter_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                result.timestamp,
                result.download_mbps,
                result.upload_mbps,
                result.ping_ms,
                result.jitter_ms
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(result)
}

async fn measure_ping(app: &AppHandle, client: &reqwest::Client) -> Result<(f64, f64), String> {
    // Use Cloudflare's 0-byte download endpoint as a latency probe
    let url = "https://speed.cloudflare.com/__down?bytes=0";
    let mut times = Vec::new();

    for i in 0..5u32 {
        let start = Instant::now();
        client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("ping failed: {e}"))?;
        let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;
        times.push(elapsed_ms);

        let avg = times.iter().sum::<f64>() / times.len() as f64;
        emit_progress(
            app,
            ProgressPayload {
                phase: "ping".to_string(),
                current_mbps: None,
                current_ms: Some(avg),
                progress: (i + 1) as f64 / 5.0,
            },
        );
    }

    let avg = times.iter().sum::<f64>() / times.len() as f64;
    let variance =
        times.iter().map(|t| (t - avg).powi(2)).sum::<f64>() / times.len() as f64;
    let jitter = variance.sqrt();

    Ok((avg, jitter))
}

async fn measure_download(
    app: &AppHandle,
    client: &reqwest::Client,
) -> Result<f64, String> {
    let total_bytes: u64 = 25_000_000;
    let url = format!(
        "https://speed.cloudflare.com/__down?bytes={}",
        total_bytes
    );

    let start = Instant::now();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("download failed: {e}"))?;

    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("download stream error: {e}"))?;
        downloaded += chunk.len() as u64;

        let elapsed = start.elapsed().as_secs_f64();
        if elapsed > 0.1 {
            let mbps = (downloaded as f64 * 8.0) / (elapsed * 1_000_000.0);
            let progress = (downloaded as f64 / total_bytes as f64).min(1.0);
            emit_progress(
                app,
                ProgressPayload {
                    phase: "download".to_string(),
                    current_mbps: Some(mbps),
                    current_ms: None,
                    progress,
                },
            );
        }
    }

    let elapsed = start.elapsed().as_secs_f64();
    if elapsed == 0.0 {
        return Err("download elapsed time was zero".to_string());
    }
    Ok((downloaded as f64 * 8.0) / (elapsed * 1_000_000.0))
}

async fn measure_upload(
    app: &AppHandle,
    client: &reqwest::Client,
) -> Result<f64, String> {
    let chunk_bytes: usize = 1_000_000; // 1 MB per chunk
    let num_chunks: usize = 10;
    let start = Instant::now();

    for i in 0..num_chunks {
        let data = vec![0u8; chunk_bytes];
        client
            .post("https://speed.cloudflare.com/__up")
            .body(data)
            .send()
            .await
            .map_err(|e| format!("upload chunk {i} failed: {e}"))?;

        let elapsed = start.elapsed().as_secs_f64();
        let uploaded = (i + 1) * chunk_bytes;
        let mbps = if elapsed > 0.0 {
            (uploaded as f64 * 8.0) / (elapsed * 1_000_000.0)
        } else {
            0.0
        };
        emit_progress(
            app,
            ProgressPayload {
                phase: "upload".to_string(),
                current_mbps: Some(mbps),
                current_ms: None,
                progress: (i + 1) as f64 / num_chunks as f64,
            },
        );
    }

    let elapsed = start.elapsed().as_secs_f64();
    if elapsed == 0.0 {
        return Err("upload elapsed time was zero".to_string());
    }
    Ok((num_chunks * chunk_bytes) as f64 * 8.0 / (elapsed * 1_000_000.0))
}
