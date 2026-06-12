# Design Spec: Cycle Selection for Command and Agent Panels

## 1. Background & Purpose
Currently, both the Slash Command panel (`/`) and the Agent Mentions panel (`@`) use bounded navigation. That is, pressing Arrow Up at the first item or Arrow Down at the last item keeps the active selection at the boundary. This differs from the AI Model panel (`/model`), which supports circular/wrap-around cycling when navigating.
To unify the user experience and provide smooth keyboard navigation across all autocomplete panels, this design modifies the navigation of the Slash Command and Agent Mentions panels to support wrap-around cycling.

## 2. Requirements & User Experience (UX)
- **Wrap-around Cycling**:
  - When the first item is active, pressing Arrow Up wraps around to highlight the last item in the list.
  - When the last item is active, pressing Arrow Down wraps around to highlight the first item in the list.
- **Consistent Behavior**:
  - This change applies to the autocomplete suggestion dropdowns triggered by both `/` and `@`.

## 3. Technical Design

### `src/renderer/src/features/ai-chat/components/AiChatInput/hooks/useAiChatInput.ts`
- Modify `moveActiveCommand` to compute wrap-around index using modulo arithmetic:
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

### `src/renderer/src/features/ai-chat/components/AiChatInput/hooks/useAiChatMentions.ts`
- Modify `moveActiveAgent` to compute wrap-around index using modulo arithmetic:
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

## 4. Verification Plan
- Type `/` and navigate using Arrow keys. Verify that pressing Arrow Up at the first item selects the last command, and pressing Arrow Down at the last item selects the first command.
- Type `@` and navigate using Arrow keys. Verify that pressing Arrow Up at the first agent selects the last agent, and pressing Arrow Down at the last agent selects the first agent.
- Verify unit tests pass and compilation contains no errors.
