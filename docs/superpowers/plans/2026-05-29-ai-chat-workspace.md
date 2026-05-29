# AI Chat Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Project rule: do not run `git commit` or `git merge` unless the user explicitly asks.

**Goal:** Build a mock-only Telegram-style AI chat workspace that opens from the Header chat button, replaces Sidebar content with dialog history, and overlays the current page content.

**Architecture:** Keep `App.tsx` as the global layout state owner. Add focused layout-level chat components under `src/renderer/src/components/layout/`, use mock data only, and animate between page mode and chat mode with layered containers rather than route changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, lucide-react, Vitest, Testing Library.

---

## File Structure

- Create: `src/renderer/src/components/layout/aiChatMock.ts`
  - Owns chat types and mock data.
- Create: `src/renderer/src/components/layout/AiChatHistoryList.tsx`
  - Owns left Sidebar chat history UI.
- Create: `src/renderer/src/components/layout/AiToolCallBlock.tsx`
  - Owns ReAct-style tool execution summary UI.
- Create: `src/renderer/src/components/layout/AiChatMessageBubble.tsx`
  - Owns user and assistant chat bubble rendering.
- Create: `src/renderer/src/components/layout/AiChatWorkspace.tsx`
  - Owns Header-below chat main surface and composer.
- Modify: `src/renderer/src/components/layout/Header.tsx`
  - Make chat button controlled.
- Modify: `src/renderer/src/components/layout/Sidebar.tsx`
  - Add `navigation` / `chat` content modes.
- Modify: `src/renderer/src/App.tsx`
  - Add chat state, integrate Sidebar/Header/workspace, and layer transitions.
- Modify: `test/renderer/App.test.tsx`
  - Add mock chat interaction coverage.

## Task 1: Add Failing App Tests

**Files:**
- Modify: `test/renderer/App.test.tsx`

- [ ] **Step 1: Add chat open/close and session switching tests**

Append focused tests inside the existing `describe('App', () => {` block, before the closing `})` of the suite. Use exact user-facing labels so the tests lock the intended interaction.

```tsx
  it('点击 Header 聊天按钮后切换为 AI 对话模式，并可关闭恢复主导航', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(window.location.pathname).toBe('/today')

    await user.click(screen.getByRole('button', { name: '打开聊天' }))

    expect(screen.getByRole('button', { name: '关闭聊天' })).toBeInTheDocument()
    expect(screen.getByLabelText('对话历史列表')).toBeInTheDocument()
    expect(screen.getByLabelText('AI 对话主体')).toBeInTheDocument()
    expect(screen.getByText('AI DIALOGS')).toBeInTheDocument()
    expect(screen.getByText('整理今天的记忆线索')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/today')

    await user.click(screen.getByRole('button', { name: '关闭聊天' }))

    expect(screen.getByRole('button', { name: '打开聊天' })).toBeInTheDocument()
    expect(screen.getByLabelText('侧边栏主导航')).toBeInTheDocument()
    expect(screen.queryByLabelText('对话历史列表')).not.toBeInTheDocument()
  })

  it('AI 对话模式支持切换历史会话并展示工具调用摘要', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: '打开聊天' }))
    await user.click(screen.getByRole('button', { name: /周回顾行动拆解/ }))

    const chatMain = screen.getByLabelText('AI 对话主体')
    expect(within(chatMain).getByText('周回顾行动拆解')).toBeInTheDocument()
    expect(within(chatMain).getByText('ReAct 执行摘要')).toBeInTheDocument()
    expect(within(chatMain).getByText('读取 weekly review 草稿')).toBeInTheDocument()
    expect(screen.getAllByText('工具完成').length).toBeGreaterThan(0)
  })
```

- [ ] **Step 2: Run focused test and confirm failure**

Run:

```bash
pnpm test -- test/renderer/App.test.tsx
```

Expected: FAIL because chat mode components, labels, and Header behavior do not exist yet.

## Task 2: Add Mock Chat Types And Data

**Files:**
- Create: `src/renderer/src/components/layout/aiChatMock.ts`

- [ ] **Step 1: Create mock type and data module**

Implement the module with explicit exported types. Keep data deterministic and UI-oriented.

```ts
// 工具步骤状态类型，描述 mock 工具调用当前阶段。
export type AiToolStepStatus = "done" | "running" | "queued";

// 工具步骤类型，描述 ReAct 执行摘要中的单步。
export type AiToolStep = {
  // 工具步骤唯一标识。
  id: string;
  // 工具步骤标题。
  title: string;
  // 工具步骤状态。
  status: AiToolStepStatus;
  // 工具名称或执行阶段名称。
  tool: string;
  // 面向用户展示的执行观察摘要。
  observation: string;
};

// 消息发送者类型，描述消息归属。
export type AiChatMessageRole = "user" | "assistant";

// AI 对话消息类型，描述聊天气泡所需数据。
export type AiChatMessage = {
  // 消息唯一标识。
  id: string;
  // 消息发送者。
  role: AiChatMessageRole;
  // 消息正文。
  content: string;
  // 消息显示时间。
  time: string;
  // 可选工具调用摘要。
  toolSteps?: AiToolStep[];
};

// AI 会话类型，描述左侧历史列表和右侧聊天主体。
export type AiChatSession = {
  // 会话唯一标识。
  id: string;
  // 会话标题。
  title: string;
  // 会话摘要。
  summary: string;
  // 会话时间。
  time: string;
  // 会话状态文案。
  status: string;
  // 会话消息列表。
  messages: AiChatMessage[];
};

// AI 对话 mock 会话数据。
export const AI_CHAT_SESSIONS: AiChatSession[] = [
  {
    id: "today-memory",
    title: "整理今天的记忆线索",
    summary: "从 Todo、Notes、Journal 中提炼今天最值得保留的线索。",
    time: "10:24",
    status: "运行完成",
    messages: [
      {
        id: "today-user-1",
        role: "user",
        content: "帮我把今天的记录整理成一条清晰的记忆线索。",
        time: "10:20",
      },
      {
        id: "today-ai-1",
        role: "assistant",
        content: "我会先读取今天的任务、随记和日记，再归并成可回看的一条主线。",
        time: "10:21",
        toolSteps: [
          {
            id: "today-step-1",
            title: "计划输入来源",
            status: "done",
            tool: "Plan",
            observation: "选择 Today、Notes、Journal 作为本轮整理来源。",
          },
          {
            id: "today-step-2",
            title: "读取今日条目",
            status: "done",
            tool: "local_memory.search",
            observation: "找到 5 条待办、3 条随记和 1 篇日记草稿。",
          },
          {
            id: "today-step-3",
            title: "生成记忆摘要",
            status: "done",
            tool: "curator.compose",
            observation: "主线聚焦在渲染层稳定性、笔记归档和下一步验证。",
          },
        ],
      },
      {
        id: "today-ai-2",
        role: "assistant",
        content: "今天的核心线索是：先把输入源稳定下来，再用可验证的小步推进页面体验。下一步最值得做的是补齐 AI 对话模式的静态测试。",
        time: "10:24",
      },
    ],
  },
  {
    id: "weekly-actions",
    title: "周回顾行动拆解",
    summary: "把本周复盘拆成明天可执行的 3 个动作。",
    time: "09:12",
    status: "工具完成",
    messages: [
      {
        id: "weekly-user-1",
        role: "user",
        content: "读取 weekly review 草稿，然后给我三条明天能执行的动作。",
        time: "09:06",
      },
      {
        id: "weekly-ai-1",
        role: "assistant",
        content: "我会先定位周回顾草稿，再把模糊事项压缩成具体动作。",
        time: "09:08",
        toolSteps: [
          {
            id: "weekly-step-1",
            title: "读取 weekly review 草稿",
            status: "done",
            tool: "weekly_review.load",
            observation: "草稿包含 4 个主题，其中 2 个主题缺少下一步动作。",
          },
          {
            id: "weekly-step-2",
            title: "拆解行动",
            status: "done",
            tool: "actions.extract",
            observation: "生成 3 条明天可执行的任务，均可在 30 分钟内启动。",
          },
        ],
      },
    ],
  },
  {
    id: "people-followup",
    title: "人物关系跟进",
    summary: "从 People 档案中找出需要跟进的关系线索。",
    time: "昨天",
    status: "等待输入",
    messages: [
      {
        id: "people-user-1",
        role: "user",
        content: "帮我看一下最近有哪些关系需要主动跟进。",
        time: "昨天",
      },
      {
        id: "people-ai-1",
        role: "assistant",
        content: "我已经准备好读取 People 档案。当前 mock 页面不会真正执行工具，只展示交互结构。",
        time: "昨天",
        toolSteps: [
          {
            id: "people-step-1",
            title: "等待授权",
            status: "queued",
            tool: "people.scan",
            observation: "等待用户确认本轮要扫描的人物范围。",
          },
        ],
      },
    ],
  },
];
```

- [ ] **Step 2: Run typecheck and confirm imports are clean**

Run:

```bash
pnpm typecheck
```

Expected: PASS if only this standalone module exists and no unused imports remain.

## Task 3: Make Header Chat Button Controlled

**Files:**
- Modify: `src/renderer/src/components/layout/Header.tsx`

- [ ] **Step 1: Extend props**

Change `HeaderProps` to include chat state and callback.

```tsx
// 固定的顶部栏组件属性接口
export interface HeaderProps {
  // 当前页分类名称
  category: string;
  // 当前页面标识
  activePage: string;
  // AI 对话模式是否打开
  isChatOpen?: boolean;
  // AI 对话模式切换回调
  onChatToggle?: () => void;
}
```

- [ ] **Step 2: Wire the button**

Update the component signature and `IconButton`.

```tsx
export const Header = ({
  category,
  activePage,
  isChatOpen = false,
  onChatToggle,
}: HeaderProps): React.JSX.Element => {
  return (
    <header className="flex-shrink-0 mb-3 rounded-[6px] border border-white/5 bg-[#212121] px-4 py-2 flex items-center justify-between select-none h-10">
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="text-white/30">//</span>
        <span className="text-white/40 font-bold uppercase tracking-wider">
          {category}
        </span>
        <span className="text-white/20">/</span>
        <span className="text-white font-bold">{activePage}</span>
      </div>
      <IconButton
        aria-label={isChatOpen ? "关闭聊天" : "打开聊天"}
        highlighted={isChatOpen}
        onClick={onChatToggle}
        className={isChatOpen ? "" : "text-white/45 hover:bg-white/5 hover:text-white"}
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </IconButton>
    </header>
  );
};
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm test -- test/renderer/App.test.tsx
```

Expected: Still FAIL because `App` has not passed chat state and chat UI does not exist.

## Task 4: Build Chat History List

**Files:**
- Create: `src/renderer/src/components/layout/AiChatHistoryList.tsx`

- [ ] **Step 1: Implement stateless history list**

Use `Search`, `Plus`, `Bot`, and `Clock3` from `lucide-react`. Keep all imports absolute except React/lucide.

Required public props:

```tsx
import type React from "react";
import { Bot, Clock3, Plus, Search } from "lucide-react";
import type { AiChatSession } from "@renderer/components/layout/aiChatMock";

// AI 对话历史列表组件属性类型。
type AiChatHistoryListProps = {
  // AI 会话列表。
  sessions: AiChatSession[];
  // 当前激活的 AI 会话标识。
  activeSessionId: string;
  // 切换 AI 会话回调。
  onSessionChange: (sessionId: string) => void;
  // 新建 AI 会话回调。
  onNewChat: () => void;
};
```

Rendering requirements:

- Root element: `<div className="flex h-full w-full flex-col gap-4" aria-label="对话历史列表">`.
- Header row contains `AI DIALOGS` and a new-chat icon button with `aria-label="新建对话"`.
- Search row is visual-only, with disabled input placeholder `搜索对话历史`.
- Session buttons use `aria-current={isActive ? "true" : undefined}`.
- Active item uses `bg-white text-black`; inactive item uses `bg-white/[0.03] text-white/70 hover:bg-white/[0.06]`.
- Bottom status card says `ReAct Mock Mode` and `Plan / Tool / Observation / Answer`.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS after the file is syntactically correct. It is not imported yet.

## Task 5: Build Tool And Message Components

**Files:**
- Create: `src/renderer/src/components/layout/AiToolCallBlock.tsx`
- Create: `src/renderer/src/components/layout/AiChatMessageBubble.tsx`

- [ ] **Step 1: Implement `AiToolCallBlock`**

Required imports and props:

```tsx
import type React from "react";
import { CheckCircle2, CircleDashed, Loader2, Wrench } from "lucide-react";
import type { AiToolStep, AiToolStepStatus } from "@renderer/components/layout/aiChatMock";

// AI 工具调用块组件属性类型。
type AiToolCallBlockProps = {
  // 工具执行步骤列表。
  steps: AiToolStep[];
};
```

Status mapping must be explicit:

```tsx
// 根据工具步骤状态返回状态展示配置。
const getStatusConfig = (
  status: AiToolStepStatus,
): {
  // 状态显示文本。
  label: string;
  // 状态图标组件。
  icon: React.ComponentType<{ className?: string }>;
  // 状态样式类名。
  className: string;
} => {
  switch (status) {
    case "done":
      return { label: "工具完成", icon: CheckCircle2, className: "text-white/70" };
    case "running":
      return { label: "执行中", icon: Loader2, className: "text-white" };
    case "queued":
      return { label: "等待中", icon: CircleDashed, className: "text-white/45" };
  }
};
```

Rendering requirements:

- Title text: `ReAct 执行摘要`.
- Each step shows `step.title`, `step.tool`, status label, and `step.observation`.
- Use `rounded-[6px]`, no gradients, and borders with `border-white/10`.

- [ ] **Step 2: Implement `AiChatMessageBubble`**

Required imports and props:

```tsx
import type React from "react";
import { Bot, UserRound } from "lucide-react";
import type { AiChatMessage } from "@renderer/components/layout/aiChatMock";
import { AiToolCallBlock } from "@renderer/components/layout/AiToolCallBlock";

// AI 聊天气泡组件属性类型。
type AiChatMessageBubbleProps = {
  // 当前消息数据。
  message: AiChatMessage;
};
```

Rendering requirements:

- User messages align right with white background and black text.
- Assistant messages align left with `#212121` or near-black background.
- Time is visible in low-contrast text.
- If `message.toolSteps` exists and has items, render `AiToolCallBlock`.
- Use `Bot` for assistant and `UserRound` for user.

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

## Task 6: Build Chat Workspace

**Files:**
- Create: `src/renderer/src/components/layout/AiChatWorkspace.tsx`

- [ ] **Step 1: Implement workspace shell**

Required imports and props:

```tsx
import type React from "react";
import { Paperclip, SendHorizontal, SlidersHorizontal, Sparkles } from "lucide-react";
import type { AiChatSession } from "@renderer/components/layout/aiChatMock";
import { AiChatMessageBubble } from "@renderer/components/layout/AiChatMessageBubble";
import { IconButton } from "@renderer/components/ui/IconButton";

// AI 对话工作区组件属性类型。
type AiChatWorkspaceProps = {
  // 当前激活的 AI 会话。
  session: AiChatSession;
};
```

Rendering requirements:

- Root element: `<section aria-label="AI 对话主体" className="flex h-full min-h-0 flex-col overflow-hidden rounded-[6px] border border-white/5 bg-[#212121]">`.
- Top bar shows `session.title`, `session.summary`, `session.status`, and a tool-count label derived from messages with `toolSteps`.
- Message list uses `custom-scrollbar flex-1 overflow-y-auto`.
- Composer sits at bottom with:
  - `textarea` placeholder `输入消息，当前为 mock 展示`
  - `aria-label="AI 对话输入框"`
  - attachment icon button
  - tool mode icon button
  - send button `aria-label="发送消息"`
- Composer controls are static; no submit handler is required.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

## Task 7: Add Sidebar Chat Mode

**Files:**
- Modify: `src/renderer/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Import chat types and history component**

Add:

```tsx
import { AiChatHistoryList } from "@renderer/components/layout/AiChatHistoryList";
import type { AiChatSession } from "@renderer/components/layout/aiChatMock";
```

- [ ] **Step 2: Extend props**

Add mode and chat props to `SidebarProps`.

```tsx
// Sidebar 内容模式类型，描述左侧栏当前渲染主导航还是 AI 对话历史。
type SidebarMode = "navigation" | "chat";

// Sidebar 组件属性类型，描述左侧栏折叠、当前页面与切换入口。
type SidebarProps = {
  // 当前左侧栏是否处于折叠状态。
  isCollapsed: boolean;
  // 当前选中的侧栏页面。
  activePage: SidebarPageId;
  // 左侧栏内容模式。
  mode: SidebarMode;
  // AI 对话会话列表。
  chatSessions: AiChatSession[];
  // 当前激活的 AI 对话会话标识。
  activeChatId: string;
  // 左侧栏折叠状态改变回调。
  onCollapsedChange: (collapsed: boolean) => void;
  // 侧栏页面切换回调。
  onPageChange: (pageId: SidebarPageId) => void;
  // AI 对话会话切换回调。
  onChatSessionChange: (sessionId: string) => void;
  // 新建 AI 对话回调。
  onNewChat: () => void;
};
```

- [ ] **Step 3: Render chat content conditionally**

Inside `Sidebar`, compute:

```tsx
  // AI 对话模式下强制使用展开宽度，避免历史列表被折叠成不可读图标。
  const shouldUseCollapsedLayout = mode === "navigation" && isCollapsed;
```

Replace layout classes that currently use `isCollapsed` with `shouldUseCollapsedLayout`.

Extract the existing product header, navigation groups, and settings footer into the navigation branch. Do not change `NAVIGATION_GROUPS` content. Render chat content with this branch structure:

```tsx
          {mode === "chat" && (
            <AiChatHistoryList
              sessions={chatSessions}
              activeSessionId={activeChatId}
              onSessionChange={onChatSessionChange}
              onNewChat={onNewChat}
            />
          )}

          {mode === "navigation" && (
            <div
              className={`flex flex-col gap-5 w-full ${
                shouldUseCollapsedLayout ? "" : "lg:w-[190px] lg:flex-shrink-0"
              }`}
            >
              <div
                className={`flex items-center gap-3 px-1 ${
                  shouldUseCollapsedLayout ? "justify-center" : ""
                }`}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] bg-white text-black">
                  <Brain className="h-5 w-5" />
                </div>
                {!shouldUseCollapsedLayout && (
                  <div className="flex flex-col">
                    <h2 className="text-xs font-semibold tracking-wider text-white whitespace-nowrap">
                      MEMORY CURATOR
                    </h2>
                  </div>
                )}
              </div>

              <nav className="flex flex-col gap-3 w-full" aria-label="侧边栏主导航">
                {NAVIGATION_GROUPS.map((group) => (
                  <section key={group.id} className="flex flex-col gap-1.5">
                    {!shouldUseCollapsedLayout && (
                      <h3 className="px-1 text-xs font-bold tracking-[0.18em] text-white/30 whitespace-nowrap">
                        {group.label}
                      </h3>
                    )}
                    <div className="flex flex-col gap-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.id === activePage;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            aria-current={isActive ? "page" : undefined}
                            aria-label={shouldUseCollapsedLayout ? item.label : undefined}
                            onClick={() => onPageChange(item.id)}
                            className={`flex w-full items-center rounded-[6px] transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 ${
                              shouldUseCollapsedLayout
                                ? "justify-center px-0 py-2.5"
                                : "gap-3 px-3 py-2.5"
                            } ${
                              isActive
                                ? "bg-white text-black font-semibold"
                                : "text-white/60 hover:bg-white/5 hover:text-white/85"
                            }`}
                          >
                            <Icon
                              className={`h-4 w-4 flex-shrink-0 ${
                                isActive ? "text-black" : "text-white/50"
                              }`}
                            />
                            {!shouldUseCollapsedLayout && (
                              <div className="flex min-w-0 flex-col items-start text-left whitespace-nowrap">
                                <span className="text-sm font-bold leading-none whitespace-nowrap">
                                  {item.label}
                                </span>
                                <span
                                  className={`mt-1 text-xs leading-none whitespace-nowrap ${
                                    isActive ? "text-black/60 font-medium" : "text-white/30"
                                  }`}
                                >
                                  {item.description}
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </nav>
            </div>
          )}
```

Keep the existing settings footer only in navigation mode. Hide the collapse button in chat mode with:

```tsx
      {mode === "navigation" && (
        <button
          type="button"
          aria-label={isCollapsed ? "展开左侧导航栏" : "折叠左侧导航栏"}
          aria-expanded={!isCollapsed}
          onClick={() => onCollapsedChange(!isCollapsed)}
          className="absolute top-1/2 right-0 z-20 flex h-6 w-6 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#212121] text-white/75 shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      )}
```

- [ ] **Step 4: Run focused test**

Run:

```bash
pnpm test -- test/renderer/App.test.tsx
```

Expected: FAIL because `App` has not passed the new required props yet.

## Task 8: Integrate Chat Mode In App

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Add imports**

Add:

```tsx
import { AiChatWorkspace } from "@renderer/components/layout/AiChatWorkspace";
import { AI_CHAT_SESSIONS } from "@renderer/components/layout/aiChatMock";
```

- [ ] **Step 2: Add state**

Add after sidebar collapsed state:

```tsx
  // AI 对话模式打开状态。
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  // 当前激活的 AI 对话会话标识。
  const [activeChatId, setActiveChatId] = useState<string>(AI_CHAT_SESSIONS[0].id);
```

Add derived session before return:

```tsx
  // 当前激活的 AI 对话会话。
  const activeChatSession =
    AI_CHAT_SESSIONS.find((session) => session.id === activeChatId) ??
    AI_CHAT_SESSIONS[0];
```

Add toggle handler:

```tsx
  /**
   * 切换 AI 对话模式。
   */
  const handleChatToggle = (): void => {
    setIsChatOpen((current) => !current);
  };
```

- [ ] **Step 3: Pass props into Sidebar and Header**

Update `Sidebar`:

```tsx
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          activePage={activePage}
          mode={isChatOpen ? "chat" : "navigation"}
          chatSessions={AI_CHAT_SESSIONS}
          activeChatId={activeChatId}
          onCollapsedChange={setIsSidebarCollapsed}
          onPageChange={(pageId) => {
            window.history.pushState({}, "", `/${pageId}`);
            setActivePage(pageId);
          }}
          onChatSessionChange={setActiveChatId}
          onNewChat={() => {
            setActiveChatId(AI_CHAT_SESSIONS[0].id);
          }}
        />
```

Update `Header`:

```tsx
          <Header
            category={isChatOpen ? "AGENT" : getPageCategory(activePage)}
            activePage={isChatOpen ? "chat" : activePage}
            isChatOpen={isChatOpen}
            onChatToggle={handleChatToggle}
          />
```

- [ ] **Step 4: Layer page and chat content**

Replace the existing Header-below content with layered containers:

```tsx
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <div
              className={`absolute inset-0 transition-all duration-300 ease-out ${
                isChatOpen
                  ? "pointer-events-none opacity-0 scale-[0.995]"
                  : "pointer-events-auto opacity-100 scale-100"
              }`}
              aria-hidden={isChatOpen}
            >
              <div className="w-full h-full">{renderActivePage()}</div>
            </div>

            <div
              className={`absolute inset-0 transition-all duration-300 ease-out ${
                isChatOpen
                  ? "pointer-events-auto translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-2 opacity-0"
              }`}
              aria-hidden={!isChatOpen}
            >
              <AiChatWorkspace session={activeChatSession} />
            </div>
          </div>
```

- [ ] **Step 5: Run focused test**

Run:

```bash
pnpm test -- test/renderer/App.test.tsx
```

Expected: PASS for the new chat tests and existing App tests, unless a legacy assertion assumes Header labels never change.

## Task 9: Polish Layout And Accessibility

**Files:**
- Modify:
  - `src/renderer/src/components/layout/AiChatHistoryList.tsx`
  - `src/renderer/src/components/layout/AiChatWorkspace.tsx`
  - `src/renderer/src/components/layout/AiChatMessageBubble.tsx`
  - `src/renderer/src/components/layout/AiToolCallBlock.tsx`
  - `src/renderer/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Check visual constraints in source**

Run:

```bash
rg -n "gradient|rounded-\\[(?!6px\\])|\\.\\./|\\.\\.\\/" src/renderer/src/components/layout src/renderer/src/App.tsx
```

Expected: no gradients, no deep relative imports, and no new non-6px rounded classes in touched files. If the regex is unsupported by `rg`, run separate simpler searches:

```bash
rg -n "gradient|\\.\\./|\\.\\.\\/" src/renderer/src/components/layout src/renderer/src/App.tsx
rg -n "rounded-" src/renderer/src/components/layout/AiChatHistoryList.tsx src/renderer/src/components/layout/AiChatWorkspace.tsx src/renderer/src/components/layout/AiChatMessageBubble.tsx src/renderer/src/components/layout/AiToolCallBlock.tsx
```

- [ ] **Step 2: Verify accessible names**

Run:

```bash
pnpm test -- test/renderer/App.test.tsx
```

Expected: PASS. The tests must find `打开聊天`, `关闭聊天`, `对话历史列表`, `AI 对话主体`, and `发送消息`.

## Task 10: Full Verification

**Files:**
- No source changes unless verification finds a bug.

- [ ] **Step 1: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Inspect diff**

Run:

```bash
git diff -- src/renderer/src/components/layout/Header.tsx src/renderer/src/components/layout/Sidebar.tsx src/renderer/src/App.tsx test/renderer/App.test.tsx src/renderer/src/components/layout/aiChatMock.ts src/renderer/src/components/layout/AiChatHistoryList.tsx src/renderer/src/components/layout/AiToolCallBlock.tsx src/renderer/src/components/layout/AiChatMessageBubble.tsx src/renderer/src/components/layout/AiChatWorkspace.tsx
```

Expected: Diff only contains scoped AI chat workspace changes. No commit is made.

- [ ] **Step 4: Optional visual check**

Run:

```bash
pnpm dev
```

Expected: Electron app opens. Click Header chat button and verify:

- Sidebar becomes AI dialog history.
- Header button becomes highlighted and closes chat on second click.
- Chat container covers the original page content below Header.
- Session switching changes the title and messages.
- No gradient, no large rounded corners, no text overlap.

## Execution Notes

- Keep the implementation mock-only.
- Do not add API, IPC, database writes, or network calls.
- Do not add route changes for chat mode.
- Do not commit unless the user explicitly asks.
