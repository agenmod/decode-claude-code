# Decode CC

> 深度解读 Anthropic Claude Code 的架构设计与实现原理

<p align="center">
  <strong>🔍 不只是看代码，更要讲清楚「为什么这样设计」</strong>
</p>

<p align="center">
  <a href="#事件背景">事件背景</a> •
  <a href="#目录">目录</a> •
  <a href="#快速了解">快速了解</a> •
  <a href="#贡献">贡献</a>
</p>

---

## 这个项目是什么

Claude Code 是 Anthropic 的 AI 编程 CLI 工具，GitHub 85k+ stars。2026 年 3 月，由于 npm 包中误包含了 source map 文件（59.8MB 的 `cli.js.map`），其完整 TypeScript 源码（1900+ 文件、51 万行）被公开。

本项目基于公开可得的源码，**系统性地解读 Claude Code 的架构设计、核心原理和工程决策**。不是简单的代码罗列，而是回答：

- 为什么 System Prompt 要分「静态区」和「动态区」？
- Agent Loop 为什么用 `while(tool_call)` 而不是 DAG？
- 40 个工具的权限系统是怎么设计的？
- 92% 的 Prompt Cache 命中率是怎么做到的？
- 多 Agent 协作怎么编排？
- 启动时间怎么从 200ms 压到 135ms？

## 事件背景

| 日期 | 事件 |
|------|------|
| 2025-02-24 | v0.2.8 npm 包内含 inline base64 source map，被开发者通过 Sublime Text undo 恢复 |
| 2025-03 | Anthropic 紧急推送更新移除 source map，并从 npm 删除旧版本 |
| 2026-03-27 | CMS 配置错误泄露 ~3000 份内部文档，含未发布模型 Claude Mythos 信息 |
| 2026-03-31 | v2.1.88 npm 包再次包含 `cli.js.map`（59.8MB），可提取全部源文件 |

## 快速了解

Claude Code 本质上是一个**本地编排层**，不是 AI 本身 — 所有推理在 Anthropic 服务器上完成。

```
你的终端
  ↓
Claude Code CLI (TypeScript/Bun)
  ├── System Prompt 组装（110+ 条件字符串）
  ├── Agent Loop（while tool_call）
  ├── 工具执行（Bash/Read/Write/Edit/Grep/Glob/Agent/...）
  ├── 权限检查（5 种模式）
  └── 上下文管理（200K token，自动压缩）
  ↓
Anthropic Messages API（Prompt Cache 92% 命中）
  ↓
Claude 模型响应
```

**核心数据：**
- 源码规模：1,906 文件 / 515,029 行 TypeScript
- 运行时：Bun
- UI：React + Ink（终端渲染）
- 工具：40+ 内置工具 + 无限 MCP 扩展
- 上下文：200K token 窗口
- 斜杠命令：90+

## 目录

| 章节 | 主题 | 核心问题 |
|------|------|----------|
| [00-overview](./00-overview/) | 全局架构概览 | Claude Code 的整体设计哲学是什么？ |
| [01-system-prompt](./01-system-prompt/) | System Prompt 分层设计 | 为什么要分静态区和动态区？怎么做到 92% cache 命中？ |
| [02-agentic-loop](./02-agentic-loop/) | Agent Loop 核心循环 | 一次对话从输入到输出，内部发生了什么？ |
| [03-tool-system](./03-tool-system/) | 工具系统架构 | 40+ 工具如何注册、调度、执行？ |
| [04-permission-model](./04-permission-model/) | 权限安全模型 | 5 种权限模式怎么运作？Bash 命令如何做安全检查？ |
| [05-context-management](./05-context-management/) | 上下文管理与压缩 | 200K 窗口不够用怎么办？自动压缩策略是什么？ |
| [06-prompt-caching](./06-prompt-caching/) | Prompt Cache 优化 | 怎样设计 prompt 才能最大化缓存命中？ |
| [07-multi-agent](./07-multi-agent/) | 多 Agent 协作 | 子 Agent 怎么生成？Team 模式怎么并行？ |
| [08-mcp-integration](./08-mcp-integration/) | MCP 协议集成 | 如何通过 MCP 无限扩展工具能力？ |
| [09-startup-optimization](./09-startup-optimization/) | 启动性能优化 | 并行预取、懒加载、死代码消除怎么配合？ |
| [10-feature-flags](./10-feature-flags/) | Feature Flag 体系 | KAIROS、PROACTIVE 等隐藏功能揭秘 |
| [11-security](./11-security/) | 安全机制深度分析 | 命令注入防护、沙箱隔离、只读模式怎么实现？ |

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | [Bun](https://bun.sh) |
| 语言 | TypeScript (strict) |
| 终端 UI | React + [Ink](https://github.com/vadimdemedes/ink) |
| CLI 解析 | Commander.js (extra-typings) |
| Schema 校验 | Zod v4 |
| 代码搜索 | ripgrep |
| 协议 | MCP SDK, LSP |
| API | Anthropic SDK |
| 遥测 | OpenTelemetry + gRPC |
| Feature Flag | GrowthBook |
| 认证 | OAuth 2.0, JWT, macOS Keychain |

## 源码获取

本项目分析基于 npm 公开包中的 source map 提取：

```bash
# 1. 下载 npm 包
npm pack @anthropic-ai/claude-code@2.1.88 --registry https://registry.npmjs.org

# 2. 解压
tar -xzf anthropic-ai-claude-code-2.1.88.tgz

# 3. 用 Node.js 解析 source map 提取源码
# 详见本项目 scripts/extract-sources.js
```

## 参考资料

**逆向工程项目：**
- [instructkr/claude-code](https://github.com/instructkr/claude-code) — Source map 完整源码快照
- [hitmux/HitCC](https://github.com/hitmux/HitCC) — 最全面的逆向文档
- [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) — System Prompt 全版本追踪
- [ghuntley/claude-code-source-code-deobfuscation](https://github.com/ghuntley/claude-code-source-code-deobfuscation) — LLM cleanroom 反混淆

**分析文章：**
- [How Claude Code Actually Works (KaraxAI)](https://karaxai.com/posts/how-claude-code-works-systems-deep-dive/)
- [Under the Hood of Claude Code (Pierce Freeman)](https://pierce.dev/notes/under-the-hood-of-claude-code/)
- [Architecture & Internals (Bruniaux)](https://cc.bruniaux.com/guide/architecture/)
- [Digging into the Source (Dave Schumaker)](https://daveschumaker.net/digging-into-the-claude-code-source-saved-by-sublime-text/)

## 贡献

欢迎 PR！如果你对某个模块有深入理解，或者发现了本项目的错误，请提交 Issue 或 PR。

**贡献方向：**
- 补充章节内容（特别是标记为 WIP 的部分）
- 添加架构图和流程图
- 纠正技术细节错误
- 翻译为其他语言

## 声明

本项目仅用于教育和技术研究目的。所有 Claude Code 源码的知识产权归 Anthropic 所有。本项目不包含任何原始源码，仅包含架构分析和原理解读。

---

<p align="center">
  <sub>如果觉得有用，请给个 Star ⭐ — 这是持续更新的最大动力</sub>
</p>
