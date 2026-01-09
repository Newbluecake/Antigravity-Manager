# 需求文档: 模型级联降级 (Model Fallback Chain)

> **生成方式**: 由 /dev:clarify 自动生成
> **生成时间**: 2026-01-10
> **访谈轮次**: 第 3 轮
> **细节级别**: standard
> **可直接用于**: /dev:spec-dev model-fallback-chain --skip-requirements

## 1. 介绍

当前系统的模型映射是一对一的（如 `gpt-4` -> `gpt-4-0613`）。本功能将引入“一对多”的链式映射机制，允许用户为某个模型 ID 配置一个备选模型列表。在请求处理过程中，如果首选模型遭遇特定错误（429/5xx等），系统将自动按顺序尝试列表中的后续模型，直到请求成功或列表耗尽。

**目标用户**:
- 对 API 可用性要求极高的开发者和企业用户。

**核心价值**: 通过自动故障转移（Failover）显著降低 API 调用失败率，提升系统鲁棒性。

## 2. 需求与用户故事

### 需求 1: 链式降级执行 (Sequential Fallback Execution)
**用户故事:** As a user, I want the system to try alternative models automatically when the primary model fails, so that my request can succeed even if the primary model is down.

#### 验收标准（可测试）
- **WHEN** 发起请求且首选模型返回 429/5xx/40x/网络错误, **THEN** 系统 **SHALL** 捕获异常并不向客户端返回错误。
- **THEN** 系统 **SHALL** 检查配置的映射链，提取下一个备选模型。
- **THEN** 系统 **SHALL** 使用新模型重新发起请求（无需重试上一模型）。
- **IF** 所有模型均尝试失败, **THEN** 系统 **SHALL** 返回最后一个模型的错误响应。

### 需求 2: 混合配置兼容 (Hybrid Config Compatibility)
**用户故事:** As a developer, I want the system to support both string and array formats for model mapping, so that existing configuration files don't break.

#### 验收标准（可测试）
- **WHEN** 加载旧版配置 `{"gpt-4": "gpt-4-0613"}`, **THEN** 系统 **SHALL** 将其视为 `{"gpt-4": ["gpt-4-0613"]}`。
- **WHEN** 加载新版配置 `{"gpt-4": ["gpt-4-0613", "gpt-3.5"]}`, **THEN** 系统 **SHALL** 识别为降级链。

### 需求 3: 可视化列表构建 (Visual List Builder)
**用户故事:** As a user, I want a UI to easily manage the list of fallback models, so that I don't have to manually edit JSON files.

#### 验收标准（可测试）
- **WHEN** 在设置页编辑模型映射, **THEN** 用户 **SHALL** 能看到列表构建器。
- **THEN** 用户 **SHALL** 能添加新模型、删除模型、拖拽调整优先级顺序。

## 3. 测试映射表

| 验收条目 | 测试层级 | 预期测试文件 | 预期函数/用例 |
|----------|----------|--------------|---------------|
| 需求1: 429触发降级 | unit | src-tauri/src/proxy/chain.rs | test_fallback_on_429 |
| 需求1: 链条耗尽返回最后错误 | unit | src-tauri/src/proxy/chain.rs | test_fallback_exhaustion |
| 需求2: 字符串配置兼容加载 | unit | src-tauri/src/models/config.rs | test_load_mixed_mapping_config |

## 4. 功能验收清单

| ID | 功能点 | 验收步骤 | 优先级 | 关联任务 | 通过 |
|----|--------|----------|--------|----------|------|
| F-001 | 映射链配置解析 | 1. 配置文件写入混合格式 2. 启动应用 3. 预期：无报错，内存中正确加载为列表 | P0 | 待分配 | ☐ |
| F-002 | 自动故障转移 | 1. 映射 A -> [B, C] 2. 模拟 B 返回 500 3. 预期：自动请求 C 并返回成功 | P0 | 待分配 | ☐ |
| F-003 | 列表构建器UI | 1. 点击添加模型 2. 输入模型名 3. 拖拽改变顺序 4. 保存 5. 预期：配置文件更新为数组格式 | P0 | 待分配 | ☐ |
| F-004 | 降级日志 | 1. 触发降级 2. 查看日志 3. 预期：包含 "Fallback triggered: B -> C due to 500" | P1 | 待分配 | ☐ |

## 5. 技术约束与要求

### 5.1 技术栈
- **后端**: Rust (Tauri) - 需修改 `ProxyConfig` 结构体和 `get_token`/请求逻辑。
- **前端**: React + TypeScript - 需要新的 `ModelListBuilder` 组件。

### 5.2 数据存储
- **配置文件**: `config.json` 中的 `proxy.custom_mapping` 字段。
- **类型定义**: 从 `Record<String, String>` 迁移至 `Record<String, Vec<String>>` (逻辑上，serde需做兼容处理)。

### 5.3 性能要求
- 降级过程增加的延迟应仅为（失败请求耗时 + 逻辑处理耗时），不应引入额外等待。

## 6. 排除项（明确不做）

- **不做**: 客户端响应头反馈（x-model-used）。
- **不做**: 复杂的权重轮询（Weighted Round-Robin）。
- **不做**: 对非 429/5xx/40x/NetErr 错误的降级（如 400 BadRequest 不应降级，因为换个模型也大概率报错）。

## 7. 风险与挑战

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 递归死循环 | 中 | 降级链中不应包含自身或形成环（A->B->A）。需在解析或执行时做检测。 |
| 请求超时堆积 | 中 | 如果链条过长（如10个），客户端可能先超时。建议UI限制链条长度（如最多5个）。 |

## 8. 相关文档

- **简报版本**: docs/dev/model-fallback-chain/model-fallback-chain-brief.md
- **访谈记录**: 由 /dev:clarify 生成于 2026-01-10

## 9. 下一步行动

### 方式1：使用 spec-dev 继续（推荐）

在新会话中执行：
```bash
/dev:spec-dev model-fallback-chain --skip-requirements
```
