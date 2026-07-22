import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { RotateCcw, SendHorizontal, MessageSquare } from "lucide-react";
import { CommandPanel } from "@/components/ai-shared/CommandPanel";
import { IconButton } from "@/components/ui/IconButton";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";

import { useFileMention } from "@/features/prompt-design/hooks/useFileMention";
import type { usePromptAiChatController } from "@/features/prompt-design/components/usePromptAiChatController";
import {
  PromptAiFileMentionPanel,
  PromptAiSlashCommandPanel,
  type PromptAiInputCommand,
} from "@/features/prompt-design/components/PromptAiInputPanels";
import { useCuratorSessions } from "@/lib/ai-shared/useSessionSelection";
import { getMatchedCommands, isCommandInput } from "@/lib/ai-shared/utils";

type InlineInputPosition = { left: number; top: number | "auto"; bottom: number | "auto" };
type PanelDirection = "up" | "down";
type PromptAiInlineInputProps = {
  view: EditorView | null;
  controller: ReturnType<typeof usePromptAiChatController>;
  onClose: () => void;
};

// 内联输入能够完整执行的斜杠命令。
const INLINE_COMMAND_IDS = ["clear", "undo", "session"];

// Prompt AI 专用 MCP 命令。
const MCP_COMMAND: PromptAiInputCommand = {
  id: "mcp",
  name: "/mcp",
  description: "列出可用的 MCP 服务和工具",
};

/**
 * 判断当前斜杠输入是否匹配 Prompt AI 专用 MCP 命令。
 */
const isMcpCommandMatch = (value: string): boolean => {
  const normalizedValue = value.trim().toLowerCase();
  return normalizedValue.startsWith("/") && "/mcp".startsWith(normalizedValue);
};

/**
 * 在编辑器光标附近提供轻量提示词 AI 输入，发送复用当前会话控制器。
 */
export const PromptAiInlineInput = ({
  view,
  controller,
  onClose,
}: PromptAiInlineInputProps): React.JSX.Element | null => {
  const toast = useToast();
  const [inputText, setInputText] = useState("");
  const [position, setPosition] = useState<InlineInputPosition | null>(null);
  const [panelDirection, setPanelDirection] = useState<PanelDirection>("down");
  const [isCommandPanelOpen, setIsCommandPanelOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mention = useFileMention(inputText, setInputText, textareaRef, () => undefined);
  const matchedCommands = useMemo<PromptAiInputCommand[]>(() => {
    const commands = getMatchedCommands(inputText).filter((command) =>
      INLINE_COMMAND_IDS.includes(command.id),
    );

    const customCommands = isMcpCommandMatch(inputText) ? [MCP_COMMAND] : [];
    return [...commands, ...customCommands];
  }, [inputText]);
  const {
    activeSessionIndex,
    matchedSessions,
    isSessionMode,
    setActiveSessionIndex,
    selectSession,
    moveActiveSession,
  } = useCuratorSessions(
    inputText,
    setInputText,
    controller.sessions,
    textareaRef,
    () => undefined,
    controller.handleSessionChange,
  );

  const restoreEditorFocus = useCallback((): void => {
    onClose();
    requestAnimationFrame(() => {
      view?.focus();
    });
  }, [onClose, view]);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent): void => {
      // 命令面板位于浮层内部，点击候选项不应触发关闭。
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        restoreEditorFocus();
      }
    };
    document.addEventListener("pointerdown", handleClickOutside, true);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside, true);
    };
  }, [restoreEditorFocus]);

  const handleSend = useCallback((): void => {
    const text = inputText.trim();
    if (!text || controller.isGenerating) return;
    void controller.sendMessage(text, undefined, { references: controller.references });
    setInputText("");
    mention.closeFileMentionPanel();
    restoreEditorFocus();
  }, [controller, inputText, mention, restoreEditorFocus, toast]);

  /**
   * 清空当前草稿与引用，保持与聊天输入框一致的清空语义。
   */
  const handleClear = useCallback((): void => {
    setInputText("");
    mention.closeFileMentionPanel();
    controller.setReferences([]);
    toast.success("已清空输入内容");
  }, [controller, mention, toast]);

  /**
   * 执行内联输入中可用的会话级斜杠命令。
   */
  const executeCommand = useCallback(async (commandId: string): Promise<void> => {
    setIsCommandPanelOpen(false);

    if (commandId === "clear") {
      if (controller.isGenerating) {
        toast.warning("AI 正在生成，请稍后再试");
        return;
      }
      setInputText("");
      controller.handleNewChat();
    } else if (commandId === "undo") {
      const result = await controller.handleUndo();
      if (result === false) {
        toast.error("撤销对话失败");
      } else if (result.status === "empty") {
        toast.warning("没有可撤销的对话");
      } else {
        setInputText(result.prompt ?? "");
      }
    } else if (commandId === "session") {
      setInputText("/session ");
    } else if (commandId === "mcp") {
      setInputText("");
      await controller.showMcpTools();
    }

    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [controller, toast]);

  /**
   * 在命令候选项中循环移动当前激活项。
   */
  const moveActiveCommand = useCallback((direction: 1 | -1): void => {
    setActiveCommandIndex((currentIndex) => {
      if (!matchedCommands.length) return 0;
      return (currentIndex + direction + matchedCommands.length) % matchedCommands.length;
    });
  }, [matchedCommands.length]);

  /**
   * 同步斜杠、会话和文件提及面板的互斥状态。
   */
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const nextValue = event.target.value;
    setInputText(nextValue);

    const nextIsSessionMode = nextValue === "/session" || nextValue.startsWith("/session ");
    if (nextIsSessionMode) {
      setIsCommandPanelOpen(false);
      mention.closeFileMentionPanel();
      return;
    }

    const commands = getMatchedCommands(nextValue).filter((command) =>
      INLINE_COMMAND_IDS.includes(command.id),
    );
    const customCommands = isMcpCommandMatch(nextValue) ? [MCP_COMMAND] : [];
    const nextMatchedCommands = [...commands, ...customCommands];
    const shouldOpenCommandPanel = isCommandInput(nextValue) && nextMatchedCommands.length > 0;
    setIsCommandPanelOpen(shouldOpenCommandPanel);
    setActiveCommandIndex(0);

    if (shouldOpenCommandPanel) {
      mention.closeFileMentionPanel();
      return;
    }

    mention.syncFileMentionPanel(nextValue, event.target.selectionStart);
  }, [mention]);

  useLayoutEffect(() => {
    if (!view) return;
    const coords = view.coordsAtPos(view.state.selection.main.head);
    if (!coords) return;
    const width = Math.min(360, window.innerWidth - 16);
    const left = Math.min(Math.max(coords.left, 8), window.innerWidth - width - 8);

    // 输入框本身大致高度
    const inputHeight = 96;
    // 命令面板最大高度大约 30vh（使用像素估计，比如窗口高度的 30% 或者保守估算为 250px）
    const panelMaxHeight = Math.min(250, window.innerHeight * 0.3);

    const spaceBelow = window.innerHeight - coords.bottom;

    // 判断输入框上下方空间，并记录最终决定的悬浮位置（相对视口）
    let renderTop: number | "auto" = "auto";
    let renderBottom: number | "auto" = "auto";

    // 如果下方空间足够放下输入框，优先放下方
    if (spaceBelow >= inputHeight + 8) {
      renderTop = coords.bottom + 8;
      renderBottom = "auto";
    } else {
      // 否则放上方
      renderTop = "auto";
      renderBottom = window.innerHeight - coords.top + 8;
    }
    setPosition({ left, top: renderTop, bottom: renderBottom });

    // 计算面板应该向上还是向下展开
    // 计算输入框渲染后的实际上下可用空间
    const inputActualTop = renderTop !== "auto" ? renderTop : window.innerHeight - (renderBottom as number) - inputHeight;
    const inputActualBottom = renderTop !== "auto" ? renderTop + inputHeight : window.innerHeight - (renderBottom as number);

    const actualSpaceBelow = window.innerHeight - inputActualBottom;
    const actualSpaceAbove = inputActualTop;

    // 优先展示在能容纳面板的一侧；若下方空间足够容纳面板，则向下展开；若下方不足但上方充足，则向上展开；否则选空间更大的一侧。
    if (actualSpaceBelow >= panelMaxHeight + 8) {
      setPanelDirection("down");
    } else if (actualSpaceAbove >= panelMaxHeight + 8) {
      setPanelDirection("up");
    } else {
      setPanelDirection(actualSpaceBelow >= actualSpaceAbove ? "down" : "up");
    }

    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [view]);

  if (!position) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-[110] flex w-[min(360px,calc(100vw-16px))] flex-col gap-2 rounded-[6px] border border-white/10 bg-[#212121] p-2 shadow-2xl"
      style={position}
    >
      <PromptAiSlashCommandPanel
        isOpen={isCommandPanelOpen}
        commands={matchedCommands}
        activeIndex={activeCommandIndex}
        onActiveIndexChange={setActiveCommandIndex}
        onCommandSelect={(command) => void executeCommand(command.id)}
        idPrefix="prompt-inline-slash-command"
        style={panelDirection === "down" ? { top: "calc(100% + 8px)", bottom: "auto" } : { bottom: "calc(100% + 8px)", top: "auto" }}
        keyboardOnly
      />
      <CommandPanel
        isOpen={isSessionMode}
        ariaLabel="会话选择"
        items={matchedSessions}
        activeIndex={activeSessionIndex}
        onActiveIndexChange={setActiveSessionIndex}
        onItemSelect={selectSession}
        renderItem={(session) => (
          <div className="flex w-full items-center gap-2">
            <MessageSquare className="h-4 w-4 shrink-0 opacity-50" />
            <span className="flex-1 truncate text-left text-sm font-medium">{session.title}</span>
          </div>
        )}
        idPrefix="prompt-inline-session-select"
        style={panelDirection === "down" ? { top: "calc(100% + 8px)", bottom: "auto" } : { bottom: "calc(100% + 8px)", top: "auto" }}
        keyboardOnly
      />
      <PromptAiFileMentionPanel
        isOpen={mention.isFilePanelOpen}
        paths={mention.matchedFiles}
        activeIndex={mention.activeFileIndex}
        onActiveIndexChange={mention.setActiveFileIndex}
        onPathSelect={mention.selectFileMention}
        idPrefix="prompt-inline-file-mention"
        style={panelDirection === "down" ? { top: "calc(100% + 8px)", bottom: "auto" } : { bottom: "calc(100% + 8px)", top: "auto" }}
        keyboardOnly
      />
      {controller.references.length > 0 && <div className="flex flex-wrap gap-1 px-1">{controller.references.map((reference) => <Tag key={reference.id} size="small" onClose={() => controller.setReferences((items) => items.filter((item) => item.id !== reference.id))}>第{reference.startLine}–{reference.endLine}行</Tag>)}</div>}
      <textarea
        ref={textareaRef}
        rows={2}
        value={inputText}
        onChange={handleInputChange}
        onKeyDown={(event) => {
          if (isSessionMode && matchedSessions.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveActiveSession(1);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              moveActiveSession(-1);
              return;
            }
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              selectSession(matchedSessions[activeSessionIndex] ?? matchedSessions[0]);
              return;
            }
          }
          if (isSessionMode && event.key === "Escape") {
            event.preventDefault();
            setInputText("");
            return;
          }
          if (isCommandPanelOpen) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveActiveCommand(1);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              moveActiveCommand(-1);
              return;
            }
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              const command = matchedCommands[activeCommandIndex] ?? matchedCommands[0];
              if (command) void executeCommand(command.id);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setIsCommandPanelOpen(false);
              return;
            }
          }
          mention.handleKeyDown(event);
          if (event.defaultPrevented) return;
          if (event.key === "Escape") {
            event.preventDefault();
            restoreEditorFocus();
          } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            handleSend();
          }
        }}
        onCompositionStart={mention.handleCompositionStart}
        onCompositionEnd={mention.handleCompositionEnd}
        placeholder="输入要调整提示词的内容..."
        className="w-full resize-none bg-transparent px-1 text-sm leading-relaxed text-white outline-none placeholder:text-white/20"
      />
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          aria-label="清空输入"
          disabled={!inputText && controller.references.length === 0}
          onClick={handleClear}
          className={`flex h-6 w-6 items-center justify-center rounded-full bg-transparent transition-colors ${inputText || controller.references.length > 0 ? "text-white/45 hover:text-white" : "cursor-not-allowed text-white/10"}`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <IconButton
          aria-label="发送消息"
          disabled={!inputText.trim() || controller.isGenerating}
          highlighted={Boolean(inputText.trim())}
          onClick={handleSend}
          className={`flex items-center justify-center rounded-full transition-all ${inputText.trim() ? "bg-white text-black hover:bg-white/90" : "cursor-not-allowed bg-white/10 text-white/30"}`}
        >
          <SendHorizontal className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  );
};
