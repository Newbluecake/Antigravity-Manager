# 任务拆分: 模型级联降级 (Model Fallback Chain)

> **版本**: 1.0
> **状态**: Completed
> **生成日期**: 2026-01-10
> **关联设计**: docs/dev/model-fallback-chain/model-fallback-chain-design.md

## 1. 任务概览

本功能涉及 Rust 后端配置结构变更、核心路由逻辑重构以及前端 React UI 的列表构建器开发。任务将分为 3 个批次执行。

| 批次 | 关注点 | 包含任务 | 依赖关系 |
|------|--------|----------|----------|
| Batch 1 | 后端核心架构 | B-001, B-002, B-003 | 无 |
| Batch 2 | 降级逻辑实施 | B-004, B-005 | 依赖 Batch 1 |
| Batch 3 | 前端可视化 | F-001, F-002, F-003 | 可并行 |

---

## 2. 详细任务列表

### Batch 1: 后端核心架构

#### Task B-001: 重构 ProxyConfig 支持混合类型映射 [Completed]
- **文件**: `src-tauri/src/proxy/config.rs`
- **描述**:
  1. 定义 `ModelMappingTarget` 枚举 (Untagged Enum)，支持 `Single(String)` 和 `Chain(Vec<String>)`。
  2. 修改 `ProxyConfig.custom_mapping` 类型为 `HashMap<String, ModelMappingTarget>`。
  3. 为 `ModelMappingTarget` 实现辅助方法 `to_chain() -> Vec<String>`。
- **验证**: `cargo check` 通过，能正确反序列化旧版配置（单字符串）和新版配置（数组）。

#### Task B-002: 实现链式路由解析逻辑 [Completed]
- **文件**: `src-tauri/src/proxy/common/model_mapping.rs`
- **描述**:
  1. 实现 `resolve_model_chain(original, mapping) -> Vec<String>`。
  2. 逻辑：精确匹配 > 通配符匹配 > 默认映射。
  3. 确保返回值永远非空（至少包含默认映射）。
- **验证**: 单元测试覆盖各种匹配情况。

#### Task B-003: 核心单元测试 [Completed]
- **文件**: `src-tauri/src/proxy/tests/model_chain_tests.rs` (新建)
- **描述**:
  1. 测试 `{"gpt-4": "model-a"}` 解析为 `["model-a"]`。
  2. 测试 `{"gpt-4": ["model-a", "model-b"]}` 解析为 `["model-a", "model-b"]`。
  3. 测试通配符 `gpt-4*` -> `["gemini-pro"]`。
- **验证**: `cargo test` 通过。

---

### Batch 2: 降级逻辑实施

#### Task B-004: OpenAI Handler 降级支持 [Completed]
- **文件**: `src-tauri/src/proxy/handlers/openai.rs`
- **描述**:
  1. 在 `handle_chat_completions` 中，使用 `resolve_model_chain` 获取模型列表。
  2. 重构重试循环：`max_attempts = max(3, chain.len())`。
  3. 循环内根据 `attempt` 索引选择模型：`chain.get(i).unwrap_or(chain.last())`。
  4. 确保 `X-Mapped-Model` 响应头返回实际使用的模型。
  5. 记录降级日志：`WARN [Fallback] Switching model A -> B due to error 500`.
- **验证**: 模拟 500 错误，观察日志是否切换模型。

#### Task B-005: Claude Handler 降级支持 [Completed]
- **文件**: `src-tauri/src/proxy/handlers/claude.rs`
- **描述**:
  1. 同步修改 `handle_messages`。
  2. 注意：Claude Handler 有特殊的 Thinking 签名重试逻辑，需确保不冲突（Thinking 重试通常针对同一模型，但如果降级模型不支持 Thinking，需自动剥离）。
  3. 策略：如果降级后的模型不支持 Thinking（配置决定？），代码需动态处理。本期简化处理：假设用户配置的降级链模型能力兼容。
- **验证**: 模拟 429 错误，验证 Claude 降级流程。

---

### Batch 3: 前端可视化

#### Task F-001: 前端类型定义更新 [Completed]
- **文件**: `src/types/config.ts` (假设), `src/utils/config.ts`
- **描述**:
  1. 更新 `CustomMapping` 类型定义为 `Record<string, string | string[]>`。
  2. 检查所有引用点，确保 `typeof value === 'string'` 的判断逻辑兼容数组。

#### Task F-002: 开发 MappingListBuilder 组件 [Completed]
- **文件**: `src/components/Settings/MappingListBuilder.tsx`
- **描述**:
  1. 输入框：原始模型 ID。
  2. 列表区域：展示目标模型链。
  3. 操作：
     - "Add Candidate": 添加备选模型。
     - 拖拽排序（使用 dnd-kit 或简单上下箭头）。
     - 删除按钮。
  4. 输出：更新父组件的 Form State。

#### Task F-003: 集成到设置页 [Completed]
- **文件**: `src/components/Settings/ModelMapping.tsx`
- **描述**:
  1. 替换原有的简单的 Key-Value 输入框。
  2. 支持检测当前值类型：如果是字符串，显示为单项列表；如果是数组，显示多项。
  3. 保存时，如果列表仅一项，自动转为字符串（保持 `config.json` 简洁），多项则存为数组。
- **验证**: 启动应用，进入设置页，配置一个多级降级，保存并重启，验证配置持久化成功。

---

## 3. 验收标准

1. **配置兼容性**: 旧配置文件加载时不报错，功能正常。
2. **自动降级**: 手动 Mock 一个 500 错误（或断网），系统自动尝试链中下一个模型并成功返回。
3. **UI 易用性**: 用户能直观地理解“降级链”概念并进行配置。

## 4. 风险控制

- **循环依赖**: 确保 `resolve_model_chain` 不会产生无限递归（本次设计不涉及递归查找，只查一次 Map，无风险）。
- **超时累积**: 如果链条有 5 个模型，每个超时 10s，用户等待 50s。
  - **缓解**: 保持默认超时设置，但在 UI 提示用户“建议链条不超过 3 个”。
