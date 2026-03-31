# 03 — 工具系统架构

> 40+ 工具的统一注册、调度和执行机制

## 核心洞察

Claude Code 的每个工具都是一个**自包含模块**，定义了：
- 名称和描述（prompt）
- 输入 JSON Schema
- 权限模型
- 执行逻辑

模型在看到工具描述后自行决定调用哪个。Claude Code 不做任何工具路由或选择。

## 工具注册

所有工具在 `src/tools.ts` 中统一注册：

```typescript
// 始终可用的核心工具
import { BashTool } from './tools/BashTool/BashTool.js'
import { FileReadTool } from './tools/FileReadTool/FileReadTool.js'
import { FileWriteTool } from './tools/FileWriteTool/FileWriteTool.js'
import { FileEditTool } from './tools/FileEditTool/FileEditTool.js'
import { GlobTool } from './tools/GlobTool/GlobTool.js'
import { GrepTool } from './tools/GrepTool/GrepTool.js'
import { AgentTool } from './tools/AgentTool/AgentTool.js'
import { WebFetchTool } from './tools/WebFetchTool/WebFetchTool.js'
import { WebSearchTool } from './tools/WebSearchTool/WebSearchTool.js'

// Feature Flag 控制的条件工具
const SleepTool = feature('PROACTIVE') || feature('KAIROS')
  ? require('./tools/SleepTool/SleepTool.js').SleepTool
  : null

const cronTools = feature('AGENT_TRIGGERS')
  ? [CronCreateTool, CronDeleteTool, CronListTool]
  : []
```

**三类工具加载方式：**
1. **静态导入** — 核心工具，始终可用
2. **Feature Flag 条件导入** — 未发布功能的工具
3. **懒加载** — 打破循环依赖（如 TeamCreateTool）

## 工具类型定义

每个工具实现 `Tool` 接口（`src/Tool.ts`）：

```typescript
interface Tool {
  name: string                    // 唯一标识符
  description: string             // 给模型看的描述
  inputSchema: ToolInputJSONSchema  // JSON Schema
  
  // 权限检查
  isReadOnly(): boolean
  needsPermission(input: any): boolean
  
  // 执行
  call(input: any, context: ToolUseContext): Promise<ToolResult>
}
```

## 完整工具清单

### 核心八件套

| 工具 | 作用 | 权限 |
|------|------|------|
| **BashTool** | 执行 shell 命令 | 需确认（危险命令） |
| **FileReadTool** | 读取文件（支持图片、PDF、notebook） | 只读，自动允许 |
| **FileWriteTool** | 创建/覆盖文件 | 需确认 |
| **FileEditTool** | 部分修改文件（字符串替换） | 需确认 |
| **GlobTool** | 文件模式匹配搜索 | 只读，自动允许 |
| **GrepTool** | ripgrep 内容搜索 | 只读，自动允许 |
| **AgentTool** | 生成子 Agent | 自动允许 |
| **TodoWriteTool** | 任务列表管理 | 自动允许 |

### 扩展工具

| 工具 | 作用 |
|------|------|
| WebFetchTool | 获取 URL 内容 |
| WebSearchTool | 网页搜索 |
| SkillTool | 执行技能文件 |
| MCPTool | 调用 MCP 服务器工具 |
| LSPTool | 语言服务器集成 |
| NotebookEditTool | Jupyter Notebook 编辑 |
| TaskCreateTool | 创建子任务 |
| TeamCreateTool | 创建 Team Agent |
| SendMessageTool | Agent 间通信 |
| EnterWorktreeTool | Git worktree 隔离 |
| ConfigTool | 设置管理 |
| AskUserQuestionTool | 向用户提问 |
| ToolSearchTool | 延迟工具发现 |

### 隐藏工具（Feature Flag 控制）

| 工具 | Feature Flag | 作用 |
|------|---|---|
| SleepTool | PROACTIVE / KAIROS | 主动模式等待 |
| CronCreateTool | AGENT_TRIGGERS | 定时任务创建 |
| RemoteTriggerTool | AGENT_TRIGGERS_REMOTE | 远程触发 |
| MonitorTool | MONITOR_TOOL | 监控工具 |
| PushNotificationTool | KAIROS | 推送通知 |
| SendUserFileTool | KAIROS | 向用户发送文件 |
| SubscribePRTool | KAIROS_GITHUB_WEBHOOKS | PR webhook 订阅 |
| BriefTool | KAIROS_BRIEF | 简报生成 |

## BashTool 深度分析

BashTool 是最复杂的工具（15 个文件），因为它面临最大的安全挑战：

```
src/tools/BashTool/
├── BashTool.ts              # 主实现
├── prompt.ts                # 给模型的使用说明
├── bashPermissions.ts       # 权限判断（2,621 行）
├── bashSecurity.ts          # 安全检查（2,592 行）
├── readOnlyValidation.ts    # 只读模式验证（1,990 行）
├── pathValidation.ts        # 路径验证
├── commandSemantics.ts      # 命令语义分析
├── destructiveCommandWarning.ts  # 破坏性命令警告
├── shouldUseSandbox.ts      # 沙箱判断
├── sedEditParser.ts         # sed 命令解析
├── sedValidation.ts         # sed 安全验证
├── bashCommandHelpers.ts    # 命令辅助函数
├── modeValidation.ts        # 模式验证
├── commentLabel.ts          # 注释标签
└── utils.ts                 # 工具函数
```

BashTool 的安全层级：
1. **命令语义分析** — 解析命令是读取还是写入操作
2. **路径验证** — 检查操作路径是否在允许范围内
3. **破坏性命令检测** — `rm -rf`、`git push --force` 等
4. **只读模式强制** — Plan 模式下禁止写操作
5. **沙箱隔离** — 可选的文件系统沙箱

## 工具描述的 Prompt Engineering

每个工具的描述不只是简单说明，而是精心设计的 prompt。以 FileEditTool 为例：

```typescript
// 不只说"编辑文件"，而是详细指导模型如何调用
export const PROMPT = `Performs exact string replacements in files.

Usage:
- When editing text, ensure you preserve the exact indentation
- The edit will FAIL if old_string is not unique in the file
- Use replace_all for replacing and renaming strings across the file

If you want to create a new file, use the Write tool instead.`
```

工具描述实际上承担了**行为引导**的角色 — 告诉模型什么时候该用这个工具、什么时候不该用。

## 设计决策

### 为什么没有 RAG？

Claude Code 早期用过 Voyage embeddings 做 RAG 检索。后来改成了纯 Agent 式搜索（GlobTool + GrepTool）。

**原因：**
- Agent 搜索更灵活（可以多次搜索、调整关键词）
- 不需要维护向量索引
- 安全性更好（不需要将代码发送到外部嵌入服务）
- ripgrep 本身就非常快

### 为什么工具描述是静态的但 Agent 列表是动态的？

Agent 列表（可用的子 Agent 类型）最初嵌入在 AgentTool 的描述中。但源码注释揭示了问题：

```typescript
// The dynamic agent list was ~10.2% of fleet cache_creation tokens:
// MCP async connect, /reload-plugins, or permission-mode changes
// mutate the list → description changes → full tool-schema cache bust.
```

Agent 列表的变化导致**工具 schema 缓存失效**，消耗了整个平台 10.2% 的 cache 创建 token。解决方案：把 Agent 列表移到消息附件中（`agent_listing_delta`）。

## 下一步

- [04 — 权限安全模型](../04-permission-model/) — BashTool 的安全机制详解
- [07 — 多 Agent 协作](../07-multi-agent/) — AgentTool 如何生成和管理子 Agent
