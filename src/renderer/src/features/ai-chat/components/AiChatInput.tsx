import type React from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Paperclip, SendHorizontal, SlidersHorizontal } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";
import { Select } from "@renderer/components/ui/Select";
import type {
  AiModelProviderOption,
  AiModelSelection,
} from "@renderer/features/ai-chat/aiChatMock";

// AI 对话输入框组件属性类型。
export type AiChatInputProps = {
  // 可切换的 AI provider 与模型列表。
  modelOptions: AiModelProviderOption[];
  // 当前选中的 AI provider 与模型。
  selectedModel: AiModelSelection | null;
  // 当前模型上下文使用百分比。
  contextUsagePercent: number | null;
  // 当前上下文 token 估算。
  contextTokens: number;
  // 当前模型上下文窗口上限。
  contextLimit?: number;
  // 发送消息回调。
  onSendMessage: (text: string) => void;
  // AI 模型切换回调。
  onModelChange: (selection: AiModelSelection) => void;
};

// 输入框最小显示行数。
const TEXTAREA_MIN_ROWS = 2;

// 输入框最大显示行数。
const TEXTAREA_MAX_ROWS = 6;

// 测不到 CSS line-height 时的兜底行高。
const FALLBACK_LINE_HEIGHT = 21;

// 容器点击时不抢焦点的交互元素。
const INTERACTIVE_SELECTOR = "button, select, input, textarea, a, [role='button'], [role='listbox'], [role='option']";

/**
 * AiChatInput - AI 对话底部输入区域组件，包含模型切换、文本输入与辅助功能。
 */
export const AiChatInput = ({
  modelOptions,
  selectedModel,
  contextUsagePercent,
  contextTokens,
  contextLimit,
  onSendMessage,
  onModelChange,
}: AiChatInputProps): React.JSX.Element => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [inputText, setInputText] = useState("");
  const selectedModelValue = selectedModel
    ? `${selectedModel.provider}::${selectedModel.model}`
    : "";
  const hasModelOptions = modelOptions.some((provider) => provider.models.length > 0);
  const contextUsageValue = contextUsagePercent === null ? null : Math.min(Math.max(contextUsagePercent, 0), 100);
  const contextUsageLabel = contextUsageValue === null ? "上下文使用未知" : `上下文使用 ${contextUsageValue}%`;
  const contextTokenLabel =
    contextLimit === undefined
      ? `约 ${contextTokens.toLocaleString("zh-CN")} tokens / 未知上限`
      : `约 ${contextTokens.toLocaleString("zh-CN")} tokens / ${contextLimit.toLocaleString("zh-CN")}`;
  const contextTooltipLabel = `${contextUsageLabel} · ${contextTokenLabel}`;
  const circleRadius = 8;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleDashOffset =
    contextUsageValue === null
      ? circleCircumference
      : circleCircumference * (1 - contextUsageValue / 100);

  /**
   * 根据内容真实高度调整输入框高度，最多显示 6 行，超过后内部滚动。
   */
  const adjustTextareaHeight = useCallback((): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const computedStyle = window.getComputedStyle(textarea);
    const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight);
    const lineHeight = Number.isNaN(parsedLineHeight)
      ? FALLBACK_LINE_HEIGHT
      : parsedLineHeight;
    const verticalPadding =
      Number.parseFloat(computedStyle.paddingTop || "0") +
      Number.parseFloat(computedStyle.paddingBottom || "0");
    const minHeight = lineHeight * TEXTAREA_MIN_ROWS + verticalPadding;
    const maxHeight = lineHeight * TEXTAREA_MAX_ROWS + verticalPadding;

    textarea.style.height = "auto";
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, minHeight),
      maxHeight
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight, inputText]);

  // 构造供 Select 组件使用的选项列表，支持 provider 分组。
  const selectOptions = hasModelOptions
    ? modelOptions.map((provider) => ({
        label: provider.name,
        options: provider.models.map((model) => ({
          value: `${provider.id}::${model.id}`,
          label: model.name,
        })),
      }))
    : [{ value: "", label: "无可用模型" }];

  /**
   * 发送消息处理函数。
   */
  const handleSend = (): void => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  /**
   * 处理输入区域点击，空白区域点击时聚焦文本框。
   */
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLElement;
    if (
      target !== textareaRef.current &&
      target.closest(INTERACTIVE_SELECTOR)
    ) {
      return;
    }
    textareaRef.current?.focus();
  };

  /**
   * 处理输入框键盘按键事件，支持 Enter 键发送消息，Shift + Enter 换行。
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent.isComposing) {
        return;
      }
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * 处理 AI 模型切换，value 使用 provider/model 组合避免跨 provider 模型重名。
   */
  const handleModelChange = (value: string): void => {
    const [provider, model] = value.split("::");
    if (!provider || !model) return;
    onModelChange({ provider, model });
  };

  return (
    <div className="flex-shrink-0 border-t border-white/5 p-3 bg-black/5">
      <div
        data-testid="ai-chat-input-container"
        onClick={handleContainerClick}
        className="relative rounded-[6px] border border-white/5 bg-white/[0.01] p-2 flex flex-col gap-2"
      >
        {/* 输入框 */}
        <textarea
          ref={textareaRef}
          rows={TEXTAREA_MIN_ROWS}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入您的问题..."
          aria-label="AI 对话输入框"
          className="w-full bg-transparent text-sm text-white placeholder:text-white/20 outline-none resize-none leading-relaxed px-1 transition-[height] duration-200 ease-out"
        />

        {/* 工具栏与发送按钮 */}
        <div className="flex items-center justify-between">
          {/* 左侧附加操作 */}
          <div className="flex min-w-0 items-center gap-2">
            <Select
              value={selectedModelValue}
              onChange={handleModelChange}
              options={selectOptions}
              position="up"
              bgClass="bg-black"
              disabled={!hasModelOptions}
              className="!w-fit max-w-[220px]"
            />
            <div
              aria-label={contextTooltipLabel}
              className="group relative flex h-6 w-6 shrink-0 items-center justify-center text-white/50"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="-rotate-90 h-5 w-5"
              >
                <circle
                  cx="12"
                  cy="12"
                  r={circleRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-white/10"
                />
                <circle
                  cx="12"
                  cy="12"
                  r={circleRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={circleDashOffset}
                  className="text-white/80 transition-[stroke-dashoffset] duration-200"
                />
              </svg>
              <div className="pointer-events-none absolute bottom-8 left-1/2 z-50 hidden -translate-x-1/2 whitespace-nowrap rounded-[6px] border border-white/10 bg-black px-2 py-1 text-[12px] text-white/70 shadow-lg group-hover:block">
                {contextTooltipLabel}
              </div>
            </div>
            <IconButton
              aria-label="添加附件"
              disabled
              className="text-white/30 h-6 w-6 cursor-not-allowed"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              aria-label="设置工具模式"
              disabled
              className="text-white/30 h-6 w-6 cursor-not-allowed"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </IconButton>
          </div>

          {/* 右侧发送按钮 */}
          <IconButton
            aria-label="发送消息"
            onClick={handleSend}
            disabled={!inputText.trim()}
            className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
              inputText.trim()
                ? "bg-white text-black hover:bg-white/90"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            <SendHorizontal className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
};
