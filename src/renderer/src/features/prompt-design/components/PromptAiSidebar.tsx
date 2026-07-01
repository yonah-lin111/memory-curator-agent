import React, { useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronLeft, History } from "lucide-react";
import { PromptAiChatWorkspace } from "./PromptAiChatWorkspace";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { usePromptAiChatController } from "./usePromptAiChatController";
import { usePromptDesignStore } from "../store/promptDesignStore";

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
        <div className="flex items-center justify-between p-2 shrink-0 h-9 border-b border-white/5">
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
          <div className="flex items-center gap-1">
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
            <Tooltip
              placement="bottom"
              trigger="click"
              contentClassName="p-1 min-w-[200px]"
              content={
              <div className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar">
                {controller.sessions.length > 0 ? (
                  controller.sessions.map((item) => (
                    <div
                      key={item.id}
                      className="relative flex flex-col gap-1 rounded-[6px] px-2.5 py-2 text-left transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 hover:bg-white/[0.02] text-white/70 group cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => controller.handleSessionChange(item.id)}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold leading-none group-hover:text-white">
                            {item.title}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
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
            <Tooltip content="新建对话" placement="bottom">
              <IconButton
                aria-label="New chat"
                preset="add"
                onClick={controller.handleNewChat}
              />
            </Tooltip>
          </div>
        </div>
      )}
      {isOpen && <PromptAiChatWorkspace controller={controller} />}
    </div>
  );
};
