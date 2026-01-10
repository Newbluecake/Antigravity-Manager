use tauri::command;
use crate::modules::logger;
use tauri_plugin_opener::OpenerExt;

/// 打开日志目录命令
#[command]
pub async fn open_logs_folder(app: tauri::AppHandle) -> Result<(), String> {
    let log_dir = logger::get_log_dir()?;

    // 确保目录存在
    if !log_dir.exists() {
        std::fs::create_dir_all(&log_dir)
            .map_err(|e| format!("Failed to create log directory: {}", e))?;
    }

    // 使用 tauri-plugin-opener 打开目录
    let log_dir_str = log_dir
        .to_str()
        .ok_or_else(|| "Failed to convert path to string".to_string())?;

    app.opener()
        .open_path(log_dir_str, None::<String>)
        .map_err(|e| format!("Failed to open log folder: {}", e))?;

    Ok(())
}

/// 获取日志目录路径
#[command]
pub async fn get_logs_path() -> Result<String, String> {
    let log_dir = logger::get_log_dir()?;

    log_dir
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to convert path to string".to_string())
}
