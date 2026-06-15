# 数据流分析：用户请求 → AI 回答

## 概述

Memory Curator Agent 是一个基于 **Electron + React + TypeScript** 的本地优先桌面应用，使用 **ReAct (Reasoning + Acting) Agent Loop** 让 LLM 通过受控工具访问本地 SQLite 数据库。

整个请求到响应的数据流跨越 3 个进程边界，涉及 30+ 个核心模块。

---

## 完整数据流

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  渲染进程 (Renderer)                                                         │
└─────────────────────────────────────────────────────────────────────────────┘

用户键入文本 / 粘贴图片 / @agent 标记
  -> AiChatInput 组件捕获输入，组装 AiChatSendPayload { text, parts, agents }
  -> useAiChatController.handleSendMessage(payload)
       -> normalizeAiChatSendInput(): 解析 @agent 标记文本，提取 agent hints
       -> startAiChatMessage(input, sessionId)
            -> 生成 3 个 UUID: runId, userMessageId, assistantMessageId
            -> buildStartContextItems(): 合并当前会话消息上下文 + store 中非消息上下文(page/file/memory)
               （优先用 React state 避免 Zustand store 同步延迟）
            -> 生成乐观标题（消息前15字 + "..."）
            -> 乐观 UI 更新：dispatch 将用户消息 + 占位 assistant 消息写入 sessionReducer
               （此时界面已能看到用户消息和 "Processing: ..." 占位气泡）
            -> 设置 runMessageMapRef: runId → { sessionId, messageId, optimisticTitle, runState, titleState }
            -> IPC 调用: window.api.ai.startChat({ runId, sessionId, message, parts, provider, model, context, agents })
                 │
                 │  (Electron IPC invoke — 跨进程)
                 │
┌────────────────┼────────────────────────────────────────────────────────────┐
│  主进程 (Main)  │  ai:chat:start handler                                     │
└────────────────┴────────────────────────────────────────────────────────────┘

  -> loadProviderConfig(): 读取 ~/.mc/config.json，解析所有 provider 配置
       （API keys, base URLs, 模型列表, context/output 限制, 标题模型, compaction 模型）
  -> 解析 provider ID 与 model ID（降级到默认配置）
  -> createAgentToolRegistry({ notes/journals/people/todos/snippets 五类 Service })
       -> 8 个 builtinToolFactories 依次执行：
            createAskTool()          → common_tool_ask
            createNoteTools()        → notes_tool_query/add/update/delete + 3 batch
            createJournalTools()     → journals_tool_query/save/delete
            createPeopleTools()      → people_tool_query/add/update/delete + 3 batch
            createTodoTools()        → todos_tool_query/add/update/delete + 3 batch
            createSnippetTools()     → snippets_tool_query/add/update/delete + 3 batch
            createTimeNowTool()      → common_tool_time_now
            createDateOffsetTool()   → common_tool_date_offset
       -> 去重校验 + 按名索引
  -> normalizeAiChatAgentHints(payload.agents): 去重、归一化优先级排序
  -> 如选择了 'common' agent: toolRegistry.all() 过滤为仅 common_tool_* 三个通用工具
  -> createSystemPrompt(): 组装 9 段中文系统提示词
       （身份/工具边界/效率/上下文边界/优先级边界/提问边界/People边界/事实边界/图片输出）
  -> appendAiChatAgentDirectiveToSystemMessage(): 将 agent 优先级指令追加到 system message
  -> buildContextAgentMessages():
       ├─ estimateTokens(system) + estimateTokens(userMessage) = baseTokens
       ├─ availableTokens = contextLimit - outputReserve(4096) - baseTokens
       ├─ applyToolHistoryPolicy(): 历史工具结果只保留最近 N 条完整，旧结果替换为 160 字摘要
       ├─ normalizeContextContent(): 非 message 来源用 UNTRUSTED_CONTEXT_START/END 包裹
       │                           tool 来源额外截断到 toolOutputMaxChars(默认8000)
       ├─ selectContextItems(): 按 QA 轮次分组，从最新开始倒序选择
       │                       预算不足时压缩(head/middle/tail)，优先保留最近内容
       ├─ toContextAgentMessages(): 转换为 AgentMessage[]
       │     message → { role, content, parts }
       │     tool    → assistant(toolCalls) + tool(result) 两条消息
       └─ 返回: [systemMessage, ...contextMessages, { role:'user', content, parts }]
  -> createRunWithMessages(): 原子事务写入 SQLite
       ├─ ai_chat_sessions:   创建/更新会话 (running 状态)
       ├─ ai_chat_messages:   用户消息 + 占位 assistant 消息
       ├─ ai_agent_runs:      运行记录 (provider/model/context)
       └─ ai_agent_context_snapshots: 上下文快照
  -> new AbortController() — 注册取消信号
  -> 如为新会话: scheduleInitialSessionTitle() 后台用标题总结模型生成 4-12 字中文标题
  -> createModelProvider(providerConfig):
       └─ createAiSdkModelProvider()
            ├─ getProviderNpmPackage(type): 匹配 npm 包名
            │     openai → @ai-sdk/openai
            │     anthropic → @ai-sdk/anthropic
            │     google → @ai-sdk/google
            │     openai-compatible → @ai-sdk/openai-compatible
            ├─ 动态 import(packageName) 加载 provider SDK
            ├─ resolveProviderFactory(): 查找 create* 工厂函数
            ├─ createProvider({ apiKey, baseURL })
            └─ 返回 ModelProvider { streamTurn: AsyncGenerator }
  -> 如已配置 compaction: 同样方式创建 compactionProvider
  -> for await (const agentEvent of runReactAgent({...})): 进入 ReAct 循环
       │
       │  ┌──────────────────────────────────────────────────┐
       │  │  runReactAgent() — ReAct Agent Loop              │
       │  └──────────────────────────────────────────────────┘
       │
       ├─ yield { type: 'run_started' }
       │
       ├─ [Turn 0..maxTurns-1] (默认最多 5 轮):
       │   │
       │   ├─ prepareToolsForModel(tools, messages):
       │   │     对每个 tool 包裹 execute() 加入 JSON Schema 参数校验
       │   │     渲染 AgentToolPrompt → 完整工具描述（能力/何时用/不用/安全边界/输出要求/示例）
       │   │
       │   ├─ provider.streamTurn({ model, messages, tools, signal })
       │   │   │
       │   │   └─ aiSdkProvider.streamTurn():
       │   │        ├─ toAiSdkMessage(): AgentMessage → AI SDK ModelMessage
       │   │        │    assistant+toolCalls → { role:'assistant', content:[{type:'tool-call',...}] }
       │   │        │    tool                  → { role:'tool', content:[{type:'tool-result',...}] }
       │   │        │    有 parts             → multi-part (text + image base64 + text-file inline)
       │   │        │    普通                  → { role, content }
       │   │        ├─ toAiSdkTools(): AgentTool → AI SDK tool() with jsonSchema()
       │   │        ├─ runStreamText({ model, messages, tools, abortSignal })
       │   │        │    → Vercel AI SDK streamText() 发起 LLM API 请求
       │   │        └─ for await (part of fullStream):
       │   │             text-delta       → yield { type:'text_delta', delta }
       │   │             reasoning-delta  → yield { type:'reasoning_delta', id, delta }
       │   │             tool-call        → yield { type:'tool_call_done', id, name, argumentsText }
       │   │             finish           → yield { type:'done' }
       │   │             error            → throw Error
       │   │
       │   ├─ 收集所有 tool_call_done 事件
       │   ├─ 如无工具调用: yield turn_finished + done, return (对话结束)
       │   ├─ assistant 消息(含 toolCalls) 推入 messages[]
       │   │
       │   ├─ 逐个处理 tool call:
       │   │   ├─ parseToolArguments(): JSON.parse(argumentsText)
       │   │   ├─ 【Doom Loop 检测】: 连续 3 次同工具+同参数 → 拦截，注入停止消息，跳过
       │   │   │   (豁免: common_tool_ask, 有 confirmation 的写入工具)
       │   │   ├─ 【People 写入 Ask 拦截】: common_tool_ask 用于确认 People 写操作 → 静默 reject
       │   │   ├─ yield { type:'tool_started', id, name, input }
       │   │   ├─ 【工具确认流程】(仅写入工具有 confirmation 配置):
       │   │   │   yield tool_finished(data: ToolConfirmationRequest) → 主进程 waitForToolConfirmation()
       │   │   │   → IPC send 到渲染层 → 用户点确认/取消 → IPC 回答回主进程 → Promise resolve
       │   │   │   yield tool_finished(data: ToolConfirmationAnswer) → 如取消则 continue 跳过
       │   │   ├─ tool.execute(input):
       │   │   │   ├─ assertValidToolInput(JSON Schema 校验)
       │   │   │   └─ 调用对应 Service 方法 (SQLite CRUD)
       │   │   │        notesService.querySql/create/update/delete
       │   │   │        journalsService.querySql/save/delete
       │   │   │        peopleService.list/querySql/create/update/delete
       │   │   │        todosService.querySql/create/update/delete
       │   │   │        snippetsService.querySql/create/update/delete
       │   │   ├─ yield { type:'tool_finished', id, name, observation, data }
       │   │   ├─ 【Ask 流程】(common_tool_ask 返回 ask_request):
       │   │   │   yield tool_finished(data: AskRequestData) → 主进程 waitForAskAnswer()
       │   │   │   → IPC send 到渲染层 → 用户填写答案 → IPC 回答回主进程 → Promise resolve
       │   │   │   yield tool_finished(data: AskAnswerData) → formatAskAnswerObservation → 回灌
       │   │   ├─ 【终端工具】(result.terminal=true): yield turn_finished + done, return
       │   │   ├─ 工具结果 content 以 UNTRUSTED 边界包裹 → push tool message 到 messages[]
       │   │   └─ 异常: yield tool_failed → 错误信息回灌到 messages[] 供模型自我修复
       │   │
       │   ├─ 全部检测/mutation-ask 拦截无实际执行: 注入 stop 消息, yield done, return
       │   ├─ yield { type:'turn_finished' }
       │   │
       │   └─ 【Compaction 检测】(每轮结束后):
       │        estimatedTokens = 总字符数/4
       │        如 > contextLimit - 4096 缓冲区:
       │          ├─ splitTurns(messages): 按 assistant+toolCalls 边界分轮
       │          ├─ 保留最后 2 轮完整，之前用 compaction 模型总结
       │          ├─ compactMessages(): 调 compaction 模型 streamTurn
       │          │   → 输出 3-5 段中文摘要 (关键事实/人物/日期/决策/待办)
       │          └─ 替换 messages: [system, compactedSummary, ...tailTurns]
       │
       ├─ [到达 maxTurns]:
       │   ├─ 注入 "已达到最大轮数" 停止提示
       │   └─ 最后一次 streamTurn(tools:[]) 强制纯文本回答，忽略一切工具调用
       │
       └─ yield { type:'done' }

       │
       │  (回到 aiHandlers.ts 的 for await 循环)
       │
       ├─ 对每个 AgentStreamEvent:
       │   ├─ 更新内存 ActiveAiChatRun 状态:
       │   │   text_delta        → 追加 assistantAnswer + appendTextPart
       │   │   reasoning_delta   → appendReasoningPart
       │   │   tool_started      → appendToolPart + 推入 toolSteps[]
       │   │   tool_finished     → 更新 toolSteps[] (running→done)
       │   │   tool_failed       → 更新 toolSteps[] (running→failed/cancelled)
       │   ├─ 实时落库 SQLite:
       │   │   updateAssistantMessage(): 每次文本/工具状态变化即写盘
       │   │   upsertToolCall(): 工具调用的完整生命周期追踪
       │   ├─ 向渲染进程推送: event.sender.send('ai:chat:event', { ...event, runId, sessionId })
       │   │
       │   └─ [生命周期事件]:
       │        done  → finishRun() + ensureSession() 标记 completed
       │        error → failRunWithAssistantMessage() 标记 failed
       │
       ├─ [异常捕获]:
       │   ├─ AbortController 触发 → 取消所有 pending Ask/Confirmation Promise
       │   └─ 其他异常 → 落库失败 + 推送 error 事件
       │
       └─ [finally]: 清理 activeAiChatRuns, sender.destroyed 监听

       │
       │  (IPC event push — 跨进程)
       │
┌────────────────┼────────────────────────────────────────────────────────────┐
│  渲染进程        │  ipcRenderer.on('ai:chat:event', handler)                  │
└────────────────┴────────────────────────────────────────────────────────────┘

  -> createAiChatEventHandler() 分发处理:

    text_delta:
      ├─ textBufferRef[runId] += delta    (累积到缓冲区)
      └─ scheduleTypewriterFlush(runId):
           setTimeout 28ms 后 flushTypewriterBuffer()
           → 每次从缓冲区取前 8 个字符 → appendAiMessageTextPart() → UI 更新
           → 剩余字符继续 setTimeout 28ms 循环
           (打字机效果: 每 28ms 输出 8 个字符)

    reasoning_delta:
      ├─ flushBufferedTextImmediately()   (先落盘缓冲区文本，保持顺序)
      └─ appendAiMessageReasoningPart()   → AiChatThinkingBlock 展示

    tool_started:
      ├─ flushBufferedTextImmediately()
      └─ applyToolStarted(): 追加 tool part + toolStep{ status:'running' }
           → AiChatToolCallBlock 展示旋转加载状态

    tool_finished:
      └─ applyToolFinished(): 更新 toolStep → status:'done' (或 'running' 如 Ask/Confirmation 待处理)
           → 如 data 为 AskRequestData → AiAskRequestPanel 弹出问题面板
           → 如 data 为 ToolConfirmationRequest → 弹出确认对话框

    tool_failed:
      └─ applyToolFailed(): 更新 toolStep → status:'failed' | 'cancelled'

    done:
      ├─ flushBufferedTextImmediately()   (清空文本缓冲)
      ├─ completeAiMessageReasoningParts() (标记所有 reasoning 完成)
      ├─ updateChatSessionStatus('completed') → Sidebar 显示完成状态
      └─ clearRunState() / 等 title 确认后清理

    session_title_updated:
      ├─ confirmOptimisticTitle(): 用 AI 生成的标题替换乐观标题
      └─ titleState → 'confirmed' → 可安全清理 run 映射

    error:
      ├─ flushBufferedTextImmediately()
      ├─ updateChatSessionStatus('failed')
      └─ updateAiMessage(answer: error.message)

  -> UI 最终渲染 (AiChatWorkspace):
       AiChatMessageBubble     → 打字机流式文本
       AiChatThinkingBlock     → 推理过程折叠面板
       AiChatToolCallBlock     → 工具调用步骤卡片 (running/done/failed)
       AiAskRequestPanel       → 结构化提问表单 (如触发 common_tool_ask)
       AiToolConfirmationPanel → 写入确认对话框 (如触发 people_tool_add 等)

  -> 用户与 Ask/Confirmation 交互:
       填写答案提交 → window.api.ai.submitAskAnswer({ requestId, answers })
       → IPC invoke('ai:chat:ask-answer') → pendingAskAnswers.get(requestId).resolve(answers)
       → Promise resolve → runReactAgent 继续执行 → 答案作为 tool result 回灌模型

       点确认/取消 → window.api.ai.submitToolConfirmationAnswer({ requestId, action })
       → IPC invoke('ai:chat:tool-confirmation-answer') → pendingToolConfirmations.get(requestId).resolve(action)
       → Promise resolve → runReactAgent 继续执行 / 跳过
```

---

## 关键节点速查

| 层级 | 核心模块 | 文件 | 职责 |
|------|---------|------|------|
| UI 输入 | `AiChatInput` + `useAiChatController` | `src/renderer/src/features/ai-chat/` | 组装 payload、乐观 UI、构建上下文 |
| 跨进程 | `ipcMain.handle` / `ipcRenderer.invoke` | `src/main/ipc/aiHandlers.ts` + `src/preload/index.ts` | 请求下发与事件回推 |
| 配置加载 | `providerConfig` + `providerFactory` | `src/main/agent/providers/` | 动态加载 AI SDK provider、解析模型配置 |
| 上下文构造 | `buildContextAgentMessages` | `src/main/agent/core/contextMessages.ts` | 预算管理、不可信包裹、QA 分组、压缩截断 |
| 工具注册 | `createAgentToolRegistry` | `src/main/agent/tools/toolRegistry.ts` | 30+ 工具，JSON Schema 校验、确认/Ask 中断 |
| Agent 循环 | `runReactAgent` | `src/main/agent/core/reactAgent.ts` | ReAct 5 轮上限、doom loop 检测、compaction |
| AI 调用 | `createAiSdkModelProvider` | `src/main/agent/providers/aiSdkProvider.ts` | Vercel AI SDK streamText、消息/工具格式转换 |
| Agent 提示 | `agentHints` | `src/main/agent/core/agentHints.ts` | 7 域 agent 优先级指令注入 |
| 流式回推 | `sender.send('ai:chat:event')` | `src/main/ipc/aiHandlers.ts` | 每个事件实时下发渲染进程 |
| 持久化 | `aiChatPersistenceService` | `src/main/services/aiChatPersistenceService.ts` | 消息/工具/上下文快照实时落库 SQLite |
| UI 流式渲染 | `aiChatEventAdapter` | `src/renderer/src/features/ai-chat/core/aiChatEventAdapter.ts` | 打字机动效、工具步骤卡片、Ask 面板 |
| 中断恢复 | `pendingAskAnswers` / `pendingToolConfirmations` | `src/main/ipc/aiHandlers.ts` | Promise 挂起 → 用户操作 → Promise resolve 继续 |

---

## 三条关键分支

### 1. Ask 提问流程 (模型主动向用户提问)

```
common_tool_ask 被调用
  -> runReactAgent 执行 tool.execute() → yield tool_finished(data: AskRequestData)
  -> aiHandlers 收到 tool_finished → sendEvent 推送到渲染层
  -> 渲染层 AiAskRequestPanel 弹出结构化问题（每组1-3题，每题最多4选项）
  -> 同时主进程 waitForAskAnswer() 创建 Promise 挂起在 pendingAskAnswers Map 中
  -> 用户提交答案 → IPC invoke('ai:chat:ask-answer')
  -> pending.resolve(answers) → Promise resolve
  -> runReactAgent 拿到 answerData → formatAskAnswerObservation → 作为 tool result 回灌模型
  -> 模型继续生成回答（同一轮内继续）
```

### 2. 工具确认流程 (数据写入需用户确认)

```
people_tool_add / todo_tool_update 等写入工具被调用
  -> runReactAgent 检测 tool.confirmation 配置
  -> yield tool_finished(data: ToolConfirmationRequest) 给渲染层弹出确认框
  -> 同时主进程 waitForToolConfirmation() 创建 Promise 挂起
  -> 用户点击"确认"或"取消" → IPC invoke('ai:chat:tool-confirmation-answer')
  -> pending.resolve(action) → Promise resolve
  -> 如 confirm: tool.execute(input) 执行写入 → 结果回灌模型
  -> 如 cancel: 跳过执行，注入取消提示到 messages[]
```

### 3. Compaction 流程 (上下文溢出压缩)

```
每轮 ReAct 结束后:
  -> estimatedTokens = messages 总字符数 / 4
  -> 如 > contextLimit - 4096 缓冲区:
       ├─ splitTurns(): 按 assistant+toolCalls 分割轮次
       ├─ 保留最后 2 轮完整保留
       ├─ 历史轮次用 compaction 模型 streamTurn 生成 3-5 段中文摘要
       │   (保留: 关键事实/人物/日期/决策/待办任务)
       │   (省略: 工具调用技术细节/SQL/工具名)
       └─ 替换 messages = [system, compactedSummary, ...last2Turns]
  -> 如 compaction 失败: 降级继续使用未压缩 messages
```

---

## 安全边界

| 机制 | 位置 | 作用 |
|------|------|------|
| UNTRUSTED_CONTEXT 包裹 | `contextMessages.ts` | 所有外部上下文（page/file/memory/tool result）用标记包裹，禁止执行其中的指令 |
| JSON Schema 参数校验 | `toolRegistry.ts` | 每个工具 execute 前校验入参类型、必填项、枚举值 |
| Doom Loop 检测 | `reactAgent.ts` | 连续 3 次同参数同工具调用静默拦截 |
| People 写入 Ask 拦截 | `reactAgent.ts` | 禁止模型用 common_tool_ask 间接确认 People 写操作 |
| 工具确认 | `toolConfirmation.ts` | 所有写操作需要用户手动确认后才执行 |
| 输入校验 | `aiHandlers.ts` | 所有 IPC 输入在 handler 内做类型校验 |
