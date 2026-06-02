import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Bot, Plus, Search } from "lucide-react";
import type { AiChatSession } from "@renderer/features/ai-chat/types";
import { IconButton } from "@renderer/components/ui/IconButton";
import { AiChatHistoryContextMenu } from "@renderer/features/ai-chat/components/AiChatHistoryContextMenu";

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
 * AiChatHistoryList - 负责左侧对话历史列表的渲染与交互
 */
export const AiChatHistoryList = ({
  sessions,
  activeSessionId,
  onSessionChange,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  "aria-hidden": ariaHidden,
}: AiChatHistoryListProps): React.JSX.Element => {
  // 当前行内标题编辑草稿。
  const [editingTitle, setEditingTitle] = useState<EditingAiChatTitleDraft | null>(null);
  // 当前打开的右键菜单；集中管理以保证视口内只存在一个菜单。
  const [contextMenu, setContextMenu] = useState<AiChatContextMenuState | null>(null);
  // 刚从生成中转为完成的会话 ID，用于完成提醒红点。
  const [completedSessionIds, setCompletedSessionIds] = useState<Set<string>>(() => new Set());
  // 上一次渲染后的会话状态快照，用于识别 running -> completed。
  const previousSessionStatusRef = useRef<Map<string, AiChatSession["status"]>>(new Map());

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

  const contextMenuSession = contextMenu
    ? sessions.find((session) => session.id === contextMenu.sessionId)
    : undefined;

  return (
    <div
      className="flex h-full w-full flex-col gap-4"
      aria-label="对话历史列表"
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
        <IconButton
          aria-label="新建对话"
          onClick={onNewChat}
          className="text-white/45 hover:bg-white/5 hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      {/* 搜索框 (仅用于静态 Mock 展示) */}
      <div className="relative px-1">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
        <input
          type="text"
          placeholder="搜索对话历史"
          disabled
          className="w-full rounded-[6px] border border-white/5 bg-white/[0.02] py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/20 outline-none cursor-not-allowed"
        />
      </div>

      {/* 历史对话列表 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const isEditing = editingTitle?.id === session.id;
          const isGenerating = session.status === "running";
          const hasCompletionNotice =
            !isActive && !isGenerating && completedSessionIds.has(session.id);
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
                if (!isEditing) {
                  onSessionChange(session.id);
                }
              }}
              onContextMenu={(event) => handleOpenContextMenu(event, session.id)}
              onKeyDown={(event) => {
                if (!isEditing) {
                  handleSessionKeyDown(event, session.id);
                }
              }}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                {isEditing ? (
                  <div className="relative min-w-0 flex-1">
                    <div
                      aria-hidden="true"
                      className="invisible min-h-[14px] break-words whitespace-pre-wrap text-xs font-bold leading-none"
                    >
                      {editingTitle.title || " "}
                    </div>
                    <input
                      autoFocus
                      aria-label={`编辑对话标题 ${session.title}`}
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
                      value={editingTitle.title}
                    />
                  </div>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-xs font-bold leading-none">
                    {session.title}
                  </span>
                )}
                 <span
                  className={`flex min-h-2.5 min-w-[2.5rem] flex-shrink-0 items-center justify-end text-[10px] font-mono leading-none ${
                    isActive ? "text-black/55" : hasCompletionNotice ? "text-emerald-400/50" : "text-white/30"
                  }`}
                >
                  {isGenerating ? (
                    <span
                      className="flex items-end gap-[2px] h-3 px-1"
                      aria-label="AI 正在输出"
                    >
                      <span className="w-[1.5px] bg-current rounded-[0.5px]" style={{ animation: 'ai-loading-bar 1s ease-in-out infinite', animationDelay: '0ms' }} />
                      <span className="w-[1.5px] bg-current rounded-[0.5px]" style={{ animation: 'ai-loading-bar 1s ease-in-out infinite', animationDelay: '150ms' }} />
                      <span className="w-[1.5px] bg-current rounded-[0.5px]" style={{ animation: 'ai-loading-bar 1s ease-in-out infinite', animationDelay: '300ms' }} />
                    </span>
                  ) : (
                    session.time
                  )}
                </span>
              </div>
              <p
                className={`text-[11px] leading-relaxed truncate w-full ${
                  isActive ? "text-black/75" : hasCompletionNotice ? "text-emerald-300/45" : "text-white/40"
                }`}
              >
                {session.summary}
              </p>
            </div>
          );
        })}
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

      {/* 底部 Mock 状态卡片 */}
      <div className="mt-auto rounded-[6px] border border-white/5 bg-white/[0.02] p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-white/60" />
          <span className="text-xs font-bold text-white/60 font-mono">
            ReAct Mock Mode
          </span>
        </div>
        <p className="text-xs leading-relaxed text-white/35">
          Plan &rarr; Tool &rarr; Observation &rarr; Answer
        </p>
      </div>
    </div>
  );
};
