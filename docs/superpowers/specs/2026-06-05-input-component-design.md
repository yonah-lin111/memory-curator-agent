# Design Spec: Unified Common Input Component

## 1. Requirement & Background

Currently, the `TodayNoteEntryModal.tsx` contains three variations of input fields (title input, content textarea, and tag input draft). They are styled using manual Tailwind classes. To make the project codebase cleaner, more uniform, and highly maintainable, we need to extract these forms into a single unified public input component located in `@/components/ui/Input.tsx` (on disk as `src/renderer/src/components/ui/Input.tsx`).

The new `<Input>` component should adopt background colors and hover/focus highlight styles consistent with `Select.tsx`:
- Background color defaults to `bg-[#303030]` instead of `bg-black`.
- Hover border color transitions to `hover:border-white/20`.
- Focus border color transitions to `focus:border-white/25`.
- Border radius is fixed at `rounded-[6px]`.
- Normal transition styles are applied: `transition-all duration-150`.

## 2. API Design

We will implement a polymorphic component that can render either as `<input>` or as `<textarea>` depending on the `as` prop.

```typescript
import type React from "react";

export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "size"
> {
  /**
   * Render either a standard HTML input or a textarea.
   * @default "input"
   */
  as?: "input" | "textarea";
  
  /**
   * The size of the input/textarea.
   * - "sm": text-sm font-normal px-3 py-1.5 (or p-2.5 for textarea)
   * - "xs": text-xs font-normal px-3 py-1.5
   * @default "sm"
   */
  size?: "sm" | "xs";

  /**
   * Custom background class (for overriding the default background #303030).
   * @default "bg-[#303030]"
   */
  bgClass?: string;
}
```

## 3. Implementation Details

- **File Path**: `src/renderer/src/components/ui/Input.tsx`
- **Test File Path**: `test/renderer/components/ui/Input.test.tsx`
- **TS Convention**: Unified arrow functions,简体中文 comments.
- **Imports**: All imports using absolute path alias `@/`.
- **Refactoring Targets**: Refactor `TodayNoteEntryModal.tsx` to use the new `<Input>` component.

## 4. Verification & Testing

- Create `test/renderer/components/ui/Input.test.tsx` using `vitest` and `@testing-library/react`.
- Verify input works, change events propagate correctly, placeholder is visible, and the `as="textarea"` compiles and works cleanly.
- Run `npm run test` or direct test commands to ensure 100% test pass rate.
