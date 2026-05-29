import type { AssociatedPersonItem, PersonRelationship } from '../db/schema'

// 模型 provider 传输格式类型。
export type ProviderTransportType = 'openai-compatible' | 'openai' | 'anthropic' | 'google'

// 模型能力限制。
export type ModelLimit = {
  // 上下文窗口 token 上限。
  context: number
  // 输出 token 上限。
  output: number
}

// 模型输入输出模态。
export type ModelModalities = {
  // 支持的输入模态。
  input: string[]
  // 支持的输出模态。
  output: string[]
}

// 模型配置。
export type ModelConfig = {
  // 模型显示名。
  name: string
  // 模型限制。
  limit?: ModelLimit
  // 模型模态。
  modalities?: ModelModalities
}

// Provider 连接参数。
export type ProviderOptions = {
  // API Key。
  apiKey: string
  // API 基础地址。
  baseURL: string
}

// 归一化 provider 配置。
export type NormalizedProviderConfig = {
  // Provider 唯一标识。
  id: string
  // Provider 传输格式。
  type: ProviderTransportType
  // Provider 显示名。
  name: string
  // 对应 npm 包名，仅用于配置说明。
  npm?: string
  // Provider 连接参数。
  options: ProviderOptions
  // Provider 可用模型。
  models: Record<string, ModelConfig>
}

// 归一化 AI 配置。
export type NormalizedAiConfig = {
  // 默认 provider 标识。
  defaultProvider: string
  // 默认模型名。
  defaultModel: string
  // Provider 配置表。
  providers: Record<string, NormalizedProviderConfig>
}

// Agent 消息角色。
export type AgentMessageRole = 'system' | 'user' | 'assistant' | 'tool'

// Agent 内部消息。
export type AgentMessage = {
  // 消息角色。
  role: AgentMessageRole
  // 消息正文。
  content: string
  // Assistant 发起的工具调用列表。
  toolCalls?: ModelToolCallDoneEvent[]
  // 工具调用 ID，仅 tool 消息使用。
  toolCallId?: string
  // 工具名称，仅 tool 消息使用。
  name?: string
}

// JSON Schema 对象。
export type JsonSchema = {
  // Schema 类型。
  type: string
  // 对象属性。
  properties?: Record<string, JsonSchema>
  // 必填字段。
  required?: string[]
  // 枚举值。
  enum?: string[]
  // 字段说明。
  description?: string
  // 数组子项。
  items?: JsonSchema
}

// Agent 工具执行结果。
export type AgentToolResult = {
  // 回灌模型的观察文本。
  observation: string
  // 调试或 UI 可用结构化数据。
  data: unknown
}

// Agent 工具。
export type AgentTool = {
  // 工具名称。
  name: string
  // 工具说明。
  description: string
  // 工具参数 Schema。
  parameters: JsonSchema
  /**
   * 执行工具。
   */
  execute: (input: unknown) => Promise<AgentToolResult>
}

// 模型单轮输入。
export type ModelTurnInput = {
  // 模型名称。
  model: string
  // 消息历史。
  messages: AgentMessage[]
  // 本轮可用工具。
  tools: AgentTool[]
}

// 模型文本增量事件。
export type ModelTextDeltaEvent = {
  // 事件类型。
  type: 'text_delta'
  // 文本增量。
  delta: string
}

// 模型工具调用完成事件。
export type ModelToolCallDoneEvent = {
  // 事件类型。
  type: 'tool_call_done'
  // 工具调用 ID。
  id: string
  // 工具名称。
  name: string
  // 工具参数 JSON 字符串。
  argumentsText: string
}

// 模型单轮完成事件。
export type ModelDoneEvent = {
  // 事件类型。
  type: 'done'
}

// 模型流式事件。
export type ModelStreamEvent = ModelTextDeltaEvent | ModelToolCallDoneEvent | ModelDoneEvent

// 模型 provider。
export type ModelProvider = {
  // Provider 唯一标识。
  id: string
  // Provider 传输格式。
  type: ProviderTransportType
  /**
   * 执行单轮模型流式请求。
   */
  streamTurn: (input: ModelTurnInput) => AsyncIterable<ModelStreamEvent>
}

// Agent 运行输入。
export type ReactAgentRunInput = {
  // 模型 provider。
  provider: ModelProvider
  // 模型名称。
  model: string
  // 初始消息列表。
  messages: AgentMessage[]
  // 可用工具列表。
  tools: AgentTool[]
  // 最大工具循环轮数。
  maxTurns?: number
}

// Agent 流式输出事件。
export type AgentStreamEvent =
  | {
      // 事件类型。
      type: 'run_started'
    }
  | {
      // 事件类型。
      type: 'assistant_message_started'
    }
  | {
      // 事件类型。
      type: 'text_delta'
      // 文本增量。
      delta: string
    }
  | {
      // 事件类型。
      type: 'tool_started'
      // 工具步骤 ID。
      id: string
      // 工具名称。
      name: string
      // 工具输入。
      input: unknown
    }
  | {
      // 事件类型。
      type: 'tool_finished'
      // 工具步骤 ID。
      id: string
      // 工具名称。
      name: string
      // 工具观察文本。
      observation: string
      // 工具结构化数据。
      data: unknown
    }
  | {
      // 事件类型。
      type: 'turn_finished'
    }
  | {
      // 事件类型。
      type: 'done'
    }
  | {
      // 事件类型。
      type: 'error'
      // 错误信息。
      message: string
    }

// People 工具入参。
export type PeopleListToolInput = {
  // 搜索关键字。
  query?: string
  // 关系过滤。
  relationship?: PersonRelationship
  // 返回数量上限。
  limit?: number
}

// People 工具返回项。
export type PeopleListToolItem = Pick<
  AssociatedPersonItem,
  'id' | 'name' | 'gender' | 'relationship' | 'status' | 'birthday' | 'contact' | 'tags' | 'details' | 'updatedAt'
>

// People 工具返回结果。
export type PeopleListToolResult = AgentToolResult & {
  // 命中的人物条目。
  items: PeopleListToolItem[]
}
