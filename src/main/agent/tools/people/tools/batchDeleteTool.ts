import type { PeopleService } from '@/services/peopleService';
import type { ToolConfirmationConfig } from '@/agent/tools/toolConfirmation';
import type { PeopleWriteTool } from '../types';
import { isRecord, getPeopleInputString } from '../utils';

// People 批量删除确认配置。
const PEOPLE_BATCH_DELETE_CONFIRMATION: ToolConfirmationConfig = {
  header: '批量确认删除',
  question: '确认批量永久删除人物档案',
  confirm: '确认删除',
  cancel: '取消删除',
  renderTarget: (input: unknown): string | null => {
    if (!isRecord(input)) return null;
    const ids = Array.isArray(input.ids) ? input.ids : [];
    return `${ids.length} 项人物`;
  },
  renderSummary: (input: unknown): string | null => {
    if (!isRecord(input)) return null;
    const aiSummary = getPeopleInputString(input, 'confirmationSummary');
    if (aiSummary) return aiSummary;
    const ids = Array.isArray(input.ids) ? input.ids : [];
    return ids.length > 0 ? `将批量删除 ${ids.length} 项人物档案。` : null;
  },
  completion: {
    renderMessage: (_input: unknown, result: { data: unknown }): string | null => {
      if (!isRecord(result.data)) return null;
      const count = (result.data as { count?: unknown }).count;
      return typeof count === 'number' ? `已批量删除 ${count} 项人物档案。` : '已批量删除人物档案。';
    }
  }
};

/**
 * 创建 People 批量删除工具。
 */
export const createPeopleBatchDeleteTool = (
  peopleService: Pick<PeopleService, 'delete'>,
): PeopleWriteTool => ({
  name: 'people_tool_batch_delete',
  description: 'Delete multiple people profiles at once from the local People table by id.',
  confirmation: PEOPLE_BATCH_DELETE_CONFIRMATION,
  prompt: {
    summary: 'Batch delete multiple profiles from the local People table by id.',
    intentKeywords: [
      '批量删除',
      '批量移除',
      '清空人物',
      '全部删除',
      'batch delete people',
      'remove all profiles'
    ],
    whenToUse: [
      'Use when the user explicitly asks to delete multiple people profiles at once.',
      'Use after people_tool_query when the user identifies multiple profiles to delete.',
      'Use when the user asks to "clear all people" or similar bulk deletion.'
    ],
    whenNotToUse: [
      'Do not use for deleting a single profile — use people_tool_delete instead.',
      'Do not use for temporary filtering or hiding.',
      'Do not use when target profile ids are unknown or ambiguous.'
    ],
    safety: [
      'Do not call common_tool_ask only to confirm deletion; the system will request internal confirmation before execution.',
      'Write confirmationSummary yourself in concise Markdown Chinese before confirmation.',
      'For batch deletion, confirmationSummary must identify the count and key distinguishing facts of profiles being deleted.',
      'Use human-readable names in confirmationSummary; do not use profile ids unless there is no readable target.',
      'Require exact string profile ids.',
      'Ask the user for clarification before deleting when the set of profiles is ambiguous.',
      'Batch deletion is permanent and cannot be undone — be conservative.'
    ],
    output: 'Include confirmationSummary in the tool arguments; return count and concise deletion confirmation.',
    examples: [
      '{"confirmationSummary":"将批量删除 2 项人物档案：小陈（朋友）和阿明（同事）。","ids":["person-1","person-2"]}'
    ]
  },
  parameters: {
    type: 'object',
    required: ['ids', 'confirmationSummary'],
    properties: {
      confirmationSummary: {
        type: 'string',
        description:
          'Concise Markdown Chinese explanation shown above the internal confirmation. Include the count and key distinguishing facts.'
      },
      ids: {
        type: 'array',
        description: 'Array of people profile ids to delete',
        items: {
          type: 'string',
          description: 'People profile id'
        }
      }
    }
  },
  execute: async (input) => {
    if (!isRecord(input) || !Array.isArray(input.ids) || input.ids.some((id: unknown) => typeof id !== 'string')) {
      throw new Error('People batch delete requires ids array of strings');
    }

    const ids = input.ids as string[];
    ids.forEach((id) => {
      peopleService.delete(id);
    });

    return {
      observation: `Batch deleted ${ids.length} people profiles.`,
      data: { ids, count: ids.length }
    };
  }
});
