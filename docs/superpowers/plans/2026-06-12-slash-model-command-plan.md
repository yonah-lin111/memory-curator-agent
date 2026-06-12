# Slash Model Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/model` slash command in the AI chat input box to show the model selection list in the command palette, navigate with Up/Down arrow keys, and select/switch models with Enter.

**Architecture:** Integrate a new command `"model"` into the existing slash command registry inside `AiChatInput.tsx`. Detect when the input enters model mode (starts with `/model`), and render a custom `CommandPanel` with filtered models from `modelOptions`. Capture keyboard events on the textarea to control model navigation and selection.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide Icons

---

### Task 1: Command Registration and Types

**Files:**
- Modify: `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/features/ai-chat/components/AiChatInput.tsx`

- [ ] **Step 1: Read existing command definitions**
  Confirm the location of `AiChatInputCommandId` and `AI_CHAT_INPUT_COMMANDS`.

- [ ] **Step 2: Add "model" command to type and array**
  Modify the `AiChatInputCommandId` union and `AI_CHAT_INPUT_COMMANDS` array to register the `/model` command.

  In `src/renderer/src/features/ai-chat/components/AiChatInput.tsx`:
  ```typescript
  // AI 输入框内置命令标识。
  export type AiChatInputCommandId = "clear" | "undo" | "model";
  ```

  And:
  ```typescript
  // AI 输入框支持的斜杠命令。
  const AI_CHAT_INPUT_COMMANDS: AiChatInputCommand[] = [
    {
      id: "clear",
      name: "/clear",
      aliases: ["/new"],
      description: "清空当前输入并切换到空白对话",
      addToContext: false,
    },
    {
      id: "undo",
      name: "/undo",
      aliases: ["/rewind"],
      description: "删除最后一轮消息、运行数据和相关上下文",
      addToContext: false,
    },
    {
      id: "model",
      name: "/model",
      aliases: [],
      description: "快速切换 AI 语言模型",
      addToContext: false,
    },
  ];
  ```

- [ ] **Step 3: Commit Task 1 changes**
  ```bash
  git add src/renderer/src/features/ai-chat/components/AiChatInput.tsx
  git commit -m "feat: register slash model command in chat input commands list"
  ```

---

### Task 2: State, Computed Variables, and Selection Handlers

**Files:**
- Modify: `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/features/ai-chat/components/AiChatInput.tsx`

- [ ] **Step 1: Add state for active model index**
  Add state hook near other input states inside the `AiChatInput` component function:
  ```typescript
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  ```

- [ ] **Step 2: Add computed values for Model Mode**
  Add definitions for `isModelMode`, `modelQuery`, `allModels`, `matchedModels` and `isModelPanelOpen` under other computed variables:
  ```typescript
  const isModelMode = inputText === "/model" || inputText.startsWith("/model ");
  const modelQuery = inputText.startsWith("/model ") ? inputText.slice(7).trim() : "";

  const allModels = useMemo(() => {
    const list: Array<{
      id: string; // providerId::modelId
      providerId: string;
      providerName: string;
      modelId: string;
      modelName: string;
    }> = [];
    modelOptions.forEach((provider) => {
      provider.models.forEach((model) => {
        list.push({
          id: `${provider.id}::${model.id}`,
          providerId: provider.id,
          providerName: provider.name,
          modelId: model.id,
          modelName: model.name || model.id,
        });
      });
    });
    return list;
  }, [modelOptions]);

  const matchedModels = useMemo(() => {
    if (!isModelMode) return [];
    if (!modelQuery) return allModels;
    const query = modelQuery.toLowerCase();
    return allModels.filter(
      (model) =>
        model.modelName.toLowerCase().includes(query) ||
        model.providerName.toLowerCase().includes(query) ||
        model.modelId.toLowerCase().includes(query)
    );
  }, [allModels, isModelMode, modelQuery]);

  // Handle auto-reset of model index on list filter change
  useEffect(() => {
    setActiveModelIndex(0);
  }, [matchedModels.length]);
  ```

- [ ] **Step 3: Add model selection, index movement, and command executor logic**
  Implement `selectModel`, `moveActiveModel`, and updated `executeCommand`:
  ```typescript
  const selectModel = (model: {
    id: string;
    providerId: string;
    providerName: string;
    modelId: string;
    modelName: string;
  }): void => {
    onModelChange({ provider: model.providerId, model: model.modelId });
    toast.success(`已切换模型为: ${model.modelName}`);
    setInputText("");
    draftInputRef.current = "";
    historyCursorRef.current = null;
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const moveActiveModel = (direction: 1 | -1): void => {
    setActiveModelIndex((currentIndex) => {
      if (matchedModels.length === 0) {
        return 0;
      }
      return (
        (currentIndex + direction + matchedModels.length) %
        matchedModels.length
      );
    });
  };
  ```

  And modify `executeCommand` to capture `"model"`:
  ```typescript
  const executeCommand = (command: AiChatInputCommand): void => {
    if (isGenerating) {
      toast.warning("请等待 AI 输出完成");
      return;
    }
    setIsCommandPanelOpen(false);
    closeAgentMentionPanel();

    if (command.id === "model") {
      const text = "/model ";
      setInputText(text);
      draftInputRef.current = text;
      historyCursorRef.current = null;
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    void Promise.resolve(onCommandExecute(command.id))
      .then((nextInputText) => {
        if (!command.addToContext) {
          const text = nextInputText ?? "";
          setInputText(text);
          draftInputRef.current = text;
          historyCursorRef.current = null;
        }
      })
      .catch(() => {
        if (!command.addToContext) {
          setInputText("");
          draftInputRef.current = "";
          historyCursorRef.current = null;
        }
      });
    requestAnimationFrame(() => textareaRef.current?.focus());
  };
  ```

- [ ] **Step 4: Update input change handler to close standard panel on Model Mode**
  Modify `handleInputChange` to immediately close normal slash panel when entering `/model` mode:
  ```typescript
  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ): void => {
    const nextValue = e.target.value;
    const nextMatchedCommands = getMatchedCommands(nextValue);

    setInputText(nextValue);
    draftInputRef.current = nextValue;
    historyCursorRef.current = null;
    setActiveCommandIndex(0);

    const isNextModelMode = nextValue === "/model" || nextValue.startsWith("/model ");

    if (isNextModelMode) {
      setIsCommandPanelOpen(false);
      closeAgentMentionPanel();
      return;
    }

    const shouldOpenCommandPanel =
      isCommandInput(nextValue) && nextMatchedCommands.length > 0;
    setIsCommandPanelOpen(shouldOpenCommandPanel);
    if (shouldOpenCommandPanel) {
      closeAgentMentionPanel();
      return;
    }

    syncAgentMentionPanel(nextValue, e.target.selectionStart);
  };
  ```

- [ ] **Step 5: Commit Task 2 changes**
  ```bash
  git add src/renderer/src/features/ai-chat/components/AiChatInput.tsx
  git commit -m "feat: add model selection states, computed lists, change handler, and selectModel trigger"
  ```

---

### Task 3: Textarea and CommandPanel Key Handling

**Files:**
- Modify: `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/features/ai-chat/components/AiChatInput.tsx`

- [ ] **Step 1: Add keyboard listeners inside textarea `handleKeyDown`**
  Modify `handleKeyDown` in `src/renderer/src/features/ai-chat/components/AiChatInput.tsx` to handle Model panel navigation:
  ```typescript
    if (isModelMode && matchedModels.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActiveModel(1);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActiveModel(-1);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setInputText("");
        draftInputRef.current = "";
        historyCursorRef.current = null;
        requestAnimationFrame(() => textareaRef.current?.focus());
        return;
      }

      if (e.key === "Enter") {
        if (e.nativeEvent.isComposing) {
          return;
        }
        e.preventDefault();
        const activeModel = matchedModels[activeModelIndex] ?? matchedModels[0];
        if (activeModel) {
          selectModel(activeModel);
        }
        return;
      }
    }
  ```

- [ ] **Step 2: Add keyboard listener for the Model Panel `handleModelPanelKeyDown`**
  Implement `handleModelPanelKeyDown` near `handleCommandPanelKeyDown`:
  ```typescript
  const handleModelPanelKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActiveModel(1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActiveModel(-1);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setInputText("");
      draftInputRef.current = "";
      historyCursorRef.current = null;
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const activeModel = matchedModels[activeModelIndex] ?? matchedModels[0];
      if (activeModel) {
        selectModel(activeModel);
      }
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      const nextValue = inputText.slice(0, -1);
      const nextMatchedCommands = getMatchedCommands(nextValue);
      setInputText(nextValue);
      draftInputRef.current = nextValue;
      historyCursorRef.current = null;

      const isNextModelMode = nextValue === "/model" || nextValue.startsWith("/model ");
      if (isNextModelMode) {
        setActiveModelIndex(0);
      } else {
        setActiveCommandIndex(0);
        setIsCommandPanelOpen(
          isCommandInput(nextValue) && nextMatchedCommands.length > 0,
        );
      }
      requestAnimationFrame(adjustTextareaHeight);
    }
  };
  ```

- [ ] **Step 3: Commit Task 3 changes**
  ```bash
  git add src/renderer/src/features/ai-chat/components/AiChatInput.tsx
  git commit -m "feat: implement textarea keydown and panel keydown event routing for model panel"
  ```

---

### Task 4: Integrate the new `CommandPanel` for Model Selection

**Files:**
- Modify: `/Users/yonah/projects/agent/memory-curator-agent/src/renderer/src/features/ai-chat/components/AiChatInput.tsx`

- [ ] **Step 1: Render the model selection `CommandPanel`**
  Add the model selection `CommandPanel` next to existing `CommandPanel`s (e.g., right below the Agent selection panel):
  ```typescript
        <CommandPanel
          isOpen={isModelMode && matchedModels.length > 0}
          ariaLabel="AI Model Selection Panel"
          items={matchedModels}
          activeIndex={activeModelIndex}
          onActiveIndexChange={setActiveModelIndex}
          onItemSelect={selectModel}
          onKeyDown={handleModelPanelKeyDown}
          idPrefix="ai-chat-model"
          renderItem={(model) => (
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] font-semibold text-white">
                {model.modelName}
              </span>
              <span className="text-xs text-white/30">-</span>
              <span className="truncate text-xs text-white/45">
                {model.providerName}
              </span>
            </span>
          )}
        />
  ```

- [ ] **Step 2: Commit Task 4 changes**
  ```bash
  git add src/renderer/src/features/ai-chat/components/AiChatInput.tsx
  git commit -m "feat: render model selection CommandPanel within chat workspace input layout"
  ```

---

### Task 5: Compilation and Verification

- [ ] **Step 1: Run project linter and TypeScript compiler checks**
  Run local build/checking commands to verify code compilation and standards:
  ```bash
  npm run typecheck
  ```

- [ ] **Step 2: Verify zero linter errors**
  Make sure no compiler or TypeScript errors exist. If any are found, fix them immediately.
