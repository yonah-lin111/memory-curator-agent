import type React from "react";
import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import type {
  AiToolStep,
  AiToolStepStatus,
} from "@renderer/features/ai-chat/types";
import {
  AiAskRequestPanel,
  isAiAskRequest,
} from "@renderer/features/ai-chat/components/AiAskRequestPanel";

// 工具观察文本最大展示长度。
const TOOL_OBSERVATION_MAX_LENGTH = 96;

// SQL 原始行观察文本匹配规则。
const SQL_RAW_ROWS_OBSERVATION_PATTERN =
  /^SQL query returned (\d+) rows?[：:].*[\[{].*[\]}]/s;

// SQL 结果汇总观察文本匹配规则。
const SQL_SUMMARY_OBSERVATION_PATTERN =
  /^SQL query returned (\d+) rows?[,.]\s*Structured data has been returned\.$/;

// AI 工具调用块组件属性类型。
type AiToolCallBlockProps = {
  // 工具执行步骤列表。
  steps: AiToolStep[];
  // 发送 Ask 回答回调。
  onSendMessage?: (text: string) => void;
};

// 根据工具步骤状态返回状态展示配置。
const getStatusConfig = (
  status: AiToolStepStatus,
): {
  // 状态显示文本。
  label: string;
  // 状态图标组件。
  icon: React.ComponentType<{ className?: string }>;
  // 状态样式类名。
  className: string;
} => {
  switch (status) {
    case "done":
      return {
        label: "Tool completed",
        icon: CheckCircle2,
        className: "text-emerald-400",
      };
    case "failed":
      return {
        label: "Tool failed",
        icon: XCircle,
        className: "text-red-400",
      };
    case "running":
      return {
        label: "Running",
        icon: Loader2,
        className: "text-amber-400 animate-spin",
      };
    case "queued":
      return {
        label: "Queued",
        icon: CircleDashed,
        className: "text-white/30",
      };
  }
};

/**
 * formatToolObservation - 将工具原始观察压缩成用户可读摘要。
 */
const formatToolObservation = (observation: string): string => {
  const normalizedObservation = observation.trim();
  const sqlRowsMatch = normalizedObservation.match(
    SQL_RAW_ROWS_OBSERVATION_PATTERN,
  );

  if (sqlRowsMatch) {
    const rowCount = Number(sqlRowsMatch[1]);
    const rowLabel = rowCount === 1 ? "row" : "rows";
    return `SQL query returned ${sqlRowsMatch[1]} ${rowLabel} and was normalized as structured results.`;
  }

  const sqlSummaryMatch = normalizedObservation.match(
    SQL_SUMMARY_OBSERVATION_PATTERN,
  );
  if (sqlSummaryMatch) {
    const rowCount = Number(sqlSummaryMatch[1]);
    const rowLabel = rowCount === 1 ? "row" : "rows";
    return `SQL query returned ${sqlSummaryMatch[1]} ${rowLabel}.`;
  }

  if (normalizedObservation === "SQL query returned no rows.") {
    return "SQL query returned no rows.";
  }

  if (normalizedObservation.length <= TOOL_OBSERVATION_MAX_LENGTH) {
    return normalizedObservation;
  }

  return `${normalizedObservation.slice(0, TOOL_OBSERVATION_MAX_LENGTH)}...`;
};

/**
 * AiToolCallBlock - 渲染 ReAct 风格的工具执行摘要
 */
export const AiToolCallBlock = ({
  steps,
  onSendMessage,
}: AiToolCallBlockProps): React.JSX.Element => {
  return (
    <div className="my-0.5 flex flex-col gap-2">
      {/* 步骤列表 */}
      <div className="relative flex flex-col gap-3 pl-1">
        {steps.map((step, index) => {
          const config = getStatusConfig(step.status);
          const StatusIcon = config.icon;
          const displayObservation = formatToolObservation(step.observation);
          const askRequest = isAiAskRequest(step.data) ? step.data : null;

          return (
            <div key={step.id} className="relative flex gap-2.5 items-start">
              {/* 时间轴节点列 */}
              <div className="relative flex flex-col items-center flex-shrink-0 w-6 self-stretch">
                <div
                  aria-label={config.label}
                  className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#212121] border border-white/10"
                >
                  <StatusIcon className={`h-3 w-3 ${config.className}`} />
                </div>
                {/* 穿透节点中心的连接线：从当前节点中心延伸至下一节点中心 */}
                {index < steps.length - 1 && (
                  <div className="absolute top-3 bottom-[-24px] w-[2px] bg-white/5" />
                )}
              </div>

              {/* 步骤详细内容 */}
              <div className="flex-1 min-w-0 flex flex-col gap-0.5 ">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-white/85 font-mono">
                    {step.tool}
                  </span>
                </div>

                <div className="flex items-start gap-1 text-xs leading-relaxed text-white/45">
                  <span className="inline-flex items-center justify-center w-3 h-[1.625em] flex-shrink-0 select-none">
                    <svg
                      className="w-3 h-3 stroke-current"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M3 1v5h7"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="flex-1">{displayObservation}</span>
                </div>
                {askRequest && onSendMessage ? (
                  <div className="pt-1.5">
                    <AiAskRequestPanel
                      request={askRequest}
                      onSubmit={onSendMessage}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
