# 需求文档: 模型配额保护 (Model Quota Protection)

> **生成方式**: 由 /dev:clarify 自动生成
> **生成时间**: 2026-01-09
> **访谈轮次**: 第 2 轮
> **细节级别**: standard
> **可直接用于**: /dev:spec-dev model-quota-protection --skip-requirements

## 1. 介绍

当前系统在模型映射时仅采用被动捕获 429 错误的策略。本功能旨在引入主动预检机制，利用已获取的配额百分比数据，在请求发起前屏蔽掉配额即将耗尽的模型，提高系统整体的高可用性。

**目标用户**:
- 使用多账号轮询的高频用户
- 对系统稳定性有严格要求的生产环境

**核心价值**: 消除可预见的 429 错误，优化多账号负载均衡策略。

## 2. 需求与用户故事

### 需求 1: 模型配额预检 (Proactive Quota Check)
**用户故事:** As a system, I want to check the remaining quota of a model before dispatching a request, so that I can avoid sending requests to models that are likely to fail.

#### 验收标准（可测试）
- **WHEN** 选择账号进行模型映射时, **THEN** 系统 **SHALL** 查询该账号对应模型的 `remainingFraction`。
- **IF** `remainingFraction < threshold` (默认 1%), **THEN** 系统 **SHALL** 跳过该账号并尝试下一个。
- **IF** 所有可用账号均低于阈值, **THEN** 系统 **SHALL** 降级为原始逻辑（允许尝试剩余配额最多的账号）。

### 需求 2: 可配置阈值 (Configurable Threshold)
**用户故事:** As an admin, I want to customize the quota threshold, so that I can balance between resource utilization and error prevention.

#### 验收标准（可测试）
- **WHEN** 系统启动或配置加载时, **THEN** 系统 **SHALL** 从配置文件读取 `model_quota_threshold`。
- **IF** 未指定配置, **THEN** 系统 **SHALL** 使用 1.0% 作为默认值。

## 3. 测试映射表

| 验收条目 | 测试层级 | 预期测试文件 | 预期函数/用例 |
|----------|----------|--------------|---------------|
| 需求1: 低于阈值自动跳过 | unit | src-tauri/src/proxy/token_manager.rs | test_should_skip_low_quota_account |
| 需求1: 所有账号均不足时兜底 | unit | src-tauri/src/proxy/token_manager.rs | test_fallback_when_all_accounts_low_quota |
| 需求2: 配置加载验证 | unit | src-tauri/src/proxy/config.rs | test_load_quota_threshold_config |

## 4. 功能验收清单

| ID | 功能点 | 验收步骤 | 优先级 | 关联任务 | 通过 |
|----|--------|----------|--------|----------|------|
| F-001 | 动态阈值过滤 | 1. 设置阈值为 5% 2. 构造账号 A (剩余 3%) 3. 发起请求 4. 预期：账号 A 被跳过 | P0 | 待分配 | ☐ |
| F-002 | 自动恢复映射 | 1. 账号 A 剩余 0.5% (已禁用) 2. 更新账号 A 配额为 10% 3. 发起请求 4. 预期：账号 A 重新被选中 | P0 | 待分配 | ☐ |
| F-003 | 警告日志输出 | 1. 触发配额跳过 2. 检查日志 3. 预期：出现 "Account X skipped due to low quota (0.8% < 1.0%)" | P1 | 待分配 | ☐ |

## 5. 技术约束与要求

### 5.1 技术栈
- **后端**: Rust (Tauri)
- **前端**: TypeScript (React) - 用于配置展示（可选）

### 5.2 集成点
- **TokenManager**: 核心修改点，集成在 `get_token_internal` 循环中。
- **QuotaModule**: 提供获取当前内存中配额数据的接口。

### 5.3 数据存储
- **内存状态**: 配额数据已存在于内存中，需确保 `remainingFraction` 字段被正确填充。

## 6. 排除项（明确不做）

- 不涉及修改外部配额抓取频率，仅修改消费侧逻辑。
- 不提供前端 UI 实时修改阈值的功能（初期仅支持配置文件/环境变量）。

## 7. 风险与挑战

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 配额数据过时 | 中 | 保持合理的轮询间隔（如 5-10 分钟），并在 429 触发时立即更新状态。 |
| 性能开销 | 低 | 仅为内存数值比较，开销可忽略。 |

## 8. 相关文档

- **简报版本**: docs/dev/model-quota-protection/model-quota-protection-brief.md
- **访谈记录**: 由 /dev:clarify 生成于 2026-01-09

## 9. 下一步行动

在新会话中执行：
```bash
/dev:spec-dev model-quota-protection --skip-requirements
```
