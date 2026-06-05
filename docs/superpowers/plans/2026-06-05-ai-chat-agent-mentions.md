# AI Chat Agent Mentions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline `@agent` selection to the AI chat input and pass selected agents as trusted per-turn model hints without polluting user messages.

**Architecture:** Keep the existing `textarea` as the real input and add a renderer helper for agent token parsing, highlighting, payload creation, and whole-token deletion. Pass clean text plus `agents` through `AiChatWorkspace` and `useAiChatController`, then let the main process normalize agent hints and append a trusted system directive before `runReactAgent`.

**Tech Stack:** TypeScript, React 19, Electron preload/main IPC, Vitest, Testing Library, Tailwind CSS.

---

## File Structure

- Create: `src/renderer/src/features/ai-chat/aiChatAgentMentions.ts`
  - Owns renderer-side agent config, token parsing, fuzzy matching, send payload creation, highlight segmentation, and deletion range detection.
- Test: `test/renderer/features/ai-chat/aiChatAgentMentions.test.ts`
  - Covers parser, duplicate handling, text stripping, highlighting segments, matching, and deletion ranges.
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput.tsx`
  - Adds `@` panel, mirror highlight layer, whole-token deletion, clean send payload, and prompt-history stripping.
- Modify: `test/renderer/features/ai-chat/AiChatInput.test.tsx`
  - Adds UI interaction tests and updates `onSendMessage` signature.
- Modify: `src/renderer/src/features/ai-chat/components/AiChatWorkspace.tsx`
  - Propagates `AiChatSendPayload` instead of raw string.
- Modify: `src/renderer/src/features/ai-chat/useAiChatController.ts`
  - Accepts `AiChatSendPayload`, keeps regenerated messages agent-free, and passes `agents` to `startChat`.
- Modify: `src/renderer/src/features/ai-chat/core/aiChatSessionCommands.ts`
  - Keeps regenerate path typed as raw text so old turns do not restore agent choices.
- Modify: `test/renderer/App.test.tsx`
  - Adds end-to-end renderer assertion that selected agent is stripped from the message and sent as payload metadata.
- Modify: `src/preload/index.ts`
  - Adds `agents` to the preload-local `AiChatStartPayload` type.
- Modify: `src/renderer/src/env.d.ts`
  - Adds `agents` to renderer global `AiChatStartPayload`.
- Create: `src/main/agent/core/agentHints.ts`
  - Owns main-process agent hint validation, normalization, and trusted system directive rendering.
- Test: `test/main/agent/core/agentHints.test.ts`
  - Covers whitelist, priority ordering, dedupe, People tool directive, fallback wording, and no-op empty hints.
- Modify: `src/main/ipc/aiHandlers.ts`
  - Accepts `agents`, normalizes them, and appends directive to the system prompt used for the current run.
- Modify: `test/main/ipc/aiHandlers.test.ts`
  - Verifies selected agents reach `runReactAgent` as trusted system content and are not persisted in user message text.

Do not run `git commit`. Project instructions explicitly forbid commit/merge unless the user asks.

---

### Task 1: Renderer Agent Mention Parser

**Files:**
- Create: `src/renderer/src/features/ai-chat/aiChatAgentMentions.ts`
- Test: `test/renderer/features/ai-chat/aiChatAgentMentions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/renderer/features/ai-chat/aiChatAgentMentions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  AI_CHAT_AGENT_MENTION_OPTIONS,
  createAiChatSendPayload,
  getAiChatAgentMentionDeletionRange,
  getMatchedAiChatAgentMentions,
  parseAiChatAgentMentionText,
  tokenizeAiChatAgentMentionText
} from '@renderer/features/ai-chat/aiChatAgentMentions'

describe('aiChatAgentMentions', () => {
  it('声明 6 个内置 agent mention 选项', () => {
    expect(AI_CHAT_AGENT_MENTION_OPTIONS.map((option) => option.id)).toEqual([
      'people',
      'todo',
      'snippets',
      'journal',
      'notes',
      'today'
    ])
    expect(AI_CHAT_AGENT_MENTION_OPTIONS.map((option) => option.token)).toEqual([
      '@people_agent',
      '@todo_agent',
      '@snippets_agent',
      '@journal_agent',
      '@notes_agent',
      '@today_agent'
    ])
  })

  it('按完整 token 提取 agent 并剥离用户正文', () => {
    const parsed = parseAiChatAgentMentionText('@people_agent  查一下阿明 @todo_agent')

    expect(parsed.text).toBe('查一下阿明')
    expect(parsed.agents).toEqual([
      {
        id: 'people',
        token: '@people_agent',
        label: 'people',
        priority: 1
      },
      {
        id: 'todo',
        token: '@todo_agent',
        label: 'todo',
        priority: 2
      }
    ])
  })

  it('重复 token 只按首次出现生成优先级', () => {
    const parsed = parseAiChatAgentMentionText('@todo_agent 做计划 @people_agent @todo_agent')

    expect(parsed.text).toBe('做计划')
    expect(parsed.agents.map((agent) => `${agent.priority}:${agent.id}`)).toEqual(['1:todo', '2:people'])
  })

  it('不把邮箱和不完整 token 当成 agent', () => {
    const parsed = parseAiChatAgentMentionText('发到 a@people_agent.com，并看看 @people')

    expect(parsed.text).toBe('发到 a@people_agent.com，并看看 @people')
    expect(parsed.agents).toEqual([])
  })

  it('支持 agent 面板模糊匹配', () => {
    expect(getMatchedAiChatAgentMentions('').map((option) => option.id)).toHaveLength(6)
    expect(getMatchedAiChatAgentMentions('pe').map((option) => option.id)).toEqual(['people'])
    expect(getMatchedAiChatAgentMentions('ty').map((option) => option.id)).toEqual(['today'])
    expect(getMatchedAiChatAgentMentions('todo').map((option) => option.id)).toEqual(['todo'])
  })

  it('为高亮镜像层返回普通文本和 agent token 片段', () => {
    const segments = tokenizeAiChatAgentMentionText('@people_agent 查阿明 @todo_agent')

    expect(segments).toEqual([
      expect.objectContaining({ kind: 'agent', text: '@people_agent', agentId: 'people' }),
      expect.objectContaining({ kind: 'text', text: ' 查阿明 ' }),
      expect.objectContaining({ kind: 'agent', text: '@todo_agent', agentId: 'todo' })
    ])
  })

  it('计算 Backspace 删除完整 token 的范围', () => {
    const value = '@people_agent 查阿明'

    expect(getAiChatAgentMentionDeletionRange(value, '@people_agent'.length)).toEqual({
      start: 0,
      end: '@people_agent'.length
    })
    expect(getAiChatAgentMentionDeletionRange(value, '@people_agent '.length)).toEqual({
      start: 0,
      end: '@people_agent '.length
    })
    expect(getAiChatAgentMentionDeletionRange(value, 3)).toBeNull()
  })

  it('创建发送 payload 时只保留干净正文和 agent 元数据', () => {
    expect(createAiChatSendPayload('@people_agent @todo_agent 查阿明')).toEqual({
      text: '查阿明',
      agents: [
        {
          id: 'people',
          token: '@people_agent',
          label: 'people',
          priority: 1
        },
        {
          id: 'todo',
          token: '@todo_agent',
          label: 'todo',
          priority: 2
        }
      ]
    })
  })
})
```

- [ ] **Step 2: Run failing parser tests**

Run:

```bash
pnpm test test/renderer/features/ai-chat/aiChatAgentMentions.test.ts
```

Expected: fail because `src/renderer/src/features/ai-chat/aiChatAgentMentions.ts` does not exist.

- [ ] **Step 3: Implement renderer parser and config**

Create `src/renderer/src/features/ai-chat/aiChatAgentMentions.ts`:

```ts
// AI 输入框可选择的 agent 标识。
export type AiChatAgentId = "people" | "todo" | "snippets" | "journal" | "notes" | "today";

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
  // 高亮镜像层使用的文本颜色。
  colorClass: string;
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

// 高亮镜像层文本片段。
export type AiChatAgentMentionTextSegment =
  | {
      // 普通文本片段。
      kind: "text";
      // 片段文本。
      text: string;
    }
  | {
      // Agent token 片段。
      kind: "agent";
      // 片段文本。
      text: string;
      // Agent 唯一标识。
      agentId: AiChatAgentId;
      // 高亮颜色 class。
      colorClass: string;
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
    description: "优先使用人物档案与 People 工具",
    colorClass: "text-sky-300",
  },
  {
    id: "todo",
    token: "@todo_agent",
    label: "todo",
    description: "优先使用任务、计划与待办上下文",
    colorClass: "text-amber-300",
  },
  {
    id: "snippets",
    token: "@snippets_agent",
    label: "snippets",
    description: "优先使用片段与灵感上下文",
    colorClass: "text-violet-300",
  },
  {
    id: "journal",
    token: "@journal_agent",
    label: "journal",
    description: "优先使用日记与复盘上下文",
    colorClass: "text-rose-300",
  },
  {
    id: "notes",
    token: "@notes_agent",
    label: "notes",
    description: "优先使用长期笔记上下文",
    colorClass: "text-emerald-300",
  },
  {
    id: "today",
    token: "@today_agent",
    label: "today",
    description: "优先使用今日记录与日输入上下文",
    colorClass: "text-cyan-300",
  },
];

// Agent token 匹配表达式，只接受空白边界包围的完整 token。
const AGENT_TOKEN_PATTERN = /(^|\s)(@(people|todo|snippets|journal|notes|today)_agent)(?=$|\s)/g;

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
    [option.id, option.label, option.token.slice(1)].some((keyword) =>
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
 * 为高亮镜像层生成文本片段。
 */
export const tokenizeAiChatAgentMentionText = (value: string): AiChatAgentMentionTextSegment[] => {
  const ranges = collectAgentMentionRanges(value);
  const segments: AiChatAgentMentionTextSegment[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({
        kind: "text",
        text: value.slice(cursor, range.start),
      });
    }

    segments.push({
      kind: "agent",
      text: value.slice(range.start, range.end),
      agentId: range.option.id,
      colorClass: range.option.colorClass,
    });
    cursor = range.end;
  }

  if (cursor < value.length) {
    segments.push({
      kind: "text",
      text: value.slice(cursor),
    });
  }

  return segments;
};

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
```

- [ ] **Step 4: Run parser tests**

Run:

```bash
pnpm test test/renderer/features/ai-chat/aiChatAgentMentions.test.ts
```

Expected: pass.

- [ ] **Step 5: Diff checkpoint**

Run:

```bash
git diff -- src/renderer/src/features/ai-chat/aiChatAgentMentions.ts test/renderer/features/ai-chat/aiChatAgentMentions.test.ts
```

Expected: only the new helper and its tests are present.

---

### Task 2: `AiChatInput` Agent Panel And Highlight Layer

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput.tsx`
- Modify: `test/renderer/features/ai-chat/AiChatInput.test.tsx`

- [ ] **Step 1: Update and add failing component tests**

In `test/renderer/features/ai-chat/AiChatInput.test.tsx`, update the imports and render helper:

```ts
import type { AiChatSendPayload } from '@renderer/features/ai-chat/aiChatAgentMentions'

const renderAiChatInput = (
  onCommandExecute: (command: 'clear' | 'undo') => string | void | Promise<string | void> = () => undefined,
  isGenerating = false,
  onSendMessage: (payload: AiChatSendPayload) => void = () => undefined
): void => {
  render(
    <AiChatInput
      modelOptions={modelOptions}
      selectedModel={selectedModel}
      contextUsagePercent={0}
      contextTokens={0}
      contextLimit={204800}
      isGenerating={isGenerating}
      onSendMessage={onSendMessage}
      onCommandExecute={onCommandExecute}
      onModelChange={() => undefined}
    />
  )
}
```

Add these tests inside `describe('AiChatInput', () => { ... })` before the generating-state test:

```ts
  it('输入 @ 后打开 agent 面板并支持过滤选择', async () => {
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI Chat Input Area') as HTMLTextAreaElement
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '@'
      }
    })

    expect(screen.getByRole('listbox', { name: 'AI Agent Mention Panel' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /people/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /today/ })).toBeInTheDocument()

    fireEvent.change(textarea, {
      target: {
        value: '@pe'
      }
    })

    expect(screen.getByRole('option', { name: /people/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /todo/ })).not.toBeInTheDocument()

    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })

    await waitFor(() => expect(textarea).toHaveValue('@people_agent '))
    expect(screen.getByTestId('ai-chat-input-highlight')).toHaveTextContent('@people_agent')
  })

  it('发送时剥离 agent token 并保存干净 prompt history', async () => {
    const onSendMessage = vi.fn()
    const addPromptHistory = vi.fn().mockResolvedValue(['查阿明'])
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        ai: {
          addPromptHistory
        }
      }
    })
    renderAiChatInput(() => undefined, false, onSendMessage)
    const textarea = screen.getByLabelText('AI Chat Input Area')

    fireEvent.change(textarea, {
      target: {
        value: '@people_agent  @todo_agent 查阿明'
      }
    })
    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })

    expect(onSendMessage).toHaveBeenCalledWith({
      text: '查阿明',
      agents: [
        {
          id: 'people',
          token: '@people_agent',
          label: 'people',
          priority: 1
        },
        {
          id: 'todo',
          token: '@todo_agent',
          label: 'todo',
          priority: 2
        }
      ]
    })
    expect(addPromptHistory).toHaveBeenCalledWith('查阿明')
    await waitFor(() => expect(textarea).toHaveValue(''))
  })

  it('输入框只有 agent token 时不发送', () => {
    const onSendMessage = vi.fn()
    renderAiChatInput(() => undefined, false, onSendMessage)
    const textarea = screen.getByLabelText('AI Chat Input Area')

    fireEvent.change(textarea, {
      target: {
        value: '@people_agent '
      }
    })
    fireEvent.keyDown(textarea, {
      key: 'Enter'
    })

    expect(onSendMessage).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })

  it('Backspace 在 token 后一次删除完整 agent token', () => {
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI Chat Input Area') as HTMLTextAreaElement

    fireEvent.change(textarea, {
      target: {
        value: '@people_agent 查阿明'
      }
    })
    textarea.setSelectionRange('@people_agent '.length, '@people_agent '.length)
    fireEvent.keyDown(textarea, {
      key: 'Backspace'
    })

    expect(textarea).toHaveValue('查阿明')
  })

  it('斜杠命令面板打开时不打开 agent 面板', () => {
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI Chat Input Area')

    fireEvent.change(textarea, {
      target: {
        value: '/'
      }
    })

    expect(screen.getByRole('listbox', { name: 'AI Command Input Panel' })).toBeInTheDocument()
    expect(screen.queryByRole('listbox', { name: 'AI Agent Mention Panel' })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run failing component tests**

Run:

```bash
pnpm test test/renderer/features/ai-chat/AiChatInput.test.tsx
```

Expected: fail because `AiChatInput` still sends a string and has no agent panel/highlight layer.

- [ ] **Step 3: Update `AiChatInput` imports and prop type**

Modify `src/renderer/src/features/ai-chat/components/AiChatInput.tsx` imports:

```ts
import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Paperclip, SendHorizontal, SlidersHorizontal } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";
import { Select } from "@renderer/components/ui/Select";
import { useToast } from "@renderer/components/ui/Toast";
import {
  createAiChatSendPayload,
  getAiChatAgentMentionDeletionRange,
  getMatchedAiChatAgentMentions,
  tokenizeAiChatAgentMentionText,
  type AiChatAgentMentionOption,
  type AiChatSendPayload,
} from "@renderer/features/ai-chat/aiChatAgentMentions";
import type {
  AiModelProviderOption,
  AiModelSelection,
} from "@renderer/features/ai-chat/types";
```

Update `AiChatInputProps.onSendMessage`:

```ts
  // 发送消息回调。
  onSendMessage: (payload: AiChatSendPayload) => void;
```

- [ ] **Step 4: Add agent panel helpers and state**

Add this helper near `isTextareaCursorAt`:

```ts
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
  currentState: AgentMentionPanelState | null,
): AgentMentionPanelState | null => {
  if (isCommandInput(value)) {
    return null;
  }

  const start = currentState?.start ?? (value.slice(0, cursor).endsWith("@") ? cursor - 1 : -1);
  if (start < 0 || value[start] !== "@" || cursor <= start) {
    return null;
  }

  const previousCharacter = start > 0 ? value[start - 1] : "";
  if (previousCharacter && !/\s/.test(previousCharacter)) {
    return null;
  }

  const query = value.slice(start + 1, cursor);
  if (/[\s\n]/.test(query)) {
    return null;
  }

  return {
    start,
    query,
  };
};
```

Inside `AiChatInput`, add refs and state after `textareaRef`:

```ts
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [agentMentionPanelState, setAgentMentionPanelState] = useState<AgentMentionPanelState | null>(null);
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
```

Add derived values after command-derived values:

```ts
  const matchedAgentMentions = agentMentionPanelState
    ? getMatchedAiChatAgentMentions(agentMentionPanelState.query)
    : [];
  const isAgentPanelOpen = Boolean(agentMentionPanelState && matchedAgentMentions.length > 0);
  const activeAgent = matchedAgentMentions[activeAgentIndex] ?? matchedAgentMentions[0];
  const inputSendPayload = createAiChatSendPayload(inputText);
  const canSend = Boolean(inputSendPayload.text.trim());
  const highlightedInputSegments = tokenizeAiChatAgentMentionText(inputText);
```

- [ ] **Step 5: Add panel sync, selection, deletion, and scroll handlers**

Add these functions before `handleInputChange`:

```ts
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
    const nextState = resolveAgentMentionPanelState(value, cursor, agentMentionPanelState);
    const nextMatches = nextState ? getMatchedAiChatAgentMentions(nextState.query) : [];

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

      return (currentIndex + direction + matchedAgentMentions.length) % matchedAgentMentions.length;
    });
  };

  /**
   * 同步透明 textarea 与高亮镜像层滚动位置。
   */
  const handleTextareaScroll = (e: React.UIEvent<HTMLTextAreaElement>): void => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = e.currentTarget.scrollTop;
    }
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
      agentMentionPanelState,
    );
    if (!nextState) {
      closeAgentMentionPanel();
    }
  };
```

- [ ] **Step 6: Update send, input change, and keydown logic**

Replace `handleSend` with:

```ts
  /**
   * 发送消息处理函数。
   */
  const handleSend = (): void => {
    const nextPayload = createAiChatSendPayload(inputText);

    if (!nextPayload.text.trim()) return;
    if (isGenerating) {
      toast.warning("请等待 AI 输出完成");
      return;
    }
    onSendMessage(nextPayload);
    savePromptHistory(nextPayload.text);
    setInputText("");
    draftInputRef.current = "";
    historyCursorRef.current = null;
    setIsCommandPanelOpen(false);
    closeAgentMentionPanel();
  };
```

In `executeCommand`, add `closeAgentMentionPanel();` immediately after `setIsCommandPanelOpen(false);`.

Replace `handleInputChange` with:

```ts
  /**
   * 处理输入内容变化，并同步斜杠命令与 agent mention 面板。
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const nextValue = e.target.value;
    const nextMatchedCommands = getMatchedCommands(nextValue);

    setInputText(nextValue);
    draftInputRef.current = nextValue;
    historyCursorRef.current = null;
    setActiveCommandIndex(0);

    const shouldOpenCommandPanel = isCommandInput(nextValue) && nextMatchedCommands.length > 0;
    setIsCommandPanelOpen(shouldOpenCommandPanel);
    if (shouldOpenCommandPanel) {
      closeAgentMentionPanel();
      return;
    }

    syncAgentMentionPanel(nextValue, e.target.selectionStart);
  };
```

Add this block near the top of `handleKeyDown`, after command panel handling and before prompt-history handling:

```ts
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
      e.preventDefault();
      selectAgentMention(activeAgent);
      return;
    }

    if (e.key === "Backspace" && !isCommandPanelOpen && !isAgentPanelOpen) {
      const textarea = textareaRef.current;
      if (textarea && textarea.selectionStart === textarea.selectionEnd) {
        const deletionRange = getAiChatAgentMentionDeletionRange(inputText, textarea.selectionStart);
        if (deletionRange) {
          e.preventDefault();
          const nextValue = `${inputText.slice(0, deletionRange.start)}${inputText.slice(deletionRange.end)}`;
          setInputText(nextValue);
          draftInputRef.current = nextValue;
          historyCursorRef.current = null;
          requestAnimationFrame(() => {
            adjustTextareaHeight();
            textarea.setSelectionRange(deletionRange.start, deletionRange.start);
          });
          return;
        }
      }
    }
```

- [ ] **Step 7: Add agent panel and highlight JSX**

After the command panel block, add the agent panel block:

```tsx
        {isAgentPanelOpen ? (
          <div
            role="listbox"
            aria-label="AI Agent Mention Panel"
            aria-activedescendant={`ai-chat-agent-${activeAgent?.id ?? matchedAgentMentions[0].id}`}
            className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-40 overflow-hidden rounded-[6px] border border-white/10 bg-black shadow-2xl outline-none"
          >
            {matchedAgentMentions.map((agent, index) => {
              const isActive = index === activeAgentIndex;

              return (
                <button
                  key={agent.id}
                  id={`ai-chat-agent-${agent.id}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActiveAgentIndex(index)}
                  onClick={() => selectAgentMention(agent)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                    isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-medium ${agent.colorClass}`}>
                      {agent.label} - {agent.token}
                    </span>
                    <span className="block truncate text-[12px] text-white/45">
                      {agent.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
```

Replace the textarea JSX with this wrapper:

```tsx
        {/* 输入框 */}
        <div className="relative">
          <div
            ref={highlightRef}
            data-testid="ai-chat-input-highlight"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-1 text-sm leading-relaxed text-white"
          >
            {highlightedInputSegments.length > 0
              ? highlightedInputSegments.map((segment, index) =>
                  segment.kind === "agent" ? (
                    <span key={`${segment.kind}-${index}`} className={segment.colorClass}>
                      {segment.text}
                    </span>
                  ) : (
                    <span key={`${segment.kind}-${index}`}>{segment.text}</span>
                  ),
                )
              : "\u00A0"}
          </div>
          <textarea
            ref={textareaRef}
            rows={TEXTAREA_MIN_ROWS}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onClick={handleTextareaCursorMove}
            onKeyUp={handleTextareaCursorMove}
            onScroll={handleTextareaScroll}
            placeholder="输入您的问题..."
            aria-label="AI Chat Input Area"
            className="relative z-10 w-full bg-transparent text-sm text-transparent caret-white placeholder:text-white/20 outline-none resize-none leading-relaxed px-1 transition-[height] duration-200 ease-out"
          />
        </div>
```

Update the send button to use clean text:

```tsx
            disabled={!canSend}
            highlighted={canSend}
            className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
              canSend
                ? "bg-white text-black hover:bg-white/90"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
```

- [ ] **Step 8: Run component tests**

Run:

```bash
pnpm test test/renderer/features/ai-chat/AiChatInput.test.tsx
```

Expected: pass.

- [ ] **Step 9: Diff checkpoint**

Run:

```bash
git diff -- src/renderer/src/features/ai-chat/components/AiChatInput.tsx test/renderer/features/ai-chat/AiChatInput.test.tsx
```

Expected: changes are limited to agent mention panel, highlighter, send payload, and tests. Existing `/clear` and `/undo` logic remains intact.

---

### Task 3: Renderer Payload Propagation

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatWorkspace.tsx`
- Modify: `src/renderer/src/features/ai-chat/useAiChatController.ts`
- Modify: `src/renderer/src/features/ai-chat/core/aiChatSessionCommands.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`
- Modify: `test/renderer/App.test.tsx`

- [ ] **Step 1: Add failing renderer integration test**

In `test/renderer/App.test.tsx`, add this test after `AI 对话发送时使用当前选择的模型`:

```ts
  it('AI 对话发送时剥离 agent token 并携带 agent hints', async () => {
    const user = userEvent.setup()
    const startChat = vi.fn(async (payload: AiChatStartPayload) => ({
      runId: payload.runId ?? 'run-test'
    }))

    window.api = {
      ai: {
        startChat,
        onChatEvent: () => () => undefined
      }
    } as never

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open chat' }))
    const input = screen.getByLabelText('AI Chat Input Area')
    await user.type(input, '@pe')
    await user.keyboard('{Enter}')
    await user.type(input, '查阿明')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(startChat).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '查阿明',
          agents: [
            {
              id: 'people',
              priority: 1
            }
          ]
        })
      )
    })
    expect(screen.getByText('查阿明')).toBeInTheDocument()
    expect(screen.queryByText('@people_agent 查阿明')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run failing integration test**

Run:

```bash
pnpm test test/renderer/App.test.tsx -t "剥离 agent token"
```

Expected: fail because payload propagation still expects a raw string and `AiChatStartPayload` has no `agents` type.

- [ ] **Step 3: Update workspace and controller types**

In `src/renderer/src/features/ai-chat/components/AiChatWorkspace.tsx`, import the payload type and update the prop type:

```ts
import type { AiChatSendPayload } from "@renderer/features/ai-chat/aiChatAgentMentions";

// 发送消息回调。
onSendMessage: (payload: AiChatSendPayload) => void;
```

In `src/renderer/src/features/ai-chat/useAiChatController.ts`, update imports and public type:

```ts
import {
  toAiChatAgentHints,
  type AiChatSendPayload,
} from "@renderer/features/ai-chat/aiChatAgentMentions";

// AI 对话发送输入。
type AiChatSendInput = string | AiChatSendPayload;
```

Change `UseAiChatControllerResult.handleSendMessage`:

```ts
  // 发送用户消息。
  handleSendMessage: (payload: AiChatSendPayload) => void;
```

Add this helper near the other pure helpers:

```ts
/**
 * 归一化 AI 对话发送输入，历史重发路径不恢复旧 agent。
 */
const normalizeAiChatSendInput = (input: AiChatSendInput): AiChatSendPayload =>
  typeof input === "string"
    ? {
        text: input,
        agents: [],
      }
    : input;
```

- [ ] **Step 4: Update `startAiChatMessage` and `handleSendMessage`**

In `src/renderer/src/features/ai-chat/useAiChatController.ts`, replace the `startAiChatMessage` signature and the first lines of its body through `runId` creation with this block:

```ts
  const startAiChatMessage = (
    input: AiChatSendInput,
    sessionId: string,
    sourceSessions = chatSessions,
  ): void => {
    const sendPayload = normalizeAiChatSendInput(input);
    const text = sendPayload.text.trim();
    const agents = toAiChatAgentHints(sendPayload.agents);

    if (!text) {
      return;
    }

    const userTime = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const sessionTime = createSessionListTimestamp();
    const runId = createAiChatUuid();
```

The next existing line should remain:

```ts
    const userMessageId = createAiChatUuid();
```

This preserves the existing message creation body while changing its input source from the old `text` parameter to the new local `text` constant.

In the existing `window.api.ai.startChat` payload, add `agents` immediately after `context: contextItems`:

```ts
        agents,
```

Keep regenerated answers agent-free by leaving this existing call valid:

```ts
startAiChatMessage(userMessage.content, session.id, cleanSessions);
```

Update `handleSendMessage`:

```ts
  /**
   * 发送用户消息并触发 AI 回答。
   */
  const handleSendMessage = (payload: AiChatSendPayload): void => {
    startAiChatMessage(payload, activeChatId);
  };
```

- [ ] **Step 5: Update regenerate callback type**

In `src/renderer/src/features/ai-chat/core/aiChatSessionCommands.ts`, keep `StartAiChatMessage` as raw text and document why:

```ts
// 重新发送 AI 消息端口。历史重发只使用原始用户问题，不恢复旧 agent 选择。
type StartAiChatMessage = (
  text: string,
  sessionId: string,
  sourceSessions: AiChatSession[],
) => void;
```

No other implementation change is required in `aiChatSessionCommands.ts`; `(input: string | AiChatSendPayload, ...) => void` accepts the existing `string` call site.

- [ ] **Step 6: Update preload and renderer global payload types**

In both `src/preload/index.ts` and `src/renderer/src/env.d.ts`, add this local type near `AiChatStartPayload`:

```ts
// AI 对话 agent hint 类型。
type AiChatAgentHint = {
  // Agent 唯一标识。
  id: 'people' | 'todo' | 'snippets' | 'journal' | 'notes' | 'today'
  // 本轮 agent 优先级，数字越小越优先。
  priority: number
}
```

Add to `AiChatStartPayload` in both files:

```ts
  // 本轮优先使用的 agent hints。
  agents?: AiChatAgentHint[]
```

- [ ] **Step 7: Run renderer integration test**

Run:

```bash
pnpm test test/renderer/App.test.tsx -t "剥离 agent token"
```

Expected: pass.

- [ ] **Step 8: Run related renderer tests**

Run:

```bash
pnpm test test/renderer/features/ai-chat/AiChatInput.test.tsx test/renderer/App.test.tsx
```

Expected: pass.

- [ ] **Step 9: Diff checkpoint**

Run:

```bash
git diff -- src/renderer/src/features/ai-chat/components/AiChatWorkspace.tsx src/renderer/src/features/ai-chat/useAiChatController.ts src/renderer/src/features/ai-chat/core/aiChatSessionCommands.ts src/preload/index.ts src/renderer/src/env.d.ts test/renderer/App.test.tsx
```

Expected: clean payload propagation, no message persistence of agent token.

---

### Task 4: Main Process Agent Hint Directive Utility

**Files:**
- Create: `src/main/agent/core/agentHints.ts`
- Test: `test/main/agent/core/agentHints.test.ts`

- [ ] **Step 1: Write failing main utility tests**

Create `test/main/agent/core/agentHints.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  appendAiChatAgentDirectiveToSystemMessage,
  normalizeAiChatAgentHints,
  renderAiChatAgentDirective
} from '../../../../src/main/agent/core/agentHints'

describe('agentHints', () => {
  it('只保留白名单 agent，按 priority 排序并去重', () => {
    expect(
      normalizeAiChatAgentHints([
        { id: 'todo', priority: 2 },
        { id: 'people', priority: 1 },
        { id: 'people', priority: 3 },
        { id: 'unknown', priority: 4 },
        { id: 'notes', priority: Number.NaN }
      ])
    ).toEqual([
      { id: 'people', priority: 1 },
      { id: 'todo', priority: 2 }
    ])
  })

  it('渲染包含 People 工具优先级的可信 system directive', () => {
    const directive = renderAiChatAgentDirective([
      { id: 'people', priority: 1 },
      { id: 'todo', priority: 2 }
    ])

    expect(directive).toContain('Agent selection directive')
    expect(directive).toContain('1. people_agent')
    expect(directive).toContain('people_tool.query')
    expect(directive).toContain('people_tool.add')
    expect(directive).toContain('2. todo_agent')
    expect(directive.indexOf('1. people_agent')).toBeLessThan(directive.indexOf('2. todo_agent'))
    expect(directive).toContain('Do not force unrelated tools')
  })

  it('没有 agent hint 时不修改 system message', () => {
    const systemMessage = {
      role: 'system' as const,
      content: 'base system prompt'
    }

    expect(appendAiChatAgentDirectiveToSystemMessage(systemMessage, [])).toBe(systemMessage)
    expect(renderAiChatAgentDirective([])).toBe('')
  })
})
```

- [ ] **Step 2: Run failing main utility tests**

Run:

```bash
pnpm test test/main/agent/core/agentHints.test.ts
```

Expected: fail because `agentHints.ts` does not exist.

- [ ] **Step 3: Implement main utility**

Create `src/main/agent/core/agentHints.ts`:

```ts
import type { AgentMessage } from '../types'

// AI 对话 agent 标识。
export type AiChatAgentId = 'people' | 'todo' | 'snippets' | 'journal' | 'notes' | 'today'

// AI 对话 agent hint。
export type AiChatAgentHint = {
  // Agent 唯一标识。
  id: AiChatAgentId
  // 本轮 agent 优先级，数字越小越优先。
  priority: number
}

// Agent directive 配置。
type AiChatAgentDirectiveConfig = {
  // Agent 唯一标识。
  id: AiChatAgentId
  // 系统提示中展示的 token 名称。
  token: string
  // Agent 能力说明。
  description: string
  // 当前已可用的工具名。
  tools?: string[]
}

// Agent directive 配置表。
const AI_CHAT_AGENT_DIRECTIVE_CONFIGS: AiChatAgentDirectiveConfig[] = [
  {
    id: 'people',
    token: 'people_agent',
    description: 'Prefer People-related profile facts, relationship memory, and People tools first.',
    tools: ['people_tool.query', 'people_tool.add', 'people_tool.update', 'people_tool.delete']
  },
  {
    id: 'todo',
    token: 'todo_agent',
    description: 'Prefer Todo-related task, plan, and daily execution context first.'
  },
  {
    id: 'snippets',
    token: 'snippets_agent',
    description: 'Prefer Snippets-related idea, fragment, and capture context first.'
  },
  {
    id: 'journal',
    token: 'journal_agent',
    description: 'Prefer Journal-related diary, reflection, and review context first.'
  },
  {
    id: 'notes',
    token: 'notes_agent',
    description: 'Prefer Notes-related long-form knowledge and planning context first.'
  },
  {
    id: 'today',
    token: 'today_agent',
    description: 'Prefer Today-related daily input, current-day records, and short-term flow context first.'
  }
]

// Agent directive 配置索引。
const AI_CHAT_AGENT_DIRECTIVES_BY_ID = new Map(AI_CHAT_AGENT_DIRECTIVE_CONFIGS.map((config) => [config.id, config]))

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * 判断字符串是否为支持的 agent 标识。
 */
export const isAiChatAgentId = (value: string): value is AiChatAgentId =>
  AI_CHAT_AGENT_DIRECTIVES_BY_ID.has(value as AiChatAgentId)

/**
 * 归一化渲染层传入的 agent hints。
 */
export const normalizeAiChatAgentHints = (value: unknown): AiChatAgentHint[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const candidates = value
    .flatMap((item): AiChatAgentHint[] => {
      if (!isRecord(item) || typeof item.id !== 'string' || !isAiChatAgentId(item.id)) {
        return []
      }

      if (typeof item.priority !== 'number' || !Number.isFinite(item.priority) || item.priority <= 0) {
        return []
      }

      return [
        {
          id: item.id,
          priority: item.priority
        }
      ]
    })
    .sort((a, b) => a.priority - b.priority)

  const seenAgentIds = new Set<AiChatAgentId>()
  const normalized: AiChatAgentHint[] = []

  for (const candidate of candidates) {
    if (seenAgentIds.has(candidate.id)) {
      continue
    }

    seenAgentIds.add(candidate.id)
    normalized.push({
      id: candidate.id,
      priority: normalized.length + 1
    })
  }

  return normalized
}

/**
 * 渲染单个 agent directive 行。
 */
const renderAgentDirectiveLine = (hint: AiChatAgentHint): string => {
  const config = AI_CHAT_AGENT_DIRECTIVES_BY_ID.get(hint.id)

  if (!config) {
    return ''
  }

  const toolText = config.tools?.length
    ? ` Current available tools: ${config.tools.join(', ')}.`
    : ' Current concrete tools may be unavailable; use matching context when relevant.'

  return `${hint.priority}. ${config.token}: ${config.description}${toolText}`
}

/**
 * 渲染本轮 agent 选择的可信系统提示。
 */
export const renderAiChatAgentDirective = (hints: unknown): string => {
  const normalizedHints = normalizeAiChatAgentHints(hints)

  if (normalizedHints.length === 0) {
    return ''
  }

  return [
    'Agent selection directive:',
    'The user selected these agent priorities for this turn:',
    ...normalizedHints.map(renderAgentDirectiveLine).filter(Boolean),
    'Rules:',
    '- Prefer selected agents in priority order when they are relevant to the user message.',
    '- If a selected agent has no relevant capability or data, use other available tools and context instead.',
    '- Do not force unrelated tools.'
  ].join('\n')
}

/**
 * 把 agent directive 追加到可信 system message。
 */
export const appendAiChatAgentDirectiveToSystemMessage = (
  systemMessage: AgentMessage,
  hints: unknown
): AgentMessage => {
  const directive = renderAiChatAgentDirective(hints)

  if (!directive) {
    return systemMessage
  }

  return {
    ...systemMessage,
    content: `${systemMessage.content}\n${directive}`
  }
}
```

- [ ] **Step 4: Run main utility tests**

Run:

```bash
pnpm test test/main/agent/core/agentHints.test.ts
```

Expected: pass.

- [ ] **Step 5: Diff checkpoint**

Run:

```bash
git diff -- src/main/agent/core/agentHints.ts test/main/agent/core/agentHints.test.ts
```

Expected: only the new utility and tests are present.

---

### Task 5: IPC Integration For Trusted Agent Hints

**Files:**
- Modify: `src/main/ipc/aiHandlers.ts`
- Modify: `test/main/ipc/aiHandlers.test.ts`

- [ ] **Step 1: Add failing IPC test**

In `test/main/ipc/aiHandlers.test.ts`, add this test after `persists chat start lifecycle and stream updates`:

```ts
  it('passes selected agents as trusted system directive without persisting tokens', async () => {
    const service = {
      listSessions: vi.fn(),
      getSession: vi.fn(() => ({
        id: 's1',
        title: '已有标题',
        time: '10:00',
        status: 'completed',
        messages: []
      })),
      updateSessionTitle: vi.fn(),
      deleteSession: vi.fn(),
      ensureSession: vi.fn(),
      appendMessage: vi.fn(),
      startRun: vi.fn(),
      createRunWithMessages: vi.fn(),
      finishRun: vi.fn(),
      failRunWithAssistantMessage: vi.fn(),
      updateAssistantMessage: vi.fn(),
      upsertToolCall: vi.fn()
    }
    const send = vi.fn()
    vi.mocked(createAiChatPersistenceService).mockReturnValue(service as never)

    registerAiHandlers()

    const startHandler = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === 'ai:chat:start')?.[1]
    await startHandler?.(
      { sender: { send } } as never,
      {
        runId: 'run-agent',
        userMessageId: '55555555555545558555555555555555',
        assistantMessageId: '66666666666646668666666666666666',
        sessionId: 's1',
        message: '查阿明',
        provider: 'bailian',
        model: 'MiniMax-M2.5',
        context: [],
        agents: [
          { id: 'todo', priority: 2 },
          { id: 'people', priority: 1 },
          { id: 'unknown', priority: 3 }
        ]
      } as never
    )

    await new Promise((resolve) => setTimeout(resolve, 0))

    const runInput = vi.mocked(runReactAgent).mock.calls[0][0]
    const systemMessage = runInput.messages[0]

    expect(systemMessage.role).toBe('system')
    expect(systemMessage.content).toContain('Agent selection directive')
    expect(systemMessage.content).toContain('1. people_agent')
    expect(systemMessage.content).toContain('people_tool.query')
    expect(systemMessage.content).toContain('2. todo_agent')
    expect(systemMessage.content).not.toContain('unknown')
    expect(service.createRunWithMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: expect.objectContaining({
          content: '查阿明'
        })
      })
    )
  })
```

- [ ] **Step 2: Run failing IPC test**

Run:

```bash
pnpm test test/main/ipc/aiHandlers.test.ts -t "selected agents"
```

Expected: fail because `AiChatStartPayload` has no `agents` and system prompt is not augmented.

- [ ] **Step 3: Integrate `agentHints` into `aiHandlers`**

In `src/main/ipc/aiHandlers.ts`, add imports:

```ts
import {
  appendAiChatAgentDirectiveToSystemMessage,
  normalizeAiChatAgentHints,
  type AiChatAgentHint
} from '../agent/core/agentHints'
```

Add to `AiChatStartPayload`:

```ts
  // 本轮优先使用的 agent hints。
  agents?: AiChatAgentHint[]
```

Inside the `ai:chat:start` handler, after `const tools = toolRegistry.all()` add:

```ts
    const agentHints = normalizeAiChatAgentHints(payload.agents)
```

Replace the `systemMessage` argument in `buildContextAgentMessages`:

```ts
            systemMessage: appendAiChatAgentDirectiveToSystemMessage(createSystemPrompt(), agentHints),
```

Do not add agent hints to `context`, `userMessage.content`, or persisted run fields in this task.

- [ ] **Step 4: Run IPC test**

Run:

```bash
pnpm test test/main/ipc/aiHandlers.test.ts -t "selected agents"
```

Expected: pass.

- [ ] **Step 5: Run full IPC tests**

Run:

```bash
pnpm test test/main/ipc/aiHandlers.test.ts
```

Expected: pass.

- [ ] **Step 6: Diff checkpoint**

Run:

```bash
git diff -- src/main/ipc/aiHandlers.ts test/main/ipc/aiHandlers.test.ts
```

Expected: only agent hint payload normalization and system directive injection are added.

---

### Task 6: Final Verification

**Files:**
- Verify all files changed by Tasks 1-5.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm test test/renderer/features/ai-chat/aiChatAgentMentions.test.ts test/renderer/features/ai-chat/AiChatInput.test.tsx test/renderer/App.test.tsx test/main/agent/core/agentHints.test.ts test/main/ipc/aiHandlers.test.ts
```

Expected: all targeted tests pass.

- [ ] **Step 2: Run typecheck/lint**

Run:

```bash
pnpm lint
```

Expected: `pnpm typecheck` completes with no TypeScript errors.

- [ ] **Step 3: Run full test suite**

Run:

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: changed files match this plan. No generated artifacts, secrets, debug logs, or unrelated edits appear.

- [ ] **Step 5: Manual UX smoke test**

Run:

```bash
pnpm dev
```

Expected manual checks:

1. Open chat and type `@`; agent panel shows `people`, `todo`, `snippets`, `journal`, `notes`, `today`.
2. Type `@pe`, press Enter; input shows `@people_agent ` in a distinct color.
3. Continue typing `查阿明`, send; visible user message is only `查阿明`.
4. Type `@people_agent @todo_agent 查阿明` manually; both tokens are highlighted, send works, message is stripped.
5. Put cursor after `@people_agent ` and press Backspace; the whole token disappears.
6. Type `/clear`; slash command panel still works and agent panel stays closed.

Do not commit. Stop after reporting verification results and any residual risk.
