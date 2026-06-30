import type { PeopleService } from '@/services/peopleService';
import type { ToolConfirmationConfig } from '@/agent/tools/toolConfirmation';
import type { PeopleWriteTool } from '../types';
import { PEOPLE_PROFILE_REQUIRED, PEOPLE_PROFILE_PROPERTIES } from '../constants';
import {
  isRecord,
  getPeopleInputString,
  parsePersonProfileInput,
  parseString,
  toToolItem,
} from '../utils';

// People 批量更新确认配置。
const PEOPLE_BATCH_UPDATE_CONFIRMATION: ToolConfirmationConfig = {
  header: '批量确认更新',
  question: '确认批量更新人物档案',
  confirm: '确认更新',
  cancel: '取消更新',
  renderTarget: (input: unknown): string | null => {
    if (!isRecord(input)) return null;
    const items = Array.isArray(input.items) ? input.items : [];
    return `${items.length} 项人物`;
  },
  renderSummary: (input: unknown): string | null => {
    if (!isRecord(input)) return null;
    const aiSummary = getPeopleInputString(input, 'confirmationSummary');
    if (aiSummary) return aiSummary;
    const items = Array.isArray(input.items) ? input.items : [];
    if (items.length === 0) return null;
    const previews = (items as unknown[]).slice(0, 3).map((item) => {
      if (!isRecord(item)) return null;
      const name = getPeopleInputString(item, 'name');
      const id = getPeopleInputString(item, 'id');
      return name ?? id ?? null;
    }).filter((p): p is string => Boolean(p));
    const suffix = items.length > 3 ? ` 等 ${items.length} 项` : '';
    return `将批量更新人物档案：${previews.join('、')}${suffix}。`;
  },
  completion: {
    renderMessage: (_input: unknown, result: { data: unknown }): string | null => {
      if (!isRecord(result.data)) return null;
      const count = (result.data as { count?: unknown }).count;
      return typeof count === 'number' ? `已批量更新 ${count} 项人物档案。` : '已批量更新人物档案。';
    }
  }
};

/**
 * 创建 People 批量更新工具。
 */
export const createPeopleBatchUpdateTool = (
  peopleService: Pick<PeopleService, 'update'>,
): PeopleWriteTool => ({
  name: 'people_tool_batch_update',
  description: 'Update multiple people profiles at once in the local People table by id.',
  confirmation: PEOPLE_BATCH_UPDATE_CONFIRMATION,
  prompt: {
    summary: 'Batch update multiple profiles in the local People table by id.',
    intentKeywords: [
      '批量修改',
      '批量更新',
      '批量纠正',
      'batch update people',
      'batch edit profiles'
    ],
    whenToUse: [
      'Use when the user explicitly asks to update multiple people profiles at once.',
      'Use after people_tool_query when the user identifies multiple profiles to update.',
      'Use when the user asks to apply the same change across multiple people.'
    ],
    whenNotToUse: [
      'Do not use for updating a single profile — use people_tool_update instead.',
      'Do not use for creating new profiles.',
      'Do not use when target profile ids are unknown or ambiguous.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm updates; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For batch updates, confirmationSummary must summarize the changes (count, key fields being modified).',
      'Each item must include its string id and a complete replacement profile.',
      'Query first when the user provides names instead of ids, then merge unchanged fields before updating.',
      'Never overwrite fields with guesses.'
    ],
    output: 'Include confirmationSummary in the tool arguments; return count and updated profile facts needed by the user.',
    examples: [
      '{"confirmationSummary":"将批量更新 2 项人物档案的标签。","items":[{"id":"person-1","avatar":"","name":"小陈","gender":"","relationship":"朋友","status":"","birthday":"","contact":"","tags":["设计"],"details":""},{"id":"person-2","avatar":"","name":"阿明","gender":"男","relationship":"同事","status":"技术负责人","birthday":"","contact":"","tags":["极客","开源"],"details":""}]}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['items', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description:
          'Concise Markdown Chinese explanation shown above the internal confirmation. Summarize all items and key changed fields.'
      },
      items: {
        type: 'array',
        description: 'Array of people profiles to update, each with id and complete profile fields',
        items: {
          type: 'object',
          required: ['id', ...PEOPLE_PROFILE_REQUIRED],
          properties: {
            id: {
              type: 'string',
              description: 'People profile id'
            },
            ...PEOPLE_PROFILE_PROPERTIES
          }
        }
      }
    }
  },
  execute: async (input) => {
    if (!isRecord(input) || !Array.isArray(input.items)) {
      throw new Error('People batch update requires items array');
    }

    const results = (input.items as unknown[]).map((item) => {
      if (!isRecord(item)) {
        throw new Error('People batch update item must be an object');
      }
      const id = parseString(item.id)?.trim();
      if (!id) {
        throw new Error('People batch update requires id for each item');
      }
      const updated = peopleService.update(id, parsePersonProfileInput(item as Record<string, unknown>));
      return toToolItem(updated);
    });

    return {
      observation: `Batch updated ${results.length} people profiles.`,
      data: { items: results, count: results.length }
    };
  }
});
