use rusqlite::Connection;
use std::path::PathBuf;
use tauri::AppHandle;
use tracing::info;

use crate::modules::web_admin::{Result, WebAdminError};

const DB_FILE: &str = "web_admin.db";

fn get_db_path() -> Result<PathBuf> {
    let data_dir = crate::modules::account::get_data_dir()
        .map_err(|e| WebAdminError::ServerError(format!("Failed to get data dir: {}", e)))?;
    Ok(data_dir.join(DB_FILE))
}

pub fn get_connection() -> Result<Connection> {
    let path = get_db_path()?;
    Connection::open(&path).map_err(WebAdminError::from)
}

pub fn init_db(_app: &AppHandle) -> Result<()> {
    let conn = get_connection()?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS admin_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS revoked_tokens (
            jti TEXT PRIMARY KEY,
            expiry INTEGER NOT NULL,
            revoked_at INTEGER NOT NULL
        )",
        [],
    )?;

    info!("Web Admin database initialized at {:?}", get_db_path()?);
    Ok(())
}
