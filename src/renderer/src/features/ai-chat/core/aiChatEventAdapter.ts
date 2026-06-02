import type { MutableRefObject } from "react";
import type {
  AiChatEvent,
  AiChatSession,
  AiChatSessionStatus,
} from "@renderer/features/ai-chat/types";
import {
  appendAiMessageTextPart,
  appendAiMessageToolPart,
} from "@renderer/features/ai-chat/core/aiChatMessageParts";
import type { AiChatMessageUpdater } from "@renderer/features/ai-chat/core/aiChatSessionReducer";

// Agent 运行消息映射关系。
export type AiRunMessageMapping = {
  // 会话标识。
  sessionId: string;
  // AI 消息标识。
  messageId: string;
  // 用户发送后先写入的乐观标题。
  optimisticTitle?: string;
};

// 打字机定时器类型。
export type AiTypewriterTimer = ReturnType<typeof setTimeout>;

// AI 事件适配器依赖。
type AiChatEventAdapterInput = {
  // Agent 运行与消息的映射关系。
  runMessageMapRef: MutableRefObject<Map<string, AiRunMessageMapping>>;
  // 流式文本缓冲区。
  textBufferRef: MutableRefObject<Map<string, string>>;
  // 打字机刷新定时器集合。
  typewriterTimerRef: MutableRefObject<Map<string, AiTypewriterTimer>>;
  // 更新指定 AI 消息。
  updateAiMessage: (
    sessionId: string,
    messageId: string,
    updater: AiChatMessageUpdater,
  ) => void;
  // 更新指定 AI 会话状态。
  updateChatSessionStatus: (
    sessionId: string,
    status: AiChatSessionStatus,
  ) => void;
  // 确认服务端生成的真实标题。
  confirmOptimisticTitle: (
    sessionId: string,
    optimisticTitle: string,
    title: string,
  ) => void;
};

// AI 对话消息类型。
type AiChatMessage = AiChatSession["messages"][number];

/**
 * clearAiChatTypewriterTimers - 清理全部打字机定时器。
 */
export const clearAiChatTypewriterTimers = (
  typewriterTimerRef: MutableRefObject<Map<string, AiTypewriterTimer>>,
): void => {
  for (const timer of typewriterTimerRef.current.values()) {
    clearTimeout(timer);
  }
  typewriterTimerRef.current.clear();
};

/**
 * createAiChatEventHandler - 将主进程流式事件翻译成会话与消息更新。
 */
export const createAiChatEventHandler = ({
  runMessageMapRef,
  textBufferRef,
  typewriterTimerRef,
  updateAiMessage,
  updateChatSessionStatus,
  confirmOptimisticTitle,
}: AiChatEventAdapterInput): ((event: AiChatEvent) => void) => {
  /**
   * flushBufferedTextImmediately - 工具事件到达前落盘文本缓冲，保留事件顺序。
   */
  const flushBufferedTextImmediately = (runId: string): void => {
    const mapping = runMessageMapRef.current.get(runId);
    const bufferedText = textBufferRef.current.get(runId) ?? "";
    const timer = typewriterTimerRef.current.get(runId);

    if (timer) {
      clearTimeout(timer);
      typewriterTimerRef.current.delete(runId);
    }

    if (!mapping || !bufferedText) {
      return;
    }

    textBufferRef.current.set(runId, "");
    updateAiMessage(mapping.sessionId, mapping.messageId, (message) =>
      appendAiMessageTextPart(message, bufferedText),
    );
  };

  /**
   * 刷新指定运行的文本缓冲。
   */
  const flushTypewriterBuffer = (runId: string): void => {
    const mapping = runMessageMapRef.current.get(runId);
    const bufferedText = textBufferRef.current.get(runId) ?? "";

    if (!mapping || !bufferedText) {
      typewriterTimerRef.current.delete(runId);
      return;
    }

    const chunk = bufferedText.slice(0, 8);
    const rest = bufferedText.slice(8);
    textBufferRef.current.set(runId, rest);
    updateAiMessage(mapping.sessionId, mapping.messageId, (message) =>
      appendAiMessageTextPart(message, chunk),
    );

    if (rest) {
      const timer = setTimeout(() => flushTypewriterBuffer(runId), 28);
      typewriterTimerRef.current.set(runId, timer);
      return;
    }

    typewriterTimerRef.current.delete(runId);
  };

  /**
   * 计划指定运行的打字机刷新。
   */
  const scheduleTypewriterFlush = (runId: string): void => {
    if (typewriterTimerRef.current.has(runId)) {
      return;
    }

    const timer = setTimeout(() => flushTypewriterBuffer(runId), 28);
    typewriterTimerRef.current.set(runId, timer);
  };

  /**
   * 合并工具开始事件。
   */
  const applyToolStarted = (
    message: AiChatMessage,
    event: Extract<AiChatEvent, { type: "tool_started" }>,
  ): AiChatMessage => ({
    ...appendAiMessageToolPart(message, event.id),
    toolSteps: [
      ...(message.toolSteps ?? []),
      {
        id: event.id,
        title: "Query local People",
        status: "running",
        tool: event.name,
        input: event.input,
        observation: "Reading the local People table.",
      },
    ],
  });

  /**
   * 合并工具成功事件。
   */
  const applyToolFinished = (
    message: AiChatMessage,
    event: Extract<AiChatEvent, { type: "tool_finished" }>,
  ): AiChatMessage => ({
    ...appendAiMessageToolPart(message, event.id),
    toolSteps: (message.toolSteps ?? []).some((step) => step.id === event.id)
      ? (message.toolSteps ?? []).map((step) =>
          step.id === event.id
            ? {
                ...step,
                status: "done",
                input: step.input,
                observation: event.observation,
                data: event.data,
              }
            : step,
        )
      : [
          ...(message.toolSteps ?? []),
          {
            id: event.id,
            title: `Tool result: ${event.name}`,
            status: "done",
            tool: event.name,
            input: {},
            observation: event.observation,
            data: event.data,
          },
        ],
  });

  /**
   * 合并工具失败事件。
   */
  const applyToolFailed = (
    message: AiChatMessage,
    event: Extract<AiChatEvent, { type: "tool_failed" }>,
  ): AiChatMessage => ({
    ...appendAiMessageToolPart(message, event.id),
    toolSteps: (message.toolSteps ?? []).some((step) => step.id === event.id)
      ? (message.toolSteps ?? []).map((step) =>
          step.id === event.id
            ? {
                ...step,
                status: "failed",
                input: event.input,
                observation: `Tool execution failed: ${event.error}`,
                data: {
                  error: event.error,
                },
              }
            : step,
        )
      : [
          ...(message.toolSteps ?? []),
          {
            id: event.id,
            title: `Tool failed: ${event.name}`,
            status: "failed",
            tool: event.name,
            input: event.input,
            observation: `Tool execution failed: ${event.error}`,
            data: {
              error: event.error,
            },
          },
        ],
  });

  return (event: AiChatEvent): void => {
    const mapping = runMessageMapRef.current.get(event.runId);
    if (!mapping) {
      return;
    }

    if (event.type === "text_delta") {
      const currentBuffer = textBufferRef.current.get(event.runId) ?? "";
      textBufferRef.current.set(event.runId, `${currentBuffer}${event.delta}`);
      scheduleTypewriterFlush(event.runId);
      return;
    }

    if (event.type === "done") {
      updateChatSessionStatus(mapping.sessionId, "completed");
      return;
    }

    if (event.type === "session_title_updated") {
      if (mapping.optimisticTitle) {
        confirmOptimisticTitle(
          event.sessionId,
          mapping.optimisticTitle,
          event.title,
        );
      }
      return;
    }

    if (event.type === "tool_started") {
      flushBufferedTextImmediately(event.runId);
      updateAiMessage(mapping.sessionId, mapping.messageId, (message) =>
        applyToolStarted(message, event),
      );
      return;
    }

    if (event.type === "tool_finished") {
      updateAiMessage(mapping.sessionId, mapping.messageId, (message) =>
        applyToolFinished(message, event),
      );
      return;
    }

    if (event.type === "tool_failed") {
      updateAiMessage(mapping.sessionId, mapping.messageId, (message) =>
        applyToolFailed(message, event),
      );
      return;
    }

    if (event.type === "error") {
      updateChatSessionStatus(mapping.sessionId, "failed");
      updateAiMessage(mapping.sessionId, mapping.messageId, (message) => ({
        ...message,
        content: "AI chat execution failed",
        answer: event.message,
      }));
    }
  };
};
