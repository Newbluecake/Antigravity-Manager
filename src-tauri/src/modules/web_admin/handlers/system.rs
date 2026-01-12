use axum::{extract::Query, Json};
use serde::{Deserialize, Serialize};
use std::fs;
use std::time::SystemTime;

use crate::modules::logger;
use crate::modules::web_admin::{Result, WebAdminError};

#[derive(Debug, Serialize)]
pub struct LogFileEntry {
    pub name: String,
    pub size: u64,
    pub modified: u64,
}

#[derive(Debug, Deserialize)]
pub struct LogQuery {
    pub file: Option<String>,
    pub lines: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct LogContent {
    pub lines: Vec<String>,
}

fn get_log_files_internal() -> Result<Vec<LogFileEntry>> {
    let log_dir = logger::get_log_dir().map_err(|e| WebAdminError::ServerError(e))?;

    let mut files = Vec::new();
    if log_dir.exists() {
        let entries = fs::read_dir(&log_dir).map_err(WebAdminError::IoError)?;

        for entry in entries {
            let entry = entry.map_err(WebAdminError::IoError)?;
            let path = entry.path();
            if path.is_file() {
                let metadata = fs::metadata(&path).map_err(WebAdminError::IoError)?;
                let modified = metadata.modified()
                    .unwrap_or(SystemTime::UNIX_EPOCH)
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    files.push(LogFileEntry {
                        name: name.to_string(),
                        size: metadata.len(),
                        modified,
                    });
                }
            }
        }
    }

    // Sort by modification time descending (newest first)
    files.sort_by(|a, b| b.modified.cmp(&a.modified));

    Ok(files)
}

/// GET /api/v1/system/logs/files
pub async fn list_log_files() -> Result<Json<Vec<LogFileEntry>>> {
    let files = get_log_files_internal()?;
    Ok(Json(files))
}

/// GET /api/v1/system/logs
pub async fn get_logs(
    Query(query): Query<LogQuery>,
) -> Result<Json<LogContent>> {
    let log_dir = logger::get_log_dir().map_err(|e| WebAdminError::ServerError(e))?;

    let filename = if let Some(name) = query.file {
        name
    } else {
        // Default to the newest file
        let files = get_log_files_internal()?;
        if let Some(first) = files.first() {
            first.name.clone()
        } else {
            return Ok(Json(LogContent { lines: Vec::new() }));
        }
    };

    let log_path = log_dir.join(&filename);
    if !log_path.exists() {
        return Err(WebAdminError::ConfigError(format!("Log file not found: {}", filename)));
    }

    // Prevent path traversal: canonicalize returns absolute path, check if it starts with log_dir
    let canonical_path = fs::canonicalize(&log_path).map_err(WebAdminError::IoError)?;
    let canonical_log_dir = fs::canonicalize(&log_dir).map_err(WebAdminError::IoError)?;

    if !canonical_path.starts_with(&canonical_log_dir) {
        return Err(WebAdminError::ConfigError("Invalid log file path".to_string()));
    }

    let content = fs::read_to_string(log_path).map_err(WebAdminError::IoError)?;
    let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();

    if let Some(limit) = query.lines {
        if lines.len() > limit {
            let start = lines.len() - limit;
            lines = lines.drain(start..).collect();
        }
    } else {
        // Default limit to 2000 lines if not specified
        let limit = 2000;
        if lines.len() > limit {
            let start = lines.len() - limit;
            lines = lines.drain(start..).collect();
        }
    }

    Ok(Json(LogContent { lines }))
}
