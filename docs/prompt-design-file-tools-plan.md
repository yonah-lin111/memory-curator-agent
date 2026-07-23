# Prompt Design AI — 文件读取工具实现方案

> 为 Prompt Design AI 添加 read / glob / grep 三个文件读取工具，仅限 prompt-design AI 使用，限制在项目目录内访问，配套完整工具步骤 UI。

---

## 一、架构总览

### 当前状态

- `promptAiHandlers.ts:184` — `tools: []`，Prompt Design AI 无任何工具
- `runReactAgent()` 已支持工具循环（tool_started/finished/failed 事件）
- `PromptAiPersistenceService` 持久层已有 `tool_steps_json` 和 `parts_json` 字段，但从未写入
- 事件处理仅转发 `run_started` / `text_delta` / `turn_finished`，不处理工具事件
- 前端 `usePromptAiChatController` 和 `PromptAiChatMessageBubble` 无工具步骤渲染逻辑

### 目标架构

```
用户消息 → promptAiHandlers.ts
  → 解析项目目录（designItemId → project.path）
  → 创建文件工具集 [read, glob, grep]
  → runReactAgent({ tools: [read, glob, grep] })
  → 流式事件（含 tool_started / tool_finished）
  → 持久化 tool_steps + parts
  → IPC 转发到前端
  → 前端渲染工具步骤 UI（复用 AiToolCallBlock）
```

---

## 二、工具实现

### 2.1 工具定义文件结构

```
src/main/agent/tools/
├── promptFileTools/
│   ├── index.ts              # createPromptFileTools() 工厂函数
│   ├── readTool.ts           # 文件/目录读取工具
│   ├── globTool.ts           # 文件名模式匹配工具
│   ├── grepTool.ts           # 内容正则搜索工具
│   └── pathGuard.ts          # 路径安全校验（限制项目目录内）
```

### 2.2 路径安全守卫 — `pathGuard.ts`

参考 opencode 的 `assertExternalDirectoryEffect`，核心逻辑：

```typescript
/**
 * 校验目标路径是否在项目目录内。
 * 解析为绝对路径后检查前缀，防止 ../../../etc/passwd 等路径穿越。
 */
const assertInsideProject = (projectRoot: string, targetPath: string): void => {
  const resolved = path.resolve(targetRoot, targetPath)
  if (!resolved.startsWith(projectRoot + path.sep) && resolved !== projectRoot) {
    throw new Error(`Access denied: ${targetPath} is outside the project directory`)
  }
}
```

### 2.3 Read 工具 — `readTool.ts`

参考 opencode `read.ts`，适配 AgentTool 接口：

| 参数 | 类型 | 说明 |
|------|------|------|
| `filePath` | `string` | 绝对路径（文件或目录） |
| `offset` | `number?` | 起始行号（1-indexed），默认 1 |
| `limit` | `number?` | 最大读取行数，默认 2000 |

**核心逻辑：**
- 目录 → 读取条目列表，追加 `/` 后缀，排序
- 文件 → 逐行流式读取（`createReadStream` + `readline`）
- 二进制检测 → 扩展名黑名单 + 空字节检测 + 不可打印字符比例 > 0.3
- 截断控制 → 单行 ≤ 2000 字符，总输出 ≤ 50KB
- 输出格式 → `<path>`, `<type>`, `<content>` XML 标签包裹，行号前缀

**与 opencode 差异：**
- 去掉 LSP warming、Instruction resolve、图片/PDF 附件支持（Electron 桌面应用不需要）
- 去掉 Effect 依赖，使用纯 async/await + Node.js fs API
- 路径校验使用 `assertInsideProject` 替代 `assertExternalDirectoryEffect`

### 2.4 Glob 工具 — `globTool.ts`

参考 opencode `glob.ts`：

| 参数 | 类型 | 说明 |
|------|------|------|
| `pattern` | `string` | glob 模式，如 `**/*.ts` |
| `path` | `string?` | 搜索目录，默认项目根目录 |

**核心逻辑：**
- 使用 `child_process.execFile('rg', ['--files', '--glob', pattern, cwd])` 调用 ripgrep
- 结果按修改时间排序（`fs.stat` 获取 mtime），限制 100 条
- 若 `rg` 不可用，fallback 到 `node:fs` 递归 + `picomatch` 匹配

### 2.5 Grep 工具 — `grepTool.ts`

参考 opencode `grep.ts`：

| 参数 | 类型 | 说明 |
|------|------|------|
| `pattern` | `string` | 正则表达式 |
| `path` | `string?` | 搜索目录，默认项目根目录 |
| `include` | `string?` | 文件过滤模式，如 `*.ts` |

**核心逻辑：**
- 使用 `rg --json --line-number` 搜索，解析 JSON 输出
- 结果按修改时间排序，限制 100 条
- 输出格式：`文件路径:\n  Line N: 内容`
- 单行截断 2000 字符

### 2.6 工厂函数 — `index.ts`

```typescript
/**
 * 创建 Prompt Design AI 专用文件读取工具集。
 * 所有工具限定在 projectRoot 目录内操作。
 */
export const createPromptFileTools = (projectRoot: string): AgentTool[] => [
  createReadTool(projectRoot),
  createGlobTool(projectRoot),
  createGrepTool(projectRoot),
]
```

### 2.7 工具描述

工具的 `description` 和 `prompt` 字段参考 opencode 的 `.txt` 描述文件，翻译为中文并适配项目规范（`AgentToolPrompt` 结构化格式）。

---

## 三、主进程集成

### 3.1 解析项目目录

在 `promptAiHandlers.ts` 的 `runPromptAiChat` 中，根据 `designItemId` 查询项目路径：

```typescript
// 通过 designItemId 关联到 project.path
const projectRoot = await resolveProjectRoot(payload.designItemId)
const tools = projectRoot ? createPromptFileTools(projectRoot) : []
```

需要在 `promptDesignService` 或 `PromptAiPersistenceService` 中新增查询方法：
```sql
SELECT p.path
FROM prompt_design_items di
JOIN prompt_design_projects p ON p.id = di.project_id
WHERE di.id = ? AND p.type = 'filesystem' AND p.path IS NOT NULL
```

### 3.2 传入工具到 runReactAgent

修改 `promptAiHandlers.ts:184`：
```typescript
// Before:  tools: []
// After:   tools: projectRoot ? createPromptFileTools(projectRoot) : []
```

### 3.3 处理工具事件

在 `runPromptAiChat` 的事件循环中增加 `tool_started` / `tool_finished` / `tool_failed` 处理：

```typescript
for await (const event of generator) {
  if (event.type === 'tool_started') {
    // 1. 记录 tool step（status: running）
    // 2. 追加 tool part 到 parts 数组
    // 3. 持久化到 DB
    // 4. IPC 转发到前端
  } else if (event.type === 'tool_finished') {
    // 1. 更新 tool step（status: done, observation, data）
    // 2. 持久化到 DB
    // 3. IPC 转发到前端
  } else if (event.type === 'tool_failed') {
    // 1. 更新 tool step（status: failed, error）
    // 2. 持久化到 DB
    // 3. IPC 转发到前端
  }
  // ... 已有的 text_delta / turn_finished 处理
}
```

### 3.4 持久化增强

`PromptAiPersistenceService` 需要新增：

```typescript
/**
 * 更新消息的工具步骤和片段数据。
 */
upsertToolSteps(
  messageId: string,
  toolSteps: AiToolStep[],
  parts: AiChatMessagePart[]
): void
```

参考 `chatRunner.ts` 的 `activeRun` 模式，在内存中维护 `assistantToolSteps[]` 和 `assistantParts[]`，每轮结束时写入 DB。

### 3.5 消息重建时加载工具数据

修改 `runPromptAiChat` 中重建 `agentMessages` 的逻辑，当前仅读取 `content`：

```typescript
// 当前：只读 content
role: m.role, content: m.content

// 修改为：同时读取 toolSteps，重建 tool role 消息
```

对于历史消息中的工具调用，需要将 `toolSteps` 和 `parts` 重建为 `AgentMessage[]` 格式（assistant 消息带 `toolCalls`，后续跟 tool role 消息），否则多轮工具对话上下文会断裂。

---

## 四、前端 UI 集成

### 4.1 类型扩展

`usePromptAiChatController.ts` 中的 `PromptAiMessage` 类型扩展：

```typescript
export type PromptAiMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  time: string
  model?: string
  // 新增 ↓
  toolSteps?: AiToolStep[]
  parts?: AiChatMessagePart[]
}
```

### 4.2 事件处理扩展

在 `onChatEvent` 回调中增加工具事件处理：

- `tool_started` → 在当前 assistant 消息中追加 tool step（status: running）
- `tool_finished` → 更新对应 tool step（status: done），设置 observation/data
- `tool_failed` → 更新对应 tool step（status: failed），设置 error

### 4.3 消息气泡渲染

修改 `PromptAiChatMessageBubble.tsx`，在文本内容之间插入工具步骤渲染：

- 复用 `ai-chat` 的 `AiToolCallBlock` 组件
- 根据 `message.parts` 的顺序，交错渲染文本和工具步骤
- 工具步骤使用时间线样式（状态图标 + 工具名 + 输出摘要）

### 4.4 loadSession 恢复

`loadSession` 已从后端获取 `toolSteps` 和 `parts`（DB 中 `tool_steps_json` 和 `parts_json` 字段），需要在映射消息时一并恢复。

---

## 五、实施步骤

### Phase 1：工具定义（主进程）

1. 创建 `src/main/agent/tools/promptFileTools/` 目录
2. 实现 `pathGuard.ts` — 路径安全校验
3. 实现 `readTool.ts` — 文件/目录读取
4. 实现 `globTool.ts` — 文件名模式匹配
5. 实现 `grepTool.ts` — 内容正则搜索
6. 实现 `index.ts` — 工厂函数 `createPromptFileTools()`

### Phase 2：主进程集成

7. 新增 `resolveProjectRoot(designItemId)` 查询方法
8. 修改 `promptAiHandlers.ts` — 注入工具 + 处理工具事件 + 持久化
9. 增强 `PromptAiPersistenceService` — `upsertToolSteps()` + 消息重建

### Phase 3：前端 UI

10. 扩展 `PromptAiMessage` 类型
11. 扩展 `usePromptAiChatController` 事件处理
12. 修改 `PromptAiChatMessageBubble` 集成 `AiToolCallBlock`
13. 处理 `loadSession` 时的工具数据恢复

### Phase 4：验证

14. `npx tsc --noEmit` 编译检查
15. 功能测试：在 prompt-design AI 中触发文件读取、glob、grep
16. 安全测试：尝试访问项目目录外文件，确认被拒绝
17. 持久化测试：刷新后工具步骤正确恢复

---

## 六、关键文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/main/agent/tools/promptFileTools/*` | 新建 | 三个文件工具实现 |
| `src/main/ipc/promptAiHandlers.ts` | 修改 | 注入工具、处理工具事件、持久化 |
| `src/main/services/promptAiPersistenceService.ts` | 修改 | 新增 upsertToolSteps、消息重建 |
| `src/main/services/promptDesignService.ts` | 修改 | 新增 resolveProjectRoot 查询 |
| `src/renderer/.../usePromptAiChatController.ts` | 修改 | 扩展类型、处理工具事件 |
| `src/renderer/.../PromptAiChatMessageBubble.tsx` | 修改 | 集成 AiToolCallBlock 渲染 |
| `src/preload/index.ts` | 无需修改 | IPC 事件通道已通用 |

---

## 七、风险与注意事项

1. **ripgrep 依赖**：glob/grep 工具依赖系统安装的 `rg` 命令。需检测可用性并提供 Node.js fallback（`node:fs` 递归 + 正则匹配），避免在未安装 ripgrep 的环境崩溃。
2. **消息上下文完整性**：历史消息重建时必须将 tool steps 还原为 `AgentMessage` 格式（assistant + tool_calls → tool role 消息），否则多轮工具对话上下文断裂。
3. **虚拟项目降级**：`project.type === 'virtual'` 的项目无文件系统路径，工具列表为空，AI 不应感知到文件工具的存在。
4. **并发安全**：工具执行在 `runReactAgent` 的顺序循环中，不存在并发写入问题。
5. **输出体积**：单个工具输出最大 50KB，2000 行。大文件通过 offset/limit 分页读取，大目录通过截断提示引导 AI 分页。
