import type React from "react";
import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import type {
  AiToolStep,
  AiToolStepStatus,
} from "@renderer/features/ai-chat/aiChatMock";

// 工具观察文本最大展示长度。
const TOOL_OBSERVATION_MAX_LENGTH = 96;

// SQL 原始行观察文本匹配规则。
const SQL_RAW_ROWS_OBSERVATION_PATTERN = /^SQL 查询返回 (\d+) 行[：:].*[\[{].*[\]}]/s;

// AI 工具调用块组件属性类型。
type AiToolCallBlockProps = {
  // 工具执行步骤列表。
  steps: AiToolStep[];
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
        label: "工具完成",
        icon: CheckCircle2,
        className: "text-emerald-400",
      };
    case "failed":
      return {
        label: "工具失败",
        icon: XCircle,
        className: "text-red-400",
      };
    case "running":
      return {
        label: "执行中",
        icon: Loader2,
        className: "text-amber-400 animate-spin",
      };
    case "queued":
      return {
        label: "等待中",
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
  const sqlRowsMatch = normalizedObservation.match(SQL_RAW_ROWS_OBSERVATION_PATTERN);

  if (sqlRowsMatch) {
    return `SQL 查询返回 ${sqlRowsMatch[1]} 行，已整理为结构化结果。`;
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
}: AiToolCallBlockProps): React.JSX.Element => {
  return (
    <div className="my-2 flex flex-col gap-3">
      {/* 步骤列表 */}
      <div className="relative flex flex-col gap-5 pl-1">
        {steps.map((step, index) => {
          const config = getStatusConfig(step.status);
          const StatusIcon = config.icon;
          const displayObservation = formatToolObservation(step.observation);

          return (
            <div key={step.id} className="relative flex gap-3.5 items-start">
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
                  <div className="absolute top-3 bottom-[-32px] w-[2px] bg-white/5" />
                )}
              </div>

              {/* 步骤详细内容 */}
              <div className="flex-1 min-w-0 flex flex-col gap-1 pt-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-white/85">
                    {step.title}
                  </span>
                  <span className="rounded-[6px] border border-white/5 bg-white/[0.02] px-1.5 py-0.5 text-xs font-mono text-white/45">
                    {step.tool}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-white/45">
                  {displayObservation}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
