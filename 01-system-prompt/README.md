# 01 — System Prompt 分层设计

> 一套精密的字符串拼装系统，直接决定模型行为质量和 API 成本

## 核心洞察

Claude Code 的 System Prompt **不是一段固定文本**，而是一个**由 110+ 条件字符串动态组装的数组**。

更关键的是，这个数组被一个**边界标记**分成两半：

```
┌─────────────────────────────────┐
│     静态区 (Cacheable)          │  ← 跨用户/跨会话不变
│                                 │
│  • 身份定义                      │
│  • 系统规则                      │
│  • 编码规范                      │
│  • 操作谨慎性指令                 │
│  • 工具使用指南                   │
│  • 语气风格                      │
│  • 输出简洁性                    │
│                                 │
├── __SYSTEM_PROMPT_DYNAMIC_BOUNDARY__ ──┤ ← Prompt Cache 分界线
│                                 │
│     动态区 (Per-session)        │  ← 每次会话/每轮可能变化
│                                 │
│  • 会话特定指导                   │
│  • 记忆 (CLAUDE.md)             │
│  • 环境信息 (OS/CWD/Git)         │
│  • 语言偏好                      │
│  • 输出风格                      │
│  • MCP 服务器指令                 │
│  • Token 预算                   │
│                                 │
└─────────────────────────────────┘
```

**为什么这样分？** 因为 Anthropic API 支持 Prompt Caching — 只要 system prompt 的前缀不变，后续请求可以复用缓存（价格降低 90%）。静态区内容稳定，动态区内容变化，这个分界线就是 cache 的 breakpoint。

## 源码解析

核心函数在 `src/constants/prompts.ts` 的 `getSystemPrompt()`：

```typescript
export async function getSystemPrompt(
  tools: Tools,
  model: string,
  additionalWorkingDirectories?: string[],
  mcpClients?: MCPServerConnection[],
): Promise<string[]> {

  // --- 静态区（可缓存）---
  return [
    getSimpleIntroSection(outputStyleConfig),     // 身份定义
    getSimpleSystemSection(),                      // 系统规则
    getSimpleDoingTasksSection(),                  // 编码规范
    getActionsSection(),                           // 操作谨慎性
    getUsingYourToolsSection(enabledTools),        // 工具使用指南
    getSimpleToneAndStyleSection(),                // 语气风格
    getOutputEfficiencySection(),                  // 输出简洁性

    // === 分界标记 ===
    ...(shouldUseGlobalCacheScope()
      ? [SYSTEM_PROMPT_DYNAMIC_BOUNDARY] : []),

    // --- 动态区（注册管理）---
    ...resolvedDynamicSections,
  ].filter(s => s !== null)
}
```

## 静态区各段详解

### 1. 身份定义 (`getSimpleIntroSection`)

```
You are an interactive agent that helps users with software engineering tasks.
```

极简。不像有些 Agent 框架写一大段角色扮演，Claude Code 的身份定义非常克制。

### 2. 编码规范 (`getSimpleDoingTasksSection`)

这是最长也最有价值的段落，它定义了 Claude Code 的「代码风格哲学」：

**核心原则 — 最小复杂度：**
- 不要添加超出要求的功能
- 不要为不可能发生的场景做错误处理
- 不要为一次性操作创建抽象
- 三行相似代码优于一个过早抽象

**反常识设计：** 源码中有一段注释透露 Anthropic 内部用户有更严格的指令：

```typescript
// @[MODEL LAUNCH]: capy v8 assertiveness counterweight
...(process.env.USER_TYPE === 'ant'
  ? ['If you notice the user\'s request is based on a misconception,
      or spot a bug adjacent to what they asked about, say so.']
  : []),
```

内部版本（`USER_TYPE === 'ant'`）的 Claude Code 会主动指出用户的误解和相邻 bug，而外部版本不会。

### 3. 操作谨慎性 (`getActionsSection`)

定义了「高风险操作确认」原则：

```
用户批准某操作一次，并不意味着在所有场景下都批准。
除非在 CLAUDE.md 等持久指令中提前授权，否则始终先确认。
```

这段 prompt 是 Claude Code 能让用户放心使用的关键。

### 4. 输出简洁性 (`getOutputEfficiencySection`)

源码揭示了**内部用户和外部用户看到的 prompt 完全不同**：

**外部用户版本（简短）：**
```
Go straight to the point. Try the simplest approach first.
Keep your text output brief and direct.
```

**内部用户版本（详细的写作指南）：**
```
Write user-facing text in flowing prose while eschewing fragments,
excessive em dashes, symbols and notation...
Write so they can pick back up cold: use complete, grammatically
correct sentences without unexplained jargon.
```

Anthropic 内部版本有一套完整的技术写作规范嵌入在 prompt 里。

## 动态区机制

动态区使用了一个注册系统 (`systemPromptSection`)：

```typescript
const dynamicSections = [
  systemPromptSection('session_guidance', () =>
    getSessionSpecificGuidanceSection(enabledTools, skillToolCommands)),
  systemPromptSection('memory', () => loadMemoryPrompt()),
  systemPromptSection('env_info_simple', () =>
    computeSimpleEnvInfo(model, additionalWorkingDirectories)),
  // ...
]
```

每个 section 都有：
- **唯一 ID**：用于缓存和追踪
- **惰性求值**：只在需要时计算
- **可标记为不可缓存**：`DANGEROUS_uncachedSystemPromptSection` 用于 MCP 等频繁变化的指令

### 为什么 MCP 指令是 "DANGEROUS"？

```typescript
DANGEROUS_uncachedSystemPromptSection(
  'mcp_instructions',
  () => isMcpInstructionsDeltaEnabled()
    ? null
    : getMcpInstructionsSection(mcpClients),
  'MCP servers connect/disconnect between turns',
)
```

MCP 服务器可能在对话过程中连接/断开，如果把 MCP 指令放在缓存区，每次变化都会导致**整个 prompt cache 失效**。所以用 `DANGEROUS_uncachedSystemPromptSection` 标记它，提醒开发者这段内容会破坏缓存。

后来 Anthropic 做了优化：用 `mcp_instructions_delta` attachment 机制代替，把 MCP 指令从 system prompt 移到消息附件中，彻底解决了 cache 失效问题。

## 关键设计决策

### 1. 为什么 CLAUDE.md 不放在 System Prompt 里？

CLAUDE.md 的内容被包装成 XML 标签注入到**用户消息**中，而不是 system prompt：

```xml
<claude_md_instructions>
// CLAUDE.md 内容
</claude_md_instructions>
```

这样做的原因：保持 system prompt 稳定以最大化 prompt cache 命中率（92%），CLAUDE.md 变化不会破坏缓存。

### 2. 数字化长度锚定

源码中有一段有趣的注释：

```typescript
// Numeric length anchors — research shows ~1.2% output token reduction
// vs qualitative "be concise". Ant-only to measure quality impact first.
'Length limits: keep text between tool calls to ≤25 words.
 Keep final responses to ≤100 words unless the task requires more detail.'
```

Anthropic 内部做过实验：用具体数字（"≤25 words"）比定性描述（"be concise"）能额外减少 1.2% 的输出 token，目前只在内部用户中测试。

## 下一步

- [02 — Agent Loop 核心循环](../02-agentic-loop/) — System Prompt 组装完成后，QueryEngine 如何驱动整个对话
- [06 — Prompt Cache 优化](../06-prompt-caching/) — 静态/动态分区如何在 API 层面实现 92% cache 命中
