# 任务拆分文档: Crash Logging

> **生成方式**: 由 spec-workflow-executor 自动生成
> **生成时间**: 2026-01-10
> **基于文档**: crash-logging-design.md
> **复杂度评级**: STANDARD
> **预计工作量**: 5-7 任务

---

## 1. 任务概览

### 1.1 任务列表

| ID | 任务名称 | 类型 | 优先级 | 预计时间 | 依赖 |
|----|---------|------|--------|---------|------|
| T-001 | 实现 Rust 崩溃日志核心模块 | 开发 | P0 | 3h | 无 |
| T-002 | 实现日志轮转与清理机制 | 开发 | P0 | 2h | T-001 |
| T-003 | 实现 Tauri 命令接口 | 开发 | P0 | 1.5h | T-001 |
| T-004 | 实现前端错误捕获与记录 | 开发 | P0 | 2h | T-003 |
| T-005 | 集成设置页日志管理 UI | 开发 | P1 | 1h | T-003, T-004 |
| T-006 | 编写单元测试与集成测试 | 测试 | P0 | 2.5h | T-001, T-002, T-003, T-004 |
| T-007 | 功能验收与边缘场景测试 | 验收 | P0 | 1.5h | T-001~T-006 |

### 1.2 并行执行分组

根据依赖关系分析, 任务可分为 4 组:

```
Group 1 (并行基础):
├─ T-001: Rust 核心模块 [独立]

Group 2 (依赖 T-001):
├─ T-002: 日志轮转 [依赖 T-001]
└─ T-003: Tauri 命令 [依赖 T-001]

Group 3 (依赖 Group 2):
├─ T-004: 前端错误捕获 [依赖 T-003]
└─ T-005: UI 集成 [依赖 T-003, T-004]

Group 4 (最终验收):
├─ T-006: 测试 [依赖 T-001~T-005]
└─ T-007: 验收 [依赖 T-001~T-006]
```

### 1.3 关键路径

```
T-001 → T-003 → T-004 → T-006 → T-007
```

总关键路径时间: **10.5 小时**

---

## 2. 任务详细说明

### T-001: 实现 Rust 崩溃日志核心模块

#### 目标
实现崩溃日志的核心功能, 包括 panic hook, 系统信息收集, 日志文件写入。

#### 验收标准
- **WHEN** Rust 代码触发 `panic!()`, **THEN** 系统拦截并写入 `crash-{timestamp}.log`
- **WHEN** 写入日志, **THEN** 文件包含: panic 消息、文件名、行号、backtrace、系统信息
- **IF** 日志目录不存在, **THEN** 自动创建, 失败时降级到临时目录
- **WHEN** panic hook 执行, **THEN** 使用同步写入 + flush() 确保落盘

#### 实施步骤 (TDD)

**Step 1: 创建模块骨架**
```rust
// 文件: src-tauri/src/modules/crash_logger.rs

use std::panic::{self, PanicInfo};
use std::path::PathBuf;
use sysinfo::{System, SystemExt};

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

pub fn init_crash_logger(config: CrashLoggerConfig) {
    todo!("实现初始化逻辑");
}
```

**Step 2: 编写测试用例 (RED)**
```rust
// 文件: src-tauri/src/modules/crash_logger/tests.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_panic_hook_writes_log() {
        // 设置临时日志目录
        let temp_dir = std::env::temp_dir().join("crash_log_test");

        // 触发 panic (在子线程中)
        let result = std::panic::catch_unwind(|| {
            panic!("Test panic");
        });

        assert!(result.is_err());

        // 验证日志文件存在
        // TODO: 实现验证逻辑
    }

    #[test]
    fn test_system_info_collected() {
        let info = collect_system_info();

        assert!(!info.os_name.is_empty());
        assert!(!info.app_version.is_empty());
    }

    #[test]
    fn test_create_log_dir_fallback() {
        // 模拟无权限场景
        // TODO: 实现降级测试
    }
}
```

**Step 3: 实现核心功能 (GREEN)**
```rust
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{error, warn, info};

struct SystemInfo {
    os_name: String,
    os_version: String,
    app_version: String,
    memory_total_mb: u64,
    memory_used_mb: u64,
    cpu_arch: String,
}

fn collect_system_info() -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    SystemInfo {
        os_name: System::name().unwrap_or_else(|| "Unknown".to_string()),
        os_version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        memory_total_mb: sys.total_memory() / 1024 / 1024,
        memory_used_mb: sys.used_memory() / 1024 / 1024,
        cpu_arch: std::env::consts::ARCH.to_string(),
    }
}

fn get_crash_log_path(log_dir: &PathBuf) -> PathBuf {
    let timestamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    log_dir.join(format!("crash-{}.log", timestamp))
}

fn write_crash_log(log_dir: &PathBuf, content: String) -> Result<(), String> {
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

    Ok(())
}

fn panic_hook_handler(info: &PanicInfo, log_dir: PathBuf) {
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
        std::backtrace::Backtrace::capture(),
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
        }
    }

    // 同时使用 tracing 记录
    error!("PANIC: {} at {}", message, location);
}

pub fn init_crash_logger(config: CrashLoggerConfig) {
    // 获取日志目录
    let log_dir = match crate::modules::logger::get_log_dir() {
        Ok(dir) => dir,
        Err(e) => {
            eprintln!("Failed to get log directory: {}", e);
            std::env::temp_dir().join("antigravity-tools-logs")
        }
    };

    // 设置 panic hook
    let log_dir_clone = log_dir.clone();
    panic::set_hook(Box::new(move |info| {
        panic_hook_handler(info, log_dir_clone.clone());
    }));

    info!("Crash logger initialized with config: max_log_age_days={}, max_log_size_mb={}, max_total_size_mb={}",
          config.max_log_age_days, config.max_log_size_mb, config.max_total_size_mb);
}
```

**Step 4: 重构 (REFACTOR)**
- 提取 `SystemInfo` 到独立模块
- 添加错误处理降级策略
- 优化日志格式

#### 涉及文件
- 新增: `src-tauri/src/modules/crash_logger.rs`
- 新增: `src-tauri/src/modules/crash_logger/tests.rs`
- 修改: `src-tauri/src/modules/mod.rs` (导出模块)
- 修改: `src-tauri/src/lib.rs` (调用 `init_crash_logger()`)

#### 测试要求
- 单元测试覆盖率 > 80%
- 必须测试 panic hook 触发场景
- 必须测试降级到临时目录

---

### T-002: 实现日志轮转与清理机制

#### 目标
实现按时间和大小的日志轮转策略, 防止磁盘占用失控。

#### 验收标准
- **WHEN** 应用启动, **THEN** 检查并删除超过 7 天的日志文件
- **WHEN** 日志总大小超过 100MB, **THEN** 删除最旧的文件直到低于限制
- **WHEN** 清理完成, **THEN** 记录删除文件数量和释放空间大小

#### 实施步骤 (TDD)

**Step 1: 编写测试用例 (RED)**
```rust
// 文件: src-tauri/src/modules/crash_logger/tests.rs

#[test]
fn test_rotate_logs_older_than_7days() {
    use std::time::Duration;

    let temp_dir = create_temp_log_dir();

    // 创建 8 天前的日志文件
    let old_file = temp_dir.join("crash-20260102-120000.log");
    std::fs::write(&old_file, "old log").unwrap();

    // 修改文件时间戳
    filetime::set_file_mtime(&old_file,
        filetime::FileTime::from_unix_time(
            (SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() - 8 * 24 * 60 * 60) as i64,
            0
        )
    ).unwrap();

    // 执行轮转
    let config = CrashLoggerConfig::default();
    rotate_logs(&temp_dir, &config).unwrap();

    // 验证文件被删除
    assert!(!old_file.exists());
}

#[test]
fn test_rotate_logs_exceeds_size_limit() {
    let temp_dir = create_temp_log_dir();

    // 创建多个大文件 (总计 > 100MB)
    for i in 0..12 {
        let file = temp_dir.join(format!("crash-2026010{}-120000.log", i));
        let content = vec![0u8; 10 * 1024 * 1024]; // 10MB
        std::fs::write(&file, content).unwrap();
    }

    // 执行轮转
    let config = CrashLoggerConfig::default();
    rotate_logs(&temp_dir, &config).unwrap();

    // 验证总大小 < 100MB
    let total_size = get_total_log_size(&temp_dir);
    assert!(total_size < 100 * 1024 * 1024);
}
```

**Step 2: 实现轮转逻辑 (GREEN)**
```rust
// 文件: src-tauri/src/modules/crash_logger.rs

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

fn cleanup_oversized_logs(log_dir: &PathBuf, max_mb: u64) -> Result<usize, String> {
    if !log_dir.exists() {
        return Ok(0);
    }

    let max_bytes = max_mb * 1024 * 1024;
    let mut deleted_count = 0;

    // 收集所有日志文件及其信息
    let mut files: Vec<(PathBuf, SystemTime, u64)> = Vec::new();

    let entries = fs::read_dir(log_dir)
        .map_err(|e| format!("Failed to read log directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();

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
            info!("Deleted oversized log file: {:?}", path.file_name());
        }
    }

    Ok(deleted_count)
}
```

**Step 3: 集成到初始化流程**
```rust
pub fn init_crash_logger(config: CrashLoggerConfig) {
    let log_dir = match crate::modules::logger::get_log_dir() {
        Ok(dir) => dir,
        Err(e) => {
            eprintln!("Failed to get log directory: {}", e);
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
    // ...
}
```

#### 涉及文件
- 修改: `src-tauri/src/modules/crash_logger.rs`
- 修改: `src-tauri/src/modules/crash_logger/tests.rs`
- 新增依赖: `filetime = "0.2"` (用于测试时修改文件时间戳)

#### 测试要求
- 测试时间轮转 (7 天边界)
- 测试大小轮转 (100MB 边界)
- 测试边缘场景: 文件锁定, 权限不足

---

### T-003: 实现 Tauri 命令接口

#### 目标
创建 Tauri 命令供前端调用, 包括 JS 错误记录和打开日志目录。

#### 验收标准
- **WHEN** 前端调用 `log_js_error`, **THEN** 错误信息写入 `crash-{timestamp}.log`
- **WHEN** 前端调用 `open_logs_folder`, **THEN** 系统文件管理器打开日志目录
- **WHEN** 前端调用 `get_logs_path`, **THEN** 返回日志目录路径字符串

#### 实施步骤 (TDD)

**Step 1: 创建命令模块骨架**
```rust
// 文件: src-tauri/src/commands/logging.rs

use tauri::command;

#[command]
pub async fn log_js_error(
    message: String,
    stack: String,
    url: String,
    line: u32,
    column: u32,
) -> Result<(), String> {
    todo!("实现 JS 错误记录");
}

#[command]
pub async fn open_logs_folder(app: tauri::AppHandle) -> Result<(), String> {
    todo!("实现打开日志目录");
}

#[command]
pub async fn get_logs_path() -> Result<String, String> {
    todo!("实现获取日志路径");
}
```

**Step 2: 实现命令逻辑 (GREEN)**
```rust
use crate::modules::{crash_logger, logger};
use tauri_plugin_opener::OpenerExt;

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

#[command]
pub async fn open_logs_folder(app: tauri::AppHandle) -> Result<(), String> {
    let log_dir = logger::get_log_dir()?;

    // 确保目录存在
    if !log_dir.exists() {
        std::fs::create_dir_all(&log_dir)
            .map_err(|e| format!("Failed to create log directory: {}", e))?;
    }

    // 使用 tauri-plugin-opener 打开目录
    app.opener()
        .open_path(log_dir)
        .map_err(|e| format!("Failed to open log folder: {}", e))?;

    Ok(())
}

#[command]
pub async fn get_logs_path() -> Result<String, String> {
    let log_dir = logger::get_log_dir()?;

    log_dir
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to convert path to string".to_string())
}
```

**Step 3: 注册命令**
```rust
// 文件: src-tauri/src/commands/mod.rs

pub mod logging;

pub use logging::{log_js_error, open_logs_folder, get_logs_path};
```

```rust
// 文件: src-tauri/src/lib.rs

.invoke_handler(tauri::generate_handler![
    // ...existing commands...
    commands::log_js_error,
    commands::open_logs_folder,
    commands::get_logs_path,
])
```

**Step 4: 暴露辅助函数**
```rust
// 文件: src-tauri/src/modules/crash_logger.rs

// 将 collect_system_info 和 write_crash_log 设为 pub
pub fn collect_system_info() -> SystemInfo { /* ... */ }
pub fn write_crash_log(log_dir: &PathBuf, content: String) -> Result<(), String> { /* ... */ }
```

#### 涉及文件
- 新增: `src-tauri/src/commands/logging.rs`
- 修改: `src-tauri/src/commands/mod.rs`
- 修改: `src-tauri/src/lib.rs`
- 修改: `src-tauri/src/modules/crash_logger.rs` (暴露函数)

#### 测试要求
- 集成测试: 调用命令验证文件生成
- Mock 测试: 验证 `opener` 调用

---

### T-004: 实现前端错误捕获与记录

#### 目标
实现前端全局错误处理器, React Error Boundary, 以及错误日志工具类。

#### 验收标准
- **WHEN** 触发 `window.onerror`, **THEN** 调用 `log_js_error` 命令
- **WHEN** 触发 `unhandledrejection`, **THEN** 调用 `log_js_error` 命令
- **WHEN** React 组件抛错, **THEN** ErrorBoundary 捕获并记录
- **WHEN** IPC 调用失败, **THEN** 降级到 `console.error`

#### 实施步骤 (TDD)

**Step 1: 创建 errorLogger.ts**
```typescript
// 文件: src/utils/errorLogger.ts

import { invoke } from '@tauri-apps/api/core';

export interface ErrorInfo {
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
}

export class ErrorLogger {
  /**
   * 记录 JS 错误到后端
   */
  static async logError(error: Error | ErrorInfo): Promise<void> {
    try {
      const errorInfo = this.formatError(error);

      await invoke('log_js_error', {
        message: errorInfo.message,
        stack: errorInfo.stack || '',
        url: errorInfo.url || window.location.href,
        line: errorInfo.line || 0,
        column: errorInfo.column || 0,
      });
    } catch (e) {
      // 降级: 记录到 console
      console.error('[ErrorLogger] Failed to log error to backend:', e);
      console.error('[Original Error]:', error);
    }
  }

  private static formatError(error: Error | ErrorInfo): ErrorInfo {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        url: window.location.href,
      };
    }
    return error;
  }

  /**
   * 打开日志文件夹
   */
  static async openLogsFolder(): Promise<void> {
    await invoke('open_logs_folder');
  }

  /**
   * 获取日志路径
   */
  static async getLogsPath(): Promise<string> {
    return await invoke('get_logs_path');
  }
}
```

**Step 2: 创建 ErrorBoundary.tsx**
```typescript
// 文件: src/components/ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorLogger } from '../utils/errorLogger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录到后端
    ErrorLogger.logError({
      message: `React Component Error: ${error.message}`,
      stack: error.stack + '\n\nComponent Stack:\n' + errorInfo.componentStack,
      url: window.location.href,
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <div className="card w-96 bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-error">Something went wrong</h2>
              <p className="text-sm text-base-content/70">
                {this.state.error?.message}
              </p>
              <div className="card-actions justify-end mt-4">
                <button
                  className="btn btn-primary"
                  onClick={() => window.location.reload()}
                >
                  Reload Application
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Step 3: 注册全局错误处理器**
```typescript
// 文件: src/main.tsx (在现有代码基础上添加)

import { ErrorLogger } from './utils/errorLogger';

// window.onerror 处理器
window.onerror = (message, source, lineno, colno, error) => {
  ErrorLogger.logError({
    message: typeof message === 'string' ? message : message.toString(),
    stack: error?.stack,
    url: source,
    line: lineno,
    column: colno,
  });

  return false; // 不阻止默认行为
};

// unhandledrejection 处理器
window.addEventListener('unhandledrejection', (event) => {
  ErrorLogger.logError({
    message: `Unhandled Promise Rejection: ${event.reason}`,
    stack: event.reason?.stack,
    url: window.location.href,
  });
});

// 包裹 App 组件
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
```

**Step 4: 编写测试用例**
```typescript
// 文件: src/__tests__/errorLogger.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorLogger } from '../utils/errorLogger';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('ErrorLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log error to backend', async () => {
    const { invoke } = await import('@tauri-apps/api/core');

    const error = new Error('Test error');
    await ErrorLogger.logError(error);

    expect(invoke).toHaveBeenCalledWith('log_js_error', {
      message: 'Test error',
      stack: expect.any(String),
      url: expect.any(String),
      line: 0,
      column: 0,
    });
  });

  it('should fallback to console.error on IPC failure', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as any).mockRejectedValue(new Error('IPC failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const error = new Error('Test error');
    await ErrorLogger.logError(error);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to log error'),
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
```

#### 涉及文件
- 新增: `src/utils/errorLogger.ts`
- 新增: `src/components/ErrorBoundary.tsx`
- 修改: `src/main.tsx`
- 新增: `src/__tests__/errorLogger.test.ts` (可选, 如果项目有测试框架)

#### 测试要求
- 手动测试: 触发 JS 错误验证日志记录
- 单元测试: Mock IPC 调用

---

### T-005: 集成设置页日志管理 UI

#### 目标
在设置页添加日志管理部分, 显示日志路径并提供打开按钮。

#### 验收标准
- **WHEN** 用户进入设置页, **THEN** 显示日志目录路径
- **WHEN** 用户点击"打开日志文件夹"按钮, **THEN** 系统文件管理器打开日志目录
- **IF** 日志目录不存在, **THEN** 自动创建后再打开

#### 实施步骤

**Step 1: 添加日志管理部分**
```typescript
// 文件: src/pages/Settings.tsx (在现有代码基础上添加)

import { ErrorLogger } from '../utils/errorLogger';

function LogManagementSection() {
  const [logsPath, setLogsPath] = React.useState<string>('Loading...');
  const [isOpening, setIsOpening] = React.useState(false);

  React.useEffect(() => {
    ErrorLogger.getLogsPath()
      .then(setLogsPath)
      .catch((err) => {
        console.error('Failed to get logs path:', err);
        setLogsPath('Error loading path');
      });
  }, []);

  const handleOpenLogs = async () => {
    setIsOpening(true);
    try {
      await ErrorLogger.openLogsFolder();
    } catch (error) {
      console.error('Failed to open logs folder:', error);
      alert('Failed to open logs folder. Please check the path manually.');
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Crash Logs</h3>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Log Directory</span>
        </label>
        <input
          type="text"
          value={logsPath}
          readOnly
          className="input input-bordered w-full font-mono text-sm"
        />
      </div>

      <div className="form-control">
        <button
          onClick={handleOpenLogs}
          disabled={isOpening}
          className="btn btn-primary"
        >
          {isOpening ? 'Opening...' : 'Open Log Folder'}
        </button>
      </div>

      <div className="alert alert-info">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span className="text-sm">
          Crash logs are stored locally for troubleshooting.
          Logs older than 7 days are automatically deleted.
        </span>
      </div>
    </div>
  );
}

// 在 Settings 组件中添加此部分
export default function Settings() {
  return (
    <div className="container mx-auto p-6">
      {/* ...existing settings sections... */}

      <div className="divider"></div>

      <LogManagementSection />
    </div>
  );
}
```

**Step 2: 样式调整 (可选)**
- 确保与现有设置页风格一致
- 使用 DaisyUI 组件库保持统一

#### 涉及文件
- 修改: `src/pages/Settings.tsx`

#### 测试要求
- 手动测试: 验证路径显示正确
- 手动测试: 点击按钮能打开目录

---

### T-006: 编写单元测试与集成测试

#### 目标
完善测试覆盖, 确保所有核心功能有测试保障。

#### 验收标准
- **WHEN** 运行 `cargo test`, **THEN** 所有 Rust 单元测试通过
- **WHEN** 运行集成测试, **THEN** JS 错误能正确写入日志文件
- 测试覆盖率 > 80%

#### 实施步骤

**Step 1: 完善 Rust 单元测试**
```rust
// 文件: src-tauri/src/modules/crash_logger/tests.rs

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use tempfile::TempDir;

    fn create_temp_log_dir() -> PathBuf {
        let temp_dir = TempDir::new().unwrap();
        temp_dir.into_path()
    }

    #[test]
    fn test_panic_hook_writes_log() {
        let temp_dir = create_temp_log_dir();

        // 注意: 由于 panic hook 是全局的, 这里需要特殊处理
        // 可以直接测试 write_crash_log 函数
        let content = "Test crash log";
        write_crash_log(&temp_dir, content.to_string()).unwrap();

        // 验证日志文件存在
        let files: Vec<_> = fs::read_dir(&temp_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_file())
            .collect();

        assert_eq!(files.len(), 1);

        let content_read = fs::read_to_string(files[0].path()).unwrap();
        assert!(content_read.contains("Test crash log"));
    }

    #[test]
    fn test_system_info_collected() {
        let info = collect_system_info();

        assert!(!info.os_name.is_empty());
        assert!(!info.app_version.is_empty());
        assert!(info.memory_total_mb > 0);
    }

    #[test]
    fn test_rotate_logs_older_than_7days() {
        // (已在 T-002 中实现)
    }

    #[test]
    fn test_rotate_logs_exceeds_size_limit() {
        // (已在 T-002 中实现)
    }

    #[test]
    fn test_create_log_dir_fallback() {
        // 测试降级到临时目录
        let invalid_dir = PathBuf::from("/invalid/path/that/does/not/exist");

        // 模拟写入失败后的降级
        let result = write_crash_log(&invalid_dir, "test".to_string());
        assert!(result.is_err());

        // 验证降级逻辑 (在实际代码中会写入 temp_dir)
    }
}
```

**Step 2: 添加集成测试 (可选)**
```rust
// 文件: src-tauri/tests/crash_logging_integration.rs

#[tokio::test]
async fn test_log_js_error_command() {
    // Mock Tauri app context
    // 调用 log_js_error 命令
    // 验证文件生成

    // 注意: Tauri 集成测试需要完整的应用上下文,
    // 可能需要使用 tauri::test::mock_builder()
}
```

**Step 3: 前端测试 (如果有测试框架)**
```typescript
// 文件: src/__tests__/error-boundary.test.tsx

import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { describe, it, expect, vi } from 'vitest';

const ThrowError = () => {
  throw new Error('Test error');
};

describe('ErrorBoundary', () => {
  it('should catch and display error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/Test error/i)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });
});
```

#### 涉及文件
- 修改: `src-tauri/src/modules/crash_logger/tests.rs`
- 新增: `src-tauri/tests/crash_logging_integration.rs` (可选)
- 新增: `src/__tests__/error-boundary.test.tsx` (可选)
- 新增依赖: `tempfile = "3"` (Rust 测试)

#### 测试要求
- 所有单元测试通过
- 关键路径有集成测试覆盖

---

### T-007: 功能验收与边缘场景测试

#### 目标
执行完整的功能验收清单, 验证所有边缘场景。

#### 验收标准
- 功能验收清单 (requirements.md 第 4 节) 中所有项目标记为 ✅
- 所有边缘场景正确处理

#### 实施步骤

**Step 1: 执行功能验收清单**

基于 `crash-logging-requirements.md` 第 4 节:

| ID | 功能点 | 验收步骤 | 通过 |
|----|--------|----------|------|
| F-001 | Rust panic 自动记录 | 1. 触发 Rust panic 2. 检查日志文件 | ☐ → ✅ |
| F-002 | JS 全局错误捕获 | 1. 触发 JS 错误 2. 验证日志 | ☐ → ✅ |
| F-003 | React 组件错误捕获 | 1. 组件错误 2. 验证 ErrorBoundary | ☐ → ✅ |
| F-004 | 系统信息附加 | 1. 触发崩溃 2. 检查日志包含系统信息 | ☐ → ✅ |
| F-005 | 日志按时间轮转 | 1. 创建旧日志 2. 重启应用 3. 验证删除 | ☐ → ✅ |
| F-006 | 日志按大小轮转 | 1. 写入大量数据 2. 检查新文件 | ☐ → ✅ |
| F-007 | 日志总大小限制 | 1. 生成大量日志 2. 检查总大小 | ☐ → ✅ |
| F-008 | 设置页打开日志 | 1. 进入设置 2. 点击按钮 | ☐ → ✅ |
| F-009 | 边缘: 无权限 | 1. 模拟无权限 2. 验证降级 | ☐ → ✅ |
| F-010 | 边缘: 目录不存在 | 1. 删除目录 2. 验证自动创建 | ☐ → ✅ |
| F-011 | 边缘: sysinfo 失败 | 1. 模拟失败 2. 验证降级信息 | ☐ → ✅ |

**Step 2: 边缘场景测试**

| 场景 | 测试方法 | 预期结果 |
|------|---------|---------|
| 日志目录无写权限 | 修改目录权限为只读 | 降级到临时目录 |
| 单次写入超大内容 | 写入 > 1MB 数据 | 截断或拒绝 |
| 并发写入冲突 | 多线程同时写入 | 无数据丢失 |
| 文件系统满 | 模拟磁盘满 | 错误处理不崩溃 |
| Panic hook 中再次 panic | 在 hook 中触发 panic | 使用 catch_unwind 保护 |

**Step 3: 更新 requirements.md**

将功能验收清单中的 ☐ 更新为 ✅, 并填写关联任务 ID:

```markdown
| ID | 功能点 | 验收步骤 | 优先级 | 关联任务 | 通过 |
|----|--------|----------|--------|----------|------|
| F-001 | Rust panic 自动记录 | ... | P0 | T-001 | ✅ |
| F-002 | JS 全局错误捕获 | ... | P0 | T-004 | ✅ |
...
```

**Step 4: 生成验收报告**

创建 `crash-logging-acceptance.md` 记录验收结果:

```markdown
# 功能验收报告: Crash Logging

## 验收时间
2026-01-10

## 验收结果
- 总功能点: 11
- 通过: 11
- 失败: 0
- 通过率: 100%

## 详细结果
[详细的测试记录]

## 已知问题
- 无

## 建议
- 后续可扩展 breadcrumb 机制
```

#### 涉及文件
- 修改: `docs/dev/crash-logging/crash-logging-requirements.md` (更新验收清单)
- 新增: `docs/dev/crash-logging/crash-logging-acceptance.md` (验收报告)

#### 测试要求
- 100% 功能点通过
- 所有 P0 边缘场景处理正确

---

## 3. 实施顺序建议

### 3.1 批量执行模式 (execution=batch)

按并行分组执行:

**Batch 1**: T-001 (基础)
- 确认通过后继续

**Batch 2**: T-002, T-003 (并行)
- 确认通过后继续

**Batch 3**: T-004, T-005 (并行)
- 确认通过后继续

**Batch 4**: T-006, T-007 (顺序)
- 最终验收

### 3.2 里程碑

| 里程碑 | 完成标志 | 交付物 |
|--------|---------|--------|
| M1 | T-001 完成 | Rust 核心模块可用 |
| M2 | T-002, T-003 完成 | 后端功能完整 |
| M3 | T-004, T-005 完成 | 前后端集成完成 |
| M4 | T-006, T-007 完成 | 功能验收通过 |

---

## 4. 风险与缓解

| 任务 | 风险 | 缓解措施 |
|------|------|---------|
| T-001 | Panic hook 测试困难 | 拆分测试: 直接测试 write_crash_log |
| T-002 | 文件锁导致删除失败 | 跳过被锁定文件, 记录 warning |
| T-004 | IPC 调用失败频繁 | 完善降级策略, 确保不影响用户体验 |
| T-006 | 测试覆盖率不足 | 优先测试关键路径, 可接受 80% 覆盖率 |

---

## 5. 依赖管理

### 5.1 新增依赖

**Rust (Cargo.toml)**:
```toml
[dev-dependencies]
tempfile = "3"        # 用于测试创建临时目录
filetime = "0.2"      # 用于测试修改文件时间戳
```

**Frontend (package.json)**:
无需新增依赖 (如果添加测试框架则需要 vitest, @testing-library/react 等)

### 5.2 已有依赖复用

- `tracing`, `tracing-subscriber`, `tracing-appender`
- `sysinfo`
- `thiserror`
- `tauri-plugin-opener`
- `chrono`

---

## 6. 文档交付

完成后需交付以下文档:

1. ✅ `crash-logging-requirements.md` (已存在, 更新验收清单)
2. ✅ `crash-logging-design.md` (已生成)
3. ✅ `crash-logging-tasks.md` (本文档)
4. ⏳ `crash-logging-acceptance.md` (T-007 生成)
5. ⏳ `crash-logging-context.md` (更新执行状态)

---

## 7. 评审要求

根据 STANDARD 复杂度, 每个任务完成后进行两阶段评审:

**阶段1: 规范符合性评审**
- 是否按照 design.md 实现
- 是否遵循 TDD 流程
- 是否满足验收标准

**阶段2: 代码质量评审**
- 代码可读性
- 错误处理完整性
- 测试覆盖充分性

评审轮次上限: 2 轮

---

**下一步**: 用户确认后进入 Execution 阶段
