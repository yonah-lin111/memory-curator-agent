# Squeeze Chat Input When Context Timeline is Open Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the layout in `AiChatWorkspace.tsx` so that when the context timeline is open, both the message scroll list and the input area are squeezed inside the remaining workspace area.

**Architecture:** Wrap the message scroll list (`messagesContainerRef`) and the chat input (`AiChatInput`) into a single left-side vertical flex container (`flex-1 flex flex-col min-w-0 min-h-0`), while the right side remains the `AiChatContextTimeline` component.

**Tech Stack:** React, TypeScript, Tailwind CSS

---

### Task 1: Reorganize Layout in `AiChatWorkspace.tsx`

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatWorkspace.tsx:764-876`
- Test: `test/renderer/features/ai-chat/AiChatWorkspace.test.tsx`

- [ ] **Step 1: Modify layout wrapper in `AiChatWorkspace.tsx`**

We will change the structure inside `AiChatWorkspace.tsx` to group the scroll container and the `AiChatInput` in a vertical flex container.

Replace the lines from `764: {/* 消息区域容器：支持左右并排（两个列表）展示 */}` down to the end of the return statement with the restructured layout:

```tsx
<<<<
      {/* 消息区域容器：支持左右并排（两个列表）展示 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左侧：消息列表 */}
        <div
          ref={messagesContainerRef}
          style={{
            paddingLeft: "1rem",
            paddingRight: "1rem",
          }}
          className="flex-1 overflow-y-auto custom-scrollbar [scrollbar-gutter:stable] py-4 flex flex-col min-w-0 transition-all duration-300 ease-in-out"
        >
          <div className="max-w-[860px] mx-auto w-full flex flex-col gap-4 flex-1">
            {session.messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-8 select-none">
                <div className="mb-2 text-base font-medium text-white/95">
                  整理记忆与行动启发
                </div>
                <p className="max-w-md text-xs text-white/40 leading-relaxed">
                  在此向 AI 提问。它可以基于你的 Today
                  待办、随记和日记草稿等上下文，为你梳理核心记忆线索并生成具体行动建议。
                </p>
              </div>
            ) : (
              session.messages.map((message, index) => {
                const isLast = index === session.messages.length - 1;
                const isGenerating =
                  isLast &&
                  session.status === "running" &&
                  message.role === "assistant";
                const previousMessage = session.messages[index - 1];
                const canRegenerate =
                  message.role === "assistant" &&
                  isLast &&
                  message.id === latestAssistantMessageId &&
                  previousMessage?.role === "user" &&
                  session.status !== "running";
                const shouldPinToTop = message.id === topPinnedUserId;

                const isLastUser =
                  message.role === "user" &&
                  index === session.messages.length - 2;

                return (
                  <div
                    key={message.id}
                    ref={shouldPinToTop ? latestUserMessageRef : null}
                  >
                    <AiChatMessageBubble
                      message={message}
                      isLastUser={isLastUser}
                      isGenerating={isGenerating}
                      canRegenerate={canRegenerate}
                      onSubmitAskAnswer={onSubmitAskAnswer}
                      onSubmitToolConfirmationAnswer={
                        onSubmitToolConfirmationAnswer
                      }
                      onOpenContextMenu={handleOpenMessageContextMenu}
                      onEditAndResendUserMessage={onEditAndResendUserMessage}
                      onThinkingBlockToggle={handleThinkingBlockToggle}
                      onToolConfirmationToggle={handleThinkingBlockToggle}
                      onUserEditStateChange={handleUserEditStateChange}
                    />
                  </div>
                );
              })
            )}
            {bottomSpacerHeight > 0 && (
              <div
                data-ai-chat-bottom-spacer="true"
                style={{ height: `${bottomSpacerHeight}px` }}
                className="flex-shrink-0"
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 右侧：上下文时间线 */}
        <AiChatContextTimeline
          items={contextItems}
          budget={contextBudget}
          messages={session.messages}
          isOpen={isContextTimelineOpen}
        />
      </div>

      {messageContextMenu ? (
        <AiChatMessageContextMenu
          x={messageContextMenu.x}
          y={messageContextMenu.y}
          canRegenerate={messageContextMenu.canRegenerate}
          onCopyText={handleCopyText}
          onCopyMarkdown={handleCopyMarkdown}
          onRegenerate={handleRegenerate}
          onDeleteQa={handleDeleteQa}
          onEdit={messageContextMenu.onEdit ? handleEdit : undefined}
        />
      ) : null}

      {/* 输入区域 */}
      <AiChatInput
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        contextUsagePercent={contextBudget.usagePercent}
        contextTokens={contextBudget.totalTokens}
        contextLimit={contextBudget.contextLimit}
        isGenerating={session.status === "running"}
        onSendMessage={onSendMessage}
        onCommandExecute={onCommandExecute}
        onModelChange={onModelChange}
      />
====
>>>>
      {/* 消息区域容器：支持左右并排（两个列表）展示 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左侧：消息区域（消息列表 + 输入区域） */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* 消息列表 */}
          <div
            ref={messagesContainerRef}
            style={{
              paddingLeft: "1rem",
              paddingRight: "1rem",
            }}
            className="flex-1 overflow-y-auto custom-scrollbar [scrollbar-gutter:stable] py-4 flex flex-col min-w-0 transition-all duration-300 ease-in-out"
          >
            <div className="max-w-[860px] mx-auto w-full flex flex-col gap-4 flex-1">
              {session.messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center p-8 select-none">
                  <div className="mb-2 text-base font-medium text-white/95">
                    整理记忆与行动启发
                  </div>
                  <p className="max-w-md text-xs text-white/40 leading-relaxed">
                    在此向 AI 提问。它可以基于你的 Today
                    待办、随记和日记草稿等上下文，为你梳理核心记忆线索并生成具体行动建议。
                  </p>
                </div>
              ) : (
                session.messages.map((message, index) => {
                  const isLast = index === session.messages.length - 1;
                  const isGenerating =
                    isLast &&
                    session.status === "running" &&
                    message.role === "assistant";
                  const previousMessage = session.messages[index - 1];
                  const canRegenerate =
                    message.role === "assistant" &&
                    isLast &&
                    message.id === latestAssistantMessageId &&
                    previousMessage?.role === "user" &&
                    session.status !== "running";
                  const shouldPinToTop = message.id === topPinnedUserId;

                  const isLastUser =
                    message.role === "user" &&
                    index === session.messages.length - 2;

                  return (
                    <div
                      key={message.id}
                      ref={shouldPinToTop ? latestUserMessageRef : null}
                    >
                      <AiChatMessageBubble
                        message={message}
                        isLastUser={isLastUser}
                        isGenerating={isGenerating}
                        canRegenerate={canRegenerate}
                        onSubmitAskAnswer={onSubmitAskAnswer}
                        onSubmitToolConfirmationAnswer={
                          onSubmitToolConfirmationAnswer
                        }
                        onOpenContextMenu={handleOpenMessageContextMenu}
                        onEditAndResendUserMessage={onEditAndResendUserMessage}
                        onThinkingBlockToggle={handleThinkingBlockToggle}
                        onToolConfirmationToggle={handleThinkingBlockToggle}
                        onUserEditStateChange={handleUserEditStateChange}
                      />
                    </div>
                  );
                })
              )}
              {bottomSpacerHeight > 0 && (
                <div
                  data-ai-chat-bottom-spacer="true"
                  style={{ height: `${bottomSpacerHeight}px` }}
                  className="flex-shrink-0"
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 输入区域 */}
          <AiChatInput
            modelOptions={modelOptions}
            selectedModel={selectedModel}
            contextUsagePercent={contextBudget.usagePercent}
            contextTokens={contextBudget.totalTokens}
            contextLimit={contextBudget.contextLimit}
            isGenerating={session.status === "running"}
            onSendMessage={onSendMessage}
            onCommandExecute={onCommandExecute}
            onModelChange={onModelChange}
          />
        </div>

        {/* 右侧：上下文时间线 */}
        <AiChatContextTimeline
          items={contextItems}
          budget={contextBudget}
          messages={session.messages}
          isOpen={isContextTimelineOpen}
        />
      </div>

      {messageContextMenu ? (
        <AiChatMessageContextMenu
          x={messageContextMenu.x}
          y={messageContextMenu.y}
          canRegenerate={messageContextMenu.canRegenerate}
          onCopyText={handleCopyText}
          onCopyMarkdown={handleCopyMarkdown}
          onRegenerate={handleRegenerate}
          onDeleteQa={handleDeleteQa}
          onEdit={messageContextMenu.onEdit ? handleEdit : undefined}
        />
      ) : null}
====
```

- [ ] **Step 2: Run test suite to verify the changes**

Run: `npx vitest run test/renderer/features/ai-chat/AiChatWorkspace.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/features/ai-chat/components/AiChatWorkspace.tsx
git commit -m "style: squeeze chat input container when context timeline is open"
```
