// 工具步骤状态类型，描述 mock 工具调用当前阶段。
export type AiToolStepStatus = "done" | "failed" | "running" | "queued";

// AI 对话会话状态。
export type AiChatSessionStatus = "idle" | "running" | "completed" | "failed";

// 工具步骤类型，描述 ReAct 执行摘要中的单步。
export type AiToolStep = {
  // 工具步骤唯一标识。
  id: string;
  // 工具步骤标题。
  title: string;
  // 工具步骤状态。
  status: AiToolStepStatus;
  // 工具名称或执行阶段名称。
  tool: string;
  // 工具输入参数。
  input?: unknown;
  // 面向用户展示的执行观察摘要。
  observation: string;
  // 工具返回的结构化数据。
  data?: unknown;
};

// AI 对话启动上下文条目类型。
export type AiChatStartContextItem = {
  // 上下文稳定去重键。
  key: string;
  // 上下文来源类型。
  kind: "message" | "memory" | "page" | "file" | "tool" | "agent";
  // 展示标题。
  title: string;
  // 来源对象标识。
  sourceId?: string;
  // 参与模型请求的正文。
  content: string;
  // 估算 token 数。
  tokens?: number;
  // 创建顺序或时间戳。
  createdAt?: number;
  // 来源相关补充信息。
  meta?: Record<string, string | number | boolean | undefined>;
};

// AI 对话启动载荷类型。
export type AiChatStartPayload = {
  // Agent 运行 ID。
  runId?: string;
  // 会话 ID。
  sessionId: string;
  // 用户消息。
  message: string;
  // 用户选择的 provider 标识。
  provider?: string;
  // 用户选择的模型标识。
  model?: string;
  // 本轮请求可用上下文。
  context?: AiChatStartContextItem[];
};

// AI 模型选择状态。
export type AiModelSelection = {
  // Provider 唯一标识。
  provider: string;
  // 模型唯一标识。
  model: string;
};

// AI 模型选项。
export type AiModelOption = {
  // 模型唯一标识。
  id: string;
  // 模型显示名。
  name: string;
  // 模型限制。
  limit?: {
    // 上下文窗口 token 上限。
    context: number;
    // 输出 token 上限。
    output: number;
  };
  // 模型输入输出模态。
  modalities?: {
    // 支持的输入模态。
    input: string[];
    // 支持的输出模态。
    output: string[];
  };
};

// AI Provider 选项。
export type AiModelProviderOption = {
  // Provider 唯一标识。
  id: string;
  // Provider 显示名。
  name: string;
  // Provider 下属模型列表。
  models: AiModelOption[];
};

// AI Agent 上下文治理选项。
export type AiAgentContextPolicyOption = {
  // 单条工具 observation 最大字符数。
  toolOutputMaxChars: number;
  // 最近保留完整工具结果的数量。
  recentToolResultLimit: number;
};

// AI Agent 选项。
export type AiAgentOption = {
  // 上下文治理选项。
  context: AiAgentContextPolicyOption;
};

// AI 模型配置响应。
export type AiModelOptionsResponse = {
  // 默认 provider 标识。
  defaultProvider: string;
  // 默认模型标识。
  defaultModel: string;
  // 已启用 provider 与模型。
  providers: AiModelProviderOption[];
  // Agent 非密钥行为配置。
  agent: AiAgentOption;
};

// AI 对话流式事件类型。
export type AiChatEvent =
  | {
      // 事件类型。
      type: "run_started" | "assistant_message_started" | "turn_finished" | "done";
      // Agent 运行 ID。
      runId: string;
      // 会话 ID。
      sessionId: string;
    }
  | {
      // 事件类型。
      type: "text_delta";
      // Agent 运行 ID。
      runId: string;
      // 会话 ID。
      sessionId: string;
      // 文本增量。
      delta: string;
    }
  | {
      // 事件类型。
      type: "reasoning_delta";
      // Agent 运行 ID。
      runId: string;
      // 会话 ID。
      sessionId: string;
      // 思考片段唯一标识。
      id: string;
      // 思考文本增量。
      delta: string;
    }
  | {
      // 事件类型。
      type: "tool_started";
      // Agent 运行 ID。
      runId: string;
      // 会话 ID。
      sessionId: string;
      // 工具步骤 ID。
      id: string;
      // 工具名称。
      name: string;
      // 工具输入。
      input: unknown;
    }
  | {
      // 事件类型。
      type: "tool_finished";
      // Agent 运行 ID。
      runId: string;
      // 会话 ID].
      sessionId: string;
      // 工具步骤 ID。
      id: string;
      // 工具名称。
      name: string;
      // 工具观察。
      observation: string;
      // 工具数据。
      data: unknown;
    }
  | {
      // 事件类型。
      type: "tool_failed";
      // Agent 运行 ID。
      runId: string;
      // 会话 ID。
      sessionId: string;
      // 工具步骤 ID。
      id: string;
      // 工具名称。
      name: string;
      // 工具输入。
      input: unknown;
      // 工具错误信息。
      error: string;
    }
  | {
      // 事件类型。
      type: "session_title_updated";
      // Agent 运行 ID。
      runId: string;
      // 会话 ID。
      sessionId: string;
      // AI 总结后的会话标题。
      title: string;
    }
  | {
      // 事件类型。
      type: "error";
      // Agent 运行 ID。
      runId: string;
      // 会话 ID。
      sessionId: string;
      // 错误信息。
      message: string;
    };

// 消息发送者类型，描述消息归属。
export type AiChatMessageRole = "user" | "assistant";

// AI 消息片段类型，用于保留文本与工具调用的真实交错顺序。
export type AiChatMessagePart =
  | {
      // 片段唯一标识。
      id: string;
      // 片段类型。
      kind: "text";
      // Markdown 文本内容。
      content: string;
    }
  | {
      // 片段唯一标识。
      id: string;
      // 片段类型。
      kind: "reasoning";
      // Markdown 思考内容。
      content: string;
    }
  | {
      // 片段唯一标识。
      id: string;
      // 片段类型。
      kind: "tool";
      // 对应工具步骤 ID。
      stepId: string;
    };

// AI 对话消息类型，描述聊天气泡所需数据。
export type AiChatMessage = {
  // 消息唯一标识。
  id: string;
  // 消息发送者。
  role: AiChatMessageRole;
  // 消息正文。
  content: string;
  // 消息显示时间。
  time: string;
  // 可选工具调用摘要。
  toolSteps?: AiToolStep[];
  // 可选最终回答（整合在同一个回复中）。
  answer?: string;
  // 可选顺序片段，保留流式文本和工具调用的真实出现顺序。
  parts?: AiChatMessagePart[];
};

// AI 会话类型，描述左侧历史列表和右侧聊天主体。
export type AiChatSession = {
  // 会话唯一标识。
  id: string;
  // 会话标题。
  title: string;
  // 会话摘要。
  summary: string;
  // 会话时间。
  time: string;
  // 会话状态。
  status: AiChatSessionStatus;
  // 会话消息列表。
  messages: AiChatMessage[];
};
