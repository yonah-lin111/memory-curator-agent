import { useState, useRef, useLayoutEffect, useCallback, useMemo, useEffect } from "react";
import { Paperclip, RotateCcw, SendHorizontal, FileText, Bot, MessageSquare } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useActiveCuratorModels } from "@/lib/ai-shared/useActiveModels";
import { CommandPanel } from "@/components/ai-shared/CommandPanel";
import {
  FALLBACK_LINE_HEIGHT,
  INTERACTIVE_SELECTOR,
  TEXTAREA_MAX_ROWS,
  TEXTAREA_MIN_ROWS,
} from "@/lib/ai-shared/constants";
import { useFileMention } from "../hooks/useFileMention";
import { getMatchedCommands, isCommandInput } from "@/lib/ai-shared/utils";
import { useCuratorModels } from "@/lib/ai-shared/useModelSelection";
import { useCuratorSessions } from "@/lib/ai-shared/useSessionSelection";
import { useCuratorHistory } from "@/features/curator/components/CuratorInput/hooks/useCuratorHistory";
import type { CuratorSession } from "@/features/curator/types";
import type { PromptAiUndoResult } from "@/features/prompt-design/components/usePromptAiChatController";

const FILE_MENTION_PATTERN = /(^|\s)(@[^\s]+)(?=$|\s)/g;

export const PromptAiChatInput = ({
  onSend,
  disabled,
  onNewChat,
  onUndo,
  onSessionChange,
  chatSessions,
  injectedText,
  onInjectedTextConsumed,
}: {
  onSend?: (text: string, selectedModel?: string) => void;
  disabled?: boolean;
  onNewChat?: () => void;
  onUndo?: () => Promise<PromptAiUndoResult>;
  onSessionChange?: (sessionId: string) => void;
  chatSessions?: CuratorSession[];
  injectedText?: string;
  onInjectedTextConsumed?: () => void;
}) => {
  const toast = useToast();
  const [inputText, setInputText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { selectedModel, hasModelOptions, selectOptions, handleModelChange, modelOptions } =
    useActiveCuratorModels();

  const [isCommandPanelOpen, setIsCommandPanelOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);

  const matchedCommands = useMemo(() => {
    return getMatchedCommands(inputText).filter((cmd) => 
      ["clear", "undo", "model", "session"].includes(cmd.id)
    );
  }, [inputText]);

  const {
    activeModelIndex,
    matchedModels,
    isModelMode,
    setActiveModelIndex,
    selectModel,
    moveActiveModel,
  } = useCuratorModels(
    inputText,
    setInputText,
    modelOptions,
    textareaRef,
    () => {},
    (selection) => handleModelChange(`${selection.provider}::${selection.model}`)
  );

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
    chatSessions || [],
    textareaRef,
    () => {},
    (sessionId) => onSessionChange?.(sessionId)
  );

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const computedStyle = window.getComputedStyle(textarea);
    const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight);
    const lineHeight = Number.isNaN(parsedLineHeight)
      ? FALLBACK_LINE_HEIGHT
      : parsedLineHeight;
    const verticalPadding =
      Number.parseFloat(computedStyle.paddingTop || "0") +
      Number.parseFloat(computedStyle.paddingBottom || "0");
    const minHeight = lineHeight * TEXTAREA_MIN_ROWS + verticalPadding;
    const maxHeight = lineHeight * TEXTAREA_MAX_ROWS + verticalPadding;

    textarea.style.height = "auto";
    const nextHeight =
      inputText.length === 0
        ? minHeight
        : Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [inputText]);

  const {
    savePromptHistory,
    movePromptHistory,
    canMovePromptHistory,
    resetHistoryCursor,
    updateDraftInput,
  } = useCuratorHistory(setInputText, textareaRef, adjustTextareaHeight);

  useEffect(() => {
    if (injectedText === undefined) {
      return;
    }

    setInputText(injectedText);
    resetHistoryCursor();
    onInjectedTextConsumed?.();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [injectedText, onInjectedTextConsumed, resetHistoryCursor]);

  const {
    activeFileIndex,
    matchedFiles,
    isFilePanelOpen,
    setActiveFileIndex,
    syncFileMentionPanel,
    closeFileMentionPanel,
    selectFileMention,
    handleTextareaCursorMove,
    handleKeyDown: handleFileMentionKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
  } = useFileMention(
    inputText,
    setInputText,
    textareaRef,
    adjustTextareaHeight,
  );

  const executeCommand = useCallback(async (commandId: string) => {
    setIsCommandPanelOpen(false);
    if (commandId === "clear") {
      if (disabled) {
        toast.warning("AI 正在生成，请稍后再试");
        return;
      }
      setInputText("");
      onNewChat?.();
      toast.success("已新建对话");
    } else if (commandId === "undo") {
      if (disabled) {
        toast.warning("AI 正在生成，不能撤销消息");
        return;
      }
      if (onUndo) {
        const res = await onUndo();
        if (res === false) {
          toast.error("撤销对话失败");
        } else if (res.status === "empty") {
          toast.warning("没有可撤销的对话");
        } else if (res.status === "deleted_empty") {
          setInputText(res.prompt ?? "");
          resetHistoryCursor();
          toast.success("已撤销上一轮并删除空对话");
        } else if (res.status === "undone") {
          setInputText(res.prompt ?? "");
          resetHistoryCursor();
          toast.success("已撤销上一轮对话");
        }
      }
    } else if (commandId === "model") {
      setInputText("/model ");
      toast.info("请选择要切换的 AI 模型");
    } else if (commandId === "session") {
      setInputText("/session ");
      toast.info("请选择要切换的对话");
    }
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [onNewChat, onUndo, disabled, resetHistoryCursor, toast]);

  const moveActiveCommand = useCallback((direction: 1 | -1): void => {
    setActiveCommandIndex((currentIndex) => {
      if (matchedCommands.length === 0) {
        return 0;
      }
      return (
        (currentIndex + direction + matchedCommands.length) %
        matchedCommands.length
      );
    });
  }, [matchedCommands.length]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    setInputText(nextValue);
    updateDraftInput(nextValue);
    resetHistoryCursor();
    
    // Commands check
    const isNextModelMode = nextValue === "/model" || nextValue.startsWith("/model ");
    const isNextSessionMode = nextValue === "/session" || nextValue.startsWith("/session ") || nextValue === "/resume" || nextValue.startsWith("/resume ");
    
    if (isNextModelMode || isNextSessionMode) {
      setIsCommandPanelOpen(false);
      closeFileMentionPanel();
      return;
    }

    const nextMatchedCommands = getMatchedCommands(nextValue).filter((cmd) => 
      ["clear", "undo", "model", "session"].includes(cmd.id)
    );

    const shouldOpenCommandPanel = isCommandInput(nextValue) && nextMatchedCommands.length > 0;
    setIsCommandPanelOpen(shouldOpenCommandPanel);
    setActiveCommandIndex(0);
    
    if (shouldOpenCommandPanel) {
      closeFileMentionPanel();
      return;
    }

    syncFileMentionPanel(nextValue, e.target.selectionStart);
  }, [closeFileMentionPanel, resetHistoryCursor, syncFileMentionPanel, updateDraftInput]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target !== textareaRef.current &&
      target.closest(INTERACTIVE_SELECTOR)
    ) {
      return;
    }
    textareaRef.current?.focus();
  };

  const handleSend = () => {
    if (disabled) {
      toast.warning("请等待 AI 输出完成");
      return;
    }
    if (inputText.trim() && onSend) {
      // 发送前清理无用的前缀
      const cleanedText = inputText
        .replace(FILE_MENTION_PATTERN, (_match, prefix, token) => {
          return `${prefix}${token}`;
        })
        .trim();

      onSend(cleanedText, selectedModel || undefined);
      savePromptHistory(inputText);
      setInputText("");
      resetHistoryCursor();
      closeFileMentionPanel();
    }
  };

  useLayoutEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight, inputText]);

  return (
    <div className="flex-shrink-0 p-3">
      <div
        className="relative rounded-[6px] border border-white/5 bg-white/[0.01] p-2 flex flex-col gap-2 max-w-[860px] mx-auto w-full cursor-text"
        onClick={handleContainerClick}
      >
        <CommandPanel
          isOpen={isCommandPanelOpen}
          ariaLabel="Slash Commands"
          items={matchedCommands}
          activeIndex={activeCommandIndex}
          onActiveIndexChange={setActiveCommandIndex}
          onItemSelect={(cmd) => executeCommand(cmd.id)}
          renderItem={(cmd) => (
            <div className="flex items-center gap-3 w-full">
              <span className="text-sm font-medium shrink-0">{cmd.name}</span>
              <span className="text-xs text-white/50 truncate flex-1 text-left">{cmd.description}</span>
            </div>
          )}
          idPrefix="prompt-slash-command"
        />

        <CommandPanel
          isOpen={isModelMode}
          ariaLabel="Model Selection"
          items={matchedModels}
          activeIndex={activeModelIndex}
          onActiveIndexChange={setActiveModelIndex}
          onItemSelect={selectModel}
          renderItem={(model) => (
            <div className="flex items-center gap-2 w-full">
              <Bot className="h-4 w-4 shrink-0 opacity-50" />
              <span className="truncate text-sm font-medium">{model.modelName}</span>
              <span className="text-xs text-white/30 ml-auto shrink-0">{model.providerName}</span>
            </div>
          )}
          idPrefix="prompt-model-select"
        />

        <CommandPanel
          isOpen={isSessionMode}
          ariaLabel="Session Selection"
          items={matchedSessions}
          activeIndex={activeSessionIndex}
          onActiveIndexChange={setActiveSessionIndex}
          onItemSelect={selectSession}
          renderItem={(session) => (
            <div className="flex items-center gap-2 w-full">
              <MessageSquare className="h-4 w-4 shrink-0 opacity-50" />
              <span className="truncate text-sm font-medium flex-1 text-left">{session.title}</span>
            </div>
          )}
          idPrefix="prompt-session-select"
        />

        <CommandPanel
          isOpen={isFilePanelOpen}
          ariaLabel="File Mentions"
          items={matchedFiles.map((path) => ({ id: path, path }))}
          activeIndex={activeFileIndex}
          onActiveIndexChange={setActiveFileIndex}
          onItemSelect={(item) => selectFileMention(item.path)}
          renderItem={(item) => (
            <div className="flex items-center gap-2 overflow-hidden">
              <FileText className="h-4 w-4 shrink-0 opacity-50" />
              <span className="truncate text-sm">{item.path}</span>
            </div>
          )}
          idPrefix="prompt-file-mention"
        />

        {/* 输入框 */}
        <textarea
          ref={textareaRef}
          rows={TEXTAREA_MIN_ROWS}
          value={inputText}
          onChange={handleInputChange}
          onClick={handleTextareaCursorMove}
          onKeyUp={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              handleTextareaCursorMove();
            }
          }}
          onKeyDown={(e) => {
            if (isSessionMode && matchedSessions.length > 0) {
              if (e.key === "ArrowDown") { e.preventDefault(); moveActiveSession(1); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); moveActiveSession(-1); return; }
              if (e.key === "Escape") { e.preventDefault(); setInputText(""); return; }
              if (e.key === "Enter") {
                if (e.nativeEvent.isComposing) return;
                e.preventDefault();
                const activeSession = matchedSessions[activeSessionIndex] ?? matchedSessions[0];
                if (activeSession) selectSession(activeSession);
                return;
              }
            }
        
            if (isModelMode && matchedModels.length > 0) {
              if (e.key === "ArrowDown") { e.preventDefault(); moveActiveModel(1); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); moveActiveModel(-1); return; }
              if (e.key === "Escape") { e.preventDefault(); setInputText(""); return; }
              if (e.key === "Enter") {
                if (e.nativeEvent.isComposing) return;
                e.preventDefault();
                const activeModel = matchedModels[activeModelIndex] ?? matchedModels[0];
                if (activeModel) selectModel(activeModel);
                return;
              }
            }
        
            if (isCommandPanelOpen) {
              if (e.key === "ArrowDown") { e.preventDefault(); moveActiveCommand(1); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); moveActiveCommand(-1); return; }
              if (e.key === "Escape") { e.preventDefault(); setIsCommandPanelOpen(false); return; }
              if (e.key === "Enter") {
                if (e.nativeEvent.isComposing) return;
                e.preventDefault();
                const cmd = matchedCommands[activeCommandIndex] ?? matchedCommands[0];
                if (cmd) executeCommand(cmd.id);
                return;
              }
            }

            if (
              !isFilePanelOpen &&
              !isCommandPanelOpen &&
              e.key === "ArrowDown" &&
              canMovePromptHistory(1)
            ) {
              e.preventDefault();
              movePromptHistory(1);
              return;
            }

            if (
              !isFilePanelOpen &&
              !isCommandPanelOpen &&
              e.key === "ArrowUp" &&
              canMovePromptHistory(-1)
            ) {
              e.preventDefault();
              movePromptHistory(-1);
              return;
            }

            handleFileMentionKeyDown(e);
            if (e.defaultPrevented) return;

            if (isFilePanelOpen) {
              return;
            }

            if (e.key === "Enter" && !e.shiftKey) {
              if (e.nativeEvent.isComposing) {
                return;
              }
              e.preventDefault();
              handleSend();
            }
          }}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder="输入您的问题..."
          aria-label="Prompt AI Chat Input Area"
          className="w-full bg-transparent text-sm text-white placeholder:text-white/20 outline-none resize-none leading-relaxed px-1 transition-[height] duration-200 ease-out"
        />

        {/* 工具栏与发送按钮 */}
        <div className="flex items-center justify-between mt-1 cursor-default">
          {/* 左侧附加操作 */}
          <div className="flex min-w-0 items-center gap-2">
            <Select
              value={selectedModel}
              onChange={handleModelChange}
              options={selectOptions}
              position="up"
              bgClass="bg-[#303030]"
              disabled={!hasModelOptions}
              className="!w-fit max-w-[220px]"
            />

            <IconButton
              aria-label="Add attachment"
              className="text-white/30 hover:text-white/50"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </IconButton>
          </div>

          {/* 右侧发送与清空按钮 */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Clear input"
              onClick={() => {
                setInputText("");
                resetHistoryCursor();
              }}
              disabled={!inputText}
              className={`h-6 w-6 rounded-full flex items-center justify-center bg-transparent transition-colors ${
                inputText
                  ? "text-white/45 hover:text-white"
                  : "text-white/10 cursor-not-allowed"
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <IconButton
              aria-label="Send message"
              disabled={!inputText.trim()}
              highlighted={!!inputText.trim()}
              onClick={handleSend}
              className={`rounded-full flex items-center justify-center transition-all ${
                inputText.trim()
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              <SendHorizontal className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
};
