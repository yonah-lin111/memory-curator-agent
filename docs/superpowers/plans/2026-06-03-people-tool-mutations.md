# People Tool Mutations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the People Agent tools from one read-only `people_query` tool to `people_tool.query`, `people_tool.add`, `people_tool.update`, and `people_tool.delete`.

**Architecture:** Keep Agent core unchanged and register four focused tools with namespaced names. Reuse `PeopleService` for all writes; the tool layer only parses input, defines JSON schemas, renders observations, and declares prompt boundaries.

**Tech Stack:** Electron main process, TypeScript, Vitest, AI SDK 6, better-sqlite3-backed `PeopleService`.

---

## File Structure

- Modify: `src/main/agent/tools/peopleTool.ts`
  - Rename query tool name to `people_tool.query`.
  - Add shared People input schema constants.
  - Add `createPeopleAddTool`, `createPeopleUpdateTool`, `createPeopleDeleteTool`.
  - Add `createPeopleTools` convenience factory returning all four tools.
  - State that add may use `ask_user` for missing facts and that `details` must be Markdown.
- Modify: `src/main/agent/tools/toolRegistry.ts`
  - Widen `peopleService` context to include `create`, `update`, `delete`.
  - Register all People tools.
  - Keep validation and selection logic generic.
- Modify: `src/main/agent/core/reactAgent.ts`
  - Reject `people_tool.add`, `people_tool.update`, and `people_tool.delete` unless the current user request already has a positive `ask_user` confirmation answer.
- Modify: `src/main/agent/types.ts`
  - Add explicit People write tool input/result aliases only if implementation needs exported types.
- Modify: `test/main/agent/tools/peopleTool.test.ts`
  - Replace query factory expectations and add write tool tests.
- Modify: `test/main/agent/tools/toolRegistry.test.ts`
  - Update registered tool names and intent filtering expectations.
- Modify: `test/main/agent/core/reactAgent.test.ts`
  - Cover the hard `ask_user` confirmation gate for People update/delete.
- Modify: `test/main/agent/providers/aiSdkProvider.test.ts`
  - Replace `people_query` with `people_tool.query`.
  - Add one assertion that dotted tool names are preserved in prepared AI SDK tools.
- Modify: existing tests under `test/main/agent/core`, `test/main/ipc`, `test/main/services`, `test/renderer`
  - Replace stale `people_query` expectations with `people_tool.query`.
  - Add one write-tool error display case only where the component already tests tool names generically.

### Task 1: Update People Tool Tests First

**Files:**
- Modify: `test/main/agent/tools/peopleTool.test.ts`

- [ ] **Step 1: Change imports and service stub shape**

Replace the existing import and service type with this shape:

```ts
import { describe, expect, it, vi } from "vitest";
import type {
  AssociatedPersonCreateInput,
  AssociatedPersonItem,
  AssociatedPersonUpdateInput,
} from "../../../../src/main/db/schema";
import {
  createPeopleAddTool,
  createPeopleDeleteTool,
  createPeopleQueryTool,
  createPeopleTools,
  createPeopleUpdateTool,
} from "../../../../src/main/agent/tools/peopleTool";
import type { PeopleService } from "../../../../src/main/services/peopleService";
```

Keep the existing `people`, `toSqlRow`, and `matchesBaseQuery` helpers.

- [ ] **Step 2: Rename query tool expectations**

In existing query tests, keep `createPeopleQueryTool(peopleService)` but assert the new name once:

```ts
it("使用 people_tool.query 作为查询工具名", () => {
  const tool = createPeopleQueryTool(peopleService);

  expect(tool.name).toBe("people_tool.query");
});
```

Run:

```bash
pnpm test test/main/agent/tools/peopleTool.test.ts
```

Expected: fail because the tool still returns `people_query`.

- [ ] **Step 3: Add write service stub**

Add this stub after the existing `peopleService` query stub:

```ts
const peopleWriteService: Pick<
  PeopleService,
  "querySql" | "create" | "update" | "delete"
> = {
  ...peopleService,
  create: vi.fn((input: AssociatedPersonCreateInput) => ({
    id: "person-new",
    createdAt: "2026-06-03 10:00",
    updatedAt: "2026-06-03 10:00",
    ...input,
  })),
  update: vi.fn((id: string, input: AssociatedPersonUpdateInput) => ({
    id,
    createdAt: "2026-05-01 10:00",
    updatedAt: "2026-06-03 10:00",
    ...input,
  })),
  delete: vi.fn(),
};
```

- [ ] **Step 4: Add add/update/delete tests**

Add these tests inside `describe("peopleTool", () => { ... })`:

```ts
it("添加人物并返回创建后的资料", async () => {
  const tool = createPeopleAddTool(peopleWriteService);

  const result = await tool.execute({
    avatar: "",
    name: "小陈",
    gender: "女",
    relationship: "朋友",
    status: "新朋友",
    birthday: "",
    contact: "微信",
    tags: ["设计"],
    details: "# 小陈",
  });

  expect(tool.name).toBe("people_tool.add");
  expect(peopleWriteService.create).toHaveBeenCalledWith({
    avatar: "",
    name: "小陈",
    gender: "女",
    relationship: "朋友",
    status: "新朋友",
    birthday: "",
    contact: "微信",
    tags: ["设计"],
    details: "# 小陈",
  });
  expect(result.observation).toBe("Created people profile: 小陈.");
  expect(result.data).toMatchObject({
    item: {
      id: "person-new",
      name: "小陈",
    },
  });
});

it("修改人物并返回更新后的资料", async () => {
  const tool = createPeopleUpdateTool(peopleWriteService);

  const result = await tool.execute({
    id: "person-1",
    avatar: "",
    name: "阿明",
    gender: "男",
    relationship: "朋友",
    status: "技术负责人",
    birthday: "09月11日",
    contact: "GitHub: aming-coder",
    tags: ["极客"],
    details: "# 阿明\n更新后的详情。",
  });

  expect(tool.name).toBe("people_tool.update");
  expect(peopleWriteService.update).toHaveBeenCalledWith("person-1", {
    avatar: "",
    name: "阿明",
    gender: "男",
    relationship: "朋友",
    status: "技术负责人",
    birthday: "09月11日",
    contact: "GitHub: aming-coder",
    tags: ["极客"],
    details: "# 阿明\n更新后的详情。",
  });
  expect(result.observation).toBe("Updated people profile: 阿明.");
  expect(result.data).toMatchObject({
    item: {
      id: "person-1",
      status: "技术负责人",
    },
  });
});

it("删除人物并返回删除 ID", async () => {
  const tool = createPeopleDeleteTool(peopleWriteService);

  const result = await tool.execute({
    id: "person-1",
  });

  expect(tool.name).toBe("people_tool.delete");
  expect(peopleWriteService.delete).toHaveBeenCalledWith("person-1");
  expect(result.observation).toBe("Deleted people profile: person-1.");
  expect(result.data).toEqual({
    id: "person-1",
  });
});

it("集中创建四个 People 工具", () => {
  expect(createPeopleTools(peopleWriteService).map((tool) => tool.name)).toEqual([
    "people_tool.query",
    "people_tool.add",
    "people_tool.update",
    "people_tool.delete",
  ]);
});
```

Run:

```bash
pnpm test test/main/agent/tools/peopleTool.test.ts
```

Expected: fail because write tool factories do not exist.

### Task 2: Implement People Write Tools

**Files:**
- Modify: `src/main/agent/tools/peopleTool.ts`

- [ ] **Step 1: Import write input types**

Change the first import to include write input types:

```ts
import type {
  AssociatedPersonCreateInput,
  AssociatedPersonItem,
  AssociatedPersonUpdateInput,
  PersonRelationship,
} from "../../db/schema";
```

- [ ] **Step 2: Add write tool type aliases and shared schema**

Add after `type PeopleQueryTool = ...`:

```ts
// People 写入工具结果。
type PeopleWriteToolResult = {
  // 回灌模型的观察文本。
  observation: string;
  // 调试或 UI 可用结构化数据。
  data: unknown;
};

// People 写入工具类型。
type PeopleWriteTool = Omit<AgentTool, "execute"> & {
  /**
   * 执行 People 写入。
   */
  execute: (input: unknown) => Promise<PeopleWriteToolResult>;
};

// People 关系枚举 Schema。
const PEOPLE_RELATIONSHIP_SCHEMA = {
  type: "string",
  enum: ["女朋友", "家人", "朋友", "同事", "其他"],
  description: "Relationship category",
};

// People 完整资料字段 Schema。
const PEOPLE_PROFILE_PROPERTIES = {
  avatar: {
    type: "string",
    description: "Avatar URI. Use an empty string when absent.",
  },
  name: {
    type: "string",
    description: "Person name",
  },
  gender: {
    type: "string",
    description: "Gender text. Use an empty string when absent.",
  },
  relationship: PEOPLE_RELATIONSHIP_SCHEMA,
  status: {
    type: "string",
    description: "Current status or short summary. Use an empty string when absent.",
  },
  birthday: {
    type: "string",
    description: "Birthday text. Use an empty string when absent.",
  },
  contact: {
    type: "string",
    description: "Contact details. Use an empty string when absent.",
  },
  tags: {
    type: "array",
    items: {
      type: "string",
    },
    description: "Profile tags",
  },
  details: {
    type: "string",
    description: "Full Markdown details. Use an empty string when absent.",
  },
};

// People 完整资料必填字段。
const PEOPLE_PROFILE_REQUIRED = [
  "avatar",
  "name",
  "gender",
  "relationship",
  "status",
  "birthday",
  "contact",
  "tags",
  "details",
];
```

- [ ] **Step 3: Add parsers for write input**

Add after `parseInput`:

```ts
/**
 * 解析字符串数组字段。
 */
const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

/**
 * 解析完整人物资料输入。
 */
const parsePersonProfileInput = (
  input: Record<string, unknown>,
): AssociatedPersonCreateInput => ({
  avatar: parseString(input.avatar) ?? "",
  name: parseString(input.name) ?? "",
  gender: parseString(input.gender) ?? "",
  relationship: (parseString(input.relationship) ?? "其他") as PersonRelationship,
  status: parseString(input.status) ?? "",
  birthday: parseString(input.birthday) ?? "",
  contact: parseString(input.contact) ?? "",
  tags: parseStringArray(input.tags),
  details: parseString(input.details) ?? "",
});

/**
 * 解析 People 新建入参。
 */
const parseCreateInput = (input: unknown): AssociatedPersonCreateInput => {
  if (!isRecord(input)) {
    throw new Error("People profile input must be an object");
  }

  return parsePersonProfileInput(input);
};

/**
 * 解析 People 更新入参。
 */
const parseUpdateInput = (
  input: unknown,
): { id: string; profile: AssociatedPersonUpdateInput } => {
  if (!isRecord(input)) {
    throw new Error("People update input must be an object");
  }

  const id = parseString(input.id)?.trim();
  if (!id) {
    throw new Error("People update requires id");
  }

  return {
    id,
    profile: parsePersonProfileInput(input),
  };
};

/**
 * 解析 People 删除入参。
 */
const parseDeleteInput = (input: unknown): { id: string } => {
  if (!isRecord(input)) {
    throw new Error("People delete input must be an object");
  }

  const id = parseString(input.id)?.trim();
  if (!id) {
    throw new Error("People delete requires id");
  }

  return { id };
};
```

- [ ] **Step 4: Rename query tool and reuse relationship schema**

Change the query factory name field:

```ts
name: "people_tool.query",
```

Change both relationship schemas in query parameters to reuse the shared schema:

```ts
relationship: PEOPLE_RELATIONSHIP_SCHEMA,
```

Inside `conditions.properties.relationship`, also use:

```ts
relationship: {
  ...PEOPLE_RELATIONSHIP_SCHEMA,
  description: "Exact relationship category filter",
},
```

- [ ] **Step 5: Add write tool factories**

Append after `createPeopleQueryTool`:

```ts
/**
 * 创建 People 新建工具。
 */
export const createPeopleAddTool = (
  peopleService: Pick<PeopleService, "create">,
): PeopleWriteTool => ({
  name: "people_tool.add",
  description: "Create a people profile in the local People table.",
  prompt: {
    summary: "Create a new profile in the local People table.",
    intentKeywords: ["添加", "新增", "创建", "记录", "新建人物", "add person", "create person"],
    whenToUse: [
      "Use when the user explicitly asks to create or save a new people profile.",
      "Use after asking the user for missing required facts when the request is ambiguous.",
    ],
    whenNotToUse: [
      "Do not use for read-only questions about existing people profiles.",
      "Do not use when the user has not asked to save data.",
    ],
    safety: [
      "Only create structured people profiles through PeopleService.",
      "Use empty strings or an empty tags array for absent optional-looking fields.",
      "Never invent profile facts the user did not provide or confirm.",
    ],
    output: "Return the created people profile facts needed by the user.",
    examples: [
      '{"name":"小陈","gender":"","relationship":"朋友","status":"","birthday":"","contact":"","tags":[],"details":"","avatar":""}',
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

/**
 * 创建 People 更新工具。
 */
export const createPeopleUpdateTool = (
  peopleService: Pick<PeopleService, "update">,
): PeopleWriteTool => ({
  name: "people_tool.update",
  description: "Update an existing people profile in the local People table by id.",
  prompt: {
    summary: "Update an existing profile in the local People table by id.",
    intentKeywords: ["修改", "更新", "改成", "纠正", "补充人物", "update person", "edit person"],
    whenToUse: [
      "Use when the user explicitly asks to update an existing people profile.",
      "Use after people_tool.query when the user identifies a person by name or relationship instead of id.",
    ],
    whenNotToUse: [
      "Do not use for creating new people profiles.",
      "Do not use when the target profile id is unknown.",
    ],
    safety: [
      "Require the profile id and a complete replacement profile.",
      "Query first when the user only provides a name, then merge unchanged fields before updating.",
      "Never overwrite fields with guesses.",
    ],
    output: "Return the updated people profile facts needed by the user.",
    examples: [
      '{"id":"person-1","name":"阿明","gender":"男","relationship":"朋友","status":"技术负责人","birthday":"09月11日","contact":"GitHub: aming-coder","tags":["极客"],"details":"# 阿明","avatar":""}',
    ],
  },
  parameters: {
    type: "object",
    required: ["id", ...PEOPLE_PROFILE_REQUIRED],
    properties: {
      id: {
        type: "string",
        description: "People profile id",
      },
      ...PEOPLE_PROFILE_PROPERTIES,
    },
  },
  execute: async (input) => {
    const parsed = parseUpdateInput(input);
    const updated = peopleService.update(parsed.id, parsed.profile);

    return {
      observation: `Updated people profile: ${updated.name}.`,
      data: {
        item: toToolItem(updated),
      },
    };
  },
});

/**
 * 创建 People 删除工具。
 */
export const createPeopleDeleteTool = (
  peopleService: Pick<PeopleService, "delete">,
): PeopleWriteTool => ({
  name: "people_tool.delete",
  description: "Delete an existing people profile from the local People table by id.",
  prompt: {
    summary: "Delete an existing profile from the local People table by id.",
    intentKeywords: ["删除", "移除", "删掉", "delete person", "remove person"],
    whenToUse: [
      "Use when the user explicitly asks to delete a people profile.",
      "Use after people_tool.query when the user identifies a person by name or relationship instead of id.",
    ],
    whenNotToUse: [
      "Do not use for temporary filtering or hiding.",
      "Do not use when the target profile id is unknown or ambiguous.",
    ],
    safety: [
      "Require the exact profile id.",
      "Ask the user for clarification before deleting when multiple profiles may match.",
    ],
    output: "Return a concise deletion confirmation.",
    examples: ['{"id":"person-1"}'],
  },
  parameters: {
    type: "object",
    required: ["id"],
    properties: {
      id: {
        type: "string",
        description: "People profile id",
      },
    },
  },
  execute: async (input) => {
    const parsed = parseDeleteInput(input);
    peopleService.delete(parsed.id);

    return {
      observation: `Deleted people profile: ${parsed.id}.`,
      data: {
        id: parsed.id,
      },
    };
  },
});

/**
 * 创建完整 People 工具组。
 */
export const createPeopleTools = (
  peopleService: Pick<PeopleService, "querySql" | "create" | "update" | "delete">,
): AgentTool[] => [
  createPeopleQueryTool(peopleService),
  createPeopleAddTool(peopleService),
  createPeopleUpdateTool(peopleService),
  createPeopleDeleteTool(peopleService),
];
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm test test/main/agent/tools/peopleTool.test.ts
```

Expected: pass.

### Task 3: Register Namespaced People Tools

**Files:**
- Modify: `src/main/agent/tools/toolRegistry.ts`
- Modify: `test/main/agent/tools/toolRegistry.test.ts`

- [ ] **Step 1: Update registry tests**

In `test/main/agent/tools/toolRegistry.test.ts`, update the import expectation setup:

```ts
const peopleService: Pick<PeopleService, 'list' | 'querySql' | 'create' | 'update' | 'delete'> = {
  list: () => [],
  querySql: () => [],
  create: (input) => ({
    id: 'person-new',
    createdAt: '2026-06-03 10:00',
    updatedAt: '2026-06-03 10:00',
    ...input
  }),
  update: (id, input) => ({
    id,
    createdAt: '2026-06-03 09:00',
    updatedAt: '2026-06-03 10:00',
    ...input
  }),
  delete: () => undefined
}
```

Replace the registered IDs expectation:

```ts
expect(registry.ids()).toEqual([
  'ask_user',
  'people_tool.query',
  'people_tool.add',
  'people_tool.update',
  'people_tool.delete',
  'common_time_now',
  'common_date_offset',
  'common_runtime_info'
])
```

Replace `registry.get('people_query')` assertions with `registry.get('people_tool.query')`.

Add one write-intent test:

```ts
it('根据人物写入意图筛选工具，注入对应 People 写工具', () => {
  const registry = createAgentToolRegistry({
    peopleService
  })

  expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '帮我添加一个朋友小陈' }]).map((tool) => tool.name)).toContain(
    'people_tool.add'
  )
  expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '把阿明的状态修改为技术负责人' }]).map((tool) => tool.name)).toContain(
    'people_tool.update'
  )
  expect(selectToolsForTurn(registry.all(), [{ role: 'user', content: '删除小陈这个人物资料' }]).map((tool) => tool.name)).toContain(
    'people_tool.delete'
  )
})
```

Run:

```bash
pnpm test test/main/agent/tools/toolRegistry.test.ts
```

Expected: fail until registry imports `createPeopleTools`.

- [ ] **Step 2: Update registry implementation**

Change imports:

```ts
import { createPeopleTools } from './peopleTool'
```

Change context type:

```ts
export type AgentToolRegistryContext = {
  // People 服务。
  peopleService: Pick<PeopleService, 'list' | 'querySql' | 'create' | 'update' | 'delete'>
}
```

Change `AgentToolFactory` so one factory can return a focused tool group:

```ts
export type AgentToolFactory = (context: AgentToolRegistryContext) => AgentTool | AgentTool[]
```

Change `builtinToolFactories`:

```ts
const builtinToolFactories: AgentToolFactory[] = [
  () => createAskTool(),
  ({ peopleService }) => createPeopleTools(peopleService),
  () => createTimeNowTool(),
  () => createDateOffsetTool(),
  () => createRuntimeInfoTool()
]
```

Change tool construction inside `createAgentToolRegistry`:

```ts
const tools = factories.flatMap((factory) => factory(context))
```

- [ ] **Step 3: Run registry tests**

Run:

```bash
pnpm test test/main/agent/tools/toolRegistry.test.ts
```

Expected: pass.

### Task 4: Update Provider, Agent, Persistence, and Renderer Expectations

**Files:**
- Modify: `test/main/agent/providers/aiSdkProvider.test.ts`
- Modify: `test/main/agent/core/reactAgent.test.ts`
- Modify: `test/main/agent/core/contextMessages.test.ts`
- Modify: `test/main/ipc/aiHandlers.test.ts`
- Modify: `test/main/services/aiChatPersistenceService.test.ts`
- Modify: `test/renderer/features/ai-chat/aiChatContextBuilder.test.ts`
- Modify: `test/renderer/features/ai-chat/AiChatMessageBubble.test.tsx`
- Modify: `test/renderer/App.test.tsx`

- [ ] **Step 1: Replace stale query tool names in tests**

Run:

```bash
rg -n "people_query" test src/main src/renderer
```

For tests and expected fixture strings, replace `people_query` with `people_tool.query`.

Do not replace text in historical docs under `docs/superpowers` unless a test reads it.

- [ ] **Step 2: Add dotted tool name provider assertion**

In `test/main/agent/providers/aiSdkProvider.test.ts`, add or adjust a test so the captured `tools` object contains the dotted key:

```ts
expect(Object.keys(tools)).toContain('people_tool.query')
expect(tools['people_tool.query'].description).toContain('provide arguments strictly according to the parameter schema')
```

If the test fixture emits a model tool call, use:

```ts
toolName: 'people_tool.query'
```

and assert the provider stream event:

```ts
expect(events).toContainEqual({
  type: 'tool_call_done',
  id: 'call-1',
  name: 'people_tool.query',
  argumentsText: '{"query":"阿明"}'
})
```

- [ ] **Step 3: Run affected tests**

Run:

```bash
pnpm test test/main/agent/providers/aiSdkProvider.test.ts test/main/agent/core/reactAgent.test.ts test/main/agent/core/contextMessages.test.ts test/main/ipc/aiHandlers.test.ts test/main/services/aiChatPersistenceService.test.ts test/renderer/features/ai-chat/aiChatContextBuilder.test.ts test/renderer/features/ai-chat/AiChatMessageBubble.test.tsx test/renderer/App.test.tsx
```

Expected: pass after all stale names are replaced.

### Task 4.5: Enforce Ask Confirmation for People Mutations

**Files:**
- Modify: `src/main/agent/core/reactAgent.ts`
- Modify: `src/main/agent/tools/peopleTool.ts`
- Test: `test/main/agent/core/reactAgent.test.ts`

- [ ] **Step 1: Write failing confirmation tests**

Add tests proving `people_tool.add`, `people_tool.update`, and `people_tool.delete` do not execute without a positive `ask_user` answer after the latest user message, that cancellation answers do not pass the gate, and that update can execute after a positive `ask_user` answer in the same run.

- [ ] **Step 2: Add the Agent hard gate**

In `reactAgent`, before executing a tool, reject `people_tool.add`, `people_tool.update`, and `people_tool.delete` when the current user request has no later `ask_user` result whose tool data is a positive `ask_answer`.

- [ ] **Step 3: Strengthen People tool prompts**

Update `people_tool.add`, `people_tool.update`, and `people_tool.delete` prompt metadata so models are told to call `ask_user` for a second confirmation before every add/update/delete. Update `people_tool.update` prompt metadata so it is only used when the user explicitly asks to update saved data.

- [ ] **Step 4: Run focused tests**

Run:

```bash
pnpm test test/main/agent/core/reactAgent.test.ts
```

Expected: pass.

### Task 4.6: Strengthen People Add and Details Prompt Constraints

**Files:**
- Modify: `src/main/agent/tools/peopleTool.ts`
- Test: `test/main/agent/tools/peopleTool.test.ts`

- [ ] **Step 1: Add prompt assertions**

Assert `people_tool.add` mentions `ask_user` for missing create facts and that the `details` schema/prompt mentions Markdown.

- [ ] **Step 2: Update prompt and schema text**

Update `people_tool.add` `whenToUse` / `safety`, and the shared `details` property description, so details are written as Markdown content.

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm test test/main/agent/tools/peopleTool.test.ts
```

Expected: pass.

### Task 5: Verify Full Project

**Files:**
- No code files modified in this task.

- [ ] **Step 1: Typecheck**

Run:

```bash
pnpm lint
```

Expected: pass. This project maps lint to `pnpm typecheck`.

- [ ] **Step 2: Full tests**

Run:

```bash
pnpm test
```

Expected: pass.

- [ ] **Step 3: Diff review**

Run:

```bash
git diff -- src/main/agent/tools/peopleTool.ts src/main/agent/tools/toolRegistry.ts test/main/agent/tools/peopleTool.test.ts test/main/agent/tools/toolRegistry.test.ts test/main/agent/providers/aiSdkProvider.test.ts test/main/agent/core/reactAgent.test.ts test/main/agent/core/contextMessages.test.ts test/main/ipc/aiHandlers.test.ts test/main/services/aiChatPersistenceService.test.ts test/renderer/features/ai-chat/aiChatContextBuilder.test.ts test/renderer/features/ai-chat/AiChatMessageBubble.test.tsx test/renderer/App.test.tsx
```

Expected: no unrelated UI styling churn, no debug logs, no `people_query` in code or tests except historical docs.

## Self-Review

- Spec coverage: query rename, add, update, delete, positive ask confirmation gate for every mutation, explicit update intent guidance, add ask guidance, Markdown details guidance, registry, provider, tests all have tasks.
- Placeholder scan: no placeholder instructions remain.
- Type consistency: tool names are `people_tool.query`, `people_tool.add`, `people_tool.update`, `people_tool.delete` throughout the plan.
- Project constraint: plan intentionally does not include `git commit` steps because project instructions forbid commit/merge unless explicitly requested.
