# 10 — Feature Flag 体系

> 构建时死代码消除 + 运行时 GrowthBook 控制的双层 Feature Flag

## 核心洞察

Claude Code 使用两层 Feature Flag：

| 层级 | 技术 | 时机 | 作用 |
|------|------|------|------|
| 构建时 | `bun:bundle` feature() | 打包时 | 完全移除未启用代码 |
| 运行时 | GrowthBook | 运行时 | A/B 测试、灰度发布 |

## 构建时 Feature Flag

```typescript
import { feature } from 'bun:bundle'

// 构建时求值：如果 KAIROS 为 false，整个分支被删除
const assistantModule = feature('KAIROS')
  ? require('./assistant/index.js')
  : null
```

### 已知的 Feature Flag

| Flag | 代号/含义 | 状态 |
|------|----------|------|
| `KAIROS` | Assistant Mode（助理模式）| 未公开 |
| `PROACTIVE` | 主动模式 — AI 自动执行任务 | 未公开 |
| `COORDINATOR_MODE` | 多 Agent 协调器 | 未公开 |
| `VOICE_MODE` | 语音输入 | 未公开 |
| `AGENT_TRIGGERS` | 定时任务触发器 | 未公开 |
| `AGENT_TRIGGERS_REMOTE` | 远程触发 | 未公开 |
| `MONITOR_TOOL` | 监控工具 | 未公开 |
| `BRIDGE_MODE` | IDE 集成桥接 | 已启用 |
| `DAEMON` | 后台守护进程 | 未公开 |
| `HISTORY_SNIP` | 历史剪切压缩 | 实验中 |
| `CACHED_MICROCOMPACT` | 缓存微压缩 | 实验中 |
| `TOKEN_BUDGET` | Token 预算控制 | 实验中 |
| `KAIROS_BRIEF` | 简报功能 | 未公开 |
| `KAIROS_PUSH_NOTIFICATION` | 推送通知 | 未公开 |
| `KAIROS_GITHUB_WEBHOOKS` | GitHub Webhook | 未公开 |
| `EXPERIMENTAL_SKILL_SEARCH` | 技能搜索 | 实验中 |
| `BUDDY` | 电子宠物伴侣系统 | 隐藏彩蛋 |

## KAIROS — 最值得关注的隐藏功能

KAIROS 是 Claude Code 的「助理模式」，代表一个全新的产品方向：

```typescript
const assistantModule = feature('KAIROS')
  ? require('./assistant/index.js')
  : null
```

关联的工具：
- `SleepTool` — 主动模式等待
- `PushNotificationTool` — 向用户推送通知
- `SendUserFileTool` — 向用户发送文件
- `BriefTool` — 生成简报
- `SubscribePRTool` — 订阅 PR 变更

KAIROS 暗示 Claude Code 未来不只是「被动应答」，而是可以**主动**监控代码库、推送通知、定期汇报。

## 运行时 GrowthBook

```typescript
import { getFeatureValue_CACHED_MAY_BE_STALE } from
  'src/services/analytics/growthbook.js'

// 运行时检查，支持 A/B 测试
const enabled = getFeatureValue_CACHED_MAY_BE_STALE(
  'tengu_agent_list_attach', false
)
```

`_CACHED_MAY_BE_STALE` 后缀暗示：GrowthBook 的值在启动时缓存，会话期间不实时更新（避免行为中途变化）。

## Buddy System — 内置电子宠物（彩蛋）

源码中最出人意料的发现之一：`src/buddy/` 目录包含一个完整的电子宠物（Tamagotchi）系统。

### 18 个物种

```
duck · goose · blob · cat · dragon · octopus · owl · penguin
turtle · snail · ghost · axolotl · capybara · cactus · robot
rabbit · mushroom · chonk
```

每个物种都有 **ASCII art 动画精灵**，包含 3 帧待机动画，5 行高、12 字符宽。比如猫：

```
   /\_/\
  ( ·   · )
  (  ω  )
  (")_(")~
```

### 稀有度系统

| 稀有度 | 权重 | 星级 |
|--------|------|------|
| Common | 60% | ★ |
| Uncommon | 25% | ★★ |
| Rare | 10% | ★★★ |
| Epic | 4% | ★★★★ |
| Legendary | 1% | ★★★★★ |

还有 **1% 概率的 Shiny 变体**（`shiny: rng() < 0.01`）。

### 属性与装饰

- **5 种属性**：DEBUGGING / PATIENCE / CHAOS / WISDOM / SNARK
- **6 种眼睛**：`·` `✦` `×` `◉` `@` `°`
- **8 种帽子**：none / crown / tophat / propeller / halo / wizard / beanie / tinyduck
- 基于 `hash(userId)` 的确定性生成 — 每个用户永远对应同一只宠物

### 设计原理

宠物坐在用户输入框旁边，用语音气泡偶尔评论。当用户直接喊宠物的名字时，它会回应。`capybara`（水豚）这个物种名暗合了 Claude Mythos 的代号 "Capybara"。

## Undercover Mode — 卧底模式

源码中最具争议的发现：`src/utils/undercover.ts`。

### 什么是卧底模式？

当 Anthropic 员工（`USER_TYPE === 'ant'`）在**公开/开源仓库**中使用 Claude Code 时，该模式**自动激活**，强制隐藏所有 AI 痕迹：

```typescript
export function isUndercover(): boolean {
  if (process.env.USER_TYPE === 'ant') {
    if (isEnvTruthy(process.env.CLAUDE_CODE_UNDERCOVER)) return true
    // Auto: active unless we've positively confirmed
    // we're in an allowlisted internal repo
    return getRepoClassCached() !== 'internal'
  }
  return false
}
```

### 关键规则

注入到模型的 prompt 中：

```
## UNDERCOVER MODE — CRITICAL

You are operating UNDERCOVER in a PUBLIC/OPEN-SOURCE repository.
Your commit messages, PR titles, and PR bodies MUST NOT contain
ANY Anthropic-internal information. Do not blow your cover.

NEVER include:
- Internal model codenames (Capybara, Tengu, etc.)
- Unreleased model version numbers (opus-4-7, sonnet-4-8)
- Internal repo or project names
- The phrase "Claude Code" or any mention that you are an AI
- Co-Authored-By lines or any other attribution

Write commit messages as a human developer would.
```

### 不可关闭

```typescript
// There is NO force-OFF. This guards against model codename leaks —
// if we're not confident we're in an internal repo, we stay undercover.
```

卧底模式**没有手动关闭选项**。只要不在 Anthropic 内部白名单仓库中，就自动隐身。这意味着 Anthropic 员工对公开项目的贡献，你永远无法从提交历史中判断是否由 AI 完成。

## 内部用户 vs 外部用户

```typescript
// 内部 Anthropic 员工专属功能
const REPLTool = process.env.USER_TYPE === 'ant'
  ? require('./tools/REPLTool/REPLTool.js').REPLTool
  : null
```

`USER_TYPE === 'ant'` 控制的功能：
- REPLTool（交互式 REPL）
- SuggestBackgroundPRTool（后台 PR 建议）
- Undercover Mode（卧底模式）
- 更详细的输出风格指令
- 数字化长度锚定实验
- 更多系统提示词段落

## 下一步

- [09 — 启动性能优化](../09-startup-optimization/) — Feature Flag 如何实现死代码消除
- [01 — System Prompt](../01-system-prompt/) — 内部/外部用户的 Prompt 差异
