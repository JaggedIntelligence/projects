use rusqlite::{Connection, Result as SqliteResult};
use std::sync::Mutex;

pub struct DbState(pub Mutex<Connection>);

pub fn init_db(path: &str) -> SqliteResult<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS speed_results (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp       INTEGER NOT NULL,
            download_mbps   REAL NOT NULL,
            upload_mbps     REAL NOT NULL,
            ping_ms         REAL NOT NULL,
            jitter_ms       REAL NOT NULL
        );
        ",
    )?;
    Ok(conn)
}

#[tauri::command]
pub fn get_speed_history(
    db: tauri::State<'_, DbState>,
) -> Result<Vec<crate::speed::SpeedResult>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT timestamp, download_mbps, upload_mbps, ping_ms, jitter_ms
             FROM speed_results
             ORDER BY timestamp DESC
             LIMIT 200",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(crate::speed::SpeedResult {
                timestamp: row.get(0)?,
                download_mbps: row.get(1)?,
                upload_mbps: row.get(2)?,
                ping_ms: row.get(3)?,
                jitter_ms: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub fn delete_speed_result(
    db: tauri::State<'_, DbState>,
    timestamp: i64,
) -> Result<usize, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM speed_results WHERE timestamp = ?1",
        [timestamp],
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_speed_history(db: tauri::State<'_, DbState>) -> Result<usize, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM speed_results", [])
        .map_err(|e| e.to_string())
}
