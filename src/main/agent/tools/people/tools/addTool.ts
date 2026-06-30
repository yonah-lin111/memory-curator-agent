import type { AssociatedPersonCreateInput } from '@/db/schema';
import type { PeopleService } from '@/services/peopleService';
import type { ToolConfirmationConfig } from '@/agent/tools/toolConfirmation';
import type { PeopleWriteTool } from '../types';
import { PEOPLE_PROFILE_REQUIRED, PEOPLE_PROFILE_PROPERTIES } from '../constants';
import {
  isRecord,
  parsePersonProfileInput,
  renderPeopleMutationTarget,
  renderPeopleMutationSummary,
  renderPeopleMutationCompletion,
  toToolItem,
} from '../utils';

/**
 * 解析 People 新建入参。
 */
const parseCreateInput = (input: unknown): AssociatedPersonCreateInput => {
  if (!isRecord(input)) {
    throw new Error("People profile input must be an object");
  }

  return parsePersonProfileInput(input as Record<string, unknown>);
};

// People 创建确认配置。
const PEOPLE_ADD_CONFIRMATION: ToolConfirmationConfig = {
  header: "确认创建",
  question: "确认创建人物档案",
  confirm: "确认创建",
  cancel: "取消创建",
  renderTarget: renderPeopleMutationTarget,
  renderSummary: (input) => renderPeopleMutationSummary("add", input),
  completion: {
    renderMessage: (input, result) =>
      renderPeopleMutationCompletion("add", input, result as { data: unknown }),
  },
};

/**
 * 创建 People 新建工具。
 */
export const createPeopleAddTool = (
  peopleService: Pick<PeopleService, "create">,
): PeopleWriteTool => ({
  name: "people_tool_add",
  description: "Create a people profile in the local People table.",
  confirmation: PEOPLE_ADD_CONFIRMATION,
  prompt: {
    summary: "Create a new profile in the local People table.",
    intentKeywords: [
      "添加",
      "新增",
      "创建",
      "记录",
      "恢复",
      "还原",
      "找回",
      "重新添加",
      "新建人物",
      "add person",
      "create person",
      "restore person",
    ],
    whenToUse: [
      "Use when the user explicitly asks to create or save a new people profile.",
      "Use common_tool_ask to ask for missing required facts when the create request is ambiguous or underspecified.",
    ],
    whenNotToUse: [
      "Do not use for read-only questions about existing people profiles.",
      "Do not use when the user has not asked to save data.",
    ],
    safety: [
      "Do not call common_tool_ask only to confirm creation; the system will request internal confirmation before execution.",
      "Write confirmationSummary yourself in concise Markdown Chinese before confirmation.",
      "For creation, confirmationSummary must include the target name, relationship, and key known profile facts or fields being added; do not write only a generic create sentence.",
      "Use human-readable names and relationships in confirmationSummary; do not use profile ids unless there is no readable target.",
      "Only create structured people profiles through PeopleService.",
      "Use empty strings or an empty tags array for absent optional-looking fields.",
      "Write details as Markdown content, not plain unstructured fragments.",
      "Never invent profile facts the user did not provide or confirm.",
    ],
    output: "Include confirmationSummary in the tool arguments with key created facts; return the created people profile facts needed by the user.",
    examples: [
      '{"confirmationSummary":"将创建人物档案：**小陈**（朋友）。\\n- 状态：新朋友\\n- 标签：设计","name":"小陈","gender":"","relationship":"朋友","status":"新朋友","birthday":"","contact":"","tags":["设计"],"details":"","avatar":""}',
    ],
  },
  parameters: {
    type: "object",
    required: PEOPLE_PROFILE_REQUIRED,
    properties: PEOPLE_PROFILE_PROPERTIES,
  },
  execute: async (input) => {
    const created = peopleService.create(parseCreateInput(input));

    return {
      observation: `Created people profile: ${created.name}.`,
      data: {
        item: toToolItem(created),
      },
    };
  },
});
