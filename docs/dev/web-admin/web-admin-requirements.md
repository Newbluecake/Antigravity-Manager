# 需求文档: Web 管理后台

> **生成方式**: 由 /dev:clarify 自动生成
> **生成时间**: 2026-01-12
> **访谈轮次**: 第 2 轮
> **细节级别**: standard
> **可直接用于**: /dev:spec-dev web-admin --skip-requirements

## 1. 介绍

为 Antigravity Manager 桌面应用添加独立的 Web 管理后台，支持局域网内通过浏览器访问应用的监控、控制、用户管理和数据管理功能。

**目标用户**:
- 主要用户：需要远程管理 Antigravity Manager 的开发者和高级用户
- 次要用户：局域网内需要快速查看应用状态的用户

**核心价值**: 解决远程管理和监控的问题，无需在每台设备上安装桌面应用，通过浏览器即可管理和监控 Antigravity Manager。

## 2. 需求与用户故事

### 需求 1: Web 服务器基础架构
**用户故事:** As a 系统管理员, I want 应用能够启动独立的 Web 服务器, so that 我可以通过浏览器访问管理后台。

#### 验收标准（可测试）
- **WHEN** 应用启动时, **THEN** 系统 **SHALL** 在配置的端口（默认 8046）上启动独立的 HTTP 服务器。
- **WHEN** Web 服务启用局域网访问时, **THEN** 系统 **SHALL** 监听 `0.0.0.0`，否则 **SHALL** 监听 `127.0.0.1`。
- **WHEN** Web 服务端口被占用时, **THEN** 系统 **SHALL** 记录错误日志并提示用户修改端口配置。
- **WHEN** 应用关闭时, **THEN** 系统 **SHALL** 优雅关闭 Web 服务器，释放所有资源。

### 需求 2: Token 认证机制
**用户故事:** As a 安全管理员, I want Web 访问需要 Token 认证, so that 未授权用户无法访问敏感数据和控制功能。

#### 验收标准（可测试）
- **WHEN** 用户首次访问 Web 管理后台时, **THEN** 系统 **SHALL** 显示登录页面要求输入凭证。
- **WHEN** 用户提供正确的用户名和密码时, **THEN** 系统 **SHALL** 生成 JWT Token 并返回给客户端（有效期 24 小时）。
- **WHEN** 用户访问受保护的 API 端点时, **THEN** 系统 **SHALL** 验证请求中的 JWT Token，Token 无效时 **SHALL** 返回 401 错误。
- **WHEN** Token 过期时, **THEN** 系统 **SHALL** 返回 401 错误并要求用户重新登录。
- **IF** 用户在设置中修改了认证密码, **THEN** 系统 **SHALL** 立即使所有现有 Token 失效。

### 需求 3: 实时监控仪表盘
**用户故事:** As a 应用管理员, I want 在 Web 界面查看应用实时状态, so that 我可以快速了解应用的健康状况和资源使用情况。

#### 验收标准（可测试）
- **WHEN** 用户访问仪表盘页面时, **THEN** 系统 **SHALL** 显示以下实时信息：
  - 代理服务状态（运行中/已停止）
  - 当前活跃账号及其配额百分比
  - 所有账号的平均剩余配额（Gemini Pro/Flash/Claude/Image）
  - 低配额账号数量（<20%）
  - 最近 1 小时的 API 请求统计（总数、成功率、失败率）
- **WHEN** 仪表盘数据更新时（每 5 秒）, **THEN** 系统 **SHALL** 通过 WebSocket 推送最新数据到客户端。
- **WHEN** 代理服务状态变化时, **THEN** 系统 **SHALL** 立即推送状态更新到所有连接的客户端。

### 需求 4: 应用控制功能
**用户故事:** As a 应用管理员, I want 通过 Web 界面控制代理服务, so that 我可以远程启动/停止服务和修改配置。

#### 验收标准（可测试）
- **WHEN** 用户点击"启动代理服务"按钮时, **THEN** 系统 **SHALL** 调用现有的代理启动逻辑，并返回操作结果。
- **WHEN** 用户点击"停止代理服务"按钮时, **THEN** 系统 **SHALL** 调用现有的代理停止逻辑，并返回操作结果。
- **WHEN** 用户修改代理端口配置时, **THEN** 系统 **SHALL** 验证端口号有效性（1024-65535），保存配置并提示需要重启服务。
- **WHEN** 用户修改调度模式时, **THEN** 系统 **SHALL** 保存配置并实时生效（无需重启）。
- **IF** 操作失败（如端口被占用）, **THEN** 系统 **SHALL** 返回明确的错误消息。

### 需求 5: 账号管理功能
**用户故事:** As a 账号管理员, I want 在 Web 界面查看和管理账号, so that 我可以监控账号配额和状态。

#### 验收标准（可测试）
- **WHEN** 用户访问账号列表页面时, **THEN** 系统 **SHALL** 显示所有账号的以下信息：
  - 邮箱（脱敏显示，如 `tee***@gmail.com`）
  - 订阅等级（PRO/ULTRA/FREE）
  - 各模型配额百分比（Gemini Pro/Flash/Claude/Image）
  - 禁用状态（403 禁用/主动禁用/正常）
  - 最后同步时间
- **WHEN** 用户点击账号详情时, **THEN** 系统 **SHALL** 显示完整的账号信息（未脱敏邮箱、配额详情、使用历史）。
- **WHEN** 用户点击"禁用账号"时, **THEN** 系统 **SHALL** 调用现有的禁用逻辑并更新 UI。
- **WHEN** 用户点击"刷新配额"时, **THEN** 系统 **SHALL** 触发配额刷新并显示进度。
- **WHEN** 账号配额低于 20% 时, **THEN** 系统 **SHALL** 在列表中高亮显示（红色徽章）。

### 需求 6: API 监控日志查询
**用户故事:** As a 系统管理员, I want 查看 API 请求日志, so that 我可以监控和调试 API 调用。

#### 验收标准（可测试）
- **WHEN** 用户访问 API 监控页面时, **THEN** 系统 **SHALL** 显示最近的 API 请求记录（默认最近 100 条）。
- **WHEN** 用户应用筛选条件（时间范围、状态码、模型）时, **THEN** 系统 **SHALL** 返回符合条件的记录。
- **WHEN** 用户点击请求详情时, **THEN** 系统 **SHALL** 显示完整的请求/响应 Payload、Header、Token 统计等信息。
- **WHEN** 用户点击分页按钮时, **THEN** 系统 **SHALL** 加载下一页数据。
- **WHEN** 监控数据库记录超过 10000 条时, **THEN** 系统 **SHALL** 自动清理 7 天前的旧记录。

### 需求 7: 响应式 Web UI
**用户故事:** As a 移动用户, I want Web 界面能在手机和平板上正常使用, so that 我可以随时随地管理应用。

#### 验收标准（可测试）
- **WHEN** 用户在移动设备（宽度 < 768px）上访问时, **THEN** UI **SHALL** 切换到移动布局（单列、大按钮、折叠菜单）。
- **WHEN** 用户在平板设备（768px <= 宽度 < 1024px）上访问时, **THEN** UI **SHALL** 使用适配的布局。
- **WHEN** 用户在桌面设备（宽度 >= 1024px）上访问时, **THEN** UI **SHALL** 使用完整的多列布局。
- **WHEN** 用户调整浏览器窗口大小时, **THEN** UI **SHALL** 平滑过渡到对应的响应式布局。

### 需求 8: WebSocket 实时推送
**用户故事:** As a 应用管理员, I want 实时接收状态变化通知, so that 我可以及时了解应用状态而无需手动刷新。

#### 验收标准（可测试）
- **WHEN** 用户访问仪表盘页面时, **THEN** 系统 **SHALL** 建立 WebSocket 连接。
- **WHEN** 代理服务状态变化时, **THEN** 系统 **SHALL** 通过 WebSocket 推送状态更新消息。
- **WHEN** 账号配额刷新完成时, **THEN** 系统 **SHALL** 通过 WebSocket 推送配额更新消息。
- **WHEN** 新的 API 请求完成时, **THEN** 系统 **SHALL** 通过 WebSocket 推送请求记录（仅在 API 监控页面）。
- **WHEN** WebSocket 连接断开时, **THEN** 客户端 **SHALL** 自动尝试重连（最多 5 次，间隔 5 秒）。
- **IF** WebSocket 不可用（如浏览器不支持）, **THEN** 系统 **SHALL** 回退到轮询模式（每 10 秒）。

## 3. 测试映射表

| 验收条目 | 测试层级 | 预期测试文件 | 预期函数/用例 |
|----------|----------|--------------|---------------|
| 需求1: Web 服务器启动 | unit | src-tauri/src/modules/web_admin/tests.rs | test_should_start_web_server |
| 需求1: 端口占用处理 | unit | src-tauri/src/modules/web_admin/tests.rs | test_should_handle_port_conflict |
| 需求2: JWT Token 生成 | unit | src-tauri/src/modules/web_admin/auth.rs | test_should_generate_valid_jwt |
| 需求2: Token 验证 | unit | src-tauri/src/modules/web_admin/auth.rs | test_should_validate_jwt_token |
| 需求2: Token 过期 | unit | src-tauri/src/modules/web_admin/auth.rs | test_should_reject_expired_token |
| 需求3: 仪表盘数据获取 | integration | src-tauri/src/modules/web_admin/tests/integration.rs | test_dashboard_data_integration |
| 需求4: 启动代理服务 | integration | src-tauri/src/modules/web_admin/tests/integration.rs | test_start_proxy_service_integration |
| 需求5: 账号列表查询 | unit | src-tauri/src/modules/web_admin/accounts.rs | test_should_list_accounts_with_masking |
| 需求6: API 日志查询 | unit | src-tauri/src/modules/web_admin/monitor.rs | test_should_query_api_logs_with_filters |
| 需求7: 响应式布局 | e2e | tests/web_admin_ui_test.rs | test_responsive_layout_mobile |
| 需求8: WebSocket 推送 | integration | src-tauri/src/modules/web_admin/tests/integration.rs | test_websocket_realtime_push |

## 4. 功能验收清单

> 从用户视角列出可感知的功能点，用于防止遗漏边缘场景。
> **规则**：实施阶段只能将 ☐ 改为 ✅，不得删除或修改功能描述。

| ID | 功能点 | 验收步骤 | 优先级 | 关联任务 | 通过 |
|----|--------|----------|--------|----------|------|
| F-001 | Web 服务器启动 | 1. 启动应用 2. 访问 http://localhost:8046 3. 预期显示登录页面 | P0 | 待分配 | ☐ |
| F-002 | 局域网访问 | 1. 启用局域网访问 2. 从其他设备访问 http://{IP}:8046 3. 预期正常访问 | P0 | 待分配 | ☐ |
| F-003 | Token 登录 | 1. 输入正确的用户名密码 2. 预期返回 Token 并跳转到仪表盘 | P0 | 待分配 | ☐ |
| F-004 | Token 验证失败 | 1. 使用无效 Token 访问 API 2. 预期返回 401 并跳转到登录页 | P0 | 待分配 | ☐ |
| F-005 | 仪表盘实时数据 | 1. 登录后访问仪表盘 2. 预期显示代理状态、配额概览、请求统计 | P0 | 待分配 | ☐ |
| F-006 | 启动代理服务 | 1. 点击"启动代理"按钮 2. 预期代理服务启动成功并更新状态 | P0 | 待分配 | ☐ |
| F-007 | 停止代理服务 | 1. 点击"停止代理"按钮 2. 预期代理服务停止并更新状态 | P0 | 待分配 | ☐ |
| F-008 | 账号列表查看 | 1. 访问账号页面 2. 预期显示所有账号及其配额信息 | P1 | 待分配 | ☐ |
| F-009 | 账号详情查看 | 1. 点击账号详情 2. 预期显示完整的账号信息和配额历史 | P1 | 待分配 | ☐ |
| F-010 | 账号禁用/启用 | 1. 点击禁用/启用按钮 2. 预期账号状态更新并从代理池移除/添加 | P1 | 待分配 | ☐ |
| F-011 | 配额刷新 | 1. 点击"刷新配额"按钮 2. 预期显示刷新进度并更新配额数据 | P1 | 待分配 | ☐ |
| F-012 | API 监控日志查询 | 1. 访问 API 监控页面 2. 预期显示最近的请求记录 | P1 | 待分配 | ☐ |
| F-013 | API 日志筛选 | 1. 应用时间/状态码/模型筛选 2. 预期显示符合条件的记录 | P1 | 待分配 | ☐ |
| F-014 | API 请求详情 | 1. 点击请求详情 2. 预期显示完整的请求/响应信息 | P1 | 待分配 | ☐ |
| F-015 | 移动端布局 | 1. 在手机浏览器访问 2. 预期显示单列移动布局 | P1 | 待分配 | ☐ |
| F-016 | WebSocket 实时更新 | 1. 打开仪表盘 2. 在桌面应用切换账号 3. 预期 Web 仪表盘实时更新 | P1 | 待分配 | ☐ |
| F-017 | WebSocket 断线重连 | 1. 打开仪表盘 2. 断开网络 3. 恢复网络 4. 预期自动重连并恢复实时更新 | P1 | 待分配 | ☐ |
| F-018 | 边缘场景：端口占用 | 1. 配置已被占用的端口 2. 启动应用 3. 预期显示错误提示 | P1 | 待分配 | ☐ |
| F-019 | 边缘场景：Token 过期 | 1. 等待 Token 过期（或手动设置过期时间） 2. 访问 API 3. 预期返回 401 并要求重新登录 | P1 | 待分配 | ☐ |
| F-020 | 边缘场景：修改密码后 Token 失效 | 1. 登录并获得 Token 2. 修改密码 3. 使用旧 Token 访问 API 4. 预期返回 401 | P1 | 待分配 | ☐ |
| F-021 | 边缘场景：配额刷新失败 | 1. 网络断开 2. 点击"刷新配额" 3. 预期显示错误提示 | P2 | 待分配 | ☐ |
| F-022 | 边缘场景：WebSocket 不支持回退 | 1. 在不支持 WebSocket 的浏览器访问 2. 预期回退到轮询模式 | P2 | 待分配 | ☐ |

**字段说明**：
- **ID**：功能点唯一标识（F-XXX）
- **功能点**：从用户视角描述可感知的功能
- **验收步骤**：可测试的操作步骤和预期结果
- **优先级**：P0（核心功能）/ P1（重要功能）/ P2（一般功能）
- **关联任务**：对应 tasks.md 中的任务ID（T-XXX），由 spec-dev 填充
- **通过**：☐ 未完成 / ✅ 已完成（实施阶段只能更新此字段）

## 5. 技术约束与要求

### 5.1 技术栈
- **语言/框架**:
  - 后端：Rust + Axum (复用现有技术栈)
  - 前端：React + TypeScript (与桌面应用前端保持一致)
  - WebSocket：tokio-tungstenite
  - 认证：jsonwebtoken (JWT)
- **依赖库**:
  - `axum`: Web 框架
  - `tokio`: 异步运行时
  - `jsonwebtoken`: JWT Token 生成和验证
  - `tokio-tungstenite`: WebSocket 支持
  - `tower-http`: CORS 中间件
  - `serde`: 序列化/反序列化

### 5.2 集成点
- **内部模块**:
  - `modules::proxy`: 代理服务控制（启动/停止/配置）
  - `modules::db`: 数据库访问（账号信息、配置）
  - `modules::account`: 账号管理（配额刷新、禁用/启用）
  - `modules::proxy_db`: API 监控日志数据库
  - `modules::config`: 配置管理（读取/保存配置）

### 5.3 数据存储
- **数据库**: SQLite (复用现有的 `state.vscdb` 和 `proxy_monitor.db`)
- **新增表**:
  - `web_admin_tokens`: 存储已颁发的 JWT Token（用于 Token 吊销）
    - `id`: INTEGER PRIMARY KEY
    - `token_hash`: TEXT (SHA256 哈希值)
    - `issued_at`: INTEGER (颁发时间戳)
    - `expires_at`: INTEGER (过期时间戳)
    - `revoked`: INTEGER (是否已吊销，0/1)
  - `web_admin_config`: 存储 Web 管理后台配置
    - `key`: TEXT PRIMARY KEY
    - `value`: TEXT
- **缓存**: 内存缓存（Dashmap）用于存储实时状态数据

### 5.4 性能要求
- **响应时间**: API 响应时间 < 200ms (P95)
- **并发量**: 支持至少 10 个并发 WebSocket 连接
- **数据量**: API 监控日志保留最近 7 天或最多 10000 条记录

### 5.5 安全要求
- **认证**: JWT Token 认证（HS256 算法）
- **授权**: MVP 阶段仅支持单用户，用户名密码存储在配置文件中（加密存储）
- **数据保护**:
  - 账号邮箱脱敏显示（如 `tee***@gmail.com`）
  - Token 使用安全的密钥（至少 32 字节随机生成）
  - HTTPS 支持（可选，通过反向代理实现）

## 6. 排除项（明确不做）

- **公网访问支持**: 仅支持局域网访问，不提供公网穿透、DDNS、云端同步等功能 → 原因：安全风险高，超出 MVP 范围
- **完整的桌面功能复刻**: Web 后台不支持添加账号、修改模型映射等复杂编辑功能 → 原因：复杂度高，桌面应用已提供完整功能
- **多用户权限系统**: MVP 阶段不支持多用户、角色分配、权限管理 → 原因：增加复杂度，单用户场景已满足大部分需求
- **数据双向同步**: Web 后台不支持离线编辑、冲突解决等复杂的数据同步逻辑 → 原因：技术复杂度高，超出 MVP 范围
- **高级数据分析**: 不提供复杂的数据可视化（如趋势图、热力图）→ 原因：超出 MVP 范围，后续迭代可考虑

## 7. 风险与挑战

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 端口冲突 | 中 | 提供配置项允许用户修改端口；启动时检测端口占用并提示 |
| 认证安全性 | 高 | 使用强密码策略；Token 过期机制；支持 Token 吊销；建议使用 HTTPS |
| 性能影响 | 中 | 使用独立线程池；限制并发连接数；异步处理所有 IO 操作 |
| WebSocket 稳定性 | 中 | 实现自动重连机制；回退到轮询模式；心跳检测 |
| 代码复杂度 | 高 | 采用清晰的模块边界；复用现有逻辑；编写完整的单元测试和集成测试 |
| 浏览器兼容性 | 低 | 使用现代浏览器标准 API；提供浏览器兼容性检测和提示 |

## 8. 相关文档

- **简报版本**: docs/dev/web-admin/web-admin-brief.md
- **访谈记录**: 由 /dev:clarify 生成于 2026-01-12

## 9. 下一步行动

### 方式1：使用 spec-dev 继续（推荐）

在新会话中执行：
```bash
/dev:spec-dev web-admin --skip-requirements
```

这将：
1. ✅ 跳过阶段1（requirements 已完成）
2. 🎯 直接进入阶段2（技术设计）
3. 📋 然后阶段3（任务拆分）
4. 💻 最后 TDD 实施

### 方式2：手动进行设计

如果你想自己设计技术方案，可以：
1. 基于本 requirements 编写 design.md
2. 然后执行 `/dev:spec-dev web-admin --stage 3` 进行任务拆分
