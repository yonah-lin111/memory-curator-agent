import React, { useState, useRef } from "react";
import { ChevronDown, Brain } from "lucide-react";
import { MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";

// AI 思考块组件属性类型。
type CuratorThinkingBlockProps = {
  // Markdown 思考内容。
  content: string;
  // 是否正在生成中。
  isGenerating?: boolean;
  // 点击折叠展开时的回调。
  onToggle?: () => void;
  // 后一紧邻执行节点存在时显示出站时间轴连接线。
  connectsToNextExecution?: boolean;
};

/**
 * CuratorThinkingBlock - 使用 Markdown 预览渲染模型思考内容。
 * 支持点击折叠/展开，并提供流式生成动画指示，且高度折叠/展开具有平滑过渡。
 */
export const CuratorThinkingBlock = ({
  content,
  isGenerating = false,
  onToggle,
  connectsToNextExecution = false,
}: CuratorThinkingBlockProps): React.JSX.Element => {
  // 是否展开思考内容。
  const [isExpanded, setIsExpanded] = useState(false);
  // 思考内容内部容器引用，用于测量真实自适应高度。
  const innerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex w-full gap-2.5 pl-1 my-1.5">
      {/* 固定按钮高度，避免字体行高改变节点中心位置。 */}
      <div className="relative flex w-6 flex-col items-center self-stretch shrink-0">
        <Brain className="relative z-10 h-[15px] w-[15px] text-white/50" />
        {connectsToNextExecution && (
          <div
            aria-hidden="true"
            className="absolute top-[7.5px] bottom-[-24px] w-[2px] bg-white/5"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {/* 折叠/展开控制头部 */}
        <button
          type="button"
          className="flex h-5 items-center gap-1 cursor-pointer text-xs select-none pr-2 rounded-[6px] bg-[#212121] text-white/50 hover:bg-[#212121]/80 hover:text-white/70 transition-all duration-200 w-fit outline-none focus:outline-none border-none"
          onClick={() => {
            setIsExpanded((prev) => !prev);
            onToggle?.();
          }}
          aria-expanded={isExpanded}
        >
          <span>{isGenerating ? "Thinking" : "Thought Process"}</span>
          {isGenerating && (
            <span className="flex h-1.5 w-1.5 relative ml-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white/50" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isExpanded ? "" : "-rotate-90"
            }`}
          />
        </button>

        {/* 展开的思考内容区域，带平滑高度与透明度过渡 */}
        <div
          style={{
            maxHeight: isExpanded ? `${innerRef.current?.scrollHeight || 1000}px` : "0px",
            opacity: isExpanded ? 1 : 0,
            transition: "max-height 0.25s cubic-bezier(0.2, 0.85, 0.2, 1), opacity 0.25s cubic-bezier(0.2, 0.85, 0.2, 1)",
          }}
          className="overflow-hidden"
        >
          <div
            ref={innerRef}
            className="flex items-start gap-1 text-white/50 select-text max-w-full curator-thinking-block markdown-preview-container pl-1"
            data-testid="curator-thinking-block"
            style={{ fontSize: "13px" }}
          >
            <div className="flex-1 min-w-0">
              <MdPreview
                theme="dark"
                modelValue={content}
                previewTheme="default"
                codeTheme="atom"
                style={{ backgroundColor: "transparent" }}
                // 思考流式输出时不折叠代码块，避免用户看到突然跳变的代码区域。
                autoFoldThreshold={isGenerating ? Infinity : 0}
                showCodeRowNumber={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
