import type React from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Paperclip,
  RotateCcw,
  SendHorizontal,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Image } from "@/components/ui/Image";
import { TextFile } from "@/components/ui/TextFile";
import type { AiChatMessagePart } from "@/features/ai-chat/types";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { CommandPanel } from "@/features/ai-chat/components/CommandPanel";
import {
  createAiChatSendPayload,
  getAiChatAgentMentionDeletionRange,
  getMatchedAiChatAgentMentions,
  type AiChatAgentMentionOption,
  type AiChatSendPayload,
} from "@/features/ai-chat/aiChatAgentMentions";
import type {
  AiModelProviderOption,
  AiModelSelection,
} from "@/features/ai-chat/types";

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
  onSendMessage: (payload: AiChatSendPayload) => void;
  // 执行输入框斜杠命令回调。
  onCommandExecute: (
    command: AiChatInputCommandId,
  ) => string | void | Promise<string | void>;
  // AI 模型切换回调。
  onModelChange: (selection: AiModelSelection) => void;
};

// AI 输入框内置命令标识。
export type AiChatInputCommandId = "clear" | "undo" | "model";

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
  {
    id: "model",
    name: "/model",
    aliases: [],
    description: "快速切换 AI 语言模型",
    addToContext: false,
  },
];

// 输入框最小显示行数。
const TEXTAREA_MIN_ROWS = 2;

// 输入框最大显示行数。
const TEXTAREA_MAX_ROWS = 6;

// 测不到 CSS line-height 时的兜底行高。
const FALLBACK_LINE_HEIGHT = 21;

// 本地兜底历史最大保留数量，与主进程服务保持一致。
const PROMPT_HISTORY_LIMIT = 100;

// 容器点击时不抢焦点的交互元素。
const INTERACTIVE_SELECTOR =
  "button, select, input, textarea, a, [role='button'], [role='listbox'], [role='option']";

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
 * 合并一条提示词历史，旧项在前，新项在后。
 */
const mergePromptHistory = (history: string[], prompt: string): string[] => {
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    return history;
  }

  return [
    ...history.filter((item) => item !== normalizedPrompt),
    normalizedPrompt,
  ].slice(-PROMPT_HISTORY_LIMIT);
};

/**
 * 判断文本框光标是否折叠在指定位置。
 */
const isTextareaCursorAt = (
  textarea: HTMLTextAreaElement,
  position: number,
): boolean =>
  textarea.selectionStart === position && textarea.selectionEnd === position;

// Agent mention 面板状态。
type AgentMentionPanelState = {
  // 触发 @ 在输入文本中的位置。
  start: number;
  // @ 后的查询文本。
  query: string;
};

/**
 * 解析当前光标是否处在 agent mention 查询区间。
 */
const resolveAgentMentionPanelState = (
  value: string,
  cursor: number,
): AgentMentionPanelState | null => {
  if (isCommandInput(value)) {
    return null;
  }

  const textBeforeCursor = value.slice(0, cursor);
  const lastAt = textBeforeCursor.lastIndexOf("@");
  if (lastAt < 0 || cursor <= lastAt) {
    return null;
  }

  const previousCharacter = lastAt > 0 ? textBeforeCursor[lastAt - 1] : "";
  if (previousCharacter && !/\s/.test(previousCharacter)) {
    return null;
  }

  const query = value.slice(lastAt + 1, cursor);
  if (/[\s\n]/.test(query)) {
    return null;
  }

  return {
    start: lastAt,
    query,
  };
};

// 文本文件支持的最大数量。
const MAX_TEXT_FILES = 6;

// 文本文件 MIME 类型集合。
const SUPPORTED_TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/xml",
  "text/html",
  "text/css",
  "text/javascript",
  "text/x-python",
  "text/x-java",
  "text/x-c",
  "text/x-c++",
  "text/x-sh",
  "text/x-bash",
  "text/x-zsh",
  "text/x-ruby",
  "text/x-go",
  "text/x-rust",
  "text/x-swift",
  "text/x-kotlin",
  "text/x-scala",
  "text/x-lua",
  "text/x-perl",
  "text/x-php",
  "text/x-sql",
  "text/yaml",
  "application/json",
  "application/x-yaml",
  "application/toml",
  "application/typescript",
  "application/xml",
  "application/x-sh",
]);

// 已选文本文件条目。
type SelectedTextFile = {
  // 落盘文件名。
  fileName: string;
  // 协议 URL。
  url: string;
  // 原始文件名。
  originalName: string;
  // 文件大小（字节）。
  sizeBytes: number;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftInputRef = useRef("");
  const historyCursorRef = useRef<number | null>(null);
  const [inputText, setInputText] = useState("");
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedTextFiles, setSelectedTextFiles] = useState<
    SelectedTextFile[]
  >([]);
  const [isCommandPanelOpen, setIsCommandPanelOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [agentMentionPanelState, setAgentMentionPanelState] =
    useState<AgentMentionPanelState | null>(null);
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const selectedModelValue = selectedModel
    ? `${selectedModel.provider}::${selectedModel.model}`
    : "";

  const selectedModelOption = modelOptions
    .find((p) => p.id === selectedModel?.provider)
    ?.models.find((m) => m.id === selectedModel?.model);
  const isImageSupported =
    selectedModelOption?.modalities?.input?.includes("image") ?? false;

  useEffect(() => {
    if (!isImageSupported && selectedImages.length > 0) {
      setSelectedImages([]);
      toast.info("当前选择模型不支持图像输入，已自动清空已选图片。");
    }
  }, [selectedModelValue, isImageSupported]);

  const matchedCommands = getMatchedCommands(inputText);
  const isModelMode = inputText === "/model" || inputText.startsWith("/model ");
  const modelQuery = inputText.startsWith("/model ") ? inputText.slice(7).trim() : "";

  const allModels = useMemo(() => {
    const list: Array<{
      id: string; // providerId::modelId
      providerId: string;
      providerName: string;
      modelId: string;
      modelName: string;
    }> = [];
    modelOptions.forEach((provider) => {
      provider.models.forEach((model) => {
        list.push({
          id: `${provider.id}::${model.id}`,
          providerId: provider.id,
          providerName: provider.name,
          modelId: model.id,
          modelName: model.name || model.id,
        });
      });
    });
    return list;
  }, [modelOptions]);

  const matchedModels = useMemo(() => {
    if (!isModelMode) return [];
    if (!modelQuery) return allModels;
    const query = modelQuery.toLowerCase();
    return allModels.filter(
      (model) =>
        model.modelName.toLowerCase().includes(query) ||
        model.providerName.toLowerCase().includes(query) ||
        model.modelId.toLowerCase().includes(query)
    );
  }, [allModels, isModelMode, modelQuery]);

  useEffect(() => {
    setActiveModelIndex(0);
  }, [matchedModels.length]);
  const activeCommand =
    matchedCommands[activeCommandIndex] ?? matchedCommands[0];
  const matchedAgentMentions = agentMentionPanelState
    ? getMatchedAiChatAgentMentions(agentMentionPanelState.query)
    : [];
  const isAgentPanelOpen = Boolean(
    agentMentionPanelState && matchedAgentMentions.length > 0,
  );
  const activeAgent =
    matchedAgentMentions[activeAgentIndex] ?? matchedAgentMentions[0];
  const inputSendPayload = createAiChatSendPayload(inputText);
  const canSend = Boolean(
    inputSendPayload.text.trim() ||
    selectedImages.length > 0 ||
    selectedTextFiles.length > 0,
  );
  const hasModelOptions = modelOptions.some(
    (provider) => provider.models.length > 0,
  );
  const contextUsageValue =
    contextUsagePercent === null
      ? null
      : Math.min(Math.max(contextUsagePercent, 0), 100);
  const contextUsageLabel =
    contextUsageValue === null
      ? "Unknown context usage"
      : `Context usage ${contextUsageValue}%`;
  const contextTokenLabel =
    contextLimit === undefined
      ? `~${contextTokens.toLocaleString("zh-CN")} tokens / Unknown limit`
      : `~${contextTokens.toLocaleString("zh-CN")} tokens / ${contextLimit.toLocaleString("zh-CN")}`;
  const contextTooltipLabel = `${contextUsageLabel} · ${contextTokenLabel}`;
  const circleRadius = 8;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleDashOffset =
    contextUsageValue === null
      ? circleCircumference
      : circleCircumference * (1 - contextUsageValue / 100);

  // 判断是否正在浏览提示词历史。
  const isBrowsingHistory =
    historyCursorRef.current !== null &&
    historyCursorRef.current >= 0 &&
    historyCursorRef.current < promptHistory.length;

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
      maxHeight,
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight, inputText]);

  useEffect(() => {
    let isMounted = true;
    const listPromptHistory = window.api?.ai?.listPromptHistory;

    if (!listPromptHistory) {
      return () => {
        isMounted = false;
      };
    }

    void listPromptHistory()
      .then((history) => {
        if (isMounted) {
          setPromptHistory(history);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPromptHistory([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isCommandPanelOpen) {
      return;
    }

    setActiveCommandIndex((currentIndex) =>
      Math.min(currentIndex, Math.max(matchedCommands.length - 1, 0)),
    );
  }, [isCommandPanelOpen, matchedCommands.length]);

  /**
   * 保存提示词历史，IPC 不可用时退回内存态避免交互断裂。
   */
  const savePromptHistory = useCallback((prompt: string): void => {
    const normalizedPrompt = prompt.trim();

    if (!normalizedPrompt) {
      return;
    }

    // 不保存以 "/" 开头的斜杠命令到提示词历史。
    if (normalizedPrompt.startsWith("/")) {
      return;
    }

    const addPromptHistory = window.api?.ai?.addPromptHistory;

    if (!addPromptHistory) {
      setPromptHistory((currentHistory) =>
        mergePromptHistory(currentHistory, normalizedPrompt),
      );
      return;
    }

    void addPromptHistory(normalizedPrompt)
      .then((history) => {
        setPromptHistory(history);
      })
      .catch(() => {
        setPromptHistory((currentHistory) =>
          mergePromptHistory(currentHistory, normalizedPrompt),
        );
      });
  }, []);

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
   * 关闭 agent mention 面板。
   */
  const closeAgentMentionPanel = (): void => {
    setAgentMentionPanelState(null);
    setActiveAgentIndex(0);
  };

  /**
   * 根据输入值和光标位置同步 agent mention 面板。
   */
  const syncAgentMentionPanel = (value: string, cursor: number): void => {
    const nextState = resolveAgentMentionPanelState(
      value,
      cursor,
    );
    const nextMatches = nextState
      ? getMatchedAiChatAgentMentions(nextState.query)
      : [];

    if (!nextState || nextMatches.length === 0) {
      closeAgentMentionPanel();
      return;
    }

    setAgentMentionPanelState(nextState);
    setActiveAgentIndex(0);
  };

  /**
   * 插入选中的 agent token 并恢复输入焦点。
   */
  const selectAgentMention = (agent: AiChatAgentMentionOption): void => {
    const textarea = textareaRef.current;
    if (!textarea || !agentMentionPanelState) {
      return;
    }

    const cursor = textarea.selectionStart;
    const nextValue = `${inputText.slice(0, agentMentionPanelState.start)}${agent.token} ${inputText.slice(cursor)}`;
    const nextCursor = agentMentionPanelState.start + agent.token.length + 1;

    setInputText(nextValue);
    draftInputRef.current = nextValue;
    historyCursorRef.current = null;
    closeAgentMentionPanel();
    requestAnimationFrame(() => {
      adjustTextareaHeight();
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  /**
   * 循环切换 agent mention 面板选中项。
   */
  const moveActiveAgent = (direction: 1 | -1): void => {
    setActiveAgentIndex((currentIndex) => {
      if (matchedAgentMentions.length === 0) {
        return 0;
      }

      return Math.max(
        0,
        Math.min(currentIndex + direction, matchedAgentMentions.length - 1),
      );
    });
  };

  /**
   * 选择指定的 AI 模型并恢复输入状态。
   */
  const selectModel = (model: {
    id: string;
    providerId: string;
    providerName: string;
    modelId: string;
    modelName: string;
  }): void => {
    onModelChange({ provider: model.providerId, model: model.modelId });
    toast.success(`已切换模型为: ${model.modelName}`);
    setInputText("");
    draftInputRef.current = "";
    historyCursorRef.current = null;
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  /**
   * 循环切换模型选择面板选中项。
   */
  const moveActiveModel = (direction: 1 | -1): void => {
    setActiveModelIndex((currentIndex) => {
      if (matchedModels.length === 0) {
        return 0;
      }
      return (
        (currentIndex + direction + matchedModels.length) %
        matchedModels.length
      );
    });
  };

  /**
   * 光标移动离开查询区间时关闭 agent mention 面板。
   */
  const handleTextareaCursorMove = (): void => {
    const textarea = textareaRef.current;
    if (!textarea || !agentMentionPanelState) {
      return;
    }

    const nextState = resolveAgentMentionPanelState(
      textarea.value,
      textarea.selectionStart,
    );
    if (!nextState) {
      closeAgentMentionPanel();
    }
  };

  /**
   * 异步处理文件并上传、存储图片文件。
   */
  const handleUploadFiles = async (files: FileList | File[]): Promise<void> => {
    if (!isImageSupported) {
      toast.error("当前选择的模型不支持图片输入。");
      return;
    }

    if (!window.api?.files?.saveAiChatImage) {
      toast.error("当前环境不支持保存图片，无法上传。");
      return;
    }

    const currentCount = selectedImages.length;
    if (currentCount >= 6) {
      toast.warning("最多只能上传 6 张图片");
      return;
    }

    const remainingSlots = 6 - currentCount;
    const fileArray = Array.from(files);

    const imageFiles = fileArray.filter((file) =>
      file.type.startsWith("image/"),
    );
    if (imageFiles.length === 0 && fileArray.length > 0) {
      toast.warning("仅支持上传图片文件");
      return;
    }

    if (imageFiles.length > remainingSlots) {
      toast.warning(`最多只能上传 6 张图片，已自动截取前 ${remainingSlots} 张`);
    }

    const allowedFiles = imageFiles.slice(0, remainingSlots);

    const uploaded: string[] = [];
    for (const file of allowedFiles) {
      if (file.size > 10 * 1024 * 1024) {
        toast.warning(`图片 ${file.name} 超过 10MB 限制`);
        continue;
      }

      try {
        const buffer = await file.arrayBuffer();
        const result = await window.api.files.saveAiChatImage({
          name: file.name,
          mimeType: file.type,
          bytes: buffer,
        });
        uploaded.push(result.url);
      } catch (err) {
        toast.error(`图片 ${file.name} 上传失败`);
      }
    }

    if (uploaded.length > 0) {
      setSelectedImages((prev) => [...prev, ...uploaded]);
    }
  };

  /**
   * 判断文件是否为支持的文本类型。
   */
  const isTextFile = (file: File): boolean => {
    if (SUPPORTED_TEXT_MIME_TYPES.has(file.type)) {
      return true;
    }

    // MIME 回退时通过扩展名判断。
    const supportedExtensions = [
      ".txt",
      ".md",
      ".json",
      ".csv",
      ".log",
      ".xml",
      ".yaml",
      ".yml",
      ".toml",
      ".ini",
      ".cfg",
      ".conf",
      ".env",
      ".sh",
      ".bash",
      ".zsh",
      ".py",
      ".js",
      ".ts",
      ".jsx",
      ".tsx",
      ".html",
      ".css",
      ".scss",
      ".less",
      ".sql",
      ".java",
      ".c",
      ".cpp",
      ".h",
      ".hpp",
      ".rs",
      ".go",
      ".rb",
      ".php",
      ".swift",
      ".kt",
      ".scala",
      ".r",
      ".lua",
      ".pl",
      ".pm",
      ".bat",
      ".ps1",
    ];

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

    return supportedExtensions.includes(ext);
  };

  /**
   * 异步上传并存储文本文件。
   */
  const handleUploadTextFiles = async (
    files: FileList | File[],
  ): Promise<void> => {
    if (!window.api?.files?.saveAiChatTextFile) {
      toast.error("当前环境不支持保存文本文件，无法上传。");
      return;
    }

    const currentCount = selectedTextFiles.length;

    if (currentCount >= MAX_TEXT_FILES) {
      toast.warning(`最多只能上传 ${MAX_TEXT_FILES} 个文本文件`);
      return;
    }

    const remainingSlots = MAX_TEXT_FILES - currentCount;
    const fileArray = Array.from(files);
    const textFiles = fileArray.filter((file) => isTextFile(file));

    if (textFiles.length === 0 && fileArray.length > 0) {
      toast.warning("仅支持上传常见文本/代码文件");
      return;
    }

    if (textFiles.length > remainingSlots) {
      toast.warning(
        `最多只能上传 ${MAX_TEXT_FILES} 个文本文件，已自动截取前 ${remainingSlots} 个`,
      );
    }

    const allowedFiles = textFiles.slice(0, remainingSlots);
    const uploaded: SelectedTextFile[] = [];

    for (const file of allowedFiles) {
      if (file.size > 5 * 1024 * 1024) {
        toast.warning(`文件 ${file.name} 超过 5MB 限制`);
        continue;
      }

      try {
        const buffer = await file.arrayBuffer();
        const result = await window.api.files.saveAiChatTextFile({
          name: file.name,
          mimeType: file.type,
          bytes: buffer,
        });

        uploaded.push({
          fileName: result.fileName,
          url: result.url,
          originalName: result.originalName,
          sizeBytes: result.sizeBytes,
        });
      } catch (err) {
        toast.error(`文件 ${file.name} 上传失败`);
      }
    }

    if (uploaded.length > 0) {
      setSelectedTextFiles((prev) => [...prev, ...uploaded]);
    }
  };

  /**
   * 拖拽进入区域事件。
   */
  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    setIsDragging(true);
  };

  /**
   * 拖拽离开区域事件。
   */
  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault();
    setIsDragging(false);
  };

  /**
   * 拖拽松手上传事件。
   */
  const handleDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;

    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      const imageFiles = fileArray.filter((f) => f.type.startsWith("image/"));
      const textFiles = fileArray.filter(
        (f) => !f.type.startsWith("image/") && isTextFile(f),
      );

      if (isImageSupported && imageFiles.length > 0) {
        await handleUploadFiles(imageFiles);
      }

      if (textFiles.length > 0) {
        await handleUploadTextFiles(textFiles);
      }
    }
  };

  /**
   * 粘贴图片与文本文件事件。
   */
  const handlePaste = async (
    e: React.ClipboardEvent<HTMLTextAreaElement>,
  ): Promise<void> => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    const textFileList: File[] = [];

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      } else {
        const file = item.getAsFile();
        if (file && isTextFile(file)) textFileList.push(file);
      }
    }

    if (imageFiles.length > 0 || textFileList.length > 0) {
      e.preventDefault();
      if (isImageSupported && imageFiles.length > 0) {
        await handleUploadFiles(imageFiles);
      }
      if (textFileList.length > 0) {
        await handleUploadTextFiles(textFileList);
      }
    }
  };

  /**
   * 点击附件按钮拉起文件选择。
   */
  const handleAttachmentClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  /**
   * 发送消息处理函数。
   */
  const handleSend = (): void => {
    const parts: AiChatMessagePart[] = [];
    const textToSend = inputSendPayload.text.trim();
    if (textToSend) {
      parts.push({
        id: `msg-text-${Date.now()}`,
        kind: "text",
        content: textToSend,
      });
    }

    selectedTextFiles.forEach((file, i) => {
      parts.push({
        id: `msg-txtfile-${i}-${Date.now()}`,
        kind: "text-file",
        url: file.url,
        fileName: file.originalName,
        sizeBytes: file.sizeBytes,
      });
    });

    selectedImages.forEach((url, i) => {
      parts.push({
        id: `msg-img-${i}-${Date.now()}`,
        kind: "image",
        url,
      });
    });

    if (parts.length === 0) return;

    if (isGenerating) {
      toast.warning("请等待 AI 输出完成");
      return;
    }

    onSendMessage({
      text: textToSend,
      agents: inputSendPayload.agents,
      ...(selectedImages.length > 0 || selectedTextFiles.length > 0
        ? { parts }
        : {}),
    });

    savePromptHistory(inputText);
    setInputText("");
    draftInputRef.current = "";
    historyCursorRef.current = null;
    setSelectedImages([]);
    setSelectedTextFiles([]);
    setIsCommandPanelOpen(false);
    closeAgentMentionPanel();
  };

  /**
   * 清空输入框内容。
   */
  const handleClearInput = (): void => {
    setInputText("");
    draftInputRef.current = "";
    historyCursorRef.current = null;
    setSelectedImages([]);
    setSelectedTextFiles([]);
    closeAgentMentionPanel();
    setIsCommandPanelOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  /**
   * 执行指定斜杠命令，并清理命令输入态。
   */
  const executeCommand = (command: AiChatInputCommand): void => {
    if (command.id === "model") {
      const text = "/model ";
      setInputText(text);
      draftInputRef.current = text;
      historyCursorRef.current = null;
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }
    if (isGenerating) {
      toast.warning("请等待 AI 输出完成");
      return;
    }
    setIsCommandPanelOpen(false);
    closeAgentMentionPanel();
    void Promise.resolve(onCommandExecute(command.id))
      .then((nextInputText) => {
        if (!command.addToContext) {
          const text = nextInputText ?? "";
          setInputText(text);
          draftInputRef.current = text;
          historyCursorRef.current = null;
        }
      })
      .catch(() => {
        if (!command.addToContext) {
          setInputText("");
          draftInputRef.current = "";
          historyCursorRef.current = null;
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

      return Math.max(
        0,
        Math.min(currentIndex + direction, matchedCommands.length - 1),
      );
    });
  };

  /**
   * 切换历史后恢复焦点并设置光标位置。
   */
  const syncTextareaAfterHistoryMove = (
    cursorPosition: "start" | "end",
  ): void => {
    requestAnimationFrame(() => {
      adjustTextareaHeight();
      const textarea = textareaRef.current;

      if (!textarea) {
        return;
      }

      const nextPosition =
        cursorPosition === "start" ? 0 : textarea.value.length;
      textarea.focus();
      textarea.setSelectionRange(nextPosition, nextPosition);
    });
  };

  /**
   * 在非命令面板状态下浏览历史提示词。
   */
  const movePromptHistory = (direction: 1 | -1): void => {
    if (promptHistory.length === 0) {
      return;
    }

    const currentCursor = historyCursorRef.current;
    const newestIndex = promptHistory.length - 1;
    const nextCursor =
      currentCursor === null
        ? direction === -1
          ? newestIndex
          : 0
        : currentCursor + direction;

    if (nextCursor > newestIndex) {
      setInputText(draftInputRef.current);
      historyCursorRef.current = newestIndex + 1;
      syncTextareaAfterHistoryMove("end");
      return;
    }

    if (nextCursor < 0) {
      syncTextareaAfterHistoryMove("start");
      return;
    }

    setInputText(promptHistory[nextCursor] ?? "");
    historyCursorRef.current = nextCursor;
    syncTextareaAfterHistoryMove(direction === -1 ? "start" : "end");
  };

  /**
   * 判断普通输入态方向键是否应进入历史提示词导航。
   */
  const canMovePromptHistory = (direction: 1 | -1): boolean => {
    const textarea = textareaRef.current;

    if (!textarea || promptHistory.length === 0) {
      return false;
    }

    const textareaValue = textarea.value;

    if (textareaValue.length === 0) {
      return direction === -1;
    }

    if (
      direction === 1 &&
      textareaValue.includes("\n") &&
      !isTextareaCursorAt(textarea, textareaValue.length)
    ) {
      return false;
    }

    return direction === -1
      ? isTextareaCursorAt(textarea, 0)
      : isTextareaCursorAt(textarea, textareaValue.length);
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
   * 处理输入内容变化，并同步斜杠命令与 agent mention 面板。
   */
  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ): void => {
    const nextValue = e.target.value;
    const nextMatchedCommands = getMatchedCommands(nextValue);

    setInputText(nextValue);
    draftInputRef.current = nextValue;
    historyCursorRef.current = null;
    setActiveCommandIndex(0);

    const isNextModelMode = nextValue === "/model" || nextValue.startsWith("/model ");

    if (isNextModelMode) {
      setIsCommandPanelOpen(false);
      closeAgentMentionPanel();
      return;
    }

    const shouldOpenCommandPanel =
      isCommandInput(nextValue) && nextMatchedCommands.length > 0;
    setIsCommandPanelOpen(shouldOpenCommandPanel);
    if (shouldOpenCommandPanel) {
      closeAgentMentionPanel();
      return;
    }

    syncAgentMentionPanel(nextValue, e.target.selectionStart);
  };

  /**
   * 处理输入框键盘按键事件，支持 Enter 键发送消息，Shift + Enter 换行。
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (isModelMode && matchedModels.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActiveModel(1);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActiveModel(-1);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setInputText("");
        draftInputRef.current = "";
        historyCursorRef.current = null;
        requestAnimationFrame(() => textareaRef.current?.focus());
        return;
      }

      if (e.key === "Enter") {
        if (e.nativeEvent.isComposing) {
          return;
        }
        e.preventDefault();
        const activeModel = matchedModels[activeModelIndex] ?? matchedModels[0];
        if (activeModel) {
          selectModel(activeModel);
        }
        return;
      }
    }

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

    if (isAgentPanelOpen && e.key === "ArrowDown") {
      e.preventDefault();
      moveActiveAgent(1);
      return;
    }

    if (isAgentPanelOpen && e.key === "ArrowUp") {
      e.preventDefault();
      moveActiveAgent(-1);
      return;
    }

    if (isAgentPanelOpen && e.key === "Escape") {
      e.preventDefault();
      closeAgentMentionPanel();
      return;
    }

    if (isAgentPanelOpen && e.key === "Enter" && activeAgent) {
      if (e.nativeEvent.isComposing) {
        return;
      }
      e.preventDefault();
      selectAgentMention(activeAgent);
      return;
    }

    if (e.key === "Backspace" && !isCommandPanelOpen && !isAgentPanelOpen) {
      const textarea = textareaRef.current;
      if (textarea && textarea.selectionStart === textarea.selectionEnd) {
        const deletionRange = getAiChatAgentMentionDeletionRange(
          inputText,
          textarea.selectionStart,
        );
        if (deletionRange) {
          e.preventDefault();
          const nextValue = `${inputText.slice(0, deletionRange.start)}${inputText.slice(deletionRange.end)}`;
          setInputText(nextValue);
          draftInputRef.current = nextValue;
          historyCursorRef.current = null;
          requestAnimationFrame(() => {
            adjustTextareaHeight();
            textarea.setSelectionRange(
              deletionRange.start,
              deletionRange.start,
            );
          });
          return;
        }
      }
    }

    if (
      !isCommandPanelOpen &&
      e.key === "ArrowDown" &&
      canMovePromptHistory(1)
    ) {
      e.preventDefault();
      movePromptHistory(1);
      return;
    }

    if (
      !isCommandPanelOpen &&
      e.key === "ArrowUp" &&
      canMovePromptHistory(-1)
    ) {
      e.preventDefault();
      movePromptHistory(-1);
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
  const handleCommandPanelKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
  ): void => {
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
      draftInputRef.current = nextValue;
      historyCursorRef.current = null;
      setActiveCommandIndex(0);
      setIsCommandPanelOpen(
        isCommandInput(nextValue) && nextMatchedCommands.length > 0,
      );
      requestAnimationFrame(adjustTextareaHeight);
      return;
    }

    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const nextValue = `${inputText}${e.key}`;
      const nextMatchedCommands = getMatchedCommands(nextValue);
      setInputText(nextValue);
      draftInputRef.current = nextValue;
      historyCursorRef.current = null;
      setActiveCommandIndex(0);
      setIsCommandPanelOpen(
        isCommandInput(nextValue) && nextMatchedCommands.length > 0,
      );
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

  /**
   * 处理模型面板键盘事件，支持方向键切换、回车执行、Esc 关闭和 Backspace 退回。
   */
  const handleModelPanelKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActiveModel(1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActiveModel(-1);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setInputText("");
      draftInputRef.current = "";
      historyCursorRef.current = null;
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const activeModel = matchedModels[activeModelIndex] ?? matchedModels[0];
      if (activeModel) {
        selectModel(activeModel);
      }
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      const nextValue = inputText.slice(0, -1);
      const nextMatchedCommands = getMatchedCommands(nextValue);
      setInputText(nextValue);
      draftInputRef.current = nextValue;
      historyCursorRef.current = null;

      const isNextModelMode = nextValue === "/model" || nextValue.startsWith("/model ");
      if (isNextModelMode) {
        setActiveModelIndex(0);
      } else {
        setActiveCommandIndex(0);
        setIsCommandPanelOpen(
          isCommandInput(nextValue) && nextMatchedCommands.length > 0,
        );
      }
      requestAnimationFrame(adjustTextareaHeight);
    }
  };

  return (
    <div className="flex-shrink-0 p-3 bg-black/5">
      <div
        data-testid="ai-chat-input-container"
        onClick={handleContainerClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative rounded-[6px] border border-white/5 bg-white/[0.01] p-2 flex flex-col gap-2"
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept={
            isImageSupported
              ? "image/*,.txt,.md,.json,.csv,.log,.xml,.yaml,.yml,.toml,.ini,.cfg,.conf,.env,.sh,.bash,.zsh,.py,.js,.ts,.jsx,.tsx,.html,.css,.scss,.less,.sql,.java,.c,.cpp,.h,.hpp,.rs,.go,.rb,.php,.swift,.kt,.scala,.r,.lua,.pl,.pm,.bat,.ps1"
              : ".txt,.md,.json,.csv,.log,.xml,.yaml,.yml,.toml,.ini,.cfg,.conf,.env,.sh,.bash,.zsh,.py,.js,.ts,.jsx,.tsx,.html,.css,.scss,.less,.sql,.java,.c,.cpp,.h,.hpp,.rs,.go,.rb,.php,.swift,.kt,.scala,.r,.lua,.pl,.pm,.bat,.ps1"
          }
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              const fileArray = Array.from(e.target.files);
              const imageFiles = fileArray.filter((f) =>
                f.type.startsWith("image/"),
              );
              const textFiles = fileArray.filter(
                (f) => !f.type.startsWith("image/") && isTextFile(f),
              );

              if (isImageSupported && imageFiles.length > 0) {
                void handleUploadFiles(imageFiles);
              }
              if (textFiles.length > 0) {
                void handleUploadTextFiles(textFiles);
              }
            }
            e.target.value = "";
          }}
        />

        {isDragging && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[6px] border-2 border-dashed border-white/20 bg-black/90 backdrop-blur-xs text-white/90 pointer-events-none">
            <Paperclip className="h-6 w-6 mb-2 animate-bounce" />
            <span className="text-xs font-medium">
              松手即可上传图片或文本文件
            </span>
          </div>
        )}

        <CommandPanel
          isOpen={isCommandPanelOpen && matchedCommands.length > 0}
          ariaLabel="AI Command Input Panel"
          items={matchedCommands}
          activeIndex={activeCommandIndex}
          onActiveIndexChange={setActiveCommandIndex}
          onItemSelect={executeCommand}
          onKeyDown={handleCommandPanelKeyDown}
          idPrefix="ai-chat-command"
          renderItem={(command) => (
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] font-semibold text-white">
                {command.name}
              </span>
              <span className="text-xs text-white/30">-</span>
              <span className="truncate text-xs text-white/45">
                {command.description}
              </span>
            </span>
          )}
        />

        <CommandPanel
          isOpen={isModelMode && matchedModels.length > 0}
          ariaLabel="AI Model Selection Panel"
          items={matchedModels}
          activeIndex={activeModelIndex}
          onActiveIndexChange={setActiveModelIndex}
          onItemSelect={selectModel}
          onKeyDown={handleModelPanelKeyDown}
          idPrefix="ai-chat-model"
          renderItem={(model) => (
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] font-semibold text-white">
                {model.modelName}
              </span>
              <span className="text-xs text-white/30">-</span>
              <span className="truncate text-xs text-white/45">
                {model.providerName}
              </span>
            </span>
          )}
        />

        <CommandPanel
          isOpen={isAgentPanelOpen}
          ariaLabel="AI Agent Mention Panel"
          items={matchedAgentMentions}
          activeIndex={activeAgentIndex}
          onActiveIndexChange={setActiveAgentIndex}
          onItemSelect={selectAgentMention}
          idPrefix="ai-chat-agent"
          renderItem={(agent) => (
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] font-semibold text-white">
                {agent.token}
              </span>
              <span className="text-xs text-white/30">-</span>
              <span className="truncate text-xs text-white/45">
                {agent.description}
              </span>
            </span>
          )}
        />

        {/* 上传文本文件微缩预览横轴 */}
        {selectedTextFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1.5 py-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
            {selectedTextFiles.map((file, idx) => (
              <div key={idx} className="relative group/preview-txt">
                <TextFile
                  url={file.url}
                  fileName={file.originalName}
                  sizeBytes={file.sizeBytes}
                  preview={true}
                />
                <button
                  type="button"
                  aria-label="Remove text file"
                  onClick={() =>
                    setSelectedTextFiles((prev) =>
                      prev.filter((_, i) => i !== idx),
                    )
                  }
                  className="absolute -top-1.5 -right-1.5 z-10 hidden group-hover/preview-txt:flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-500 transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 上传图片微缩预览横轴 */}
        {selectedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1.5 py-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
            {selectedImages.map((url, idx) => (
              <div
                key={idx}
                className="relative group/preview-img w-14 h-14 shrink-0 rounded-[6px] border border-white/10 bg-white/[0.02]"
              >
                <Image
                  src={url}
                  preview={false}
                  aspectRatio="square"
                  className="w-full h-full rounded-[6px] object-cover"
                />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() =>
                    setSelectedImages((prev) =>
                      prev.filter((_, i) => i !== idx),
                    )
                  }
                  className="absolute -top-1.5 -right-1.5 z-10 hidden group-hover/preview-img:flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-500 transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 输入框 */}
        <textarea
          ref={textareaRef}
          rows={TEXTAREA_MIN_ROWS}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={handleTextareaCursorMove}
          onKeyUp={handleTextareaCursorMove}
          onPaste={handlePaste}
          placeholder="输入您的问题..."
          aria-label="AI Chat Input Area"
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
              bgClass="bg-[#303030]"
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
              aria-label="Add attachment"
              onClick={handleAttachmentClick}
              className={
                isImageSupported
                  ? "text-white/80 hover:text-white"
                  : "text-white/30 hover:text-white/50"
              }
            >
              <Paperclip className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              aria-label="Set tool mode"
              disabled
              className="text-white/30 cursor-not-allowed"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </IconButton>
          </div>

          {/* 右侧发送与清空按钮 */}
          <div className="flex items-center gap-1.5">
            {isBrowsingHistory && (
              <span className="text-xs text-white/45 select-none mr-0.5">
                {`History: ${historyCursorRef.current! + 1}/${promptHistory.length}`}
              </span>
            )}
            <button
              type="button"
              aria-label="Clear input"
              onClick={handleClearInput}
              disabled={!inputText}
              className={`h-6 w-6 rounded-full flex items-center justify-center bg-transparent transition-colors ${
                inputText
                  ? "text-white/45 hover:text-white"
                  : "text-white/10 cursor-not-allowed"
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <IconButton
              aria-label="Send message"
              onClick={handleSend}
              disabled={!canSend}
              highlighted={canSend}
              className={`rounded-full flex items-center justify-center transition-all ${
                canSend
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              <SendHorizontal className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
};
