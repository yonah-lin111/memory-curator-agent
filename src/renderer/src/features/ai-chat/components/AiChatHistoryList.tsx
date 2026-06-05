import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckSquare, Search, Target, Trash2 } from "lucide-react";
import type { AiChatSession } from "@renderer/features/ai-chat/types";
import { IconButton } from "@renderer/components/ui/IconButton";
import { AiChatHistoryContextMenu } from "@renderer/features/ai-chat/components/AiChatHistoryContextMenu";
import { isEmptyAiChatDraftSession } from "@renderer/features/ai-chat/core/aiChatSessionReducer";

// AI 对话历史列表组件属性类型。
type AiChatHistoryListProps = {
  // AI 会话列表。
  sessions: AiChatSession[];
  // 当前激活的 AI 会话标识。
  activeSessionId: string;
  // 切换 AI 会话回调。
  onSessionChange: (sessionId: string) => void;
  // 新建 AI 会话回调。
  onNewChat: () => void;
  // 重命名 AI 会话回调。
  onRenameChat: (sessionId: string, title: string) => Promise<boolean>;
  // 删除 AI 会话回调。
  onDeleteChat: (sessionId: string) => Promise<boolean>;
  // 批量删除 AI 会话回调。
  onBatchDeleteChats: (sessionIds: string[]) => Promise<boolean>;
  // 加载更多历史回调。
  onLoadMore: () => Promise<void>;
  // 是否还有更多历史。
  hasMore: boolean;
  // 是否正在加载更多。
  isLoadingMore: boolean;
  // 已完成但尚未查看的 AI 会话 ID。
  completionNoticeSessionIds?: Set<string>;
  // 清理指定会话完成提醒回调。
  onCompletionNoticeClear?: (sessionId: string) => void;
  // 是否隐藏
  "aria-hidden"?: boolean;
};

// 行内标题编辑草稿。
type EditingAiChatTitleDraft = {
  // 正在编辑的 AI 会话 ID。
  id: string;
  // 正在编辑的标题。
  title: string;
};

// AI 会话右键菜单状态。
type AiChatContextMenuState = {
  // 菜单所属 AI 会话 ID。
  sessionId: string;
  // 菜单显示横坐标。
  x: number;
  // 菜单显示纵坐标。
  y: number;
};

/**
 * 将会话时间转换为可比较时间戳，无法解析时保留稳定靠后排序。
 */
const getSessionTimestampValue = (time: string): number => {
  const value = Date.parse(time.replace(" ", "T"));

  return Number.isNaN(value) ? 0 : value;
};

/**
 * 会话列表展示时，空白新建对话固定在顶部，其余按最新消息时间倒序展示。
 */
const sortSessionsByUpdatedTime = (items: AiChatSession[]): AiChatSession[] =>
  [...items].sort((first, second) => {
    const firstIsEmptyDraft = isEmptyAiChatDraftSession(first);
    const secondIsEmptyDraft = isEmptyAiChatDraftSession(second);

    if (firstIsEmptyDraft || secondIsEmptyDraft) {
      return firstIsEmptyDraft === secondIsEmptyDraft ? 0 : firstIsEmptyDraft ? -1 : 1;
    }

    const timeDiff =
      getSessionTimestampValue(second.time) - getSessionTimestampValue(first.time);

    return timeDiff || second.id.localeCompare(first.id);
  });

/**
 * 历史列表展示到年月日时分，兼容旧的短时间数据。
 */
const formatSessionListTime = (time: string): string => time.slice(0, 16);

/**
 * AiChatHistoryList - 负责左侧对话历史列表的渲染与交互
 */
export const AiChatHistoryList = ({
  sessions,
  activeSessionId,
  onSessionChange,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  onBatchDeleteChats,
  onLoadMore,
  hasMore,
  isLoadingMore,
  completionNoticeSessionIds,
  onCompletionNoticeClear,
  "aria-hidden": ariaHidden,
}: AiChatHistoryListProps): React.JSX.Element => {
  // 当前行内标题编辑草稿。
  const [editingTitle, setEditingTitle] = useState<EditingAiChatTitleDraft | null>(null);
  // 当前打开的右键菜单；集中管理以保证视口内只存在一个菜单。
  const [contextMenu, setContextMenu] = useState<AiChatContextMenuState | null>(null);
  // 历史搜索关键词。
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  // 数据库搜索结果状态。
  const [dbSearchResults, setDbSearchResults] = useState<AiChatSession[]>([]);
  // 是否正在进行数据库搜索。
  const [isSearching, setIsSearching] = useState<boolean>(false);
  // 是否进入批量选择模式。
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  // 批量选择的 AI 会话 ID。
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(() => new Set());
  // 刚从生成中转为完成的会话 ID，用于完成提醒红点。
  const [completedSessionIds, setCompletedSessionIds] = useState<Set<string>>(() => new Set());
  // 上一次渲染后的会话状态快照，用于识别 running -> completed。
  const previousSessionStatusRef = useRef<Map<string, AiChatSession["status"]>>(new Map());
  // 历史滚动容器引用，用于触底加载。
  const historyListRef = useRef<HTMLDivElement | null>(null);
  // 记录是否需要在渲染后自动定位。
  const shouldLocateRef = useRef<boolean>(false);

  // 按标题过滤（支持数据库搜索与本地过滤）后的历史列表。
  const filteredSessions = useMemo(() => {
    const keyword = searchKeyword.trim();

    if (!keyword) {
      return sortSessionsByUpdatedTime(sessions);
    }

    return sortSessionsByUpdatedTime(dbSearchResults);
  }, [searchKeyword, sessions, dbSearchResults]);

  // 当过滤后的列表变化时，如果需要定位，则执行滚动。
  useEffect(() => {
    if (shouldLocateRef.current) {
      const activeElement = historyListRef.current?.querySelector('[aria-current="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        shouldLocateRef.current = false;
      }
    }
  }, [filteredSessions]);

  // 异步加载未加载会话的数据库搜索。
  useEffect(() => {
    const keyword = searchKeyword.trim();
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
            setDbSearchResults(results);
            setIsSearching(false);
          })
          .catch(() => {
            if (!isMounted) return;
            setDbSearchResults([]);
            setIsSearching(false);
          });
      } else {
        // 兜底：本地过滤
        if (isMounted) {
          const normalizedKeyword = keyword.toLowerCase();
          const filtered = sessions.filter((session) =>
            session.title.toLowerCase().includes(normalizedKeyword)
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
  }, [searchKeyword, sessions]);

  useEffect(() => {
    const previousStatuses = previousSessionStatusRef.current;
    const liveSessionIds = new Set(sessions.map((session) => session.id));

    setCompletedSessionIds((currentIds) => {
      const nextIds = new Set(currentIds);
      let hasChanged = false;

      for (const session of sessions) {
        const previousStatus = previousStatuses.get(session.id);

        if (
          (session.id === activeSessionId || session.status === "running") &&
          nextIds.delete(session.id)
        ) {
          hasChanged = true;
        }

        if (
          previousStatus === "running" &&
          session.status === "completed" &&
          session.id !== activeSessionId &&
          !nextIds.has(session.id)
        ) {
          nextIds.add(session.id);
          hasChanged = true;
        }
      }

      for (const sessionId of currentIds) {
        if (liveSessionIds.has(sessionId)) {
          continue;
        }

        nextIds.delete(sessionId);
        hasChanged = true;
      }

      return hasChanged ? nextIds : currentIds;
    });

    previousStatuses.clear();
    for (const session of sessions) {
      previousStatuses.set(session.id, session.status);
    }
  }, [activeSessionId, sessions]);

  useEffect(() => {
    if (!completionNoticeSessionIds?.has(activeSessionId)) {
      return;
    }

    onCompletionNoticeClear?.(activeSessionId);
  }, [activeSessionId, completionNoticeSessionIds, onCompletionNoticeClear]);

  useEffect(() => {
    const liveSessionIds = new Set(sessions.map((session) => session.id));

    setSelectedSessionIds((currentIds) => {
      const nextIds = new Set(
        Array.from(currentIds).filter((sessionId) => liveSessionIds.has(sessionId)),
      );

      return nextIds.size === currentIds.size ? currentIds : nextIds;
    });
  }, [sessions]);

  useEffect(() => {
    if (!contextMenu) {
      return undefined;
    }

    /**
     * 关闭当前右键菜单。
     */
    const closeContextMenu = (): void => {
      setContextMenu(null);
    };

    /**
     * 按 Escape 关闭当前右键菜单。
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };

    document.addEventListener("click", closeContextMenu);
    document.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("resize", closeContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("click", closeContextMenu);
      document.removeEventListener("scroll", closeContextMenu, true);
      window.removeEventListener("resize", closeContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  /**
   * 打开指定会话的右键菜单。
   */
  const handleOpenContextMenu = (
    event: React.MouseEvent<HTMLDivElement>,
    sessionId: string,
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      sessionId,
      x: event.clientX,
      y: event.clientY,
    });
  };

  /**
   * 通过键盘激活历史项，保持整行可点击体验。
   */
  const handleSessionKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    sessionId: string,
  ): void => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onSessionChange(sessionId);
  };

  /**
   * 进入标题行内编辑态。
   */
  const handleStartEditTitle = (session: AiChatSession): void => {
    setEditingTitle({
      id: session.id,
      title: session.title,
    });
    setContextMenu(null);
  };

  /**
   * 提交标题编辑；空标题直接放弃，避免误清空。
   */
  const handleCommitEditTitle = async (session: AiChatSession): Promise<void> => {
    if (!editingTitle) {
      return;
    }

    const nextTitle = editingTitle.title.trim();

    if (!nextTitle || nextTitle === session.title) {
      setEditingTitle(null);
      return;
    }

    const isUpdated = await onRenameChat(session.id, nextTitle);

    if (isUpdated) {
      setEditingTitle(null);
    }
  };

  /**
   * 删除当前右键菜单指向的会话。
   */
  const handleDeleteChat = async (session: AiChatSession): Promise<void> => {
    const isDeleted = await onDeleteChat(session.id);

    if (!isDeleted) {
      return;
    }

    if (editingTitle?.id === session.id) {
      setEditingTitle(null);
    }

    setContextMenu(null);
  };

  /**
   * 滚动接近底部时加载下一页历史。
   */
  const handleHistoryScroll = (): void => {
    const element = historyListRef.current;

    if (!element || !hasMore || isLoadingMore) {
      return;
    }

    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

    if (distanceToBottom <= 24) {
      void onLoadMore();
    }
  };

  /**
   * 切换批量选择模式。
   */
  const handleBatchModeToggle = (): void => {
    setIsBatchMode((currentMode) => !currentMode);
    setSelectedSessionIds(new Set());
    setContextMenu(null);
  };

  /**
   * 切换批量选择项。
   */
  const handleSelectSession = (session: AiChatSession): void => {
    if (session.status === "running") {
      return;
    }

    setSelectedSessionIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(session.id)) {
        nextIds.delete(session.id);
      } else {
        nextIds.add(session.id);
      }

      return nextIds;
    });
  };

  /**
   * 执行批量删除。
   */
  const handleBatchDelete = async (): Promise<void> => {
    const sessionIds = Array.from(selectedSessionIds);

    if (sessionIds.length === 0) {
      return;
    }

    const isDeleted = await onBatchDeleteChats(sessionIds);

    if (isDeleted) {
      setSelectedSessionIds(new Set());
      setIsBatchMode(false);
    }
  };

  /**
   * 定位并滚动到当前激活的对话。
   */
  const handleLocateActiveSession = (): void => {
    if (!historyListRef.current) {
      return;
    }

    // 查找具有 aria-current="true" 的激活对话元素。
    const activeElement = historyListRef.current.querySelector('[aria-current="true"]');

    if (activeElement) {
      activeElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      // 找不到激活的元素：可能是因为有搜索关键词过滤，或者尚未加载。
      if (searchKeyword) {
        shouldLocateRef.current = true;
        setSearchKeyword("");
      } else {
        // 如果没有搜索关键词却依然找不到，可能是由于该会话还没被完全插入/渲染。
        shouldLocateRef.current = true;
        setTimeout(() => {
          const el = historyListRef.current?.querySelector('[aria-current="true"]');
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "nearest" });
            shouldLocateRef.current = false;
          }
        }, 100);
      }
    }
  };

  const contextMenuSession = contextMenu
    ? filteredSessions.find((session) => session.id === contextMenu.sessionId)
    : undefined;

  return (
    <div
      className="flex h-full w-full flex-col gap-4"
      aria-label="Chat history list"
      aria-hidden={ariaHidden}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ai-loading-bar {
          0%, 100% { height: 30%; }
          50% { height: 100%; }
        }
      `}} />
      {/* 顶部标题与新建按钮 */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold tracking-wider text-white/40 uppercase">
          AI DIALOGS
        </h2>
        <div className="flex items-center gap-1">
          <IconButton
            aria-label={isBatchMode ? "Exit batch delete" : "Batch delete chats"}
            highlighted={isBatchMode}
            preset={isBatchMode ? "close" : undefined}
            onClick={handleBatchModeToggle}
          >
            {isBatchMode ? null : <CheckSquare className="h-3.5 w-3.5" />}
          </IconButton>
          <IconButton
            aria-label="Locate active chat"
            onClick={handleLocateActiveSession}
          >
            <Target className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            aria-label="New chat"
            preset="add"
            onClick={onNewChat}
          />
        </div>
      </div>

      {/* 搜索框 (仅用于静态 Mock 展示) */}
      <div className="relative px-1">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
        <input
          type="text"
          placeholder="搜索对话历史"
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          className="w-full rounded-[6px] border border-white/5 bg-white/[0.02] py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/20 outline-none focus:border-white/15"
        />
      </div>

      {isBatchMode ? (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs text-white/35">已选 {selectedSessionIds.size}</span>
          <button
            type="button"
            disabled={selectedSessionIds.size === 0}
            onClick={() => void handleBatchDelete()}
            className="inline-flex items-center gap-1 rounded-[6px] border border-rose-400/20 px-2 py-1 text-xs font-bold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-white/20 disabled:hover:bg-transparent"
          >
            <Trash2 className="h-3 w-3" />
            删除
          </button>
        </div>
      ) : null}

      {/* 历史对话列表 */}
      <div
        ref={historyListRef}
        aria-label="AI chat history sessions"
        className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1"
        onScroll={handleHistoryScroll}
      >
        {filteredSessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const isEditing = editingTitle ? editingTitle.id === session.id : false;
          const isGenerating = session.status === "running";
          const isSelected = selectedSessionIds.has(session.id);
          const hasCompletionNotice =
            !isActive &&
            !isGenerating &&
            (completedSessionIds.has(session.id) || Boolean(completionNoticeSessionIds?.has(session.id)));
          const itemStyleClass = isActive
            ? "bg-white text-black font-semibold"
            : hasCompletionNotice
              ? "bg-emerald-950/20 text-emerald-300 font-semibold shadow-[inset_0_0_10px_rgba(16,185,129,0.06)]"
              : "bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white";

          return (
            <div
              key={session.id}
              aria-current={isActive ? "true" : undefined}
              className={`relative flex flex-col gap-1 rounded-[6px] px-2.5 py-2 text-left transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 ${itemStyleClass} ${isEditing ? "" : "cursor-pointer"}`}
              role={isEditing ? undefined : "button"}
              tabIndex={isEditing ? undefined : 0}
              onClick={() => {
                if (isBatchMode) {
                  handleSelectSession(session);
                  return;
                }

                if (!isEditing) {
                  onCompletionNoticeClear?.(session.id);
                  onSessionChange(session.id);
                }
              }}
              onContextMenu={(event) => {
                if (!isBatchMode) {
                  handleOpenContextMenu(event, session.id);
                }
              }}
              onKeyDown={(event) => {
                if (!isEditing) {
                  handleSessionKeyDown(event, session.id);
                }
              }}
            >
              <div className="flex items-start justify-between gap-2 w-full">
                {isBatchMode ? (
                  <span
                    aria-hidden="true"
                    className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[4px] border ${
                      isSelected
                        ? isActive
                          ? "border-black bg-black text-white"
                          : "border-white bg-white text-black"
                        : isActive
                          ? "border-black/30"
                          : "border-white/15"
                    }`}
                  >
                    {isSelected ? <CheckSquare className="h-3 w-3" /> : null}
                  </span>
                ) : null}
                {isEditing ? (
                  <div className="relative min-w-0 flex-1">
                    <div
                      aria-hidden="true"
                      className="invisible min-h-[14px] break-words whitespace-pre-wrap text-xs font-bold leading-none"
                    >
                      {editingTitle?.title || " "}
                    </div>
                    <input
                      autoFocus
                      aria-label={`Edit chat title ${session.title}`}
                      className={`absolute inset-0 h-full w-full min-w-0 rounded-[4px] border border-transparent bg-transparent text-xs font-bold leading-none outline-none focus:border-transparent ${
                        isActive ? "text-black" : "text-white"
                      }`}
                      onBlur={() => void handleCommitEditTitle(session)}
                      onChange={(event) =>
                        setEditingTitle((currentDraft) =>
                          currentDraft
                            ? { ...currentDraft, title: event.target.value }
                            : currentDraft,
                        )
                      }
                      onFocus={(event) => event.target.select()}
                      onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing) {
                          return;
                        }
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleCommitEditTitle(session);
                        }
                        if (event.key === "Escape") {
                          setEditingTitle(null);
                        }
                      }}
                      value={editingTitle?.title ?? ""}
                    />
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold leading-none">
                      {session.title}
                    </span>
                    <span
                      className={`mt-1 block truncate text-[10px] font-mono leading-none ${
                        isActive
                          ? "text-black/55"
                          : hasCompletionNotice
                            ? "text-emerald-400/50"
                            : "text-white/30"
                      }`}
                    >
                      {formatSessionListTime(session.time)}
                    </span>
                  </div>
                )}
                {isGenerating ? (
                  <span
                    className={`flex min-h-2.5 min-w-[2.5rem] flex-shrink-0 items-center justify-end text-[10px] font-mono leading-none ${
                      isActive
                        ? "text-black/55"
                        : hasCompletionNotice
                          ? "text-emerald-400/50"
                          : "text-white/30"
                    }`}
                  >
                    <span
                      className="flex items-end gap-[2px] h-3 px-1"
                      aria-label="AI is generating"
                    >
                      <span className="w-[1.5px] bg-current rounded-[0.5px]" style={{ animation: 'ai-loading-bar 1s ease-in-out infinite', animationDelay: '0ms' }} />
                      <span className="w-[1.5px] bg-current rounded-[0.5px]" style={{ animation: 'ai-loading-bar 1s ease-in-out infinite', animationDelay: '150ms' }} />
                      <span className="w-[1.5px] bg-current rounded-[0.5px]" style={{ animation: 'ai-loading-bar 1s ease-in-out infinite', animationDelay: '300ms' }} />
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
        {filteredSessions.length === 0 ? (
          <div className="rounded-[6px] border border-white/5 px-3 py-4 text-center text-xs text-white/35">
            {isSearching ? "搜索中..." : "没有匹配的对话"}
          </div>
        ) : null}
        {hasMore && !searchKeyword.trim() ? (
          <button
            type="button"
            className="rounded-[6px] border border-white/5 px-3 py-2 text-xs text-white/35 hover:bg-white/[0.03] hover:text-white/60"
            disabled={isLoadingMore}
            onClick={() => void onLoadMore()}
          >
            {isLoadingMore ? "加载中..." : "加载更多"}
          </button>
        ) : null}
      </div>

      {contextMenuSession ? (
        <AiChatHistoryContextMenu
          sessionTitle={contextMenuSession.title}
          x={contextMenu?.x ?? 0}
          y={contextMenu?.y ?? 0}
          onEditTitle={() => handleStartEditTitle(contextMenuSession)}
          onDeleteChat={() => void handleDeleteChat(contextMenuSession)}
        />
      ) : null}

      {/* 底部 Agent 状态卡片 */}
      <div className="mt-auto rounded-[6px] border border-white/5 bg-white/[0.02] p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-white/60" />
          <span className="text-xs font-bold text-white/60 font-mono">
            ReAct Agent Mode
          </span>
        </div>
      </div>
    </div>
  );
};
