import type { AiChatInputCommand } from "@/features/ai-chat/components/AiChatInput/types";

// AI 输入框支持的斜杠命令。
export const AI_CHAT_INPUT_COMMANDS: AiChatInputCommand[] = [
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
  {
    id: "showContextTimeline",
    name: "/showContextTimeline",
    aliases: [],
    description: "显示或隐藏上下文时间线",
    addToContext: false,
  },
  {
    id: "session",
    name: "/session",
    aliases: ["/resume"],
    description: "快速搜索历史对话并进行切换",
    addToContext: false,
  },
  {
    id: "showFullScreen",
    name: "/showFullScreen",
    aliases: [],
    description: "折叠侧边栏和上下文时间线",
    addToContext: false,
  },
];

// 输入框最小显示行数。
export const TEXTAREA_MIN_ROWS = 2;

// 输入框最大显示行数。
export const TEXTAREA_MAX_ROWS = 6;

// 测不到 CSS line-height 时的兜底行高。
export const FALLBACK_LINE_HEIGHT = 21;

// 本地兜底历史最大保留数量，与主进程服务保持一致。
export const PROMPT_HISTORY_LIMIT = 100;

// 容器点击时不抢焦点的交互元素。
export const INTERACTIVE_SELECTOR =
  "button, select, input, textarea, a, [role='button'], [role='listbox'], [role='option']";

// 文本文件支持的最大数量。
export const MAX_TEXT_FILES = 6;

// 文本文件 MIME 类型集合。
export const SUPPORTED_TEXT_MIME_TYPES = new Set([
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
