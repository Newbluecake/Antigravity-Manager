# 技术设计文档: Crash Logging

> **生成方式**: 由 spec-workflow-executor 自动生成
> **生成时间**: 2026-01-10
> **基于文档**: crash-logging-requirements.md
> **复杂度评级**: STANDARD

---

## 1. 架构概览

### 1.1 系统分层

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ Global Error   │  │ React Error      │  │ Settings UI  │ │
│  │ Handlers       │  │ Boundary         │  │ (Open Logs)  │ │
│  └────────┬───────┘  └────────┬─────────┘  └──────┬───────┘ │
│           │                   │                    │         │
│           └───────────────────┴────────────────────┘         │
│                               │                              │
│                    [Tauri IPC Commands]                      │
│                               │                              │
├───────────────────────────────┼──────────────────────────────┤
│                     Backend (Rust)                           │
│  ┌────────────────────────────┴────────────────────────┐    │
│  │           Crash Logging Module                      │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │    │
│  │  │ Panic Hook   │  │ JS Error     │  │ Log       │ │    │
│  │  │ Handler      │  │ Logger       │  │ Rotation  │ │    │
│  │  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │    │
│  │         │                 │                 │       │    │
│  │         └─────────────────┴─────────────────┘       │    │
│  │                           │                         │    │
│  │                  ┌────────┴─────────┐               │    │
│  │                  │ File Writer      │               │    │
│  │                  │ (tracing-appender)│              │    │
│  │                  └────────┬─────────┘               │    │
│  └───────────────────────────┼─────────────────────────┘    │
│                               │                              │
│  ┌────────────────────────────┴────────────────────────┐    │
│  │         Existing Logger Infrastructure              │    │
│  │  (tracing, tracing-subscriber, daily rotation)      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  File System         │
                    │  ~/logs/             │
                    │  - app.log           │
                    │  - crash-*.log       │
                    └──────────────────────┘
```

### 1.2 核心模块

| 模块 | 职责 | 位置 |
|------|------|------|
| `crash_logger` | Panic hook, 崩溃日志写入, 系统信息收集 | `src-tauri/src/modules/crash_logger.rs` |
| `log_rotation` | 日志轮转, 文件清理, 大小管理 | 集成在 `crash_logger` 中 |
| `tauri commands` | JS 错误记录, 打开日志目录 | `src-tauri/src/commands/logging.rs` |
| Frontend handlers | 全局错误捕获, Error Boundary | `src/utils/errorLogger.ts`, `src/components/ErrorBoundary.tsx` |

---

## 2. 数据流设计

### 2.1 Rust Panic 捕获流程

```
[Rust Code]
    │ panic!()
    ▼
[std::panic::set_hook]
    │ 拦截 panic
    ▼
[Panic Hook Handler]
    ├─ 提取 panic 信息 (message, location, backtrace)
    ├─ 收集系统信息 (OS, memory, version)
    ├─ 格式化日志内容
    ▼
[Write to crash-YYYYMMDD-HHMMSS.log]
    ├─ 使用同步写入 + flush() 确保落盘
    ├─ 降级策略: 日志目录不可写 → 临时目录
    ▼
[Log File Created]
    └─ Windows: %APPDATA%/antigravity-tools/logs/
    └─ macOS: ~/Library/Application Support/antigravity-tools/logs/
    └─ Linux: ~/.local/share/antigravity-tools/logs/
```

### 2.2 JavaScript 错误捕获流程

```
[Frontend Code]
    │ throw Error / Promise.reject
    ▼
[Global Handlers]
    ├─ window.onerror
    ├─ window.onunhandledrejection
    └─ React Error Boundary
        │
        ▼
[errorLogger.logError()]
    ├─ 格式化错误信息 (message, stack, url, line)
    ▼
[Tauri Command: log_js_error]
    │ IPC 调用
    ▼
[Backend: log_js_error_handler]
    ├─ 收集系统信息
    ├─ 格式化日志
    ▼
[Write to crash-YYYYMMDD-HHMMSS.log]
```

### 2.3 日志轮转流程

```
[Application Startup]
    │
    ▼
[init_crash_logger()]
    ├─ 检查日志目录
    ├─ 扫描现有日志文件
    ▼
[Rotation Check]
    ├─ 按时间: 删除 > 7 天的文件
    ├─ 按大小: 总大小 > 100MB → 删除最旧文件
    └─ 单文件 > 10MB → 标记需要新文件
        │
        ▼
[Cleanup Execution]
    ├─ 删除符合条件的文件
    ├─ 记录清理日志
    ▼
[Rotation Complete]
```

---

## 3. 模块详细设计

### 3.1 Rust 模块: crash_logger.rs

#### 3.1.1 模块结构

```rust
// src-tauri/src/modules/crash_logger.rs

use std::panic::{self, PanicInfo};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::{System, SystemExt};
use tracing::{error, warn, info};

/// 崩溃日志配置
pub struct CrashLoggerConfig {
    pub max_log_age_days: u64,      // 日志保留天数 (默认 7)
    pub max_log_size_mb: u64,       // 单文件最大大小 (默认 10)
    pub max_total_size_mb: u64,     // 总大小限制 (默认 100)
}

/// 初始化崩溃日志系统
pub fn init_crash_logger(config: CrashLoggerConfig);

/// 设置 panic hook
fn setup_panic_hook(log_dir: PathBuf);

/// Panic hook 处理函数
fn panic_hook_handler(info: &PanicInfo, log_dir: PathBuf);

/// 收集系统信息
fn collect_system_info() -> SystemInfo;

/// 写入崩溃日志
fn write_crash_log(log_dir: &PathBuf, content: String) -> Result<(), String>;

/// 执行日志轮转
pub fn rotate_logs(log_dir: &PathBuf, config: &CrashLoggerConfig) -> Result<(), String>;

/// 按时间清理旧日志
fn cleanup_old_logs(log_dir: &PathBuf, days: u64) -> Result<usize, String>;

/// 按大小清理日志
fn cleanup_oversized_logs(log_dir: &PathBuf, max_mb: u64) -> Result<usize, String>;
```

#### 3.1.2 核心函数实现逻辑

**init_crash_logger()**:
1. 获取日志目录路径 (复用 `modules::logger::get_log_dir()`)
2. 创建目录 (如不存在)
3. 执行日志轮转清理
4. 设置 panic hook
5. 记录初始化日志

**panic_hook_handler()**:
1. 提取 panic 信息:
   - `info.payload()` → panic 消息
   - `info.location()` → 文件名和行号
   - `std::backtrace::Backtrace::capture()` → 堆栈 (需开启 `RUST_BACKTRACE=1`)
2. 收集系统信息 (OS, 内存, CPU)
3. 格式化日志内容:
   ```
   ========== PANIC CRASH LOG ==========
   Time: 2026-01-10T15:30:00+08:00
   Panic Message: <message>
   Location: <file>:<line>

   Backtrace:
   <backtrace>

   System Information:
   - OS: Windows 10.0.19045
   - App Version: 3.3.22
   - Memory: 8192 MB total, 3072 MB used
   - CPU: x86_64
   =====================================
   ```
4. 写入 `crash-{timestamp}.log`
5. 同步 flush 确保写入

**rotate_logs()**:
1. 调用 `cleanup_old_logs()` 按时间清理
2. 调用 `cleanup_oversized_logs()` 按大小清理
3. 返回清理统计

### 3.2 Tauri Commands: commands/logging.rs

#### 3.2.1 命令定义

```rust
// src-tauri/src/commands/logging.rs

use tauri::command;
use crate::modules::crash_logger;

/// JavaScript 错误记录命令
#[command]
pub async fn log_js_error(
    message: String,
    stack: String,
    url: String,
    line: u32,
    column: u32,
) -> Result<(), String>;

/// 打开日志目录命令
#[command]
pub async fn open_logs_folder() -> Result<(), String>;

/// 获取日志目录路径
#[command]
pub async fn get_logs_path() -> Result<String, String>;
```

#### 3.2.2 实现逻辑

**log_js_error()**:
1. 收集系统信息
2. 格式化 JS 错误日志:
   ```
   ========== JS ERROR LOG ==========
   Time: 2026-01-10T15:30:00+08:00
   Message: <message>
   URL: <url>
   Location: Line <line>, Column <column>

   Stack Trace:
   <stack>

   System Information:
   - OS: Windows 10.0.19045
   - App Version: 3.3.22
   ==================================
   ```
3. 写入 `crash-{timestamp}.log`
4. 返回结果

**open_logs_folder()**:
1. 获取日志目录路径
2. 检查目录是否存在 (不存在则创建)
3. 使用 `tauri-plugin-opener` 打开目录:
   ```rust
   use tauri_plugin_opener::OpenerExt;
   app.opener().open_path(log_dir)?;
   ```

### 3.3 Frontend: Error Handling

#### 3.3.1 文件结构

```
src/utils/errorLogger.ts      # 错误日志工具
src/components/ErrorBoundary.tsx  # React Error Boundary
src/main.tsx                   # 全局错误处理器注册
```

#### 3.3.2 errorLogger.ts

```typescript
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
      console.error('[ErrorLogger] Failed to log error:', e);
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

#### 3.3.3 ErrorBoundary.tsx

```typescript
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
      message: error.message,
      stack: error.stack + '\n\nComponent Stack:\n' + errorInfo.componentStack,
      url: window.location.href,
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### 3.3.4 Global Error Handlers (main.tsx)

```typescript
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
```

### 3.4 UI 集成: Settings Page

#### 3.4.1 新增设置项

在 `src/pages/Settings.tsx` 中添加日志管理部分:

```typescript
import { ErrorLogger } from '../utils/errorLogger';

function LogManagementSection() {
  const [logsPath, setLogsPath] = React.useState<string>('');

  React.useEffect(() => {
    ErrorLogger.getLogsPath().then(setLogsPath).catch(console.error);
  }, []);

  const handleOpenLogs = async () => {
    try {
      await ErrorLogger.openLogsFolder();
    } catch (error) {
      console.error('Failed to open logs folder:', error);
    }
  };

  return (
    <div className="setting-section">
      <h3>Crash Logs</h3>
      <div className="setting-item">
        <label>Log Directory</label>
        <div className="log-path">{logsPath}</div>
      </div>
      <div className="setting-item">
        <button onClick={handleOpenLogs} className="btn btn-primary">
          Open Log Folder
        </button>
      </div>
      <div className="setting-hint">
        Crash logs are stored locally for troubleshooting. Logs older than 7 days are automatically deleted.
      </div>
    </div>
  );
}
```

---

## 4. 文件组织

### 4.1 新增文件

```
src-tauri/src/modules/crash_logger.rs    # 崩溃日志核心模块
src-tauri/src/commands/logging.rs        # Tauri 命令
src-tauri/src/modules/crash_logger/      # (可选) 子模块拆分
    ├── panic_hook.rs                    # Panic hook 逻辑
    ├── rotation.rs                      # 日志轮转逻辑
    ├── system_info.rs                   # 系统信息收集
    └── mod.rs

src/utils/errorLogger.ts                 # 前端错误日志工具
src/components/ErrorBoundary.tsx         # React Error Boundary

src-tauri/src/logging/tests.rs           # 单元测试
src/__tests__/crash-logging.test.ts      # 集成测试
src/__tests__/error-boundary.test.tsx    # Error Boundary 测试
```

### 4.2 修改文件

```
src-tauri/src/lib.rs                     # 注册新的 Tauri 命令
src-tauri/src/modules/mod.rs             # 导出 crash_logger 模块
src-tauri/src/commands/mod.rs            # 导出 logging 命令
src/main.tsx                             # 添加全局错误处理器
src/App.tsx                              # 包裹 ErrorBoundary
src/pages/Settings.tsx                   # 添加日志管理 UI
src-tauri/Cargo.toml                     # (无需新增依赖)
```

---

## 5. 技术决策

### 5.1 依赖选择

| 需求 | 方案 | 理由 |
|------|------|------|
| Panic 捕获 | `std::panic::set_hook` | 标准库支持, 无需额外依赖 |
| 日志写入 | `tracing` + 手动文件写入 | 复用现有基础设施, 独立崩溃日志文件 |
| 日志轮转 | 手动实现 | `tracing-appender` 不支持大小轮转, 需要自定义逻辑 |
| 系统信息 | `sysinfo` (已存在) | 已在依赖中, 跨平台支持 |
| 文件打开 | `tauri-plugin-opener` (已存在) | 已集成, 跨平台兼容 |

### 5.2 日志文件命名策略

| 类型 | 命名格式 | 示例 | 说明 |
|------|----------|------|------|
| 正常日志 | `app.log` | `app.log` | 由现有 logger 管理, 每日轮转 |
| 崩溃日志 | `crash-YYYYMMDD-HHMMSS.log` | `crash-20260110-153045.log` | 每次崩溃独立文件, 便于追溯 |

### 5.3 日志目录统一

复用现有 `modules::logger::get_log_dir()`:
- Windows: `%APPDATA%/antigravity-tools/logs/`
- macOS: `~/Library/Application Support/antigravity-tools/logs/`
- Linux: `~/.local/share/antigravity-tools/logs/`

### 5.4 错误处理降级策略

| 场景 | 降级方案 |
|------|----------|
| 日志目录无写权限 | 写入 `std::env::temp_dir()` + 记录警告 |
| 系统信息收集失败 | 使用静态信息 (仅 App 版本) |
| 文件写入失败 | 输出到 stderr + tracing::error! |
| IPC 调用失败 (JS → Rust) | 前端降级到 console.error |

### 5.5 性能优化

| 操作 | 优化方案 |
|------|----------|
| Panic 写入 | 同步写入 + flush(), 确保崩溃前落盘 |
| 日志轮转 | 异步执行 (启动时后台清理) |
| JS 错误记录 | 异步 IPC, 不阻塞 UI 线程 |
| 大小检查 | 仅在启动时执行, 不影响运行时性能 |

### 5.6 安全与隐私

| 风险 | 防护措施 |
|------|----------|
| 敏感数据泄露 | 正则脱敏 `(Authorization|Token|Password):\s*\S+` → `***` |
| 文件权限 | Unix: `chmod 600`, Windows: 当前用户 ACL |
| 日志注入 | 转义换行符 `\n` → `\\n` |
| 磁盘占用攻击 | 严格大小限制 (单文件 10MB, 总计 100MB) |

---

## 6. 集成点

### 6.1 与现有 Logger 的关系

```
┌─────────────────────────────────────────┐
│        modules::logger (已存在)          │
│  - tracing-subscriber 初始化             │
│  - 文件 appender (app.log, 每日轮转)     │
│  - 控制台输出                             │
└─────────────────┬───────────────────────┘
                  │ 复用
                  ▼
┌─────────────────────────────────────────┐
│      modules::crash_logger (新增)        │
│  - Panic hook (独立日志文件)             │
│  - JS 错误记录 (独立日志文件)             │
│  - 日志轮转 (清理所有 logs/ 目录)         │
└─────────────────────────────────────────┘
```

**集成原则**:
1. 不修改现有 `logger::init_logger()` 逻辑
2. 崩溃日志写入独立文件 (不使用 tracing 订阅器)
3. 轮转清理应用于整个 logs/ 目录 (包括 app.log 和 crash-*.log)
4. Panic hook 中可选择使用 `tracing::error!()` 同时记录到 app.log

### 6.2 初始化顺序

在 `src-tauri/src/lib.rs` 的 `run()` 函数中:

```rust
pub fn run() {
    // 1. 初始化正常日志 (已存在)
    logger::init_logger();

    // 2. 初始化崩溃日志 (新增)
    crash_logger::init_crash_logger(CrashLoggerConfig::default());

    // 3. Tauri 应用构建
    tauri::Builder::default()
        // ...
        .invoke_handler(tauri::generate_handler![
            // 新增命令
            commands::logging::log_js_error,
            commands::logging::open_logs_folder,
            commands::logging::get_logs_path,
        ])
        // ...
}
```

### 6.3 Tauri 命令注册

在 `src-tauri/src/commands/mod.rs`:

```rust
pub mod logging;

pub use logging::{log_js_error, open_logs_folder, get_logs_path};
```

---

## 7. 测试策略

### 7.1 单元测试 (Rust)

**文件**: `src-tauri/src/modules/crash_logger/tests.rs`

| 测试用例 | 验证点 |
|---------|--------|
| `test_panic_hook_writes_log` | 触发 panic → 检查文件存在 + 内容包含堆栈 |
| `test_create_log_dir_fallback` | 无权限 → 降级到临时目录 |
| `test_system_info_collected` | 系统信息包含 OS/版本/内存 |
| `test_rotate_logs_older_than_7days` | 创建 8 天前文件 → 被删除 |
| `test_rotate_logs_exceeds_size_limit` | 总大小 > 100MB → 删除最旧文件 |
| `test_single_file_rotation` | 单文件 > 10MB → 新文件创建 (验证逻辑) |

### 7.2 集成测试 (Frontend)

**文件**: `src/__tests__/crash-logging.test.ts`

| 测试用例 | 验证点 |
|---------|--------|
| `test_js_error_logged_to_file` | 触发 JS 错误 → 调用 IPC → 检查文件 |
| `test_open_logs_folder` | 调用命令 → 验证无错误 (需 mock) |
| `test_error_logger_fallback` | IPC 失败 → console.error 被调用 |

**文件**: `src/__tests__/error-boundary.test.tsx`

| 测试用例 | 验证点 |
|---------|--------|
| `test_component_error_captured` | 组件抛错 → ErrorBoundary 渲染 fallback |
| `test_error_boundary_logs_to_backend` | 组件抛错 → IPC 被调用 (mock) |

---

## 8. 配置参数

### 8.1 默认配置

```rust
impl Default for CrashLoggerConfig {
    fn default() -> Self {
        Self {
            max_log_age_days: 7,
            max_log_size_mb: 10,
            max_total_size_mb: 100,
        }
    }
}
```

### 8.2 可配置性 (未来扩展)

可在 `AppConfig` (modules/config.rs) 中添加:

```rust
pub struct LogConfig {
    pub crash_log_retention_days: u64,
    pub crash_log_max_size_mb: u64,
}
```

当前版本硬编码默认值, 后续可从配置文件读取。

---

## 9. 边缘场景处理

| 场景 | 处理方式 |
|------|----------|
| 日志目录不存在 | 自动创建, 失败则降级到临时目录 |
| 日志目录无写权限 | 降级到 `temp_dir()`, 记录 warning |
| 单次写入超大内容 | 截断到 1MB (防止恶意注入) |
| 系统信息获取失败 | 使用降级信息 (仅 App 版本 + 时间戳) |
| Panic hook 中再次 panic | 使用 `catch_unwind` 包裹, 输出到 stderr |
| 文件轮转删除失败 (文件锁) | 跳过该文件, 记录 warning, 继续处理其他 |

---

## 10. 性能与资源消耗

### 10.1 启动时性能影响

| 操作 | 预期耗时 |
|------|---------|
| 初始化 panic hook | < 1 ms |
| 扫描日志目录 | < 50 ms (100 个文件) |
| 执行轮转清理 | < 200 ms (异步, 不阻塞 UI) |

### 10.2 运行时性能影响

| 操作 | 预期耗时 |
|------|---------|
| Panic 发生 (写入日志) | < 10 ms (同步写入) |
| JS 错误记录 (IPC) | < 5 ms (异步) |
| 打开日志目录 | < 100 ms (系统调用) |

### 10.3 磁盘占用

| 类型 | 最大占用 |
|------|---------|
| 单个崩溃日志 | 10 MB |
| 总日志目录 | 100 MB |
| 保留时间 | 7 天 |

---

## 11. 安全审查清单

- ✅ 日志文件权限设置正确 (仅当前用户可读写)
- ✅ 敏感数据脱敏 (Token, Password 等)
- ✅ 日志注入防护 (转义换行符)
- ✅ 磁盘占用限制 (防止 DoS)
- ✅ 错误处理降级不会崩溃
- ✅ 不记录用户输入内容 (仅记录错误堆栈)

---

## 12. 未来扩展

### 12.1 Phase 2 功能 (可选)

- **Breadcrumb 机制**: 记录崩溃前的操作路径 (需要状态管理集成)
- **符号化堆栈**: 集成 `addr2line` 工具解析 Rust 堆栈
- **日志上传**: 可选的远程上传功能 (用户同意后)
- **日志可视化**: 应用内 Log Viewer UI

### 12.2 技术债务

- **Windows 文件锁问题**: 当前跳过被锁定文件, 未来可使用重试机制
- **日志格式标准化**: 当前使用自定义格式, 可考虑 JSON 格式便于解析
- **性能监控集成**: 当前仅记录崩溃, 未来可扩展到性能指标

---

## 13. 验收标准映射

| 需求 ID | 验收标准 | 实现方案 |
|---------|---------|---------|
| 需求1 | Rust panic 拦截 + 日志写入 | `std::panic::set_hook` + 文件写入 |
| 需求1 | 日志包含堆栈/文件/行号 | `PanicInfo` + `Backtrace::capture()` |
| 需求1 | 目录不存在时自动创建 | `fs::create_dir_all` + 降级到 temp_dir |
| 需求2 | JS 全局错误捕获 | `window.onerror` + `unhandledrejection` |
| 需求2 | 日志包含错误消息/堆栈 | `log_js_error` 命令 + 格式化 |
| 需求2 | React 组件错误捕获 | `ErrorBoundary` 组件 |
| 需求3 | 系统信息收集 | `sysinfo` crate |
| 需求3 | 获取失败时降级 | 仅记录 App 版本 |
| 需求4 | 按时间轮转 (7 天) | `cleanup_old_logs()` |
| 需求4 | 按大小轮转 (10MB/100MB) | `cleanup_oversized_logs()` |
| 需求5 | 打开日志文件夹 | `tauri-plugin-opener` + 设置页按钮 |

---

## 14. 依赖关系图

```
crash_logger (新增)
    ├─ std::panic          [标准库]
    ├─ std::fs             [标准库]
    ├─ sysinfo             [已存在]
    ├─ tracing             [已存在]
    └─ modules::logger::get_log_dir()  [复用]

commands::logging (新增)
    ├─ crash_logger        [新增]
    ├─ tauri-plugin-opener [已存在]
    └─ tauri::command      [已存在]

Frontend
    ├─ @tauri-apps/api     [已存在]
    └─ React               [已存在]
```

---

## 15. 里程碑检查点

| 阶段 | 交付物 | 验收标准 |
|------|--------|---------|
| M1: Rust 核心 | crash_logger.rs + panic hook | 单元测试通过, panic 能写入文件 |
| M2: 日志轮转 | rotation.rs | 轮转测试通过, 文件正确清理 |
| M3: Tauri 命令 | commands/logging.rs | JS 错误能记录到文件 |
| M4: Frontend 集成 | errorLogger.ts + ErrorBoundary | 全局错误被捕获, IPC 调用成功 |
| M5: UI 集成 | Settings.tsx | 设置页能打开日志目录 |
| M6: 集成测试 | 所有测试用例通过 | 功能验收清单 100% 通过 |

---

**下一步**: 基于此设计生成任务拆分 (crash-logging-tasks.md)
