# 需求文档: Web Admin 代理配置页面复刻

> **生成方式**: 由 /dev:clarify 自动生成
> **生成时间**: 2026-01-12
> **访谈轮次**: 第 3 轮
> **细节级别**: standard
> **可直接用于**: /dev:spec-dev web-admin-proxy --skip-requirements

## 1. 介绍

在 Web Admin 管理端完整复刻桌面应用的 API 代理配置页面（`src/pages/ApiProxy.tsx`），实现像素级 UI 一致性和功能完整性。当前 Web Admin 的 ProxyPage 只有基础的启动/停止功能（171 行代码），而桌面端的 ApiProxy 页面包含完整的配置管理功能（1592 行代码）。

**目标用户**:
- 主要用户：通过浏览器访问 Web Admin 的管理员用户
- 次要用户：无法使用桌面应用的用户（如 Docker/服务器部署场景）

**核心价值**:
- 解决 Web Admin 功能不完整的问题，使用户能够通过浏览器完成所有代理配置任务
- 提供与桌面端一致的用户体验，降低学习成本
- 支持远程管理和多人协作场景

## 2. 需求与用户故事

### 需求 1: 代理服务控制

**用户故事:** As a 管理员, I want 通过 Web 界面启动/停止代理服务, so that 我可以在没有桌面应用的环境中管理代理服务。

#### 验收标准（可测试）

- **WHEN** 用户访问代理配置页面, **THEN** 系统 **SHALL** 显示当前代理服务的运行状态（运行中/已停止）。
- **WHEN** 用户点击"启动代理"按钮, **THEN** 系统 **SHALL** 调用 Web Admin API 启动代理服务，并在启动成功后更新页面状态。
- **WHEN** 代理服务启动成功, **THEN** 系统 **SHALL** 显示端口号、Base URL、活跃账号数等运行信息。
- **WHEN** 用户点击"停止代理"按钮, **THEN** 系统 **SHALL** 调用 API 停止服务，并清空运行信息显示。
- **IF** 代理服务启动失败（如端口被占用）, **THEN** 系统 **SHALL** 显示错误提示信息。

### 需求 2: 端口和绑定地址配置

**用户故事:** As a 管理员, I want 自定义代理服务的端口和绑定地址, so that 我可以避免端口冲突并控制访问来源。

#### 验收标准（可测试）

- **WHEN** 用户在端口输入框中输入端口号（如 8045）, **THEN** 系统 **SHALL** 验证端口号范围（1024-65535）。
- **WHEN** 用户修改绑定地址（127.0.0.1 或 0.0.0.0）, **THEN** 系统 **SHALL** 更新配置并显示对应的访问提示。
- **WHEN** 用户保存配置, **THEN** 系统 **SHALL** 调用 API 更新代理配置，并在代理运行时提示需要重启生效。
- **IF** 端口号非法（如 abc 或 99999）, **THEN** 系统 **SHALL** 显示验证错误，不允许保存。

### 需求 3: 模型映射配置

**用户故事:** As a 管理员, I want 配置模型名称到上游提供商的映射规则, so that 我可以将客户端请求的模型名称转换为实际支持的模型。

#### 验收标准（可测试）

- **WHEN** 用户点击"添加映射"按钮, **THEN** 系统 **SHALL** 显示模型映射编辑对话框。
- **WHEN** 用户选择源模型名称（如 claude-3-5-sonnet）和目标提供商（Claude/Gemini/OpenAI）, **THEN** 系统 **SHALL** 显示该提供商支持的模型列表。
- **WHEN** 用户配置映射别名（如 claude → claude-3-5-sonnet）, **THEN** 系统 **SHALL** 将别名添加到映射规则中。
- **WHEN** 用户保存映射规则, **THEN** 系统 **SHALL** 调用 API 更新配置，并在映射列表中显示新规则。
- **WHEN** 用户删除映射规则, **THEN** 系统 **SHALL** 显示确认对话框，确认后删除规则。
- **IF** 映射配置冲突（如同一源模型映射到多个目标）, **THEN** 系统 **SHALL** 显示警告提示。

### 需求 4: 回退链配置

**用户故事:** As a 管理员, I want 为每个模型配置回退链, so that 当主模型不可用时自动切换到备用模型。

#### 验收标准（可测试）

- **WHEN** 用户在模型映射中点击"配置回退链", **THEN** 系统 **SHALL** 显示回退链编辑界面。
- **WHEN** 用户添加回退模型（如 claude-3-5-sonnet → claude-3-opus → gemini-1.5-pro）, **THEN** 系统 **SHALL** 按优先级顺序显示回退模型列表。
- **WHEN** 用户调整回退顺序（拖拽或上下移动）, **THEN** 系统 **SHALL** 更新优先级顺序。
- **WHEN** 用户保存回退链, **THEN** 系统 **SHALL** 验证回退链无循环依赖，并调用 API 保存。
- **IF** 回退链存在循环依赖（A→B→A）, **THEN** 系统 **SHALL** 显示错误提示，不允许保存。

### 需求 5: 粘性会话配置

**用户故事:** As a 管理员, I want 启用粘性会话功能, so that 同一个对话会话始终使用同一个 Claude 账号，避免上下文丢失。

#### 验收标准（可测试）

- **WHEN** 用户启用粘性会话开关, **THEN** 系统 **SHALL** 显示粘性会话配置选项（TTL、清理策略）。
- **WHEN** 用户设置 TTL（如 3600 秒）, **THEN** 系统 **SHALL** 验证 TTL 范围（60-86400 秒）。
- **WHEN** 用户选择清理策略（定时清理/内存阈值清理）, **THEN** 系统 **SHALL** 显示对应的参数配置项。
- **WHEN** 用户保存配置, **THEN** 系统 **SHALL** 调用 API 更新粘性会话配置。
- **WHEN** 粘性会话启用后, **THEN** 系统 **SHALL** 显示活跃会话统计信息（会话数、内存占用）。

### 需求 6: Token 管理器配置

**用户故事:** As a 管理员, I want 配置 Token 使用策略, so that 我可以控制 Token 的消耗速度和成本。

#### 验收标准（可测试）

- **WHEN** 用户启用 Token 管理器, **THEN** 系统 **SHALL** 显示 Token 限制配置选项。
- **WHEN** 用户设置每日 Token 限额（如 1000000）, **THEN** 系统 **SHALL** 验证限额范围（≥ 1000）。
- **WHEN** 用户设置单次请求最大 Token 数, **THEN** 系统 **SHALL** 验证范围（100-200000）。
- **WHEN** Token 使用量接近限额, **THEN** 系统 **SHALL** 显示警告提示。
- **WHEN** 用户保存配置, **THEN** 系统 **SHALL** 调用 API 更新 Token 管理配置。

### 需求 7: 高级设置配置

**用户故事:** As a 管理员, I want 配置请求超时、上游代理、实验性功能等高级参数, so that 我可以优化代理服务的性能和功能。

#### 验收标准（可测试）

- **WHEN** 用户展开高级设置面板, **THEN** 系统 **SHALL** 显示所有高级配置选项（超时时间、日志开关、自动启动、上游代理、ZAI 集成、实验性功能）。
- **WHEN** 用户修改请求超时时间（如 300 秒）, **THEN** 系统 **SHALL** 验证范围（10-600 秒）。
- **WHEN** 用户启用上游代理, **THEN** 系统 **SHALL** 显示代理 URL 输入框，并验证 URL 格式。
- **WHEN** 用户启用 ZAI 集成, **THEN** 系统 **SHALL** 显示 ZAI 配置项（Base URL、API Key、调度模式）。
- **WHEN** 用户启用实验性功能（如 thinking tokens）, **THEN** 系统 **SHALL** 显示功能说明和警告提示。
- **WHEN** 用户保存高级设置, **THEN** 系统 **SHALL** 调用 API 更新所有配置项。

### 需求 8: 实时状态显示

**用户故事:** As a 管理员, I want 查看代理服务的实时运行状态, so that 我可以监控服务健康状况和当前配置。

#### 验收标准（可测试）

- **WHEN** 代理服务运行中, **THEN** 系统 **SHALL** 显示绿色状态指示器和"运行中"标签。
- **WHEN** 代理服务停止时, **THEN** 系统 **SHALL** 显示灰色状态指示器和"已停止"标签。
- **WHEN** 代理服务启动中或停止中, **THEN** 系统 **SHALL** 显示加载动画和过渡状态。
- **WHEN** 代理服务运行中, **THEN** 系统 **SHALL** 实时显示：端口号、Base URL、活跃账号数、活跃会话数（如启用粘性会话）。
- **WHEN** 用户点击刷新按钮, **THEN** 系统 **SHALL** 调用 API 获取最新状态并更新显示。
- **IF** 使用 WebSocket 连接, **THEN** 系统 **SHALL** 自动接收状态更新推送，无需手动刷新。

### 需求 9: 配置导入/导出

**用户故事:** As a 管理员, I want 导出当前配置并在其他环境导入, so that 我可以快速复制配置到多个实例。

#### 验收标准（可测试）

- **WHEN** 用户点击"导出配置"按钮, **THEN** 系统 **SHALL** 生成 JSON 格式的配置文件并触发浏览器下载。
- **WHEN** 用户点击"导入配置"按钮, **THEN** 系统 **SHALL** 显示文件选择对话框。
- **WHEN** 用户选择配置文件上传, **THEN** 系统 **SHALL** 验证 JSON 格式和配置结构合法性。
- **IF** 配置文件格式错误, **THEN** 系统 **SHALL** 显示错误提示，不允许导入。
- **WHEN** 配置导入成功, **THEN** 系统 **SHALL** 更新页面显示，并提示需要重启代理服务生效。

### 需求 10: 快捷操作

**用户故事:** As a 管理员, I want 快速复制代理 URL、重启代理服务, so that 我可以提高操作效率。

#### 验收标准（可测试）

- **WHEN** 用户点击代理 URL 旁的复制按钮, **THEN** 系统 **SHALL** 复制 URL 到剪贴板，并显示"已复制"提示。
- **WHEN** 用户点击"重启代理"按钮, **THEN** 系统 **SHALL** 先停止代理服务，然后用最新配置重新启动。
- **WHEN** 用户修改配置后未重启, **THEN** 系统 **SHALL** 显示"配置已更改，需要重启生效"的提示条。
- **WHEN** 用户点击"应用更改"按钮, **THEN** 系统 **SHALL** 自动重启代理服务以应用新配置。

## 3. 测试映射表

| 验收条目 | 测试层级 | 预期测试文件 | 预期函数/用例 |
|----------|----------|--------------|---------------|
| 需求1: 显示代理运行状态 | unit | src/admin/pages/ProxyConfigPage.test.tsx | test_should_display_proxy_status |
| 需求1: 启动代理服务 | integration | tests/api/proxy.test.ts | test_start_proxy_integration |
| 需求1: 停止代理服务 | integration | tests/api/proxy.test.ts | test_stop_proxy_integration |
| 需求2: 端口号验证 | unit | src/admin/components/ProxyConfig/PortInput.test.tsx | test_should_validate_port_number |
| 需求2: 保存端口配置 | integration | tests/api/proxy_config.test.ts | test_save_port_config_integration |
| 需求3: 添加模型映射 | unit | src/admin/components/ProxyConfig/ModelMapping.test.tsx | test_should_add_model_mapping |
| 需求3: 删除模型映射 | unit | src/admin/components/ProxyConfig/ModelMapping.test.tsx | test_should_delete_model_mapping |
| 需求4: 配置回退链 | unit | src/admin/components/ProxyConfig/FallbackChain.test.tsx | test_should_configure_fallback_chain |
| 需求4: 检测循环依赖 | unit | src/admin/components/ProxyConfig/FallbackChain.test.tsx | test_should_detect_circular_dependency |
| 需求5: 启用粘性会话 | unit | src/admin/components/ProxyConfig/StickySession.test.tsx | test_should_enable_sticky_session |
| 需求5: 设置 TTL | unit | src/admin/components/ProxyConfig/StickySession.test.tsx | test_should_set_ttl |
| 需求6: 配置 Token 限额 | unit | src/admin/components/ProxyConfig/TokenManager.test.tsx | test_should_configure_token_limit |
| 需求7: 配置上游代理 | unit | src/admin/components/ProxyConfig/AdvancedSettings.test.tsx | test_should_configure_upstream_proxy |
| 需求7: 启用实验性功能 | unit | src/admin/components/ProxyConfig/AdvancedSettings.test.tsx | test_should_enable_experimental_features |
| 需求8: 实时状态更新 | integration | tests/websocket/proxy_status.test.ts | test_realtime_status_update |
| 需求9: 导出配置 | unit | src/admin/components/ProxyConfig/ConfigImportExport.test.tsx | test_should_export_config |
| 需求9: 导入配置验证 | unit | src/admin/components/ProxyConfig/ConfigImportExport.test.tsx | test_should_validate_imported_config |
| 需求10: 复制代理 URL | unit | src/admin/components/ProxyConfig/QuickActions.test.tsx | test_should_copy_proxy_url |
| 需求10: 重启代理服务 | integration | tests/api/proxy.test.ts | test_restart_proxy_integration |

## 4. 功能验收清单

> 从用户视角列出可感知的功能点，用于防止遗漏边缘场景。
> **规则**：实施阶段只能将 ☐ 改为 ✅，不得删除或修改功能描述。

| ID | 功能点 | 验收步骤 | 优先级 | 关联任务 | 通过 |
|----|--------|----------|--------|----------|------|
| F-001 | 代理服务启动 | 1. 点击"启动代理"按钮 2. 服务启动成功，显示运行信息 | P0 | 待分配 | ☐ |
| F-002 | 代理服务停止 | 1. 点击"停止代理"按钮 2. 服务停止，清空运行信息 | P0 | 待分配 | ☐ |
| F-003 | 端口号配置 | 1. 修改端口号输入框 2. 保存配置成功 | P0 | 待分配 | ☐ |
| F-004 | 绑定地址配置 | 1. 切换绑定地址选项 2. 显示对应访问提示 | P0 | 待分配 | ☐ |
| F-005 | 添加模型映射 | 1. 点击"添加映射" 2. 填写源模型、目标提供商 3. 保存成功 | P0 | 待分配 | ☐ |
| F-006 | 编辑模型映射 | 1. 点击映射规则的编辑按钮 2. 修改配置 3. 保存成功 | P0 | 待分配 | ☐ |
| F-007 | 删除模型映射 | 1. 点击映射规则的删除按钮 2. 确认删除 3. 规则从列表移除 | P0 | 待分配 | ☐ |
| F-008 | 配置回退链 | 1. 点击"配置回退链" 2. 添加回退模型 3. 保存成功 | P1 | 待分配 | ☐ |
| F-009 | 调整回退顺序 | 1. 拖拽回退模型调整顺序 2. 保存后顺序正确 | P1 | 待分配 | ☐ |
| F-010 | 启用粘性会话 | 1. 打开粘性会话开关 2. 显示配置选项 3. 保存成功 | P0 | 待分配 | ☐ |
| F-011 | 设置 TTL | 1. 修改 TTL 输入框 2. 验证范围 3. 保存成功 | P1 | 待分配 | ☐ |
| F-012 | 查看活跃会话 | 1. 粘性会话启用后 2. 显示会话数和内存占用 | P1 | 待分配 | ☐ |
| F-013 | 配置 Token 限额 | 1. 启用 Token 管理器 2. 设置每日限额 3. 保存成功 | P1 | 待分配 | ☐ |
| F-014 | Token 用量警告 | 1. Token 使用接近限额 2. 显示警告提示 | P2 | 待分配 | ☐ |
| F-015 | 修改请求超时 | 1. 修改超时时间输入框 2. 验证范围 3. 保存成功 | P1 | 待分配 | ☐ |
| F-016 | 启用日志记录 | 1. 打开日志开关 2. 保存后代理记录请求日志 | P1 | 待分配 | ☐ |
| F-017 | 配置上游代理 | 1. 启用上游代理 2. 填写代理 URL 3. 保存成功 | P1 | 待分配 | ☐ |
| F-018 | 配置 ZAI 集成 | 1. 启用 ZAI 2. 填写 Base URL、API Key 3. 保存成功 | P1 | 待分配 | ☐ |
| F-019 | 启用实验性功能 | 1. 打开实验性功能开关 2. 显示警告提示 3. 保存成功 | P2 | 待分配 | ☐ |
| F-020 | 实时状态显示 | 1. 代理运行时 2. 显示端口、URL、活跃账号数 | P0 | 待分配 | ☐ |
| F-021 | 状态自动刷新 | 1. 通过 WebSocket 接收状态更新 2. 页面自动刷新显示 | P1 | 待分配 | ☐ |
| F-022 | 手动刷新状态 | 1. 点击刷新按钮 2. 获取最新状态并更新 | P0 | 待分配 | ☐ |
| F-023 | 导出配置文件 | 1. 点击"导出配置" 2. 下载 JSON 配置文件 | P1 | 待分配 | ☐ |
| F-024 | 导入配置文件 | 1. 点击"导入配置" 2. 选择 JSON 文件 3. 验证通过后导入 | P1 | 待分配 | ☐ |
| F-025 | 复制代理 URL | 1. 点击 URL 旁的复制按钮 2. 显示"已复制"提示 | P0 | 待分配 | ☐ |
| F-026 | 重启代理服务 | 1. 点击"重启代理" 2. 服务先停止后启动 | P1 | 待分配 | ☐ |
| F-027 | 配置更改提示 | 1. 修改配置但未重启 2. 显示"需要重启生效"提示条 | P1 | 待分配 | ☐ |
| F-028 | 边缘场景：端口被占用 | 1. 启动代理时端口已被占用 2. 显示错误提示 | P0 | 待分配 | ☐ |
| F-029 | 边缘场景：无可用账号 | 1. 无活跃账号时启动代理 2. 显示警告提示 | P0 | 待分配 | ☐ |
| F-030 | 边缘场景：配置格式错误 | 1. 导入格式错误的配置文件 2. 显示验证错误 | P1 | 待分配 | ☐ |

## 5. 技术约束与要求

### 5.1 技术栈
- **前端语言/框架**: React 18 + TypeScript
- **状态管理**: Zustand（与 Web Admin 现有方案一致）
- **UI 组件库**:
  - lucide-react（图标，与桌面端一致）
  - DaisyUI（样式组件，与 Web Admin 一致）
  - Tailwind CSS（样式框架）
- **HTTP 客户端**: Axios（与 Web Admin 一致）
- **实时通信**: WebSocket（复用现有连接）

### 5.2 集成点

#### 前端集成
- **桌面端组件复用**: 从 `src/pages/ApiProxy.tsx` 复用以下组件：
  - `CollapsibleCard`（可折叠卡片）
  - `ModelMappingEditor`（模型映射编辑器）
  - `FallbackChainEditor`（回退链编辑器）
  - `StickySessionConfig`（粘性会话配置）
  - 其他 UI 组件（需适配 Web Admin 的数据层）

- **数据层抽象**: 创建适配层，将桌面端的 `invoke()` Tauri API 调用转换为 Web Admin 的 HTTP API 调用

#### 后端 API（需新增）
- **代理控制 API**:
  - `POST /api/v1/proxy/start` - 启动代理服务
  - `POST /api/v1/proxy/stop` - 停止代理服务
  - `POST /api/v1/proxy/restart` - 重启代理服务
  - `GET /api/v1/proxy/status` - 获取代理状态

- **配置管理 API**:
  - `GET /api/v1/proxy/config` - 获取当前配置
  - `PUT /api/v1/proxy/config` - 更新配置（全量更新）
  - `PATCH /api/v1/proxy/config` - 部分更新配置
  - `POST /api/v1/proxy/config/export` - 导出配置文件
  - `POST /api/v1/proxy/config/import` - 导入配置文件

- **WebSocket 推送**:
  - 复用现有 `/api/v1/ws` 连接
  - 新增消息类型: `proxy_status_update`（代理状态变更）

### 5.3 数据存储
- **配置存储**:
  - 后端：使用现有的 SQLite 数据库存储代理配置
  - 表结构：复用桌面端的 `AppConfig` 和 `ProxyConfig` 数据模型
- **会话存储**:
  - 粘性会话数据存储在内存中（Rust 端 DashMap）
  - 通过 API 暴露会话统计信息

### 5.4 性能要求
- **页面加载**: 初始加载时间 < 2 秒
- **状态刷新**: 手动刷新响应时间 < 500ms
- **配置保存**: 保存配置响应时间 < 1 秒
- **实时更新**: WebSocket 状态推送延迟 < 100ms

### 5.5 安全要求
- **认证**:
  - 所有 API 请求必须携带有效的 JWT token
  - 复用 Web Admin 现有的认证中间件
- **授权**:
  - 仅管理员用户可访问代理配置页面
  - 配置更改需要管理员权限
- **数据保护**:
  - 敏感配置（如 ZAI API Key）需加密存储
  - 导出配置时提示包含敏感信息

### 5.6 UI/UX 要求
- **像素级复刻**: UI 布局、组件样式、交互逻辑与桌面端 `ApiProxy.tsx` 保持一致
- **响应式设计**: 支持桌面端（≥1024px）和平板端（768px-1023px）浏览
- **主题适配**: 适配 Web Admin 的深色主题（灰色/绿色配色方案）
- **加载状态**: 所有异步操作显示加载动画
- **错误提示**: 所有错误使用 Toast 提示，与 Web Admin 一致

## 6. 排除项（明确不做）

- **桌面端特有功能**：
  - 托盘菜单集成（Web 环境无托盘）
  - 桌面通知（Web Admin 不使用浏览器通知 API）
  - 全局快捷键（Web 环境不支持）
  - 深度链接（Deep Link）

- **离线功能**：
  - 不做 PWA 或 Service Worker 缓存（首个版本）
  - 不做离线配置编辑

- **协同编辑**：
  - 不做多用户同时编辑冲突检测
  - 不做实时协同编辑（如 Operational Transformation）
  - 配置更新以最后保存为准

- **历史版本管理**：
  - 不做配置变更历史记录（首个版本）
  - 不做配置回滚功能

## 7. 风险与挑战

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Web Admin API 缺失 | 高 | 前期完成 API 设计评审，确保覆盖所有配置项；分阶段实施，先实现核心 API |
| 组件复用困难 | 中 | 抽象数据层接口（Tauri API → HTTP API）；UI 组件尽量保持样式和结构一致 |
| 实时状态同步 | 中 | 复用现有 WebSocket 连接，添加代理状态推送消息类型；提供手动刷新兜底 |
| 桌面端代码变更 | 低 | 建立组件共享机制（monorepo 或 npm package）；定期同步桌面端更新 |
| 配置兼容性 | 中 | 确保前后端配置模型一致；添加配置版本号，支持迁移 |
| 性能问题（大量映射规则） | 低 | 配置列表分页显示；虚拟滚动技术（如需要） |

## 8. 相关文档

- **简报版本**: docs/dev/web-admin-proxy/web-admin-proxy-brief.md
- **访谈记录**: 由 /dev:clarify 生成于 2026-01-12
- **桌面端源码**: src/pages/ApiProxy.tsx（1592 行，完整功能参考）
- **Web Admin 现有页面**: src/admin/pages/ProxyPage.tsx（171 行，基础版本）

## 9. 下一步行动

### 方式1：使用 spec-dev 继续（推荐）

在新会话中执行：
```bash
/dev:spec-dev web-admin-proxy --skip-requirements
```

这将：
1. ✅ 跳过阶段1（requirements 已完成）
2. 🎯 直接进入阶段2（技术设计）
   - 设计前端组件架构（复用 vs 新建）
   - 设计后端 API 接口规范
   - 设计 WebSocket 消息格式
3. 📋 然后阶段3（任务拆分）
   - 拆分前端开发任务（按功能模块）
   - 拆分后端 API 开发任务
   - 拆分测试任务
4. 💻 最后 TDD 实施（分阶段开发）
   - Phase 1: 代理控制 + 基本配置
   - Phase 2: 模型映射 + 回退链
   - Phase 3: 高级功能（粘性会话、Token 管理等）

### 方式2：手动进行设计

如果你想自己设计技术方案，可以：
1. 基于本 requirements 编写 design.md
2. 然后执行 `/dev:spec-dev web-admin-proxy --stage 3` 进行任务拆分

### 分阶段实施建议

**Phase 1 (MVP - 核心功能):**
- 代理服务启动/停止控制
- 端口和绑定地址配置
- 基本模型映射配置（添加、编辑、删除）
- 实时状态显示
- 快捷操作（复制 URL、重启）

**Phase 2 (完整功能):**
- 回退链配置
- 粘性会话配置
- 高级设置（超时、日志、自动启动）
- 配置导入/导出

**Phase 3 (高级功能):**
- Token 管理器
- 上游代理配置
- ZAI 集成配置
- 实验性功能开关
