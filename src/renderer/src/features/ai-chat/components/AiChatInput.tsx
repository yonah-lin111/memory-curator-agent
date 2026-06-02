import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Paperclip, SendHorizontal, SlidersHorizontal } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";
import { Select } from "@renderer/components/ui/Select";
import { useToast } from "@renderer/components/ui/Toast";
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
  // 是否正在生成 AI 输出。
  isGenerating?: boolean;
  // 发送消息回调。
  onSendMessage: (text: string) => void;
  // 执行输入框斜杠命令回调。
  onCommandExecute: (command: AiChatInputCommandId) => string | void | Promise<string | void>;
  // AI 模型切换回调。
  onModelChange: (selection: AiModelSelection) => void;
};

// AI 输入框内置命令标识。
export type AiChatInputCommandId = "clear" | "undo";

// AI 输入框斜杠命令配置类型。
type AiChatInputCommand = {
  // 命令唯一标识。
  id: AiChatInputCommandId;
  // 主命令文本。
  name: string;
  // 可匹配的命令别名。
  aliases: string[];
  // 命令显示描述。
  description: string;
  // 是否把命令本身写入对话上下文。
  addToContext: boolean;
};

// AI 输入框支持的斜杠命令。
const AI_CHAT_INPUT_COMMANDS: AiChatInputCommand[] = [
  {
    id: "clear",
    name: "/clear",
    aliases: ["/new"],
    description: "清空当前输入并切换到空白对话",
    addToContext: false,
  },
  {
    id: "undo",
    name: "/undo",
    aliases: ["/rewind"],
    description: "删除最后一轮消息、运行数据和相关上下文",
    addToContext: false,
  },
];

// 输入框最小显示行数。
const TEXTAREA_MIN_ROWS = 2;

// 输入框最大显示行数。
const TEXTAREA_MAX_ROWS = 6;

// 测不到 CSS line-height 时的兜底行高。
const FALLBACK_LINE_HEIGHT = 21;

// 容器点击时不抢焦点的交互元素。
const INTERACTIVE_SELECTOR = "button, select, input, textarea, a, [role='button'], [role='listbox'], [role='option']";

/**
 * 判断输入文本是否处在斜杠命令模式。
 */
const isCommandInput = (value: string): boolean => value.startsWith("/");

/**
 * 使用子序列规则做命令模糊匹配，支持 /ce 命中 /clear。
 */
const isFuzzyCommandMatch = (query: string, keyword: string): boolean => {
  if (!query) {
    return true;
  }

  let queryIndex = 0;

  for (const character of keyword) {
    if (character === query[queryIndex]) {
      queryIndex += 1;
    }

    if (queryIndex === query.length) {
      return true;
    }
  }

  return false;
};

/**
 * 获取当前输入可匹配的命令列表。
 */
const getMatchedCommands = (value: string): AiChatInputCommand[] => {
  if (!isCommandInput(value)) {
    return [];
  }

  const normalizedValue = value.trim().toLowerCase();
  const normalizedQuery = normalizedValue.startsWith("/")
    ? normalizedValue.slice(1)
    : normalizedValue;

  return AI_CHAT_INPUT_COMMANDS.filter((command) =>
    [command.name, ...command.aliases].some((keyword) =>
      isFuzzyCommandMatch(
        normalizedQuery,
        keyword.toLowerCase().replace(/^\//, ""),
      ),
    ),
  );
};

/**
 * AiChatInput - AI 对话底部输入区域组件，包含模型切换、文本输入与辅助功能。
 */
export const AiChatInput = ({
  modelOptions,
  selectedModel,
  contextUsagePercent,
  contextTokens,
  contextLimit,
  isGenerating = false,
  onSendMessage,
  onCommandExecute,
  onModelChange,
}: AiChatInputProps): React.JSX.Element => {
  const toast = useToast();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [inputText, setInputText] = useState("");
  const [isCommandPanelOpen, setIsCommandPanelOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const selectedModelValue = selectedModel
    ? `${selectedModel.provider}::${selectedModel.model}`
    : "";
  const matchedCommands = getMatchedCommands(inputText);
  const activeCommand = matchedCommands[activeCommandIndex] ?? matchedCommands[0];
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

  useEffect(() => {
    if (!isCommandPanelOpen) {
      return;
    }

    setActiveCommandIndex((currentIndex) =>
      Math.min(currentIndex, Math.max(matchedCommands.length - 1, 0)),
    );
  }, [isCommandPanelOpen, matchedCommands.length]);

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
    if (isGenerating) {
      toast.warning("请等待 AI 输出完成");
      return;
    }
    onSendMessage(inputText.trim());
    setInputText("");
    setIsCommandPanelOpen(false);
  };

  /**
   * 执行指定斜杠命令，并清理命令输入态。
   */
  const executeCommand = (command: AiChatInputCommand): void => {
    if (isGenerating) {
      toast.warning("请等待 AI 输出完成");
      return;
    }
    setIsCommandPanelOpen(false);
    void Promise.resolve(onCommandExecute(command.id))
      .then((nextInputText) => {
        if (!command.addToContext) {
          setInputText(nextInputText ?? "");
        }
      })
      .catch(() => {
        if (!command.addToContext) {
          setInputText("");
        }
      });
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  /**
   * 循环切换命令面板选中项。
   */
  const moveActiveCommand = (direction: 1 | -1): void => {
    setActiveCommandIndex((currentIndex) => {
      if (matchedCommands.length === 0) {
        return 0;
      }

      return (currentIndex + direction + matchedCommands.length) % matchedCommands.length;
    });
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
   * 处理输入内容变化，并在斜杠命令模式下打开或关闭命令面板。
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const nextValue = e.target.value;
    const nextMatchedCommands = getMatchedCommands(nextValue);

    setInputText(nextValue);
    setActiveCommandIndex(0);
    setIsCommandPanelOpen(isCommandInput(nextValue) && nextMatchedCommands.length > 0);
  };

  /**
   * 处理输入框键盘按键事件，支持 Enter 键发送消息，Shift + Enter 换行。
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (isCommandPanelOpen && e.key === "ArrowDown") {
      e.preventDefault();
      moveActiveCommand(1);
      return;
    }

    if (isCommandPanelOpen && e.key === "ArrowUp") {
      e.preventDefault();
      moveActiveCommand(-1);
      return;
    }

    if (isCommandPanelOpen && e.key === "Escape") {
      e.preventDefault();
      setIsCommandPanelOpen(false);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent.isComposing) {
        return;
      }
      e.preventDefault();

      if (isCommandPanelOpen && activeCommand) {
        executeCommand(activeCommand);
        return;
      }

      handleSend();
    }
  };

  /**
   * 处理命令面板键盘事件，支持方向键切换、回车执行和 Esc 关闭。
   */
  const handleCommandPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActiveCommand(1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActiveCommand(-1);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsCommandPanelOpen(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    if (e.key === "Enter" && activeCommand) {
      e.preventDefault();
      executeCommand(activeCommand);
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      const nextValue = inputText.slice(0, -1);
      const nextMatchedCommands = getMatchedCommands(nextValue);
      setInputText(nextValue);
      setActiveCommandIndex(0);
      setIsCommandPanelOpen(isCommandInput(nextValue) && nextMatchedCommands.length > 0);
      requestAnimationFrame(adjustTextareaHeight);
      return;
    }

    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const nextValue = `${inputText}${e.key}`;
      const nextMatchedCommands = getMatchedCommands(nextValue);
      setInputText(nextValue);
      setActiveCommandIndex(0);
      setIsCommandPanelOpen(isCommandInput(nextValue) && nextMatchedCommands.length > 0);
      requestAnimationFrame(adjustTextareaHeight);
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
        {isCommandPanelOpen && matchedCommands.length > 0 ? (
          <div
            role="listbox"
            aria-label="AI 输入命令面板"
            aria-activedescendant={`ai-chat-command-${activeCommand?.id ?? matchedCommands[0].id}`}
            onKeyDown={handleCommandPanelKeyDown}
            className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-40 overflow-hidden rounded-[6px] border border-white/10 bg-black shadow-2xl outline-none"
          >
            {matchedCommands.map((command, index) => {
              const isActive = index === activeCommandIndex;

              return (
                <button
                  key={command.id}
                  id={`ai-chat-command-${command.id}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActiveCommandIndex(index)}
                  onClick={() => executeCommand(command)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                    isActive ? "bg-black text-white" : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {command.name} - {command.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* 输入框 */}
        <textarea
          ref={textareaRef}
          rows={TEXTAREA_MIN_ROWS}
          value={inputText}
          onChange={handleInputChange}
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
            highlighted={!!inputText.trim()}
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
