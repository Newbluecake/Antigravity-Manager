# 任务拆分文档: Web Admin 代理配置页面复刻

> **生成时间**: 2026-01-12
> **关联设计**: web-admin-proxy-design.md
> **关联需求**: web-admin-proxy-requirements.md
> **任务版本**: v1.0

## 1. 任务概览

### 1.1 分阶段实施策略

本项目分为 3 个 Phase，按优先级和依赖关系递进实施：

| Phase | 名称 | 核心目标 | 预计工作量 |
|-------|------|---------|-----------|
| Phase 1 | MVP 核心功能 | 代理控制 + 基本配置 + 模型映射 | 前端 3-5天，后端 2-3天 |
| Phase 2 | 完整功能 | 回退链 + 粘性会话 + 高级设置 + 导入导出 | 前端 4-6天，后端 2-3天 |
| Phase 3 | 高级功能 | Token管理 + ZAI集成 + 实验性功能 | 前端 2-3天，后端 1-2天 |

### 1.2 并行开发能力

- **Phase 1**: 前后端可并行开发（定义好 API 契约后）
- **Phase 2**: 基于 Phase 1 完成，前后端可并行
- **Phase 3**: 基于 Phase 2 完成，前后端可并行

---

## 2. Phase 1: MVP 核心功能

### 任务组 1.1: 基础架构搭建（前端）

#### T-001: 创建 ProxyConfigPage 主页面框架
- **优先级**: P0
- **依赖**: 无
- **负责人**: 待分配
- **预计工时**: 2h
- **文件**:
  - `src/admin/pages/ProxyConfigPage.tsx` (新建)
- **验收标准**:
  - 页面路由配置完成
  - 页面基础布局完成（头部 + 内容区）
  - 集成到 Web Admin 路由系统
- **测试**:
  - 访问 `/admin/proxy-config` 能正常渲染页面
  - 深色主题切换正常

#### T-002: 创建 Hook - useProxyConfig
- **优先级**: P0
- **依赖**: 无
- **预计工时**: 3h
- **文件**:
  - `src/admin/hooks/useProxyConfig.ts` (新建)
  - `src/admin/api/proxyApi.ts` (新建，部分实现)
- **验收标准**:
  - 实现 `loadConfig()`, `saveConfig()`, `updatePartial()` 方法
  - 集成错误处理和加载状态
  - API 调用封装完成（暂时mock，待后端API就绪）
- **测试**:
  - 单元测试：`useProxyConfig.test.ts`
  - 测试用例：加载配置成功、加载失败、保存配置成功、保存失败

#### T-003: 创建 Hook - useProxyStatus
- **优先级**: P0
- **依赖**: 无
- **预计工时**: 3h
- **文件**:
  - `src/admin/hooks/useProxyStatus.ts` (新建)
  - `src/admin/api/proxyApi.ts` (补充)
- **验收标准**:
  - 实现 `start()`, `stop()`, `restart()` 方法
  - 实现状态轮询（3秒间隔）
  - 集成加载状态和错误处理
- **测试**:
  - 单元测试：`useProxyStatus.test.ts`
  - 测试用例：启动成功、启动失败、停止成功、状态轮询

#### T-004: 复用桌面端组件 - CollapsibleCard
- **优先级**: P0
- **依赖**: 无
- **预计工时**: 2h
- **文件**:
  - `src/admin/components/ProxyConfig/shared/CollapsibleCard.tsx` (新建)
- **验收标准**:
  - 从 `src/pages/ApiProxy.tsx` 复制组件代码
  - 移除 Tauri 特定依赖
  - 适配 Web Admin 深色主题
  - 保持 UI 样式一致
- **测试**:
  - 组件测试：`CollapsibleCard.test.tsx`
  - 测试用例：展开/折叠、启用/禁用切换

---

### 任务组 1.2: 代理控制面板（前端）

#### T-005: 创建 ProxyControlPanel 组件
- **优先级**: P0
- **依赖**: T-001, T-002, T-003, T-004
- **预计工时**: 4h
- **文件**:
  - `src/admin/components/ProxyConfig/ProxyControlPanel.tsx` (新建)
- **验收标准**:
  - 显示代理运行状态（运行中/已停止）
  - 显示端口、Base URL、活跃账号数
  - 启动/停止/重启按钮功能完整
  - 端口和绑定地址配置UI
  - 复制 URL 功能
- **UI 参考**: 桌面端 ApiProxy.tsx 代理控制部分
- **测试**:
  - 组件测试：`ProxyControlPanel.test.tsx`
  - 测试用例：
    - 状态显示正确
    - 启动按钮触发启动
    - 停止按钮触发停止
    - 端口输入验证（1024-65535）
    - 复制 URL 成功

#### T-006: 实现端口和绑定地址配置逻辑
- **优先级**: P0
- **依赖**: T-005
- **预计工时**: 2h
- **验收标准**:
  - 端口号验证（范围 1024-65535，整数）
  - 绑定地址切换（127.0.0.1 / 0.0.0.0）
  - 配置变更提示（需要重启生效）
  - 保存配置调用API
- **测试**:
  - 集成测试：`proxy_config.test.ts`
  - 测试用例：
    - 端口验证失败（abc, 99999）
    - 端口验证成功（8045）
    - 绑定地址切换成功
    - 保存配置成功

---

### 任务组 1.3: 模型映射配置（前端）

#### T-007: 复用桌面端组件 - MappingListBuilder
- **优先级**: P0
- **依赖**: 无
- **预计工时**: 3h
- **文件**:
  - `src/admin/components/ProxyConfig/shared/MappingListBuilder.tsx` (新建)
- **验收标准**:
  - 从桌面端复制组件
  - 适配 Web Admin API 调用
  - 保持 UI 样式一致
- **测试**:
  - 组件测试：`MappingListBuilder.test.tsx`

#### T-008: 创建 ModelMappingConfig 组件
- **优先级**: P0
- **依赖**: T-004, T-007
- **预计工时**: 5h
- **文件**:
  - `src/admin/components/ProxyConfig/ModelMappingConfig.tsx` (新建)
- **验收标准**:
  - 显示现有模型映射列表
  - 添加映射功能（选择源模型、目标提供商、目标模型）
  - 编辑映射功能
  - 删除映射功能（带确认对话框）
  - 别名配置
- **UI 参考**: 桌面端 ApiProxy.tsx 模型映射部分
- **测试**:
  - 组件测试：`ModelMappingConfig.test.tsx`
  - 测试用例：
    - 添加映射成功
    - 编辑映射成功
    - 删除映射成功
    - 映射冲突检测

#### T-009: 复用桌面端组件 - GroupedSelect
- **优先级**: P1
- **依赖**: 无
- **预计工时**: 2h
- **文件**:
  - `src/admin/components/ProxyConfig/shared/GroupedSelect.tsx` (新建)
- **验收标准**:
  - 从桌面端复制组件
  - 适配 Web Admin 样式
- **测试**:
  - 组件测试：`GroupedSelect.test.tsx`

---

### 任务组 1.4: 后端 API 实现

#### T-010: 创建 Proxy API Handlers
- **优先级**: P0
- **依赖**: 无
- **预计工时**: 4h
- **文件**:
  - `src-tauri/src/modules/web_admin/handlers/proxy.rs` (新建)
- **验收标准**:
  - 实现 `start_proxy()`
  - 实现 `stop_proxy()`
  - 实现 `restart_proxy()`
  - 实现 `get_proxy_status()`
  - 调用现有代理服务逻辑
- **测试**:
  - 单元测试：`proxy_handlers.test.rs`
  - 测试用例：
    - 启动代理成功
    - 启动代理失败（端口占用）
    - 停止代理成功
    - 获取状态成功

#### T-011: 实现配置管理 API
- **优先级**: P0
- **依赖**: T-010
- **预计工时**: 3h
- **文件**:
  - `src-tauri/src/modules/web_admin/handlers/proxy.rs` (补充)
- **验收标准**:
  - 实现 `get_proxy_config()`
  - 实现 `update_proxy_config()` (PUT - 全量更新)
  - 配置验证逻辑
- **测试**:
  - 单元测试：补充 `proxy_handlers.test.rs`
  - 测试用例：
    - 获取配置成功
    - 更新配置成功
    - 配置验证失败（端口非法）

#### T-012: 注册路由到 Web Admin Server
- **优先级**: P0
- **依赖**: T-010, T-011
- **预计工时**: 1h
- **文件**:
  - `src-tauri/src/modules/web_admin/server.rs` (修改)
- **验收标准**:
  - 添加代理 API 路由
  - 添加认证中间件
  - 路由测试通过
- **测试**:
  - 集成测试：`proxy_api_integration.test.rs`
  - 测试用例：
    - 未认证访问返回 401
    - 认证访问成功

---

### 任务组 1.5: 集成测试和优化

#### T-013: 前后端集成联调
- **优先级**: P0
- **依赖**: T-001~T-012
- **预计工时**: 4h
- **验收标准**:
  - 前端页面能调用后端API
  - 代理启动/停止流程完整
  - 配置保存流程完整
  - 错误处理正确
- **测试**:
  - E2E 测试（可选）：使用 Playwright
  - 测试用例：
    - 完整的启动代理流程
    - 完整的配置修改流程

#### T-014: Phase 1 功能验收
- **优先级**: P0
- **依赖**: T-013
- **预计工时**: 2h
- **验收标准**:
  - 对照 requirements.md 的功能验收清单
  - 检查 F-001 ~ F-007（Phase 1 功能点）
  - 所有 P0 功能验收通过
- **输出**:
  - Phase 1 验收报告

---

## 3. Phase 2: 完整功能

### 任务组 2.1: 回退链配置（前端）

#### T-015: 创建 FallbackChainEditor 组件
- **优先级**: P1
- **依赖**: Phase 1 完成
- **预计工时**: 4h
- **文件**:
  - `src/admin/components/ProxyConfig/FallbackChainEditor.tsx` (新建)
- **验收标准**:
  - 显示回退链编辑界面
  - 添加/删除回退模型
  - 拖拽调整优先级顺序
  - 循环依赖检测
- **UI 参考**: 桌面端 ApiProxy.tsx 回退链部分
- **测试**:
  - 组件测试：`FallbackChainEditor.test.tsx`
  - 测试用例：
    - 添加回退模型成功
    - 调整顺序成功
    - 循环依赖检测（A→B→A）

#### T-016: 集成回退链到 ModelMappingConfig
- **优先级**: P1
- **依赖**: T-015
- **预计工时**: 2h
- **验收标准**:
  - 在模型映射卡片中显示"配置回退链"按钮
  - 点击打开回退链编辑对话框
  - 保存回退链到配置
- **测试**:
  - 集成测试：`model_mapping_fallback.test.ts`

---

### 任务组 2.2: 粘性会话配置（前端）

#### T-017: 创建 StickySessionConfig 组件
- **优先级**: P1
- **依赖**: Phase 1 完成
- **预计工时**: 4h
- **文件**:
  - `src/admin/components/ProxyConfig/StickySessionConfig.tsx` (新建)
- **验收标准**:
  - 粘性会话启用/禁用开关
  - TTL 配置（验证范围 60-86400）
  - 清理策略选择（定时/内存阈值）
  - 活跃会话统计显示
  - 清空会话功能
- **UI 参考**: 桌面端 ApiProxy.tsx 粘性会话部分
- **测试**:
  - 组件测试：`StickySessionConfig.test.tsx`
  - 测试用例：
    - 启用粘性会话
    - TTL 验证
    - 清理策略切换
    - 清空会话确认

---

### 任务组 2.3: 高级设置（前端）

#### T-018: 创建 AdvancedSettings 组件
- **优先级**: P1
- **依赖**: Phase 1 完成
- **预计工时**: 5h
- **文件**:
  - `src/admin/components/ProxyConfig/AdvancedSettings.tsx` (新建)
- **验收标准**:
  - 请求超时配置（验证范围 10-600）
  - 日志记录开关
  - 自动启动开关
  - 上游代理配置（URL 验证）
  - 实验性功能开关
- **UI 参考**: 桌面端 ApiProxy.tsx 高级设置部分
- **测试**:
  - 组件测试：`AdvancedSettings.test.tsx`
  - 测试用例：
    - 超时验证
    - URL 验证
    - 实验性功能开关

---

### 任务组 2.4: 配置导入导出（前端）

#### T-019: 创建 ConfigImportExport 组件
- **优先级**: P1
- **依赖**: Phase 1 完成
- **预计工时**: 4h
- **文件**:
  - `src/admin/components/ProxyConfig/ConfigImportExport.tsx` (新建)
- **验收标准**:
  - 导出配置按钮（下载 JSON 文件）
  - 导入配置按钮（文件选择）
  - 配置验证（JSON 格式、字段类型）
  - 导入成功提示
- **测试**:
  - 组件测试：`ConfigImportExport.test.tsx`
  - 测试用例：
    - 导出配置成功
    - 导入合法配置成功
    - 导入非法配置失败

---

### 任务组 2.5: 后端 API 扩展

#### T-020: 实现 PATCH API
- **优先级**: P1
- **依赖**: Phase 1 完成
- **预计工时**: 2h
- **文件**:
  - `src-tauri/src/modules/web_admin/handlers/proxy.rs` (补充)
- **验收标准**:
  - 实现 `patch_proxy_config()` (部分更新)
  - 配置合并逻辑
- **测试**:
  - 单元测试：补充 `proxy_handlers.test.rs`
  - 测试用例：部分更新成功

#### T-021: 实现配置导入导出 API
- **优先级**: P1
- **依赖**: T-020
- **预计工时**: 3h
- **文件**:
  - `src-tauri/src/modules/web_admin/handlers/proxy.rs` (补充)
- **验收标准**:
  - 实现 `export_config()` (返回 JSON 文件)
  - 实现 `import_config()` (接收文件上传)
  - 配置验证逻辑
- **测试**:
  - 集成测试：`proxy_config_export_import.test.rs`
  - 测试用例：
    - 导出配置成功
    - 导入合法配置成功
    - 导入非法配置失败

#### T-022: 实现 WebSocket 状态推送
- **优先级**: P1
- **依赖**: T-020
- **预计工时**: 3h
- **文件**:
  - `src-tauri/src/modules/web_admin/websocket.rs` (修改)
  - `src-tauri/src/modules/web_admin/handlers/proxy.rs` (补充推送逻辑)
- **验收标准**:
  - 扩展 WebSocket 消息类型 `proxy_status_update`
  - 代理启动/停止时推送状态更新
  - 前端接收 WebSocket 消息
- **测试**:
  - 集成测试：`proxy_websocket.test.rs`
  - 测试用例：
    - 启动代理时收到状态推送
    - 停止代理时收到状态推送

---

### 任务组 2.6: Phase 2 集成测试

#### T-023: 前后端集成联调（Phase 2）
- **优先级**: P1
- **依赖**: T-015~T-022
- **预计工时**: 4h
- **验收标准**:
  - 回退链配置流程完整
  - 粘性会话配置流程完整
  - 高级设置保存流程完整
  - 配置导入导出流程完整
  - WebSocket 状态推送正常

#### T-024: Phase 2 功能验收
- **优先级**: P1
- **依赖**: T-023
- **预计工时**: 2h
- **验收标准**:
  - 对照 requirements.md 功能验收清单
  - 检查 F-008 ~ F-019（Phase 2 功能点）
  - 所有 P1 功能验收通过
- **输出**:
  - Phase 2 验收报告

---

## 4. Phase 3: 高级功能

### 任务组 3.1: Token 管理器（前端）

#### T-025: 创建 TokenManagerConfig 组件
- **优先级**: P2
- **依赖**: Phase 2 完成
- **预计工时**: 3h
- **文件**:
  - `src/admin/components/ProxyConfig/TokenManagerConfig.tsx` (新建)
- **验收标准**:
  - Token 管理器启用/禁用开关
  - 每日限额配置（验证 ≥ 1000）
  - 单次请求最大 Token 配置（验证 100-200000）
  - Token 用量警告显示
- **UI 参考**: 桌面端 ApiProxy.tsx Token 管理部分
- **测试**:
  - 组件测试：`TokenManagerConfig.test.tsx`

---

### 任务组 3.2: ZAI 集成（前端）

#### T-026: 创建 ZAI 配置组件
- **优先级**: P2
- **依赖**: Phase 2 完成
- **预计工时**: 4h
- **文件**:
  - `src/admin/components/ProxyConfig/ZaiConfig.tsx` (新建)
- **验收标准**:
  - ZAI 启用/禁用开关
  - Base URL 配置
  - API Key 配置（敏感信息保护）
  - 模型映射配置
  - 调度模式选择
- **UI 参考**: 桌面端 ApiProxy.tsx ZAI 部分
- **测试**:
  - 组件测试：`ZaiConfig.test.tsx`

---

### 任务组 3.3: 后端高级功能

#### T-027: Token 管理器后端逻辑（可选）
- **优先级**: P2
- **依赖**: Phase 2 完成
- **预计工时**: 3h
- **说明**: 如果 Token 管理逻辑需要后端支持，否则跳过

#### T-028: ZAI 集成后端逻辑（可选）
- **优先级**: P2
- **依赖**: Phase 2 完成
- **预计工时**: 4h
- **说明**: 如果 ZAI 集成需要后端新增 API，否则复用现有

---

### 任务组 3.4: Phase 3 集成测试

#### T-029: Phase 3 功能验收
- **优先级**: P2
- **依赖**: T-025~T-028
- **预计工时**: 2h
- **验收标准**:
  - 对照 requirements.md 功能验收清单
  - 检查 F-020 ~ F-030（Phase 3 功能点）
  - 所有 P2 功能验收通过
- **输出**:
  - Phase 3 验收报告

---

## 5. 整体验收和发布

### T-030: 完整功能验收测试
- **优先级**: P0
- **依赖**: Phase 1-3 全部完成
- **预计工时**: 4h
- **验收标准**:
  - 完整的用户流程测试（端到端）
  - 性能测试（页面加载 < 2s，API 响应 < 500ms）
  - 浏览器兼容性测试（Chrome/Edge/Firefox）
  - 深色主题一致性测试
- **输出**:
  - 完整验收报告

### T-031: 文档更新
- **优先级**: P1
- **依赖**: T-030
- **预计工时**: 2h
- **任务**:
  - 更新 README.md
  - 添加 Web Admin 代理配置使用说明
  - 更新 API 文档

### T-032: 代码审查和优化
- **优先级**: P1
- **依赖**: T-030
- **预计工时**: 4h
- **任务**:
  - 代码规范检查（ESLint/Prettier）
  - 性能优化（如有必要）
  - 安全审查（敏感信息保护）

---

## 6. 任务依赖关系图

### Phase 1 依赖图

```
T-001 (Page框架) ──┬──> T-005 (ProxyControlPanel) ──> T-013 (集成联调)
                   │                                       │
T-002 (useProxyConfig) ─┘                                  │
T-003 (useProxyStatus) ─┘                                  │
T-004 (CollapsibleCard) ─┘                                 │
                                                           │
T-007 (MappingListBuilder) ──> T-008 (ModelMappingConfig) ─┘
T-009 (GroupedSelect) ────────┘                            │
                                                           │
T-010 (Handlers) ──> T-011 (Config API) ──> T-012 (路由) ─┘
                                                           │
                                                           v
                                                      T-014 (Phase 1 验收)
```

### Phase 2 依赖图

```
Phase 1 完成 ──> T-015 (FallbackChain) ──> T-016 (集成) ─┬──> T-023 (集成联调)
             │                                           │       │
             ├──> T-017 (StickySession) ─────────────────┤       │
             │                                           │       │
             ├──> T-018 (AdvancedSettings) ──────────────┤       │
             │                                           │       │
             └──> T-019 (ImportExport) ──────────────────┘       │
                                                                 │
Phase 1 完成 ──> T-020 (PATCH API) ──> T-021 (Export/Import) ─┬─┘
                                                               │
             └──> T-022 (WebSocket) ────────────────────────────┘
                                                                 │
                                                                 v
                                                            T-024 (Phase 2 验收)
```

### Phase 3 依赖图

```
Phase 2 完成 ──> T-025 (TokenManager) ──┬──> T-029 (Phase 3 验收)
             │                          │
             ├──> T-026 (ZaiConfig) ────┤
             │                          │
             ├──> T-027 (Token后端) ────┤
             │                          │
             └──> T-028 (ZAI后端) ──────┘
```

---

## 7. 任务执行策略

### 7.1 并行执行建议

**Phase 1 并行组**：
- 组1：T-001, T-002, T-003, T-004（前端基础）
- 组2：T-010, T-011, T-012（后端 API）
- 串行：T-005, T-006（依赖组1）
- 串行：T-007, T-008, T-009（依赖组1）
- 最后：T-013, T-014（集成测试）

**Phase 2 并行组**：
- 组1：T-015, T-016, T-017, T-018, T-019（前端组件，可并行）
- 组2：T-020, T-021, T-022（后端 API，可并行）
- 最后：T-023, T-024（集成测试）

**Phase 3 并行组**：
- T-025, T-026, T-027, T-028 可并行
- 最后：T-029（验收）

### 7.2 关键路径

```
T-001 → T-002/T-003/T-004 → T-005/T-008 → T-013 → T-014 (Phase 1)
  → T-015~T-022 (并行) → T-023 → T-024 (Phase 2)
  → T-025~T-028 (并行) → T-029 (Phase 3)
  → T-030 → T-031/T-032 (发布)
```

### 7.3 评审节点

- **Phase 1 评审**：T-014 完成后，进行规范符合性评审 + 代码质量评审
- **Phase 2 评审**：T-024 完成后，同上
- **Phase 3 评审**：T-029 完成后，同上
- **最终验收**：T-030 完成后，进行整体验收评审

---

## 8. 风险预警

| 任务ID | 风险 | 影响 | 缓解措施 |
|--------|------|------|---------|
| T-007, T-008 | 桌面端组件复用困难 | 中 | 预留额外时间适配，必要时重写 |
| T-022 | WebSocket 集成复杂 | 中 | 提供轮询兜底方案 |
| T-013, T-023 | 前后端API契约不一致 | 高 | 前期明确API规范，使用TypeScript类型定义 |
| T-030 | 性能不达标 | 中 | 分阶段优化，使用虚拟滚动等技术 |

---

## 9. 附录

### 9.1 任务模板

每个任务执行时遵循以下模板：

1. **TDD 流程**：先写测试，后写实现
2. **代码审查**：Phase 结束后进行代码审查
3. **文档更新**：关键组件需更新 JSDoc
4. **提交规范**：使用 Conventional Commits 格式

### 9.2 验收标准参考

参考 `web-admin-proxy-requirements.md` 第 4 节"功能验收清单"（F-001 ~ F-030）。

---

**任务拆分完成**，待用户确认后进入实施阶段。
