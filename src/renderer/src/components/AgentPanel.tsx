import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  History,
  Layers,
  CheckSquare,
  FileText,
  BookOpen,
} from "lucide-react";

/* ==========================================
 * TS 类型定义 (Interfaces & Types)
 * ========================================== */

// 输入归类建议类型，描述 Agent 对当日输入内容的轻量分类建议。
type ClassificationSuggestion = {
  // 唯一标识。
  id: string;
  // 被识别出来的原文片段。
  sourceText: string;
  // 建议分配的类型。
  suggestedType: "todo" | "note" | "journal";
  // 建议原因或依据。
  reason: string;
  // 建议倾向置信度或标签。
  confidence: string;
};

// 关联记忆线索类型，描述今日内容激活的过去记忆。
type RelatedMemoryClue = {
  // 唯一标识。
  id: string;
  // 关联的历史记忆标题。
  title: string;
  // 历史记忆发生日期。
  date: string;
  // 关联的潜在共鸣原因。
  resonance: string;
  // 计算的静态语义相似度。
  similarity: number;
};

// 长期主题线索类型，描述对长期生活/技术线的映射。
type ThemeClue = {
  // 唯一标识。
  id: string;
  // 长期追踪的主题名称。
  name: string;
  // 今日内容对该主题的贡献或触发。
  trigger: string;
  // 主题当前策展状态。
  status: "活跃中" | "有积累" | "待检视";
};

// AgentPanel 组件属性类型，描述右侧策展栏折叠状态与切换入口。
type AgentPanelProps = {
  // 当前右侧策展栏是否处于折叠状态。
  isCollapsed: boolean;
  // 右侧策展栏折叠状态改变回调。
  onCollapsedChange: (collapsed: boolean) => void;
};

// 右侧策展栏最小宽度，对应当前默认宽度。
const AGENT_PANEL_MIN_WIDTH = 360;

// 右侧策展栏最大宽度比例。
const AGENT_PANEL_MAX_WIDTH_RATIO = 0.35;

// 长按进入拖拽调宽的延迟毫秒数。
const RESIZE_LONG_PRESS_DELAY = 260;

// 右侧栏拖拽过程中的快照类型。
type ResizeSnapshot = {
  // 拖拽起点横坐标。
  startX: number;
  // 拖拽开始时右侧栏宽度。
  startWidth: number;
  // 是否已经越过长按阈值并进入调宽状态。
  isResizing: boolean;
};

/* ==========================================
 * 静态 Mock 数据 (Static Mock Data)
 * ========================================== */

// Agent 智能归类拆分建议静态列表（均添加 id 保证 key 稳定）。
const CLASSIFICATIONS: ClassificationSuggestion[] = [
  {
    id: "c1",
    sourceText: "修复渲染层 TypeScript 编译错误与 Lint 规范冲突...",
    suggestedType: "todo",
    reason: "识别出明显的行动化语义，建议补充进 16:30 待办计划。",
    confidence: "建议归类",
  },
  {
    id: "c2",
    sourceText: "今天上海又下了小雨。在写完了 Today 工作台的布局后...",
    suggestedType: "journal",
    reason: "含有高浓度环境描绘与主观隐喻，建议无损归档至日记时间线。",
    confidence: "待复核",
  },
  {
    id: "c3",
    sourceText: "本地持久化方案表现...",
    suggestedType: "note",
    reason: "属于结构化的技术经验与性能评估，建议沉淀为自由笔记。",
    confidence: "线索",
  },
];

// 历史相似记忆关联线索静态列表（均添加 id 保证 key 稳定）。
const RELATED_MEMORIES: RelatedMemoryClue[] = [
  {
    id: "rm1",
    title: "关于本地文件存储架构的多维度评测与基准设计",
    date: "2026-03-12",
    resonance:
      "今日提到的本地文件存取性能与三月份多维检索承载模型存在架构设计承接。",
    similarity: 88,
  },
  {
    id: "rm2",
    title: "在雨天独自重构 Electron 主渲染进程事件桥接的随笔",
    date: "2025-11-20",
    resonance:
      "小雨天气及独立写布局的感受，与去年深夜重构时的情绪轨迹存在可复核关联线索。",
    similarity: 74,
  },
];

// 长期追踪主题线索静态列表（均添加 id 保证 key 稳定）。
const THEME_CLUES: ThemeClue[] = [
  {
    id: "th1",
    name: "本地优先架构演进",
    trigger: "积累了关于本地文件存储性能及本地存取在桌面端落地的技术实践。",
    status: "活跃中",
  },
  {
    id: "th2",
    name: "数字海马体哲学思考",
    trigger: "再次探讨了“信息遗忘与主动策展”对于记忆高信噪比的核心重要性。",
    status: "有积累",
  },
  {
    id: "th3",
    name: "无感隐私保护设计",
    trigger: "今日针对主观文字段落进行细致的安全边界核对，契合长期安全主题。",
    status: "待检视",
  },
];

/**
 * 获取右侧策展栏最大宽度。
 * 小视口下确保最大宽度不低于最小宽度，避免上下限倒挂。
 */
const getAgentPanelMaxWidth = (): number => {
  return Math.max(
    AGENT_PANEL_MIN_WIDTH,
    Math.round(window.innerWidth * AGENT_PANEL_MAX_WIDTH_RATIO),
  );
};

/**
 * 将宽度限制在右侧策展栏允许范围内。
 */
const clampAgentPanelWidth = (width: number): number => {
  return Math.min(
    Math.max(width, AGENT_PANEL_MIN_WIDTH),
    getAgentPanelMaxWidth(),
  );
};

/**
 * AgentPanel 组件 - 负责右侧 Agent 策展栏。
 * 仅提供侧栏折叠交互，其余归类、历史关联与长期主题线索保持静态展示。
 */
export const AgentPanel = ({
  isCollapsed,
  onCollapsedChange,
}: AgentPanelProps): React.JSX.Element => {
  // 右侧策展栏当前宽度，默认即最小宽度。
  const [panelWidth, setPanelWidth] = useState<number>(AGENT_PANEL_MIN_WIDTH);
  // 长按计时器引用。
  const longPressTimerRef = useRef<number | null>(null);
  // 拖拽调宽过程快照引用。
  const resizeSnapshotRef = useRef<ResizeSnapshot | null>(null);
  // 是否需要忽略拖拽结束后的合成点击。
  const shouldIgnoreClickRef = useRef<boolean>(false);

  /**
   * 取消尚未触发的长按计时器。
   */
  const clearLongPressTimer = (): void => {
    if (longPressTimerRef.current === null) {
      return;
    }

    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  /**
   * 结束右侧栏拖拽调宽流程。
   */
  const stopPanelResize = (): void => {
    clearLongPressTimer();

    if (resizeSnapshotRef.current?.isResizing) {
      shouldIgnoreClickRef.current = true;
    }

    resizeSnapshotRef.current = null;
    document.body.style.cursor = "";
  };

  /**
   * 根据指针位置更新右侧栏宽度。
   */
  const handlePanelResizeMove = (event: PointerEvent): void => {
    const resizeSnapshot = resizeSnapshotRef.current;

    if (!resizeSnapshot?.isResizing) {
      return;
    }

    // 右侧栏左边缘向左拖动为扩大，向右拖动为缩小。
    const nextWidth =
      resizeSnapshot.startWidth + resizeSnapshot.startX - event.clientX;
    setPanelWidth(clampAgentPanelWidth(nextWidth));
  };

  /**
   * 监听全局指针移动与释放，确保拖出按钮后仍能调宽。
   */
  useEffect(() => {
    window.addEventListener("pointermove", handlePanelResizeMove);
    window.addEventListener("pointerup", stopPanelResize);
    window.addEventListener("pointercancel", stopPanelResize);

    return () => {
      window.removeEventListener("pointermove", handlePanelResizeMove);
      window.removeEventListener("pointerup", stopPanelResize);
      window.removeEventListener("pointercancel", stopPanelResize);
      clearLongPressTimer();
      document.body.style.cursor = "";
    };
  });

  /**
   * 处理右侧按钮按下：短按折叠，长按进入宽度拖拽。
   */
  const handleRightControlPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ): void => {
    if (isCollapsed) {
      return;
    }

    resizeSnapshotRef.current = {
      startX: event.clientX,
      startWidth: panelWidth,
      isResizing: false,
    };
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      if (resizeSnapshotRef.current === null) {
        return;
      }

      resizeSnapshotRef.current = {
        ...resizeSnapshotRef.current,
        isResizing: true,
      };
      document.body.style.cursor = "ew-resize";
    }, RESIZE_LONG_PRESS_DELAY);
  };

  /**
   * 处理右侧按钮点击：普通点击折叠，被拖拽消费的点击则忽略。
   */
  const handleRightControlClick = (): void => {
    if (shouldIgnoreClickRef.current) {
      shouldIgnoreClickRef.current = false;
      return;
    }

    onCollapsedChange(!isCollapsed);
  };

  return (
    <div className="relative flex h-auto lg:h-full flex-shrink-0">
      <aside
        aria-label="右侧策展栏"
        style={isCollapsed ? undefined : { width: `${panelWidth}px` }}
        className={`w-full h-auto lg:h-full flex flex-col gap-3 flex-shrink-0 overflow-hidden select-none transition-all duration-300 ease-in-out ${
          isCollapsed ? "lg:w-16 items-center" : ""
        }`}
      >
        {isCollapsed ? (
          <div className="flex h-full w-full flex-col items-center justify-between rounded-[6px] border border-white/5 bg-[#212121] p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-white/10 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex -rotate-90 whitespace-nowrap text-xs font-mono tracking-widest text-white/30">
              AGENT CURATION
            </div>
            <div className="h-10 w-10" />
          </div>
        ) : (
          <>
            {/* 顶部标题 */}
            <header className="flex flex-col gap-1 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-white/40">
                <Sparkles className="h-3.5 w-3.5 text-white/40" />
                <span>AGENT CURATION</span>
              </div>
              <h2 className="text-lg font-bold tracking-tight text-white">
                建议、归类与记忆线索
              </h2>
            </header>

            {/* 滚动内容区（桌面端独立滚动，移动端顺序自流式排版） */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-3">
              {/* 1. 输入归类建议（已移除 HelpCircle tooltip，直接增加可访问静态说明） */}
              <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3 flex-shrink-0">
                <div className="flex flex-col border-b border-white/5 pb-2">
                  <span className="text-sm font-bold tracking-wide text-white/80">
                    今日捕获片段归类建议
                  </span>
                  <span className="text-xs text-white/30 mt-0.5 font-medium leading-normal">
                    （依据本地预设规则占位匹配而成的辅助建议）
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {CLASSIFICATIONS.map((cl) => {
                    const TypeIcon =
                      cl.suggestedType === "todo"
                        ? CheckSquare
                        : cl.suggestedType === "journal"
                          ? BookOpen
                          : FileText;
                    const TypeLabel =
                      cl.suggestedType === "todo"
                        ? "待办"
                        : cl.suggestedType === "journal"
                          ? "日记"
                          : "随记";

                    return (
                      <div
                        key={cl.id}
                        className="flex flex-col gap-1.5 rounded-[6px] bg-white/[0.01] border border-white/5 p-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/40 truncate max-w-[200px] font-mono">
                            "{cl.sourceText}"
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="rounded-[6px] bg-white/5 px-1.5 py-0.5 text-xs text-white/40 font-mono">
                              {cl.confidence}
                            </span>
                            <span className="flex items-center gap-1 rounded-[6px] bg-white/10 px-1.5 py-0.5 text-xs text-white font-medium">
                              <TypeIcon className="h-2.5 w-2.5" />
                              {TypeLabel}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-white/60 leading-normal">
                          {cl.reason}
                        </p>
                        {/* 已修正假交互：从 button 变更为静态提示 badge */}
                        <div className="flex justify-end mt-0.5">
                          <span className="text-xs font-medium text-white/20 bg-white/5 rounded-[6px] px-2 py-0.5">
                            静态参考占位
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. 相似历史记忆关联线索 */}
              <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3 flex-shrink-0">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-white/60" />
                    <span className="text-sm font-bold tracking-wide text-white/80">
                      关联记忆共鸣线索
                    </span>
                  </div>
                  <span className="text-xs text-white/30 font-mono">
                    2条关联
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {RELATED_MEMORIES.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-col gap-1 rounded-[6px] bg-white/[0.01] border border-white/5 p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-white/80 truncate">
                          {m.title}
                        </h4>
                        <span className="text-xs font-mono text-emerald-400 flex-shrink-0">
                          {m.similarity}% 关联
                        </span>
                      </div>
                      <div className="text-xs text-white/30 font-mono">
                        记录日期: {m.date}
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed mt-1">
                        {m.resonance}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. 长期主题线索映射 */}
              <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3 flex-shrink-0">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-white/60" />
                    <span className="text-sm font-bold tracking-wide text-white/80">
                      长期主题线索追踪
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {THEME_CLUES.map((theme) => {
                    const statusColor =
                      theme.status === "活跃中"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : theme.status === "有积累"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "bg-white/5 text-white/40 border border-white/10";

                    return (
                      <div
                        key={theme.id}
                        className="flex flex-col gap-1.5 rounded-[6px] bg-white/[0.01] border border-white/5 p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-white/80">
                            {theme.name}
                          </span>
                          <span
                            className={`rounded-[6px] px-1.5 py-0.5 text-xs font-mono ${statusColor}`}
                          >
                            {theme.status}
                          </span>
                        </div>
                        <p className="text-xs text-white/50 leading-relaxed">
                          {theme.trigger}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. 隐私防线与边界核查说明 */}
              <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-2.5 flex-shrink-0 mb-1">
                <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white/80">
                    本地安全与隐私边界
                  </span>
                </div>
                <p className="text-xs text-white/40 leading-relaxed">
                  AEON 当前处于
                  <strong className="text-white/60">本地记录结构</strong>
                  架构下运行。在进行未来外部分析前，计划展示需要核对的数据范围，由您确认后发送。
                </p>
              </div>
            </div>
          </>
        )}
      </aside>

      <button
        type="button"
        aria-label={isCollapsed ? "展开右侧策展栏" : "折叠右侧策展栏"}
        onPointerDown={handleRightControlPointerDown}
        onClick={handleRightControlClick}
        className="absolute top-1/2 left-0 z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#212121] text-white/75 shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-200 cursor-ew-resize focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
      >
        {isCollapsed ? (
          <ChevronLeft className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>
    </div>
  );
};
