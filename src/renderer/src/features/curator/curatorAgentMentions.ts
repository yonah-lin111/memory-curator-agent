import type { CuratorMessagePart } from "@/features/curator/types";

// AI 输入框可选择的 agent 标识。
export type CuratorAgentId = "people" | "todo" | "snippets" | "journal" | "notes" | "today" | "common" | "bills";

// AI 输入框 agent mention 选项。
export type CuratorAgentMentionOption = {
  // Agent 唯一标识。
  id: CuratorAgentId;
  // 写入输入框的完整 token。
  token: string;
  // 面板展示名称。
  label: string;
  // 面板展示描述。
  description: string;
};

// AI 输入框已选择 agent mention。
export type CuratorInputAgentMention = {
  // Agent 唯一标识。
  id: CuratorAgentId;
  // 输入框中的完整 token。
  token: string;
  // 展示名称。
  label: string;
  // 本轮 agent 优先级，数字越小越优先。
  priority: number;
};

// 发送给对话控制器的干净输入载荷。
export type CuratorSendPayload = {
  // 已剥离 agent token 的用户正文。
  text: string;
  // 本轮选择的 agent mention。
  agents: CuratorInputAgentMention[];
  // 本轮附带的多模态消息片段。
  parts?: CuratorMessagePart[];
};

// 发送给主进程的 agent hint。
export type CuratorAgentHint = {
  // Agent 唯一标识。
  id: CuratorAgentId;
  // 本轮 agent 优先级，数字越小越优先。
  priority: number;
};

// Agent token 在输入文本中的位置。
export type CuratorAgentMentionRange = {
  // token 起始位置。
  start: number;
  // token 结束位置。
  end: number;
  // 匹配到的 agent 选项。
  option: CuratorAgentMentionOption;
};

// 解析后的输入文本。
export type CuratorParsedAgentMentionText = {
  // 已剥离 agent token 的用户正文。
  text: string;
  // 本轮选择的 agent mention。
  agents: CuratorInputAgentMention[];
  // 完整 token 在原始文本中的范围。
  ranges: CuratorAgentMentionRange[];
};

// 删除完整 agent token 的范围。
export type CuratorAgentMentionDeletionRange = {
  // 删除起始位置。
  start: number;
  // 删除结束位置。
  end: number;
};

// 输入框支持的 agent mention 选项。
export const CURATOR_AGENT_MENTION_OPTIONS: CuratorAgentMentionOption[] = [
  {
    id: "people",
    token: "@people[tool]",
    label: "people",
    description: "检索人物背景，关联社交网络与人脉档案",
  },
  {
    id: "todo",
    token: "@todo[tool]",
    label: "todo",
    description: "梳理待办任务，跟踪计划、目标与日程进度",
  },
  {
    id: "snippets",
    token: "@snippet[tool]",
    label: "snippet",
    description: "捕捉瞬时灵感、随笔片段与知识火花",
  },
  {
    id: "journal",
    token: "@journal[tool]",
    label: "journal",
    description: "回顾个人日记，串联生活随感与阶段复盘",
  },
  {
    id: "notes",
    token: "@note[tool]",
    label: "note",
    description: "沉淀深度思考，管理长期笔记与知识体系",
  },
  {
    id: "today",
    token: "@today[tool]",
    label: "today",
    description: "聚焦当下，快速关联今天的即时记录与活动线索",
  },
  {
    id: "bills",
    token: "@bill[tool]",
    label: "bill",
    description: "检索账单记录，查询收支明细与今日消费摘要",
  },
  {
    id: "common",
    token: "@common[tool]",
    label: "common",
    description: "直接解答，仅可使用通用工具，不调用业务 Agent",
  },
];

// Tool token 匹配表达式，只接受空白边界包围的带有 [tool] 后缀的完整 token。
const AGENT_TOKEN_PATTERN = /(^|\s)(@(people|person|todos?|snippets?|journals?|notes?|today|bills?|common)\[tool\])(?=$|\s)/g;

// 提及关键字到内置 CuratorAgentId 的归一化映射。
const NORMALIZE_ID_MAP: Record<string, CuratorAgentId> = {
  person: "people",
  people: "people",
  todo: "todo",
  todos: "todo",
  snippet: "snippets",
  snippets: "snippets",
  journal: "journal",
  journals: "journal",
  note: "notes",
  notes: "notes",
  today: "today",
  bill: "bills",
  bills: "bills",
  common: "common",
};

// Agent 选项索引。
const AGENT_OPTIONS_BY_ID = new Map(CURATOR_AGENT_MENTION_OPTIONS.map((option) => [option.id, option]));

/**
 * 判断字符串是否为内置 agent 标识。
 */
export const isCuratorAgentId = (value: string): value is CuratorAgentId => AGENT_OPTIONS_BY_ID.has(value as CuratorAgentId);

/**
 * 通过 agent 标识获取配置。
 */
export const getCuratorAgentMentionOption = (id: CuratorAgentId): CuratorAgentMentionOption => {
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
export const getMatchedCuratorAgentMentions = (query: string): CuratorAgentMentionOption[] => {
  const normalizedQuery = query.trim().toLowerCase().replace(/^@/, "");

  return CURATOR_AGENT_MENTION_OPTIONS.filter((option) =>
    [option.id, option.label, option.token.replace(/^@/, "")].some((keyword) =>
      isFuzzyAgentMatch(normalizedQuery, keyword.toLowerCase()),
    ),
  );
};

/**
 * 查找输入文本中的完整 agent token。
 */
const collectAgentMentionRanges = (value: string): CuratorAgentMentionRange[] => {
  const ranges: CuratorAgentMentionRange[] = [];
  AGENT_TOKEN_PATTERN.lastIndex = 0;

  let match = AGENT_TOKEN_PATTERN.exec(value);
  while (match) {
    const prefix = match[1] ?? "";
    const token = match[2] ?? "";
    const rawId = match[3] ?? "";
    const id = NORMALIZE_ID_MAP[rawId.toLowerCase()] || "";

    if (isCuratorAgentId(id)) {
      const start = match.index + prefix.length;
      ranges.push({
        start,
        end: start + token.length,
        option: getCuratorAgentMentionOption(id),
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
export const parseCuratorAgentMentionText = (value: string): CuratorParsedAgentMentionText => {
  const ranges = collectAgentMentionRanges(value);
  const seenAgentIds = new Set<CuratorAgentId>();
  const agents: CuratorInputAgentMention[] = [];

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
export const createCuratorSendPayload = (value: string): CuratorSendPayload => {
  const parsed = parseCuratorAgentMentionText(value);

  return {
    text: parsed.text,
    agents: parsed.agents,
  };
};

/**
 * 转成主进程只需要的 agent hint。
 */
export const toCuratorAgentHints = (agents: CuratorInputAgentMention[]): CuratorAgentHint[] =>
  agents.map((agent) => ({
    id: agent.id,
    priority: agent.priority,
  }));

/**
 * 获取 Backspace 应删除的完整 agent token 范围。
 */
export const getCuratorAgentMentionDeletionRange = (
  value: string,
  cursor: number,
): CuratorAgentMentionDeletionRange | null => {
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
