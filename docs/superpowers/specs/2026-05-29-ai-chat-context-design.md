# AI Chat Context Design

## Goal

为 AI 对话建立全局上下文能力，使 `AiChatWorkspace` 可以展示当前会话的上下文列表、预算占比和来源摘要，并为后续接入文件、页面选区、记忆条目、工具结果和 Agent 角色预留统一入口。

## References

- 当前项目：`AiChatWorkspace` 只负责消息列表与输入区渲染，聊天状态集中在 `App.tsx`。
- opencode-dev：`context/prompt.tsx` 使用会话级 context store、稳定 key 去重和独立 context actions；`build-request-parts.ts` 把 prompt 附件与 context 合并为请求 parts；`session-context-metrics.ts` 和 `session-context-breakdown.ts` 把上下文预算派生为 UI 指标。
- 微信文章链接：公众号页面触发环境验证，无法直接读取正文；本设计不依赖不可验证内容。
- 模型配置：`/Users/yonah/.mc/config.json` 的模型结构包含 `limit.context`、`limit.output`、`modalities.input`、`modalities.output`。实现只透传这些非密钥字段，禁止将 provider `options` 暴露给渲染层。

## Architecture

新增全局上下文模块，不把状态塞进 `AiChatWorkspace`：

- `aiChatContextStore.ts`：Zustand store，按 `sessionId` 存储 context items，提供 `add/remove/clear/replace/syncMessages`。
- `aiChatContextBuilder.ts`：纯函数层，负责稳定 key、消息上下文派生、token 估算、模型 limit 查找和预算统计。
- `AiChatContextBar.tsx`：展示当前会话的上下文总览和可折叠条目列表。
- `AiChatWorkspace.tsx`：只根据 `session`、`selectedModel`、`modelOptions` 消费上下文 bar，并继续负责消息滚动。
- `aiHandlers.ts`、`preload/index.ts`、`env.d.ts`、`aiChatMock.ts`：扩展模型选项类型，把模型 limit/modalities 从主进程安全透传到渲染层。
- `contextMessages.ts`：参考 opencode 的请求构造边界，在主进程统一把上下文条目转换为 Agent 消息，并负责去空、排序、按预算选择、压缩。

第一版只把消息列表同步为真实 context 来源。`memory/page/file/tool/agent` 作为类型能力预留，但不伪造数据、不接入未存在的来源。

## Data Model

`AiChatContextItem` 包含：

- `key`：稳定去重键。
- `sessionId`：所属会话。
- `kind`：`message | memory | page | file | tool | agent`。
- `sourceId`：来源对象标识。
- `title`：短标题。
- `summary`：面向 UI 的摘要。
- `content`：后续构造 agent 请求时使用的正文。
- `tokens`：估算 token 数。
- `createdAt`：排序字段。
- `meta`：类型相关补充字段，例如消息角色、模型、路径、行号。

`message` 类型从 `AiChatMessage` 派生：

- 用户消息：标题为“用户消息”，内容取 `content`。
- 助手消息：标题为“助手回答”，内容优先取 `answer`，否则取 `content`。
- 工具步骤：第一版不拆成独立 item，只在助手消息摘要中体现；后续可用 `tool` 类型拆分。

## Store Behavior

- `syncMessages(sessionId, messages)` 用当前消息列表替换该会话的 `message` 类上下文，同时保留非消息类上下文。
- `addItem(item)` 如果 key 已存在则跳过，保持去重语义。
- `removeItem(sessionId, key)` 只删除指定会话下的指定条目。
- `clearSession(sessionId)` 清空指定会话全部上下文。
- `replaceSessionItems(sessionId, items)` 用于未来批量导入文件、记忆和页面选区。
- 全局 store 最多保留 20 个会话的上下文；每次写入把当前会话移动到最近位置，超出后裁掉最旧会话，和 opencode 的 prompt session cache 上限保持同类语义。

## Request Context Construction

主进程是唯一可信的上下文裁剪点，渲染层只传候选 `context`：

- 当前用户输入始终作为最后一条 `user` 消息。
- `message` 类上下文按时间顺序组成问答轮次：用户消息开启新轮次，后续助手消息归入同一轮。
- 预算选择以轮次为单位，从最新轮次向旧轮次选择；旧轮次不会被拆散成只剩问题或只剩回答。
- 如果最新轮次本身超过剩余预算，才对该轮次做确定性首尾压缩；已经落选的旧轮次不再通过压缩重新进入窗口。
- 非消息类上下文是单独分组，进入模型时包装为 `上下文：标题\n正文`，方便后续文件、记忆、页面选区接入。

## Model Budget

模型配置已经存在 `limit.context` 和 `limit.output`。当前 IPC 只返回模型 `id/name`，需要扩展为：

- `limit?: { context: number; output: number }`
- `modalities?: { input: string[]; output: string[] }`

上下文预算计算规则：

- token 估算使用 `Math.ceil(chars / 4)`，与 opencode-dev 的轻量估算一致。
- `contextLimit` 从当前 `selectedModel` 对应的模型选项读取。
- `usagePercent = Math.round((totalTokens / contextLimit) * 100)`。
- 没有 limit 时显示未知上限，不写死默认值。

## UI

`AiChatContextBar` 放在消息滚动区顶部或消息区上沿，视觉克制：

- 默认行：`上下文 · N 条 · 约 X tokens / Y`。
- 展开后：横向或纵向列表展示来源、标题、摘要、token。
- 使用项目黑色主题、6px 圆角、13px 默认字号、12px 标签字号。
- 不使用渐变。
- 没有上下文时显示 `上下文 · 0 条`，不抢占大量空间。

## Error Handling

- 模型 limit 缺失：预算显示未知，不阻断聊天。
- 上下文为空：正常渲染空状态文案。
- 消息内容为空：不生成 message context item。
- 重复消息：以 `message:${message.id}` 去重。
- 不可信配置字段：主进程只返回模型公开字段，不返回 provider `options`。

## Testing

TDD 顺序：

1. `aiChatContextBuilder.test.ts`：先写失败用例，覆盖消息派生、空内容过滤、token 估算、模型 limit 和 usage。
2. `aiChatContextStore.test.ts`：先写失败用例，覆盖会话隔离、去重、同步消息时保留非消息上下文、删除和清空。
3. `aiHandlers.test.ts` 或相关主进程测试：验证 `getModelOptions` 返回 limit/modalities，且不返回 provider options。
4. `AiChatWorkspace.test.tsx`：验证当前会话上下文条可见，切换模型后预算使用对应 limit。
5. `contextMessages.test.ts`：验证主进程把上下文条目转成真实 `AgentMessage`，并按模型预算保留最近上下文、压缩超长条目、预算紧张时不拆散最近问答轮次。
6. `App.test.tsx`：验证第二轮发送时 payload 携带上一轮用户消息和助手回答。

最终验证：

- `pnpm test`。
- `pnpm lint`。
- `pnpm build`。
- `git diff --check`。

## Out Of Scope

- 本阶段不读取真实文件内容、不读取真实页面选区、不读取真实记忆库。
- 本阶段不做摘要缓存或语义摘要；主进程只做确定性的窗口裁剪和首尾压缩。

真实文件、页面选区和记忆库应在全局 store 与主进程裁剪链路稳定后作为下一阶段接入。
