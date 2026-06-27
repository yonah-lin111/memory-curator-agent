import type React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";

type PromptSidebarProps = {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  "aria-hidden"?: boolean;
};

export const PromptSidebarList = ({
  isCollapsed = false,
  onCollapsedChange,
  "aria-hidden": ariaHidden,
}: PromptSidebarProps): React.JSX.Element => {
  if (isCollapsed) {
    return (
      <div
        className="flex h-full w-full flex-col items-center gap-4 py-1"
        aria-label="Prompt design components"
        aria-hidden={ariaHidden}
      >
        <Tooltip content="展开" placement="right">
          <IconButton
            aria-label="Expand sidebar"
            onClick={() => onCollapsedChange?.(false)}
          >
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-full flex-col gap-4"
      aria-label="Prompt design components"
      aria-hidden={ariaHidden}
    >
      {/* 顶部标题与折叠按钮 */}
      <div className="flex items-center justify-between px-1">
        <Tooltip content="收起" placement="right">
          <IconButton
            aria-label="Collapse sidebar"
            onClick={() => onCollapsedChange?.(true)}
          >
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
};
