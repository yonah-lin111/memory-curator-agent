# AI Agent 持久化方案设计

## 目标

为当前 AI Agent 建立完整、可恢复、可审计的本地持久化能力。重启应用后，用户能看到历史会话、消息、工具调用步骤和上下文来源；开发者能复盘每次 run 使用的 provider、model、上下文快照、工具入参、工具结果和错误。

首期只做本地 SQLite 持久化，不做云同步、不保存 API Key、不做未完成流式任务的断点续跑。

## 当前基线

项目是 Electron + TypeScript 桌面应用，主进程使用 `better-sqlite3` 管理本地数据库，已有 `notes`、`todos`、`snippets`、`journals`、`associated_people` 等表。AI Agent 已经在主进程执行，渲染层通过 `ai:chat:start` 发起 run，通过 `ai:chat:event` 接收流式事件。

现有问题是 AI 对话状态主要停留在渲染层内存：

- `AiChatSession`、`AiChatMessage`、`toolSteps`、`parts` 由 `App.tsx` 维护。
- `AiChatContextStore` 只在 Zustand 内存中缓存上下文条目。
- 主进程不保存 run、消息、工具调用、上下文快照。
- 应用重启后无法恢复真实聊天历史，也无法审计模型当时看到了哪些上下文。

## 方案选择

采用 SQLite 归一化事件模型，而不是单表 JSON 快照或完整 Event Sourcing。

归一化模型把会话、消息、run、工具调用和上下文快照拆成独立表。这样能保留查询能力和迁移弹性，同时复杂度仍然可控。单表 JSON 虽然实现快，但会把工具审计、上下文复盘和后续搜索变成脏活。完整 Event Sourcing 审计能力最强，但当前 UI 和主进程不需要事件投影层，属于过度设计。

## 数据模型

### `ai_chat_sessions`

保存会话列表和左侧历史列表所需字段。

- `id TEXT PRIMARY KEY`
- `title TEXT NOT NULL`
- `summary TEXT NOT NULL`
- `status TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `last_message_at TEXT NOT NULL`

索引：

- `idx_ai_chat_sessions_last_message_at`：按最近消息排序。

### `ai_chat_messages`

保存用户消息、助手消息和渲染层展示需要的消息结构。

- `id TEXT PRIMARY KEY`
- `session_id TEXT NOT NULL`
- `role TEXT NOT NULL`
- `content TEXT NOT NULL`
- `answer TEXT`
- `parts_json TEXT NOT NULL`
- `tool_steps_json TEXT NOT NULL`
- `time TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

索引：

- `idx_ai_chat_messages_session_created_at`：按会话读取消息。

`parts_json` 和 `tool_steps_json` 是 UI 展示快照，不作为唯一事实来源。工具调用的事实来源是 `ai_agent_tool_calls`，但消息表保留展示快照，避免渲染层每次重建完整交错片段。

### `ai_agent_runs`

保存每次模型运行的生命周期。

- `id TEXT PRIMARY KEY`
- `session_id TEXT NOT NULL`
- `assistant_message_id TEXT NOT NULL`
- `provider TEXT`
- `model TEXT`
- `status TEXT NOT NULL`
- `error TEXT`
- `started_at TEXT NOT NULL`
- `finished_at TEXT`

索引：

- `idx_ai_agent_runs_session_started_at`
- `idx_ai_agent_runs_assistant_message_id`

`status` 使用 `running | completed | failed`。

### `ai_agent_tool_calls`

保存 ReAct 工具调用审计链路。

- `id TEXT PRIMARY KEY`
- `run_id TEXT NOT NULL`
- `message_id TEXT NOT NULL`
- `tool_call_id TEXT NOT NULL`
- `name TEXT NOT NULL`
- `status TEXT NOT NULL`
- `input_json TEXT NOT NULL`
- `observation TEXT NOT NULL`
- `data_json TEXT NOT NULL`
- `error TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

约束：

- `UNIQUE(run_id, tool_call_id)`

索引：

- `idx_ai_agent_tool_calls_run_created_at`
- `idx_ai_agent_tool_calls_message_id`

`status` 使用 `running | done | failed`。`input_json`、`data_json` 必须始终是合法 JSON；无法序列化时写入错误对象，不能写坏数据。

### `ai_agent_context_snapshots`

保存本轮 run 启动时传给主进程的候选上下文。它是审计快照，不等同于最终进入模型窗口的完整消息，因为主进程仍会在 `contextMessages.ts` 内做预算裁剪。

- `id INTEGER PRIMARY KEY`
- `run_id TEXT NOT NULL`
- `context_key TEXT NOT NULL`
- `kind TEXT NOT NULL`
- `title TEXT NOT NULL`
- `source_id TEXT`
- `content TEXT NOT NULL`
- `tokens INTEGER`
- `created_order INTEGER NOT NULL`
- `meta_json TEXT NOT NULL`

约束：

- `UNIQUE(run_id, context_key)`

索引：

- `idx_ai_agent_context_snapshots_run_order`

## 主进程服务

新增 `src/main/services/aiChatPersistenceService.ts`，只暴露面向业务的服务方法，不让 IPC 或渲染层拼 SQL。

核心方法：

- `listSessions()`：读取最近会话列表。
- `getSession(sessionId)`：读取一个会话及消息。
- `ensureSession(input)`：创建或更新会话标题、摘要和状态。
- `appendMessage(input)`：写入用户或助手消息。
- `updateAssistantMessage(input)`：追加文本、更新 answer、parts、toolSteps。
- `startRun(input)`：写入 `ai_agent_runs` 和上下文快照。
- `finishRun(input)`：把 run 标记为 completed 或 failed。
- `upsertToolCall(input)`：按 `run_id + tool_call_id` 写入或更新工具调用。

服务层负责：

- 时间戳生成。
- JSON 安全序列化和解析。
- 数据库行到 `AiChatSession` / `AiChatMessage` 的映射。
- 对损坏 JSON 的容错，返回空数组或错误对象，不让 UI 崩溃。

## IPC 设计

扩展 preload 和类型声明：

- `ai:listSessions`
- `ai:getSession`

保留现有：

- `ai:model-options:get`
- `ai:chat:start`
- `ai:chat:event`

`ai:chat:start` 的职责扩大：

1. 校验 provider 和 model。
2. 确保 session 存在。
3. 写入用户消息。
4. 写入 assistant 占位消息。
5. 创建 run。
6. 保存上下文快照。
7. 启动 `runReactAgent`。
8. 每个流式事件同时推送给渲染层并更新数据库。

如果启动阶段在写入 run 前失败，直接抛错给调用方。如果 run 已创建后失败，必须写入 failed run，并把 assistant 消息更新为错误状态。

## 渲染层行为

`App.tsx` 启动时先通过 `window.api.ai.listSessions()` 拉取历史会话。没有历史数据时，可以继续使用现有 `AI_CHAT_SESSIONS` 作为静态示例；一旦数据库有真实会话，左侧历史列表以 SQLite 为准。

发送消息后仍然做乐观 UI 更新，保证输入体验不被磁盘写入阻塞。主进程返回 `runId` 后，后续事件继续按现有事件流更新 UI。因为主进程已经落库，刷新应用后会从 `ai:getSession` 恢复最终状态。

切换会话时，渲染层按需读取该会话详情。`AiChatContextStore` 仍负责当前会话的候选上下文管理，但历史消息和工具步骤以数据库恢复结果为准。

## 上下文策略

首期保存 `ai:chat:start` 收到的候选上下文快照：

- `message`：历史用户消息与助手回答。
- `tool`：历史工具观察与结构化数据摘要。
- `memory | page | file | agent`：保留类型能力，等对应来源接入后自然落库。

主进程仍然在 `buildContextAgentMessages` 中做预算选择、工具结果截断、旧工具结果摘要和问答轮次保留。上下文快照用于审计输入候选集，不替代预算裁剪逻辑。

## 错误处理

- JSON 序列化失败：写入 `{ "error": "数据无法序列化" }`。
- JSON 解析失败：服务层返回安全默认值，并保留原始行不自动删除。
- 工具失败：`ai_agent_tool_calls.status = failed`，`error` 写入错误文本，assistant 消息保留失败工具块。
- 模型流失败：`ai_agent_runs.status = failed`，session 状态置为 `执行失败`，assistant 消息写入错误 answer。
- IPC 读取历史失败：渲染层退回空历史或静态示例，不阻断主页面。

## 迁移策略

在 `src/main/db/index.ts` 新增建表函数，并在 `initDatabase()` 中调用。首期只新增表和索引，不改旧表，不做数据回填。

旧版内存 mock 会话不迁移到数据库，因为它不是用户真实数据。真实用户会话从功能上线后开始落库。

## 测试计划

主进程：

- `test/main/db/index.test.ts`：验证新表建表 SQL 包含核心字段、唯一约束和索引。
- `test/main/services/aiChatPersistenceService.test.ts`：覆盖会话列表、会话详情、消息写入、assistant 更新、run 完成、run 失败、工具 upsert、上下文快照、JSON 容错。
- `test/main/ipc/aiHandlers.test.ts`：覆盖 `ai:chat:start` 会创建 session/message/run，并在工具事件、done、error 时更新持久化状态。

渲染层：

- `test/renderer/App.test.tsx`：覆盖启动拉取历史、无历史时保留示例、发送消息时 payload 正确、事件流仍能更新 UI。
- `test/renderer/features/ai-chat/aiChatContextStore.test.ts` 和现有 builder 测试保持不降级。

最终验证：

- `pnpm test`
- `pnpm lint`
- `pnpm build`
- `git diff --check`

## 非目标

- 不做云同步。
- 不保存 API Key 或 provider secret options。
- 不做向量检索或全文搜索。
- 不做未完成 run 的断点续跑。
- 不把所有历史工具结果无脑塞回模型窗口。
- 不重构无关页面和现有业务服务。
