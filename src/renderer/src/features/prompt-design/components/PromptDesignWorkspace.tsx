import type React from "react";

interface PromptDesignWorkspaceProps {
  isOpen: boolean;
}

export const PromptDesignWorkspace = ({ isOpen }: PromptDesignWorkspaceProps): React.JSX.Element | null => {
  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full w-full bg-[#000000] text-white" />
  );
};
