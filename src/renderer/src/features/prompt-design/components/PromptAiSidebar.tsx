import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { ChevronRight, ChevronLeft, History, Trash2 } from "lucide-react";
import { PromptAiChatWorkspace } from "./PromptAiChatWorkspace";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { Input } from "@/components/ui/Input";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { usePromptAiChatController } from "./usePromptAiChatController";
import { usePromptDesignStore } from "../store/promptDesignStore";

// 会话切换 loading 最短展示时长（ms），避免闪烁。
const MIN_SWITCH_LOADING_MS = 500;

type PromptAiSidebarProps = {
  isOpen?: boolean;
  isTransitionEnabled?: boolean;
};

export const PromptAiSidebar = ({
  isOpen = false,
  isTransitionEnabled = true,
}: PromptAiSidebarProps): React.JSX.Element => {
  const [sidebarWidth, setSidebarWidth] = useState<number>(30); // vw
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isDraggingRef = useRef(isDragging);

  const activeDesignId = usePromptDesignStore((state) => state.activeDesignId);
  const designItemId = activeDesignId || "default-design-item-id";
  const controller = usePromptAiChatController(designItemId);

  // 会话切换 loading 状态
  const [isSwitching, setIsSwitching] = useState(false);
  const isSwitchingRef = useRef(false);
  const loadingStartTimeRef = useRef(0);
  const switchCounterRef = useRef(0);

  const [editingTitle, setEditingTitle] = useState<{ id: string; title: string } | null>(null);

  const activeSession = controller.sessions.find(s => s.id === controller.activeSessionId);

  // workspace 的引用，用于调用滚动方法
  const workspaceRef = useRef<{ scrollLatestUserToTop: (behavior: ScrollBehavior, onComplete?: () => void) => void }>(null);

  /**
   * 结束会话切换 loading，确保最少展示 MIN_SWITCH_LOADING_MS。
   */
  const finishSessionSwitchScroll = (): void => {
    if (!isSwitchingRef.current) return;
    const counter = switchCounterRef.current;
    const elapsed = Date.now() - loadingStartTimeRef.current;
    const remaining = Math.max(0, MIN_SWITCH_LOADING_MS - elapsed);

    setTimeout(() => {
      if (switchCounterRef.current === counter) {
        setIsSwitching(false);
        isSwitchingRef.current = false;
      }
    }, remaining);
  };

  /**
   * 执行会话切换，loading 由 useLayoutEffect 监听 activeSessionId 统一驱动。
   */
  const handleSessionSwitch = (sid: string): void => {
    controller.handleSessionChange(sid);
  };

  /**
   * 执行新建对话，loading 由 useLayoutEffect 监听 activeSessionId 统一驱动。
   */
  const handleNewChatWithLoading = (): void => {
    controller.handleNewChat();
  };

  // 会话切换时统一驱动 loading（useLayoutEffect 确保在浏览器绘制前完成）。
  useLayoutEffect(() => {
    const activeId = controller.activeSessionId;

    // 无有效会话时跳过 loading
    if (!activeId) {
      return;
    }

    setIsSwitching(true);
    isSwitchingRef.current = true;
    loadingStartTimeRef.current = Date.now();
    switchCounterRef.current += 1;

    // 如果 workspace 存在滚动方法，则调用滚动到底部或指定的最新用户提问处
    if (workspaceRef.current?.scrollLatestUserToTop && controller.messages.length > 0) {
      workspaceRef.current.scrollLatestUserToTop("auto", () => {
        finishSessionSwitchScroll();
      });
    } else {
      finishSessionSwitchScroll();
    }
  }, [controller.activeSessionId]); // 依赖 activeSessionId 发生变化

  // 当会话中的消息数量在初始加载后变得有效时，或者依赖项就绪时
  // 此处我们需要在消息重新渲染到 DOM 后立即执行滚动
  useLayoutEffect(() => {
    if (isSwitchingRef.current && workspaceRef.current?.scrollLatestUserToTop && controller.messages.length > 0) {
      workspaceRef.current.scrollLatestUserToTop("auto", () => {
        finishSessionSwitchScroll();
      });
    }
  }, [controller.messages.length]);


  const handleStartEditTitle = (session: any) => {
    setEditingTitle({ id: session.id, title: session.title });
  };

  const handleCommitEditTitle = async (session: any) => {
    if (!editingTitle) return;
    const nextTitle = editingTitle.title.trim();
    if (!nextTitle || nextTitle === session.title) {
      setEditingTitle(null);
      return;
    }
    const isUpdated = await controller.handleRenameChat(session.id, nextTitle);
    if (isUpdated) {
      setEditingTitle(null);
    }
  };

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidthVw =
        ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
      const clampedWidth = Math.min(Math.max(newWidthVw, 30), 45);
      setSidebarWidth(clampedWidth);
      if (clampedWidth > 30) {
        setIsExpanded(true);
      } else {
        setIsExpanded(false);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging]);

  const toggleExpand = () => {
    if (isExpanded) {
      setSidebarWidth(30);
      setIsExpanded(false);
    } else {
      setSidebarWidth(45); // Max width defined in clamp
      setIsExpanded(true);
    }
  };

  return (
    <div
      style={{
        width: !isOpen ? "0px" : `${sidebarWidth}vw`,
        opacity: isOpen ? 1 : 0,
        marginLeft: isOpen ? "0.75rem" : "0px", // 对应 gap-3 的间距
      }}
      className={`relative flex-shrink-0 flex flex-col min-h-0 bg-[#212121] rounded-[6px] border border-white/5 text-xs text-white/55 custom-scrollbar [scrollbar-gutter:stable] select-none ${
        isTransitionEnabled && !isDragging
          ? "transition-all duration-300 ease-in-out"
          : ""
      } overflow-hidden ${!isOpen ? "pointer-events-none" : ""}`}
      aria-label="Prompt AI Sidebar"
    >
      {isOpen && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-white/20 active:bg-white/40 transition-colors z-50"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
        />
      )}
      {isOpen && (
        <div className="flex items-center p-2 shrink-0 h-9 border-b border-white/5 gap-2">
          <Tooltip
            content={isExpanded ? "恢复默认宽度" : "展开最大宽度"}
            placement="bottom"
          >
            <IconButton onClick={toggleExpand}>
              {isExpanded ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </IconButton>
          </Tooltip>
          
          <div className="flex items-center flex-1 min-w-0 gap-1.5">
            {activeSession && (
              <Tooltip
                content="重命名对话"
                placement="bottom"
              >
                <Tooltip
                  trigger="click"
                  placement="bottom"
                  contentClassName="!w-[240px] !p-3 !whitespace-normal flex flex-col"
                  onConfirm={() => handleCommitEditTitle(activeSession)}
                  onCancel={() => setEditingTitle(null)}
                  form={
                    <div className="flex flex-col gap-2.5">
                      <div className="flex flex-col gap-1 text-left">
                        <span className="text-[11px] font-semibold text-white/40">
                          对话名称
                        </span>
                        <Input
                          autoFocus
                          type="text"
                          value={editingTitle?.title ?? activeSession.title}
                          onChange={(e) => setEditingTitle(prev => prev ? { ...prev, title: e.target.value } : { id: activeSession.id, title: e.target.value })}
                          placeholder="请输入对话名称"
                          size="xs"
                          className="!h-[28px]"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCommitEditTitle(activeSession);
                            }
                          }}
                        />
                      </div>
                    </div>
                  }
                >
                  <span 
                    className="block truncate text-xs font-bold leading-none cursor-pointer hover:text-white/80 transition-colors"
                    onClick={() => handleStartEditTitle(activeSession)}
                  >
                    {activeSession.title}
                  </span>
                </Tooltip>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Tooltip
              title="Tokens 使用量：1,250 / 200,000 (0.6%)"
              placement="bottom"
            >
              <div className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-[6px] hover:bg-white/5 transition-colors flex-shrink-0 group/context-circle">
                <svg
                  className="h-[16px] w-[16px] -rotate-90 transform"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    strokeWidth="10"
                    className="stroke-white/10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    strokeWidth="10"
                    className="stroke-[#3B82F6]"
                    strokeDasharray="282.7"
                    strokeDashoffset={282.7 - (282.7 * 0.6) / 100}
                  />
                </svg>
              </div>
            </Tooltip>
            <Tooltip content="历史记录" placement="bottom">
              <Tooltip
                placement="bottom"
                trigger="click"
                contentClassName="p-1 min-w-[200px]"
                content={
                <div className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar">
                  {controller.sessions.length > 0 ? (
                    controller.sessions.map((item) => {
                      const isActive = item.id === controller.activeSessionId;
                      return (
                        <div
                          key={item.id}
                          className={`relative flex flex-col gap-1 rounded-[6px] px-2.5 py-2 text-left transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 cursor-pointer ${
                            isActive
                              ? "bg-white/10 text-white font-semibold"
                              : "hover:bg-white/[0.02] text-white/70 group"
                          }`}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (!isActive) {
                              handleSessionSwitch(item.id);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-2 w-full">
                            <div className="min-w-0 flex-1">
                              <span className={`block truncate text-xs font-bold leading-none ${isActive ? "text-white" : "group-hover:text-white"}`}>
                                {item.title}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-3 py-4 text-center text-xs text-white/35">
                      无对话历史
                    </div>
                  )}
                </div>
                }
              >
                <IconButton>
                  <History className="h-4 w-4" />
                </IconButton>
              </Tooltip>
            </Tooltip>
            {activeSession && (
              <Tooltip content="删除对话" placement="bottom">
                <Tooltip
                  title="确定删除此对话吗？"
                  placement="bottom"
                  onConfirm={() => controller.handleDeleteChat(activeSession.id)}
                  variant="primary"
                >
                  <IconButton className="flex-shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </Tooltip>
              </Tooltip>
            )}
            <Tooltip content="新建对话" placement="bottom">
              <IconButton
                aria-label="New chat"
                preset="add"
                onClick={handleNewChatWithLoading}
                disabled={controller.messages.length === 0 || controller.isGenerating}
              />
            </Tooltip>
          </div>
        </div>
      )}
      {isOpen && (
        <div className="relative flex-1 min-h-0">
          <LoadingOverlay isLoading={isSwitching} text="Loading session..." />
          <PromptAiChatWorkspace
            ref={workspaceRef}
            controller={{
              ...controller,
              handleSessionChange: handleSessionSwitch,
            }}
          />
        </div>
      )}
    </div>
  );
};
