# 07 — 多 Agent 协作

> 子 Agent、Team 模式和 Coordinator 的编排架构

## 核心洞察

Claude Code 有三层并发机制：

```
1. AgentTool      → 单个子 Agent（独立上下文，深度=1）
2. TeamCreateTool → 团队 Agent（多个 Agent 并行工作）
3. Coordinator    → 协调器模式（Feature Flag 控制，未公开）
```

## AgentTool — 子 Agent

子 Agent 是 Claude Code 处理复杂任务的核心手段：

- 主 Agent 调用 `AgentTool` 生成一个子 Agent
- 子 Agent 拥有**独立的 QueryEngine 实例和上下文**
- 子 Agent 完成后，只有**摘要**返回给主 Agent
- **深度限制**：子 Agent 不能再生子 Agent（depth=1）

**为什么要隔离上下文？**
- 防止工具调用结果污染主对话
- 子 Agent 可以放心地大量读取文件而不消耗主上下文
- 失败的子 Agent 不会搞乱主对话历史

## 内置 Agent 类型

```typescript
// 探索 Agent — 用于代码库搜索和理解
const EXPLORE_AGENT = { agentType: 'explore', ... }

// 验证 Agent — 用于验证修改结果
const VERIFICATION_AGENT_TYPE = 'verification'
```

## TeamCreateTool — 团队模式

当任务可以并行化时：

```
用户: "同时重构这三个模块"
  ↓
主 Agent 调用 TeamCreateTool
  ↓
├── Team Agent 1: 重构模块 A
├── Team Agent 2: 重构模块 B
└── Team Agent 3: 重构模块 C
  ↓
SendMessageTool: Agent 间通信
  ↓
结果汇总回主 Agent
```

## Fork 子 Agent（实验性）

源码中有 `forkSubagent` 机制 — 子 Agent 可以 fork 主 Agent 的部分上下文：

```typescript
const forkEnabled = isForkSubagentEnabled()
```

这比创建全新的子 Agent 更高效，因为可以共享已有的文件缓存和上下文。

## Coordinator 模式

```typescript
const coordinatorModeModule = feature('COORDINATOR_MODE')
  ? require('./coordinator/coordinatorMode.js')
  : null
```

Coordinator 模式是最高级的多 Agent 架构，目前通过 Feature Flag 控制，未公开启用。

## 下一步

- [02 — Agent Loop 核心循环](../02-agentic-loop/) — 子 Agent 共享同样的循环机制
- [08 — MCP 集成](../08-mcp-integration/) — MCP 工具如何在多 Agent 间共享
