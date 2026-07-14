import {
  isCuratorAskRequest,
  isCuratorToolConfirmationRequest,
  isCuratorAskAnswer,
  isCuratorToolConfirmationAnswer,
  type CuratorAskAnswerSubmitPayload,
  type CuratorToolConfirmationAnswerSubmitPayload,
} from "@/components/ai-shared/AskRequestPanel";
import { CuratorThinkingBlock } from "@/components/ai-shared/ThinkingBlock";
import { CuratorToolCallBlock } from "@/components/ai-shared/ToolCallBlock";
import {
  ExecutionGroupBlock,
  groupExecutionParts,
  type ExecutionSequencePart,
} from "@/components/ai-shared/ExecutionGroup";
import { Tag } from "@/components/ui/Tag";
import type { CuratorToolStep } from "@/features/curator/types";
import type { PromptAiMessage, PromptAiPart } from "@/features/prompt-design/components/usePromptAiChatController";
import { MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";

type PromptAiChatMessageBubbleProps = {
  message: PromptAiMessage;
  isGenerating?: boolean;
  onSubmitAskAnswer?: (
    payload: CuratorAskAnswerSubmitPayload,
  ) => void | Promise<void>;
  onSubmitToolConfirmationAnswer?: (
    payload: CuratorToolConfirmationAnswerSubmitPayload,
  ) => void | Promise<void>;
};

/**
 * 旧记录缺少顺序片段时，按旧字段生成可显示的降级顺序。
 */
const resolveMessageParts = (message: PromptAiMessage): PromptAiPart[] => {
  const usableParts = message.parts?.filter(
    (part): part is PromptAiPart => part.kind === "text" || part.kind === "reasoning" || part.kind === "tool",
  ) || [];

  const nextParts = [...usableParts];
  const hasText = nextParts.some((part) => part.kind === "text");
  const hasTool = nextParts.some((part) => part.kind === "tool");

  if (!hasText && message.content) {
    nextParts.push({
      id: `${message.id}-content`,
      kind: "text",
      content: message.content,
    });
  }

  if (!hasTool && message.toolSteps?.length) {
    const toolParts: PromptAiPart[] = message.toolSteps.map((step) => ({
      id: `${message.id}-tool-${step.id}`,
      kind: "tool",
      stepId: step.id,
    }));
    const firstTextIndex = nextParts.findIndex((part) => part.kind === "text");
    if (firstTextIndex !== -1) {
      nextParts.splice(firstTextIndex, 0, ...toolParts);
    } else {
      nextParts.push(...toolParts);
    }
  }

  return nextParts;
};

/**
 * 按顺序片段查找工具步骤。
 */
const findToolStepByPart = (
  steps: CuratorToolStep[] | undefined,
  part: PromptAiPart | undefined,
): CuratorToolStep | null => part && part.kind === "tool" && "stepId" in part
  ? steps?.find((step) => step.id === part.stepId) ?? null
  : null;

/**
 * PromptAiChatMessageBubble - 按模型真实输出顺序渲染提示词 AI 消息。
 */
export const PromptAiChatMessageBubble = ({
  message,
  isGenerating = false,
  onSubmitAskAnswer,
  onSubmitToolConfirmationAnswer,
}: PromptAiChatMessageBubbleProps): React.JSX.Element => {
  const isUser = message.role === "user";
  const messageParts = resolveMessageParts(message);

  const renderAssistantParts = (): React.JSX.Element[] => {
    const sequenceParts: ExecutionSequencePart[] = messageParts.map((part) => {
      if (part.kind === "text") return { id: part.id, kind: "text" };
      if (part.kind === "reasoning") return { id: part.id, kind: "reasoning" };
      const step = findToolStepByPart(message.toolSteps, part);
      return {
        id: part.id,
        kind: "tool",
        isInteractionTool: Boolean(
          step && (
            isCuratorAskRequest(step.data) ||
            isCuratorToolConfirmationRequest(step.data) ||
            isCuratorAskAnswer(step.data) ||
            isCuratorToolConfirmationAnswer(step.data)
          ),
        ),
      };
    });

    return groupExecutionParts(sequenceParts).flatMap((item) => {
      if (item.kind === "text") {
        const part = messageParts.find((candidate) => candidate.id === item.id);
        return part?.kind === "text" && part.content
          ? [<div key={`${message.id}-${part.id}`} className="markdown-preview-container curator-markdown-preview select-text max-w-full"><MdPreview theme="dark" modelValue={part.content} previewTheme="default" codeTheme="atom" style={{ backgroundColor: "transparent" }} autoFoldThreshold={isGenerating ? Infinity : 0} showCodeRowNumber={false} /></div>]
          : [];
      }

      const { group } = item;
      return [
        <ExecutionGroupBlock
          key={`${message.id}-${group.id}`}
          group={group}
          isGenerating={isGenerating}
          onToggle={undefined}
          renderPart={(sequencePart, connectsToNextExecution) => {
            const part = messageParts.find((candidate) => candidate.id === sequencePart.id);
            if (part?.kind === "reasoning" && part.content) {
              return <CuratorThinkingBlock key={part.id} content={part.content} isGenerating={part.status === "streaming" || (isGenerating && part.id === messageParts.at(-1)?.id)} connectsToNextExecution={connectsToNextExecution} />;
            }
            const step = part && findToolStepByPart(message.toolSteps, part);
            return step ? <CuratorToolCallBlock key={part.id} steps={[step]} onSubmitAskAnswer={onSubmitAskAnswer} onSubmitToolConfirmationAnswer={onSubmitToolConfirmationAnswer} connectsToNextExecution={connectsToNextExecution} /> : <></>;
          }}
        />,
      ];
    });
  };

  return (
    <div className={`flex gap-3 w-full scroll-mt-4 group/msg-bubble-container ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
      <div className={`flex flex-col gap-1 min-w-0 ${isUser ? "items-end" : "flex-1"}`}>
        <div className={`rounded-[6px] px-1 py-1 text-sm leading-relaxed break-words w-fit max-w-full ${isUser ? "bg-transparent text-white font-medium whitespace-pre-wrap" : "text-white/80"} ${message.cancelled ? "line-through opacity-50" : ""}`}>
          {isUser ? (
            <div className="overflow-hidden w-fit max-w-full select-text pr-1 text-left">{message.content}</div>
          ) : (
            <div className="flex flex-col gap-1.5 max-w-full">{renderAssistantParts()}</div>
          )}
        </div>
        <div className={`text-xs font-mono mt-0.5 px-1 text-white/30 flex items-center gap-1.5 min-h-[1.25rem] ${isUser ? "justify-end text-right" : "justify-start text-left"}`}>
          <span>{isGenerating ? (
            <span className="relative flex h-1.5 w-1.5 my-1 ml-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white/50" />
            </span>
          ) : message.time.includes("T") ? new Date(message.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : message.time.slice(11, 16) || message.time}</span>
          {!isUser && message.model && <Tag size="default" color="default" bgClass="border-white/5 bg-white/[0.03] text-white/30 select-none" className="scale-90 origin-left">{message.model}</Tag>}
        </div>
      </div>
    </div>
  );
};
