import type React from "react";
import { useState, useEffect } from "react";
import { PromptDesignerSidebar } from "./PromptDesignerSidebar";
import { PromptEditor } from "./PromptEditor";
import { PromptAIAssistant } from "./PromptAIAssistant";

interface PromptDesignerWorkspaceProps {
  isOpen: boolean;
}

export const PromptDesignerWorkspace = ({ isOpen }: PromptDesignerWorkspaceProps): React.JSX.Element => {
  const [isAiOpen, setIsAiOpen] = useState(false);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "j") {
        e.preventDefault();
        setIsAiOpen(prev => !prev);
      }
      if (e.key === "Escape" && isAiOpen) {
        setIsAiOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isAiOpen]);

  if (!isOpen) return <></>;

  return (
    <div className="absolute inset-0 bg-[#000000] z-20 flex overflow-hidden">
      <PromptDesignerSidebar />
      <PromptEditor onToggleAi={() => setIsAiOpen(!isAiOpen)} isAiOpen={isAiOpen} />
      <PromptAIAssistant isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
    </div>
  );
};
