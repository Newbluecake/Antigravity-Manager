use tauri::command;
use crate::modules::{crash_logger, logger};
use tauri_plugin_opener::OpenerExt;

/// JavaScript 错误记录命令
#[command]
pub async fn log_js_error(
    message: String,
    stack: String,
    url: String,
    line: u32,
    column: u32,
) -> Result<(), String> {
    let log_dir = logger::get_log_dir()?;

    // 收集系统信息
    let sys_info = crash_logger::collect_system_info();

    // 格式化日志内容
    let timestamp = chrono::Local::now().to_rfc3339();
    let content = format!(
        "========== JS ERROR LOG ==========\n\
         Time: {}\n\
         Message: {}\n\
         URL: {}\n\
         Location: Line {}, Column {}\n\
         \n\
         Stack Trace:\n\
         {}\n\
         \n\
         System Information:\n\
         - OS: {} {}\n\
         - App Version: {}\n\
         ==================================\n\n",
        timestamp,
        message,
        url,
        line,
        column,
        stack,
        sys_info.os_name,
        sys_info.os_version,
        sys_info.app_version,
    );

    // 写入日志
    crash_logger::write_crash_log(&log_dir, content)?;

    Ok(())
}

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
