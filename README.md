<div align="center">

# Decode Claude Code

### The Definitive Architecture Analysis of Anthropic's AI Coding Agent

**1,906 files · 515,029 lines · Fully extracted from npm source maps**

[![GitHub stars](https://img.shields.io/github/stars/agenmod/decode-claude-code?style=social)](https://github.com/agenmod/decode-claude-code)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[**中文版 →**](./README_CN.md)

---

*Claude Code has 85k+ GitHub stars and powers millions of coding sessions daily.*
*But what's actually happening between your prompt and the response?*

*We pulled apart every layer — so you don't have to.*

</div>

## Why This Exists

On March 31, 2026, Anthropic shipped `@anthropic-ai/claude-code@2.1.88` with a **59.8MB source map** (`cli.js.map`) still in the package. That file contained the complete, unobfuscated TypeScript source — 1,906 files, 515,029 lines of code.

This project is **not a code dump**. It's a structured, chapter-by-chapter analysis of **how Claude Code works and why it was designed this way**.

We answer questions like:

- Why does the System Prompt use a `__DYNAMIC_BOUNDARY__` marker to split static and dynamic content?
- Why is the core loop just `while(tool_call)` with no DAGs or planners?
- How did they achieve a **92% prompt cache hit rate**?
- What do feature flags like `KAIROS`, `PROACTIVE`, and `COORDINATOR_MODE` reveal about unreleased features?
- How do 7,000+ lines of Bash security code protect against command injection?

## Architecture at a Glance

```
  Your Terminal
       │
       ▼
  ┌─────────────────────────────────────────────┐
  │         Claude Code CLI  (Bun + React/Ink)   │
  │                                              │
  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
  │  │ System   │  │  Agent   │  │ Permission │  │
  │  │ Prompt   │  │  Loop    │  │  System    │  │
  │  │ Assembly │  │ (while)  │  │ (5 modes)  │  │
  │  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
  │       │             │              │          │
  │  ┌────┴─────────────┴──────────────┴───────┐  │
  │  │        40+ Tools · 90+ Commands          │  │
  │  │   Bash│Read│Write│Edit│Grep│Glob│Agent   │  │
  │  └────────────────────┬────────────────────┘  │
  │                       │                       │
  │  ┌────────────────────┴────────────────────┐  │
  │  │  Context Management (200K tokens)        │  │
  │  │  Auto-compaction at 75-92% capacity      │  │
  │  └────────────────────┬────────────────────┘  │
  └───────────────────────┼───────────────────────┘
                          │
                          ▼
              Anthropic Messages API
             (Prompt Cache: 92% reuse)
```

**Key numbers:**

| Metric | Value |
|--------|-------|
| Source files | 1,906 |
| Lines of code | 515,029 |
| Built-in tools | 40+ |
| Slash commands | 90+ |
| Context window | 200K tokens |
| Prompt cache hit rate | 92% |
| Bash security code | 7,000+ lines |

## Table of Contents

> Each chapter is a self-contained deep-dive. Read in order or jump to what interests you.

| # | Chapter | Key Question | Link |
|---|---------|-------------|------|
| 00 | **Architecture Overview** | What is Claude Code's design philosophy? | [Read →](./00-overview/README.md) |
| 01 | **System Prompt Design** | Why split into static/dynamic zones? How to hit 92% cache? | [Read →](./01-system-prompt/README.md) |
| 02 | **The Agentic Loop** | What happens inside a single request, from input to output? | [Read →](./02-agentic-loop/README.md) |
| 03 | **Tool System** | How are 40+ tools registered, dispatched, and executed? | [Read →](./03-tool-system/README.md) |
| 04 | **Permission Model** | How do 5 permission modes work? How is Bash sandboxed? | [Read →](./04-permission-model/README.md) |
| 05 | **Context Management** | What happens when 200K tokens run out? Auto-compaction? | [Read →](./05-context-management/README.md) |
| 06 | **Prompt Caching** | How to design prompts for maximum cache reuse? | [Read →](./06-prompt-caching/README.md) |
| 07 | **Multi-Agent** | How are sub-agents spawned? How does Team mode work? | [Read →](./07-multi-agent/README.md) |
| 08 | **MCP Integration** | How does MCP extend tool capabilities infinitely? | [Read →](./08-mcp-integration/README.md) |
| 09 | **Startup Optimization** | Parallel prefetch + lazy loading + dead code elimination? | [Read →](./09-startup-optimization/README.md) |
| 10 | **Feature Flags** | What are KAIROS, PROACTIVE, and other hidden features? | [Read →](./10-feature-flags/README.md) |
| 11 | **Security** | 7,000+ lines of Bash security — what are they checking? | [Read →](./11-security/README.md) |

## Highlights You Won't Find Elsewhere

<details>
<summary><b>🔥 Internal vs External prompts — Anthropic employees get a different Claude</b></summary>

```typescript
// External users get:
"Go straight to the point. Try the simplest approach first."

// Internal users (USER_TYPE === 'ant') get:
"Write user-facing text in flowing prose while eschewing fragments,
 excessive em dashes, symbols and notation..."
// + numeric length anchors: "≤25 words between tool calls"
// + assertiveness: "If you notice the user's request is based
//   on a misconception, say so."
```

Internal Claude Code is more verbose, more opinionated, and actively challenges user assumptions. External Claude is concise and compliant.

→ [Full analysis in Chapter 01](./01-system-prompt/README.md)
</details>

<details>
<summary><b>🔥 The 10.2% cache disaster — one dynamic list cost millions</b></summary>

The Agent list was embedded in AgentTool's description (part of the tool schema). MCP connections changed → agent list changed → tool schema changed → **entire prompt cache invalidated**.

This single issue consumed **10.2% of fleet-wide cache creation tokens**.

Fix: moved agent list to a message attachment (`agent_listing_delta`), removing it from the cacheable schema.

→ [Full analysis in Chapter 06](./06-prompt-caching/README.md)
</details>

<details>
<summary><b>🔥 KAIROS — Claude Code's unreleased "Assistant Mode"</b></summary>

Hidden behind the `KAIROS` feature flag, this mode transforms Claude Code from a reactive tool into a **proactive assistant** that can:
- Sleep and wake on schedule (`SleepTool`)
- Push notifications to your phone (`PushNotificationTool`)
- Subscribe to PR changes (`SubscribePRTool`)
- Send files to you (`SendUserFileTool`)
- Generate daily briefs (`BriefTool`)

→ [Full analysis in Chapter 10](./10-feature-flags/README.md)
</details>

<details>
<summary><b>🔥 The 20-line startup trick that saves 65ms</b></summary>

```typescript
// main.tsx — first 20 lines, BEFORE any other imports:
profileCheckpoint('main_tsx_entry');
startMdmRawRead();      // fires MDM subprocess
startKeychainPrefetch(); // fires 2 keychain reads in parallel
// ... then 135ms of heavy module imports happen ...
// By the time imports finish, I/O results are already available
```

They exploit JavaScript's import evaluation order to overlap I/O with module loading.

→ [Full analysis in Chapter 09](./09-startup-optimization/README.md)
</details>

<details>
<summary><b>🔥 Auto Dream — Claude "dreams" when you're away, consolidating memories like a human</b></summary>

`src/services/autoDream/` implements background memory consolidation. When you haven't used Claude Code for 24+ hours and 5+ sessions have accumulated, it spawns a sub-agent that:

1. **Orients** — reads existing memory directory
2. **Gathers** — scans logs, greps session transcripts for new signal
3. **Consolidates** — merges new info, converts relative dates to absolute, deletes contradicted facts
4. **Prunes** — keeps the index file under 25KB

The dream agent runs with read-only Bash (can `grep` but not `rm`), uses file locking to prevent concurrent dreams, and shows progress in the task manager UI.

```typescript
const DEFAULTS = { minHours: 24, minSessions: 5 }
```

→ [Full analysis in Chapter 10](./10-feature-flags/README.md)
</details>

<details>
<summary><b>🔥 Undercover Mode — Anthropic employees go invisible on public repos</b></summary>

`src/utils/undercover.ts` reveals a mode that **auto-activates** when Anthropic employees work on public repositories. It strips all AI attribution and injects this prompt:

```
UNDERCOVER MODE — CRITICAL
You are operating UNDERCOVER in a PUBLIC/OPEN-SOURCE repository.
NEVER include: "Claude Code", model codenames, Co-Authored-By lines,
or any mention that you are an AI.
Write commit messages as a human developer would.
```

There is **no force-OFF switch**. If not in an allowlisted internal repo, undercover mode stays on. This means Anthropic employees' open-source contributions are indistinguishable from human-written code.

→ [Full analysis in Chapter 10](./10-feature-flags/README.md)
</details>

<details>
<summary><b>🔥 Buddy System — A full Tamagotchi hidden inside a coding tool</b></summary>

`src/buddy/` contains a complete virtual pet system with:
- **18 species**: duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk
- **5 rarity tiers**: Common (60%) → Legendary (1%), with 1% Shiny variants
- **ASCII art sprites** with 3-frame idle animations per species
- **Stats**: DEBUGGING / PATIENCE / CHAOS / WISDOM / SNARK
- **Hats**: crown, tophat, propeller, halo, wizard, beanie, tinyduck

Generated deterministically from `hash(userId)` — every user gets the same pet forever. The pet sits beside the input box and occasionally comments via speech bubble.

→ [Full analysis in Chapter 10](./10-feature-flags/README.md)
</details>

## Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Language | TypeScript (strict) |
| Terminal UI | React + [Ink](https://github.com/vadimdemedes/ink) |
| CLI Parsing | [Commander.js](https://github.com/tj/commander.js) (extra-typings) |
| Schema Validation | [Zod v4](https://zod.dev) |
| Code Search | [ripgrep](https://github.com/BurntSushi/ripgrep) |
| Protocols | [MCP SDK](https://modelcontextprotocol.io), LSP |
| API | [Anthropic SDK](https://docs.anthropic.com) |
| Telemetry | OpenTelemetry + gRPC |
| Feature Flags | GrowthBook |
| Auth | OAuth 2.0, JWT, macOS Keychain |

## Reproduce the Extraction

```bash
# 1. Download the npm package
npm pack @anthropic-ai/claude-code@2.1.88 --registry https://registry.npmjs.org

# 2. Unpack
tar -xzf anthropic-ai-claude-code-2.1.88.tgz

# 3. Extract sources from the map file
node scripts/extract-sources.js ./package/cli.js.map ./extracted-src
# → 1,906 files, 515,029 lines
```

## Timeline

| Date | Event |
|------|-------|
| 2025-02-24 | v0.2.8 ships with inline base64 source map — recovered via Sublime Text undo |
| 2025-03 | Anthropic pushes update to remove source maps, deletes old npm versions |
| 2026-03-06 | Agent SDK accidentally bundles full CLI (v2.1.71, 13,800 lines minified) |
| 2026-03-27 | CMS misconfiguration exposes ~3,000 internal docs including Claude Mythos |
| 2026-03-31 | v2.1.88 ships with `cli.js.map` (59.8MB) — all 1,906 source files extractable |

## Related Work

**Source & Reverse Engineering:**
- [instructkr/claude-code](https://github.com/instructkr/claude-code) — Full source snapshot from source maps (5.5k stars)
- [hitmux/HitCC](https://github.com/hitmux/HitCC) — Most comprehensive RE documentation (81 files, 27K lines)
- [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) — System prompt tracking across 136+ versions
- [ghuntley/claude-code-source-code-deobfuscation](https://github.com/ghuntley/claude-code-source-code-deobfuscation) — LLM cleanroom deobfuscation

**Analysis Articles:**
- [How Claude Code Actually Works — KaraxAI](https://karaxai.com/posts/how-claude-code-works-systems-deep-dive/)
- [Under the Hood — Pierce Freeman](https://pierce.dev/notes/under-the-hood-of-claude-code/)
- [Architecture & Internals — Bruniaux](https://cc.bruniaux.com/guide/architecture/)
- [Digging into the Source — Dave Schumaker](https://daveschumaker.net/digging-into-the-claude-code-source-saved-by-sublime-text/)

## Contributing

PRs welcome. Especially:
- Deepening chapters marked as skeleton/WIP
- Adding architecture diagrams
- Correcting technical errors
- Translations

## Disclaimer

This project is for **educational and research purposes only**. All Claude Code intellectual property belongs to Anthropic. This repository contains no original source code — only architecture analysis and design explanations.

---

<div align="center">

**If you find this useful, consider giving it a ⭐**

*Built by [agenmod](https://github.com/agenmod)*

</div>
