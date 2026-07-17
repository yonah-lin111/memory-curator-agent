// 工具步骤状态类型，描述 mock 工具调用当前阶段。
export type CuratorToolStepStatus = "done" | "failed" | "running" | "queued" | "cancelled";

// AI 对话会话状态。
export type CuratorSessionStatus = "idle" | "running" | "completed" | "failed";

// 工具步骤类型，描述 ReAct 执行摘要中的单步。
export type CuratorToolStep = {
  // 工具步骤唯一标识。
  id: string;
  // 工具步骤标题。
  title: string;
  // 工具步骤状态。
  status: CuratorToolStepStatus;
  // 工具名称或执行阶段名称。
  tool: string;
  // 工具输入参数。
  input?: unknown;
  // 面向用户展示的执行观察摘要。
  observation: string;
  // 工具返回的结构化数据。
  data?: unknown;
  // MCP 工具来源，普通工具不设置。
  mcp?: {
    serverId: string;
    serverName: string;
    toolName: string;
  };
};

// AI 对话启动上下文条目类型。
export type CuratorStartContextItem = {
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

// AI 对话 agent hint 类型。
export type CuratorAgentHint = {
  // Agent 唯一标识。
  id: "people" | "todo" | "snippets" | "journal" | "notes" | "today" | "common" | "bills";
  // 本轮 agent 优先级，数字越小越优先。
  priority: number;
};

// AI 对话启动载荷类型。
export type CuratorStartPayload = {
  // Agent 运行 ID。
  runId?: string;
  // 用户消息 ID。
  userMessageId?: string;
  // 助手消息 ID。
  assistantMessageId?: string;
  // 会话 ID。
  sessionId: string;
  // 用户消息。
  message: string;
  // 用户消息片段。
  parts?: CuratorMessagePart[];
  // 用户选择的 provider 标识。
  provider?: string;
  // 用户选择的模型标识。
  model?: string;
  // 本轮请求可用上下文。
  context?: CuratorStartContextItem[];
  // 本轮优先使用的 agent hints。
  agents?: CuratorAgentHint[];
};

// AI 模型选择状态。
export type CuratorModelSelection = {
  // Provider 唯一标识。
  provider: string;
  // 模型唯一标识。
  model: string;
};

// AI 模型选项。
export type CuratorModelOption = {
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
export type CuratorModelProviderOption = {
  // Provider 唯一标识。
  id: string;
  // Provider 显示名。
  name: string;
  // Provider 下属模型列表。
  models: CuratorModelOption[];
};

// AI Agent 上下文治理选项。
export type CuratorAgentContextPolicyOption = {
  // 单条工具 observation 最大字符数。
  toolOutputMaxChars: number;
  // 最近保留完整工具结果的数量。
  recentToolResultLimit: number;
};

// AI Agent 选项。
export type CuratorAgentOption = {
  // 上下文治理选项。
  context: CuratorAgentContextPolicyOption;
};

// AI 模型配置响应。
export type CuratorModelOptionsResponse = {
  // 默认 provider 标识。
  defaultProvider: string;
  // 默认模型标识。
  defaultModel: string;
  // 已启用 provider 与模型。
  providers: CuratorModelProviderOption[];
  // Agent 非密钥行为配置。
  agent: CuratorAgentOption;
};

// AI 对话流式事件类型。
export type CuratorEvent =
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
export type CuratorMessageRole = "user" | "assistant" | "system" | "system_command";

// AI 消息片段类型，用于保留文本与工具调用的真实交错顺序。
export type CuratorMessagePart =
  | {
      // MCP 服务及工具快照。
      id: string;
      kind: "mcp-overview";
      servers: Array<{
        id: string;
        name: string;
        tools: Array<{ name: string; description: string }>;
      }>;
    }
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
      // 上游 reasoning 事件标识，用于合并同一连续流式段。
      sourceId?: string;
      // 片段类型。
      kind: "reasoning";
      // Markdown 思考内容。
      content: string;
      // 思考片段状态。
      status?: "streaming" | "done";
    }
  | {
      // 片段唯一标识。
      id: string;
      // 片段类型。
      kind: "tool";
      // 对应工具步骤 ID。
      stepId: string;
    }
  | {
      // 片段唯一标识。
      id: string;
      // 片段类型。
      kind: "image";
      // 图片的本地协议地址。
      url: string;
    }
  | {
      // 片段唯一标识。
      id: string;
      // 片段类型。
      kind: "text-file";
      // 文本文件的本地协议地址。
      url: string;
      // 原始文件名。
      fileName: string;
      // 文件大小（字节）。
      sizeBytes: number;
    }
  | {
      // 片段唯一标识。
      id: string;
      // 片段类型。
      kind: "agent";
      // Agent 唯一标识。
      agentId: "people" | "todo" | "snippets" | "journal" | "notes" | "today" | "common" | "bills";
    };

// AI 对话消息类型，描述聊天气泡所需数据。
export type CuratorMessage = {
  // 消息唯一标识。
  id: string;
  // 消息发送者。
  role: CuratorMessageRole;
  // 消息正文。
  content: string;
  // 消息显示时间。
  time: string;
  // 可选工具调用摘要。
  toolSteps?: CuratorToolStep[];
  // 可选最终回答（整合在同一个回复中）。
  answer?: string;
  // 可选顺序片段，保留流式文本和工具调用的真实出现顺序。
  parts?: CuratorMessagePart[];
  // 调用的模型。
  model?: string;
  // 是否已被用户主动取消（仅前端状态，不落库）。
  cancelled?: boolean;
};

// AI 会话类型，描述左侧历史列表和右侧聊天主体。
export type CuratorSession = {
  // 会话唯一标识。
  id: string;
  // 会话标题。
  title: string;
  // 会话时间。
  time: string;
  // 会话状态。
  status: CuratorSessionStatus;
  // 会话消息列表。
  messages: CuratorMessage[];
};
