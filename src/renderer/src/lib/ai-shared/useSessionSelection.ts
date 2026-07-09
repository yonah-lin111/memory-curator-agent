import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CuratorSession } from "@/features/curator/types";

/**
 * useCuratorSessions - 专门管理快速切换历史会话（/session 或 /resume）的检索过滤、全局数据库检索与滚动触底加载状态的微 Hook。
 *
 * @param inputText 输入框文本
 * @param setInputText 修改输入文本状态回调
 * @param chatSessions 所有的历史会话
 * @param textareaRef 输入框 DOM 引用
 * @param resetHistoryCursor 重置历史提示词游标回调
 * @param onActiveSessionChange 外部切换激活会话的回调
 * @param hasMore 是否还有更多历史会话
 * @param isLoadingMore 是否正在加载更多会话
 * @param onLoadMore 加载更多历史会话的回调
 */
export const useCuratorSessions = (
  inputText: string,
  setInputText: (value: string) => void,
  chatSessions: CuratorSession[],
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  resetHistoryCursor: () => void,
  onActiveSessionChange: (sessionId: string) => void,
  hasMore?: boolean,
  isLoadingMore?: boolean,
  onLoadMore?: () => Promise<void>,
) => {
  // 当前高亮选中的会话在匹配列表中的索引
  const [activeSessionIndex, setActiveSessionIndex] = useState(0);
  // 数据库模糊搜索结果状态
  const [dbSearchResults, setDbSearchResults] = useState<CuratorSession[]>([]);
  // 是否正在进行数据库搜索
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // 是否处于会话切换检索模式下
  const isSessionMode = useMemo(() => {
    const lower = inputText.toLowerCase();
    return (
      lower === "/session" ||
      lower.startsWith("/session ") ||
      lower === "/resume" ||
      lower.startsWith("/resume ")
    );
  }, [inputText]);

  // 会话检索的查询关键字
  const sessionQuery = useMemo(() => {
    if (!isSessionMode) return "";
    const lower = inputText.toLowerCase();
    if (lower.startsWith("/session ")) {
      return inputText.slice(9).trim();
    }
    if (lower.startsWith("/resume ")) {
      return inputText.slice(8).trim();
    }
    return "";
  }, [isSessionMode, inputText]);

  // 异步加载数据库全局匹配项，对齐 CuratorHistoryList.tsx
  useEffect(() => {
    const keyword = sessionQuery.trim();
    if (!keyword) {
      setDbSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    let isMounted = true;

    const timer = setTimeout(() => {
      const listSessionsFn = window.api?.ai?.listSessions;
      if (listSessionsFn) {
        listSessionsFn({ query: keyword })
          .then((results) => {
            if (!isMounted) return;
            setDbSearchResults(results || []);
            setIsSearching(false);
          })
          .catch(() => {
            if (!isMounted) return;
            setDbSearchResults([]);
            setIsSearching(false);
          });
      } else {
        // 兜底本地搜索
        if (isMounted) {
          const normalizedKeyword = keyword.toLowerCase();
          const filtered = chatSessions.filter((session) =>
            (session.title || "新建对话").toLowerCase().includes(normalizedKeyword)
          );
          setDbSearchResults(filtered);
          setIsSearching(false);
        }
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [sessionQuery, chatSessions]);

  // 整理出最终匹配并渲染出来的会话列表（有检索词用数据库结果，无检索词用本地分页会话）
  const matchedSessions = useMemo(() => {
    if (!isSessionMode) return [];
    if (!sessionQuery) return chatSessions;
    return dbSearchResults;
  }, [chatSessions, isSessionMode, sessionQuery, dbSearchResults]);

  // 当搜索出的列表长度发生变化时，重置高亮索引到首位
  useEffect(() => {
    setActiveSessionIndex(0);
  }, [matchedSessions.length]);

  /**
   * 选择指定的历史会话并清空输入状态
   */
  const selectSession = useCallback((session: CuratorSession): void => {
    onActiveSessionChange(session.id);
    setInputText("");
    resetHistoryCursor();
    // 异步让输入框重新获得焦点，保证交互流畅
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [onActiveSessionChange, setInputText, resetHistoryCursor, textareaRef]);

  /**
   * 调节当前面板高亮的选中项（不进行回绕，到顶或到底时保持在边界）
   */
  const moveActiveSession = useCallback((direction: 1 | -1): void => {
    setActiveSessionIndex((currentIndex) => {
      if (matchedSessions.length === 0) {
        return 0;
      }
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0) {
        return 0;
      }
      if (nextIndex >= matchedSessions.length) {
        return matchedSessions.length - 1;
      }
      return nextIndex;
    });
  }, [matchedSessions.length]);

  /**
   * 会话检索面板触底滚动监听（自动分页加载更多历史会话）
   */
  const handleSessionScroll = useCallback((e: React.UIEvent<HTMLDivElement>): void => {
    const element = e.currentTarget;
    // 如果没有下一页、或者正在加载、或者有检索词过滤，不触发触底加载
    if (!element || !hasMore || isLoadingMore || sessionQuery.trim()) {
      return;
    }

    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    // 触底判定高度对齐 CuratorHistoryList.tsx (24px)
    if (distanceToBottom <= 24 && onLoadMore) {
      void onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore, sessionQuery]);

  return {
    activeSessionIndex,
    matchedSessions,
    isSessionMode,
    sessionQuery,
    isSearching,
    setActiveSessionIndex,
    selectSession,
    moveActiveSession,
    handleSessionScroll,
  };
};
