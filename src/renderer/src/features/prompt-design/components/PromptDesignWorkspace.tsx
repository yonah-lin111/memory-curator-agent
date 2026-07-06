import type React from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { PromptCanvas } from "./PromptCanvas";
import { PromptAiSidebar } from "./PromptAiSidebar";

interface PromptDesignWorkspaceProps {
  isOpen: boolean;
  isPromptAiSidebarOpen?: boolean;
  onClosePromptAiSidebar?: () => void;
}

export const PromptDesignWorkspace = ({ isOpen, isPromptAiSidebarOpen = false, onClosePromptAiSidebar }: PromptDesignWorkspaceProps): React.JSX.Element | null => {
  if (!isOpen) return null;

  return (
    <div className="flex h-full w-full bg-[#000000] text-white overflow-hidden">
      <div className="flex-1 min-w-0 h-full">
        <ReactFlowProvider>
          <PromptCanvas />
        </ReactFlowProvider>
      </div>
      <PromptAiSidebar isOpen={isPromptAiSidebarOpen} onClose={onClosePromptAiSidebar} />
    </div>
  );
};
