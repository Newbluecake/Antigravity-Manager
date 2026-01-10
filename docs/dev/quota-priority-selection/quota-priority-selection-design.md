# 技术设计: 配额优先选择策略

> **状态**: Draft
> **作者**: Antigravity
> **日期**: 2026-01-10

## 1. 架构概述

本设计旨在修改 `TokenManager` 的账号选择逻辑，使其在满足订阅等级优先（ULTRA > PRO > FREE）的前提下，优先选择剩余配额百分比最低的账号。这是一种"贪婪回收"策略，旨在尽快消耗低额度账号，防止浪费。

### 1.1 核心变更点

1.  **配置扩展**: 在 `AppConfig` 或 `ProxyConfig` 中新增 `quota_priority_enabled` 开关。
2.  **排序算法**: 在 `TokenManager::get_token_internal` 中，修改现有的排序逻辑，引入配额百分比作为二级排序键。
3.  **选择逻辑**: 调整轮询逻辑，不再是简单的 Round-Robin，而是基于排序后的列表顺序选择（配合 Filter）。

## 2. 详细设计

### 2.1 配置模型变更

在 `src-tauri/src/proxy/config.rs` 的 `ProxyConfig` 结构体中添加字段。

```rust
// src-tauri/src/proxy/config.rs

pub struct ProxyConfig {
    // ... 现有字段

    /// 是否启用配额优先策略 (默认 false)
    #[serde(default)]
    pub quota_priority_enabled: bool,
}
```

注意：`AppConfig` 包含 `ProxyConfig`，所以只需修改 `ProxyConfig` 即可。

### 2.2 TokenManager 逻辑变更

#### 2.2.1 排序逻辑升级

当前逻辑：
```rust
tokens_snapshot.sort_by(|a, b| {
    tier_priority(&a.subscription_tier).cmp(&tier_priority(&b.subscription_tier))
});
```

新逻辑（伪代码）：
```rust
tokens_snapshot.sort_by(|a, b| {
    // 1. 一级排序：订阅等级
    let tier_cmp = tier_priority(&a.subscription_tier).cmp(&tier_priority(&b.subscription_tier));
    if tier_cmp != Ordering::Equal {
        return tier_cmp;
    }

    // 2. 二级排序：配额百分比 (仅当启用配置且 model_name 存在时)
    if quota_priority_enabled {
        if let Some(model) = model_name {
            let quota_a = a.model_quotas.get(model).unwrap_or(&f64::MAX); // 未知配额排在最后
            let quota_b = b.model_quotas.get(model).unwrap_or(&f64::MAX);

            // 升序排列：越小越优先
            // f64 比较需要处理 NaN，这里简单处理
            return quota_a.partial_cmp(quota_b).unwrap_or(Ordering::Equal);
        }
    }

    Ordering::Equal
});
```

#### 2.2.2 选择策略调整

修改 `get_token_internal` 中的循环逻辑。

**当前行为 (Round-Robin)**:
- 使用 `current_index` 原子计数器计算 `start_idx`。
- 从 `start_idx` 开始遍历。

**新行为 (Priority Selection)**:
- 如果 `quota_priority_enabled` 为 `true`:
  - `start_idx` 始终为 0 (总是从排序后的第一个，即配额最低的开始尝试)。
  - 忽略 `current_index` 的自增。
  - **风险**: 如果第一个账号总是失败（例如网络问题但未被识别为限流），可能会阻塞。
  - **缓解**: 现有的限流检查 (`is_rate_limited`) 和失败重试机制应该能处理。如果账号 A 失败，会被标记限流，下次调用时 `is_rate_limited` 为 true，自然跳过。

- 如果 `quota_priority_enabled` 为 `false`:
  - 保持原有的 Round-Robin 逻辑。

### 2.3 日志增强

在选择成功和降级时添加详细日志。

```rust
// 选中账号时
tracing::debug!("[QuotaPriority] Selected account {} (tier: {:?}, quota: {:.2}%)",
    email, tier, percentage * 100.0);

// 降级时 (原有逻辑已有，需优化格式)
tracing::warn!("[QuotaPriority] All accounts below threshold. Falling back to account {} ...", ...);
```

## 3. 接口定义

无外部 API 变更。仅内部 Rust 方法逻辑调整。

## 4. 数据流图

```mermaid
graph TD
    A[Request] --> B{Quota Priority Enabled?}
    B -- No --> C[Sort by Tier Only]
    C --> D[Round Robin Selection]
    B -- Yes --> E[Sort by Tier + Quota(Asc)]
    E --> F[Greedy Selection (Always pick first available)]

    D --> G{Is Valid?}
    F --> G

    G -- Yes --> H[Return Token]
    G -- No --> I[Next Candidate]

    I --> G
```

## 5. 测试计划

### 5.1 单元测试 (`src-tauri/src/proxy/token_manager.rs`)

1.  `test_sort_order_with_quota`: 验证排序逻辑正确性。
2.  `test_fallback_unknown_quota`: 验证无配额数据的账号排在最后。
3.  `test_priority_selection_flow`: 模拟多次调用，验证总是选择配额最低的（而非轮询）。
4.  `test_config_disable`: 验证关闭开关后恢复轮询行为。

### 5.2 集成测试

由于主要逻辑在 `TokenManager` 内部，集成测试主要关注配置加载和端到端调用是否正常，这部分可以通过现有的测试覆盖。

## 6. 兼容性说明

- **粘性会话**: 粘性会话逻辑在排序之前/之外处理。如果会话已绑定，直接使用绑定账号，跳过排序选择。这符合需求。
- **配置兼容性**: 新增字段 `default = false`，不破坏现有配置。
