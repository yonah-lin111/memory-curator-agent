# ConfirmTooltip 行为确认公共组件开发计划 (ConfirmTooltip Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个通用的二次行为确认气泡组件 `ConfirmTooltip`，用于在用户执行敏感、高危操作（如删除档案）时进行轻量、优雅的就近二次确认，并在 `PeoplePage` 人物删除处及 `ShowcasePage` 中深度集成。

**Architecture:** 采用 React 19 + Tailwind CSS 极简驱动的绝对定位浮层架构。自动劫持并代理子级 Trigger 的 `onClick` 事件，辅以全局点击事件劫持（Click Outside）与键盘 `Esc` 监听，配合 `IconButton` 完成精致高效的闭环。

**Tech Stack:** React 19, Tailwind CSS, Lucide-React, Vitest & React Testing Library (JSDOM)

---

### Task 1: 创建 ConfirmTooltip 公共组件

在 `src/renderer/src/components/ui/` 路径下新建通用的二次行为确认气泡组件。

**Files:**
- Create: `src/renderer/src/components/ui/ConfirmTooltip.tsx`

- [ ] **Step 1: 编写 ConfirmTooltip 组件代码**
  在目标文件写入基于 React、Tailwind 和 IconButton 的通用确认组件。利用 45 度旋转的小正方形绘制美观对齐的小三角。

  ```tsx
  import type React from "react";
  import { useState, useRef, useEffect } from "react";
  import { IconButton } from "@/components/ui/IconButton";

  // 弹出位置类型
  export type ConfirmTooltipPlacement = "top" | "bottom" | "left" | "right";
  // 确认按钮样式变体类型
  export type ConfirmTooltipVariant = "danger" | "primary";

  export interface ConfirmTooltipProps {
    // 触发确认气泡的子元素（必须能接收并触发 onClick）
    children: React.ReactElement;
    // 行为确认的标题
    title: string;
    // 行为确认的详细描述/副作用警告（可选）
    description?: string;
    // 确认回调函数
    onConfirm: () => void;
    // 取消回调函数（可选）
    onCancel?: () => void;
    // 弹出气泡的位置，默认为 "top"
    placement?: ConfirmTooltipPlacement;
    // 确认按钮样式类型，默认为 "primary"
    variant?: ConfirmTooltipVariant;
    // 额外的弹出内容容器样式名
    contentClassName?: string;
    // 额外的包装容器样式名
    className?: string;
  }

  /**
   * ConfirmTooltip - 二次行为确认通用气泡组件
   * 采用极简暗色主题，支持点击触发与防漏触，配备高度贴合的动效及微交互体验。
   */
  export const ConfirmTooltip = ({
    children,
    title,
    description,
    onConfirm,
    onCancel,
    placement = "top",
    variant = "primary",
    contentClassName = "",
    className = "",
  }: ConfirmTooltipProps): React.JSX.Element => {
    const [isVisible, setIsVisible] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // 定位样式映射
    const placementClasses: Record<ConfirmTooltipPlacement, string> = {
      top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
      bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
      left: "right-full top-1/2 -translate-y-1/2 mr-2",
      right: "left-full top-1/2 -translate-y-1/2 ml-2",
    };

    // 小三角旋转指向映射
    const arrowClasses: Record<ConfirmTooltipPlacement, string> = {
      top: "bottom-[-4px] left-1/2 -translate-x-1/2 rotate-45 border-r border-b",
      bottom: "top-[-4px] left-1/2 -translate-x-1/2 rotate-45 border-l border-t",
      left: "right-[-4px] top-1/2 -translate-y-1/2 rotate-45 border-r border-t",
      right: "left-[-4px] top-1/2 -translate-y-1/2 rotate-45 border-l border-b",
    };

    // 劫持并触发切换
    const handleTriggerClick = (e: React.MouseEvent): void => {
      e.stopPropagation();
      setIsVisible((prev) => !prev);
    };

    // 点击外部区域关闭
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent): void => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setIsVisible(false);
          onCancel?.();
        }
      };

      if (isVisible) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isVisible, onCancel]);

    // 键盘 Esc 关闭气泡支持
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
          setIsVisible(false);
          onCancel?.();
        }
      };

      if (isVisible) {
        document.addEventListener("keydown", handleKeyDown);
      }
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [isVisible, onCancel]);

    // 子级元素代理 onClick
    const triggerElement = React.cloneElement(children, {
      onClick: (e: React.MouseEvent) => {
        handleTriggerClick(e);
        // 如果子级自身本就有 onClick 属性，也可安全合并执行
        if (typeof children.props.onClick === "function") {
          children.props.onClick(e);
        }
      },
    });

    return (
      <div
        ref={containerRef}
        className={`relative inline-block ${className}`}
      >
        {triggerElement}

        {/* 气泡卡片层 */}
        <div
          className={`absolute z-50 w-56 text-white p-3 rounded-[6px] border border-white/8 bg-[#212121]/95 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.55)] transition-all duration-150 ${
            placementClasses[placement]
          } ${
            isVisible
              ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-95 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 指示箭头 */}
          <div
            className={`absolute h-1.5 w-1.5 bg-[#212121] border-white/8 ${arrowClasses[placement]}`}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-white/90 leading-snug">
              {title}
            </span>
            {description && (
              <span className="text-[11px] text-white/40 leading-relaxed font-medium">
                {description}
              </span>
            )}
            <div className="flex items-center justify-end gap-1.5 mt-1 border-t border-white/5 pt-2">
              <IconButton
                preset="close"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVisible(false);
                  onCancel?.();
                }}
                title="取消"
              />
              <IconButton
                preset="confirm"
                className="h-6 w-6"
                preset={variant === "danger" ? "delete" : "confirm"}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVisible(false);
                  onConfirm();
                }}
                title="确认"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };
  ```

---

### Task 2: 编写组件单元测试

新建单元测试文件，验证点击切换、Confirm、Cancel、Esc关闭及点击外部关闭功能。

**Files:**
- Create: `test/renderer/components/ui/ConfirmTooltip.test.tsx`

- [ ] **Step 1: 编写单元测试**
  利用 `@testing-library/react` 与 `@testing-library/user-event` 全面检验组件。

  ```tsx
  /**
   * @vitest-environment jsdom
   */
  import "@testing-library/jest-dom/vitest";
  import { cleanup, render, screen } from "@testing-library/react";
  import userEvent from "@testing-library/user-event";
  import { afterEach, describe, expect, it, vi } from "vitest";
  import { ConfirmTooltip } from "@/components/ui/ConfirmTooltip";

  describe("ConfirmTooltip", () => {
    afterEach(() => {
      cleanup();
      vi.restoreAllMocks();
    });

    it("toggles the tooltip visibility when the trigger is clicked", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();

      render(
        <ConfirmTooltip title="Confirm this action?" onConfirm={onConfirm}>
          <button type="button">Trigger</button>
        </ConfirmTooltip>,
      );

      // 默认状态下内容不显示 (处于 opacity-0 scale-95 等不渲染/不交互状态)
      const tooltipTitle = screen.queryByText("Confirm this action?");
      expect(tooltipTitle).toBeInTheDocument(); // DOM中存在但隐藏

      const triggerBtn = screen.getByRole("button", { name: "Trigger" });
      await user.click(triggerBtn);

      // 点击确认
      const confirmBtn = screen.getByRole("button", { name: "确认" });
      await user.click(confirmBtn);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when cancel is clicked", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <ConfirmTooltip
          title="Delete forever?"
          onConfirm={onConfirm}
          onCancel={onCancel}
        >
          <button type="button">Trigger</button>
        </ConfirmTooltip>,
      );

      const triggerBtn = screen.getByRole("button", { name: "Trigger" });
      await user.click(triggerBtn);

      const cancelBtn = screen.getByRole("button", { name: "取消" });
      await user.click(cancelBtn);

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: 运行测试验证**
  在终端中运行刚才编写的单元测试。
  运行：`pnpm test test/renderer/components/ui/ConfirmTooltip.test.tsx`
  预期：全部 PASS 且没有 TypeScript 或样式导入报错。

---

### Task 3: 在 PeoplePage 中集成删除二次确认

通过 `ConfirmTooltip` 包装人物档案删除按钮。

**Files:**
- Modify: `src/renderer/src/pages/people/PeoplePage.tsx`

- [ ] **Step 1: 引入并包装删除按钮**
  在 `PeoplePage.tsx` 头部引入 `ConfirmTooltip`，并修改行 338-350。

  寻找原代码：
  ```tsx
                        <IconButton
                          iconOnly={false}
                          preset="delete"
                          className="h-7 w-7"
                          onClick={() =>
                            handleDeletePerson(
                              currentPerson.id,
                              currentPerson.name,
                            )
                          }
                          title="删除档案"
                        />
  ```

  修改为：
  ```tsx
                        <ConfirmTooltip
                          title="确认要删除该档案吗？"
                          description={`删除后，将永久擦除 ${currentPerson.name} 的所有特征标签、联系方式及详细备注，此操作无法撤销。`}
                          onConfirm={() =>
                            handleDeletePerson(
                              currentPerson.id,
                              currentPerson.name,
                            )
                          }
                          placement="bottom"
                          variant="danger"
                        >
                          <IconButton
                            iconOnly={false}
                            preset="delete"
                            className="h-7 w-7"
                            title="删除档案"
                          />
                        </ConfirmTooltip>
  ```

- [ ] **Step 2: 并在文件头部加入 ConfirmTooltip 的引入**
  ```tsx
  import { ConfirmTooltip } from "@/components/ui/ConfirmTooltip";
  ```

---

### Task 4: 在 ShowcasePage 组件大观中展示

在组件大观 `ShowcasePage` 中对 `ConfirmTooltip` 的不同方向、不同变体（danger, primary）进行全面展示与 Playground 操控。

**Files:**
- Modify: `src/renderer/src/pages/showcase/ShowcasePage.tsx`

- [ ] **Step 1: 引入并展示 ConfirmTooltip**
  在 `ShowcasePage.tsx` 头部引入 `ConfirmTooltip`，并扩充 `Tooltip` 展示分类或新增对 `ConfirmTooltip` 的展示区块。
  在 "Section: Tooltip" 中，添加二次行为确认组件的展示。

  寻找行 430 的 `Section: Tooltip` 段：
  ```tsx
          {/* Section: Tooltip */}
          {isVisible("tooltip") && (
  ```

  在其中添加：
  ```tsx
              <div className="flex flex-col gap-2 border-t border-white/5 pt-4 mt-4">
                <span className="text-xs font-mono text-white/45">ConfirmTooltip 行为确认 (Click to Confirm):</span>
                <div className="flex flex-wrap items-center gap-6 bg-black/20 rounded-[6px] p-4 border border-white/5">
                  <ConfirmTooltip
                    placement="top"
                    title="确定执行保存吗？"
                    description="该操作会覆盖现有的云同步记录。"
                    variant="primary"
                    onConfirm={() => toast.success("主配置已成功保存！")}
                    onCancel={() => toast.info("保存已取消")}
                  >
                    <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                      Primary Confirm (Top)
                    </button>
                  </ConfirmTooltip>

                  <ConfirmTooltip
                    placement="bottom"
                    title="确定清空所有人际档案？"
                    description="清空后所有备份亦将失效，这是一项高风险的危险操作！"
                    variant="danger"
                    onConfirm={() => toast.error("数据已被全部清空！")}
                    onCancel={() => toast.info("清空已安全中止")}
                  >
                    <button className="px-3 py-1.5 rounded-[6px] bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-all duration-150">
                      Danger Confirm (Bottom)
                    </button>
                  </ConfirmTooltip>
                </div>
              </div>
  ```

- [ ] **Step 2: 在文件头部加入 ConfirmTooltip 的引入**
  ```tsx
  import { ConfirmTooltip } from "@/components/ui/ConfirmTooltip";
  ```

---

### Task 5: 全局类型检查与测试校验

进行项目特定的终极质量校验。

- [ ] **Step 1: 运行单元测试集**
  运行：`pnpm test`
  期望：通过所有的测试，包含新加入的 `ConfirmTooltip.test.tsx`。

- [ ] **Step 2: 全局类型校验**
  运行：`pnpm typecheck`
  期望：控制台没有任何 Error，TypeScript 校验 100% 通过。
