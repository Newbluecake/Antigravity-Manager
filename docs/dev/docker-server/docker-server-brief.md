# Antigravity Docker Server - 需求简报

> **生成时间**: 2025-01-12
> **访谈轮次**: 第 3 轮
> **细节级别**: Standard
> **版本**: v1 Draft

## 1. 一句话描述

构建 Antigravity Manager 的 Docker 服务端版本，支持在 Linux 服务器（x86/arm64）上以无头模式运行，通过 Web Admin 管理账号并提供 API 代理服务。

## 2. 目标用户

- **主要用户**：自托管（Self-hosted）爱好者、NAS 用户、需要集中管理 API 密钥的团队管理员。
- **使用场景**：在家庭实验室（Homelab）、公司内网服务器或云 VPS 上部署。

## 3. 核心场景（Top 3）

### 场景 1: Docker 一键部署
- **触发**: 用户运行 `docker run` 或 `docker-compose up`。
- **结果**: 服务启动，自动初始化数据库（如不存在），监听 Web Admin (8046) 和 Proxy (8045) 端口。

### 场景 2: Web 端添加账号
- **触发**: 用户访问 Web Admin，在“添加账号”页面粘贴 Refresh Token。
- **结果**: 后端验证 Token，加密存储到本地数据库，立即加入代理轮询池。

### 场景 3: 中央 API 代理
- **触发**: 局域网内的 Cursor/NextChat 配置代理地址为 `http://SERVER_IP:8045`。
- **结果**: 请求被 Antigravity Server 接收，负载均衡分发到有效账号，返回流式响应。

## 4. 关键需求点

**必须有 (P0)**:
- [ ] **Docker 镜像**: 支持 amd64 和 arm64 架构，体积尽可能小（使用 Alpine/Distroless）。
- [ ] **Headless 模式**: 剥离 Tauri 桌面依赖，仅运行 Rust 后端逻辑（Axum Server）。
- [ ] **环境变量密钥**: 替代系统 Keyring，通过 `ANTIGRAVITY_MASTER_KEY` 环境变量加解密敏感数据。
- [ ] **Web Admin 增强**: 完善账号添加/删除功能（目前仅支持查看）。

**应该有 (P1)**:
- [ ] **健康检查**: Docker Healthcheck 支持。
- [ ] **配置持久化**: 支持挂载 `/data` 目录存储数据库和日志。

## 5. 明确不做

- **不提供 HTTPS**: 用户应自行使用 Nginx/Traefik 处理 SSL 卸载。
- **不提供桌面 GUI**: Docker 版没有显示界面，仅通过 Web 访问。
- **不内置 OAuth 回调**: Web 端添加账号仅支持“粘贴 Token”模式，不支持直接跳转 Google 登录（因为服务器没有浏览器）。

## 6. 关键风险

- **Tauri 依赖解耦**: 现有的 Rust 代码深度绑定 Tauri AppHandle，需要重构为特性（Feature）开关或独立 Binary，以在无 Tauri 环境下编译运行。
- **安全性**: 用户可能使用弱 Master Key，需要文档强调强密码重要性。

## 7. 下一步

✅ **确认 Brief 后，查看完整 Requirements**:
`docs/dev/docker-server/docker-server-requirements.md`

✅ **在新会话中执行**:
```bash
/dev:spec-dev docker-server --skip-requirements
```
