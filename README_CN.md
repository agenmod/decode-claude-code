<div align="center">

# Decode Claude Code

### 深度解剖 Anthropic AI 编程 Agent 的架构设计与实现原理

**1,906 个源文件 · 515,029 行代码 · 从 npm source map 完整提取**

[![GitHub stars](https://img.shields.io/github/stars/agenmod/decode-claude-code?style=social)](https://github.com/agenmod/decode-claude-code)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[**English Version →**](./README.md)

---

*Claude Code 拥有 85k+ GitHub Stars，每天驱动数百万次编程会话。*
*但从你输入 prompt 到收到响应之间，内部到底发生了什么？*

*我们逐层拆解了所有细节 — 你不用再猜了。*

</div>

## 这个项目是什么

2026 年 3 月 31 日，Anthropic 发布的 `@anthropic-ai/claude-code@2.1.88` npm 包中包含了一个 **59.8MB 的 source map 文件**（`cli.js.map`）。这个文件内含完整的、未混淆的 TypeScript 源码 — 1,906 个文件，515,029 行代码。

本项目**不是代码转储**。它是一份结构化的、逐章节的架构分析，回答的是 **Claude Code 怎么工作、为什么这样设计**。

核心问题包括：

- System Prompt 为什么用 `__DYNAMIC_BOUNDARY__` 标记分割静态区和动态区？
- 核心循环为什么只是 `while(tool_call)`，没有 DAG 也没有规划器？
- **92% 的 Prompt Cache 命中率** 是怎么做到的？
- `KAIROS`、`PROACTIVE`、`COORDINATOR_MODE` 等 Feature Flag 揭示了哪些未发布功能？
- 7,000+ 行 Bash 安全代码在防什么？

## 架构全景

```
  你的终端
       │
       ▼
  ┌─────────────────────────────────────────────┐
  │        Claude Code CLI  (Bun + React/Ink)    │
  │                                              │
  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
  │  │ System   │  │  Agent   │  │  权限      │  │
  │  │ Prompt   │  │  Loop    │  │  系统      │  │
  │  │ 组装     │  │ (while)  │  │ (5 种模式) │  │
  │  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
  │       │             │              │          │
  │  ┌────┴─────────────┴──────────────┴───────┐  │
  │  │        40+ 工具 · 90+ 斜杠命令           │  │
  │  │   Bash│Read│Write│Edit│Grep│Glob│Agent   │  │
  │  └────────────────────┬────────────────────┘  │
  │                       │                       │
  │  ┌────────────────────┴────────────────────┐  │
  │  │  上下文管理 (200K tokens)                 │  │
  │  │  75-92% 容量时自动压缩                    │  │
  │  └────────────────────┬────────────────────┘  │
  └───────────────────────┼───────────────────────┘
                          │
                          ▼
              Anthropic Messages API
             (Prompt Cache: 92% 命中率)
```

**核心数据：**

| 指标 | 数值 |
|------|------|
| 源文件数 | 1,906 |
| 代码行数 | 515,029 |
| 内置工具 | 40+ |
| 斜杠命令 | 90+ |
| 上下文窗口 | 200K tokens |
| Prompt Cache 命中率 | 92% |
| Bash 安全代码 | 7,000+ 行 |

## 目录

> 每章都是独立的深度分析。可以按顺序阅读，也可以跳到感兴趣的部分。

| # | 章节 | 核心问题 | 链接 |
|---|------|----------|------|
| 00 | **全局架构概览** | Claude Code 的整体设计哲学是什么？ | [阅读 →](./00-overview/README.md) |
| 01 | **System Prompt 分层设计** | 为什么分静态区和动态区？怎么做到 92% 缓存命中？ | [阅读 →](./01-system-prompt/README.md) |
| 02 | **Agent Loop 核心循环** | 一次请求从输入到输出，内部发生了什么？ | [阅读 →](./02-agentic-loop/README.md) |
| 03 | **工具系统架构** | 40+ 工具如何注册、调度、执行？ | [阅读 →](./03-tool-system/README.md) |
| 04 | **权限安全模型** | 5 种权限模式怎么运作？Bash 命令如何做安全检查？ | [阅读 →](./04-permission-model/README.md) |
| 05 | **上下文管理与压缩** | 200K 窗口不够用怎么办？自动压缩策略是什么？ | [阅读 →](./05-context-management/README.md) |
| 06 | **Prompt Cache 优化** | 怎样设计 prompt 才能最大化缓存命中？ | [阅读 →](./06-prompt-caching/README.md) |
| 07 | **多 Agent 协作** | 子 Agent 怎么生成？Team 模式怎么并行？ | [阅读 →](./07-multi-agent/README.md) |
| 08 | **MCP 协议集成** | 如何通过 MCP 无限扩展工具能力？ | [阅读 →](./08-mcp-integration/README.md) |
| 09 | **启动性能优化** | 并行预取、懒加载、死代码消除怎么配合？ | [阅读 →](./09-startup-optimization/README.md) |
| 10 | **Feature Flag 体系** | KAIROS、PROACTIVE 等隐藏功能揭秘 | [阅读 →](./10-feature-flags/README.md) |
| 11 | **安全机制深度分析** | 命令注入防护、沙箱隔离、只读模式怎么实现？ | [阅读 →](./11-security/README.md) |

## 你在别处看不到的亮点

<details>
<summary><b>🔥 内部员工 vs 外部用户 — Anthropic 员工用的是不一样的 Claude</b></summary>

```typescript
// 外部用户版本：
"Go straight to the point. Try the simplest approach first."

// 内部用户版本 (USER_TYPE === 'ant')：
"Write user-facing text in flowing prose while eschewing fragments,
 excessive em dashes, symbols and notation..."
// + 数字化长度锚定："工具调用间 ≤25 词"
// + 主动反馈："发现用户的请求基于误解时，直接指出"
```

内部版更啰嗦、更有主见、会主动挑战用户假设。外部版简洁且顺从。

→ [完整分析见第 01 章](./01-system-prompt/README.md)
</details>

<details>
<summary><b>🔥 10.2% 缓存灾难 — 一个动态列表烧掉了数百万 token</b></summary>

Agent 列表嵌入在 AgentTool 的工具描述中。MCP 连接变化 → Agent 列表变化 → 工具 schema 变化 → **整个 prompt cache 失效**。

这一个问题消耗了**平台级 10.2% 的 cache 创建 token**。

修复方案：将 Agent 列表移到消息附件（`agent_listing_delta`），从可缓存的 schema 中移除。

→ [完整分析见第 06 章](./06-prompt-caching/README.md)
</details>

<details>
<summary><b>🔥 KAIROS — Claude Code 未发布的「助理模式」</b></summary>

隐藏在 `KAIROS` Feature Flag 后面，这个模式将 Claude Code 从被动工具变成**主动助手**：
- 定时休眠和唤醒（`SleepTool`）
- 向手机推送通知（`PushNotificationTool`）
- 订阅 PR 变更（`SubscribePRTool`）
- 向用户发送文件（`SendUserFileTool`）
- 生成每日简报（`BriefTool`）

→ [完整分析见第 10 章](./10-feature-flags/README.md)
</details>

<details>
<summary><b>🔥 20 行代码省 65ms 的启动优化黑魔法</b></summary>

```typescript
// main.tsx 前 20 行，在所有其他 import 之前：
profileCheckpoint('main_tsx_entry');
startMdmRawRead();      // 启动 MDM 子进程
startKeychainPrefetch(); // 并行启动 2 个 keychain 读取
// ... 然后 135ms 的重量级模块 import 开始 ...
// 等 import 完成时，I/O 结果已经就绪了
```

利用 JavaScript 的 import 求值顺序，将 I/O 操作与模块加载并行执行。

→ [完整分析见第 09 章](./09-startup-optimization/README.md)
</details>

## 源码提取方法

```bash
# 1. 下载 npm 包
npm pack @anthropic-ai/claude-code@2.1.88 --registry https://registry.npmjs.org

# 2. 解压
tar -xzf anthropic-ai-claude-code-2.1.88.tgz

# 3. 从 source map 提取源码
node scripts/extract-sources.js ./package/cli.js.map ./extracted-src
# → 1,906 个文件，515,029 行代码
```

## 事件时间线

| 日期 | 事件 |
|------|------|
| 2025-02-24 | v0.2.8 包含 inline base64 source map — 被开发者通过 Sublime Text undo 恢复 |
| 2025-03 | Anthropic 紧急推送更新移除 source map，并从 npm 删除旧版本 |
| 2026-03-06 | Agent SDK 意外包含完整 CLI（v2.1.71，13,800 行混淆代码） |
| 2026-03-27 | CMS 配置错误泄露 ~3,000 份内部文档，含 Claude Mythos 模型信息 |
| 2026-03-31 | v2.1.88 包含 `cli.js.map`（59.8MB）— 全部 1,906 个源文件可提取 |

## 相关项目

**源码与逆向工程：**
- [instructkr/claude-code](https://github.com/instructkr/claude-code) — Source map 完整源码快照（5.5k stars）
- [hitmux/HitCC](https://github.com/hitmux/HitCC) — 最全面的逆向工程文档（81 文件，27K 行）
- [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) — 跨 136+ 版本的 System Prompt 追踪
- [ghuntley/claude-code-source-code-deobfuscation](https://github.com/ghuntley/claude-code-source-code-deobfuscation) — LLM cleanroom 反混淆

**分析文章：**
- [How Claude Code Actually Works — KaraxAI](https://karaxai.com/posts/how-claude-code-works-systems-deep-dive/)
- [Under the Hood — Pierce Freeman](https://pierce.dev/notes/under-the-hood-of-claude-code/)
- [Architecture & Internals — Bruniaux](https://cc.bruniaux.com/guide/architecture/)
- [Digging into the Source — Dave Schumaker](https://daveschumaker.net/digging-into-the-claude-code-source-saved-by-sublime-text/)

## 贡献

欢迎 PR，特别是以下方向：
- 深化骨架/WIP 状态的章节
- 添加架构图
- 纠正技术错误
- 多语言翻译

## 声明

本项目仅用于**教育和研究目的**。Claude Code 的所有知识产权归 Anthropic 所有。本仓库不包含任何原始源码，仅包含架构分析和设计解读。

---

<div align="center">

**觉得有用的话，给个 ⭐ 吧**

*Built by [agenmod](https://github.com/agenmod)*

</div>
