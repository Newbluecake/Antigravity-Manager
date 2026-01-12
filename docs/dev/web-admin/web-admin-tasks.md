# Web Admin 开发任务清单

> **状态**: Planned
> **关联分支**: feature/web-admin

## Phase 1: 基础设施 (Backend)

| ID | 任务 | 描述 | 验收标准 | 依赖 |
|----|------|------|----------|------|
| T-101 | 添加依赖 | 在 `Cargo.toml` 添加 `jsonwebtoken` 和 `headers` (如果需要)。 | 编译通过。 | - |
| T-102 | 创建模块结构 | 创建 `modules/web_admin` 目录及基础文件 (`mod.rs`, `error.rs`)。在 `main.rs` 注册模块。 | 模块可被编译。 | - |
| T-103 | 数据库初始化 | 实现 `db.rs`。`init_db` 创建 `web_admin.db` 及表结构。 | 应用启动时自动创建数据库文件。 | T-102 |
| T-104 | JWT 工具类 | 实现 `auth.rs`。包含 Token 生成、验证、密钥管理。 | 单元测试通过：生成 Token -> 验证成功 -> 过期验证失败。 | T-101 |
| T-105 | Axum Server 骨架 | 实现 `server.rs`。启动 HTTP 服务，支持 Graceful Shutdown。 | `curl localhost:8046/health` 返回 200。 | T-102 |

## Phase 2: 核心 API (Backend)

| ID | 任务 | 描述 | 验收标准 | 依赖 |
|----|------|------|----------|------|
| T-201 | 登录 API | 实现 `POST /api/v1/auth/login`。验证密码(初始默认为 "admin")，返回 Token。 | Postman 测试登录成功。 | T-104, T-105 |
| T-202 | 认证中间件 | 实现 Axum Middleware，拦截无 Token 请求。 | 未携带 Token 访问受保护接口返回 401。 | T-201 |
| T-203 | 仪表盘 API | 实现 `GET /api/v1/dashboard/stats`。聚合 Proxy 状态和 Account 统计。 | 返回正确的 JSON 数据。 | T-202 |
| T-204 | 代理控制 API | 实现 `/proxy/start`, `/proxy/stop`, `/proxy/config`。调用 `modules::proxy`。 | 能够通过 API 启停代理服务。 | T-202 |
| T-205 | 账号管理 API | 实现 `/accounts` 列表和详情。复用 `modules::account::list_accounts`。 | 返回账号列表，敏感信息已脱敏。 | T-202 |
| T-206 | 日志查询 API | 实现 `/logs`。复用 `modules::proxy_db::get_logs`。 | 返回分页的日志数据。 | T-202 |

## Phase 3: WebSocket (Backend)

| ID | 任务 | 描述 | 验收标准 | 依赖 |
|----|------|------|----------|------|
| T-301 | WebSocket 基础 | 在 `server.rs` 添加 `/ws` 路由。处理握手和连接维持。 | `wscat` 可以连接并保持心跳。 | T-105 |
| T-302 | 事件广播系统 | 实现 `Broadcaster` 结构。订阅 Tauri 事件或内部 Channel，转发给 WebSocket 客户端。 | 触发代理状态变化，WebSocket 收到 JSON 消息。 | T-301 |

## Phase 4: 前端实现 (Frontend)

| ID | 任务 | 描述 | 验收标准 | 依赖 |
|----|------|------|----------|------|
| T-401 | Vite MPA 配置 | 修改 `vite.config.ts`，支持 `web-admin` 入口。 | `npm run build` 生成 `dist/index.html` 和 `dist/admin/index.html`。 | - |
| T-402 | 登录页面 | 创建 `src/web-admin/pages/Login.tsx`。 | 能够登录并保存 Token，跳转首页。 | T-201, T-401 |
| T-403 | 仪表盘页面 | 创建 `Dashboard.tsx`。展示统计卡片。 | 能够显示后端返回的统计数据。 | T-203 |
| T-404 | 代理控制组件 | 启停按钮和配置表单。 | 能够控制后端代理服务。 | T-204 |
| T-405 | 账号列表页面 | 表格展示账号，支持禁用/刷新操作。 | 能够列出账号并操作。 | T-205 |
| T-406 | 响应式布局 | 使用 Tailwind CSS 实现移动端适配。 | 手机模式下菜单折叠，布局正常。 | T-403 |

## Phase 5: 集成与交付

| ID | 任务 | 描述 | 验收标准 | 依赖 |
|----|------|------|----------|------|
| T-501 | 静态资源托管 | 在 Axum 中配置 `ServeDir`，指向 `dist/admin`。 | 访问 `http://localhost:8046` 显示 Web Admin 界面。 | T-401, T-105 |
| T-502 | 局域网访问开关 | 在桌面端设置页添加开关，控制 Web Admin 监听 IP (127.0.0.1 vs 0.0.0.0)。 | 开关切换后，Web Server 重启并绑定正确 IP。 | T-105 |
| T-503 | E2E 测试 | 手动或自动化测试完整流程。 | 按照功能验收清单 (F-001 ~ F-022) 逐项通过。 | All |

## 任务执行顺序建议

1.  先完成 **Phase 1**，确保后端基础稳固。
2.  并行进行 **Phase 2 (后端)** 和 **Phase 4 (前端)**，或者按照全栈方式逐个功能模块开发 (e.g., 后端 Auth -> 前端 Auth -> 后端 Dashboard -> 前端 Dashboard)。
3.  最后进行 **Phase 3** 和 **Phase 5** 的集成。
