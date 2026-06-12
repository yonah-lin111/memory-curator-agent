# Command & Agent Panel Cycle Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify the Arrow navigation logic in both Slash Command and Agent Mentions panels to support circular wrap-around selection.

**Architecture:** Use modulo arithmetic for `moveActiveCommand` (in `useAiChatInput.ts`) and `moveActiveAgent` (in `useAiChatMentions.ts`).

**Tech Stack:** React, TypeScript.

---

### Task 1: Update Slash Command Navigation to Support Cycling

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/hooks/useAiChatInput.ts`

- [ ] **Step 1: Modify `moveActiveCommand` in useAiChatInput.ts**

In `src/renderer/src/features/ai-chat/components/AiChatInput/hooks/useAiChatInput.ts`, update `moveActiveCommand` to support modulo calculation.

```typescript
  const moveActiveCommand = useCallback((direction: 1 | -1): void => {
    setActiveCommandIndex((currentIndex) => {
      if (matchedCommands.length === 0) {
        return 0;
      }

      return (
        (currentIndex + direction + matchedCommands.length) %
        matchedCommands.length
      );
    });
  }, [matchedCommands.length]);
```

---

### Task 2: Update Agent Mentions Navigation to Support Cycling

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput/hooks/useAiChatMentions.ts`

- [ ] **Step 1: Modify `moveActiveAgent` in useAiChatMentions.ts**

In `src/renderer/src/features/ai-chat/components/AiChatInput/hooks/useAiChatMentions.ts`, update `moveActiveAgent` to support modulo calculation.

```typescript
  const moveActiveAgent = useCallback((direction: 1 | -1): void => {
    setActiveAgentIndex((currentIndex) => {
      if (matchedAgentMentions.length === 0) {
        return 0;
      }

      return (
        (currentIndex + direction + matchedAgentMentions.length) %
        matchedAgentMentions.length
      );
    });
  }, [matchedAgentMentions.length]);
```

---

### Task 3: Update and Add Tests

**Files:**
- Modify: `test/renderer/features/ai-chat/AiChatInput.test.tsx`

- [ ] **Step 1: Update the Slash Command boundary test to verify cycling**

In `test/renderer/features/ai-chat/AiChatInput.test.tsx`, find the test `命令面板上下键在首/末项边界截断，不循环` (which we renamed and updated earlier) and change its assertions to expect cycling instead.
Also rename the test title to `命令面板上下键循环选择`.

```typescript
  it('命令面板上下键循环选择', async () => {
    const onCommandExecute = vi.fn()
    renderAiChatInput(onCommandExecute)
    const textarea = screen.getByLabelText('AI Chat Input Area')
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '/'
      }
    })

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /\/clear/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /\/undo/ })).toBeInTheDocument()
    })

    // 初始选中 /clear
    expect(screen.getByRole('option', { name: /\/clear/ })).toHaveAttribute('aria-selected', 'true')

    // 上键循环，选中末项 /showContextTimeline
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /\/showContextTimeline/ })).toHaveAttribute('aria-selected', 'true')
    })

    // 下键循环，返回首项 /clear
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /\/clear/ })).toHaveAttribute('aria-selected', 'true')
    })
  })
```

- [ ] **Step 2: Add a test for Agent Mentions circular navigation**

Add a test in `test/renderer/features/ai-chat/AiChatInput.test.tsx` to verify cycling on `@` mentions.

```typescript
  it('Agent 提及面板上下键循环选择', async () => {
    renderAiChatInput()
    const textarea = screen.getByLabelText('AI Chat Input Area')
    textarea.focus()

    fireEvent.change(textarea, {
      target: {
        value: '@'
      }
    })

    const agentListBox = screen.getByRole('listbox', { name: 'AI Chat Agent Mention Panel' })
    await waitFor(() => expect(agentListBox).toBeInTheDocument())

    const options = screen.getAllByRole('option')
    const firstOption = options[0]
    const lastOption = options[options.length - 1]

    // 初始选中首项
    expect(firstOption).toHaveAttribute('aria-selected', 'true')

    // 上键循环选择末项
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    await waitFor(() => {
      expect(lastOption).toHaveAttribute('aria-selected', 'true')
    })

    // 下键循环选择首项
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    await waitFor(() => {
      expect(firstOption).toHaveAttribute('aria-selected', 'true')
    })
  })
```

- [ ] **Step 3: Run the test suite**

Run: `npx vitest run test/renderer/features/ai-chat/AiChatInput.test.tsx`
Expected: Newly added and updated tests PASS.

---

### Task 4: Standards Verification

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.
