# 技术设计: 模型级联降级 (Model Fallback Chain)

> **版本**: 1.0
> **状态**: Draft
> **生成日期**: 2026-01-10

## 1. 系统架构概览

本功能旨在增强系统的鲁棒性，通过引入"一对多"的模型映射机制，实现自动故障转移。当首选模型不可用（429/5xx）时，系统将无缝切换到备选模型。

### 核心变更点
1.  **配置层**: `ProxyConfig.custom_mapping` 数据结构升级，支持 `String` 或 `Vec<String>` 的混合反序列化。
2.  **路由层**: 新增 `resolve_model_chain` 接口，解析完整的模型尝试序列。
3.  **执行层**: `handle_chat_completions` 等处理器的重试循环逻辑重构，支持按序切换模型。
4.  **UI 层**: 新增模型列表构建器组件，支持拖拽排序。

---

## 2. 详细设计

### 2.1 配置数据结构 (Backend)

文件: `src-tauri/src/proxy/config.rs`

目前 `custom_mapping` 定义为 `HashMap<String, String>`。需修改为兼容单字符串和字符串数组的结构。

为了保持向前兼容性，我们将使用自定义的反序列化逻辑。

```rust
use serde::{Deserialize, Deserializer, Serialize, Serializer};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ModelMappingTarget {
    Single(String),
    Chain(Vec<String>),
}

// 辅助方法：统一转为 Vec<String>
impl ModelMappingTarget {
    pub fn to_chain(&self) -> Vec<String> {
        match self {
            ModelMappingTarget::Single(s) => vec![s.clone()],
            ModelMappingTarget::Chain(v) => v.clone(),
        }
    }
}

// 在 ProxyConfig 中
pub struct ProxyConfig {
    // ...
    #[serde(default)]
    pub custom_mapping: std::collections::HashMap<String, ModelMappingTarget>,
    // ...
}
```

**注意**: 直接修改 `ProxyConfig` 的字段类型可能会破坏其他依赖代码。需要全面检查 `custom_mapping` 的引用点。
主要引用点在 `src-tauri/src/proxy/common/model_mapping.rs` 和 `src-tauri/src/models/config.rs` (如果有)。
以及前端读取配置的地方。

### 2.2 路由解析逻辑 (Routing Logic)

文件: `src-tauri/src/proxy/common/model_mapping.rs`

现有的 `resolve_model_route` 返回 `String`。我们需要新增 `resolve_model_chain`。

```rust
pub fn resolve_model_chain(
    original_model: &str,
    custom_mapping: &HashMap<String, ModelMappingTarget>,
) -> Vec<String> {
    // 1. 精确匹配
    if let Some(target) = custom_mapping.get(original_model) {
        return target.to_chain();
    }

    // 2. 通配符匹配 (需遍历)
    for (pattern, target) in custom_mapping.iter() {
        if pattern.contains('*') && wildcard_match(pattern, original_model) {
            return target.to_chain();
        }
    }

    // 3. 默认映射 (作为单元素链)
    vec![map_claude_model_to_gemini(original_model)]
}
```

为了兼容现有代码，可以保留 `resolve_model_route` 但让其返回链的第一个元素 (Primary Model)。

### 2.3 执行层重构 (Execution Layer)

文件: `src-tauri/src/proxy/handlers/openai.rs` (以及其他 handler)

目前的重试逻辑是：
```rust
let max_attempts = MAX_RETRY_ATTEMPTS.min(pool_size).max(1);
for attempt in 0..max_attempts {
    let mapped_model = resolve_model_route(...); // 每次都在解析，但之前是一样的
    // ...
}
```

新的逻辑：
```rust
// 1. 解析完整的模型链
let model_chain = resolve_model_chain(&openai_req.model, ...);
// 确保至少有一次尝试 (即使链为空，也应该fallback到默认? resolve_model_chain 保证非空)

// 2. 确定总尝试次数
// 策略：如果链长度 > MAX_RETRY_ATTEMPTS (3)，则扩展尝试次数以覆盖所有模型。
// 或者保留 MAX_RETRY_ATTEMPTS 作为"账号轮换/网络重试"的限制，而模型切换是另一维度的？
// 需求指出： "IF 所有模型均尝试失败... 返回最后一个"
// 建议策略：
// loop_limit = max(MAX_RETRY_ATTEMPTS, model_chain.len());
// current_model = model_chain[attempt_index % model_chain.len()] ?
// 不，这会导致 A -> B -> A。
// 正确逻辑：
// 尝试序列应该是：ModelA (Account1) -> ModelA (Account2) -> ModelB (Account1) ...
// 但为了简单和符合"快速降级"的目标，我们优先切换模型而不是死磕一个模型的不同账号（除非是429 Quota Exhausted，这时候换账号更有效）。
//
// 混合策略：
// outer_loop: iterate models in chain
//   inner_loop: try standard retry/account rotation (e.g. up to 2 times per model?)
//
// 鉴于当前架构是单层循环 `for attempt in 0..max_attempts`，我们可以调整为：
// `let model_to_use = model_chain.get(attempt).unwrap_or(model_chain.last().unwrap());`
// 这样前 N 次尝试会依次使用链中的模型。如果尝试次数超过链长度，后续重试将一直使用最后一个模型（Fallthrough）。

let max_attempts = MAX_RETRY_ATTEMPTS.max(model_chain.len());

for attempt in 0..max_attempts {
    // 决定当前使用的模型
    // 如果 attempt < chain.len(), 用 chain[attempt]
    // 否则用 chain.last()
    let current_model_index = if attempt < model_chain.len() { attempt } else { model_chain.len() - 1 };
    let mapped_model = &model_chain[current_model_index];

    // ... 后续逻辑 (获取Token, 发送请求) ...

    // 错误处理调整
    // 遇到 429/5xx 时，continue 会进入下一次循环 -> 自动切换到下一个模型 (如果还在链范围内)
}
```

### 2.4 前端 UI 设计

文件:
- `src/components/Settings/ModelMapping.tsx` (假设存在)
- `src/utils/config.ts`

需要更新配置类型的定义，支持 string | string[]。
新增组件 `MappingListBuilder`:
- 展示当前模型列表。
- "Add Fallback" 按钮。
- 列表项支持删除。
- 拖拽排序 (使用 `dnd-kit` 或简单上下移动按钮)。

---

## 3. 接口变更

### 3.1 Rust Structs

`ProxyConfig`:
```rust
// Changed
custom_mapping: HashMap<String, ModelMappingTarget>
```

### 3.2 API Response

API 响应头 `X-Mapped-Model` 将显示实际使用的那个模型。
日志中需明确记录降级事件：`Fallback triggered: {prev_model} -> {new_model} due to {status}`。

---

## 4. 任务拆解 (Phase 3 预备)

1.  **后端核心**: 修改 `ProxyConfig` 和 `model_mapping` 模块，支持列表结构。
2.  **后端逻辑**: 更新 `handlers/openai.rs` 等实现链式重试。
3.  **前端适配**: 更新前端类型定义和配置读取/保存逻辑。
4.  **前端UI**: 实现列表构建器界面。
5.  **测试**: 添加单元测试覆盖配置解析和降级逻辑。

## 5. 风险评估

- **循环降级**: 配置 A->B, B->A 会导致死循环吗？
  - `resolve_model_chain` 解析的是"针对 A 的链"。如果配置 A->[B], B->[A]。
  - 用户请求 A -> 解析出 [B]。用户请求 B -> 解析出 [A]。
  - 在一次请求中，我们只解析一次。如果 Chain 是 `[A, B]`，我们试 A，然后试 B。不会再去查 B 的映射。
  - 风险低。
- **配置兼容性**: 旧版配置文件是 `{"k":"v"}`，新版读入时必须不出错。
  - 使用 `#[serde(untagged)]` Enum 可完美解决。

## 6. 安全与隐私

- 无新增外部依赖。
- 降级过程在本地决策，不泄露信息。
