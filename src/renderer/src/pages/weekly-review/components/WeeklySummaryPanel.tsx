import { useEffect } from "react";
import { RefreshCw, FileText } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useWeeklySummaryGeneration } from "@/pages/weekly-review/hooks/useWeeklySummaryGeneration";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";

// 组件 Props。
interface WeeklySummaryPanelProps {
  // 当前周的起始日期，格式 'YYYY-MM-DD'。
  weekStartDate: string;
  // 本周全部内容是否为空。
  isEmpty?: boolean;
}

/**
 * 统一周度报告面板（个人成长 + 人际关系）。
 * 状态机由按周隔离的生成 store 驱动，支持切周后继续接收原周输出。
 */
export const WeeklySummaryPanel = ({
  weekStartDate,
  isEmpty = false,
}: WeeklySummaryPanelProps) => {
  const {
    panelState,
    summary,
    streamText,
    streamTick,
    generate,
    hydrate,
    reset,
  } = useWeeklySummaryGeneration(weekStartDate);

  // 初始化时加载已有数据
  useEffect(() => {
    if (!weekStartDate) return;

    let isActive = true;

    window.api
      .weekly!.summary.get(weekStartDate)
      .then((item) => {
        if (!isActive) return;
        hydrate(item);
      })
      .catch((err) => {
        console.error("获取周度总结失败", err);
        if (isActive) hydrate(null);
      });

    return () => {
      isActive = false;
    };
  }, [weekStartDate, hydrate]);

  /**
   * 手动触发当前周总结生成。
   */
  const handleGenerate = (): void => {
    generate();
  };

  /**
   * 删除周度总结及关联主题内容。
   */
  const handleDelete = async () => {
    try {
      await window.api.weekly!.summary.delete(weekStartDate);
    } catch {
      // 静默忽略，前端兜底重置状态
    }
    reset();
  };

  // 无意义内容时使用前端兜底文案
  const isMeaningful = summary?.isMeaningful !== 0;

  return (
    <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col h-[89vh]">
      {/* 标题栏 */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-white/5 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-white/60" />
          <span className="text-sm font-bold tracking-wide text-white/80">
            周度报告
          </span>
        </div>

        {panelState === "done" && (
          <div className="flex items-center gap-2">
            <Tooltip
              title="确认重新生成周度报告？"
              onConfirm={handleGenerate}
              placement="bottom"
            >
              <IconButton
                disabled={isEmpty}
                title={isEmpty ? "本周无任何记录，无法重新生成" : "重新生成"}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </IconButton>
            </Tooltip>
            <Tooltip
              title="确认删除本周报告？"
              description="将同时清空报告正文及关联的主题内容"
              onConfirm={handleDelete}
              placement="bottom"
              variant="danger"
            >
              <IconButton title="删除报告" preset="delete"></IconButton>
            </Tooltip>
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div className="flex flex-col min-h-[300px] flex-1 min-h-0">
        {panelState === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-xs text-white/25">
              {isEmpty ? "本周无任何行动、片段或日记记录" : "本周尚无报告"}
            </p>
            <button
              onClick={handleGenerate}
              disabled={isEmpty}
              className={`px-4 py-2 text-xs rounded-[6px] border transition-colors ${
                isEmpty
                  ? "bg-white/0 text-white/10 border-white/5 cursor-not-allowed"
                  : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 border-white/10"
              }`}
              title={isEmpty ? "本周无任何记录，无法生成" : undefined}
            >
              生成周度报告
            </button>
          </div>
        )}

        {panelState === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        {(panelState === "streaming" || panelState === "done") && (
          <div
            className="flex-1 overflow-y-auto markdown-preview-container curator-markdown-preview select-text max-w-full"
            data-render-tick={streamTick}
          >
            {panelState === "done" && !isMeaningful ? (
              <p className="text-xs text-white/25 py-8 text-center">
                本周暂无值得总结的记录。
              </p>
            ) : (
              <MarkdownEditor
                id="weekly-review-summary-editor"
                defaultMode="preview"
                placeholder="暂无周度报告"
                height="100%"
                value={
                  panelState === "streaming"
                    ? streamText
                    : (summary?.content ?? "")
                }
                onChange={() => {}}
              />
            )}
            {panelState === "streaming" && (
              <span className="inline-block w-2 h-3 bg-white/40 animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </div>

      {panelState === "done" && summary && (
        <p className="text-xs text-white/20 text-right">
          {summary.generatedAt} · {summary.modelUsed ?? "未知模型"}
        </p>
      )}
    </div>
  );
};
