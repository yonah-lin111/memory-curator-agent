import { type IpcMainInvokeEvent } from "electron";
import { createCompactUuid } from "@/id";
import { loadProviderConfig } from "@/agent/providers/providerConfig";
import { createModelProvider } from "@/agent/providers/providerFactory";
import { normalizeAiChatAgentHints } from "@/agent/core/agentHints";
import { runReactAgent } from "@/agent/core/reactAgent";
import { buildContextAgentMessages } from "@/agent/core/contextMessages";
import { appendAiChatAgentDirectiveToSystemMessage } from "@/agent/core/agentHints";
import { isAskRequestData } from "@/agent/tools/askTool";
import {
  isToolConfirmationRequestData,
  isToolConfirmationAnswerData,
} from "@/agent/tools/toolConfirmation";
import type { ModelProvider } from "@/agent/types";
import type { AiToolStep } from "@/db/schema";
import { type createAiChatPersistenceService } from "@/services/aiChatPersistenceService";
import { type createAgentToolRegistry } from "@/agent/tools/toolRegistry";
import { getAvailableSkillsForAgent, type AiAgentSkill } from "@/services/skillsService";
import {
  type AiChatStartPayload,
  type AiChatIpcEvent,
  type ActiveAiChatRun,
  ASK_CANCELLED_MESSAGE,
  TOOL_CONFIRMATION_CANCELLED_MESSAGE,
} from "./types";
import {
  activeAiChatRuns,
  cancelAiChatAsk,
  waitForAskAnswer,
  waitForToolConfirmation,
} from "./state";
import {
  createTimestamp,
  createDisplayTime,
  createFallbackSessionTitle,
  shouldCreateInitialSessionTitle,
  scheduleInitialSessionTitle,
  createSystemPrompt,
  appendTextPart,
  appendReasoningPart,
  appendToolPart,
} from "./helpers";

/**
 * 启动 AI 聊天处理流。
 */
export const startAiChat = async (
  event: IpcMainInvokeEvent,
  payload: AiChatStartPayload,
  services: {
    aiChatService: ReturnType<typeof createAiChatPersistenceService>;
    toolRegistry: ReturnType<typeof createAgentToolRegistry>;
  },
): Promise<{ runId: string }> => {
  const runId = payload.runId ?? createCompactUuid();
  const config = loadProviderConfig();
  const providerId = payload.provider ?? config.defaultProvider;
  const providerConfig = config.providers[providerId];

  if (!providerConfig) {
    throw new Error(`Provider 未启用或存在：${providerId}`);
  }

  const requestedModel =
    payload.model ??
    (providerId === config.defaultProvider
      ? config.defaultModel
      : undefined);

  if (requestedModel && !providerConfig.models[requestedModel]) {
    throw new Error(`模型未启用或存在：${providerId}/${requestedModel}`);
  }

  const modelId = requestedModel ?? Object.keys(providerConfig.models)[0];

  if (!modelId) {
    throw new Error(`Provider ${providerId} 未配置模型`);
  }

  let tools = services.toolRegistry.all();
  const agentHints = normalizeAiChatAgentHints(payload.agents);

  // 如果选择了 common agent，则物理过滤，只保留以 common_tool_ 开头的通用工具，隔离所有业务 Agent 的工具
  const hasCommonAgent = agentHints.some((hint) => hint.id === "common");
  if (hasCommonAgent) {
    tools = tools.filter((tool) => tool.name.startsWith("common_tool_"));
  }
  const modelConfig = providerConfig.models[modelId];
  const timestamp = createTimestamp();
  const userTime = createDisplayTime(timestamp);
  const userMessageId = payload.userMessageId ?? createCompactUuid();
  const assistantMessageId =
    payload.assistantMessageId ?? createCompactUuid();
  const toolCallIds = new Map<string, string>();
  const existingSession = services.aiChatService.getSession(payload.sessionId);
  const shouldCreateTitle =
    shouldCreateInitialSessionTitle(existingSession);
  const sessionTitle = shouldCreateTitle
    ? createFallbackSessionTitle(payload.message)
    : (existingSession?.title ??
      createFallbackSessionTitle(payload.message));

  services.aiChatService.createRunWithMessages({
    session: {
      id: payload.sessionId,
      title: sessionTitle,
      status: "running",
      timestamp,
    },
    userMessage: {
      id: userMessageId,
      sessionId: payload.sessionId,
      role: "user",
      content: payload.message,
      parts: payload.parts,
      time: userTime,
      timestamp,
    },
    assistantMessage: {
      id: assistantMessageId,
      sessionId: payload.sessionId,
      role: "assistant",
      content: `正在处理：“${payload.message}”`,
      answer: "",
      parts: [],
      toolSteps: [],
      time: userTime,
      timestamp,
    },
    run: {
      id: runId,
      sessionId: payload.sessionId,
      assistantMessageId,
      provider: providerId,
      model: modelId,
      context: payload.context ?? [],
      timestamp,
    },
  });

  const sendEvent = (agentEvent: any): void => {
    if (event.sender.isDestroyed?.()) {
      return;
    }

    event.sender.send("ai:chat:event", {
      ...agentEvent,
      runId,
      sessionId: payload.sessionId,
    } satisfies AiChatIpcEvent);
  };
  const controller = new AbortController();
  const activeRun: ActiveAiChatRun = {
    sessionId: payload.sessionId,
    sessionTitle,
    prompt: payload.message,
    userMessageId,
    assistantMessageId,
    controller,
    sender: event.sender,
    assistantAnswer: "",
    assistantParts: [],
    assistantToolSteps: [],
  };
  const handleSenderDestroyed = (): void => {
    cancelAiChatAsk(runId);
  };

  activeAiChatRuns.set(runId, activeRun);
  event.sender.once?.("destroyed", handleSenderDestroyed);

  if (shouldCreateTitle) {
    scheduleInitialSessionTitle(
      {
        config,
        message: payload.message,
        runId,
        sessionId: payload.sessionId,
        sender: event.sender,
      },
      services.aiChatService,
    );
  }

  void (async () => {
    const updateAssistantSnapshot = (): void => {
      services.aiChatService.updateAssistantMessage({
        messageId: assistantMessageId,
        content: activeRun.assistantAnswer
          ? "AI 已生成回答"
          : `正在处理：“${payload.message}”`,
        answer: activeRun.assistantAnswer,
        parts: activeRun.assistantParts,
        toolSteps: activeRun.assistantToolSteps,
        timestamp: createTimestamp(),
      });
    };

    try {
      const resolveToolCallId = (providerToolCallId: string): string => {
        const existingToolCallId = toolCallIds.get(providerToolCallId);

        if (existingToolCallId) {
          return existingToolCallId;
        }

        const toolCallId = createCompactUuid();
        toolCallIds.set(providerToolCallId, toolCallId);
        return toolCallId;
      };

      const provider = await createModelProvider(providerConfig);

      // 创建 compaction provider（如果配置了）
      let compactionProvider: ModelProvider | undefined;
      let compactionModel: string | undefined;

      const compactionConfig = config.compaction;
      if (compactionConfig) {
        const compactionProviderConfig =
          config.providers[compactionConfig.provider];
        if (
          compactionProviderConfig &&
          compactionProviderConfig.models[compactionConfig.model]
        ) {
          compactionProvider = await createModelProvider(
            compactionProviderConfig,
          );
          compactionModel = compactionConfig.model;
        }
      }

      // 动态获取当前激活 Agent 的自动挂载 Skills 并合入 System Prompt
      let autoSkillsContent = "";
      try {
        const loadedSkills: AiAgentSkill[] = [];
        for (const hint of agentHints) {
          const skillsForAgent = await getAvailableSkillsForAgent(hint.id);
          loadedSkills.push(...skillsForAgent);
        }
        // 去重
        const uniqueSkills = Array.from(
          new Map(loadedSkills.map((s) => [s.id, s])).values()
        );
        if (uniqueSkills.length > 0) {
          autoSkillsContent =
            "\n\n# Automatically Loaded Agent Skills:\n" +
            uniqueSkills.map((s) => s.content).join("\n\n");
        }
      } catch (error) {
        console.error("Failed to load automatic skills in chatRunner:", error);
      }

      const baseSystemPrompt = appendAiChatAgentDirectiveToSystemMessage(
        createSystemPrompt(),
        agentHints,
      );

      const systemMessage = autoSkillsContent
        ? {
            ...baseSystemPrompt,
            content: `${baseSystemPrompt.content}${autoSkillsContent}`,
          }
        : baseSystemPrompt;

      for await (const agentEvent of runReactAgent({
        provider,
        model: modelId,
        compactionProvider,
        compactionModel,
        contextLimit: modelConfig.limit?.context,
        // 从 Agent 配置读取 maxTurns，未设置则默认 Infinity（无限制）。
        maxTurns:
          config.agent.context.maxTurns &&
          config.agent.context.maxTurns > 0
            ? config.agent.context.maxTurns
            : undefined,
        messages: buildContextAgentMessages({
          systemMessage,
          userMessage: payload.message,
          userParts: payload.parts,
          contextItems: payload.context,
          contextLimit: modelConfig.limit?.context,
          outputLimit: modelConfig.limit?.output,
          toolOutputMaxChars: config.agent.context.toolOutputMaxChars,
          // 0 表示不限制，转换为 Infinity 以保留全部工具结果。
          recentToolResultLimit:
            config.agent.context.recentToolResultLimit === 0
              ? Infinity
              : config.agent.context.recentToolResultLimit,
        }),
        tools,
        signal: controller.signal,
        askAnswerProvider: (request) => waitForAskAnswer(runId, request),
        toolConfirmationProvider: (request) =>
          waitForToolConfirmation(runId, request),
      })) {
        if (agentEvent.type === "text_delta") {
          activeRun.assistantAnswer += agentEvent.delta;
          activeRun.assistantParts.splice(
            0,
            activeRun.assistantParts.length,
            ...appendTextPart(
              activeRun.assistantParts,
              assistantMessageId,
              agentEvent.delta,
            ),
          );
          updateAssistantSnapshot();
        }

        if (agentEvent.type === "reasoning_delta") {
          activeRun.assistantParts.splice(
            0,
            activeRun.assistantParts.length,
            ...appendReasoningPart(
              activeRun.assistantParts,
              agentEvent.id,
              agentEvent.delta,
            ),
          );
          updateAssistantSnapshot();
        }

        if (agentEvent.type === "tool_started") {
          const persistedToolCallId = resolveToolCallId(agentEvent.id);
          activeRun.assistantParts.splice(
            0,
            activeRun.assistantParts.length,
            ...appendToolPart(
              activeRun.assistantParts,
              assistantMessageId,
              agentEvent.id,
            ),
          );
          activeRun.assistantToolSteps.push({
            id: agentEvent.id,
            title: `Tool result: ${agentEvent.name}`,
            status: "running",
            tool: agentEvent.name,
            input: agentEvent.input,
            observation: "Tool is running.",
          });
          services.aiChatService.upsertToolCall({
            id: createCompactUuid(),
            runId,
            messageId: assistantMessageId,
            toolCallId: persistedToolCallId,
            name: agentEvent.name,
            status: "running",
            input: agentEvent.input,
            observation: "",
            data: null,
            timestamp: createTimestamp(),
          });
          updateAssistantSnapshot();
        }

        if (agentEvent.type === "tool_finished") {
          const persistedToolCallId = resolveToolCallId(agentEvent.id);
          const toolStepIndex = activeRun.assistantToolSteps.findIndex(
            (step) => step.id === agentEvent.id,
          );
          const isAskRequest = isAskRequestData(agentEvent.data);
          const isToolConfirmationRequest = isToolConfirmationRequestData(
            agentEvent.data,
          );
          const isConfirmedToolConfirmationAnswer =
            isToolConfirmationAnswerData(agentEvent.data) &&
            agentEvent.data.action === "confirm";
          const nextToolStep: AiToolStep = {
            id: agentEvent.id,
            title: `Tool result: ${agentEvent.name}`,
            status:
              isAskRequest ||
              isToolConfirmationRequest ||
              isConfirmedToolConfirmationAnswer
                ? "running"
                : "done",
            tool: agentEvent.name,
            input: activeRun.assistantToolSteps[toolStepIndex]?.input,
            observation: agentEvent.observation,
            data: agentEvent.data,
          };

          if (toolStepIndex >= 0) {
            activeRun.assistantToolSteps[toolStepIndex] = nextToolStep;
          } else {
            activeRun.assistantParts.splice(
              0,
              activeRun.assistantParts.length,
              ...appendToolPart(
                activeRun.assistantParts,
                assistantMessageId,
                agentEvent.id,
              ),
            );
            activeRun.assistantToolSteps.push(nextToolStep);
          }

          services.aiChatService.upsertToolCall({
            id: createCompactUuid(),
            runId,
            messageId: assistantMessageId,
            toolCallId: persistedToolCallId,
            name: agentEvent.name,
            status:
              isAskRequest ||
              isToolConfirmationRequest ||
              isConfirmedToolConfirmationAnswer
                ? "running"
                : "done",
            input: nextToolStep.input ?? {},
            observation: agentEvent.observation,
            data: agentEvent.data,
            timestamp: createTimestamp(),
          });
          updateAssistantSnapshot();
        }

        if (agentEvent.type === "tool_failed") {
          const persistedToolCallId = resolveToolCallId(agentEvent.id);
          const toolStepIndex = activeRun.assistantToolSteps.findIndex(
            (step) => step.id === agentEvent.id,
          );
          const isAskCancelled =
            agentEvent.name === "common_tool_ask" &&
            agentEvent.error === ASK_CANCELLED_MESSAGE;
          const isToolConfirmationCancelled =
            agentEvent.error === TOOL_CONFIRMATION_CANCELLED_MESSAGE;
          const isCancelled = isAskCancelled || isToolConfirmationCancelled;
          const cancelledObservation = isAskCancelled
            ? "Ask was cancelled."
            : "Tool confirmation was cancelled.";
          const nextToolStep: AiToolStep = {
            id: agentEvent.id,
            title: isCancelled
              ? `Tool cancelled: ${agentEvent.name}`
              : `Tool failed: ${agentEvent.name}`,
            status: isCancelled ? "cancelled" : "failed",
            tool: agentEvent.name,
            input: agentEvent.input,
            observation: isCancelled
              ? cancelledObservation
              : `Tool execution failed: ${agentEvent.error}`,
            data: {
              error: agentEvent.error,
            },
          };

          if (toolStepIndex >= 0) {
            activeRun.assistantToolSteps[toolStepIndex] = nextToolStep;
          } else {
            activeRun.assistantParts.splice(
              0,
              activeRun.assistantParts.length,
              ...appendToolPart(
                activeRun.assistantParts,
                assistantMessageId,
                agentEvent.id,
              ),
            );
            activeRun.assistantToolSteps.push(nextToolStep);
          }

          services.aiChatService.upsertToolCall({
            id: createCompactUuid(),
            runId,
            messageId: assistantMessageId,
            toolCallId: persistedToolCallId,
            name: agentEvent.name,
            status: "failed",
            input: agentEvent.input,
            observation: isCancelled
              ? cancelledObservation
              : `Tool execution failed: ${agentEvent.error}`,
            data: {
              error: agentEvent.error,
            },
            error: agentEvent.error,
            timestamp: createTimestamp(),
          });
          updateAssistantSnapshot();
        }

        if (agentEvent.type === "error") {
          const failedTimestamp = createTimestamp();
          services.aiChatService.failRunWithAssistantMessage({
            run: {
              id: runId,
              status: "failed",
              error: agentEvent.message,
              timestamp: failedTimestamp,
            },
            session: {
              id: payload.sessionId,
              title: sessionTitle,
              status: "failed",
              timestamp: failedTimestamp,
            },
            assistantMessage: {
              messageId: assistantMessageId,
              content: "AI chat execution failed",
              answer: agentEvent.message,
              parts: activeRun.assistantParts,
              toolSteps: activeRun.assistantToolSteps,
              timestamp: failedTimestamp,
            },
          });
        }

        if (agentEvent.type === "done") {
          services.aiChatService.finishRun({
            id: runId,
            status: "completed",
            timestamp: createTimestamp(),
          });
          services.aiChatService.ensureSession({
            id: payload.sessionId,
            title: sessionTitle,
            status: "completed",
            timestamp: createTimestamp(),
          });
        }

        sendEvent(agentEvent);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI chat execution failed";

      if (controller.signal.aborted && !activeAiChatRuns.has(runId)) {
        return;
      }

      const failedTimestamp = createTimestamp();
      services.aiChatService.failRunWithAssistantMessage({
        run: {
          id: runId,
          status: "failed",
          error: message,
          timestamp: failedTimestamp,
        },
        session: {
          id: payload.sessionId,
          title: sessionTitle,
          status: "failed",
          timestamp: failedTimestamp,
        },
        assistantMessage: {
          messageId: assistantMessageId,
          content: "AI chat execution failed",
          answer: message,
          parts: activeRun.assistantParts,
          toolSteps: activeRun.assistantToolSteps,
          timestamp: failedTimestamp,
        },
      });
      sendEvent({
        type: "error",
        message,
      });
    } finally {
      activeAiChatRuns.delete(runId);
      event.sender.removeListener?.("destroyed", handleSenderDestroyed);
    }
  })();

  return {
    runId,
  };
};
