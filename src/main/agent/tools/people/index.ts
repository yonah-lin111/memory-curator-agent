import type { AgentTool } from '@/agent/types';
import type { PeopleService } from '@/services/peopleService';

import { createPeopleQueryTool } from './tools/queryTool';
import { createPeopleAddTool } from './tools/addTool';
import { createPeopleUpdateTool } from './tools/updateTool';
import { createPeopleDeleteTool } from './tools/deleteTool';
import { createPeopleBatchAddTool } from './tools/batchAddTool';
import { createPeopleBatchUpdateTool } from './tools/batchUpdateTool';
import { createPeopleBatchDeleteTool } from './tools/batchDeleteTool';

export type * from './types';

export {
  createPeopleQueryTool,
  createPeopleAddTool,
  createPeopleUpdateTool,
  createPeopleDeleteTool,
  createPeopleBatchAddTool,
  createPeopleBatchUpdateTool,
  createPeopleBatchDeleteTool,
};

/**
 * 创建完整 People 工具组。
 */
export const createPeopleTools = (
  peopleService: Pick<
    PeopleService,
    "querySql" | "create" | "update" | "delete"
  >,
): AgentTool[] => [
  createPeopleQueryTool(peopleService),
  createPeopleAddTool(peopleService),
  createPeopleUpdateTool(peopleService),
  createPeopleDeleteTool(peopleService),
  createPeopleBatchAddTool(peopleService),
  createPeopleBatchUpdateTool(peopleService),
  createPeopleBatchDeleteTool(peopleService),
];
