import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Bot, ChevronDown } from "lucide-react";
import { Image } from "@/components/ui/Image";
import { TextFile } from "@/components/ui/TextFile";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { Tag } from "@/components/ui/Tag";
import type {
  AiChatMessage,
  AiChatMessagePart,
  AiToolStep,
} from "@/features/ai-chat/types";
import { AiChatThinkingBlock } from "@/features/ai-chat/components/AiChatThinkingBlock";
import { AiToolCallBlock } from "@/features/ai-chat/components/AiToolCallBlock";
import type {
  AiAskAnswerSubmitPayload,
  AiToolConfirmationAnswerSubmitPayload,
} from "@/features/ai-chat/components/AiAskRequestPanel";
import {
  resolveDedupedRenderablePartContents,
  resolveDedupedTextContents,
} from "@/features/ai-chat/core/aiChatReasoningDedupe";
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
  // 是否是最后一条用户消息。
  isLastUser?: boolean;
  // 是否正在生成中。
  isGenerating?: boolean;
  // 是否允许对当前助手回答重新生成。
  canRegenerate?: boolean;
  // 提交 Ask 回答回调。
  onSubmitAskAnswer?: (
    payload: AiAskAnswerSubmitPayload,
  ) => void | Promise<void>;
  // 提交工具确认回答回调。
  onSubmitToolConfirmationAnswer?: (
    payload: AiToolConfirmationAnswerSubmitPayload,
  ) => void | Promise<void>;
  // 打开消息右键菜单回调。
  onOpenContextMenu: (request: AiChatMessageContextMenuRequest) => void;
  // 编辑并重新发送用户消息。
  onEditAndResendUserMessage?: (
    messageId: string,
    text: string,
  ) => void | Promise<void>;
  // 思考内容展开折叠时的回调。
  onThinkingBlockToggle?: () => void;
  // 工具确认表单状态/高度改变时的回调。
  onToolConfirmationToggle?: () => void;
  // 用户编辑状态改变时的回调.
  onUserEditStateChange?: (isEditing: boolean) => void;
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
  // 编辑当前消息回调 (仅用户消息可用)。
  onEdit?: () => void;
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkAndClassifyImages = () => {
      const images = container.querySelectorAll("img");
      images.forEach((img) => {
        // 如果已经处理过（已经有 class img-loaded 并且没有 img-loading），则跳过
        if (
          img.classList.contains("img-loaded") &&
          !img.classList.contains("img-loading")
        ) {
          return;
        }

        // 初始设为加载状态
        img.classList.add("img-loading");

        const markAsLoaded = () => {
          img.classList.remove("img-loading");
          img.classList.add("img-loaded");
        };

        let imgLoaded = img.complete;
        let timerDone = false;

        const attemptReveal = () => {
          if (imgLoaded && timerDone) {
            markAsLoaded();
          }
        };

        // 骨架屏强制显示 0.5s (500ms)
        setTimeout(() => {
          timerDone = true;
          attemptReveal();
        }, 500);

        if (!imgLoaded) {
          const handleImgLoad = () => {
            imgLoaded = true;
            attemptReveal();
            img.removeEventListener("load", handleImgLoad);
          };
          img.addEventListener("load", handleImgLoad);
        } else {
          attemptReveal();
        }
      });
    };

    // 初始检查图片状态
    checkAndClassifyImages();

    // 在 md-editor-rt 预览区域中动态添加的图片通过事件捕获机制来处理
    const handleLoad = (e: Event) => {
      if (e.target instanceof HTMLImageElement) {
        const img = e.target;
        if (
          img.classList.contains("img-loaded") &&
          !img.classList.contains("img-loading")
        ) {
          return;
        }

        img.classList.add("img-loading");

        const markAsLoaded = () => {
          img.classList.remove("img-loading");
          img.classList.add("img-loaded");
        };

        setTimeout(() => {
          markAsLoaded();
        }, 500);
      }
    };

    container.addEventListener("load", handleLoad, true);
    return () => {
      container.removeEventListener("load", handleLoad, true);
    };
  }, [content]);

  return (
    <div
      ref={containerRef}
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
  isLastUser = false,
  isGenerating = false,
  canRegenerate = false,
  onSubmitAskAnswer,
  onSubmitToolConfirmationAnswer,
  onOpenContextMenu,
  onEditAndResendUserMessage,
  onThinkingBlockToggle,
  onToolConfirmationToggle,
  onUserEditStateChange,
}: AiChatMessageBubbleProps): React.JSX.Element => {
  const isUser = message.role === "user";
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const textRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const remainingCharCountRef = useRef(0);

  // 气泡主体容器，用于捕获高度变化执行 FLIP 过渡。
  const userBubbleRef = useRef<HTMLDivElement>(null);
  // 记录上一次容器的渲染高度。
  const lastHeightRef = useRef<number>(0);
  // 高度过渡清理函数引用。
  const transitionCleanupRef = useRef<(() => void) | null>(null);
  // 标记是否处于 FLIP 高度过渡中，避免 ResizeObserver 干扰。
  const isTransitioningRef = useRef<boolean>(false);

  // 使用 ResizeObserver 实时、精准地记录容器的高度变化（如：文本折叠/展开、打字导致输入框增高、窗口大小变化等）
  useEffect(() => {
    const el = userBubbleRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      if (isTransitioningRef.current) return;
      for (const entry of entries) {
        lastHeightRef.current = entry.target.getBoundingClientRect().height;
      }
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  // 仅在编辑状态 (isEditing) 发生切换时，触发平滑的 FLIP 高度过渡动效
  useLayoutEffect(() => {
    const el = userBubbleRef.current;
    if (!el) return;

    if (transitionCleanupRef.current) {
      transitionCleanupRef.current();
    }

    const newHeight = el.getBoundingClientRect().height;

    if (lastHeightRef.current && lastHeightRef.current !== newHeight) {
      const oldHeight = lastHeightRef.current;

      isTransitioningRef.current = true;
      el.style.overflow = "hidden";
      el.style.transition = "none";
      el.style.height = `${oldHeight}px`;

      el.offsetHeight; // 强制重排

      el.style.transition = "height 0.25s cubic-bezier(0.2, 0.85, 0.2, 1)";
      el.style.height = `${newHeight}px`;

      const handleTransitionEnd = (e: TransitionEvent) => {
        if (e.propertyName === "height") {
          el.style.transition = "";
          el.style.height = "";
          el.style.overflow = "";
          isTransitioningRef.current = false;
          lastHeightRef.current = newHeight;
        }
      };

      el.addEventListener("transitionend", handleTransitionEnd);

      const cleanup = () => {
        el.removeEventListener("transitionend", handleTransitionEnd);
      };
      transitionCleanupRef.current = cleanup;
    } else {
      lastHeightRef.current = newHeight;
    }

    return () => {
      if (transitionCleanupRef.current) {
        transitionCleanupRef.current();
        transitionCleanupRef.current = null;
      }
    };
  }, [isEditing]);

  // 根据文本内容长度，动态平滑调整输入框自身高度。
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      const maxHeight = 140; // 限制最大高度约 7 行
      const targetHeight = Math.min(el.scrollHeight, maxHeight);
      el.style.height = `${targetHeight}px`;
    }
  }, [editText, isEditing]);

  useEffect(() => {
    setEditText(message.content);
  }, [message.content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [isEditing]);

  useEffect(() => {
    onUserEditStateChange?.(isEditing);
  }, [isEditing, onUserEditStateChange]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [editText, isEditing]);

  useEffect(() => {
    if (isUser && textRef.current && !isEditing) {
      const checkOverflow = () => {
        const element = textRef.current;
        if (!element) return;
        const overflowing = element.scrollHeight > 93;
        setHasOverflow(overflowing);
      };

      checkOverflow();
      const rafId = requestAnimationFrame(checkOverflow);
      window.addEventListener("resize", checkOverflow);
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("resize", checkOverflow);
      };
    }
    return undefined;
  }, [message.content, isUser, isEditing]);

  const getRemainingCharCount = (): number => {
    if (!textRef.current) return remainingCharCountRef.current;
    const { scrollHeight } = textRef.current;
    if (scrollHeight <= 93) return 0;
    const ratio = (scrollHeight - 93) / scrollHeight;
    const estimatedRemaining = Math.round(message.content.length * ratio);
    const result = Math.max(
      1,
      Math.min(estimatedRemaining, message.content.length - 1),
    );
    remainingCharCountRef.current = result;
    return result;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent.isComposing) {
        return;
      }
      e.preventDefault();

      const isUnchanged = editText.trim() === message.content.trim();
      if (editText.trim() && !isUnchanged && !isGenerating) {
        submitButtonRef.current?.click();
      }
    }
  };

  const handleToggleCollapse = (): void => {
    const nextCollapsed = !isCollapsed;
    setIsCollapsed(nextCollapsed);

    if (nextCollapsed) {
      setTimeout(() => {
        bubbleRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 60);
    }
  };

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
      onEdit: isUser ? () => setIsEditing(true) : undefined,
    });
  };

  return (
    <div
      ref={bubbleRef}
      className={`flex gap-3 w-full max-w-[85%] scroll-mt-4 group/msg-bubble-container ${
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
          } ${message.cancelled ? "line-through opacity-50" : ""}`}
        >
          {isUser ? (
            <div ref={userBubbleRef} className="w-fit max-w-full">
              {isEditing ? (
                <div className="flex flex-col items-end w-full">
                  {message.parts &&
                    message.parts.some((p) => p.kind === "text-file") && (
                      <div className="flex flex-wrap gap-2 mb-2 justify-end w-full">
                        {message.parts
                          .filter((p) => p.kind === "text-file")
                          .map((part, i) => (
                            <TextFile
                              key={i}
                              url={part.url}
                              fileName={part.fileName}
                              sizeBytes={part.sizeBytes}
                              preview={true}
                            />
                          ))}
                      </div>
                    )}
                  {message.parts &&
                    message.parts.some((p) => p.kind === "image") && (
                      <div className="flex flex-wrap gap-2 mb-2 justify-end w-full">
                        {message.parts
                          .filter((p) => p.kind === "image")
                          .map((part, i) => (
                            <Image
                              key={i}
                              src={part.url}
                              aspectRatio="square"
                              className="w-16 h-16 rounded-[6px] border border-white/5 shadow-md shrink-0 object-cover"
                            />
                          ))}
                      </div>
                    )}
                  <div className="flex flex-col gap-2 w-[400px] max-w-full bg-[#212121] border border-white/10 rounded-[6px] p-2.5">
                    <textarea
                      ref={textareaRef}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full resize-none bg-transparent text-sm text-white focus:outline-none custom-scrollbar"
                    />
                    <div className="flex justify-end gap-1.5 mt-1 border-t border-white/5 pt-2">
                      <IconButton
                        size="small"
                        preset="close"
                        title="取消"
                        onClick={() => {
                          setIsEditing(false);
                          setEditText(message.content);
                        }}
                      />
                      {(() => {
                        const isUnchanged =
                          editText.trim() === message.content.trim();
                        return isLastUser ? (
                          <IconButton
                            ref={submitButtonRef}
                            size="small"
                            preset="confirm"
                            title="发送并重新生成"
                            disabled={
                              !editText.trim() || isUnchanged || isGenerating
                            }
                            onClick={() => {
                              if (
                                editText.trim() &&
                                !isUnchanged &&
                                !isGenerating
                              ) {
                                setIsEditing(false);
                                void onEditAndResendUserMessage?.(
                                  message.id,
                                  editText.trim(),
                                );
                              }
                            }}
                          />
                        ) : (
                          <Tooltip
                            title="编辑历史消息将删除其后所有的对话记录，确定要发送吗？"
                            placement="top"
                            onConfirm={() => {
                              if (
                                editText.trim() &&
                                !isUnchanged &&
                                !isGenerating
                              ) {
                                setIsEditing(false);
                                void onEditAndResendUserMessage?.(
                                  message.id,
                                  editText.trim(),
                                );
                              }
                            }}
                          >
                            <IconButton
                              ref={submitButtonRef}
                              size="small"
                              preset="confirm"
                              title="发送并重新生成"
                              disabled={
                                !editText.trim() || isUnchanged || isGenerating
                              }
                            />
                          </Tooltip>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative flex flex-col items-end w-full group/msg-bubble">
                  {message.parts &&
                    message.parts.some((p) => p.kind === "text-file") && (
                      <div className="flex flex-wrap gap-2 mb-2 justify-end w-full">
                        {message.parts
                          .filter((p) => p.kind === "text-file")
                          .map((part, i) => (
                            <TextFile
                              key={i}
                              url={part.url}
                              fileName={part.fileName}
                              sizeBytes={part.sizeBytes}
                              preview={true}
                            />
                          ))}
                      </div>
                    )}
                  {message.parts &&
                    message.parts.some((p) => p.kind === "image") && (
                      <div className="flex flex-wrap gap-2 mb-2 justify-end w-full">
                        {message.parts
                          .filter((p) => p.kind === "image")
                          .map((part, i) => (
                            <Image
                              key={i}
                              src={part.url}
                              aspectRatio="square"
                              className="w-16 h-16 rounded-[6px] border border-white/5 shadow-md shrink-0 object-cover"
                            />
                          ))}
                      </div>
                    )}
                  <div
                    ref={textRef}
                    style={{
                      maxHeight:
                        hasOverflow && isCollapsed
                          ? "93px"
                          : hasOverflow
                            ? `${textRef.current?.scrollHeight || 1000}px`
                            : "none",
                      transition:
                        "max-height 0.3s cubic-bezier(0.2, 0.85, 0.2, 1)",
                    }}
                    className="overflow-hidden w-fit max-w-full select-text pr-1 text-left"
                  >
                    {message.content}
                  </div>
                  {hasOverflow && (
                    <div className="flex items-center gap-1.5 mt-1.5 select-none text-white/45 hover:text-white/80 transition-colors">
                      <span className="text-xs scale-90 origin-right opacity-60">
                        {isCollapsed
                          ? `展开 (余 ${getRemainingCharCount()} 字)`
                          : "收起"}
                      </span>
                      <IconButton
                        size="small"
                        onClick={handleToggleCollapse}
                        className="hover:bg-white/10 active:scale-95 transition-all"
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform duration-300 ease-out ${
                            isCollapsed ? "" : "rotate-180"
                          }`}
                        />
                      </IconButton>
                    </div>
                  )}
                </div>
              )}
            </div>
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
                        onSubmitAskAnswer={onSubmitAskAnswer}
                        onSubmitToolConfirmationAnswer={
                          onSubmitToolConfirmationAnswer
                        }
                        onToolConfirmationToggle={onToolConfirmationToggle}
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
                        key={`${message.id}-text-${partIndex}`}
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
                        key={`${message.id}-reasoning-${partIndex}`}
                        content={displayReasoning}
                        isGenerating={isReasoningPartGenerating(
                          messageParts,
                          partIndex,
                          isGenerating,
                        )}
                        onToggle={onThinkingBlockToggle}
                      />,
                    );
                  } else {
                    const step = findToolStepByPart(message.toolSteps, part);
                    if (step) {
                      currentToolSteps.push(step);
                      currentToolKeys.push(`${message.id}-${part.id}`);
                    }
                  }
                }
                flushToolSteps();

                return groupedElements;
              })()}
            </div>
          )}
        </div>

        {/* 提及的 Agent 行 */}
        {isUser &&
          message.parts &&
          message.parts.some((p) => p.kind === "agent") && (
            <div className="flex items-center gap-1 mt-1 px-1 justify-end">
              {message.parts
                .filter((p) => p.kind === "agent")
                .map((part) => {
                  if (part.kind !== "agent") return null;
                  return (
                    <Tag
                      key={`${message.id}-${part.id}`}
                      size="small"
                      prefix="@"
                      color="default"
                      bgClass="border-white/5 bg-white/[0.03] text-white/45"
                    >
                      {part.agentId}
                    </Tag>
                  );
                })}
            </div>
          )}

        {/* 消息时间 */}
        <div
          className={`text-xs font-mono mt-0.5 px-1 text-white/30 flex items-center gap-1.5 min-h-[1.25rem] ${
            isUser ? "justify-end text-right" : "justify-start text-left"
          }`}
        >
          {isUser && !isEditing && (
            <div className="opacity-0 group-hover/msg-bubble-container:opacity-100 transition-opacity duration-150 flex items-center">
              <IconButton
                size="small"
                preset="edit"
                title="编辑"
                disabled={isGenerating}
                onClick={() => setIsEditing(true)}
              />
            </div>
          )}
          <span>
            {isGenerating ? (
              <span className="relative flex h-1.5 w-1.5 my-1 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white/50"></span>
              </span>
            ) : (
              message.time
            )}
          </span>
          {!isUser && message.model && (
            <Tag
              size="default"
              color="default"
              bgClass="border-white/5 bg-white/[0.03] text-white/30 select-none"
              className="scale-90 origin-left"
            >
              {message.model}
            </Tag>
          )}
        </div>
      </div>
    </div>
  );
};
