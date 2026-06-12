# Design Spec: `/model` Command for Selecting AI Models in Command Palette

## 1. Background & Purpose
Currently, users select AI models via a standard dropdown `Select` component at the bottom of the chat workspace. While functional, this requires mouse interaction and breaks the keyboard-centric developer experience.
This design introduces a new slash command `/model` which triggers a model selection palette inside the floating command panel. Users can filter models using fuzzy text matching, navigate options with Arrow keys, and switch models by pressing Enter.

## 2. Requirements & User Experience (UX)
- **Command Registration**: Add `/model` as a registered slash command.
- **Trigger Condition**:
  - Typing `/model` and pressing Enter in the chat input.
  - Or selecting `/model` from the slash command list and pressing Enter.
- **Model Mode Execution**:
  - When the command is executed, `inputText` becomes `"/model "` and the system enters "Model Selection Mode".
  - The standard slash command panel closes, and a dedicated **Model Selection Panel** opens at the same position.
  - If the user types further, the model list is filtered in real-time by model name or provider name.
- **Keyboard Navigation**:
  - Arrow Up/Down to navigate the list of models.
  - Enter to confirm/select the active model.
  - Escape to close the model list and clear the input.
  - Backspace to return to standard chat input if `/model` is deleted.
- **Successful Switch**:
  - On selecting a model, the active AI model switches seamlessly.
  - A success toast is displayed (e.g. `已切换模型为: <modelName>`).
  - The input is cleared and refocused.

## 3. Technical Design

### State Additions in `AiChatInput.tsx`
- `activeModelIndex`: `number` (tracks current highlighted model in the list)

### Computed Variables
- `isModelMode`: `boolean`
  - Computed as `inputText === "/model" || inputText.startsWith("/model ")`
- `modelQuery`: `string`
  - Computed as `inputText.startsWith("/model ") ? inputText.slice(7).trim() : ""`
- `allModels`: An array of flat model objects extracted from `modelOptions`:
  ```typescript
  type FlatModelOption = {
    id: string; // "providerId::modelId"
    providerId: string;
    providerName: string;
    modelId: string;
    modelName: string;
  };
  ```
- `matchedModels`: filtered subset of `allModels` based on `modelQuery` (case-insensitive includes matching on model name or provider name).
- `isModelPanelOpen`: `boolean`
  - Computed as `isModelMode && matchedModels.length > 0`

### Interaction Logic
1. **Command Panel Integration**:
   - Update `AiChatInputCommandId` union type and `AI_CHAT_INPUT_COMMANDS` array to include `"model"`.
   - In `executeCommand(command)`:
     ```typescript
     if (command.id === "model") {
       const text = "/model ";
       setInputText(text);
       draftInputRef.current = text;
       historyCursorRef.current = null;
       requestAnimationFrame(() => textareaRef.current?.focus());
       return;
     }
     ```
2. **Textarea Keydown Handling (`handleKeyDown`)**:
   - If `isModelPanelOpen` is true:
     - `ArrowDown`/`ArrowUp`: Call `moveActiveModel(1)` / `moveActiveModel(-1)`.
     - `Escape`: Clear input (`setInputText("")`, etc.).
     - `Enter`: Trigger selection of the active model.
3. **Model Selection**:
   - Trigger `onModelChange({ provider: model.providerId, model: model.modelId })`.
   - Trigger `toast.success("已切换模型为: " + model.modelName)`.
   - Clear and focus input.

## 4. Verification Plan
- Type `/` to see `/model` in the list.
- Select `/model` and verify it populates the input with `/model ` and displays the model selection list.
- Type a search query like `gpt` or `claude` and verify real-time filtering.
- Use Arrow Keys to navigate and press Enter to select. Verify model switches successfully with a success toast.
- Press Escape or Backspace and verify proper exit behaviors.
