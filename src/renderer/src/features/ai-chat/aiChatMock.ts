// 工具步骤状态类型，描述 mock 工具调用当前阶段。
export type AiToolStepStatus = "done" | "failed" | "running" | "queued";

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
      // 会话 ID。
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
  // 会话状态文案。
  status: string;
  // 会话消息列表。
  messages: AiChatMessage[];
};

// AI 对话 mock 会话数据。
export const AI_CHAT_SESSIONS: AiChatSession[] = [
  {
    id: "today-memory",
    title: "整理今天的记忆线索",
    summary: "从 Todo、Notes、Journal 中提炼今天最值得保留的线索。",
    time: "10:24",
    status: "运行完成",
    messages: [
      {
        id: "today-user-1",
        role: "user",
        content: "帮我把今天的记录整理成一条清晰的记忆线索。",
        time: "10:20",
      },
      {
        id: "today-ai-1",
        role: "assistant",
        content: "我会先读取今天的任务、随记和日记，再归并成可回看的一条主线。",
        time: "10:24",
        toolSteps: [
          {
            id: "today-step-1",
            title: "计划输入来源",
            status: "done",
            tool: "Plan",
            observation: "选择 Today、Notes、Journal 作为本轮整理来源。",
          },
          {
            id: "today-step-2",
            title: "读取今日条目",
            status: "done",
            tool: "local_memory.search",
            observation: "找到 5 条待办、3 条随记和 1 篇日记草稿。",
          },
          {
            id: "today-step-3",
            title: "生成记忆摘要",
            status: "done",
            tool: "curator.compose",
            observation: "主线聚焦在渲染层稳定性、笔记归档和下一步验证。",
          },
        ],
        answer: "今天的核心线索是：先把输入源稳定下来，再用可验证的小步推进页面体验。下一步最值得做的是补齐 AI 对话模式的静态测试。",
      },
    ],
  },
  {
    id: "weekly-actions",
    title: "周回顾行动拆解",
    summary: "把本周复盘拆成明天可执行的 3 个动作。",
    time: "09:12",
    status: "工具完成",
    messages: [
      {
        id: "weekly-user-1",
        role: "user",
        content: "读取 weekly review 草稿，然后给我三条明天能执行的动作。",
        time: "09:06",
      },
      {
        id: "weekly-ai-1",
        role: "assistant",
        content: "我会先定位周回顾草稿，再把模糊事项压缩成具体动作。",
        time: "09:12",
        toolSteps: [
          {
            id: "weekly-step-1",
            title: "读取 weekly review 草稿",
            status: "done",
            tool: "weekly_review.load",
            observation: "草稿包含 4 个主题，其中 2 个主题缺少下一步动作。",
          },
          {
            id: "weekly-step-2",
            title: "拆解行动",
            status: "done",
            tool: "actions.extract",
            observation: "生成 3 条明天可执行的任务，均可在 30 分钟内启动。",
          },
        ],
        answer: "本周回顾行动拆解已完成，建议执行以下 3 个动作：\n1. 补齐今天 Today 视图的 AI 对话单元测试。\n2. 对本地隐私过滤功能模块设计进行核对与演进。\n3. 为本周 Review 提炼核心演化线索并存储至 Notes。",
      },
    ],
  },
  {
    id: "people-followup",
    title: "人物关系跟进",
    summary: "从 People 档案中找出需要跟进的关系线索。",
    time: "昨天",
    status: "等待输入",
    messages: [
      {
        id: "people-user-1",
        role: "user",
        content: "帮我看一下最近有哪些关系需要主动跟进。",
        time: "昨天",
      },
      {
        id: "people-ai-1",
        role: "assistant",
        content: "我已经准备好读取 People 档案。当前 mock 页面不会真正执行工具，只展示交互结构。",
        time: "昨天",
        toolSteps: [
          {
            id: "people-step-1",
            title: "等待授权",
            status: "queued",
            tool: "people.scan",
            observation: "等待用户确认本轮要扫描的人物范围。",
          },
        ],
      },
    ],
  },
];
