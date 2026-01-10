# 需求文档: 配额优先选择策略

> **生成方式**: 由 /dev:clarify 自动生成
> **生成时间**: 2026-01-10
> **访谈轮次**: 第 2 轮
> **细节级别**: standard
> **可直接用于**: /dev:spec-dev quota-priority-selection --skip-requirements

## 1. 介绍

在 AI 模型调用系统中，优先选择剩余配额百分比最低的账号进行 API 调用，以快速消耗低额度账户，实现配额回收优化。

**目标用户**:
- 主要用户：系统管理员、运维人员（管理多个 AI 账号）
- 次要用户：使用 Antigravity-Manager 代理服务的终端用户

**核心价值**:
- 防止低配额账号浪费（特别是即将过期的配额）
- 加速低额度账户的配额消耗，便于账户回收或关闭
- 在多供应商（Claude/OpenAI/其他）混合环境中实现智能配额管理

## 2. 需求与用户故事

### 需求 1: 基于百分比剩余配额优先选择账号
**用户故事:** As a system administrator, I want the system to prioritize accounts with the lowest remaining quota percentage, so that I can consume low-quota accounts quickly and reclaim resources.

#### 验收标准（可测试）
- **WHEN** 系统需要选择账号进行 API 调用 **AND** 有多个可用账号（未限流、未锁定）, **THEN** 系统 **SHALL** 按照 `model_quotas` 中目标模型的剩余百分比从低到高排序账号。
- **WHEN** 排序后，**THEN** 系统 **SHALL** 优先选择剩余配额百分比最低的账号（第一个）。
- **IF** 目标模型的配额数据不存在于某账号的 `model_quotas` 中, **THEN** 系统 **SHALL** 将该账号视为配额未知，排在已知配额账号之后（降级到兜底选择）。

### 需求 2: 保持订阅等级优先级
**用户故事:** As a system, I want to respect the existing subscription tier priority (ULTRA > PRO > FREE), so that high-tier accounts are still preferred within the same quota range.

#### 验收标准（可测试）
- **WHEN** 选择账号时, **THEN** 系统 **SHALL** 先按订阅等级分组（ULTRA / PRO / FREE / Unknown）。
- **WHEN** 在同一订阅等级内, **THEN** 系统 **SHALL** 按剩余配额百分比从低到高排序。
- **WHEN** 最终选择时, **THEN** 系统 **SHALL** 优先从 ULTRA 组中选择配额最低的账号，若 ULTRA 组无可用账号则降级到 PRO 组，以此类推。

### 需求 3: 失败时智能降级
**用户故事:** As a user, I want the system to automatically retry with the next available account if the selected account fails, so that my API request can still succeed.

#### 验收标准（可测试）
- **WHEN** 选中的账号调用失败（API 错误、配额耗尽、网络超时）, **THEN** 系统 **SHALL** 自动尝试下一个配额次低的账号。
- **WHEN** 所有账号都尝试失败, **THEN** 系统 **SHALL** 返回错误信息 "All accounts exhausted"。
- **WHEN** 降级到下一个账号时, **THEN** 系统 **SHALL** 记录警告日志，格式: `[Fallback] Switching account {previous} -> {next} due to {reason}`。

### 需求 4: 兼容现有粘性会话机制
**用户故事:** As a system, I want to maintain session stickiness when enabled, so that cached conversations are not interrupted by account switching.

#### 验收标准（可测试）
- **WHEN** 请求带有 `session_id` **AND** 会话已绑定账号 **AND** 绑定账号可用（未限流、配额充足）, **THEN** 系统 **SHALL** 优先复用绑定账号，忽略配额优先策略。
- **WHEN** 绑定账号不可用（限流或配额不足）, **THEN** 系统 **SHALL** 解绑该会话，并应用配额优先策略选择新账号。
- **WHEN** 新会话首次分配账号时, **THEN** 系统 **SHALL** 应用配额优先策略选择账号，并建立会话绑定。

### 需求 5: 支持配置开关
**用户故事:** As an administrator, I want to enable or disable the quota-priority strategy via configuration, so that I can switch back to the default strategy if needed.

#### 验收标准（可测试）
- **WHEN** 配置文件中 `proxy.quota_priority_enabled = true`, **THEN** 系统 **SHALL** 启用配额优先策略。
- **WHEN** 配置文件中 `proxy.quota_priority_enabled = false` 或该字段不存在, **THEN** 系统 **SHALL** 使用默认的轮询/订阅等级优先策略。
- **WHEN** 配置更新时, **THEN** 系统 **SHALL** 在下一次账号选择时应用新配置（无需重启）。

### 需求 6: 详细日志记录
**用户故事:** As an administrator, I want to see detailed logs about account selection decisions, so that I can debug issues and understand system behavior.

#### 验收标准（可测试）
- **WHEN** 选择账号时, **THEN** 系统 **SHALL** 记录 DEBUG 级别日志，格式: `[QuotaPriority] Selected account {email} (tier: {tier}, quota: {percentage}%, model: {model})`。
- **WHEN** 因配额不足跳过某账号时, **THEN** 系统 **SHALL** 记录 DEBUG 级别日志，格式: `[QuotaPriority] Skipped account {email} (quota: {percentage}% < threshold: {threshold}%)`。
- **WHEN** 所有账号配额均低于阈值，启用降级机制时, **THEN** 系统 **SHALL** 记录 WARN 级别日志，格式: `[QuotaPriority] All accounts below threshold. Falling back to account {email} with highest remaining quota ({percentage}%)`。

## 3. 测试映射表

| 验收条目 | 测试层级 | 预期测试文件 | 预期函数/用例 |
|----------|----------|--------------|---------------|
| 需求1: 按百分比排序选择 | unit | tests/token_manager_test.rs | test_should_select_lowest_quota_account |
| 需求1: 配额数据不存在降级 | unit | tests/token_manager_test.rs | test_should_fallback_when_quota_unknown |
| 需求2: 订阅等级优先 | unit | tests/token_manager_test.rs | test_should_respect_tier_priority_within_quota |
| 需求3: 失败降级到次优账号 | integration | tests/integration/test_quota_priority.rs | test_fallback_to_next_account_on_failure |
| 需求3: 所有账号失败返回错误 | integration | tests/integration/test_quota_priority.rs | test_all_accounts_exhausted_error |
| 需求4: 粘性会话优先复用 | unit | tests/token_manager_test.rs | test_should_reuse_sticky_session_account |
| 需求4: 绑定账号不可用时解绑 | unit | tests/token_manager_test.rs | test_should_unbind_unavailable_sticky_account |
| 需求5: 配置开关控制策略 | unit | tests/config_test.rs | test_quota_priority_config_toggle |
| 需求6: 日志记录选择决策 | unit | tests/token_manager_test.rs | test_should_log_selection_decision |

## 4. 功能验收清单

> 从用户视角列出可感知的功能点，用于防止遗漏边缘场景。
> **规则**：实施阶段只能将 ☐ 改为 ✅，不得删除或修改功能描述。

| ID | 功能点 | 验收步骤 | 优先级 | 关联任务 | 通过 |
|----|--------|----------|--------|----------|------|
| F-001 | 配额优先选择 | 1. 配置多个账号（不同配额百分比）<br>2. 发起 API 请求<br>3. 验证选中配额最低的账号 | P0 | 待分配 | ☐ |
| F-002 | 订阅等级优先 | 1. 配置 ULTRA(50%) + PRO(30%) 账号<br>2. 发起请求<br>3. 验证选中 ULTRA(50%) 而非 PRO(30%) | P0 | 待分配 | ☐ |
| F-003 | 失败自动降级 | 1. 配置账号 A(10%) + B(20%)<br>2. 模拟 A 调用失败<br>3. 验证自动切换到 B | P0 | 待分配 | ☐ |
| F-004 | 粘性会话保持 | 1. 启用粘性会话<br>2. 首次请求绑定账号 A<br>3. 第二次请求验证仍使用 A（即使有更低配额账号） | P0 | 待分配 | ☐ |
| F-005 | 绑定账号不可用解绑 | 1. 会话绑定账号 A<br>2. A 被限流或配额耗尽<br>3. 验证解绑并重新选择 | P0 | 待分配 | ☐ |
| F-006 | 配置开关 | 1. 设置 quota_priority_enabled=false<br>2. 发起请求<br>3. 验证使用默认轮询策略（不按配额排序） | P1 | 待分配 | ☐ |
| F-007 | 边缘场景：所有账号低于阈值 | 1. 所有账号配额 < 1%<br>2. 发起请求<br>3. 验证选择配额最高的账号（降级机制） | P1 | 待分配 | ☐ |
| F-008 | 边缘场景：配额数据缺失 | 1. 某账号缺少目标模型的配额数据<br>2. 发起请求<br>3. 验证该账号被降级到兜底选择 | P1 | 待分配 | ☐ |
| F-009 | 边缘场景：单账号可用 | 1. 配置单个账号<br>2. 发起请求<br>3. 验证正常使用该账号（无排序开销） | P1 | 待分配 | ☐ |
| F-010 | 日志可观测性 | 1. 启用 DEBUG 日志<br>2. 发起请求<br>3. 验证日志包含账号选择原因、配额百分比 | P1 | 待分配 | ☐ |
| F-011 | 性能：选择延迟 < 10ms | 1. 配置 50 个账号<br>2. 发起 100 次请求<br>3. 验证 P99 延迟 < 10ms | P2 | 待分配 | ☐ |

**字段说明**：
- **ID**：功能点唯一标识（F-XXX）
- **功能点**：从用户视角描述可感知的功能
- **验收步骤**：可测试的操作步骤和预期结果
- **优先级**：P0（核心功能）/ P1（重要功能）/ P2（一般功能）
- **关联任务**：对应 tasks.md 中的任务ID（T-XXX），由 spec-dev 填充
- **通过**：☐ 未完成 / ✅ 已完成（实施阶段只能更新此字段）

## 5. 技术约束与要求

### 5.1 技术栈
- **语言/框架**: Rust (Tauri 后端)
- **依赖库**:
  - `tokio` (异步运行时)
  - `tracing` (日志)
  - `serde` (配置序列化)

### 5.2 集成点
- **内部模块**:
  - `src-tauri/src/proxy/token_manager.rs` - 账号选择核心逻辑
  - `src-tauri/src/modules/quota.rs` - 配额查询（复用现有 API）
  - `src-tauri/src/proxy/config.rs` - 配置管理
  - `src-tauri/src/proxy/handlers/openai.rs` 和 `anthropic.rs` - API 请求处理器

- **数据结构**:
  - `ProxyToken.model_quotas: HashMap<String, f64>` - 已存储百分比（0.0-1.0）
  - `ProxyToken.subscription_tier: Option<String>` - 订阅等级 (ULTRA/PRO/FREE)

### 5.3 数据存储
- **配额数据**: 内存缓存（已有 `ProxyToken` 结构）
- **配置**: `config.json` (已有配置系统)
- **会话绑定**: 内存 `DashMap` (已有 `session_accounts`)

### 5.4 性能要求
- **响应时间**: 账号选择逻辑 < 10ms (P99)
- **并发量**: 支持现有的并发请求量（无性能回退）
- **数据量**: 支持最多 100 个账号同时管理

### 5.5 安全要求
- **认证**: 复用现有的 OAuth Token 机制
- **授权**: 无新增权限需求
- **数据保护**: 配额数据仅内存缓存，不持久化敏感信息

## 6. 排除项（明确不做）

- **不修改配额查询 API**: 复用 `modules/quota.rs` 的 `fetch_quota()`，不改变查询逻辑或数据格式
- **不改变订阅等级优先级**: ULTRA > PRO > FREE 的整体优先级保持不变，仅在同等级内按配额排序
- **不支持基于绝对值排序**: 仅支持百分比（`0.0-1.0`），不按美元金额或 Token 数量排序
- **不实现定期批量调整**: 每次调用时实时决策，不做后台批量调度或预分配
- **不添加 UI 管理界面**: 仅支持配置文件控制，不在此需求中实现前端管理页面
- **不实现多维度评分**: 不结合过期时间、历史成功率等因素，仅基于当前配额百分比

## 7. 风险与挑战

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 每次调用排序导致性能下降 | 中 | 1. 账号数量通常 < 50，排序开销可接受<br>2. 如需优化，可实现配额变化时增量排序（未来优化） |
| 与粘性会话机制冲突 | 高 | 粘性会话优先级更高，仅在新会话分配或解绑时应用配额策略 |
| 配额数据过期导致选择不准确 | 中 | 1. 复用现有的配额刷新机制<br>2. 失败时触发实时配额刷新（现有逻辑） |
| 所有账号低配额时无法服务 | 低 | 现有降级机制（Hard Floor 0.01%）兜底，选择配额最高账号 |
| 多线程并发时账号状态不一致 | 中 | 现有 `DashMap` 和 `RwLock` 机制保证并发安全 |

## 8. 相关文档

- **简报版本**: docs/dev/quota-priority-selection/quota-priority-selection-brief.md
- **访谈记录**: 由 /dev:clarify 生成于 2026-01-10

## 9. 下一步行动

### 方式1：使用 spec-dev 继续（推荐）

在新会话中执行：
```bash
/dev:spec-dev quota-priority-selection --skip-requirements
```

这将：
1. ✅ 跳过阶段1（requirements 已完成）
2. 🎯 直接进入阶段2（技术设计）
3. 📋 然后阶段3（任务拆分）
4. 💻 最后 TDD 实施

### 方式2：手动进行设计

如果你想自己设计技术方案，可以：
1. 基于本 requirements 编写 design.md
2. 然后执行 `/dev:spec-dev quota-priority-selection --stage 3` 进行任务拆分

---

## 附录：现有系统关键代码位置

### A. 账号选择逻辑
**文件**: `src-tauri/src/proxy/token_manager.rs:239-449`

**核心流程**:
```rust
// 1. 订阅等级排序 (line 241-249)
tokens_snapshot.sort_by(|a, b| {
    let tier_priority = |tier: &Option<String>| match tier.as_deref() {
        Some("ULTRA") => 0,
        Some("PRO") => 1,
        Some("FREE") => 2,
        _ => 3,
    };
    tier_priority(&a.subscription_tier).cmp(&tier_priority(&b.subscription_tier))
});

// 2. 轮询选择 + 配额检查 (line 343-366)
for offset in 0..total {
    let candidate = &tokens_snapshot[idx];

    // 跳过限流账号
    if self.is_rate_limited(&candidate.account_id) { continue; }

    // 配额预检
    if let Some(model) = model_name {
        if let Some(&remaining) = candidate.model_quotas.get(model) {
            if remaining < quota_threshold {
                // 记录备选
                if best_fallback.is_none() || remaining > best_fallback.as_ref().unwrap().1 {
                    best_fallback = Some((candidate.clone(), remaining));
                }
                continue;
            }
        }
    }

    target_token = Some(candidate.clone());
    break;
}

// 3. 降级机制 (line 384-393)
if target_token.is_none() && best_fallback.is_some() {
    let (best_token, remaining) = best_fallback.unwrap();
    if remaining > 0.0001 {
        tracing::warn!("Falling back to account {} ({:.2}%)", best_token.email, remaining * 100.0);
        target_token = Some(best_token);
    }
}
```

**需要改动的地方**:
- 在订阅等级排序后，增加配额二次排序
- 将 `轮询选择` 改为 `配额优先选择`
- 保留现有的限流检查、降级机制

### B. 配额数据结构
**文件**: `src-tauri/src/proxy/token_manager.rs`

```rust
pub struct ProxyToken {
    pub account_id: String,
    pub email: String,
    pub access_token: String,
    pub project_id: String,
    pub subscription_tier: Option<String>,  // ULTRA/PRO/FREE
    pub model_quotas: HashMap<String, f64>, // model_name -> remaining_percentage (0.0-1.0)
    // ...
}
```

**配额数据来源**: `modules/quota.rs:fetch_quota()` 填充 `model_quotas`

### C. 配置结构
**文件**: `src-tauri/src/models/config.rs:20-22`

```rust
pub struct AppConfig {
    // ...
    #[serde(default = "default_quota_threshold")]
    pub model_quota_threshold: f64, // 当前阈值（默认 0.01 = 1%）
}
```

**需要新增字段**:
```rust
#[serde(default)]
pub quota_priority_enabled: bool, // 是否启用配额优先策略
```
