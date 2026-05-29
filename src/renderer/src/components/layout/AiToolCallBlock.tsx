import type React from "react";
import { CheckCircle2, CircleDashed, Loader2, Wrench } from "lucide-react";
import type { AiToolStep, AiToolStepStatus } from "@renderer/components/layout/aiChatMock";

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
      return { label: "工具完成", icon: CheckCircle2, className: "text-emerald-400" };
    case "running":
      return { label: "执行中", icon: Loader2, className: "text-amber-400 animate-spin" };
    case "queued":
      return { label: "等待中", icon: CircleDashed, className: "text-white/30" };
  }
};

/**
 * AiToolCallBlock - 渲染 ReAct 风格的工具执行摘要
 */
export const AiToolCallBlock = ({ steps }: AiToolCallBlockProps): React.JSX.Element => {
  return (
    <div className="my-3 rounded-[6px] border border-white/10 bg-black/25 p-3 flex flex-col gap-3">
      {/* 头部标题与 Wrench 图标 */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <Wrench className="h-3.5 w-3.5 text-white/50" />
        <span className="text-xs font-bold tracking-wider text-white/70 font-mono">
          ReAct 执行摘要
        </span>
      </div>

      {/* 步骤列表 */}
      <div className="flex flex-col gap-3">
        {steps.map((step) => {
          const config = getStatusConfig(step.status);
          const StatusIcon = config.icon;

          return (
            <div
              key={step.id}
              className="flex flex-col gap-1.5 border-l-2 border-white/10 pl-3 last:border-0 last:pb-0"
            >
              {/* 步骤基本信息与状态 */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white/80">{step.title}</span>
                  <span className="rounded-[6px] border border-white/5 bg-white/[0.02] px-1.5 py-0.5 text-[10px] font-mono text-white/45">
                    {step.tool}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <StatusIcon className={`h-3 w-3 ${config.className}`} />
                  <span className={`text-[10px] font-mono leading-none ${config.className}`}>
                    {config.label}
                  </span>
                </div>
              </div>

              {/* 执行结果观察摘要 */}
              <p className="text-[11px] leading-relaxed text-white/45">
                {step.observation}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
