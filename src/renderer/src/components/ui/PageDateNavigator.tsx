import type React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";
import {
  formatEntryDateLabel,
  shiftEntryDate,
} from "@renderer/pages/components/workspacePageShared";

// 页面顶部日期切换器属性。
interface PageDateNavigatorProps {
  // 当前页面日期。
  entryDate: string;
  // 当前页面标签。
  label: string;
  // 日期变化回调。
  onChange: (nextDate: string) => void;
}

/**
 * PageDateNavigator - 页面顶部日期切换器。
 */
export const PageDateNavigator = ({
  entryDate,
  label,
  onChange,
}: PageDateNavigatorProps): React.JSX.Element => {
  // 前一天日期，供左侧切换按钮使用。
  const previousDate = shiftEntryDate(entryDate, -1);
  // 后一天日期，供右侧切换按钮使用。
  const nextDate = shiftEntryDate(entryDate, 1);

  return (
    <div className="flex items-center justify-between rounded-[6px] border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/30">
          {label}
        </p>
        <p className="text-sm font-semibold text-white/88">
          {formatEntryDateLabel(entryDate)}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <IconButton
          aria-label={`查看前一天 ${previousDate}`}
          className="h-8 w-8 bg-white/[0.03] text-white/60 hover:bg-white/[0.08] hover:text-white"
          onClick={() => onChange(previousDate)}
        >
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <IconButton
          aria-label={`查看后一天 ${nextDate}`}
          className="h-8 w-8 bg-white/[0.03] text-white/60 hover:bg-white/[0.08] hover:text-white"
          onClick={() => onChange(nextDate)}
        >
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
};
