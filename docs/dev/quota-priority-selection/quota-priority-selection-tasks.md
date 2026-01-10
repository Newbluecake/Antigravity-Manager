# 任务拆分: 配额优先选择策略

> **状态**: Draft
> **作者**: Antigravity
> **日期**: 2026-01-10

## 1. 任务概览

| 任务ID | 任务名称 | 依赖关系 | 复杂度 | 预估工时 |
|--------|----------|----------|--------|----------|
| T-001 | 配置模型更新 | - | Simple | 10m | ✅ |
| T-002 | 排序与选择逻辑实现 | T-001 | Standard | 40m | ✅ |
| T-003 | 单元测试覆盖 | T-002 | Standard | 30m | ✅ |

## 2. 详细任务描述

### T-001: 配置模型更新

**目标**: 在配置系统中支持 `quota_priority_enabled` 开关。

**文件**:
- `src-tauri/src/proxy/config.rs`

**步骤**:
1. 修改 `ProxyConfig` 结构体，添加 `pub quota_priority_enabled: bool`。
2. 添加 `#[serde(default)]` 属性，确保默认为 `false`。
3. 验证 `AppConfig` 是否能正确加载此字段 (无需修改代码，只需确认结构)。

**验收标准**:
- `ProxyConfig::default()` 返回的 `quota_priority_enabled` 为 `false`。
- 可以从 JSON 配置文件中读取 `quota_priority_enabled: true`。

### T-002: 排序与选择逻辑实现

**目标**: 修改 `TokenManager` 核心逻辑，实现基于配额的排序和贪婪选择。

**文件**:
- `src-tauri/src/proxy/token_manager.rs`

**步骤**:
1. 修改 `get_token_internal` 中的 `sort_by` 逻辑：
   - 保留一级排序：订阅等级 (ULTRA > PRO > FREE)。
   - 添加二级排序：当 `quota_priority_enabled` 为 true 时，按 `model_quotas` 中目标模型的剩余配额升序排列 (0.1 -> 0.9)。
   - 处理缺失配额情况：视为最大值 (f64::MAX) 排在最后。
2. 修改选择循环逻辑：
   - 获取 `quota_priority_enabled` 配置。
   - 如果启用：强制 `start_idx = 0` (贪婪模式)，不再使用 `current_index`。
   - 如果禁用：保持 `current_index` (轮询模式)。
3. 添加日志记录：
   - 选中账号时记录 DEBUG 日志，包含配额百分比。
   - 确保 `[QuotaPriority]` 前缀用于相关日志。

**验收标准**:
- 排序逻辑正确：同等级下，低配额排在前面。
- 选择行为正确：启用时总是尝试第一个可用账号；禁用时轮询。
- 现有功能（限流检查、粘性会话）不受影响。

### T-003: 单元测试覆盖

**目标**: 编写并通过所有相关的单元测试。

**文件**:
- `src-tauri/src/proxy/token_manager.rs` (添加测试模块)

**步骤**:
1. 实现 `test_sort_order_with_quota`: 验证排序算法。
2. 实现 `test_priority_selection_flow`: 模拟多次调用，验证总是选中同一个低配额账号（直到其配额变化或被限流）。
3. 实现 `test_config_toggle`: 验证开关关闭时恢复轮询。
4. 实现 `test_fallback_unknown_quota`: 验证无配额数据的账号排在最后。

**验收标准**:
- 所有新测试通过。
- 现有的 `tests/token_manager_test.rs` (如果有) 依然通过。
