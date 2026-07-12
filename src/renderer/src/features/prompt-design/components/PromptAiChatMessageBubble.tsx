import type {
  CuratorAskAnswerSubmitPayload,
  CuratorToolConfirmationAnswerSubmitPayload,
} from "@/components/ai-shared/AskRequestPanel";
import { CuratorThinkingBlock } from "@/components/ai-shared/ThinkingBlock";
import { CuratorToolCallBlock } from "@/components/ai-shared/ToolCallBlock";
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
  part: PromptAiPart,
): CuratorToolStep | null => part.kind === "tool" && "stepId" in part
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
    const elements: React.JSX.Element[] = [];
    let toolSteps: CuratorToolStep[] = [];
    let toolKeys: string[] = [];

    const flushToolSteps = (): void => {
      if (!toolSteps.length) return;
      elements.push(
        <CuratorToolCallBlock
          key={toolKeys.join("-")}
          steps={toolSteps}
          onSubmitAskAnswer={onSubmitAskAnswer}
          onSubmitToolConfirmationAnswer={onSubmitToolConfirmationAnswer}
        />,
      );
      toolSteps = [];
      toolKeys = [];
    };

    for (const [index, part] of messageParts.entries()) {
      if (part.kind === "tool") {
        const step = findToolStepByPart(message.toolSteps, part);
        if (step) {
          toolSteps.push(step);
          toolKeys.push(`${message.id}-${part.id}`);
        }
        continue;
      }

      flushToolSteps();
      if (part.kind === "reasoning" && part.content) {
        elements.push(
          <CuratorThinkingBlock
            key={`${message.id}-reasoning-${index}`}
            content={part.content}
            isGenerating={part.status === "streaming" || (isGenerating && index === messageParts.length - 1)}
          />,
        );
      } else if (part.kind === "text" && part.content) {
        elements.push(
          <div key={`${message.id}-text-${index}`} className="markdown-preview-container curator-markdown-preview select-text max-w-full">
            <MdPreview theme="dark" modelValue={part.content} previewTheme="default" codeTheme="atom" style={{ backgroundColor: "transparent" }} showCodeRowNumber={false} />
          </div>,
        );
      }
    }
    flushToolSteps();
    return elements;
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
