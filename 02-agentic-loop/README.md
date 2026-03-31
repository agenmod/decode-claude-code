# 02 — Agent Loop 核心循环

> 一个 AsyncGenerator 驱动的 while 循环，是 Claude Code 的心脏

## 核心洞察

Claude Code 的核心引擎 `QueryEngine` 只做一件事：

```
用户输入 → [组装上下文 → 调 API → 执行工具 → 结果回送]* → 最终响应
                    ↑_____________________________↓
                           循环直到没有工具调用
```

实现上，`submitMessage()` 是一个 **AsyncGenerator** — 它通过 `yield` 实时流出每一步的中间状态（文本块、工具调用、状态变更），让 UI 可以实时渲染。

## QueryEngine 类

```typescript
export class QueryEngine {
  private config: QueryEngineConfig
  private mutableMessages: Message[]       // 对话历史（可变）
  private abortController: AbortController // 中断控制
  private permissionDenials: SDKPermissionDenial[]
  private totalUsage: NonNullableUsage     // Token 用量追踪
  private readFileState: FileStateCache    // 文件状态缓存
  private discoveredSkillNames = new Set<string>()

  async *submitMessage(
    prompt: string | ContentBlockParam[],
  ): AsyncGenerator<SDKMessage, void, unknown> {
    // ... 这就是整个 Agent Loop
  }
}
```

**设计选择：** 一个 QueryEngine 实例 = 一个对话。`submitMessage()` 每调用一次 = 一个 turn。状态（消息、文件缓存、用量）跨 turn 持久保存。

## submitMessage 内部流程

```
submitMessage("帮我修复 bug")
│
├── 1. 准备阶段
│   ├── 清空 skill 追踪（per-turn）
│   ├── 获取系统 prompt（fetchSystemPromptParts）
│   ├── 确定模型（用户指定 or 默认）
│   ├── 确定 thinking 模式（adaptive/disabled）
│   └── 包装权限检查函数（wrappedCanUseTool）
│
├── 2. 进入 query() 循环
│   │
│   │  ┌──────── API 调用循环 ────────┐
│   │  │                              │
│   │  │  调用 Anthropic Messages API  │
│   │  │  ↓                            │
│   │  │  流式接收响应                   │
│   │  │  ↓                            │
│   │  │  解析: 文本块 / 工具调用块      │
│   │  │  ↓                            │
│   │  │  如果有工具调用:                │
│   │  │    → 权限检查                  │
│   │  │    → 执行工具                  │
│   │  │    → 追加结果到消息历史          │
│   │  │    → 继续循环                  │
│   │  │                              │
│   │  │  如果无工具调用:                │
│   │  │    → 结束循环                  │
│   │  │                              │
│   │  └──────────────────────────────┘
│   │
├── 3. 后处理
│   ├── 更新 usage 统计
│   ├── 持久化会话
│   └── yield 最终状态
│
└── 返回
```

## 权限检查包装

一个微妙但重要的设计 — `canUseTool` 被包装了一层来追踪拒绝记录：

```typescript
const wrappedCanUseTool: CanUseToolFn = async (
  tool, input, toolUseContext, assistantMessage, toolUseID, forceDecision,
) => {
  const result = await canUseTool(
    tool, input, toolUseContext, assistantMessage, toolUseID, forceDecision,
  )

  // 追踪被拒绝的工具调用 → 用于 SDK 报告
  if (result.behavior !== 'allow') {
    this.permissionDenials.push({
      tool_name: sdkCompatToolName(tool.name),
      tool_use_id: toolUseID,
      tool_input: input,
    })
  }
  return result
}
```

**为什么要追踪拒绝？** SDK 模式下，外部程序需要知道哪些操作被用户拒绝了，以便做相应处理。

## Thinking 模式自适应

```typescript
const initialThinkingConfig: ThinkingConfig = thinkingConfig
  ? thinkingConfig                          // 用户指定
  : shouldEnableThinkingByDefault() !== false
    ? { type: 'adaptive' }                  // 默认: 自适应
    : { type: 'disabled' }                  // 关闭
```

默认使用 `adaptive` thinking — 模型自行决定是否需要 extended thinking，而不是每次都开启（省 token）。

## 模型选择逻辑

```typescript
const initialMainLoopModel = userSpecifiedModel
  ? parseUserSpecifiedModel(userSpecifiedModel)  // 用户通过 --model 指定
  : getMainLoopModel()                           // 从配置中获取默认模型
```

模型可以在多个层级覆盖：命令行参数 > 环境变量 > 配置文件 > 默认值。

## 上下文装配

System Prompt 不是唯一的上下文来源。`submitMessage` 还装配了：

```typescript
const {
  defaultSystemPrompt,   // System Prompt 数组
  userContext,           // 用户上下文（CLAUDE.md、环境等）
  systemContext,         // 系统上下文（OS、Git 等）
} = await fetchSystemPromptParts({
  tools,
  mainLoopModel: initialMainLoopModel,
  additionalWorkingDirectories: [...],
  mcpClients,
  customSystemPrompt: customPrompt,
})
```

三种上下文注入方式不同：
- `defaultSystemPrompt` → API 的 `system` 参数
- `userContext` → 包装成 XML 标签注入用户消息
- `systemContext` → 同上

## AsyncGenerator 的妙用

为什么用 `async *submitMessage()` 而不是普通 async 函数？

```typescript
// 调用方可以实时消费每一步
for await (const event of engine.submitMessage("fix the bug")) {
  if (event.type === 'text') renderText(event.content)
  if (event.type === 'tool_use') renderToolCall(event)
  if (event.type === 'result') handleComplete(event)
}
```

AsyncGenerator 让 UI 可以：
1. **实时渲染** — 模型输出一个字就显示一个字
2. **实时显示工具调用** — 用户看到 "正在读取文件..." 而不是干等
3. **可中断** — 用户随时可以 Ctrl+C

## 关键设计决策

### 为什么是单线程循环而不是并发执行工具？

模型在一次响应中可能返回多个工具调用，但 Claude Code 选择**顺序执行**。原因：
- 工具间可能有依赖（先读文件，再编辑）
- 顺序执行更容易调试和追踪
- 错误处理更简单（一个失败不会影响其他）

### 子 Agent 是唯一的并发点

需要并发时，通过 `AgentTool` 生成子 Agent — 每个子 Agent 有独立的 QueryEngine 实例和上下文。详见 [07 — 多 Agent 协作](../07-multi-agent/)。

## 下一步

- [03 — 工具系统架构](../03-tool-system/) — 工具是怎么注册和执行的
- [05 — 上下文管理与压缩](../05-context-management/) — 循环跑多轮后上下文满了怎么办
