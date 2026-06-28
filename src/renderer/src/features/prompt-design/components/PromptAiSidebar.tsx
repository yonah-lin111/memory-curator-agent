import type React from "react";

type PromptAiSidebarProps = {
  isOpen?: boolean;
  isTransitionEnabled?: boolean;
};

export const PromptAiSidebar = ({
  isOpen = false,
  isTransitionEnabled = true,
}: PromptAiSidebarProps): React.JSX.Element => {
  return (
    <div
      style={{
        width: !isOpen ? "0px" : "30vw",
        opacity: isOpen ? 1 : 0,
        marginLeft: isOpen ? "0.75rem" : "0px", // 对应 gap-3 的间距
      }}
      className={`flex-shrink-0 flex flex-col min-h-0 bg-[#212121] rounded-[6px] border border-white/5 text-xs text-white/55 custom-scrollbar [scrollbar-gutter:stable] select-none ${
        isTransitionEnabled ? "transition-all duration-300 ease-in-out" : ""
      } ${isOpen ? "overflow-y-auto px-4 py-2" : "overflow-hidden pointer-events-none px-0 py-0"}`}
      aria-label="Prompt AI Sidebar"
    >
      {isOpen && (
        <>
          <div className="flex-1 overflow-y-auto custom-scrollbar [scrollbar-gutter:stable] flex flex-col gap-2 pr-1">
            {/* 预留容器 */}
          </div>
        </>
      )}
    </div>
  );
};
