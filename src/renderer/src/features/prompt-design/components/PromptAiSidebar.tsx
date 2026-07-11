import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { ChevronRight, ChevronLeft, History, Trash2, Bot, X } from "lucide-react";
import { PromptAiChatWorkspace } from "./PromptAiChatWorkspace";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { Input } from "@/components/ui/Input";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { usePromptAiChatController } from "./usePromptAiChatController";
import { usePromptDesignStore } from "../store/promptDesignStore";
import { useActiveCuratorModels } from "@/lib/ai-shared/useActiveModels";
import { resolveCuratorSelectedModelOption, estimateCuratorContextTokens } from "@/lib/ai-shared/contextBuilder";
import { ContextUsageCircle } from "@/components/ai-shared/ContextUsageCircle";
import { useToast } from "@/components/ui/Toast";

// 会话切换 loading 最短展示时长（ms），避免闪烁。
const MIN_SWITCH_LOADING_MS = 500;

type PromptAiSidebarProps = {
  isOpen?: boolean;
  isTransitionEnabled?: boolean;
  onClose?: () => void;
};

export const PromptAiSidebar = ({
  isOpen = false,
  isTransitionEnabled = true,
  onClose,
}: PromptAiSidebarProps): React.JSX.Element => {
  const toast = useToast();
  const [sidebarWidth, setSidebarWidth] = useState<number>(30); // vw
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isDraggingRef = useRef(isDragging);

  const activeDesignId = usePromptDesignStore((state) => state.activeDesignId);
  const designItemId = activeDesignId || "default-design-item-id";
  const controller = usePromptAiChatController(designItemId);

  const { selectedModel, modelOptions } = useActiveCuratorModels();

  const contextTokens = useMemo(() => {
    return controller.messages.reduce((sum, msg) => {
      let tokens = estimateCuratorContextTokens(msg.content);
      if (msg.reasoning) {
        tokens += estimateCuratorContextTokens(msg.reasoning);
      }
      if (msg.toolSteps) {
        tokens += msg.toolSteps.reduce((tSum, step) => tSum + estimateCuratorContextTokens(step.observation), 0);
      }
      return sum + tokens;
    }, 0);
  }, [controller.messages]);

  const contextLimit = useMemo(() => {
    if (!selectedModel) return undefined;
    const [provider, model] = selectedModel.split("::");
    const modelOption = resolveCuratorSelectedModelOption(modelOptions, { provider, model });
    return modelOption?.limit?.context;
  }, [selectedModel, modelOptions]);

  const contextUsagePercent = contextLimit ? Math.round((contextTokens / contextLimit) * 100) : null;

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
    const target = controller.sessions.find(s => s.id === sid);
    if (target) {
      toast.success(`已切换对话: ${target.title}`);
    } else {
      toast.success("已切换对话");
    }
  };

  /**
   * 执行新建对话，loading 由 useLayoutEffect 监听 activeSessionId 统一驱动。
   */
  const handleNewChatWithLoading = (): void => {
    controller.handleNewChat();
    toast.success("已新建对话");
  };

  // 会话切换时统一驱动 loading（useLayoutEffect 确保在浏览器绘制前完成）。
  useLayoutEffect(() => {
    const activeId = controller.activeSessionId;

    // 如果还没有初始化完成或者无有效会话时跳过 loading
    if (!activeId || !controller.sessionInitialized) {
      if (!controller.sessionInitialized) {
        setIsSwitching(true);
        isSwitchingRef.current = true;
      }
      return;
    }

    // 当会话为空（例如切换到新建对话）时，无需展示 loading 动画
    if (controller.messages.length === 0) {
      setIsSwitching(false);
      isSwitchingRef.current = false;
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

  // 修复第一次打开侧边栏时，由于 width 从 0 到 30vw 动画（300ms），导致文本重排，
  // 此时 scrollLatestUserToTop 获取的 offsetTop 不准确，导致滚动不到指定位置的问题。
  useEffect(() => {
    let timer: number;
    if (isOpen && workspaceRef.current && controller.messages.length > 0) {
      timer = window.setTimeout(() => {
        workspaceRef.current?.scrollLatestUserToTop("auto");
      }, 350);
    }
    return () => clearTimeout(timer);
  }, [isOpen, controller.activeSessionId, controller.messages.length]);


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
      toast.success("已重命名对话");
    } else {
      toast.error("重命名对话失败");
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
      {isOpen && !activeDesignId ? (
        <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center animate-fade-in select-text">
          <div className="flex items-center justify-center w-12 h-12 rounded-[6px] bg-white/5 border border-white/5 mb-4 text-white/30 animate-pulse">
            <Bot className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-white/80 mb-1.5 font-mono">// 提示词 AI 助手</h3>
          <p className="text-xs text-white/40 leading-relaxed max-w-[240px]">
            请先在左侧选择一个提示词设计项，以开启该设计的专属 AI 助手。
          </p>
        </div>
      ) : (
        <>
          {isOpen && (
            <div className="flex items-center p-2 shrink-0 h-9 border-b border-white/5 gap-2 animate-fade-in">
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
                    className="!flex min-w-0 items-center"
                  >
                    <Tooltip
                      trigger="click"
                      placement="bottom"
                      contentClassName="!w-[240px] !p-3 !whitespace-normal flex flex-col"
                      onConfirm={() => handleCommitEditTitle(activeSession)}
                      onCancel={() => setEditingTitle(null)}
                      className="!flex min-w-0 items-center"
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
                        className="block truncate text-xs font-bold cursor-pointer hover:text-white/80 transition-colors"
                        onClick={() => handleStartEditTitle(activeSession)}
                      >
                        {activeSession.title}
                      </span>
                    </Tooltip>
                  </Tooltip>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <ContextUsageCircle
                  contextUsagePercent={contextUsagePercent}
                  contextTokens={contextTokens}
                  contextLimit={contextLimit}
                />
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
                      onConfirm={async () => {
                        const isDeleted = await controller.handleDeleteChat(activeSession.id);
                        if (isDeleted) {
                          toast.success("已删除对话");
                        } else {
                          toast.error("删除对话失败");
                        }
                      }}
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
                <Tooltip content="关闭侧边栏" placement="bottom">
                  <IconButton onClick={onClose}>
                    <X className="h-4 w-4" />
                  </IconButton>
                </Tooltip>
              </div>
            </div>
          )}
          {isOpen && (
            <div className="relative flex-1 min-h-0 animate-fade-in">
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
        </>
      )}
    </div>
  );
};
