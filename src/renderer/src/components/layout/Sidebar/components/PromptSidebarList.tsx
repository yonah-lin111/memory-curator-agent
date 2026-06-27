import type React from "react";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  cardTypeMeta,
  iconMap,
  type PromptCardType,
} from "@/features/prompt-design/components/PromptNode";

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
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    nodeType: PromptCardType,
  ) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  if (isCollapsed) {
    const connectedTypesAll = Object.entries(cardTypeMeta).filter(
      ([_, meta]) => !meta.isIndependent
    ) as [PromptCardType, (typeof cardTypeMeta)[PromptCardType]][];

    const independentTypesAll = Object.entries(cardTypeMeta).filter(
      ([_, meta]) => meta.isIndependent
    ) as [PromptCardType, (typeof cardTypeMeta)[PromptCardType]][];

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

        <div 
          className="flex-1 w-full overflow-y-auto flex flex-col items-center gap-3 pb-4 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {connectedTypesAll.map(([type, meta]) => (
            <Tooltip key={type} content={meta.label} placement="right">
              <div
                className="w-9 h-9 flex-shrink-0 cursor-grab active:cursor-grabbing rounded-[6px] transition-colors hover:bg-white/[0.02]"
                draggable
                onDragStart={(e) => onDragStart(e, type)}
              >
                <div
                  className={`w-full h-full ${meta.color} bg-opacity-10 border border-white/10 rounded-[6px] flex items-center justify-center`}
                >
                  {iconMap[meta.defaultIcon] || (
                    <div className="w-4 h-4 bg-white/20 rounded-full" />
                  )}
                </div>
              </div>
            </Tooltip>
          ))}

          <div className="w-4 h-[1px] bg-white/10 my-1 flex-shrink-0" />

          {independentTypesAll.map(([type, meta]) => (
            <Tooltip key={type} content={meta.label} placement="right">
              <div
                className="w-9 h-9 flex-shrink-0 cursor-grab active:cursor-grabbing rounded-[6px] transition-colors hover:bg-white/[0.02]"
                draggable
                onDragStart={(e) => onDragStart(e, type)}
              >
                <div
                  className={`w-full h-full ${meta.color} bg-opacity-10 border border-white/10 rounded-[6px] flex items-center justify-center`}
                >
                  {iconMap[meta.defaultIcon] || (
                    <div className="w-4 h-4 bg-white/20 rounded-full" />
                  )}
                </div>
              </div>
            </Tooltip>
          ))}
        </div>
      </div>
    );
  }

  // 按类型和搜索关键字过滤显示
  const keyword = searchKeyword.trim().toLowerCase();

  const connectedTypes = Object.entries(cardTypeMeta).filter(
    ([_, meta]) =>
      !meta.isIndependent &&
      (meta.label.toLowerCase().includes(keyword) ||
        _.toLowerCase().includes(keyword)),
  ) as [PromptCardType, (typeof cardTypeMeta)[PromptCardType]][];

  const independentTypes = Object.entries(cardTypeMeta).filter(
    ([_, meta]) =>
      meta.isIndependent &&
      (meta.label.toLowerCase().includes(keyword) ||
        _.toLowerCase().includes(keyword)),
  ) as [PromptCardType, (typeof cardTypeMeta)[PromptCardType]][];

  return (
    <div
      className="flex h-full w-full flex-col gap-4"
      aria-label="Prompt design components"
      aria-hidden={ariaHidden}
    >
      {/* 顶部标题与折叠按钮 */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <Tooltip content="收起" placement="right">
          <IconButton
            aria-label="Collapse sidebar"
            onClick={() => onCollapsedChange?.(true)}
          >
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
        </Tooltip>
      </div>

      {/* 搜索框 */}
      <div className="relative px-1">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
        <input
          type="text"
          placeholder="搜索组件..."
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          className="w-full rounded-[6px] border border-white/5 bg-white/[0.02] py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/20 outline-none focus:border-white/15"
        />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4 flex flex-col gap-6 px-1">
        {/* 连线组件 */}
        {connectedTypes.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">
              流程卡片
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {connectedTypes.map(([type, meta]) => (
                <div
                  key={type}
                  className="w-full text-left flex items-center gap-3 p-2.5 rounded-[6px] transition-all duration-150 group hover:bg-white/[0.02] text-white/70 cursor-grab active:cursor-grabbing border border-transparent"
                  draggable
                  onDragStart={(e) => onDragStart(e, type)}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className={`w-9 h-9 ${meta.color} bg-opacity-10 border border-white/10 rounded-[6px] flex items-center justify-center`}
                    >
                      {iconMap[meta.defaultIcon] || (
                        <div className="w-4 h-4 bg-white/20 rounded-full" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-xs font-bold truncate text-white/90 group-hover:text-white">
                      {meta.label}
                    </span>
                    <span className="text-xs text-white/40 truncate group-hover:text-white/65 font-mono">
                      {type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 独立组件 */}
        {independentTypes.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">
              独立卡片
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {independentTypes.map(([type, meta]) => (
                <div
                  key={type}
                  className="w-full text-left flex items-center gap-3 p-2.5 rounded-[6px] transition-all duration-150 group hover:bg-white/[0.02] text-white/70 cursor-grab active:cursor-grabbing border border-transparent"
                  draggable
                  onDragStart={(e) => onDragStart(e, type)}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className={`w-9 h-9 ${meta.color} bg-opacity-10 border border-white/10 rounded-[6px] flex items-center justify-center`}
                    >
                      {iconMap[meta.defaultIcon] || (
                        <div className="w-4 h-4 bg-white/20 rounded-full" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-xs font-bold truncate text-white/90 group-hover:text-white">
                      {meta.label}
                    </span>
                    <span className="text-xs text-white/40 truncate group-hover:text-white/65 font-mono">
                      {type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {connectedTypes.length === 0 && independentTypes.length === 0 && (
          <div className="rounded-[6px] border border-white/5 px-3 py-4 text-center text-xs text-white/35 mx-1">
            没有匹配的组件
          </div>
        )}
      </div>
    </div>
  );
};
