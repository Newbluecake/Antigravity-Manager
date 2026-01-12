# Web Admin 技术设计文档

> **状态**: Draft
> **作者**: Antigravity Team
> **日期**: 2026-01-12

## 1. 架构设计

Web Admin 模块 (`modules::web_admin`) 旨在为 Antigravity Manager 提供一个轻量级、独立的 Web 管理界面。它不干扰主代理服务的运行，而是通过共享内存状态和数据库来监控和控制应用。

### 1.1 系统上下文

```mermaid
graph TD
    User[用户 (浏览器)] -->|HTTP/WebSocket| WebAdminServer[Web Admin Server :8046]
    WebAdminServer -->|Read/Write| SharedState[Shared AppState]
    WebAdminServer -->|Read/Write| WebAdminDB[Web Admin DB (SQLite)]
    WebAdminServer -->|Read| ProxyDB[Proxy DB (SQLite)]
    WebAdminServer -->|Read| AccountFiles[Account Files (JSON)]
    
    SharedState --> ProxyServer[Proxy Server :3000]
    ProxyServer -->|Log| ProxyDB
```

### 1.2 模块结构 (`src-tauri/src/modules/web_admin/`)

遵循现有的模块化设计，Web Admin 将作为一个独立的模块实现：

```rust
src-tauri/src/modules/web_admin/
├── mod.rs           // 模块入口，对外公开 start_server 等函数
├── error.rs         // 模块专用错误类型
├── server.rs        // Axum 服务器配置与启动逻辑
├── state.rs         // Web Admin 专用状态 (AppState 扩展)
├── db.rs            // Web Admin 数据库操作 (配置、Token 黑名单)
├── auth.rs          // JWT 认证逻辑 (生成、验证、中间件)
├── websocket.rs     // WebSocket 管理 (连接池、广播)
└── handlers/        // API 处理器
    ├── mod.rs
    ├── auth.rs      // 登录/登出
    ├── dashboard.rs // 仪表盘概览
    ├── proxy.rs     // 代理服务控制
    ├── accounts.rs  // 账号管理
    └── logs.rs      // 监控日志查询
```

### 1.3 依赖库

*   **Web 框架**: `axum` (复用现有依赖)
*   **异步运行时**: `tokio`
*   **数据库**: `rusqlite`
*   **序列化**: `serde`, `serde_json`
*   **认证**: `jsonwebtoken` (需新增依赖)
*   **WebSocket**: `axum` 内置支持 (基于 `tokio-tungstenite`)
*   **CORS**: `tower-http`

## 2. 数据库设计

Web Admin 需要持久化存储少量数据（如管理员密码哈希、JWT 密钥、Web 服务配置）。为了不污染现有的 `state.vscdb` (VSCode 兼容) 和 `proxy_logs.db` (日志)，我们将创建一个新的 SQLite 数据库：`web_admin.db`。

### 2.1 数据库位置
`~/.antigravity_tools/web_admin.db`

### 2.2 Schema 设计

#### `admin_config` 表
存储键值对配置。

| 字段 | 类型 | 说明 |
|------|------|------|
| key | TEXT PRIMARY KEY | 配置键 (e.g. `password_hash`, `jwt_secret`, `server_port`) |
| value | TEXT | 配置值 |

#### `revoked_tokens` 表
用于 Token 吊销（登出、修改密码时）。

| 字段 | 类型 | 说明 |
|------|------|------|
| jti | TEXT PRIMARY KEY | JWT ID (UUID) |
| expiry | INTEGER | 过期时间戳 (用于定期清理) |
| revoked_at | INTEGER | 吊销时间 |

## 3. API 接口设计

所有 API 均位于 `/api/v1` 路径下。除了 `/api/v1/auth/login`，其他接口均需要 `Authorization: Bearer <token>` 头。

### 3.1 认证 (Auth)

*   `POST /auth/login`
    *   **Body**: `{ "password": "..." }`
    *   **Response**: `{ "token": "...", "expires_at": 1234567890 }`
    *   **Note**: MVP 阶段仅支持单用户，默认密码在首次启动时在日志中打印或通过桌面 UI 设置。

*   `POST /auth/logout`
    *   **Response**: 200 OK
    *   **Side Effect**: 将当前 Token jti 加入黑名单。

### 3.2 仪表盘 (Dashboard)

*   `GET /dashboard/stats`
    *   **Response**:
        ```json
        {
            "proxy_status": "running", // "stopped"
            "proxy_port": 3000,
            "account_count": 10,
            "active_account_count": 8,
            "total_requests_today": 1500,
            "error_rate_today": 0.02
        }
        ```

### 3.3 代理控制 (Proxy)

*   `POST /proxy/start`
*   `POST /proxy/stop`
*   `GET /proxy/config`
*   `PUT /proxy/config`
    *   **Body**: `{ "port": 3000, "mode": "round_robin", "allow_lan": true }`

### 3.4 账号管理 (Accounts)

*   `GET /accounts`
    *   **Query**: `page=1&limit=20`
    *   **Response**: `[{ "id": "...", "email": "t***@g.com", "tier": "PRO", "quota_summary": {...}, "disabled": false }]`

*   `GET /accounts/:id`
    *   **Response**: 完整账号详情。

*   `POST /accounts/:id/refresh`
    *   **Desc**: 触发配额刷新。

*   `POST /accounts/:id/toggle`
    *   **Body**: `{ "disabled": true }`

### 3.5 监控日志 (Logs)

*   `GET /logs`
    *   **Query**: `limit=50&offset=0&model=claude-3&status=error`
    *   **Response**: `[{ "id": "...", "method": "POST", "status": 200, ... }]`

## 4. WebSocket 协议

用于实时推送状态变化，减少前端轮询。

*   **URL**: `/ws`
*   **Auth**: Query 参数 `?token=...`

### 4.1 消息类型 (Server -> Client)

*   `StatsUpdate`: `{ "type": "stats", "data": { ... } }` (每 5 秒或状态变化时)
*   `LogEntry`: `{ "type": "log", "data": { ... } }` (新请求产生时，仅当用户在日志页面时订阅?) -> MVP 简化为全部推送，前端过滤。
*   `ProxyState`: `{ "type": "proxy_state", "data": "running" }`

## 5. 前端集成

*   **构建**: 修改 `vite.config.ts` 配置多入口 (MPA)。
    *   `src/main.tsx` -> `dist/index.html` (桌面端)
    *   `src/admin/main.tsx` -> `dist/admin/index.html` (Web 端)
*   **路由**: Web Admin 使用 `HashRouter` 避免后端配置复杂的 Rewrite 规则。
*   **部署**: Rust Axum 使用 `ServeDir` 将 `dist/admin` 目录映射到 Web Server 的根路径 `/`。

## 6. 安全考量

1.  **JWT Secret**: 首次启动随机生成，存储在 `web_admin.db`。如果丢失则重置所有登录状态。
2.  **密码哈希**: 存储加盐哈希，不存储明文。
3.  **CORS**: 严格限制，仅允许同源（Web Admin 前端由同一 Server 托管）或开发环境 localhost。
4.  **局域网访问**: 默认绑定 `127.0.0.1`。用户显式开启后绑定 `0.0.0.0`。

## 7. 关键文件

*   `src-tauri/src/modules/web_admin/mod.rs`: 模块入口
*   `src-tauri/src/modules/web_admin/server.rs`: Axum 路由配置
*   `src-tauri/src/modules/web_admin/auth.rs`: JWT 实现
*   `src-tauri/src/modules/web_admin/db.rs`: SQLite 操作
*   `vite.config.ts`: 前端构建配置
