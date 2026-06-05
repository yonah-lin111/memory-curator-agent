# Unified Input Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a unified public custom Input component supporting both input and textarea polymorphic modes, styled consistent with Select.tsx, and refactor TodayNoteEntryModal.tsx to use it.

**Architecture:** A polymorphic React component `<Input>` using `React.forwardRef` to pass ref correctly to the underlying `<input>` or `<textarea>` element, with standard style configurations.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, React Testing Library.

---

### Task 1: Create the Input Component

**Files:**
- Create: `src/renderer/src/components/ui/Input.tsx`

- [ ] **Step 1: Write the `<Input>` component implementation**

Write the following code into `src/renderer/src/components/ui/Input.tsx`:

```tsx
import type React from "react";
import { forwardRef } from "react";

export interface InputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    "size"
  > {
  /**
   * 决定渲染为 input 还是 textarea
   * @default "input"
   */
  as?: "input" | "textarea";
  /**
   * 输入框尺寸类型
   * - "sm": standard (text-sm, px-3 py-1.5, or p-2.5 if textarea)
   * - "xs": small/tag (text-xs, px-3 py-1.5)
   * @default "sm"
   */
  size?: "sm" | "xs";
  /**
   * 背景色 Class
   * @default "bg-[#303030]"
   */
  bgClass?: string;
}

/**
 * Input - 统一的自定义公共输入框/文本域组件
 * 样式背景和高亮参考 Select.tsx 设计，支持多态渲染、尺寸定制和 Ref 转发。
 */
export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  (
    {
      as = "input",
      size = "sm",
      bgClass = "bg-[#303030]",
      className = "",
      ...props
    },
    ref
  ) => {
    // 基础共有样式
    const baseClass = `rounded-[6px] border border-white/10 ${bgClass} text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 hover:border-white/20 focus:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed`;

    // 尺寸和元素样式定制
    const isTextarea = as === "textarea";
    const sizeClass = isTextarea
      ? "text-sm p-2.5 leading-relaxed resize-none min-h-24"
      : size === "xs"
      ? "text-xs px-3 py-1.5"
      : "text-sm px-3 py-1.5";

    const combinedClassName = `${baseClass} ${sizeClass} ${className}`.trim();

    if (isTextarea) {
      return (
        <textarea
          ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
          className={combinedClassName}
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      );
    }

    return (
      <input
        ref={ref as React.ForwardedRef<HTMLInputElement>}
        className={combinedClassName}
        {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    );
  }
);

Input.displayName = "Input";
```

### Task 2: Write Unit Tests for Input Component

**Files:**
- Create: `test/renderer/components/ui/Input.test.tsx`

- [ ] **Step 1: Write the failing / descriptive tests**

Write the following code to `test/renderer/components/ui/Input.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Input } from "@/components/ui/Input";

describe("Input Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders input element by default with correct styles", () => {
    render(<Input placeholder="Test input" />);
    const input = screen.getByPlaceholderText("Test input");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveClass("bg-[#303030]");
    expect(input).toHaveClass("text-sm");
  });

  it("renders textarea element when as='textarea' is provided", () => {
    render(<Input as="textarea" placeholder="Test textarea" />);
    const textarea = screen.getByPlaceholderText("Test textarea");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveClass("bg-[#303030]");
    expect(textarea).toHaveClass("min-h-24");
    expect(textarea).toHaveClass("resize-none");
  });

  it("applies correct xs size styles", () => {
    render(<Input size="xs" placeholder="XS input" />);
    const input = screen.getByPlaceholderText("XS input");
    expect(input).toHaveClass("text-xs");
  });

  it("propagates change events correctly", async () => {
    const user = userEvent.setup();
    render(<Input placeholder="Type here" />);
    const input = screen.getByPlaceholderText("Type here") as HTMLInputElement;
    
    await user.type(input, "hello");
    expect(input.value).toBe("hello");
  });
});
```

- [ ] **Step 2: Run test suite to verify implementation**

Run command: `npm run test` or direct vitest testing command.

Expected output: Tests pass successfully.

### Task 3: Refactor TodayNoteEntryModal to Use the New Input Component

**Files:**
- Modify: `src/renderer/src/pages/today/components/TodayNoteEntryModal.tsx`

- [ ] **Step 1: Import the new Input component**

Remove direct `<input>`/`<textarea>` styling and replace with `<Input>`.

At the top of `src/renderer/src/pages/today/components/TodayNoteEntryModal.tsx`:
```tsx
import { Input } from "@/components/ui/Input";
```

- [ ] **Step 2: Replace Title Input**

Around lines 118-125, replace:
```tsx
            <input
              aria-label="Snippet title"
              className="rounded-[6px] border border-white/10 bg-black px-3 py-1.5 text-sm font-normal text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25"
              placeholder="给这段想法一个临时标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
```
with:
```tsx
            <Input
              aria-label="Snippet title"
              placeholder="给这段想法一个临时标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
```

- [ ] **Step 3: Replace Content Textarea**

Around lines 128-135, replace:
```tsx
            <textarea
              aria-label="Snippet content"
              className="min-h-24 resize-none rounded-[6px] border border-white/10 bg-black p-2.5 text-sm font-normal leading-relaxed text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25"
              placeholder="保留原始表达，不急着归类..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
```
with:
```tsx
            <Input
              as="textarea"
              aria-label="Snippet content"
              placeholder="保留原始表达，不急着归类..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
```

- [ ] **Step 4: Replace Tag Input**

Around lines 154-177, replace:
```tsx
              <input
                aria-label="Input new tag"
                disabled={tags.length >= 6}
                className="w-full rounded-[6px] border border-white/10 bg-black px-3 py-1.5 text-xs font-normal text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed"
                placeholder={tags.length >= 6 ? "最多可添加 6 个标签" : "输入新标签并按回车确认..."}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const trimmed = tagInput.trim();
                    if (trimmed) {
                      if (tags.length >= 6) {
                        return;
                      }
                      if (!tags.includes(trimmed)) {
                        setTags((current) => [...current, trimmed]);
                      }
                      setTagInput("");
                    }
                  }
                }}
              />
```
with:
```tsx
              <Input
                aria-label="Input new tag"
                disabled={tags.length >= 6}
                size="xs"
                placeholder={tags.length >= 6 ? "最多可添加 6 个标签" : "输入新标签并按回车确认..."}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const trimmed = tagInput.trim();
                    if (trimmed) {
                      if (tags.length >= 6) {
                        return;
                      }
                      if (!tags.includes(trimmed)) {
                        setTags((current) => [...current, trimmed]);
                      }
                      setTagInput("");
                    }
                  }
                }}
              />
```

- [ ] **Step 5: Run tests and type checks**

Run commands to verify everything works:
```bash
npm run test
```

And check types and linting:
```bash
npm run typecheck
```
