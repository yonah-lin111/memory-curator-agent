import React, { useLayoutEffect, useState, useRef } from "react";
import { ChevronDown, Workflow } from "lucide-react";

// 连续执行片段。
export type ExecutionSequencePart =
  | {
      // 片段唯一标识。
      id: string;
      // 片段类型。
      kind: "tool" | "reasoning";
      // 交互型工具是否仍待用户处理。
      isInteractionPending?: boolean;
    }
  | {
      // 片段唯一标识。
      id: string;
      // 文本是执行分组边界。
      kind: "text";
    };

// 连续执行分组。
export type ExecutionGroup = {
  // 分组唯一标识。
  id: string;
  // 分组内执行片段。
  parts: Extract<ExecutionSequencePart, { kind: "tool" | "reasoning" }>[];
  // 后方是否紧邻另一个执行片段。
  connectsToNextExecution: boolean;
};

// 执行分组或文本边界。
export type ExecutionSequenceGroup =
  | { kind: "text"; id: string }
  | { kind: "execution"; group: ExecutionGroup };

/**
 * 按真实输出顺序分组连续 tool/reasoning，文本和待交互工具均构成硬边界。
 */
export const groupExecutionParts = (
  parts: ExecutionSequencePart[],
): ExecutionSequenceGroup[] => {
  const groups: ExecutionSequenceGroup[] = [];
  let current: ExecutionGroup | null = null;

  const flush = (): void => {
    if (current) {
      groups.push({ kind: "execution", group: current });
      current = null;
    }
  };

  parts.forEach((part, index) => {
    if (part.kind === "text") {
      flush();
      groups.push({ kind: "text", id: part.id });
      return;
    }

    if (part.isInteractionPending) {
      flush();
      groups.push({
        kind: "execution",
        group: {
          id: part.id,
          parts: [part],
          connectsToNextExecution: parts[index + 1]?.kind === "tool" || parts[index + 1]?.kind === "reasoning",
        },
      });
      return;
    }

    if (!current) {
      current = {
        id: part.id,
        parts: [part],
        connectsToNextExecution: false,
      };
    } else {
      current.parts.push(part);
    }

    current.connectsToNextExecution =
      parts[index + 1]?.kind === "tool" || parts[index + 1]?.kind === "reasoning";
  });

  flush();
  return groups;
};

// 执行分组组件属性类型。
type ExecutionGroupBlockProps = {
  // 执行分组。
  group: ExecutionGroup;
  // 是否正在生成。
  isGenerating?: boolean;
  // 渲染单个执行片段。
  renderPart: (part: ExecutionGroup["parts"][number], connectsToNextExecution: boolean) => React.JSX.Element;
  // 展开折叠回调。
  onToggle?: () => void;
};

/**
 * ExecutionGroupBlock - 渲染连续执行片段的摘要和可折叠内容。
 */
export const ExecutionGroupBlock = ({
  group,
  isGenerating = false,
  renderPart,
  onToggle,
}: ExecutionGroupBlockProps): React.JSX.Element => {
  const isCollapsible = group.parts.length >= 2;
  const [isExpanded, setIsExpanded] = useState(isGenerating);
  // 引用真实容器以动态获取高度并保留折叠展开动画。
  const innerRef = useRef<HTMLDivElement>(null);
  // 缓存真实内容高度，避免子卡片展开或流式内容追加导致高度过期被裁切的问题。
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  // 仅首次展开或收起使用高度过渡，内容尺寸变化时即时更新。
  const [isAnimating, setIsAnimating] = useState(false);

  useLayoutEffect(() => {
    if (isGenerating) {
      setIsExpanded(true);
    }
  }, [isGenerating]);

  useLayoutEffect(() => {
    const element = innerRef.current;
    if (!element) {
      return;
    }

    if (!isExpanded) {
      setContentHeight(0);
      setIsAnimating(true);
      const timer = window.setTimeout(() => setIsAnimating(false), 250);
      return () => window.clearTimeout(timer);
    }

    setContentHeight(element.scrollHeight);
    setIsAnimating(true);
    const timer = window.setTimeout(() => setIsAnimating(false), 250);
    const observer = new ResizeObserver(() => {
      setContentHeight(element.scrollHeight);
    });
    observer.observe(element);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [isExpanded]);


  if (!isCollapsible) {
    return renderPart(group.parts[0], group.connectsToNextExecution);
  }

  const toolCount = group.parts.filter((part) => part.kind === "tool").length;
  const reasoningCount = group.parts.filter((part) => part.kind === "reasoning").length;

  return (
    <div className="flex w-full gap-2.5 pl-1 my-1.5">
      {/* 维持时间轴视觉，包含专属图标与连接线 */}
      <div className="relative flex w-6 flex-col items-center self-stretch shrink-0">
        <Workflow className="relative z-10 h-[15px] w-[15px] text-white/50" />
        {group.connectsToNextExecution && (
          <div
            aria-hidden="true"
            className="absolute top-[7.5px] bottom-[-24px] w-[2px] bg-white/5"
          />
        )}
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <button
          type="button"
          className="flex h-5 w-fit items-center gap-1 rounded-[6px] bg-[#212121] pr-2 text-xs text-white/50 transition-all duration-200 hover:bg-[#212121]/80 hover:text-white/70 outline-none focus:outline-none border-none cursor-pointer select-none"
          onClick={() => {
            setIsExpanded((previous) => !previous);
            onToggle?.();
          }}
          aria-expanded={isExpanded}
        >
          <span>工具调用 {toolCount} 个，思考 {reasoningCount} 次</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`}
          />
        </button>
        <div
          style={{
            maxHeight: isExpanded
              ? contentHeight !== null
                ? `${contentHeight}px`
                : `${innerRef.current?.scrollHeight || 0}px`
              : "0px",
            opacity: isExpanded ? 1 : 0,
            transition: isAnimating
              ? "max-height 0.25s cubic-bezier(0.2,0.85,0.2,1), opacity 0.25s cubic-bezier(0.2,0.85,0.2,1)"
              : "opacity 0.25s cubic-bezier(0.2,0.85,0.2,1)",
          }}
          className="overflow-hidden"
        >
          <div ref={innerRef} className="flex flex-col gap-1.5">
            {group.parts.map((part, index) =>
              renderPart(part, index < group.parts.length - 1 || group.connectsToNextExecution),
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
