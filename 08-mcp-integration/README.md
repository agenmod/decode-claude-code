# 08 — MCP 协议集成

> 通过 Model Context Protocol 实现无限工具扩展

## 核心洞察

MCP（Model Context Protocol）让 Claude Code 的工具集从 40 个内置工具扩展到**无限**。每个 MCP 服务器可以提供：
- 工具（Tools）
- 资源（Resources）
- 提示（Prompts）

## MCP 客户端实现

核心实现在 `src/services/mcp/`：

```
src/services/mcp/
├── client.ts     # MCP 客户端连接管理（3,348 行）
├── auth.ts       # MCP 认证（2,465 行）
├── types.ts      # 类型定义
└── officialRegistry.ts  # 官方 MCP 服务器注册表
```

## 连接生命周期

```
1. 启动时读取 MCP 配置（settings.json / .mcp.json）
2. 建立连接（stdio / HTTP / SSE）
3. 发现工具（listTools）
4. 注入工具描述到模型上下文
5. 模型调用 → MCPTool 路由到对应服务器
6. 会话结束时断开连接
```

## MCPTool 路由

当模型调用一个 MCP 工具时，`MCPTool` 负责路由：

```
模型调用: mcp_server_name__tool_name(args)
  ↓
MCPTool 解析服务器名和工具名
  ↓
转发到对应 MCP 服务器
  ↓
返回结果给模型
```

## MCP 指令与 Prompt Cache

MCP 服务器可以提供 `instructions`，这些指令需要注入到 system prompt 中。但 MCP 服务器可能在对话中途连接/断开，导致 prompt cache 失效。

解决方案：`mcp_instructions_delta` — 把 MCP 指令作为消息附件而非 system prompt 的一部分。

## 下一步

- [03 — 工具系统架构](../03-tool-system/) — MCP 工具如何与内置工具统一管理
- [06 — Prompt Cache 优化](../06-prompt-caching/) — MCP 对缓存的影响和解决方案
