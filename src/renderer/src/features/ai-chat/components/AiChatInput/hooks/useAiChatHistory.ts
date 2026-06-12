import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { mergePromptHistory, isTextareaCursorAt } from "@/features/ai-chat/components/AiChatInput/utils";

/**
 * useAiChatHistory - 专门管理 AI 输入框提示词历史存取、使用上下方向键浏览/历史回溯定位的微 Hook。
 *
 * @param inputText 当前输入文本状态值
 * @param setInputText 修改输入文本状态回调
 * @param textareaRef 文本框 DOM 引用
 * @param adjustTextareaHeight 重算文本框高度回调
 */
export const useAiChatHistory = (
  setInputText: (value: string) => void,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  adjustTextareaHeight: () => void,
) => {
  const draftInputRef = useRef("");
  const historyCursorRef = useRef<number | null>(null);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);

  // 判断是否正在浏览提示词历史。
  const isBrowsingHistory =
    historyCursorRef.current !== null &&
    historyCursorRef.current >= 0 &&
    historyCursorRef.current < promptHistory.length;

  useEffect(() => {
    let isMounted = true;
    const listPromptHistory = window.api?.ai?.listPromptHistory;

    if (!listPromptHistory) {
      return () => {
        isMounted = false;
      };
    }

    void listPromptHistory()
      .then((history) => {
        if (isMounted) {
          setPromptHistory(history);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPromptHistory([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * 保存提示词历史，IPC 不可用时退回内存态避免交互断裂。
   */
  const savePromptHistory = useCallback((prompt: string): void => {
    const normalizedPrompt = prompt.trim();

    if (!normalizedPrompt) {
      return;
    }

    // 不保存以 "/" 开头的斜杠命令到提示词历史。
    if (normalizedPrompt.startsWith("/")) {
      return;
    }

    const addPromptHistory = window.api?.ai?.addPromptHistory;

    if (!addPromptHistory) {
      setPromptHistory((currentHistory) =>
        mergePromptHistory(currentHistory, normalizedPrompt),
      );
      return;
    }

    void addPromptHistory(normalizedPrompt)
      .then((history) => {
        setPromptHistory(history);
      })
      .catch(() => {
        setPromptHistory((currentHistory) =>
          mergePromptHistory(currentHistory, normalizedPrompt),
        );
      });
  }, []);

  /**
   * 切换历史后恢复焦点并设置光标位置。
   */
  const syncTextareaAfterHistoryMove = useCallback((
    cursorPosition: "start" | "end",
  ): void => {
    requestAnimationFrame(() => {
      adjustTextareaHeight();
      const textarea = textareaRef.current;

      if (!textarea) {
        return;
      }

      const nextPosition =
        cursorPosition === "start" ? 0 : textarea.value.length;
      textarea.focus();
      textarea.setSelectionRange(nextPosition, nextPosition);
    });
  }, [adjustTextareaHeight, textareaRef]);

  /**
   * 在非命令面板状态下浏览历史提示词。
   */
  const movePromptHistory = useCallback((direction: 1 | -1): void => {
    if (promptHistory.length === 0) {
      return;
    }

    const currentCursor = historyCursorRef.current;
    const newestIndex = promptHistory.length - 1;
    const nextCursor =
      currentCursor === null
        ? direction === -1
          ? newestIndex
          : 0
        : currentCursor + direction;

    if (nextCursor > newestIndex) {
      setInputText(draftInputRef.current);
      historyCursorRef.current = newestIndex + 1;
      syncTextareaAfterHistoryMove("end");
      return;
    }

    if (nextCursor < 0) {
      syncTextareaAfterHistoryMove("start");
      return;
    }

    setInputText(promptHistory[nextCursor] ?? "");
    historyCursorRef.current = nextCursor;
    syncTextareaAfterHistoryMove(direction === -1 ? "start" : "end");
  }, [promptHistory, setInputText, syncTextareaAfterHistoryMove]);

  /**
   * 判断普通输入态方向键是否应进入历史提示词导航。
   */
  const canMovePromptHistory = useCallback((direction: 1 | -1): boolean => {
    const textarea = textareaRef.current;

    if (!textarea || promptHistory.length === 0) {
      return false;
    }

    const textareaValue = textarea.value;

    if (textareaValue.length === 0) {
      return direction === -1;
    }

    if (
      direction === 1 &&
      textareaValue.includes("\n") &&
      !isTextareaCursorAt(textarea, textareaValue.length)
    ) {
      return false;
    }

    return direction === -1
      ? isTextareaCursorAt(textarea, 0)
      : isTextareaCursorAt(textarea, textareaValue.length);
  }, [promptHistory.length, textareaRef]);

  /**
   * 重置当前历史游标。
   */
  const resetHistoryCursor = useCallback(() => {
    historyCursorRef.current = null;
    draftInputRef.current = "";
  }, []);

  /**
   * 更新草稿输入缓存（由于草稿随打字同步，在未触发历史定位时保持同步）。
   */
  const updateDraftInput = useCallback((value: string) => {
    draftInputRef.current = value;
  }, []);

  return {
    promptHistory,
    isBrowsingHistory,
    historyCursorRef,
    savePromptHistory,
    movePromptHistory,
    canMovePromptHistory,
    resetHistoryCursor,
    updateDraftInput,
  };
};
