# 05 — 上下文管理与压缩

> 200K token 窗口的精细化管理和自动压缩策略

## 核心洞察

Claude Code 共享一个 200K token 的上下文窗口：

```
200K token 预算分配：
├── System Prompt         ~13K chars
├── 对话历史              动态增长
├── 工具调用结果          可能很大（文件内容等）
├── 响应缓冲区            预留空间
└── 自动压缩阈值          75-92% 容量时触发
```

## 自动压缩机制

当上下文接近限制时，Claude Code 使用 `/compact` 进行自动压缩：

1. **触发条件**：上下文使用达到 75-92%（根据配置）
2. **压缩过程**：调用 Claude 模型对历史消息进行摘要
3. **保留策略**：保留最近的消息和关键工具结果
4. **无限对话**：System Prompt 中明确告知模型"对话通过自动摘要实现无限上下文"

## Snip Compaction（实验性）

源码中有一个 Feature Flag 控制的 `HISTORY_SNIP` 机制：

```typescript
const snipModule = feature('HISTORY_SNIP')
  ? require('./services/compact/snipCompact.js')
  : null
```

这是一种更精细的压缩方式 — 不是整体摘要，而是选择性地「剪切」中间的工具结果，保留结构。

## CLAUDE.md 上下文注入

CLAUDE.md 的内容不在 System Prompt 中，而是作为用户消息的附件注入：

```xml
<claude_md_instructions>
// 项目级 CLAUDE.md 内容
</claude_md_instructions>
```

多层 CLAUDE.md 加载顺序：
1. `~/.claude/CLAUDE.md` — 全局配置
2. `项目根/CLAUDE.md` — 项目级
3. `当前目录/CLAUDE.md` — 目录级
4. 条件规则匹配

## 下一步

- [06 — Prompt Cache 优化](../06-prompt-caching/) — 缓存如何减少成本
- [02 — Agent Loop 核心循环](../02-agentic-loop/) — 压缩如何与主循环配合
