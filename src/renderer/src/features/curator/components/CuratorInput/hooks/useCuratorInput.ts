import type React from "react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { CuratorMessagePart } from "@/features/curator/types";
import {
  createCuratorSendPayload,
  getCuratorAgentMentionDeletionRange,
} from "@/features/curator/curatorAgentMentions";
import type {
  CuratorInputProps,
  CuratorInputCommand,
} from "@/features/curator/components/CuratorInput/types";
import {
  TEXTAREA_MIN_ROWS,
  TEXTAREA_MAX_ROWS,
  FALLBACK_LINE_HEIGHT,
  INTERACTIVE_SELECTOR,
} from "@/lib/ai-shared/constants";
import {
  isCommandInput,
  getMatchedCommands,
} from "@/lib/ai-shared/utils";
import { useCuratorContextStore } from "@/features/curator/curatorContextStore";

// 引入微逻辑 Hook
import { useCuratorFiles } from "@/features/curator/components/CuratorInput/hooks/useCuratorFiles";
import { useCuratorHistory } from "@/features/curator/components/CuratorInput/hooks/useCuratorHistory";
import { useCuratorMentions } from "@/features/curator/components/CuratorInput/hooks/useCuratorMentions";
import { useCuratorModels } from "@/lib/ai-shared/useModelSelection";
import { useCuratorSessions } from "@/lib/ai-shared/useSessionSelection";

// Agent Skill 令牌匹配规则，匹配形如 @translator[skill]、@summary-booster[skill] 这样的格式
const SKILL_TOKEN_PATTERN = /(^|\s)(@([A-Za-z0-9_-]+)\[skill\])(?=$|\s)/g;

/**
 * 获取 Backspace 应删除的完整技能令牌范围及其关联 ID。
 */
const getCuratorSkillDeletionRange = (
  value: string,
  cursor: number,
): { start: number; end: number; id: string } | null => {
  const ranges: Array<{ start: number; end: number; id: string }> = [];
  SKILL_TOKEN_PATTERN.lastIndex = 0;

  let match = SKILL_TOKEN_PATTERN.exec(value);
  while (match) {
    const prefix = match[1] ?? "";
    const token = match[2] ?? "";
    const id = match[3] ?? "";
    const start = match.index + prefix.length;
    ranges.push({
      start,
      end: start + token.length,
      id,
    });
    match = SKILL_TOKEN_PATTERN.exec(value);
  }

  const directRange = ranges.find((range) => range.end === cursor);
  if (directRange) {
    return directRange;
  }

  const previousCharacter = value[cursor - 1];
  if (previousCharacter && /\s/.test(previousCharacter)) {
    const rangeBeforeSpace = ranges.find((range) => range.end === cursor - 1);
    if (rangeBeforeSpace) {
      return rangeBeforeSpace;
    }
  }

  return null;
};

/**
 * useCuratorInput - 输入框总状态与逻辑总调度编排 Hook。
 *
 * 通过组合 useCuratorFiles, useCuratorHistory, useCuratorMentions, useCuratorModels 和 useCuratorSessions 这 5 个微 Hook，
 * 统筹管理所有事件、状态拼装及键盘交互按键拦截的分发。
 */
export const useCuratorInput = (props: CuratorInputProps) => {
  const {
    modelOptions,
    selectedModel,
    isGenerating = false,
    onSendMessage,
    onCommandExecute,
    onModelChange,
  } = props;

  const toast = useToast();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 1. 基础输入文本与 Slash 命令状态
  const [inputText, setInputText] = useState("");
  const [isCommandPanelOpen, setIsCommandPanelOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);

  const selectedModelValue = selectedModel
    ? `${selectedModel.provider}::${selectedModel.model}`
    : "";

  const selectedModelOption = modelOptions
    .find((p) => p.id === selectedModel?.provider)
    ?.models.find((m) => m.id === selectedModel?.model);

  const isImageSupported =
    selectedModelOption?.modalities?.input?.includes("image") ?? false;

  const matchedCommands = getMatchedCommands(inputText);
  const activeCommand =
    matchedCommands[activeCommandIndex] ?? matchedCommands[0];

  const inputSendPayload = createCuratorSendPayload(inputText);
  const hasModelOptions = modelOptions.some(
    (provider) => provider.models.length > 0,
  );

  /**
   * 根据内容真实高度调整输入框高度，最多显示 6 行，超过后内部滚动。
   */
  const adjustTextareaHeight = useCallback((): void => {
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
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, minHeight),
      maxHeight,
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight, inputText]);

  // 2. 引入上传文件 Micro Hook
  const {
    fileInputRef,
    selectedImages,
    selectedTextFiles,
    isDragging,
    setSelectedImages,
    setSelectedTextFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
    handleAttachmentClick,
    handleUploadFilesProxy,
    clearFiles,
  } = useCuratorFiles(isImageSupported);

  // 3. 引入历史记录 Micro Hook
  const {
    promptHistory,
    isBrowsingHistory,
    historyCursorRef,
    savePromptHistory,
    movePromptHistory,
    canMovePromptHistory,
    resetHistoryCursor,
    updateDraftInput,
  } = useCuratorHistory('curator', setInputText, textareaRef, adjustTextareaHeight);

  // 4. 引入 Agent Mentions (@) Micro Hook（包含 Skill 合并联想检索能力）
  const {
    activeAgentIndex,
    matchedAgentMentions,
    isAgentPanelOpen,
    activeAgent,
    setActiveAgentIndex,
    syncAgentMentionPanel,
    closeAgentMentionPanel,
    selectAgentMention,
    moveActiveAgent,
    handleTextareaCursorMove,
  } = useCuratorMentions(
    inputText,
    setInputText,
    props.sessionId || "",
    textareaRef,
    adjustTextareaHeight,
    resetHistoryCursor,
  );

  // 5. 引入 AI 快速切换模型 (/model) Micro Hook
  const {
    activeModelIndex,
    matchedModels,
    isModelMode,
    setActiveModelIndex,
    selectModel,
    moveActiveModel,
    handleModelChange,
  } = useCuratorModels(inputText, setInputText, modelOptions, textareaRef, resetHistoryCursor, onModelChange);

  // 6. 引入 AI 快速切换会话 (/session) Micro Hook
  const {
    activeSessionIndex,
    matchedSessions,
    isSessionMode,
    isSearching: isSearchingSessions,
    setActiveSessionIndex,
    selectSession,
    moveActiveSession,
    handleSessionScroll,
  } = useCuratorSessions(
    inputText,
    setInputText,
    props.chatSessions || [],
    textareaRef,
    resetHistoryCursor,
    props.onActiveSessionChange || (() => undefined),
    props.hasMoreChatSessions,
    props.isLoadingMoreChatSessions,
    props.onLoadMoreChatSessions,
  );

  // 输入变化后的统一计算分发
  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ): void => {
    const nextValue = e.target.value;
    const nextMatchedCommands = getMatchedCommands(nextValue);

    setInputText(nextValue);
    updateDraftInput(nextValue);
    resetHistoryCursor();
    setActiveCommandIndex(0);

    const isNextModelMode = nextValue === "/model" || nextValue.startsWith("/model ");
    const isNextSessionMode =
      nextValue === "/session" ||
      nextValue.startsWith("/session ") ||
      nextValue === "/resume" ||
      nextValue.startsWith("/resume ");

    if (isNextModelMode || isNextSessionMode) {
      setIsCommandPanelOpen(false);
      closeAgentMentionPanel();
      return;
    }

    const shouldOpenCommandPanel =
      isCommandInput(nextValue) && nextMatchedCommands.length > 0;
    setIsCommandPanelOpen(shouldOpenCommandPanel);
    if (shouldOpenCommandPanel) {
      closeAgentMentionPanel();
      return;
    }

    syncAgentMentionPanel(nextValue, e.target.selectionStart);
  }, [updateDraftInput, resetHistoryCursor, closeAgentMentionPanel, syncAgentMentionPanel]);

  const canSend = useMemo(() => {
    return Boolean(
      inputSendPayload.text.trim() ||
      selectedImages.length > 0 ||
      selectedTextFiles.length > 0,
    );
  }, [inputSendPayload.text, selectedImages.length, selectedTextFiles.length]);

  /**
   * 发送消息处理函数。
   */
  const handleSend = useCallback((): void => {
    const parts: CuratorMessagePart[] = [];
    const textToSend = inputSendPayload.text.trim();

    if (textToSend) {
      parts.push({
        id: `msg-text-${Date.now()}`,
        kind: "text",
        content: textToSend,
      });
    }

    selectedTextFiles.forEach((file, i) => {
      parts.push({
        id: `msg-txtfile-${i}-${Date.now()}`,
        kind: "text-file",
        url: file.url,
        fileName: file.originalName,
        sizeBytes: file.sizeBytes,
      });
    });

    selectedImages.forEach((url, i) => {
      parts.push({
        id: `msg-img-${i}-${Date.now()}`,
        kind: "image",
        url,
      });
    });

    if (parts.length === 0) return;

    if (isGenerating) {
      toast.warning("请等待 AI 输出完成");
      return;
    }

    onSendMessage({
      text: textToSend,
      agents: inputSendPayload.agents,
      ...(selectedImages.length > 0 || selectedTextFiles.length > 0
        ? { parts }
        : {}),
    });

    savePromptHistory(inputText);
    setInputText("");
    resetHistoryCursor();
    clearFiles();
    setIsCommandPanelOpen(false);
    closeAgentMentionPanel();
  }, [
    inputSendPayload.text,
    inputSendPayload.agents,
    selectedTextFiles,
    selectedImages,
    isGenerating,
    onSendMessage,
    savePromptHistory,
    inputText,
    resetHistoryCursor,
    clearFiles,
    closeAgentMentionPanel,
    toast,
  ]);

  /**
   * 清空输入框内容。
   */
  const handleClearInput = useCallback((): void => {
    setInputText("");
    resetHistoryCursor();
    clearFiles();
    closeAgentMentionPanel();
    setIsCommandPanelOpen(false);
    toast.success("已清空输入内容");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [resetHistoryCursor, clearFiles, closeAgentMentionPanel, toast]);

  /**
   * 执行指定斜杠命令，并清理命令输入态。
   */
  const executeCommand = useCallback((command: CuratorInputCommand): void => {
    if (command.id === "model") {
      const text = "/model ";
      setInputText(text);
      resetHistoryCursor();
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }
    if (command.id === "session") {
      const text = "/session ";
      setInputText(text);
      resetHistoryCursor();
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }
    if (isGenerating) {
      toast.warning("请等待 AI 输出完成");
      return;
    }
    setIsCommandPanelOpen(false);
    closeAgentMentionPanel();
    void Promise.resolve(onCommandExecute(command.id))
      .then((nextInputText) => {
        if (!command.addToContext) {
          const text = nextInputText ?? "";
          setInputText(text);
          resetHistoryCursor();
        }
      })
      .catch(() => {
        if (!command.addToContext) {
          setInputText("");
          resetHistoryCursor();
        }
      });
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [isGenerating, onCommandExecute, resetHistoryCursor, closeAgentMentionPanel, toast]);

  /**
   * 循环切换命令面板选中项。
   */
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

  /**
   * 构造供 Select 组件使用的选项列表，支持 provider 分组。
   */
  const selectOptions = useMemo(() => {
    return hasModelOptions
      ? modelOptions.map((provider) => ({
          label: provider.name,
          options: provider.models.map((model) => ({
            value: `${provider.id}::${model.id}`,
            label: model.name,
          })),
        }))
      : [{ value: "", label: "无可用模型" }];
  }, [hasModelOptions, modelOptions]);

  /**
   * 处理输入区域点击，空白区域点击时聚焦文本框。
   */
  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLElement;
    if (
      target !== textareaRef.current &&
      target.closest(INTERACTIVE_SELECTOR)
    ) {
      return;
    }
    textareaRef.current?.focus();
  }, []);

  /**
   * 处理输入框键盘按键事件，支持 Enter 键发送消息，Shift + Enter 换行。
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (isSessionMode && matchedSessions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActiveSession(1);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActiveSession(-1);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setInputText("");
        resetHistoryCursor();
        requestAnimationFrame(() => textareaRef.current?.focus());
        return;
      }

      if (e.key === "Enter") {
        if (e.nativeEvent.isComposing) {
          return;
        }
        e.preventDefault();
        const activeSession = matchedSessions[activeSessionIndex] ?? matchedSessions[0];
        if (activeSession) {
          selectSession(activeSession);
        }
        return;
      }
    }

    if (isModelMode && matchedModels.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActiveModel(1);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActiveModel(-1);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setInputText("");
        resetHistoryCursor();
        requestAnimationFrame(() => textareaRef.current?.focus());
        return;
      }

      if (e.key === "Enter") {
        if (e.nativeEvent.isComposing) {
          return;
        }
        e.preventDefault();
        const activeModel = matchedModels[activeModelIndex] ?? matchedModels[0];
        if (activeModel) {
          selectModel(activeModel);
        }
        return;
      }
    }

    if (isCommandPanelOpen && e.key === "ArrowDown") {
      e.preventDefault();
      moveActiveCommand(1);
      return;
    }

    if (isCommandPanelOpen && e.key === "ArrowUp") {
      e.preventDefault();
      moveActiveCommand(-1);
      return;
    }

    if (isCommandPanelOpen && e.key === "Escape") {
      e.preventDefault();
      setIsCommandPanelOpen(false);
      return;
    }

    if (isAgentPanelOpen && e.key === "ArrowDown") {
      e.preventDefault();
      moveActiveAgent(1);
      return;
    }

    if (isAgentPanelOpen && e.key === "ArrowUp") {
      e.preventDefault();
      moveActiveAgent(-1);
      return;
    }

    if (isAgentPanelOpen && e.key === "Escape") {
      e.preventDefault();
      closeAgentMentionPanel();
      return;
    }

    if (isAgentPanelOpen && e.key === "Enter" && activeAgent) {
      if (e.nativeEvent.isComposing) {
        return;
      }
      e.preventDefault();
      selectAgentMention(activeAgent);
      return;
    }

    if (e.key === "Backspace" && !isCommandPanelOpen && !isAgentPanelOpen) {
      const textarea = textareaRef.current;
      if (textarea && textarea.selectionStart === textarea.selectionEnd) {
        // 1. 首先优先检测是否在回退删除自定义技能令牌（形如 @skill-translator-skill）
        const skillDeletionRange = getCuratorSkillDeletionRange(
          inputText,
          textarea.selectionStart,
        );
        if (skillDeletionRange) {
          e.preventDefault();
          const nextValue = `${inputText.slice(0, skillDeletionRange.start)}${inputText.slice(skillDeletionRange.end)}`;
          setInputText(nextValue);
          resetHistoryCursor();

          // 从 store 卸载被删除的技能
          if (props.sessionId) {
            useCuratorContextStore.getState().removeItem(props.sessionId, `skill-${skillDeletionRange.id}`);
            toast.success("已卸载技能");
          }

          requestAnimationFrame(() => {
            adjustTextareaHeight();
            textarea.setSelectionRange(
              skillDeletionRange.start,
              skillDeletionRange.start,
            );
          });
          return;
        }

        // 2. 其次再执行内置 Agent 的 @ 提到回退删除
        const deletionRange = getCuratorAgentMentionDeletionRange(
          inputText,
          textarea.selectionStart,
        );
        if (deletionRange) {
          e.preventDefault();
          const nextValue = `${inputText.slice(0, deletionRange.start)}${inputText.slice(deletionRange.end)}`;
          setInputText(nextValue);
          resetHistoryCursor();
          requestAnimationFrame(() => {
            adjustTextareaHeight();
            textarea.setSelectionRange(
              deletionRange.start,
              deletionRange.start,
            );
          });
          return;
        }
      }
    }

    if (
      !isCommandPanelOpen &&
      e.key === "ArrowDown" &&
      canMovePromptHistory(1)
    ) {
      e.preventDefault();
      movePromptHistory(1);
      return;
    }

    if (
      !isCommandPanelOpen &&
      e.key === "ArrowUp" &&
      canMovePromptHistory(-1)
    ) {
      e.preventDefault();
      movePromptHistory(-1);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent.isComposing) {
        return;
      }
      e.preventDefault();

      if (isCommandPanelOpen && activeCommand) {
        executeCommand(activeCommand);
        return;
      }

      handleSend();
    }
  }, [
    isSessionMode,
    matchedSessions,
    moveActiveSession,
    activeSessionIndex,
    selectSession,
    isModelMode,
    matchedModels,
    moveActiveModel,
    activeModelIndex,
    selectModel,
    isCommandPanelOpen,
    moveActiveCommand,
    isAgentPanelOpen,
    moveActiveAgent,
    activeAgent,
    selectAgentMention,
    inputText,
    adjustTextareaHeight,
    canMovePromptHistory,
    movePromptHistory,
    activeCommand,
    executeCommand,
    handleSend,
    resetHistoryCursor,
    props.sessionId,
    toast,
  ]);

  /**
   * 处理命令面板键盘事件，支持方向键切换、回车执行和 Esc 关闭。
   */
  const handleCommandPanelKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActiveCommand(1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActiveCommand(-1);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsCommandPanelOpen(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    if (e.key === "Enter" && activeCommand) {
      e.preventDefault();
      executeCommand(activeCommand);
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      const nextValue = inputText.slice(0, -1);
      const nextMatchedCommands = getMatchedCommands(nextValue);
      setInputText(nextValue);
      resetHistoryCursor();
      setActiveCommandIndex(0);
      setIsCommandPanelOpen(
        isCommandInput(nextValue) && nextMatchedCommands.length > 0,
      );
      requestAnimationFrame(adjustTextareaHeight);
      return;
    }

    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const nextValue = `${inputText}${e.key}`;
      const nextMatchedCommands = getMatchedCommands(nextValue);
      setInputText(nextValue);
      resetHistoryCursor();
      setActiveCommandIndex(0);
      setIsCommandPanelOpen(
        isCommandInput(nextValue) && nextMatchedCommands.length > 0,
      );
      requestAnimationFrame(adjustTextareaHeight);
    }
  }, [activeCommand, executeCommand, moveActiveCommand, inputText, resetHistoryCursor, adjustTextareaHeight]);

  /**
   * 处理模型面板键盘事件，支持方向键切换、回车执行、Esc 关闭和 Backspace 退回。
   */
  const handleModelPanelKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActiveModel(1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActiveModel(-1);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setInputText("");
      resetHistoryCursor();
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const activeModel = matchedModels[activeModelIndex] ?? matchedModels[0];
      if (activeModel) {
        selectModel(activeModel);
      }
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      const nextValue = inputText.slice(0, -1);
      const nextMatchedCommands = getMatchedCommands(nextValue);
      setInputText(nextValue);
      resetHistoryCursor();

      const isNextModelMode = nextValue === "/model" || nextValue.startsWith("/model ");
      if (isNextModelMode) {
        setActiveModelIndex(0);
      } else {
        setActiveCommandIndex(0);
        setIsCommandPanelOpen(
          isCommandInput(nextValue) && nextMatchedCommands.length > 0,
        );
      }
      requestAnimationFrame(adjustTextareaHeight);
    }
  }, [
    moveActiveModel,
    matchedModels,
    activeModelIndex,
    selectModel,
    inputText,
    resetHistoryCursor,
    adjustTextareaHeight,
  ]);

  /**
   * 处理会话面板键盘事件，支持方向键切换、回车执行、Esc 关闭和 Backspace 退回。
   */
  const handleSessionPanelKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActiveSession(1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActiveSession(-1);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setInputText("");
      resetHistoryCursor();
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const activeSession = matchedSessions[activeSessionIndex] ?? matchedSessions[0];
      if (activeSession) {
        selectSession(activeSession);
      }
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      const nextValue = inputText.slice(0, -1);
      const nextMatchedCommands = getMatchedCommands(nextValue);
      setInputText(nextValue);
      resetHistoryCursor();

      const isNextSessionMode =
        nextValue === "/session" ||
        nextValue.startsWith("/session ") ||
        nextValue === "/resume" ||
        nextValue.startsWith("/resume ");
      if (isNextSessionMode) {
        setActiveSessionIndex(0);
      } else {
        setActiveCommandIndex(0);
        setIsCommandPanelOpen(
          isCommandInput(nextValue) && nextMatchedCommands.length > 0,
        );
      }
      requestAnimationFrame(adjustTextareaHeight);
    }
  }, [
    moveActiveSession,
    matchedSessions,
    activeSessionIndex,
    selectSession,
    inputText,
    resetHistoryCursor,
    adjustTextareaHeight,
  ]);

  return {
    textareaRef,
    fileInputRef,
    inputText,
    selectedImages,
    selectedTextFiles,
    isCommandPanelOpen,
    isDragging,
    activeCommandIndex,
    activeModelIndex,
    activeAgentIndex,
    activeSessionIndex,
    promptHistory,
    isBrowsingHistory,
    historyCursorRef,

    // 计算属性
    selectedModelValue,
    isImageSupported,
    matchedCommands,
    isModelMode,
    matchedModels,
    isSessionMode,
    matchedSessions,
    isSearchingSessions,
    matchedAgentMentions,
    isAgentPanelOpen,
    canSend,
    hasModelOptions,
    selectOptions,

    // 修改方法
    setSelectedImages,
    setSelectedTextFiles,
    setActiveCommandIndex,
    setActiveModelIndex,
    setActiveAgentIndex,
    setActiveSessionIndex,

    // 回调
    handleInputChange,
    handleKeyDown,
    handleTextareaCursorMove,
    handlePaste,
    handleContainerClick,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleAttachmentClick,
    handleClearInput,
    handleSend,
    executeCommand,
    selectModel,
    selectSession,
    selectAgentMention,
    handleCommandPanelKeyDown,
    handleModelPanelKeyDown,
    handleSessionPanelKeyDown,
    handleSessionScroll,
    handleModelChange,
    handleUploadFilesProxy,
  };
};
