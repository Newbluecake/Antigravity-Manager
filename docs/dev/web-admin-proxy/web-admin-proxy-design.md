# 技术设计文档: Web Admin 代理配置页面复刻

> **生成时间**: 2026-01-12
> **关联需求**: web-admin-proxy-requirements.md
> **设计版本**: v1.0

## 1. 架构概览

### 1.1 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Admin Frontend                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ProxyConfigPage.tsx (新页面)                          │  │
│  │  ├─ ProxyControlPanel (代理控制组件)                   │  │
│  │  ├─ ModelMappingConfig (模型映射组件)                  │  │
│  │  ├─ StickySessionConfig (粘性会话组件)                │  │
│  │  ├─ AdvancedSettingsConfig (高级设置组件)             │  │
│  │  └─ ConfigImportExport (配置导入导出组件)             │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↓ HTTP API / WebSocket              │
├─────────────────────────────────────────────────────────────┤
│                    Web Admin Backend (Rust)                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  API Handlers (新增)                                    │  │
│  │  ├─ /api/v1/proxy/start                                │  │
│  │  ├─ /api/v1/proxy/stop                                 │  │
│  │  ├─ /api/v1/proxy/restart                              │  │
│  │  ├─ /api/v1/proxy/status                               │  │
│  │  ├─ /api/v1/proxy/config (GET/PUT/PATCH)               │  │
│  │  └─ /api/v1/ws (扩展: proxy_status_update)             │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↓ 调用                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Proxy Service (复用现有)                               │  │
│  │  ├─ 代理服务控制 (start/stop/restart)                  │  │
│  │  ├─ 配置管理 (load/save/update)                        │  │
│  │  └─ 状态管理 (get_status/update_status)                │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 组件复用策略

**从桌面端复用（需适配）**：
- `CollapsibleCard` - 可折叠卡片组件
- `MappingListBuilder` - 模型映射列表构建器
- `GroupedSelect` - 分组下拉选择组件
- `HelpTooltip` - 帮助提示组件
- `ModalDialog` - 模态对话框组件

**适配层**：
- 创建 `useProxyConfig` hook 替代桌面端的 `invoke()` 调用
- 封装 HTTP API 调用逻辑
- 统一错误处理和状态管理

**新增组件（Web Admin 特定）**：
- `ProxyStatusIndicator` - 代理状态指示器（含 WebSocket 实时更新）
- `ConfigExportButton` - 配置导出按钮
- `ConfigImportButton` - 配置导入按钮

## 2. 前端设计

### 2.1 目录结构

```
src/admin/
├── pages/
│   └── ProxyConfigPage.tsx          # 主页面（替换现有 ProxyPage.tsx）
├── components/
│   └── ProxyConfig/                 # 代理配置组件目录
│       ├── ProxyControlPanel.tsx    # 代理控制面板
│       ├── ModelMappingConfig.tsx   # 模型映射配置
│       ├── FallbackChainEditor.tsx  # 回退链编辑器
│       ├── StickySessionConfig.tsx  # 粘性会话配置
│       ├── TokenManagerConfig.tsx   # Token 管理器配置
│       ├── AdvancedSettings.tsx     # 高级设置
│       ├── ConfigImportExport.tsx   # 配置导入导出
│       └── shared/                  # 共享组件
│           ├── CollapsibleCard.tsx  # 从桌面端复用
│           ├── MappingListBuilder.tsx
│           └── GroupedSelect.tsx
├── hooks/
│   ├── useProxyConfig.ts           # 代理配置管理 Hook
│   ├── useProxyStatus.ts           # 代理状态管理 Hook
│   └── useProxyWebSocket.ts        # WebSocket 连接 Hook
├── api/
│   └── proxyApi.ts                 # 代理 API 封装
└── types/
    └── proxy.ts                    # 代理相关类型定义
```

### 2.2 核心组件设计

#### 2.2.1 ProxyConfigPage.tsx (主页面)

**职责**：
- 整合所有子组件
- 管理全局状态（配置、状态）
- 处理配置保存和重启逻辑

**状态管理**：
```typescript
interface PageState {
  config: ProxyConfig | null;       // 当前配置
  status: ProxyStatus | null;       // 当前状态
  loading: boolean;                 // 加载状态
  saving: boolean;                  // 保存状态
  hasUnsavedChanges: boolean;       // 是否有未保存的更改
}
```

**关键方法**：
```typescript
- loadConfig(): Promise<void>          // 加载配置
- saveConfig(): Promise<void>          // 保存配置
- restartProxy(): Promise<void>        // 重启代理
- handleConfigChange(partial): void    // 处理配置更改
```

#### 2.2.2 ProxyControlPanel.tsx (代理控制面板)

**UI 结构**：
```
┌─────────────────────────────────────────────┐
│  代理服务                                    │
│  ┌─────────────────────────────────────┐    │
│  │ ● 运行中                              │    │
│  │ 端口: 8045                            │    │
│  │ URL: http://127.0.0.1:8045           │📋 │
│  │ 活跃账号: 3                           │    │
│  └─────────────────────────────────────┘    │
│  [停止代理]  [重启代理]                      │
│                                             │
│  基本配置:                                   │
│  端口: [8045____] (1024-65535)              │
│  绑定地址: (●) 127.0.0.1  ( ) 0.0.0.0       │
│  自动启动: [✓]                               │
└─────────────────────────────────────────────┘
```

**Props**：
```typescript
interface ProxyControlPanelProps {
  status: ProxyStatus | null;
  config: ProxyConfig;
  onConfigChange: (config: Partial<ProxyConfig>) => void;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onRestart: () => Promise<void>;
}
```

#### 2.2.3 ModelMappingConfig.tsx (模型映射配置)

**UI 结构**：
```
┌─────────────────────────────────────────────┐
│  模型映射配置                    [+ 添加映射] │
│  ┌─────────────────────────────────────┐    │
│  │ claude-3-5-sonnet                    │    │
│  │ → Claude (claude-3-5-sonnet-20241...)│ ✏️ │
│  │ 别名: claude, sonnet                 │ 🗑️ │
│  │ 回退链: claude-3-opus → gemini-1.5... │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ gpt-4                                │    │
│  │ → OpenAI (gpt-4-turbo)              │ ✏️ │
│  │ 别名: gpt4                           │ 🗑️ │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**数据结构**：
```typescript
interface ModelMapping {
  source_model: string;              // 源模型名称
  target_provider: 'Claude' | 'Gemini' | 'OpenAI';
  target_model: string;              // 目标模型名称
  aliases: string[];                 // 别名列表
  fallback_chain: string[];          // 回退链
}
```

#### 2.2.4 StickySessionConfig.tsx (粘性会话配置)

**UI 结构**：
```
┌─────────────────────────────────────────────┐
│  粘性会话                          [✓] 启用  │
│  ┌─────────────────────────────────────┐    │
│  │ TTL: [3600____] 秒 (60-86400)       │    │
│  │ 清理策略:                            │    │
│  │   (●) 定时清理 (每 [300] 秒)         │    │
│  │   ( ) 内存阈值清理 ([100] MB)        │    │
│  │                                      │    │
│  │ 活跃会话: 42                         │    │
│  │ 内存占用: 15.3 MB                    │    │
│  │ [清空会话]                           │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 2.3 状态管理设计

#### 2.3.1 useProxyConfig Hook

```typescript
export function useProxyConfig() {
  const [config, setConfig] = useState<ProxyConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await proxyApi.getConfig();
      setConfig(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig: ProxyConfig) => {
    setLoading(true);
    try {
      await proxyApi.updateConfig(newConfig);
      setConfig(newConfig);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const updatePartial = async (partial: Partial<ProxyConfig>) => {
    if (!config) return { success: false };
    const newConfig = { ...config, ...partial };
    return await saveConfig(newConfig);
  };

  return {
    config,
    loading,
    error,
    loadConfig,
    saveConfig,
    updatePartial
  };
}
```

#### 2.3.2 useProxyStatus Hook

```typescript
export function useProxyStatus(enablePolling = true) {
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [loading, setLoading] = useState(false);

  // 轮询获取状态
  useEffect(() => {
    if (!enablePolling) return;

    const fetchStatus = async () => {
      try {
        const data = await proxyApi.getStatus();
        setStatus(data);
      } catch (err) {
        console.error('Failed to fetch status:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [enablePolling]);

  const start = async () => {
    setLoading(true);
    try {
      await proxyApi.start();
      // 状态会通过轮询自动更新
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const stop = async () => {
    setLoading(true);
    try {
      await proxyApi.stop();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const restart = async () => {
    setLoading(true);
    try {
      await proxyApi.restart();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    status,
    loading,
    start,
    stop,
    restart,
    refresh: () => {}, // 手动刷新（可选，因为有轮询）
  };
}
```

#### 2.3.3 useProxyWebSocket Hook (可选优化)

```typescript
export function useProxyWebSocket(enabled = true) {
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // 复用现有的 WebSocket 连接
    // 假设 WebSocket 已在全局建立
    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === 'proxy_status_update') {
        setStatus(data.payload);
      }
    };

    // 注册监听器（伪代码，实际需要适配现有 WS 架构）
    // wsRef.current.addEventListener('message', handleMessage);

    return () => {
      // wsRef.current?.removeEventListener('message', handleMessage);
    };
  }, [enabled]);

  return { status };
}
```

### 2.4 API 封装设计

#### proxyApi.ts

```typescript
import axios from 'axios';

const API_BASE = '/api/v1/proxy';

export const proxyApi = {
  // 状态 API
  getStatus: async (): Promise<ProxyStatus> => {
    const { data } = await axios.get(`${API_BASE}/status`);
    return data;
  },

  // 控制 API
  start: async (): Promise<void> => {
    await axios.post(`${API_BASE}/start`);
  },

  stop: async (): Promise<void> => {
    await axios.post(`${API_BASE}/stop`);
  },

  restart: async (): Promise<void> => {
    await axios.post(`${API_BASE}/restart`);
  },

  // 配置 API
  getConfig: async (): Promise<ProxyConfig> => {
    const { data } = await axios.get(`${API_BASE}/config`);
    return data;
  },

  updateConfig: async (config: ProxyConfig): Promise<void> => {
    await axios.put(`${API_BASE}/config`, config);
  },

  patchConfig: async (partial: Partial<ProxyConfig>): Promise<void> => {
    await axios.patch(`${API_BASE}/config`, partial);
  },

  // 导入导出 API
  exportConfig: async (): Promise<Blob> => {
    const { data } = await axios.post(`${API_BASE}/config/export`, {}, {
      responseType: 'blob'
    });
    return data;
  },

  importConfig: async (file: File): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);
    await axios.post(`${API_BASE}/config/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};
```

## 3. 后端设计

### 3.1 API 路由设计

#### handlers/proxy.rs (新增)

```rust
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    Router,
};
use serde::{Deserialize, Serialize};

// 代理状态结构
#[derive(Serialize, Deserialize)]
pub struct ProxyStatus {
    running: bool,
    port: u16,
    base_url: String,
    active_accounts: usize,
    active_sessions: Option<usize>,  // 粘性会话数（如果启用）
}

// 代理配置结构（复用现有）
// use crate::modules::config::ProxyConfig;

// 启动代理
pub async fn start_proxy(
    State(ctx): State<ServiceContext>,
) -> Result<Json<ApiResponse<()>>, ApiError> {
    // 调用现有的代理启动逻辑
    proxy_service::start().await?;

    // 通过 WebSocket 推送状态更新
    notify_proxy_status_change(&ctx).await;

    Ok(Json(ApiResponse::success(())))
}

// 停止代理
pub async fn stop_proxy(
    State(ctx): State<ServiceContext>,
) -> Result<Json<ApiResponse<()>>, ApiError> {
    proxy_service::stop().await?;
    notify_proxy_status_change(&ctx).await;
    Ok(Json(ApiResponse::success(())))
}

// 重启代理
pub async fn restart_proxy(
    State(ctx): State<ServiceContext>,
) -> Result<Json<ApiResponse<()>>, ApiError> {
    proxy_service::stop().await?;
    proxy_service::start().await?;
    notify_proxy_status_change(&ctx).await;
    Ok(Json(ApiResponse::success(())))
}

// 获取代理状态
pub async fn get_proxy_status() -> Result<Json<ProxyStatus>, ApiError> {
    let status = proxy_service::get_status().await?;
    Ok(Json(status))
}

// 获取代理配置
pub async fn get_proxy_config() -> Result<Json<ProxyConfig>, ApiError> {
    let config = config::load_proxy_config()?;
    Ok(Json(config))
}

// 更新代理配置（全量更新）
pub async fn update_proxy_config(
    Json(config): Json<ProxyConfig>,
) -> Result<Json<ApiResponse<()>>, ApiError> {
    config::save_proxy_config(&config)?;
    Ok(Json(ApiResponse::success(())))
}

// 部分更新代理配置
pub async fn patch_proxy_config(
    Json(partial): Json<serde_json::Value>,
) -> Result<Json<ApiResponse<()>>, ApiError> {
    let mut config = config::load_proxy_config()?;
    // 合并部分配置
    merge_config(&mut config, partial)?;
    config::save_proxy_config(&config)?;
    Ok(Json(ApiResponse::success(())))
}

// 导出配置
pub async fn export_config() -> Result<impl IntoResponse, ApiError> {
    let config = config::load_proxy_config()?;
    let json = serde_json::to_string_pretty(&config)?;

    Ok((
        StatusCode::OK,
        [("Content-Type", "application/json")],
        json,
    ))
}

// 导入配置
pub async fn import_config(
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<()>>, ApiError> {
    // 解析上传的文件
    while let Some(field) = multipart.next_field().await? {
        let data = field.bytes().await?;
        let config: ProxyConfig = serde_json::from_slice(&data)?;

        // 验证配置有效性
        validate_config(&config)?;

        // 保存配置
        config::save_proxy_config(&config)?;
        break;
    }

    Ok(Json(ApiResponse::success(())))
}

// 辅助函数：通知状态变更（通过 WebSocket）
async fn notify_proxy_status_change(ctx: &ServiceContext) {
    let status = proxy_service::get_status().await.ok();
    if let Some(status) = status {
        let message = WebSocketMessage {
            msg_type: "proxy_status_update".to_string(),
            payload: serde_json::to_value(&status).unwrap(),
        };
        // 广播给所有连接的客户端
        websocket::broadcast(message).await;
    }
}
```

### 3.2 路由注册

#### server.rs (修改)

```rust
// 在 start_server_with_context 函数中添加代理配置路由

let proxy_routes = Router::new()
    .route("/api/v1/proxy/start", post(handlers::proxy::start_proxy))
    .route("/api/v1/proxy/stop", post(handlers::proxy::stop_proxy))
    .route("/api/v1/proxy/restart", post(handlers::proxy::restart_proxy))
    .route("/api/v1/proxy/status", get(handlers::proxy::get_proxy_status))
    .route("/api/v1/proxy/config",
        get(handlers::proxy::get_proxy_config)
        .put(handlers::proxy::update_proxy_config)
        .patch(handlers::proxy::patch_proxy_config))
    .route("/api/v1/proxy/config/export", post(handlers::proxy::export_config))
    .route("/api/v1/proxy/config/import", post(handlers::proxy::import_config))
    .layer(axum_middleware::from_fn(middleware::auth_middleware));  // 需要认证

// 合并到主路由
let app = public_routes
    .merge(protected_routes)
    .merge(proxy_routes)  // 新增
    .layer(cors)
    .with_state(ws_state);
```

### 3.3 WebSocket 消息扩展

#### websocket.rs (修改)

```rust
// 在现有 WebSocket 处理中添加代理状态推送

#[derive(Serialize, Deserialize)]
pub struct WebSocketMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub payload: serde_json::Value,
}

// 新增消息类型处理
match message.msg_type.as_str() {
    "proxy_status_update" => {
        // 推送代理状态更新
        let status: ProxyStatus = serde_json::from_value(message.payload)?;
        // 广播给所有客户端
        broadcast_to_all(status).await;
    }
    // ... 其他消息类型
}
```

## 4. 数据模型设计

### 4.1 前端类型定义

#### types/proxy.ts

```typescript
export interface ProxyStatus {
  running: boolean;
  port: number;
  base_url: string;
  active_accounts: number;
  active_sessions?: number;  // 粘性会话数（可选）
}

export interface ProxyConfig {
  enabled: boolean;
  port: number;
  bind_address: string;  // "127.0.0.1" | "0.0.0.0"
  auto_start: boolean;

  // 模型映射
  custom_mapping: Record<string, string | string[]>;

  // 粘性会话配置
  sticky_session: {
    enabled: boolean;
    ttl: number;  // 秒
    cleanup_strategy: 'timer' | 'memory';
    cleanup_interval?: number;  // 定时清理间隔（秒）
    memory_threshold?: number;  // 内存阈值（MB）
  };

  // Token 管理器
  token_manager: {
    enabled: boolean;
    daily_limit: number;
    max_tokens_per_request: number;
  };

  // 高级设置
  timeout: number;  // 请求超时（秒）
  enable_logging: boolean;
  upstream_proxy?: string;  // 上游代理 URL

  // ZAI 集成
  zai: {
    enabled: boolean;
    base_url: string;
    api_key: string;
    model_mapping: Record<string, string>;
  };

  // 实验性功能
  experimental: {
    thinking_tokens: boolean;
  };
}

export interface ModelMapping {
  source_model: string;
  target_provider: 'Claude' | 'Gemini' | 'OpenAI';
  target_model: string;
  aliases: string[];
  fallback_chain: string[];
}
```

### 4.2 后端数据模型（Rust）

复用现有的 `AppConfig` 和 `ProxyConfig` 结构，无需新增。

## 5. UI/UX 设计规范

### 5.1 样式一致性

**颜色方案**（与 Web Admin 一致）：
- 主色：`blue-500` / `blue-600`
- 成功：`green-500` / `green-600`
- 警告：`yellow-500` / `yellow-600`
- 错误：`red-500` / `red-600`
- 深色主题：`bg-base-100`, `bg-base-200`, `bg-base-300`

**组件样式**：
- 卡片：`bg-white dark:bg-base-100 rounded-xl shadow-sm border`
- 按钮：DaisyUI `btn` 类
- 输入框：DaisyUI `input` 类
- 开关：DaisyUI `toggle` 类

### 5.2 交互规范

**状态指示器**：
- 运行中：绿色圆点 + "运行中" 文字
- 已停止：灰色圆点 + "已停止" 文字
- 启动中：加载动画 + "启动中" 文字

**错误提示**：
- 使用 Toast 组件显示错误
- 表单验证错误显示在输入框下方

**确认对话框**：
- 删除操作：使用 ModalDialog 确认
- 重置配置：使用 ModalDialog 确认
- 清空会话：使用 ModalDialog 确认

### 5.3 响应式布局

**桌面端（≥1024px）**：
- 单列布局
- 卡片宽度：100%，最大宽度 1200px
- 左右 padding：24px

**平板端（768px-1023px）**：
- 单列布局
- 左右 padding：16px
- 字体略小

## 6. 性能优化策略

### 6.1 前端优化

1. **懒加载**：
   - 按需加载大型组件（如模型映射编辑器）
   - 使用 React.lazy() 和 Suspense

2. **防抖/节流**：
   - 配置输入框使用防抖（debounce 500ms）
   - 状态轮询使用节流（throttle 3000ms）

3. **虚拟滚动**：
   - 如果模型映射规则超过 50 条，使用虚拟滚动

4. **缓存策略**：
   - 缓存模型列表（本地存储）
   - 配置更改前后对比，仅发送变更部分（PATCH）

### 6.2 后端优化

1. **批量更新**：
   - 使用 PATCH API 仅更新变更字段
   - 减少配置文件 I/O 次数

2. **WebSocket 优化**：
   - 仅在状态实际变更时推送
   - 节流推送频率（最多 1 次/秒）

3. **配置验证**：
   - 前端验证 + 后端二次验证
   - 避免无效配置写入

## 7. 安全性设计

### 7.1 认证授权

- 所有代理配置 API 需要 JWT 认证
- 仅管理员用户可访问（复用现有中间件）

### 7.2 敏感数据保护

**加密存储**：
- ZAI API Key 使用现有加密机制存储
- 上游代理密码（如有）加密存储

**导出脱敏**：
- 导出配置时提示包含敏感信息
- 可选：导出时移除敏感字段

### 7.3 输入验证

**端口验证**：
- 范围：1024-65535
- 类型：整数

**URL 验证**：
- 格式：http:// 或 https://
- 防止 SSRF 攻击

**配置导入验证**：
- JSON 格式验证
- 字段类型验证
- 业务逻辑验证（如循环依赖检测）

## 8. 测试策略

### 8.1 前端测试

**单元测试**（Jest + React Testing Library）：
- 所有组件的渲染测试
- Hook 的逻辑测试
- API 封装的模拟测试

**集成测试**：
- 配置保存流程测试
- 代理启动/停止流程测试
- WebSocket 状态更新测试

### 8.2 后端测试

**单元测试**（Rust）：
- API handler 测试
- 配置验证逻辑测试

**集成测试**：
- 完整的 API 调用流程测试
- 配置持久化测试

### 8.3 E2E 测试（可选）

- 使用 Playwright 测试完整用户流程
- 覆盖核心场景（P0 功能）

## 9. 部署和迁移策略

### 9.1 版本兼容性

**配置版本号**：
- 在配置文件中添加 `version` 字段
- 支持配置迁移（v1 → v2）

**API 版本控制**：
- 使用 `/api/v1/proxy/*` 路由
- 为未来版本预留 `/api/v2/*`

### 9.2 数据迁移

**从桌面端迁移**：
- 提供配置导入功能
- 自动检测配置格式版本

**平滑升级**：
- 旧版 Web Admin 配置兼容新版
- 缺失字段使用默认值

## 10. 分阶段实施计划

### Phase 1: MVP（核心功能）

**前端**：
- ProxyControlPanel（代理控制）
- 基本模型映射配置（增删改查）
- 端口和绑定地址配置
- 实时状态显示

**后端**：
- `/api/v1/proxy/start|stop|restart`
- `/api/v1/proxy/status`
- `/api/v1/proxy/config` (GET/PUT)

**预计工作量**：前端 3-5 天，后端 2-3 天

### Phase 2: 完整功能

**前端**：
- FallbackChainEditor（回退链）
- StickySessionConfig（粘性会话）
- AdvancedSettings（高级设置）
- ConfigImportExport（配置导入导出）

**后端**：
- `/api/v1/proxy/config` (PATCH)
- `/api/v1/proxy/config/export|import`
- WebSocket 状态推送

**预计工作量**：前端 4-6 天，后端 2-3 天

### Phase 3: 高级功能

**前端**：
- TokenManagerConfig
- ZAI 集成配置
- 实验性功能开关

**后端**：
- ZAI API 集成（如需要）
- Token 管理逻辑

**预计工作量**：前端 2-3 天，后端 1-2 天

## 11. 风险和缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 桌面端组件复用困难 | 中 | 抽象数据层，保持 UI 结构一致 |
| WebSocket 推送延迟 | 低 | 提供手动刷新兜底，轮询作为备选 |
| 配置冲突导致代理异常 | 高 | 严格前后端验证，提供配置回滚 |
| API 性能问题 | 中 | 使用 PATCH 减少传输量，批量更新 |
| 浏览器兼容性 | 低 | 针对主流浏览器测试（Chrome/Edge/Firefox） |

## 12. 附录

### 12.1 关键文件清单

**前端新增**：
- `src/admin/pages/ProxyConfigPage.tsx`
- `src/admin/components/ProxyConfig/*.tsx` (7个组件)
- `src/admin/hooks/useProxyConfig.ts`
- `src/admin/hooks/useProxyStatus.ts`
- `src/admin/api/proxyApi.ts`
- `src/admin/types/proxy.ts`

**后端新增**：
- `src-tauri/src/modules/web_admin/handlers/proxy.rs`

**后端修改**：
- `src-tauri/src/modules/web_admin/server.rs` (添加路由)
- `src-tauri/src/modules/web_admin/websocket.rs` (扩展消息类型)

### 12.2 参考文档

- 桌面端源码：`src/pages/ApiProxy.tsx`
- Web Admin 现有页面：`src/admin/pages/ProxyPage.tsx`
- 需求文档：`docs/dev/web-admin-proxy/web-admin-proxy-requirements.md`
- 简报文档：`docs/dev/web-admin-proxy/web-admin-proxy-brief.md`

---

**设计审核**：待用户确认
**下一步**：生成任务拆分文档（tasks.md）
