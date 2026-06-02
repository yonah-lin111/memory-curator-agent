import type React from "react";
import { Bot, Loader2 } from "lucide-react";
import type {
  AiChatMessage,
  AiChatMessagePart,
  AiToolStep,
} from "@renderer/features/ai-chat/types";
import { AiChatThinkingBlock } from "@renderer/features/ai-chat/components/AiChatThinkingBlock";
import { AiToolCallBlock } from "@renderer/features/ai-chat/components/AiToolCallBlock";
import {
  resolveDedupedRenderablePartContents,
  resolveDedupedTextContents,
} from "@renderer/features/ai-chat/core/aiChatReasoningDedupe";
import { MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";

// 工具观察段起始标记。
const TOOL_OBSERVATION_LABEL = "Tool observation:";

// 工具结构化数据段起始标记。
const TOOL_DATA_LABEL = "Tool data:";

// Markdown 代码块围栏。
const MARKDOWN_CODE_FENCE = "```";

// AI 聊天气泡组件属性类型。
type AiChatMessageBubbleProps = {
  // 当前消息数据。
  message: AiChatMessage;
  // 是否正在生成中。
  isGenerating?: boolean;
  // 是否允许对当前助手回答重新生成。
  canRegenerate?: boolean;
  // 打开消息右键菜单回调。
  onOpenContextMenu: (request: AiChatMessageContextMenuRequest) => void;
};

// AI 消息右键菜单打开请求类型。
export type AiChatMessageContextMenuRequest = {
  // 菜单所属消息 ID。
  messageId: string;
  // 菜单显示横坐标。
  x: number;
  // 菜单显示纵坐标。
  y: number;
  // 是否允许对当前助手回答重新生成。
  canRegenerate: boolean;
  // 可复制的纯文本内容。
  plainTextContent: string;
  // 可复制的 Markdown 内容。
  markdownContent: string;
};

// Markdown 预览组件属性类型。
type AiMarkdownPreviewProps = {
  // Markdown 正文。
  content: string;
  // 附加容器类名。
  className?: string;
  // 是否正在生成中。
  isGenerating?: boolean;
};

// AI 消息片段解析参数类型。
type ResolveAiMessagePartsParams = {
  // 当前消息数据。
  message: AiChatMessage;
  // 当前是否处于处理中占位态。
  isProcessing: boolean;
  // 已清理后的最终回答。
  displayAnswer: string;
};

/**
 * findFirstNonWhitespaceIndex - 查找指定位置后的第一个非空白字符。
 */
const findFirstNonWhitespaceIndex = (
  source: string,
  startIndex: number,
): number => {
  for (let index = startIndex; index < source.length; index += 1) {
    if (!/\s/.test(source[index])) {
      return index;
    }
  }

  return source.length;
};

/**
 * findJsonValueEnd - 基于括号平衡查找 JSON 对象或数组的结束位置。
 */
const findJsonValueEnd = (
  source: string,
  startIndex: number,
): number | null => {
  const openChar = source[startIndex];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let isInString = false;
  let isEscaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

    if (isInString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === "\\") {
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        isInString = false;
      }

      continue;
    }

    if (char === '"') {
      isInString = true;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }

  return null;
};

/**
 * resolveToolDataSectionEnd - 解析工具数据段的结束位置。
 */
const resolveToolDataSectionEnd = (
  source: string,
  valueStartIndex: number,
): number => {
  const contentStartIndex = findFirstNonWhitespaceIndex(
    source,
    valueStartIndex,
  );
  const firstChar = source[contentStartIndex];

  if (source.startsWith(MARKDOWN_CODE_FENCE, contentStartIndex)) {
    const fenceEndIndex = source.indexOf(
      MARKDOWN_CODE_FENCE,
      contentStartIndex + MARKDOWN_CODE_FENCE.length,
    );
    return fenceEndIndex >= 0
      ? fenceEndIndex + MARKDOWN_CODE_FENCE.length
      : source.length;
  }

  if (firstChar === "{" || firstChar === "[") {
    return findJsonValueEnd(source, contentStartIndex) ?? source.length;
  }

  const nextBlockIndex = source.indexOf("\n\n", valueStartIndex);
  return nextBlockIndex >= 0 ? nextBlockIndex : source.length;
};

/**
 * stripLeakedToolJson - 从最终回答中剥离被模型复述的工具观察和 JSON 数据。
 */
const stripLeakedToolJson = (answer: string, hasToolSteps: boolean): string => {
  if (!hasToolSteps || !answer.includes(TOOL_DATA_LABEL)) {
    return answer;
  }

  let cursorIndex = 0;
  let cleanedAnswer = "";

  while (cursorIndex < answer.length) {
    const dataLabelIndex = answer.indexOf(TOOL_DATA_LABEL, cursorIndex);

    if (dataLabelIndex < 0) {
      cleanedAnswer += answer.slice(cursorIndex);
      break;
    }

    const observationLabelIndex = answer.lastIndexOf(
      TOOL_OBSERVATION_LABEL,
      dataLabelIndex,
    );
    const sectionStartIndex =
      observationLabelIndex >= cursorIndex
        ? observationLabelIndex
        : dataLabelIndex;
    const dataValueStartIndex = dataLabelIndex + TOOL_DATA_LABEL.length;
    const sectionEndIndex = resolveToolDataSectionEnd(
      answer,
      dataValueStartIndex,
    );

    cleanedAnswer += answer.slice(cursorIndex, sectionStartIndex);
    cursorIndex = sectionEndIndex;
  }

  return cleanedAnswer.replace(/\n{3,}/g, "\n\n").trim();
};

/**
 * stripMarkdownSyntax - 将可读 Markdown 粗略转换为纯文本。
 */
const stripMarkdownSyntax = (content: string): string =>
  content
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

/**
 * AiMarkdownPreview - 渲染 AI 内容 Markdown 片段。
 */
const AiMarkdownPreview = ({
  content,
  className = "",
  isGenerating = false,
}: AiMarkdownPreviewProps): React.JSX.Element => {
  return (
    <div
      className={`markdown-preview-container ai-chat-markdown-preview select-text max-w-full ${className}`}
    >
      <MdPreview
        theme="dark"
        modelValue={content}
        previewTheme="default"
        codeTheme="atom"
        style={{ backgroundColor: "transparent" }}
        // AI 输出（生成中）时不折叠代码块，非输出状态下默认折叠所有代码块（阈值设为0）
        autoFoldThreshold={isGenerating ? Infinity : 0}
        showCodeRowNumber={false}
      />
    </div>
  );
};

/**
 * resolveAiMessageParts - 优先使用真实流式顺序，旧数据降级为 content/tools/answer。
 */
const resolveAiMessageParts = ({
  message,
  isProcessing,
  displayAnswer,
}: ResolveAiMessagePartsParams): AiChatMessagePart[] => {
  if (message.parts?.length) {
    return message.parts;
  }

  const fallbackParts: AiChatMessagePart[] = [];

  if (!isProcessing && message.content) {
    fallbackParts.push({
      id: `${message.id}-content`,
      kind: "text",
      content: message.content,
    });
  }

  for (const step of message.toolSteps ?? []) {
    fallbackParts.push({
      id: `${message.id}-tool-${step.id}`,
      kind: "tool",
      stepId: step.id,
    });
  }

  if (displayAnswer) {
    fallbackParts.push({
      id: `${message.id}-answer`,
      kind: "text",
      content: displayAnswer,
    });
  }

  return fallbackParts;
};

/**
 * findToolStepByPart - 根据顺序片段查找对应工具步骤。
 */
const findToolStepByPart = (
  steps: AiToolStep[] | undefined,
  part: AiChatMessagePart,
): AiToolStep | null => {
  if (part.kind !== "tool") {
    return null;
  }

  return steps?.find((step) => step.id === part.stepId) ?? null;
};

/**
 * isReasoningPartGenerating - 判断指定思考片段是否仍在流式输出。
 */
const isReasoningPartGenerating = (
  parts: AiChatMessagePart[],
  partIndex: number,
  isMessageGenerating: boolean,
): boolean => {
  const part = parts[partIndex];

  if (part?.kind !== "reasoning") {
    return false;
  }

  if (part.status) {
    return part.status === "streaming";
  }

  return isMessageGenerating && partIndex === parts.length - 1;
};

/**
 * AiChatMessageBubble - 渲染单个用户或 AI 消息气泡。
 */
export const AiChatMessageBubble = ({
  message,
  isGenerating = false,
  canRegenerate = false,
  onOpenContextMenu,
}: AiChatMessageBubbleProps): React.JSX.Element => {
  const isUser = message.role === "user";
  const isProcessing =
    !isUser &&
    (message.content.startsWith("Processing:") ||
      message.content.startsWith("正在处理："));
  const hasToolSteps = Boolean(message.toolSteps?.length);
  const displayAnswer =
    !isUser && message.answer
      ? stripLeakedToolJson(message.answer, hasToolSteps)
      : "";
  const messageParts = !isUser
    ? resolveAiMessageParts({
        message,
        isProcessing,
        displayAnswer,
      })
    : [];
  const dedupedTextContents = resolveDedupedTextContents(messageParts);
  const dedupedRenderablePartContents =
    resolveDedupedRenderablePartContents(messageParts);
  const markdownContent = isUser
    ? message.content
    : dedupedTextContents.join("\n\n").trim();
  const resolvedMarkdownContent =
    markdownContent || displayAnswer || message.answer || message.content;
  const plainTextContent = stripMarkdownSyntax(resolvedMarkdownContent);

  /**
   * 打开当前消息的右键菜单。
   */
  const handleOpenContextMenu = (
    event: React.MouseEvent<HTMLDivElement>,
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    onOpenContextMenu({
      messageId: message.id,
      x: event.clientX,
      y: event.clientY,
      canRegenerate: canRegenerate && !isGenerating,
      plainTextContent,
      markdownContent: resolvedMarkdownContent,
    });
  };

  return (
    <div
      className={`flex gap-3 w-full max-w-[85%] ${
        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
      }`}
      onContextMenu={handleOpenContextMenu}
    >
      {/* 角色头像 */}
      {!isUser && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-white/5 bg-white text-black">
          <Bot className="h-3.5 w-3.5" />
        </div>
      )}

      {/* 消息气泡主体 */}
      <div
        className={`flex flex-col gap-1 min-w-0 ${isUser ? "items-end" : "flex-1"}`}
      >
        <div
          className={`rounded-[6px] px-1 py-1  text-sm leading-relaxed break-words w-fit max-w-full ${
            isUser
              ? "bg-transparent text-white font-medium whitespace-pre-wrap"
              : "  text-white/80"
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <div className="flex flex-col gap-1.5 max-w-full">
              {(() => {
                const groupedElements: React.JSX.Element[] = [];
                let currentToolSteps: AiToolStep[] = [];
                let currentToolKeys: string[] = [];

                const flushToolSteps = (): void => {
                  if (currentToolSteps.length > 0) {
                    const key = currentToolKeys.join("-");
                    groupedElements.push(
                      <AiToolCallBlock
                        key={key}
                        steps={[...currentToolSteps]}
                      />,
                    );
                    currentToolSteps = [];
                    currentToolKeys = [];
                  }
                };

                for (const [partIndex, part] of messageParts.entries()) {
                  if (part.kind === "text") {
                    const displayText =
                      dedupedRenderablePartContents[partIndex] ?? "";

                    if (!displayText) {
                      continue;
                    }

                    flushToolSteps();
                    groupedElements.push(
                      <AiMarkdownPreview
                        key={part.id}
                        content={displayText}
                        isGenerating={isGenerating}
                      />,
                    );
                  } else if (part.kind === "reasoning") {
                    const displayReasoning =
                      dedupedRenderablePartContents[partIndex] ?? "";

                    if (!displayReasoning) {
                      continue;
                    }

                    flushToolSteps();
                    groupedElements.push(
                      <AiChatThinkingBlock
                        key={part.id}
                        content={displayReasoning}
                        isGenerating={isReasoningPartGenerating(
                          messageParts,
                          partIndex,
                          isGenerating,
                        )}
                      />,
                    );
                  } else {
                    const step = findToolStepByPart(message.toolSteps, part);
                    if (step) {
                      currentToolSteps.push(step);
                      currentToolKeys.push(part.id);
                    }
                  }
                }
                flushToolSteps();

                return groupedElements;
              })()}

              {/* 正在处理且无最终回答时，渲染 loading 替代 */}
              {isProcessing && messageParts.length === 0 && (
                <div className="flex items-center gap-2 text-white/50 py-0.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs font-medium">正在处理...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 消息时间 */}
        <span
          className={`text-xs font-mono mt-0.5 px-1 text-white/30 flex items-center min-h-[1.25rem] ${
            isUser ? "justify-end text-right" : "justify-start text-left"
          }`}
        >
          {isGenerating ? (
            <span className="relative flex h-1.5 w-1.5 my-1 ml-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white/50"></span>
            </span>
          ) : (
            message.time
          )}
        </span>
      </div>

    </div>
  );
};
