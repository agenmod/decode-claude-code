# 04 — 权限安全模型

> 每次工具调用前的安全闸门：5 种权限模式 + 多层安全检查

## 核心洞察

Claude Code 的权限系统是一个**多层防御**架构。不是简单的"允许/拒绝"，而是：

```
工具调用请求
  ↓
1. 权限模式检查（default/plan/auto/bypassPermissions/...）
  ↓
2. 工具级只读检查（isReadOnly()）
  ↓
3. 输入级检查（needsPermission(input)）
  ↓
4. 命令安全分析（仅 BashTool）
  ↓
5. 路径验证（是否在工作目录内）
  ↓
6. 破坏性操作检测
  ↓
允许执行 / 提示用户确认 / 拒绝
```

## 五种权限模式

| 模式 | 行为 | 使用场景 |
|------|------|----------|
| `default` | 只读工具自动允许，写入工具需确认 | 日常交互 |
| `plan` | 所有写入操作被阻止 | Plan 模式 |
| `auto` | 除高风险操作外全部自动允许 | CI/CD 和脚本 |
| `bypassPermissions` | 全部自动允许 | 完全自动化 |
| 自定义 | 按工具+路径粒度配置 | 企业策略 |

## BashTool 安全机制

BashTool 的安全检查是整个系统中最复杂的部分（合计 7,000+ 行）：

### 命令语义分析

```
"cat file.txt"          → 读取操作 → 自动允许
"echo hello > file.txt" → 写入操作 → 需要确认
"rm -rf /"              → 破坏性操作 → 强制确认 + 警告
"curl ... | bash"       → 命令注入风险 → 特殊处理
```

### 只读命令白名单

源码维护了一个庞大的只读命令列表，包括：
- 文件查看：`cat`, `head`, `tail`, `less`, `wc`
- 搜索：`grep`, `find`, `rg`, `ag`
- Git 只读：`git status`, `git log`, `git diff`
- 系统信息：`uname`, `whoami`, `pwd`, `ls`

### sed 命令特殊解析

`sed` 命令既可以读取也可以修改文件。Claude Code 内置了一个 sed 命令解析器（`sedEditParser.ts`），分析 sed 表达式来判断是否包含写入操作。

## 文件路径验证

```typescript
// 检查操作路径是否在允许的目录范围内
function validatePath(path: string): boolean {
  // 1. 必须在 CWD 或附加工作目录内
  // 2. 不能包含 .. 路径逃逸
  // 3. 不能操作敏感目录（.git/hooks 等）
}
```

## 权限拒绝追踪

QueryEngine 会记录所有被拒绝的工具调用：

```typescript
if (result.behavior !== 'allow') {
  this.permissionDenials.push({
    tool_name, tool_use_id, tool_input
  })
}
```

这些拒绝记录用于：
- SDK 状态报告
- 模型行为调整（模型看到拒绝后会换策略）
- 遥测分析

## 下一步

- [11 — 安全机制深度分析](../11-security/) — 更多安全相关设计
- [03 — 工具系统架构](../03-tool-system/) — 各工具的权限配置
