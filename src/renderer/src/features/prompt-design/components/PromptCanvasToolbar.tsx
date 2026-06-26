import type React from "react";
import { Plus, Trash2, ZoomIn, ZoomOut, Maximize, LayoutTemplate, Download } from "lucide-react";

interface PromptCanvasToolbarProps {
  onAddCard: () => void;
  onClearAll?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onLayout?: () => void;
  onExport?: () => void;
  onDeleteSelected?: () => void;
  zoomPercentage?: number;
}

export const PromptCanvasToolbar = ({
  onAddCard,
  onClearAll,
  onZoomIn,
  onZoomOut,
  onFitView,
  onLayout,
  onExport,
  onDeleteSelected,
  zoomPercentage = 100,
}: PromptCanvasToolbarProps): React.JSX.Element => {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 p-1.5 rounded-[8px] bg-[#212121]/90 backdrop-blur-md border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">

      {/* 添加与删除 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          onClick={onAddCard}
          title="添加卡片"
        >
          <Plus size={16} />
          <span className="font-medium">新建卡片</span>
        </button>
        <button
          type="button"
          className="p-1.5 rounded-[6px] text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          onClick={onDeleteSelected}
          title="删除选中"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="w-[1px] h-4 bg-white/10 mx-1" />

      {/* 视图控制 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="p-1.5 rounded-[6px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          onClick={onZoomOut}
          title="缩小"
        >
          <ZoomOut size={16} />
        </button>
        <span className="w-12 text-center text-[12px] text-white/50 font-mono select-none">
          {Math.round(zoomPercentage)}%
        </span>
        <button
          type="button"
          className="p-1.5 rounded-[6px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          onClick={onZoomIn}
          title="放大"
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          className="p-1.5 rounded-[6px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          onClick={onFitView}
          title="适应画布"
        >
          <Maximize size={16} />
        </button>
      </div>

      <div className="w-[1px] h-4 bg-white/10 mx-1" />

      {/* 布局与导出 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="p-1.5 rounded-[6px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          onClick={onLayout}
          title="自动布局"
        >
          <LayoutTemplate size={16} />
        </button>
        <button
          type="button"
          className="p-1.5 rounded-[6px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          onClick={onExport}
          title="导出配置"
        >
          <Download size={16} />
        </button>
      </div>

    </div>
  );
};
