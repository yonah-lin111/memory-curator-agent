import React from "react";
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
import { CuratorSkillCallBlock } from "@/components/ai-shared/SkillCallBlock";
import { PromptAiMcpCallBlock } from "@/features/prompt-design/components/PromptAiMcpCallBlock";
import { PromptAiMcpOverview } from "@/features/prompt-design/components/PromptAiMcpOverview";
import {
  ExecutionGroupBlock,
  groupExecutionParts,
  type ExecutionSequencePart,
} from "@/components/ai-shared/ExecutionGroup";
import { Tag } from "@/components/ui/Tag";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAiSettingsStore } from "@/lib/aiSettingsStore";
import type { CuratorToolStep } from "@/features/curator/types";
import type { PromptAiMessage, PromptAiPart } from "@/features/prompt-design/components/usePromptAiChatController";
import type { PromptDesignReference } from "@/features/prompt-design/types";
import { MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";

export type PromptAiMessageContextMenuRequest = {
  messageId: string;
  x: number;
  y: number;
  canRegenerate: boolean;
  plainTextContent: string;
  markdownContent: string;
  onEdit?: () => void;
};

const stripMarkdownSyntax = (content: string): string => content
  .replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, "$1")
  .replace(/`([^`]+)`/g, "$1")
  .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
  .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
  .replace(/^#{1,6}\s+/gm, "")
  .replace(/^>\s?/gm, "")
  .replace(/^\s*[-*+]\s+/gm, "")
  .replace(/^\s*\d+\.\s+/gm, "")
  .replace(/[*_~]{1,3}/g, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

type PromptAiChatMessageBubbleProps = {
  message: PromptAiMessage;
  isGenerating?: boolean;
  canRegenerate?: boolean;
  onSubmitAskAnswer?: (
    payload: CuratorAskAnswerSubmitPayload,
  ) => void | Promise<void>;
  onOpenContextMenu: (request: PromptAiMessageContextMenuRequest) => void;
  onEditAndResendUserMessage?: (messageId: string, text: string) => void | Promise<void>;
  onReferenceSelect?: (reference: PromptDesignReference) => void;
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
  canRegenerate = false,
  onSubmitAskAnswer,
  onOpenContextMenu,
  onEditAndResendUserMessage,
  onReferenceSelect,
  onSubmitToolConfirmationAnswer,
}: PromptAiChatMessageBubbleProps): React.JSX.Element => {
  const showAgentThinking = useAiSettingsStore((state) => state.showAgentThinking);
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isSystemCommand = message.role === "system_command";
  const [isEditing, setIsEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(message.content);
  const messageParts = resolveMessageParts(message);
  const markdownContent = isUser ? message.content : messageParts.filter((part): part is Extract<PromptAiPart, { kind: "text" }> => part.kind === "text").map((part) => part.content).join("\n\n").trim() || message.content;
  const plainTextContent = stripMarkdownSyntax(markdownContent);

  /**
   * 打开当前消息的右键菜单。
   */
  const handleOpenContextMenu = (event: React.MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    onOpenContextMenu({
      messageId: message.id,
      x: event.clientX,
      y: event.clientY,
      canRegenerate,
      plainTextContent,
      markdownContent,
      onEdit: isUser ? () => setIsEditing(true) : undefined,
    });
  };

  const renderAssistantParts = (): React.JSX.Element[] => {
    const visibleMessageParts = showAgentThinking
      ? messageParts
      : messageParts.filter((part) => part.kind !== "reasoning");
    const renderExecutionParts = (
      sequenceParts: ExecutionSequencePart[],
      connectsToNextExecution = false,
    ): React.JSX.Element[] => groupExecutionParts(sequenceParts).flatMap((item, itemIndex, groups) => {
      if (item.kind === "text") {
        const part = visibleMessageParts.find((candidate) => candidate.id === item.id);
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
          renderPart={(sequencePart, nextExecution) => {
            const part = visibleMessageParts.find((candidate) => candidate.id === sequencePart.id);
            if (part?.kind === "reasoning" && part.content) {
              return <CuratorThinkingBlock key={part.id} content={part.content} isGenerating={part.status === "streaming" || (isGenerating && part.id === messageParts.at(-1)?.id)} connectsToNextExecution={nextExecution} />;
            }
            const step = part && findToolStepByPart(message.toolSteps, part);
            return step ? <CuratorToolCallBlock key={part.id} steps={[step]} onSubmitAskAnswer={onSubmitAskAnswer} onSubmitToolConfirmationAnswer={onSubmitToolConfirmationAnswer} connectsToNextExecution={nextExecution} /> : <></>;
          }}
          renderToolParts={(toolParts, nextExecution) => {
            const steps = toolParts.flatMap((toolPart) => {
              const part = visibleMessageParts.find((candidate) => candidate.id === toolPart.id);
              const step = findToolStepByPart(message.toolSteps, part);
              return step ? [step] : [];
            });

            return steps.length > 0 ? <CuratorToolCallBlock key={toolParts[0].id} steps={steps} onSubmitAskAnswer={onSubmitAskAnswer} onSubmitToolConfirmationAnswer={onSubmitToolConfirmationAnswer} connectsToNextExecution={nextExecution || (itemIndex === groups.length - 1 && connectsToNextExecution)} /> : <></>;
          }}
        />,
      ];
    });

    const renderedParts: React.JSX.Element[] = [];
    let executionParts: ExecutionSequencePart[] = [];
    const flushExecutionParts = (connectsToNextExecution = false): void => {
      if (executionParts.length > 0) {
        renderedParts.push(...renderExecutionParts(executionParts, connectsToNextExecution));
        executionParts = [];
      }
    };

    for (let index = 0; index < visibleMessageParts.length; index += 1) {
      const part = visibleMessageParts[index];
      const step = findToolStepByPart(message.toolSteps, part);

      if (step?.mcp) {
        const previousPart = visibleMessageParts[index - 1];
        flushExecutionParts(previousPart?.kind === "tool" || previousPart?.kind === "reasoning");
        const mcpSteps = [step];
        let nextIndex = index + 1;
        while (nextIndex < visibleMessageParts.length) {
          const nextStep = findToolStepByPart(message.toolSteps, visibleMessageParts[nextIndex]);
          if (!nextStep?.mcp || nextStep.mcp.serverId !== step.mcp.serverId) break;
          mcpSteps.push(nextStep);
          nextIndex += 1;
        }
        const nextPart = visibleMessageParts[nextIndex];
        renderedParts.push(<PromptAiMcpCallBlock key={`${message.id}-${part.id}`} steps={mcpSteps} connectsToNextExecution={nextPart?.kind === "tool" || nextPart?.kind === "reasoning"} />);
        index = nextIndex - 1;
        continue;
      }

      if (step?.tool === "load_skill") {
        const previousPart = visibleMessageParts[index - 1];
        flushExecutionParts(previousPart?.kind === "tool" || previousPart?.kind === "reasoning");
        const skillSteps = [step];
        let nextIndex = index + 1;
        while (nextIndex < visibleMessageParts.length) {
          const nextStep = findToolStepByPart(message.toolSteps, visibleMessageParts[nextIndex]);
          if (nextStep?.tool !== "load_skill") break;
          skillSteps.push(nextStep);
          nextIndex += 1;
        }
        const nextPart = visibleMessageParts[nextIndex];
        renderedParts.push(<CuratorSkillCallBlock key={`${message.id}-${part.id}`} steps={skillSteps} connectsToNextExecution={nextPart?.kind === "tool" || nextPart?.kind === "reasoning"} />);
        index = nextIndex - 1;
        continue;
      }

      if (part.kind === "text") executionParts.push({ id: part.id, kind: "text" });
      else if (part.kind === "reasoning") executionParts.push({ id: part.id, kind: "reasoning" });
      else {
        executionParts.push({
          id: part.id,
          kind: "tool",
          isSkillTool: step?.tool === "load_skill",
          isInteractionTool: Boolean(step && (
            isCuratorAskRequest(step.data) ||
            isCuratorToolConfirmationRequest(step.data) ||
            isCuratorAskAnswer(step.data) ||
            isCuratorToolConfirmationAnswer(step.data)
          )),
        });
      }
    }

    flushExecutionParts();
    return renderedParts;
  };

  const isNonTimedSystemMessage = isSystem || isSystemCommand;

  return (
    <div className={`flex gap-3 w-full scroll-mt-4 group/msg-bubble-container ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`} onContextMenu={handleOpenContextMenu}>
      <div className={`flex flex-col gap-1 min-w-0 ${isNonTimedSystemMessage ? "w-full" : isUser ? "items-end" : "flex-1"}`}>
        <div className={`rounded-[6px] px-1 py-1 text-sm leading-relaxed break-words max-w-full ${isNonTimedSystemMessage ? "w-full" : "w-fit"} ${isUser ? "bg-transparent text-white font-medium whitespace-pre-wrap" : "text-white/80"} ${message.cancelled ? "line-through opacity-50" : ""}`}>
          {isUser ? (
            isEditing ? (
              <div className="flex w-[400px] max-w-full flex-col gap-2 rounded-[6px] border border-white/10 bg-[#212121] p-2.5">
                <textarea value={editText} onChange={(event) => setEditText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (editText.trim() && editText.trim() !== message.content.trim() && !isGenerating) { setIsEditing(false); void onEditAndResendUserMessage?.(message.id, editText.trim()); } } }} className="w-full resize-none bg-transparent text-sm text-white focus:outline-none custom-scrollbar" autoFocus />
                <div className="flex justify-end gap-1.5 border-t border-white/5 pt-2">
                  <button type="button" className="rounded-[4px] px-2 py-1 text-xs text-white/50 hover:bg-white/10" onClick={() => { setIsEditing(false); setEditText(message.content); }}>取消</button>
                  <button type="button" className="rounded-[4px] bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/15 disabled:opacity-40" disabled={!editText.trim() || editText.trim() === message.content.trim() || isGenerating} onClick={() => { setIsEditing(false); void onEditAndResendUserMessage?.(message.id, editText.trim()); }}>发送并重新生成</button>
                </div>
              </div>
            ) : <div className="overflow-hidden w-fit max-w-full select-text pr-1 text-left"><div className="mb-1">{message.content}</div>{message.references?.length ? <div className="flex flex-wrap justify-end gap-1">{message.references.map((reference) => <Tooltip key={reference.id} content={<pre className="max-h-60 max-w-[360px] overflow-auto whitespace-pre-wrap text-xs">{reference.content}</pre>}><Tag size="small" onClick={() => onReferenceSelect?.(reference)}>第{reference.startLine}–{reference.endLine}行</Tag></Tooltip>)}</div> : null}</div>
          ) : isSystemCommand ? (
            <div className="flex w-full items-center gap-3 py-1 text-white/45">
              <span className="h-px flex-1 bg-white/10" />
              <span className="shrink-0 text-xs font-bold italic">{message.content}</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-w-full">
              {isSystem ? <div className="px-1 text-xs font-mono uppercase text-white/40">System Message · MCP Tools</div> : null}
              {message.mcpServers ? <PromptAiMcpOverview servers={message.mcpServers} /> : renderAssistantParts()}
            </div>
          )}
        </div>
        {!isNonTimedSystemMessage ? <div className={`text-xs font-mono mt-0.5 px-1 text-white/30 flex items-center gap-1.5 min-h-[1.25rem] ${isUser ? "justify-end text-right" : "justify-start text-left"}`}>
          <span>{isGenerating ? (
            <span className="relative flex h-1.5 w-1.5 my-1 ml-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white/50" />
            </span>
          ) : message.time.includes("T") ? new Date(message.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : message.time.slice(11, 16) || message.time}</span>
          {!isUser && message.model && <Tag size="default" color="default" bgClass="border-white/5 bg-white/[0.03] text-white/30 select-none" className="scale-90 origin-left">{message.model}</Tag>}
        </div> : null}
      </div>
    </div>
  );
};
