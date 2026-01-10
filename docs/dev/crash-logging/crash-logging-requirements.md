# 需求文档: Crash Logging

> **生成方式**: 由 /dev:clarify 自动生成
> **生成时间**: 2026-01-10
> **访谈轮次**: 第 2 轮
> **细节级别**: standard
> **可直接用于**: /dev:spec-dev crash-logging --skip-requirements

## 1. 介绍

为 Tauri 桌面应用(Antigravity-Manager)添加本地崩溃日志和异常监控机制,解决生产环境中"静默闪退"问题无法追溯的痛点。

**目标用户**:
- 主要用户:开发者(需要完整的崩溃堆栈和上下文信息)
- 次要用户:高级用户(需要提供日志文件协助排查问题)

**核心价值**:
1. 捕获 Rust 端 panic 和 JavaScript 端未处理异常
2. 持久化完整的错误堆栈和系统上下文
3. 自动轮转清理,防止磁盘占用失控
4. 为问题复现和修复提供可靠的数据依据

## 2. 需求与用户故事

### 需求 1: Rust 端 Panic 捕获
**用户故事:** As a 开发者, I want 应用在 Rust 代码 panic 时记录完整堆栈, so that 我能定位 Tauri 后端的崩溃根因。

#### 验收标准(可测试)
- **WHEN** Rust 代码触发 `panic!()`, **THEN** 系统 **SHALL** 拦截 panic 并将堆栈信息写入日志文件。
- **WHEN** panic hook 执行, **THEN** 日志 **SHALL** 包含:panic 消息、文件名、行号、时间戳。
- **IF** 日志目录不存在, **THEN** 系统 **SHALL** 自动创建该目录,失败时降级到临时目录。

### 需求 2: JavaScript 端全局错误捕获
**用户故事:** As a 开发者, I want 捕获前端 React 组件的未处理错误, so that 我能发现 UI 层的崩溃问题。

#### 验收标准(可测试)
- **WHEN** 触发 `window.onerror` 或 `unhandledrejection`, **THEN** 系统 **SHALL** 调用 Tauri Command 写入日志。
- **WHEN** 记录 JS 错误, **THEN** 日志 **SHALL** 包含:错误消息、堆栈、URL、行号、时间戳。
- **WHEN** 网络请求失败或组件渲染错误, **THEN** 系统 **SHALL** 捕获并记录(使用 React Error Boundary)。

### 需求 3: 系统信息收集
**用户故事:** As a 开发者, I want 每次崩溃时记录系统环境信息, so that 我能识别环境相关的 bug(如特定 Windows 版本)。

#### 验收标准(可测试)
- **WHEN** 写入崩溃日志, **THEN** 系统 **SHALL** 附加:OS 名称和版本、应用版本号、内存使用量、CPU 架构。
- **IF** 使用 `sysinfo` crate 获取系统信息失败, **THEN** 系统 **SHALL** 使用降级方案(仅记录静态信息)。

### 需求 4: 日志文件轮转
**用户故事:** As a 用户, I want 日志文件自动清理, so that 应用不会无限占用我的磁盘空间。

#### 验收标准(可测试)
- **WHEN** 应用启动, **THEN** 系统 **SHALL** 检查日志目录,删除超过 7 天的日志文件。
- **IF** 单个日志文件超过 10MB, **THEN** 系统 **SHALL** 创建新日志文件(命名格式:`crash-YYYYMMDD-HHMMSS.log`)。
- **WHEN** 日志总大小超过 100MB, **THEN** 系统 **SHALL** 删除最旧的文件直到总大小低于限制。

### 需求 5: 本地日志查看入口
**用户故事:** As a 用户, I want 在应用设置中一键打开日志文件夹, so that 我能快速找到日志提供给技术支持。

#### 验收标准(可测试)
- **WHEN** 用户点击"打开日志文件夹"按钮, **THEN** 系统 **SHALL** 使用 `tauri-plugin-opener` 打开日志目录。
- **IF** 日志目录不存在, **THEN** 系统 **SHALL** 先创建目录再打开。

## 3. 测试映射表

| 验收条目 | 测试层级 | 预期测试文件 | 预期函数/用例 |
|----------|----------|--------------|---------------|
| 需求1: Rust panic 拦截 | unit | src-tauri/src/logging/tests.rs | test_panic_hook_writes_log |
| 需求1: 日志目录创建 | unit | src-tauri/src/logging/tests.rs | test_create_log_dir_fallback |
| 需求2: JS window.onerror | integration | src/__tests__/crash-logging.test.ts | test_js_error_logged_to_file |
| 需求2: React Error Boundary | integration | src/__tests__/error-boundary.test.tsx | test_component_error_captured |
| 需求3: 系统信息收集 | unit | src-tauri/src/logging/tests.rs | test_system_info_collected |
| 需求4: 日志轮转(时间) | unit | src-tauri/src/logging/tests.rs | test_rotate_logs_older_than_7days |
| 需求4: 日志轮转(大小) | unit | src-tauri/src/logging/tests.rs | test_rotate_logs_exceeds_size_limit |
| 需求5: 打开日志目录 | integration | src/__tests__/settings.test.ts | test_open_logs_folder |

## 4. 功能验收清单

> 从用户视角列出可感知的功能点,用于防止遗漏边缘场景。
> **规则**:实施阶段只能将 ☐ 改为 ✅,不得删除或修改功能描述。

| ID | 功能点 | 验收步骤 | 优先级 | 关联任务 | 通过 |
|----|--------|----------|--------|----------|------|
| F-001 | Rust panic 自动记录 | 1. 触发 Rust panic 2. 检查日志文件存在且包含堆栈 | P0 | T-001 | ✅ |
| F-002 | JS 全局错误捕获 | 1. 触发 JS 错误 2. 验证日志包含错误消息和堆栈 | P0 | T-004 | ✅ |
| F-003 | React 组件错误捕获 | 1. 组件渲染错误 2. Error Boundary 显示 UI 3. 日志已记录 | P0 | T-004 | ✅ |
| F-004 | 系统信息附加 | 1. 触发崩溃 2. 日志包含 OS/版本/内存信息 | P1 | T-001 | ✅ |
| F-005 | 日志按时间轮转 | 1. 创建 8 天前的日志文件 2. 重启应用 3. 旧日志被删除 | P0 | T-002 | ✅ |
| F-006 | 日志按大小轮转 | 1. 写入超过 10MB 数据 2. 检查是否创建新文件 | P0 | T-002 | ✅ |
| F-007 | 日志总大小限制 | 1. 生成 110MB 日志 2. 检查总大小被控制在 100MB 内 | P1 | T-002 | ✅ |
| F-008 | 设置页"打开日志" | 1. 进入设置页 2. 点击按钮 3. 系统文件管理器打开日志目录 | P1 | T-005 | ✅ |
| F-009 | 边缘:日志目录无权限 | 1. 模拟无写权限 2. 系统降级到临时目录 | P2 | T-001 | ✅ |
| F-010 | 边缘:日志目录不存在 | 1. 删除日志目录 2. 触发日志写入 3. 自动创建目录 | P2 | T-001 | ✅ |
| F-011 | 边缘:sysinfo 获取失败 | 1. 模拟 sysinfo 错误 2. 日志仍写入(仅缺系统信息) | P2 | T-001 | ✅ |

## 5. 技术约束与要求

### 5.1 技术栈
- **语言/框架**: Tauri 2.x, Rust (edition 2021), React 19.1.0, TypeScript 5.8.3
- **依赖库**:
  - Rust: `tracing`, `tracing-subscriber`, `tracing-appender`(已存在), `sysinfo`(已存在), `thiserror`
  - JS: 无需新增依赖(使用原生 API)

### 5.2 集成点
- **Tauri Command**: 创建 `log_js_error(message: String, stack: String)` 供前端调用
- **内部模块**:
  - 集成现有 `tracing-subscriber` 配置(避免冲突)
  - 复用 `dirs` crate 获取标准日志路径

### 5.3 数据存储
- **日志路径**:
  - Windows: `%APPDATA%/antigravity-tools/logs/`
  - macOS: `~/Library/Application Support/antigravity-tools/logs/`
  - Linux: `~/.local/share/antigravity-tools/logs/`
- **文件命名**:
  - 正常日志: `app.log`(当前), `app.log.1`, `app.log.2`(轮转)
  - 崩溃日志: `crash-20260110-143022.log`(时间戳)

### 5.4 性能要求
- **日志写入延迟**: 单次写入不超过 10ms(使用缓冲写入)
- **启动性能**: 日志轮转清理不超过 200ms(异步执行)
- **日志文件大小**: 单文件不超过 10MB,总大小不超过 100MB

### 5.5 安全要求
- **敏感数据保护**:
  - 不记录 API Key, Token, 密码
  - 使用正则表达式脱敏(如 `Authorization: Bearer ***`)
- **文件权限**: 日志文件仅当前用户可读写(Unix 600, Windows DACL)
- **日志注入防护**: 对用户输入进行转义,防止日志伪造

## 6. 排除项(明确不做)

- ❌ **远程日志上传(Sentry/LogRocket)**:用户明确选择本地方案,不集成云服务
- ❌ **日志可视化界面**:仅提供文本日志,不开发 Log Viewer UI
- ❌ **性能分析(Profiling)**:不收集 CPU/内存趋势,仅关注崩溃事件
- ❌ **用户行为追踪(Analytics)**:不记录用户操作路径,仅记录错误上下文
- ❌ **实时监控/告警**:不提供主动通知机制

## 7. 风险与挑战

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Rust panic 中断导致日志丢失 | 高 | 使用同步写入 + `std::io::Write::flush()` 确保立即落盘 |
| Windows 文件锁导致轮转失败 | 中 | 使用 `tracing-appender` 的非阻塞轮转,失败时跳过 |
| 日志写入占用 CPU | 中 | 使用异步写入 + 缓冲区,控制写入频率 |
| 第三方库冲突(tracing 多次初始化) | 低 | 检测已有 subscriber,使用 `try_init()` 而非 `init()` |
| 恶意构造日志导致磁盘填满 | 低 | 严格执行大小限制 + 单次写入不超过 1MB |

## 8. 相关文档

- **简报版本**: docs/dev/crash-logging/crash-logging-brief.md
- **访谈记录**: 由 /dev:clarify 生成于 2026-01-10

## 9. 下一步行动

### 方式1:使用 spec-dev 继续(推荐)

在新会话中执行:
```bash
/dev:spec-dev crash-logging --skip-requirements
```

这将:
1. ✅ 跳过阶段1(requirements 已完成)
2. 🎯 直接进入阶段2(技术设计)
3. 📋 然后阶段3(任务拆分)
4. 💻 最后 TDD 实施

### 方式2:手动进行设计

如果你想自己设计技术方案,可以:
1. 基于本 requirements 编写 design.md
2. 然后执行 `/dev:spec-dev crash-logging --stage 3` 进行任务拆分
