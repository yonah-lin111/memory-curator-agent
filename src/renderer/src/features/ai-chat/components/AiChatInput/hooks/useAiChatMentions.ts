import type React from "react";
import { useCallback, useState } from "react";
import type { AgentMentionPanelState } from "@/features/ai-chat/components/AiChatInput/types";
import { resolveAgentMentionPanelState } from "@/features/ai-chat/components/AiChatInput/utils";
import {
  getMatchedAiChatAgentMentions,
  type AiChatAgentMentionOption,
} from "@/features/ai-chat/aiChatAgentMentions";

/**
 * useAiChatMentions - 专门管理 AI 输入框内输入 "@" 符号触发 Agent Mentions 的列表弹出、导航与选中的微 Hook。
 *
 * @param inputText 输入文本状态值
 * @param setInputText 改变输入文本状态回调
 * @param textareaRef 文本框 DOM 引用
 * @param adjustTextareaHeight 重算文本框高度回调
 * @param resetHistoryCursor 重置历史提示词游标回调
 */
export const useAiChatMentions = (
  inputText: string,
  setInputText: (value: string) => void,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  adjustTextareaHeight: () => void,
  resetHistoryCursor: () => void,
) => {
  const [agentMentionPanelState, setAgentMentionPanelState] =
    useState<AgentMentionPanelState | null>(null);
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);

  const matchedAgentMentions = agentMentionPanelState
    ? getMatchedAiChatAgentMentions(agentMentionPanelState.query)
    : [];

  const isAgentPanelOpen = Boolean(
    agentMentionPanelState && matchedAgentMentions.length > 0,
  );

  const activeAgent =
    matchedAgentMentions[activeAgentIndex] ?? matchedAgentMentions[0];

  /**
   * 关闭 agent mention 面板。
   */
  const closeAgentMentionPanel = useCallback((): void => {
    setAgentMentionPanelState(null);
    setActiveAgentIndex(0);
  }, []);

  /**
   * 根据输入值和光标位置同步 agent mention 面板。
   */
  const syncAgentMentionPanel = useCallback((value: string, cursor: number): void => {
    const nextState = resolveAgentMentionPanelState(value, cursor);
    const nextMatches = nextState
      ? getMatchedAiChatAgentMentions(nextState.query)
      : [];

    if (!nextState || nextMatches.length === 0) {
      closeAgentMentionPanel();
      return;
    }

    setAgentMentionPanelState(nextState);
    setActiveAgentIndex(0);
  }, [closeAgentMentionPanel]);

  /**
   * 插入选中的 agent token 并恢复输入焦点。
   */
  const selectAgentMention = useCallback((agent: AiChatAgentMentionOption): void => {
    const textarea = textareaRef.current;
    if (!textarea || !agentMentionPanelState) {
      return;
    }

    const cursor = textarea.selectionStart;
    const nextValue = `${inputText.slice(0, agentMentionPanelState.start)}${agent.token} ${inputText.slice(cursor)}`;
    const nextCursor = agentMentionPanelState.start + agent.token.length + 1;

    setInputText(nextValue);
    resetHistoryCursor();
    closeAgentMentionPanel();
    requestAnimationFrame(() => {
      adjustTextareaHeight();
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }, [inputText, agentMentionPanelState, setInputText, resetHistoryCursor, closeAgentMentionPanel, adjustTextareaHeight, textareaRef]);

  /**
   * 循环切换 agent mention 面板选中项。
   */
  const moveActiveAgent = useCallback((direction: 1 | -1): void => {
    setActiveAgentIndex((currentIndex) => {
      if (matchedAgentMentions.length === 0) {
        return 0;
      }

      return (
        (currentIndex + direction + matchedAgentMentions.length) %
        matchedAgentMentions.length
      );
    });
  }, [matchedAgentMentions.length]);

  /**
   * 光标移动离开查询区间时关闭 agent mention 面板。
   */
  const handleTextareaCursorMove = useCallback((): void => {
    const textarea = textareaRef.current;
    if (!textarea || !agentMentionPanelState) {
      return;
    }

    const nextState = resolveAgentMentionPanelState(
      textarea.value,
      textarea.selectionStart,
    );
    if (!nextState) {
      closeAgentMentionPanel();
    }
  }, [agentMentionPanelState, closeAgentMentionPanel, textareaRef]);

  return {
    agentMentionPanelState,
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
  };
};
