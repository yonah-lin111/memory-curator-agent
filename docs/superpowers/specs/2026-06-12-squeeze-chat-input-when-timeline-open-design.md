# Design Spec: Squeeze Chat Input When AI Chat Context Timeline is Open

## Goal

When the AI Chat Context Timeline (`AiChatContextTimeline.tsx`) is opened on the right side of the workspace, both the message list area and the input container (`AiChatInput.tsx`) should be squeezed (horizontally constrained to the remaining width) instead of the input container stretching across the full workspace width.

## Approach

### Layout Restructuring in `AiChatWorkspace.tsx`

Currently, `AiChatWorkspace` is structured as a vertical flex column:

```tsx
<section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[6px] border border-white/5 bg-[#212121]">
  {/* Left & Right layout wrapper */}
  <div className="flex-1 flex min-h-0 overflow-hidden">
    {/* Left: Message List */}
    <div className="flex-1 overflow-y-auto ... py-4 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
      ...
    </div>

    {/* Right: Context Timeline */}
    <AiChatContextTimeline isOpen={isContextTimelineOpen} ... />
  </div>

  {/* Input Area (Full Width) */}
  <AiChatInput ... />
</section>
```

To allow the input area to be squeezed, we will reorganize the structure so that the left side of the row layout contains both the message list and the input area:

```tsx
<section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[6px] border border-white/5 bg-[#212121]">
  {/* Left & Right layout wrapper */}
  <div className="flex-1 flex min-h-0 overflow-hidden">
    {/* Left: Message Container (Vertical flex containing message list AND input area) */}
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* Left Top: Scrollable Message List */}
      <div className="flex-1 overflow-y-auto ... py-4 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
        ...
      </div>

      {/* Left Bottom: Input Area */}
      <AiChatInput ... />
    </div>

    {/* Right: Context Timeline */}
    <AiChatContextTimeline isOpen={isContextTimelineOpen} ... />
  </div>
</section>
```

### Transition and Styles

- When `isContextTimelineOpen` toggles, the timeline component `AiChatContextTimeline` changes width from `0px` to `35vw` with a transition (`transition-all duration-300 ease-in-out`).
- The left container has `flex-1` and `min-w-0 min-h-0` class styles, which will scale smoothly and automatically as the timeline's width changes.
- Consequently, `<AiChatInput>` nested within this left container will scale and squeeze perfectly matching the width of the messages list viewport.

## Impact & Verification

- No changes to existing tests are required, but we should verify that `AiChatWorkspace.test.tsx` still passes.
- Perform visual testing of the UI: when the timeline is open, the input box is visually squeezed along with the message list.
