# 09 — 启动性能优化

> 并行预取 + 懒加载 + 死代码消除的组合拳

## 核心洞察

Claude Code 的启动路径经过精心优化。`main.tsx` 的前 20 行就体现了核心思想：

```typescript
// 这些副作用必须在所有其他 import 之前运行：
// 1. profileCheckpoint 在重量级模块求值之前标记入口
// 2. startMdmRawRead 启动 MDM 子进程（plutil/reg query），
//    与下面约 135ms 的 import 并行执行
// 3. startKeychainPrefetch 并行启动两个 macOS keychain 读取
//    否则 isRemoteManagedSettingsEligible() 会同步顺序读取
//    （每次 macOS 启动增加约 65ms）

profileCheckpoint('main_tsx_entry');
startMdmRawRead();
startKeychainPrefetch();
```

**关键技巧：** 利用 JavaScript 的 import 求值顺序 — 在 import 语句之间插入副作用调用，让这些异步操作与后续 135ms 的模块加载并行执行。

## 三大优化策略

### 1. 并行预取

在模块还在加载时就启动 I/O 操作：
- MDM 设置读取（子进程调用 plutil/reg query）
- macOS Keychain 读取（OAuth token + API key）
- GrowthBook Feature Flag 初始化
- API 预连接

### 2. 懒加载

重量级模块延迟到实际需要时才加载：
- OpenTelemetry（遥测）
- gRPC（远程通信）
- Analytics（分析）
- Feature Flag 控制的子系统

```typescript
// 懒加载打破循环依赖
const getTeammateUtils = () =>
  require('./utils/teammate.js') as typeof import('./utils/teammate.js')
```

### 3. 死代码消除

Bun 的 `feature()` 函数在构建时求值，未启用的功能代码被完全删除：

```typescript
import { feature } from 'bun:bundle'

// 如果 VOICE_MODE 为 false，整个 require 在构建时被移除
const voiceCommand = feature('VOICE_MODE')
  ? require('./commands/voice/index.js').default
  : null
```

## 启动 Profile

源码内置了启动性能追踪：

```typescript
profileCheckpoint('main_tsx_entry')
// ... 模块加载 ...
profileCheckpoint('before_getSystemPrompt')
// ... prompt 组装 ...
profileCheckpoint('after_getSystemPrompt')
```

## 下一步

- [10 — Feature Flag 体系](../10-feature-flags/) — 死代码消除依赖的 Feature Flag 机制
- [00 — 全局架构概览](../00-overview/) — 启动优化在整体架构中的位置
