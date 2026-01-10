use std::panic::{self, PanicHookInfo};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::System;
use tracing::{error, warn, info};

/// 崩溃日志配置
#[derive(Clone)]
pub struct CrashLoggerConfig {
    pub max_log_age_days: u64,
    pub max_log_size_mb: u64,
    pub max_total_size_mb: u64,
}

impl Default for CrashLoggerConfig {
    fn default() -> Self {
        Self {
            max_log_age_days: 7,
            max_log_size_mb: 10,
            max_total_size_mb: 100,
        }
    }
}

/// 系统信息
#[derive(Debug)]
pub struct SystemInfo {
    pub os_name: String,
    pub os_version: String,
    pub app_version: String,
    pub memory_total_mb: u64,
    pub memory_used_mb: u64,
    pub cpu_arch: String,
}

/// 收集系统信息
pub fn collect_system_info() -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    SystemInfo {
        os_name: System::name().unwrap_or_else(|| "Unknown".to_string()),
        os_version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        memory_total_mb: sys.total_memory() / 1024,
        memory_used_mb: sys.used_memory() / 1024,
        cpu_arch: std::env::consts::ARCH.to_string(),
    }
}

/// 获取崩溃日志文件路径
fn get_crash_log_path(log_dir: &PathBuf) -> PathBuf {
    let timestamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    log_dir.join(format!("crash-{}.log", timestamp))
}

/// 写入崩溃日志
pub fn write_crash_log(log_dir: &PathBuf, content: String) -> Result<(), String> {
    // 确保目录存在
    if !log_dir.exists() {
        fs::create_dir_all(log_dir).map_err(|e| {
            eprintln!("Failed to create log directory: {}", e);
            format!("Failed to create log directory: {}", e)
        })?;
    }

    let log_path = get_crash_log_path(log_dir);

    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write log: {}", e))?;

    file.flush()
        .map_err(|e| format!("Failed to flush log: {}", e))?;

    info!("Crash log written to: {:?}", log_path);

    Ok(())
}

/// Panic hook 处理函数
fn panic_hook_handler(info: &PanicHookInfo, log_dir: PathBuf) {
    // 收集 panic 信息
    let message = if let Some(s) = info.payload().downcast_ref::<&str>() {
        s.to_string()
    } else if let Some(s) = info.payload().downcast_ref::<String>() {
        s.clone()
    } else {
        "Unknown panic".to_string()
    };

    let location = if let Some(loc) = info.location() {
        format!("{}:{}", loc.file(), loc.line())
    } else {
        "Unknown location".to_string()
    };

    // 收集系统信息
    let sys_info = collect_system_info();

    // 捕获 backtrace
    let backtrace = std::backtrace::Backtrace::capture();

    // 格式化日志内容
    let timestamp = chrono::Local::now().to_rfc3339();
    let content = format!(
        "========== PANIC CRASH LOG ==========\n\
         Time: {}\n\
         Panic Message: {}\n\
         Location: {}\n\
         \n\
         Backtrace:\n\
         {}\n\
         \n\
         System Information:\n\
         - OS: {} {}\n\
         - App Version: {}\n\
         - Memory: {} MB total, {} MB used\n\
         - CPU Architecture: {}\n\
         =====================================\n\n",
        timestamp,
        message,
        location,
        backtrace,
        sys_info.os_name,
        sys_info.os_version,
        sys_info.app_version,
        sys_info.memory_total_mb,
        sys_info.memory_used_mb,
        sys_info.cpu_arch,
    );

    // 写入日志
    if let Err(e) = write_crash_log(&log_dir, content.clone()) {
        eprintln!("Failed to write crash log: {}", e);

        // 降级: 尝试写入临时目录
        let temp_dir = std::env::temp_dir().join("antigravity-tools-logs");
        if let Err(e2) = write_crash_log(&temp_dir, content) {
            eprintln!("Failed to write crash log to temp directory: {}", e2);
        } else {
            eprintln!("Crash log written to temp directory: {:?}", temp_dir);
        }
    }

    // 同时使用 tracing 记录
    error!("PANIC: {} at {}", message, location);
}

/// 按时间清理旧日志
fn cleanup_old_logs(log_dir: &PathBuf, days: u64) -> Result<usize, String> {
    if !log_dir.exists() {
        return Ok(0);
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to get system time: {}", e))?
        .as_secs();

    let cutoff_time = now.saturating_sub(days * 24 * 60 * 60);
    let mut deleted_count = 0;

    let entries = fs::read_dir(log_dir)
        .map_err(|e| format!("Failed to read log directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();

            // 只处理 crash-*.log 文件
            if !path.is_file() || !path.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("crash-") && n.ends_with(".log"))
                .unwrap_or(false)
            {
                continue;
            }

            if let Ok(metadata) = fs::metadata(&path) {
                if let Ok(modified) = metadata.modified() {
                    let modified_secs = modified
                        .duration_since(UNIX_EPOCH)
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    if modified_secs < cutoff_time {
                        if let Err(e) = fs::remove_file(&path) {
                            warn!("Failed to delete old log file {:?}: {}", path, e);
                        } else {
                            deleted_count += 1;
                            info!("Deleted old log file: {:?}", path.file_name());
                        }
                    }
                }
            }
        }
    }

    Ok(deleted_count)
}

/// 按大小清理日志
fn cleanup_oversized_logs(log_dir: &PathBuf, max_mb: u64) -> Result<usize, String> {
    if !log_dir.exists() {
        return Ok(0);
    }

    let max_bytes = max_mb * 1024 * 1024;
    let mut deleted_count = 0;

    // 收集所有崩溃日志文件及其信息
    let mut files: Vec<(PathBuf, SystemTime, u64)> = Vec::new();

    let entries = fs::read_dir(log_dir)
        .map_err(|e| format!("Failed to read log directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();

            // 只处理 crash-*.log 文件
            if !path.is_file() || !path.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("crash-") && n.ends_with(".log"))
                .unwrap_or(false)
            {
                continue;
            }

            if let Ok(metadata) = fs::metadata(&path) {
                if let Ok(modified) = metadata.modified() {
                    files.push((path, modified, metadata.len()));
                }
            }
        }
    }

    // 按修改时间排序 (旧的在前)
    files.sort_by_key(|(_, modified, _)| *modified);

    // 计算总大小
    let total_size: u64 = files.iter().map(|(_, _, size)| size).sum();

    if total_size <= max_bytes {
        return Ok(0);
    }

    // 删除最旧的文件直到总大小低于限制
    let mut current_size = total_size;
    for (path, _, size) in files {
        if current_size <= max_bytes {
            break;
        }

        if let Err(e) = fs::remove_file(&path) {
            warn!("Failed to delete oversized log file {:?}: {}", path, e);
        } else {
            deleted_count += 1;
            current_size -= size;
            info!("Deleted oversized log file: {:?} ({} bytes)", path.file_name(), size);
        }
    }

    Ok(deleted_count)
}

/// 执行日志轮转
pub fn rotate_logs(log_dir: &PathBuf, config: &CrashLoggerConfig) -> Result<(), String> {
    // 按时间清理
    let time_deleted = cleanup_old_logs(log_dir, config.max_log_age_days)?;

    // 按大小清理
    let size_deleted = cleanup_oversized_logs(log_dir, config.max_total_size_mb)?;

    if time_deleted > 0 || size_deleted > 0 {
        info!("Log rotation completed: {} files deleted by time, {} files deleted by size",
              time_deleted, size_deleted);
    }

    Ok(())
}

/// 初始化崩溃日志系统
pub fn init_crash_logger(config: CrashLoggerConfig) {
    // 获取日志目录
    let log_dir = match crate::modules::logger::get_log_dir() {
        Ok(dir) => dir,
        Err(e) => {
            eprintln!("Failed to get log directory: {}, using temp directory", e);
            std::env::temp_dir().join("antigravity-tools-logs")
        }
    };

    // 执行日志轮转 (异步, 不阻塞启动)
    let log_dir_clone = log_dir.clone();
    let config_clone = config.clone();
    tokio::spawn(async move {
        if let Err(e) = rotate_logs(&log_dir_clone, &config_clone) {
            warn!("Failed to rotate logs: {}", e);
        }
    });

    // 设置 panic hook
    let log_dir_clone = log_dir.clone();
    panic::set_hook(Box::new(move |info| {
        panic_hook_handler(info, log_dir_clone.clone());
    }));

    info!("Crash logger initialized with config: max_log_age_days={}, max_log_size_mb={}, max_total_size_mb={}",
          config.max_log_age_days, config.max_log_size_mb, config.max_total_size_mb);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_temp_log_dir() -> TempDir {
        TempDir::new().unwrap()
    }

    #[test]
    fn test_write_crash_log() {
        let temp_dir = create_temp_log_dir();
        let log_dir = temp_dir.path().to_path_buf();

        let content = "Test crash log content";
        write_crash_log(&log_dir, content.to_string()).unwrap();

        // 验证日志文件存在
        let files: Vec<_> = fs::read_dir(&log_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_file())
            .collect();

        assert_eq!(files.len(), 1);

        let content_read = fs::read_to_string(files[0].path()).unwrap();
        assert!(content_read.contains("Test crash log content"));
    }

    #[test]
    fn test_system_info_collected() {
        let info = collect_system_info();

        assert!(!info.os_name.is_empty());
        assert!(!info.app_version.is_empty());
        assert!(info.memory_total_mb > 0);
    }

    #[test]
    fn test_cleanup_old_logs() {
        use std::time::Duration;
        use filetime::{FileTime, set_file_mtime};

        let temp_dir = create_temp_log_dir();
        let log_dir = temp_dir.path().to_path_buf();

        // 创建一个新日志文件
        let new_file = log_dir.join("crash-20260110-120000.log");
        fs::write(&new_file, "new log").unwrap();

        // 创建一个旧日志文件
        let old_file = log_dir.join("crash-20260101-120000.log");
        fs::write(&old_file, "old log").unwrap();

        // 修改旧文件的时间戳为 8 天前
        let eight_days_ago = SystemTime::now() - Duration::from_secs(8 * 24 * 60 * 60);
        let file_time = FileTime::from_system_time(eight_days_ago);
        set_file_mtime(&old_file, file_time).unwrap();

        // 执行清理
        let deleted = cleanup_old_logs(&log_dir, 7).unwrap();

        assert_eq!(deleted, 1);
        assert!(!old_file.exists());
        assert!(new_file.exists());
    }

    #[test]
    fn test_cleanup_oversized_logs() {
        let temp_dir = create_temp_log_dir();
        let log_dir = temp_dir.path().to_path_buf();

        // 创建多个大文件 (总计 > 100MB)
        for i in 0..12 {
            let file = log_dir.join(format!("crash-2026010{:02}-120000.log", i));
            let content = vec![0u8; 10 * 1024 * 1024]; // 10MB
            fs::write(&file, content).unwrap();

            // 稍微延迟以确保文件时间戳不同
            std::thread::sleep(std::time::Duration::from_millis(10));
        }

        // 执行清理
        let deleted = cleanup_oversized_logs(&log_dir, 100).unwrap();

        assert!(deleted > 0);

        // 验证总大小 < 100MB
        let total_size: u64 = fs::read_dir(&log_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter_map(|e| fs::metadata(e.path()).ok())
            .map(|m| m.len())
            .sum();

        assert!(total_size <= 100 * 1024 * 1024);
    }

    #[test]
    fn test_rotate_logs() {
        let temp_dir = create_temp_log_dir();
        let log_dir = temp_dir.path().to_path_buf();
        let config = CrashLoggerConfig::default();

        // 创建一些测试文件
        fs::write(log_dir.join("crash-20260110-120000.log"), "log1").unwrap();

        let result = rotate_logs(&log_dir, &config);
        assert!(result.is_ok());
    }
}
