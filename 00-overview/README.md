# 00 — 全局架构概览

> Claude Code 的整体设计哲学：一个极简循环 + 精密的工程优化层

## 核心洞察

Claude Code 的架构可以用一句话总结：

> **一个 `while(tool_call)` 循环，加上围绕这个循环的大量工程优化。**

没有 DAG（有向无环图），没有任务规划器，没有分类器。所有决策都由 Claude 模型本身完成。Claude Code 只负责：
1. 组装 System Prompt
2. 把用户输入送给模型
3. 执行模型返回的工具调用
4. 把结果送回模型
5. 重复，直到模型不再调用工具

这种「模型即大脑」的设计哲学贯穿整个架构。

## 系统分层

```
┌─────────────────────────────────────────────────┐
│                    用户终端                        │
│              (React + Ink 终端 UI)                 │
├─────────────────────────────────────────────────┤
│                   CLI 层                          │
│        main.tsx → Commander.js 命令解析             │
├─────────────────────────────────────────────────┤
│                 QueryEngine                       │
│     核心 Agent Loop：消息管理 + 工具调度              │
├──────────┬──────────┬──────────┬────────────────┤
│ System   │ Tool     │ Permission│ Context        │
│ Prompt   │ System   │ System    │ Management     │
│ 组装     │ 注册/执行 │ 权限检查   │ 压缩/缓存       │
├──────────┴──────────┴──────────┴────────────────┤
│              Service Layer                        │
│   API Client / MCP / OAuth / LSP / Analytics      │
├─────────────────────────────────────────────────┤
│            Anthropic Messages API                 │
│        200K Context / Prompt Caching              │
└─────────────────────────────────────────────────┘
```

## 核心文件地图

| 文件 | 行数 | 职责 |
|------|------|------|
| `main.tsx` | 4,684 | 入口：CLI 解析 + React/Ink 渲染初始化 |
| `QueryEngine.ts` | 1,296 | 核心引擎：Agent Loop + 会话状态管理 |
| `query.ts` | ~1,800 | 底层 API 调用：流式响应 + 工具调用循环 |
| `Tool.ts` | 793 | 工具类型定义：输入 schema + 权限模型 |
| `tools.ts` | 390 | 工具注册表：动态加载 + Feature Flag 控制 |
| `commands.ts` | ~700 | 斜杠命令注册 |
| `constants/prompts.ts` | 915 | System Prompt 组装逻辑 |
| `context.ts` | ~200 | 系统/用户上下文收集 |
| `cost-tracker.ts` | ~300 | Token 成本追踪 |

## 一次完整请求的生命周期

```
用户输入 "帮我修复这个 bug"
    │
    ▼
1. QueryEngine.submitMessage()
    │
    ├── 组装 System Prompt（110+ 条件字符串）
    ├── 加载 CLAUDE.md 项目指令
    ├── 收集环境上下文（OS、Git、CWD）
    │
    ▼
2. query() → Anthropic Messages API
    │
    ├── 发送：system prompt + 历史消息 + 用户输入
    ├── 接收：流式响应（文本 + 工具调用）
    │
    ▼
3. 模型返回 tool_use: FileReadTool("src/app.ts")
    │
    ├── 权限检查 → 自动允许/提示用户
    ├── 执行工具 → 读取文件内容
    ├── 结果追加到消息历史
    │
    ▼
4. 再次调用 API（携带工具结果）
    │
    ├── 模型分析文件内容
    ├── 返回 tool_use: FileEditTool(...)
    │
    ▼
5. 循环继续... 直到模型返回纯文本（无工具调用）
    │
    ▼
6. 显示最终响应给用户
```

## 设计决策分析

### 为什么不用 DAG/任务规划？

传统的 Agent 框架（如 LangGraph）通常使用 DAG 来预先规划任务流。Claude Code 选择了完全不同的路径：

**模型自主决策**：每一步该做什么，完全由模型在上下文中自行判断。

这个选择的代价是可能多消耗几次 API 调用，但好处是：
- **极致简单**：核心代码路径极短，容易维护和调试
- **灵活**：模型可以随时改变策略，不受预定义流程限制
- **鲁棒**：出错时模型可以自我纠正，不需要复杂的错误恢复逻辑

### 为什么选择 Bun 而不是 Node.js？

1. **启动速度**：Bun 的冷启动比 Node.js 快 4-5 倍
2. **打包**：`bun:bundle` 支持 Feature Flag 死代码消除
3. **原生 TypeScript**：不需要编译步骤

### 为什么用 React + Ink 做终端 UI？

1. **组件化**：140+ UI 组件，用 React 组件模型管理复杂 UI 状态
2. **声明式**：终端 UI 状态管理和 Web 一样用 hooks
3. **热更新**：开发体验好

## 下一步

- [01 — System Prompt 分层设计](../01-system-prompt/) — 最影响输出质量和成本的设计
- [02 — Agent Loop 核心循环](../02-agentic-loop/) — QueryEngine 的内部实现细节
