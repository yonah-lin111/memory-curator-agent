import React, { useState, useEffect, useRef } from "react";
import { PromptAiChatWorkspace } from "./PromptAiChatWorkspace";

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
  const isDraggingRef = useRef(isDragging);

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
      {isOpen && <PromptAiChatWorkspace />}
    </div>
  );
};
