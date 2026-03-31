# 06 — Prompt Cache 优化

> 一个边界标记实现 92% 缓存命中率，直接影响 API 成本

## 核心洞察

Anthropic API 的 Prompt Caching 机制：只要 system prompt 的**前缀**与前一次请求相同，就可以复用缓存（价格降低 90%）。

Claude Code 围绕这个机制做了大量优化。

## SYSTEM_PROMPT_DYNAMIC_BOUNDARY

```typescript
export const SYSTEM_PROMPT_DYNAMIC_BOUNDARY =
  '__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__'
```

这个字符串是整个缓存策略的核心。它把 system prompt 数组分为：
- **边界之前**：所有请求都相同 → scope: `global` → 跨用户缓存
- **边界之后**：每个会话可能不同 → 不缓存或 session 级缓存

## API 层实现

在 `src/services/api/claude.ts` 中，`buildSystemPromptBlocks` 函数根据边界标记把 system prompt 数组拆分成两个 cache block：

```
API 请求:
  system: [
    { type: "text", text: "静态内容...", cache_control: { type: "ephemeral" } },
    { type: "text", text: "动态内容..." }
  ]
```

第一个 block 带有 `cache_control`，告诉 API 可以缓存这部分。

## 缓存敌人：动态内容泄入静态区

源码注释揭示了一个真实的性能问题：

```typescript
// The dynamic agent list was ~10.2% of fleet cache_creation tokens
```

Agent 列表最初在 AgentTool 的工具描述中（属于静态区），但 MCP 连接变化会修改 Agent 列表 → 工具 schema 变化 → 缓存失效。

**解决方案**：把 Agent 列表移到消息附件（`agent_listing_delta`），彻底从静态区移除。

## MCP 指令的缓存挑战

```typescript
DANGEROUS_uncachedSystemPromptSection(
  'mcp_instructions',
  () => getMcpInstructionsSection(mcpClients),
  'MCP servers connect/disconnect between turns',
)
```

MCP 服务器指令是另一个缓存杀手。后来通过 `mcp_instructions_delta` attachment 机制解决 — 把不稳定内容从 system prompt 移到消息层。

## 92% 的关键

达到 92% cache 命中率的要素：
1. 静态/动态严格分区
2. CLAUDE.md 放在用户消息而非 system prompt
3. 动态 Agent 列表移到附件
4. MCP 指令移到附件
5. 工具 schema 保持稳定

## 下一步

- [01 — System Prompt 分层设计](../01-system-prompt/) — 静态/动态分区的详细设计
- [09 — 启动性能优化](../09-startup-optimization/) — 其他性能优化手段
