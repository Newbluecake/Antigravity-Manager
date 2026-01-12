# 需求文档: Antigravity Docker Server

> **生成方式**: 由 /dev:clarify 自动生成
> **生成时间**: 2025-01-12
> **访谈轮次**: 第 3 轮
> **细节级别**: Standard
> **可直接用于**: /dev:spec-dev docker-server --skip-requirements

## 1. 介绍

构建 Antigravity Manager 的服务端版本（Docker 容器），使其能够在无桌面环境的 Linux 服务器上运行。该版本剥离了 GUI 依赖，仅保留核心代理服务和 Web 管理后台，并通过环境变量解决密钥存储问题。

**目标用户**:
- NAS 用户（Synology, QNAP, Unraid）
- VPS/云服务器管理员
- Homelab 爱好者

**核心价值**: 提供一个永远在线（Always-on）的中央 API 代理网关，统一管理 API 访问，无需依赖个人电脑常开。

## 2. 需求与用户故事

### 需求 1: Docker 容器化支持
**用户故事:** As a 运维人员, I want 官方提供的 Docker 镜像, so that 我可以在任何支持 Docker 的机器上一键部署服务。

#### 验收标准
- **IF** 宿主机是 x86_64 或 arm64, **THEN** 镜像都能正常拉取并运行。
- **WHEN** 容器启动时, **THEN** 应暴露 8046 (Web Admin) 和 8045 (Proxy) 端口。
- **IF** 配置了持久化卷, **THEN** 重启容器后数据（账号、日志）不丢失。

### 需求 2: Headless 运行模式 (去 Tauri 化)
**用户故事:** As a 开发者, I want 服务端版本不依赖图形界面库 (GTK/WebView), so that 镜像体积小且运行时内存占用低。

#### 验收标准
- **WHEN** 编译 Docker 版本时, **THEN** 不应链接 Tauri/WebView 相关库。
- **IF** 在纯命令行环境运行, **THEN** 不应报错 "Display not found" 或类似错误。

### 需求 3: 环境变量密钥管理
**用户故事:** As a 管理员, I want 通过环境变量设置主密钥, so that 在没有系统 Keyring 的容器环境中也能安全加密存储 Token。

#### 验收标准
- **IF** 环境变量 `ANTIGRAVITY_MASTER_KEY` 存在, **THEN** 系统使用该 Key 派生密钥加密数据库字段。
- **IF** 环境变量未设置, **THEN** 容器启动失败并提示需要设置密钥。
- **WHEN** 数据写入数据库时, **THEN** 必须是加密状态（AES-GCM 或类似）。

### 需求 4: Web Admin 账号管理能力
**用户故事:** As a 用户, I want 在 Web 界面添加和删除账号, so that 我不需要手动操作数据库文件。

#### 验收标准
- **WHEN** 在 Web Admin 点击“添加账号”, **THEN** 弹窗允许粘贴 Refresh Token。
- **WHEN** 提交有效 Token, **THEN** 列表应立即刷新显示新账号。
- **WHEN** 点击删除账号, **THEN** 账号从数据库物理删除或软删除。

## 3. 测试映射表

| 验收条目 | 测试层级 | 预期测试文件 | 预期函数/用例 |
|----------|----------|--------------|---------------|
| 镜像构建 | CI/CD | .github/workflows/docker.yml | build-and-push |
| 环境变量读取 | unit | src/utils/crypto.rs | test_env_key_provider |
| Headless启动 | integration | tests/server_test.rs | test_headless_startup |
| Web添加账号 | integration | tests/api_test.rs | test_add_account_via_api |

## 4. 功能验收清单

| ID | 功能点 | 验收步骤 | 优先级 | 关联任务 | 通过 |
|----|--------|----------|--------|----------|------|
| F-001 | Docker 镜像构建 | 1. `docker build .` 成功 2. 镜像大小 < 200MB | P0 | 待分配 | ☐ |
| F-002 | 密钥环适配器 | 1. 设置 ENV 启动 2. 添加账号 3. 重启验证账号可用 | P0 | 待分配 | ☐ |
| F-003 | 纯后端入口 | 1. 运行 `antigravity-server` 2. 只有日志输出，无 GUI 窗口 | P0 | 待分配 | ☐ |
| F-004 | Web 添加账号 API | 1. POST /api/v1/accounts 2. 传入 Token 3. 返回 201 Created | P0 | 待分配 | ☐ |
| F-005 | Docker Compose | 1. `docker-compose up -d` 2. 服务正常访问 | P1 | 待分配 | ☐ |

## 5. 技术约束与要求

### 5.1 技术栈
- **语言**: Rust (Backend), React (Web Admin)
- **构建工具**: Docker, Buildx, Cargo
- **基础镜像**: `gcr.io/distroless/cc-debian12` 或 `alpine` (需处理 glibc 兼容性)

### 5.2 架构调整
- 需要重构 `src-tauri/src/main.rs`，支持通过 `feature` 标志切换 "Desktop" (Tauri) 和 "Server" (Axum only) 模式。
- 抽象 `Keyring` 接口，实现 `SystemKeyring` (桌面用) 和 `EnvKeyring` (服务端用)。

### 5.3 数据存储
- **数据库**: SQLite (同桌面版)，文件路径需可配置 (e.g., `/data/antigravity.db`)。

### 5.4 安全要求
- 容器内**不应该**以 root 运行服务（使用 nonroot 用户）。
- API Key 和 Token 必须加密存储。

## 6. 排除项（明确不做）

- **HTTPS/TLS**: 容器只提供 HTTP，TLS 由外部反代处理。
- **OAuth 登录**: Web 端不实现“点击跳转 Google 登录”，因为服务器无法打开本地浏览器回调。
- **桌面通知**: 服务端版本移除所有系统通知功能。

## 7. 风险与挑战

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 代码耦合度过高 | 高 | 需要仔细拆分 Tauri 相关代码，使用 `#[cfg(feature = "desktop")]` 宏隔离 |
| 跨平台构建慢 | 中 | 使用 GitHub Actions 缓存 Docker 层 |
| 密钥丢失风险 | 高 | 文档强调 `MASTER_KEY` 丢失意味着数据无法解密，需用户自行备份 |

## 8. 相关文档

- **简报版本**: docs/dev/docker-server/docker-server-brief.md
- **访谈记录**: 由 /dev:clarify 生成于 2025-01-12

## 9. 下一步行动

在新会话中执行：
```bash
/dev:spec-dev docker-server --skip-requirements
```
