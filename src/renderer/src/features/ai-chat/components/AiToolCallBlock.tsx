import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import type {
  AiToolStep,
  AiToolStepStatus,
} from "@/features/ai-chat/types";
import {
  AiAskRequestPanel,
  isAiAskAnswer,
  isAiAskRequest,
  isAiToolConfirmationRequest,
  type AiAskRequest,
  type AiToolConfirmationRequest,
  type AiAskAnswerSubmitPayload,
  type AiToolConfirmationAnswerSubmitPayload,
} from "@/features/ai-chat/components/AiAskRequestPanel";
import { AiToolExplainPreview } from "@/features/ai-chat/components/AiToolExplainPreview";
import { AiToolChangePreview } from "@/features/ai-chat/components/AiToolChangePreview";

// 工具观察文本最大展示长度。
const TOOL_OBSERVATION_MAX_LENGTH = 96;

// Ask 回答后的固定展示摘要。
const ASK_ANSWER_OBSERVATION = "User has answered your clarification question.";

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
  onSubmitAskAnswer?: (
    payload: AiAskAnswerSubmitPayload,
  ) => void | Promise<void>;
  // 发送工具确认回答回调。
  onSubmitToolConfirmationAnswer?: (
    payload: AiToolConfirmationAnswerSubmitPayload,
  ) => void | Promise<void>;
  // 工具确认表单展开收拢时的回调。
  onToolConfirmationToggle?: () => void;
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
    case "cancelled":
      return {
        label: "Cancelled",
        icon: XCircle,
        className: "text-white/35",
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
const formatToolObservation = (step: AiToolStep): string => {
  if (isAiAskAnswer(step.data)) {
    return ASK_ANSWER_OBSERVATION;
  }

  const normalizedObservation = step.observation.trim();
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
 * renderAskAnswerSummary - 渲染 Ask 回答键值摘要。
 */
const renderAskAnswerSummary = (data: unknown): React.JSX.Element | null => {
  if (!isAiAskAnswer(data)) {
    return null;
  }

  const rightAngleSvg = (
    <svg className="h-3 w-3 stroke-current" viewBox="0 0 12 12" fill="none">
      <path
        d="M3 1v5h7"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className="flex flex-col gap-1 min-w-0">
      {data.answers.map((item, index) => (
        <div key={item.question} className="flex flex-col gap-1 min-w-0">
          {/* 问题 */}
          <div className="flex items-start gap-1 text-xs leading-relaxed text-white/45">
            <span className="inline-flex h-[1.625em] w-3 flex-shrink-0 items-center justify-center select-none">
              {index === 0 ? rightAngleSvg : <span className="w-3" />}
            </span>
            <span className="text-white/35">{item.question}</span>
          </div>
          {/* 选择 */}
          <div className="pl-4 flex items-start gap-1 text-xs leading-relaxed text-white/45">
            <span className="inline-flex h-[1.625em] w-3 flex-shrink-0 items-center justify-center select-none">
              {rightAngleSvg}
            </span>
            <span className="min-w-0 text-white/70">
              {item.answers.length > 0 ? item.answers.join("、") : "未回答"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// 工具确认/问答面板包装组件属性类型。
type AiToolRequestPanelContainerProps = {
  // 请求数据。
  request: AiAskRequest | AiToolConfirmationRequest | null;
  // 提交回答回调。
  onSubmit: ((payload: AiAskAnswerSubmitPayload) => void | Promise<void>) | undefined;
  // 切换展开折叠时的回调。
  onToggle?: () => void;
};

/**
 * AiToolRequestPanelContainer - 为工具确认面板/问答面板提供平滑展开与收拢过渡的容器组件。
 */
const AiToolRequestPanelContainer = ({
  request,
  onSubmit,
  onToggle,
}: AiToolRequestPanelContainerProps): React.JSX.Element | null => {
  const [activeRequest, setActiveRequest] = useState<
    AiAskRequest | AiToolConfirmationRequest | null
  >(request);
  const [isExpanded, setIsExpanded] = useState<boolean>(!!request);
  const [activeOnSubmit, setActiveOnSubmit] = useState<
    ((payload: AiAskAnswerSubmitPayload) => void | Promise<void>) | undefined
  >(() => onSubmit);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (request && onSubmit) {
      setActiveOnSubmit(() => onSubmit);
      if (!activeRequest) {
        setActiveRequest(request);
        const raf = requestAnimationFrame(() => {
          setIsExpanded(true);
          onToggle?.();
        });
        return () => cancelAnimationFrame(raf);
      } else {
        setActiveRequest(request);
        setIsExpanded(true);
        onToggle?.();
      }
    } else {
      setIsExpanded(false);
      onToggle?.();
    }
    return undefined;
  }, [request, onSubmit]);

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (!isExpanded && e.propertyName === "max-height") {
      setActiveRequest(null);
      setActiveOnSubmit(undefined);
    }
  };

  if (!activeRequest || !activeOnSubmit) {
    return null;
  }

  return (
    <div
      style={{
        maxHeight: isExpanded ? `${innerRef.current?.scrollHeight || 1000}px` : "0px",
        opacity: isExpanded ? 1 : 0,
        transition:
          "max-height 0.25s cubic-bezier(0.2, 0.85, 0.2, 1), opacity 0.25s cubic-bezier(0.2, 0.85, 0.2, 1)",
      }}
      className="overflow-hidden"
      onTransitionEnd={handleTransitionEnd}
    >
      <div ref={innerRef} className="mt-1 flex items-start gap-1 text-white/45">
        <span className="inline-flex h-[1.625em] w-3 flex-shrink-0 items-center justify-center select-none">
          <svg className="h-3 w-3 stroke-current" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 1v5h7"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <AiAskRequestPanel request={activeRequest} onSubmit={activeOnSubmit} />
        </div>
      </div>
    </div>
  );
};

/**
 * AiToolCallBlock - 渲染 ReAct 风格的工具执行摘要
 */
export const AiToolCallBlock = ({
  steps,
  onSubmitAskAnswer,
  onSubmitToolConfirmationAnswer,
  onToolConfirmationToggle,
}: AiToolCallBlockProps): React.JSX.Element => {
  return (
    <div className="my-0.5 flex flex-col gap-2">
      {/* 步骤列表 */}
      <div className="relative flex flex-col gap-3 pl-1">
        {steps.map((step, index) => {
          const config = getStatusConfig(step.status);
          const StatusIcon = config.icon;
          const displayObservation = formatToolObservation(step);
          const askRequest = isAiAskRequest(step.data) ? step.data : null;
          const toolConfirmationRequest = isAiToolConfirmationRequest(step.data)
            ? step.data
            : null;
          const operationSummary = toolConfirmationRequest?.summary?.trim();
          const askAnswerSummary = renderAskAnswerSummary(step.data);
          const requestPanel = askRequest ?? toolConfirmationRequest;
          const handleSubmitRequest = askRequest
            ? onSubmitAskAnswer
            : toolConfirmationRequest && onSubmitToolConfirmationAnswer
              ? (payload: AiAskAnswerSubmitPayload): void | Promise<void> => {
                  const selected = payload.answers[0]?.[0] ?? "";
                  const cancelLabel =
                    toolConfirmationRequest.questions[0]?.options[1]?.label;

                  return onSubmitToolConfirmationAnswer({
                    requestId: payload.requestId,
                    action: selected === cancelLabel ? "cancel" : "confirm",
                  });
                }
              : undefined;

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

                <div
                  className="flex items-start gap-1 text-xs leading-relaxed text-white/45"
                >
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
                {operationSummary ? (
                  <div
                    className="flex items-start gap-1 text-xs leading-relaxed text-white/45"
                    data-testid="tool-operation-summary"
                  >
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
                    <div className="min-w-0 flex-1">
                      <AiToolExplainPreview
                        content={operationSummary}
                        isGenerating={step.status === "running"}
                      />
                    </div>
                  </div>
                ) : null}
                {toolConfirmationRequest?.input ? (
                  <AiToolChangePreview
                    toolName={step.tool}
                    input={toolConfirmationRequest.input}
                    isGenerating={step.status === "running"}
                  />
                ) : null}
                {askAnswerSummary}
                <AiToolRequestPanelContainer
                  request={requestPanel}
                  onSubmit={handleSubmitRequest}
                  onToggle={onToolConfirmationToggle}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
