import { useCallback, useEffect, useRef, useState } from "react";
import { createTodayEntryDate, shiftEntryDate } from "@/lib/dailyShared";
import { MdEditor, MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";
import "md-editor-rt/lib/style.css";
import { RefreshCw, FileText, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";

// 组件 Props。
interface WeeklySummaryPanelProps {
  // 当前周的起始日期，格式 'YYYY-MM-DD'。
  weekStartDate: string;
  // 本周全部内容是否为空。
  isEmpty?: boolean;
}

// 周度总结项类型（与 preload 对齐）。
type WeeklySummaryItem = {
  id: number;
  weekStartDate: string;
  type: string;
  title: string;
  content: string;
  modelUsed: string | null;
  generatedAt: string;
  isMeaningful: number;
};

// 面板状态类型。
type PanelState = "idle" | "loading" | "streaming" | "done";

/**
 * 统一周度报告面板（个人成长 + 人际关系）。
 * 状态机：idle -> loading -> streaming -> done，支持重新生成与编辑。
 */
export const WeeklySummaryPanel = ({
  weekStartDate,
  isEmpty = false,
}: WeeklySummaryPanelProps) => {
  const [panelState, setPanelState] = useState<PanelState>("loading");
  const [summary, setSummary] = useState<WeeklySummaryItem | null>(null);

  // 流式文本缓存
  const streamTextRef = useRef("");
  const [streamTick, setStreamTick] = useState(0);

  // 编辑状态与内容
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  const rafRef = useRef<number | null>(null);

  /** 跟踪当前周 ID，用于拦截异步回调中的过期结果 */
  const currentWeekRef = useRef(weekStartDate);
  currentWeekRef.current = weekStartDate;

  /** 防止自动生成失败后重复触发的守卫 */
  const autoGenAttemptedRef = useRef(false);
  /** 防止并发生成 */
  const generatingRef = useRef(false);
  /** 触发生成的计数器，每次递增触发一轮新的生成 useEffect */
  const [generationTrigger, setGenerationTrigger] = useState(0);

  // 判断当前选中周是否已经是历史周（即该周的周日已在今天之前）。
  const isHistoricWeek =
    shiftEntryDate(weekStartDate, 6) < createTodayEntryDate();

  // 初始化时加载已有数据
  useEffect(() => {
    if (!weekStartDate) return;

    setPanelState("loading");
    setSummary(null);
    setIsEditing(false);
    autoGenAttemptedRef.current = false;

    const requestedWeek = weekStartDate;

    window.api.weekly!.summary.get(weekStartDate).then((item) => {
      if (currentWeekRef.current !== requestedWeek) return;
      if (item) {
        setSummary(item);
        setPanelState("done");
      } else {
        setPanelState("idle");
      }
    });
  }, [weekStartDate]);

  /**
   * 实际执行生成的 effect，带 IPC 监听器自动清理。
   */
  useEffect(() => {
    if (generationTrigger === 0) return;
    if (generatingRef.current) return;
    generatingRef.current = true;

    setPanelState("loading");
    streamTextRef.current = "";
    setStreamTick(0);

    const genWeek = weekStartDate;

    const unsubDelta = window.api.weekly!.summary.onDelta(({ text }) => {
      if (currentWeekRef.current !== genWeek) return;
      streamTextRef.current += text;
      setPanelState("streaming");
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setStreamTick((t) => t + 1);
        });
      }
    });

    const unsubDone = window.api.weekly!.summary.onDone((item) => {
      if (currentWeekRef.current !== genWeek) return;
      unsubDelta();
      unsubDone();
      generatingRef.current = false;
      setSummary(item);
      setPanelState("done");
    });

    const abortController = new AbortController();

    window.api
      .weekly!.summary.generate({ weekStartDate: genWeek })
      .catch((err) => {
        console.error("周度报告生成失败", err);
      })
      .finally(() => {
        if (generatingRef.current && currentWeekRef.current === genWeek) {
          unsubDelta();
          unsubDone();
          generatingRef.current = false;
          setPanelState((prev) => (prev === "streaming" ? "idle" : prev));
        }
      });

    return () => {
      unsubDelta();
      unsubDone();
      generatingRef.current = false;
      abortController.abort();
    };
  }, [generationTrigger]);

  /**
   * 触发生成（供手动按钮和自动生成共用）。
   */
  const handleGenerate = useCallback(() => {
    if (generatingRef.current) return;
    setGenerationTrigger((t) => t + 1);
  }, []);

  // 历史周无总结且数据非空时，自动静默触发生成。
  useEffect(() => {
    if (
      panelState === "idle" &&
      isHistoricWeek &&
      !isEmpty &&
      !summary &&
      !autoGenAttemptedRef.current
    ) {
      autoGenAttemptedRef.current = true;
      handleGenerate();
    }
  }, [panelState, isHistoricWeek, isEmpty, summary, handleGenerate]);

  /**
   * 保存编辑。
   */
  const handleSaveEdit = async () => {
    if (!summary) return;

    const firstLine = editContent.split("\n")[0] ?? "";
    const title = firstLine.replace(/^#+\s*/, "").trim() || summary.title;
    const updated = await window.api.weekly!.summary.save({
      weekStartDate,
      title,
      content: editContent,
      modelUsed: summary.modelUsed,
      generatedAt: summary.generatedAt,
    });
    setSummary(updated);
    setIsEditing(false);
  };

  /**
   * 删除周度总结及关联主题内容。
   */
  const handleDelete = async () => {
    if (generatingRef.current) return;
    try {
      await window.api.weekly!.summary.delete(weekStartDate);
    } catch {
      // 静默忽略，前端兜底重置状态
    }
    setSummary(null);
    setPanelState("idle");
    setIsEditing(false);
  };

  // 无意义内容时使用前端兜底文案
  const isMeaningful = summary?.isMeaningful !== 0;

  return (
    <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col">
      {/* 标题栏 */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-white/5 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-white/60" />
          <span className="text-sm font-bold tracking-wide text-white/80">
            周度报告
          </span>
        </div>

        {panelState === "done" && !isEditing && (
          <div className="flex items-center gap-2">
            <IconButton
              onClick={() => {
                setEditContent(summary?.content ?? "");
                setIsEditing(true);
              }}
              title="编辑"
              preset="edit"
            ></IconButton>
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
      <div className="flex flex-col min-h-[300px] flex-1">
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

        {(panelState === "streaming" || panelState === "done") &&
          !isEditing && (
            <div
              className="flex-1 overflow-y-auto markdown-preview-container ai-chat-markdown-preview select-text max-w-full"
              data-render-tick={streamTick}
            >
              {panelState === "done" && !isMeaningful ? (
                <p className="text-xs text-white/25 py-8 text-center">
                  本周暂无值得总结的记录。
                </p>
              ) : (
                <MdPreview
                  theme="dark"
                  modelValue={
                    panelState === "streaming"
                      ? streamTextRef.current
                      : (summary?.content ?? "")
                  }
                  previewTheme="default"
                  codeTheme="atom"
                  style={{ backgroundColor: "transparent" }}
                  autoFoldThreshold={panelState === "streaming" ? Infinity : 0}
                  showCodeRowNumber={false}
                />
              )}
              {panelState === "streaming" && (
                <span className="inline-block w-2 h-3 bg-white/40 animate-pulse ml-0.5" />
              )}
            </div>
          )}

        {isEditing && (
          <div className="flex flex-col gap-2 flex-1">
            <MdEditor
              codeTheme="atom"
              language="zh-CN"
              preview
              previewTheme="default"
              showCodeRowNumber
              theme="dark"
              value={editContent}
              onChange={setEditContent}
              style={{ height: "100%" }}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white/70 rounded-[6px] border border-white/10 transition-colors"
              >
                保存
              </button>
            </div>
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
