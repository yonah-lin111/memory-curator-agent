import type { AiChatMessagePart } from "@/features/ai-chat/types";

// AI 输入框可选择的 agent 标识。
export type AiChatAgentId = "people" | "todo" | "snippets" | "journal" | "notes" | "today" | "common" | "bills";

// AI 输入框 agent mention 选项。
export type AiChatAgentMentionOption = {
  // Agent 唯一标识。
  id: AiChatAgentId;
  // 写入输入框的完整 token。
  token: string;
  // 面板展示名称。
  label: string;
  // 面板展示描述。
  description: string;
};

// AI 输入框已选择 agent mention。
export type AiChatInputAgentMention = {
  // Agent 唯一标识。
  id: AiChatAgentId;
  // 输入框中的完整 token。
  token: string;
  // 展示名称。
  label: string;
  // 本轮 agent 优先级，数字越小越优先。
  priority: number;
};

// 发送给对话控制器的干净输入载荷。
export type AiChatSendPayload = {
  // 已剥离 agent token 的用户正文。
  text: string;
  // 本轮选择的 agent mention。
  agents: AiChatInputAgentMention[];
  // 本轮附带的多模态消息片段。
  parts?: AiChatMessagePart[];
};

// 发送给主进程的 agent hint。
export type AiChatAgentHint = {
  // Agent 唯一标识。
  id: AiChatAgentId;
  // 本轮 agent 优先级，数字越小越优先。
  priority: number;
};

// Agent token 在输入文本中的位置。
export type AiChatAgentMentionRange = {
  // token 起始位置。
  start: number;
  // token 结束位置。
  end: number;
  // 匹配到的 agent 选项。
  option: AiChatAgentMentionOption;
};

// 解析后的输入文本。
export type AiChatParsedAgentMentionText = {
  // 已剥离 agent token 的用户正文。
  text: string;
  // 本轮选择的 agent mention。
  agents: AiChatInputAgentMention[];
  // 完整 token 在原始文本中的范围。
  ranges: AiChatAgentMentionRange[];
};

// 删除完整 agent token 的范围。
export type AiChatAgentMentionDeletionRange = {
  // 删除起始位置。
  start: number;
  // 删除结束位置。
  end: number;
};

// 输入框支持的 agent mention 选项。
export const AI_CHAT_AGENT_MENTION_OPTIONS: AiChatAgentMentionOption[] = [
  {
    id: "people",
    token: "@people_agent",
    label: "people",
    description: "检索人物背景，关联社交网络与人脉档案",
  },
  {
    id: "todo",
    token: "@todo_agent",
    label: "todo",
    description: "梳理待办任务，跟踪计划、目标与日程进度",
  },
  {
    id: "snippets",
    token: "@snippets_agent",
    label: "snippets",
    description: "捕捉瞬时灵感、随笔片段与知识火花",
  },
  {
    id: "journal",
    token: "@journal_agent",
    label: "journal",
    description: "回顾个人日记，串联生活随感与阶段复盘",
  },
  {
    id: "notes",
    token: "@notes_agent",
    label: "notes",
    description: "沉淀深度思考，管理长期笔记与知识体系",
  },
  {
    id: "today",
    token: "@today_agent",
    label: "today",
    description: "聚焦当下，快速关联今天的即时记录与活动线索",
  },
  {
    id: "bills",
    token: "@bills_agent",
    label: "bills",
    description: "检索账单记录，查询收支明细与今日消费摘要",
  },
  {
    id: "common",
    token: "@common_agent",
    label: "common",
    description: "直接解答，仅可使用通用工具，不调用业务 Agent",
  },
];

// Agent token 匹配表达式，只接受空白边界包围的完整 token。
const AGENT_TOKEN_PATTERN = /(^|\s)(@(people|todo|snippets|journal|notes|today|common|bills)_agent)(?=$|\s)/g;

// Agent 选项索引。
const AGENT_OPTIONS_BY_ID = new Map(AI_CHAT_AGENT_MENTION_OPTIONS.map((option) => [option.id, option]));

/**
 * 判断字符串是否为内置 agent 标识。
 */
export const isAiChatAgentId = (value: string): value is AiChatAgentId => AGENT_OPTIONS_BY_ID.has(value as AiChatAgentId);

/**
 * 通过 agent 标识获取配置。
 */
export const getAiChatAgentMentionOption = (id: AiChatAgentId): AiChatAgentMentionOption => {
  const option = AGENT_OPTIONS_BY_ID.get(id);
  if (!option) {
    throw new Error(`Unknown AI chat agent mention: ${id}`);
  }

  return option;
};

/**
 * 使用子序列规则匹配 agent 查询词。
 */
const isFuzzyAgentMatch = (query: string, keyword: string): boolean => {
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
 * 获取当前 @ 查询可匹配的 agent 列表。
 */
export const getMatchedAiChatAgentMentions = (query: string): AiChatAgentMentionOption[] => {
  const normalizedQuery = query.trim().toLowerCase().replace(/^@/, "");

  return AI_CHAT_AGENT_MENTION_OPTIONS.filter((option) =>
    [option.id, option.label, option.token.replace(/^@/, "")].some((keyword) =>
      isFuzzyAgentMatch(normalizedQuery, keyword.toLowerCase()),
    ),
  );
};

/**
 * 查找输入文本中的完整 agent token。
 */
const collectAgentMentionRanges = (value: string): AiChatAgentMentionRange[] => {
  const ranges: AiChatAgentMentionRange[] = [];
  AGENT_TOKEN_PATTERN.lastIndex = 0;

  let match = AGENT_TOKEN_PATTERN.exec(value);
  while (match) {
    const prefix = match[1] ?? "";
    const token = match[2] ?? "";
    const id = match[3] ?? "";

    if (isAiChatAgentId(id)) {
      const start = match.index + prefix.length;
      ranges.push({
        start,
        end: start + token.length,
        option: getAiChatAgentMentionOption(id),
      });
    }

    match = AGENT_TOKEN_PATTERN.exec(value);
  }

  return ranges;
};

/**
 * 剥离完整 agent token 并压缩多余空白。
 */
const stripAgentMentionTokens = (value: string): string => {
  AGENT_TOKEN_PATTERN.lastIndex = 0;

  return value
    .replace(AGENT_TOKEN_PATTERN, (_match, prefix: string) => prefix)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
};

/**
 * 解析输入文本中的 agent token 和干净正文。
 */
export const parseAiChatAgentMentionText = (value: string): AiChatParsedAgentMentionText => {
  const ranges = collectAgentMentionRanges(value);
  const seenAgentIds = new Set<AiChatAgentId>();
  const agents: AiChatInputAgentMention[] = [];

  for (const range of ranges) {
    if (seenAgentIds.has(range.option.id)) {
      continue;
    }

    seenAgentIds.add(range.option.id);
    agents.push({
      id: range.option.id,
      token: range.option.token,
      label: range.option.label,
      priority: agents.length + 1,
    });
  }

  return {
    text: stripAgentMentionTokens(value),
    agents,
    ranges,
  };
};

/**
 * 创建发送给 AI 对话控制器的干净载荷。
 */
export const createAiChatSendPayload = (value: string): AiChatSendPayload => {
  const parsed = parseAiChatAgentMentionText(value);

  return {
    text: parsed.text,
    agents: parsed.agents,
  };
};

/**
 * 转成主进程只需要的 agent hint。
 */
export const toAiChatAgentHints = (agents: AiChatInputAgentMention[]): AiChatAgentHint[] =>
  agents.map((agent) => ({
    id: agent.id,
    priority: agent.priority,
  }));

/**
 * 获取 Backspace 应删除的完整 agent token 范围。
 */
export const getAiChatAgentMentionDeletionRange = (
  value: string,
  cursor: number,
): AiChatAgentMentionDeletionRange | null => {
  const ranges = collectAgentMentionRanges(value);
  const directRange = ranges.find((range) => range.end === cursor);
  if (directRange) {
    return {
      start: directRange.start,
      end: directRange.end,
    };
  }

  const previousCharacter = value[cursor - 1];
  if (previousCharacter && /\s/.test(previousCharacter)) {
    const rangeBeforeSpace = ranges.find((range) => range.end === cursor - 1);
    if (rangeBeforeSpace) {
      return {
        start: rangeBeforeSpace.start,
        end: cursor,
      };
    }
  }

  return null;
};
