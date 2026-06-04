# common_tool.explain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `common_tool.explain` and require it before People add/update/delete tool execution.

**Architecture:** Implement a focused Common explain tool, register it in the existing tool registry, and add a ReAct execution gate before the current People write confirmation gate. Render explain tool output as Markdown inside existing tool-step flow with a small `MdPreview` component styled like `AiChatThinkingBlock`.

**Tech Stack:** TypeScript, Electron main process, React 19, Vitest, Testing Library, `md-editor-rt`.

---

## File Structure

- Create: `src/main/agent/tools/commonExplainTool.ts`
  - Owns `common_tool.explain` schema, prompt, parsing, validation, and result shape.
- Modify: `src/main/agent/tools/toolRegistry.ts`
  - Imports and registers `createExplainTool()` immediately after `common_tool.ask`.
- Modify: `src/main/agent/core/reactAgent.ts`
  - Tracks explain results in the current run and rejects People write tools that do not have a matching unconsumed explain result.
- Create: `src/renderer/src/features/ai-chat/components/AiToolExplainPreview.tsx`
  - Renders explain Markdown with `MdPreview` and the visual style required by the spec.
- Modify: `src/renderer/src/features/ai-chat/components/AiToolCallBlock.tsx`
  - Detects `common_tool.explain` steps and renders the Markdown preview instead of the truncated observation summary.
- Test: `test/main/agent/tools/commonExplainTool.test.ts`
  - Covers tool name, prompt, schema, validation, trimming, truncation, and returned data.
- Modify: `test/main/agent/tools/toolRegistry.test.ts`
  - Adds registry expectations for `common_tool.explain`.
- Modify: `test/main/agent/core/reactAgent.test.ts`
  - Adds explain gate tests and updates existing People write tests to call explain before write.
- Modify: `test/renderer/features/ai-chat/AiToolCallBlock.test.tsx`
  - Adds Markdown preview rendering assertions for explain steps.

Do not run `git commit`. Project instructions explicitly forbid commit/merge unless the user asks.

---

### Task 1: Add `common_tool.explain`

**Files:**
- Create: `src/main/agent/tools/commonExplainTool.ts`
- Test: `test/main/agent/tools/commonExplainTool.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/main/agent/tools/commonExplainTool.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createExplainTool,
  isExplainToolData,
} from "../../../../src/main/agent/tools/commonExplainTool";

describe("commonExplainTool", () => {
  it("创建 common_tool.explain 工具并声明写入前说明触发时机", () => {
    const tool = createExplainTool();

    expect(tool.name).toBe("common_tool.explain");
    expect(tool.description).toContain("Explain the pending write operation");
    expect(tool.prompt?.alwaysAvailable).toBe(true);
    expect(tool.prompt?.whenToUse.join("\n")).toContain("before people_tool.add");
    expect(tool.prompt?.whenToUse.join("\n")).toContain("before people_tool.update");
    expect(tool.prompt?.whenToUse.join("\n")).toContain("before people_tool.delete");
    expect(tool.parameters.required).toEqual(["targetTool", "action", "content"]);
    expect(tool.parameters.properties?.targetTool.enum).toEqual([
      "people_tool.add",
      "people_tool.update",
      "people_tool.delete",
    ]);
  });

  it("返回简洁 Markdown 说明并保留结构化数据", async () => {
    const tool = createExplainTool();

    const result = await tool.execute({
      targetTool: "people_tool.delete",
      action: "delete",
      content: "将删除人物资料：**阿明**（朋友）。",
    });

    expect(result.observation).toBe("将删除人物资料：**阿明**（朋友）。");
    expect(result.data).toEqual({
      kind: "explain",
      targetTool: "people_tool.delete",
      action: "delete",
      content: "将删除人物资料：**阿明**（朋友）。",
    });
    expect(isExplainToolData(result.data)).toBe(true);
  });

  it("拒绝空说明内容", async () => {
    const tool = createExplainTool();

    await expect(
      tool.execute({
        targetTool: "people_tool.add",
        action: "add",
        content: "   ",
      }),
    ).rejects.toThrow("Explain content cannot be empty");
  });

  it("裁剪过长说明，避免工具输出变成长篇推理", async () => {
    const tool = createExplainTool();
    const longContent = "说明".repeat(600);

    const result = await tool.execute({
      targetTool: "people_tool.update",
      action: "update",
      content: longContent,
    });

    expect(result.observation.length).toBeLessThanOrEqual(800);
    expect((result.data as { content: string }).content.length).toBeLessThanOrEqual(800);
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
pnpm test test/main/agent/tools/commonExplainTool.test.ts
```

Expected: fail because `commonExplainTool.ts` does not exist.

- [ ] **Step 3: Implement the tool**

Create `src/main/agent/tools/commonExplainTool.ts`:

```ts
import type { AgentTool, AgentToolResult } from "../types";

// Explain 支持的写入动作。
export type ExplainAction = "add" | "update" | "delete";

// Explain 支持的目标写入工具。
export type ExplainTargetTool = "people_tool.add" | "people_tool.update" | "people_tool.delete";

// Explain 工具结构化数据。
export type ExplainToolData = {
  // 工具数据类型。
  kind: "explain";
  // 即将调用的目标写入工具。
  targetTool: ExplainTargetTool;
  // 即将执行的写入动作。
  action: ExplainAction;
  // 展示给用户的 Markdown 简短说明。
  content: string;
};

// Explain 工具输入。
type ExplainToolInput = {
  // 即将调用的目标写入工具。
  targetTool: ExplainTargetTool;
  // 即将执行的写入动作。
  action: ExplainAction;
  // 展示给用户的 Markdown 简短说明。
  content: string;
};

// Explain 内容最大长度。
const MAX_EXPLAIN_CONTENT_LENGTH = 800;

// 目标工具到写入动作的映射。
const TARGET_TOOL_ACTIONS: Record<ExplainTargetTool, ExplainAction> = {
  "people_tool.add": "add",
  "people_tool.update": "update",
  "people_tool.delete": "delete",
};

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * 判断字符串是否为 Explain 目标工具。
 */
const isExplainTargetTool = (value: string): value is ExplainTargetTool =>
  value === "people_tool.add" || value === "people_tool.update" || value === "people_tool.delete";

/**
 * 判断字符串是否为 Explain 动作。
 */
const isExplainAction = (value: string): value is ExplainAction =>
  value === "add" || value === "update" || value === "delete";

/**
 * 裁剪说明内容。
 */
const trimExplainContent = (content: string): string => content.trim().slice(0, MAX_EXPLAIN_CONTENT_LENGTH);

/**
 * 解析 Explain 工具入参。
 */
const parseInput = (input: unknown): ExplainToolInput => {
  if (!isRecord(input)) {
    throw new Error("Explain input must be an object");
  }

  if (typeof input.targetTool !== "string" || !isExplainTargetTool(input.targetTool)) {
    throw new Error("Explain targetTool must be a supported write tool");
  }

  if (typeof input.action !== "string" || !isExplainAction(input.action)) {
    throw new Error("Explain action must be add, update, or delete");
  }

  if (TARGET_TOOL_ACTIONS[input.targetTool] !== input.action) {
    throw new Error(`Explain action ${input.action} does not match ${input.targetTool}`);
  }

  if (typeof input.content !== "string") {
    throw new Error("Explain content must be a string");
  }

  const content = trimExplainContent(input.content);
  if (!content) {
    throw new Error("Explain content cannot be empty");
  }

  return {
    targetTool: input.targetTool,
    action: input.action,
    content,
  };
};

/**
 * 判断值是否为 Explain 工具数据。
 */
export const isExplainToolData = (value: unknown): value is ExplainToolData =>
  isRecord(value) &&
  value.kind === "explain" &&
  typeof value.targetTool === "string" &&
  isExplainTargetTool(value.targetTool) &&
  typeof value.action === "string" &&
  isExplainAction(value.action) &&
  typeof value.content === "string" &&
  value.content.trim().length > 0;

/**
 * 创建写入前说明工具。
 */
export const createExplainTool = (): AgentTool => ({
  name: "common_tool.explain",
  description: "Explain the pending write operation before add, update, or delete tools execute.",
  prompt: {
    summary: "Explain the pending write operation before add, update, or delete tools execute.",
    alwaysAvailable: true,
    whenToUse: [
      "Use immediately before people_tool.add to summarize the profile that will be created.",
      "Use immediately before people_tool.update to summarize the target person and fields that will be saved.",
      "Use immediately before people_tool.delete to summarize the person that will be deleted.",
      "If the target must be found first, call the read/query tool first, then call common_tool.explain, then call the write tool.",
    ],
    whenNotToUse: [
      "Do not use before read-only tools, time tools, ordinary answers, or casual conversation.",
      "Do not use as a replacement for common_tool.ask when critical information is missing.",
      "Do not use as a replacement for the system write confirmation.",
    ],
    safety: [
      "Keep content concise and factual.",
      "Do not invent unknown profile fields.",
      "Mention enough identifying information for the user to understand the write target.",
    ],
    output: "Return concise Markdown in content. Keep the explanation under 800 characters.",
  },
  parameters: {
    type: "object",
    required: ["targetTool", "action", "content"],
    properties: {
      targetTool: {
        type: "string",
        enum: ["people_tool.add", "people_tool.update", "people_tool.delete"],
        description: "The write tool that will be called immediately after this explanation.",
      },
      action: {
        type: "string",
        enum: ["add", "update", "delete"],
        description: "The write action being explained.",
      },
      content: {
        type: "string",
        description: "Concise Markdown explanation shown to the user before the write tool runs.",
      },
    },
  },
  execute: async (input): Promise<AgentToolResult> => {
    const parsed = parseInput(input);

    return {
      observation: parsed.content,
      data: {
        kind: "explain",
        ...parsed,
      },
    };
  },
});
```

- [ ] **Step 4: Run tool test**

Run:

```bash
pnpm test test/main/agent/tools/commonExplainTool.test.ts
```

Expected: pass.

---

### Task 2: Register Explain Tool

**Files:**
- Modify: `src/main/agent/tools/toolRegistry.ts`
- Modify: `test/main/agent/tools/toolRegistry.test.ts`

- [ ] **Step 1: Update registry tests**

In `test/main/agent/tools/toolRegistry.test.ts`, change the built-in id expectation:

```ts
expect(registry.ids()).toEqual([
  "common_tool.ask",
  "common_tool.explain",
  "people_tool.query",
  "people_tool.add",
  "people_tool.update",
  "people_tool.delete",
  "common_tool.time_now",
  "common_tool.date_offset",
]);
expect(registry.get("common_tool.explain")?.description).toContain("Explain the pending write operation");
expect(registry.all()).toHaveLength(8);
```

Add a focused prompt test:

```ts
it("common_tool.explain 使用结构化 prompt 并声明写入前触发", () => {
  const registry = createAgentToolRegistry({
    peopleService,
  });
  const explainTool = registry.get("common_tool.explain");
  const [prepared] = prepareToolsForModel([explainTool!]);

  expect(explainTool?.prompt?.alwaysAvailable).toBe(true);
  expect(prepared.description).toContain("Capability: Explain the pending write operation");
  expect(prepared.description).toContain("before people_tool.add");
  expect(prepared.description).toContain("before people_tool.update");
  expect(prepared.description).toContain("before people_tool.delete");
});
```

- [ ] **Step 2: Run failing registry test**

Run:

```bash
pnpm test test/main/agent/tools/toolRegistry.test.ts
```

Expected: fail because registry does not include `common_tool.explain`.

- [ ] **Step 3: Register tool**

Modify `src/main/agent/tools/toolRegistry.ts`:

```ts
import { createExplainTool } from "./commonExplainTool";
```

Change `builtinToolFactories`:

```ts
const builtinToolFactories: AgentToolFactory[] = [
  () => createAskTool(),
  () => createExplainTool(),
  ({ peopleService }) => createPeopleTools(peopleService),
  () => createTimeNowTool(),
  () => createDateOffsetTool(),
];
```

- [ ] **Step 4: Run registry tests**

Run:

```bash
pnpm test test/main/agent/tools/toolRegistry.test.ts
```

Expected: pass.

---

### Task 3: Enforce Explain Before People Writes

**Files:**
- Modify: `src/main/agent/core/reactAgent.ts`
- Modify: `test/main/agent/core/reactAgent.test.ts`

- [ ] **Step 1: Add failing gate tests**

In `test/main/agent/core/reactAgent.test.ts`, add helper tool definitions near existing helper utilities:

```ts
const createExplainToolFixture = (): AgentTool => ({
  name: "common_tool.explain",
  description: "说明",
  parameters: {
    type: "object",
    properties: {},
  },
  execute: async (input) => {
    const value = input as {
      targetTool: "people_tool.add" | "people_tool.update" | "people_tool.delete";
      action: "add" | "update" | "delete";
      content: string;
    };

    return {
      observation: value.content,
      data: {
        kind: "explain",
        targetTool: value.targetTool,
        action: value.action,
        content: value.content,
      },
    };
  },
});
```

Add test: missing explain rejects write before confirmation:

```ts
it("people 写工具未先 explain 时拒绝执行且不触发内部确认", async () => {
  const addExecute = vi.fn(async () => ({
    observation: "Created people profile: 小陈.",
    data: { item: { id: "person-new", name: "小陈" } },
  }));
  const toolConfirmationProvider = createToolConfirmationProvider();
  const provider: ModelProvider = {
    id: "fake",
    type: "openai-compatible",
    streamTurn: async function* () {
      yield {
        type: "tool_call_done",
        id: "call-add",
        name: "people_tool.add",
        argumentsText: '{"name":"小陈","relationship":"朋友"}',
      };
      yield { type: "done" };
    },
  };
  const addTool: AgentTool = {
    name: "people_tool.add",
    description: "添加 People",
    parameters: { type: "object", properties: {} },
    execute: addExecute,
  };

  const events = await Array.fromAsync(
    runReactAgent({
      provider,
      model: "fake-model",
      messages: [{ role: "user", content: "记一下小陈是朋友" }],
      tools: [addTool],
      toolConfirmationProvider,
      maxTurns: 1,
    }),
  );

  expect(addExecute).not.toHaveBeenCalled();
  expect(toolConfirmationProvider).not.toHaveBeenCalled();
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool_failed",
      id: "call-add",
      name: "people_tool.add",
      error: "Call common_tool.explain before people_tool.add.",
    }),
  );
});
```

Add test: explain allows write and confirmation:

```ts
it("people 写工具先 explain 后进入内部确认并执行", async () => {
  const addExecute = vi.fn(async () => ({
    observation: "Created people profile: 小陈.",
    data: { item: { id: "person-new", name: "小陈" } },
  }));
  const toolConfirmationProvider = createToolConfirmationProvider();
  const provider: ModelProvider = {
    id: "fake",
    type: "openai-compatible",
    streamTurn: async function* () {
      yield {
        type: "tool_call_done",
        id: "call-explain",
        name: "common_tool.explain",
        argumentsText:
          '{"targetTool":"people_tool.add","action":"add","content":"将添加人物资料：小陈（朋友）。"}',
      };
      yield {
        type: "tool_call_done",
        id: "call-add",
        name: "people_tool.add",
        argumentsText: '{"name":"小陈","relationship":"朋友"}',
      };
      yield { type: "done" };
    },
  };
  const addTool: AgentTool = {
    name: "people_tool.add",
    description: "添加 People",
    parameters: { type: "object", properties: {} },
    execute: addExecute,
  };

  const events = await Array.fromAsync(
    runReactAgent({
      provider,
      model: "fake-model",
      messages: [{ role: "user", content: "记一下小陈是朋友" }],
      tools: [createExplainToolFixture(), addTool],
      toolConfirmationProvider,
      maxTurns: 1,
    }),
  );

  expect(toolConfirmationProvider).toHaveBeenCalledTimes(1);
  expect(addExecute).toHaveBeenCalledTimes(1);
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool_finished",
      id: "call-explain",
      name: "common_tool.explain",
      observation: "将添加人物资料：小陈（朋友）。",
    }),
  );
});
```

Add test: mismatched explain rejects write:

```ts
it("people 写工具 explain 目标不匹配时拒绝执行", async () => {
  const deleteExecute = vi.fn(async () => ({
    observation: "Deleted people profile: person-1.",
    data: { id: "person-1" },
  }));
  const provider: ModelProvider = {
    id: "fake",
    type: "openai-compatible",
    streamTurn: async function* () {
      yield {
        type: "tool_call_done",
        id: "call-explain",
        name: "common_tool.explain",
        argumentsText:
          '{"targetTool":"people_tool.update","action":"update","content":"将更新人物资料：阿明。"}',
      };
      yield {
        type: "tool_call_done",
        id: "call-delete",
        name: "people_tool.delete",
        argumentsText: '{"id":"person-1"}',
      };
      yield { type: "done" };
    },
  };
  const deleteTool: AgentTool = {
    name: "people_tool.delete",
    description: "删除 People",
    parameters: { type: "object", properties: {} },
    execute: deleteExecute,
  };

  const events = await Array.fromAsync(
    runReactAgent({
      provider,
      model: "fake-model",
      messages: [{ role: "user", content: "删除阿明" }],
      tools: [createExplainToolFixture(), deleteTool],
      toolConfirmationProvider: createToolConfirmationProvider(),
      maxTurns: 1,
    }),
  );

  expect(deleteExecute).not.toHaveBeenCalled();
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool_failed",
      id: "call-delete",
      name: "people_tool.delete",
      error: "Call common_tool.explain before people_tool.delete.",
    }),
  );
});
```

Add test: one explain is consumed once:

```ts
it("单次 explain 只放行一个匹配写工具", async () => {
  const addExecute = vi.fn(async () => ({
    observation: "Created people profile: 小陈.",
    data: { item: { id: "person-new", name: "小陈" } },
  }));
  const provider: ModelProvider = {
    id: "fake",
    type: "openai-compatible",
    streamTurn: async function* () {
      yield {
        type: "tool_call_done",
        id: "call-explain",
        name: "common_tool.explain",
        argumentsText:
          '{"targetTool":"people_tool.add","action":"add","content":"将添加人物资料：小陈（朋友）。"}',
      };
      yield {
        type: "tool_call_done",
        id: "call-add-1",
        name: "people_tool.add",
        argumentsText: '{"name":"小陈","relationship":"朋友"}',
      };
      yield {
        type: "tool_call_done",
        id: "call-add-2",
        name: "people_tool.add",
        argumentsText: '{"name":"小王","relationship":"朋友"}',
      };
      yield { type: "done" };
    },
  };
  const addTool: AgentTool = {
    name: "people_tool.add",
    description: "添加 People",
    parameters: { type: "object", properties: {} },
    execute: addExecute,
  };

  const events = await Array.fromAsync(
    runReactAgent({
      provider,
      model: "fake-model",
      messages: [{ role: "user", content: "添加两个人" }],
      tools: [createExplainToolFixture(), addTool],
      toolConfirmationProvider: createToolConfirmationProvider(),
      maxTurns: 1,
    }),
  );

  expect(addExecute).toHaveBeenCalledTimes(1);
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool_failed",
      id: "call-add-2",
      error: "Call common_tool.explain before people_tool.add.",
    }),
  );
});
```

- [ ] **Step 2: Run failing agent tests**

Run:

```bash
pnpm test test/main/agent/core/reactAgent.test.ts
```

Expected: new missing-explain test fails because current agent still allows People writes after internal confirmation only.

- [ ] **Step 3: Implement explain tracking**

Modify imports in `src/main/agent/core/reactAgent.ts`:

```ts
import { isExplainToolData, type ExplainAction, type ExplainToolData } from "../tools/commonExplainTool";
```

Add constants below existing tool-name constants:

```ts
// Explain 工具名。
const EXPLAIN_TOOL_NAME = "common_tool.explain";

// People 写入工具对应的 Explain 动作。
const PEOPLE_MUTATION_EXPLAIN_ACTIONS: Record<string, ExplainAction> = {
  "people_tool.add": "add",
  "people_tool.update": "update",
  "people_tool.delete": "delete",
};
```

Add state type and helpers before `runReactAgent`:

```ts
// 可消费的写入前说明。
type PendingExplain = ExplainToolData & {
  // Explain 对应的工具调用 ID。
  toolCallId: string;
};

/**
 * 判断 Explain 是否匹配当前写入工具。
 */
const isMatchingExplain = (explain: PendingExplain, toolName: string): boolean =>
  explain.targetTool === toolName && explain.action === PEOPLE_MUTATION_EXPLAIN_ACTIONS[toolName];

/**
 * 获取写入工具缺失 Explain 时的错误文本。
 */
const getMissingExplainMessage = (toolName: string): string => `Call ${EXPLAIN_TOOL_NAME} before ${toolName}.`;
```

Inside `runReactAgent`, after `let pendingPeopleMutationCompletion: string | null = null`, add:

```ts
  let pendingExplain: PendingExplain | null = null;
```

After a normal tool execute result is produced and before yielding `tool_finished`, record explain results:

```ts
        if (toolCall.name === EXPLAIN_TOOL_NAME && isExplainToolData(result.data)) {
          pendingExplain = {
            ...result.data,
            toolCallId: toolCall.id,
          };
        }
```

Before existing `if (PEOPLE_CONFIRMATION_REQUIRED_TOOLS.has(toolCall.name))` block, add the gate:

```ts
        if (PEOPLE_CONFIRMATION_REQUIRED_TOOLS.has(toolCall.name)) {
          if (!pendingExplain || !isMatchingExplain(pendingExplain, toolCall.name)) {
            throw new Error(getMissingExplainMessage(toolCall.name));
          }

          pendingExplain = null;
        }
```

Then keep the existing People confirmation block below it. Do not remove the confirmation provider behavior.

- [ ] **Step 4: Update existing People write tests**

Existing tests in `test/main/agent/core/reactAgent.test.ts` that expect `people_tool.add/update/delete` execution must emit a `common_tool.explain` tool call immediately before the write tool and include `createExplainToolFixture()` in `tools`.

For example, before this existing call:

```ts
yield {
  type: "tool_call_done",
  id: "call-add",
  name: "people_tool.add",
  argumentsText: '{"name":"小陈","relationship":"朋友"}',
};
```

insert:

```ts
yield {
  type: "tool_call_done",
  id: "call-explain",
  name: "common_tool.explain",
  argumentsText:
    '{"targetTool":"people_tool.add","action":"add","content":"将添加人物资料：小陈（朋友）。"}',
};
```

And change:

```ts
tools: [addTool],
```

to:

```ts
tools: [createExplainToolFixture(), addTool],
```

Use matching values for update and delete:

```ts
'{"targetTool":"people_tool.update","action":"update","content":"将更新人物资料：阿明。"}'
'{"targetTool":"people_tool.delete","action":"delete","content":"将删除人物资料：阿明。"}'
```

- [ ] **Step 5: Run agent tests**

Run:

```bash
pnpm test test/main/agent/core/reactAgent.test.ts
```

Expected: pass.

---

### Task 4: Render Explain Tool Output With MdPreview

**Files:**
- Create: `src/renderer/src/features/ai-chat/components/AiToolExplainPreview.tsx`
- Modify: `src/renderer/src/features/ai-chat/components/AiToolCallBlock.tsx`
- Modify: `test/renderer/features/ai-chat/AiToolCallBlock.test.tsx`

- [ ] **Step 1: Add failing UI test**

In `test/renderer/features/ai-chat/AiToolCallBlock.test.tsx`, mock `MdPreview` if absent:

```ts
vi.mock("md-editor-rt", () => ({
  MdPreview: ({ modelValue }: { modelValue: string }) => (
    <div data-testid="md-preview">{modelValue}</div>
  ),
}));
```

Add test:

```ts
it("common_tool.explain 使用 Markdown 预览完整展示说明", () => {
  const step: AiToolStep = {
    id: "explain-1",
    title: "Tool result: common_tool.explain",
    status: "done",
    tool: "common_tool.explain",
    observation: "将删除人物资料：**阿明**（朋友）。",
    data: {
      kind: "explain",
      targetTool: "people_tool.delete",
      action: "delete",
      content: "将删除人物资料：**阿明**（朋友）。",
    },
  };

  render(<AiToolCallBlock steps={[step]} />);

  const preview = screen.getByTestId("ai-tool-explain-preview");
  expect(screen.getByText("common_tool.explain")).toBeInTheDocument();
  expect(screen.getByTestId("md-preview")).toHaveTextContent("将删除人物资料：**阿明**（朋友）。");
  expect(preview).toHaveClass("markdown-preview-container");
  expect(preview).toHaveStyle({ fontSize: "13px" });
});
```

- [ ] **Step 2: Run failing UI test**

Run:

```bash
pnpm test test/renderer/features/ai-chat/AiToolCallBlock.test.tsx
```

Expected: fail because explain preview component does not exist and output still uses truncated observation rendering.

- [ ] **Step 3: Create preview component**

Create `src/renderer/src/features/ai-chat/components/AiToolExplainPreview.tsx`:

```tsx
import { MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";

// Explain 预览组件属性类型。
type AiToolExplainPreviewProps = {
  // Markdown 说明内容。
  content: string;
  // 是否正在生成中。
  isGenerating?: boolean;
};

/**
 * AiToolExplainPreview - 使用 Markdown 预览渲染写入前说明。
 */
export const AiToolExplainPreview = ({
  content,
  isGenerating = false,
}: AiToolExplainPreviewProps): React.JSX.Element => {
  return (
    <div
      className="ai-tool-explain-preview markdown-preview-container select-text max-w-full border-l border-white/10 pl-3 text-white/50"
      data-testid="ai-tool-explain-preview"
      style={{ fontSize: "13px" }}
    >
      <MdPreview
        theme="dark"
        modelValue={content}
        previewTheme="default"
        codeTheme="atom"
        style={{ backgroundColor: "transparent" }}
        autoFoldThreshold={isGenerating ? Infinity : 0}
        showCodeRowNumber={false}
      />
    </div>
  );
};
```

- [ ] **Step 4: Wire preview into tool call block**

Modify `src/renderer/src/features/ai-chat/components/AiToolCallBlock.tsx` imports:

```ts
import { AiToolExplainPreview } from "@renderer/features/ai-chat/components/AiToolExplainPreview";
```

Add type guard near existing helpers:

```ts
// Explain 工具数据。
type AiExplainToolData = {
  // 工具数据类型。
  kind: "explain";
  // 目标写入工具。
  targetTool: string;
  // 写入动作。
  action: string;
  // Markdown 说明内容。
  content: string;
};

/**
 * 判断值是否为 Explain 工具数据。
 */
const isAiExplainToolData = (value: unknown): value is AiExplainToolData =>
  Boolean(value) &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (value as { kind?: unknown }).kind === "explain" &&
  typeof (value as { content?: unknown }).content === "string";
```

Inside the `steps.map` block, after `const askAnswerSummary = renderAskAnswerSummary(step.data);`, add:

```ts
          const explainContent = isAiExplainToolData(step.data)
            ? step.data.content
            : step.tool === "common_tool.explain"
              ? step.observation
              : null;
```

Replace the generic observation block with conditional rendering:

```tsx
                {explainContent ? (
                  <div className="mt-1 flex items-start gap-1 text-white/45">
                    <span className="inline-flex h-[1.625em] w-3 flex-shrink-0 items-center justify-center select-none">
                      <svg
                        className="h-3 w-3 stroke-current"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M3 1v5h7"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <AiToolExplainPreview
                        content={explainContent}
                        isGenerating={step.status === "running"}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1 text-xs leading-relaxed text-white/45">
                    <span className="inline-flex items-center justify-center w-3 h-[1.625em] flex-shrink-0 select-none">
                      <svg
                        className="w-3 h-3 stroke-current"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M3 1v5h7"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="flex-1">{displayObservation}</span>
                  </div>
                )}
```

- [ ] **Step 5: Run UI tests**

Run:

```bash
pnpm test test/renderer/features/ai-chat/AiToolCallBlock.test.tsx
```

Expected: pass.

---

### Task 5: Full Verification

**Files:**
- No new source edits unless verification exposes a defect.

- [ ] **Step 1: Run focused test set**

Run:

```bash
pnpm test test/main/agent/tools/commonExplainTool.test.ts test/main/agent/tools/toolRegistry.test.ts test/main/agent/core/reactAgent.test.ts test/renderer/features/ai-chat/AiToolCallBlock.test.tsx
```

Expected: pass.

- [ ] **Step 2: Run project typecheck**

Run:

```bash
pnpm lint
```

Expected: pass.

- [ ] **Step 3: Scan for forbidden replacement character**

Run:

```bash
node -e 'const fs = require("fs"); const paths = process.argv.slice(1); let failed = false; for (const path of paths) { const text = fs.readFileSync(path, "utf8"); if (text.includes(String.fromCharCode(0xfffd))) { console.log(path); failed = true; } } process.exit(failed ? 1 : 0);' src test docs/superpowers/specs/2026-06-04-common-tool-explain-design.md docs/superpowers/plans/2026-06-04-common-tool-explain.md
```

Expected: no output.

- [ ] **Step 4: Review diff**

Run:

```bash
git diff -- src/main/agent/tools/commonExplainTool.ts src/main/agent/tools/toolRegistry.ts src/main/agent/core/reactAgent.ts src/renderer/src/features/ai-chat/components/AiToolExplainPreview.tsx src/renderer/src/features/ai-chat/components/AiToolCallBlock.tsx test/main/agent/tools/commonExplainTool.test.ts test/main/agent/tools/toolRegistry.test.ts test/main/agent/core/reactAgent.test.ts test/renderer/features/ai-chat/AiToolCallBlock.test.tsx docs/superpowers/specs/2026-06-04-common-tool-explain-design.md docs/superpowers/plans/2026-06-04-common-tool-explain.md
```

Expected: only scoped explain-tool changes and documentation. No debug logs. No commit.

---

## Self-Review

- Spec coverage: tool creation, trigger timing, execution gate, Markdown preview, streaming order, tests, and non-goals are mapped to tasks.
- Placeholder scan: no TBD/TODO/fill-later placeholders.
- Type consistency: `ExplainAction`, `ExplainTargetTool`, `ExplainToolData`, `common_tool.explain`, `targetTool`, `action`, and `content` are consistent across tasks.
- Project-rule override: plan intentionally omits commit steps because AGENTS.md forbids `git commit/merge` unless explicitly requested.
