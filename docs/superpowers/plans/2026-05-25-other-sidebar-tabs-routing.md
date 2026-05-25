# Other Sidebar Tabs Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. User requirement: execution must use `frontend-design-agent` for the page implementation work.

**Goal:** Add static routed pages for `Notes`、`Journal`、`Weekly Review`、`Themes`、`Memories` and wire them to the existing left sidebar.

**Architecture:** Keep routing as local React state inside `App.tsx`; no `react-router` dependency. `Sidebar` becomes an accessible button-based navigation component with `activePage` and `onPageChange`. Five new static page components live under `src/renderer/src/components/pages/` and each uses a distinct layout matching `docs/project-development.md`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, lucide-react, Vitest, Testing Library.

---

## File Structure

- Modify: `src/renderer/src/App.tsx` - own `activePage`, render the selected page, pass navigation state to `Sidebar`.
- Modify: `src/renderer/src/components/Sidebar.tsx` - export shared page id type, make navigation items buttons, update active state.
- Modify: `src/renderer/src/App.test.tsx` - add route-switch tests and update sidebar collapse assumptions.
- Create: `src/renderer/src/components/pages/NotesPage.tsx` - static masonry-like notes/material pool page.
- Create: `src/renderer/src/components/pages/JournalPage.tsx` - static date-index + full journal reader page.
- Create: `src/renderer/src/components/pages/WeeklyReviewPage.tsx` - static weekly curation dashboard page.
- Create: `src/renderer/src/components/pages/ThemesPage.tsx` - static long-term theme tracking board.
- Create: `src/renderer/src/components/pages/MemoriesPage.tsx` - static named memory and relation wall.
- Do not modify by default: `src/renderer/src/components/TodayWorkspace.tsx`、`src/renderer/src/components/AgentPanel.tsx`、`src/renderer/src/styles.css`.

Project rule: do not run `git commit` unless explicitly requested.

## Task 1: Tests For Sidebar Page Switching

**Files:**
- Modify: `src/renderer/src/App.test.tsx`

- [ ] **Step 1: Add route switching tests before implementation**

Insert this test after `默认将 Today 标记为当前侧栏页面`:

```tsx
  it('支持从左侧栏切换到其他静态页面', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /Notes/ }))
    expect(screen.getByText('自由笔记素材池')).toBeInTheDocument()
    expect(screen.getByText('Notes').closest('[aria-current="page"]')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Journal/ }))
    expect(screen.getByText('历史日记条目')).toBeInTheDocument()
    expect(screen.getByText('Journal').closest('[aria-current="page"]')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Weekly Review/ }))
    expect(screen.getByText('周度策展复盘')).toBeInTheDocument()
    expect(screen.getByText('Weekly Review').closest('[aria-current="page"]')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Themes/ }))
    expect(screen.getByText('长期主题追踪')).toBeInTheDocument()
    expect(screen.getByText('Themes').closest('[aria-current="page"]')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Memories/ }))
    expect(screen.getByText('记忆片段关联墙')).toBeInTheDocument()
    expect(screen.getByText('Memories').closest('[aria-current="page"]')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Update the collapse test for button navigation**

Keep the current first test structure, but after collapsing the left sidebar do not assert all nav labels are absent. Replace lines that assert `DAILY`、`LIBRARY`、`CURATION` absence with button availability and collapsed label behavior:

```tsx
    await user.click(screen.getByRole('button', { name: '折叠左侧导航栏' }))
    expect(screen.queryByText('MEMORY CURATOR')).not.toBeInTheDocument()
    expect(screen.queryByText('DAILY')).not.toBeInTheDocument()
    expect(screen.queryByText('LIBRARY')).not.toBeInTheDocument()
    expect(screen.queryByText('CURATION')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开左侧导航栏' })).toBeInTheDocument()
```

The current assertions already match this. If implementation keeps hidden labels accessible through `aria-label`, do not change these text assertions; text content should still be visually absent.

- [ ] **Step 3: Run focused tests and verify route test fails**

Run: `pnpm test -- App.test.tsx`

Expected: FAIL because `Notes` is not yet a button and the static pages do not exist.

## Task 2: Add Page Type And App State Routing

**Files:**
- Modify: `src/renderer/src/components/Sidebar.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Export the shared page id type from Sidebar**

In `src/renderer/src/components/Sidebar.tsx`, add this type near the other type definitions:

```tsx
// 侧栏页面标识类型，约束当前静态页面路由范围。
export type SidebarPageId = 'today' | 'notes' | 'journal' | 'weekly' | 'themes' | 'memories'
```

Then update `NavigationItem.id` from `string` to `SidebarPageId`:

```tsx
// 主导航项类型，描述左侧应用级入口。
type NavigationItem = {
  // 导航项唯一标识。
  id: SidebarPageId
  // 导航项显示名称。
  label: string
  // 导航项辅助说明。
  description: string
  // 导航项图标组件。
  icon: React.ComponentType<{ className?: string }>
}
```

- [ ] **Step 2: Update Sidebar props**

Replace `SidebarProps` with:

```tsx
// Sidebar 组件属性类型，描述左侧栏折叠、当前页面与切换入口。
type SidebarProps = {
  // 当前左侧栏是否处于折叠状态。
  isCollapsed: boolean
  // 当前选中的侧栏页面。
  activePage: SidebarPageId
  // 左侧栏折叠状态改变回调。
  onCollapsedChange: (collapsed: boolean) => void
  // 侧栏页面切换回调。
  onPageChange: (pageId: SidebarPageId) => void
}
```

Update the component signature:

```tsx
export const Sidebar = ({
  isCollapsed,
  activePage,
  onCollapsedChange,
  onPageChange
}: SidebarProps): React.JSX.Element => {
```

- [ ] **Step 3: Add App state and selected page rendering shell**

In `src/renderer/src/App.tsx`, update imports:

```tsx
import type React from 'react'
import { useState } from 'react'
import { AgentPanel } from './components/AgentPanel'
import { Sidebar, type SidebarPageId } from './components/Sidebar'
import { TodayWorkspace } from './components/TodayWorkspace'
```

Add the state after sidebar collapsed state:

```tsx
  // 当前中间主内容页面。
  const [activePage, setActivePage] = useState<SidebarPageId>('today')
```

Add a render helper inside `App` before `return`:

```tsx
  /**
   * 根据当前侧栏页面渲染中间主内容。
   */
  const renderActivePage = (): React.JSX.Element => {
    switch (activePage) {
      case 'today':
        return <TodayWorkspace />
      case 'notes':
      case 'journal':
      case 'weekly':
      case 'themes':
      case 'memories':
        return <TodayWorkspace />
    }
  }
```

This intentionally points non-Today pages to `TodayWorkspace` until Task 4 creates the real page components.

Update the `Sidebar` usage:

```tsx
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        activePage={activePage}
        onCollapsedChange={setIsSidebarCollapsed}
        onPageChange={setActivePage}
      />
```

Replace `<TodayWorkspace />` in the middle area with:

```tsx
      {renderActivePage()}
```

- [ ] **Step 4: Run typecheck and verify current errors**

Run: `pnpm typecheck`

Expected: FAIL until the sidebar render loop uses `activePage` and `onPageChange`.

## Task 3: Convert Sidebar Items To Accessible Buttons

**Files:**
- Modify: `src/renderer/src/components/Sidebar.tsx`

- [ ] **Step 1: Replace nav item wrapper with button**

Inside the `group.items.map` loop, replace the static item block with:

```tsx
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={isCollapsed ? item.label : undefined}
                        onClick={() => onPageChange(item.id)}
                        className={`flex w-full items-center rounded-[6px] transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 ${
                          isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                        } ${isActive ? 'bg-white text-black font-semibold' : 'text-white/60 hover:bg-white/5 hover:text-white/85'}`}
                      >
                        <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-black' : 'text-white/50'}`} />
                        {!isCollapsed && (
                          <div className="flex min-w-0 flex-col items-start text-left">
                            <span className="text-xs font-bold leading-none">{item.label}</span>
                            <span className={`mt-1 text-[9px] leading-none ${isActive ? 'text-black/60 font-medium' : 'text-white/30'}`}>
                              {item.description}
                            </span>
                          </div>
                        )}
                      </button>
                    )
```

- [ ] **Step 2: Change active calculation**

Inside the loop, replace:

```tsx
                    const isActive = item.id === 'today'
```

With:

```tsx
                    const isActive = item.id === activePage
```

- [ ] **Step 3: Run focused tests**

Run: `pnpm test -- App.test.tsx`

Expected: route switching test still FAILS because page content for non-Today pages is not implemented, but clicking nav buttons should no longer fail at the button lookup step.

## Task 4: Implement Distinct Static Pages With Frontend Design Agent

**Files:**
- Create: `src/renderer/src/components/pages/NotesPage.tsx`
- Create: `src/renderer/src/components/pages/JournalPage.tsx`
- Create: `src/renderer/src/components/pages/WeeklyReviewPage.tsx`
- Create: `src/renderer/src/components/pages/ThemesPage.tsx`
- Create: `src/renderer/src/components/pages/MemoriesPage.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Dispatch `frontend-design-agent` for page implementation**

Use the `frontend-design-agent` subagent with this prompt:

```text
Implement five distinct static React pages for the Memory Curator Agent renderer.

Context:
- Project root: /Users/yonah/projects/agent/memory-curator-agent
- Design spec: docs/superpowers/specs/2026-05-25-other-sidebar-tabs-routing-design.md
- Product doc: docs/project-development.md
- Existing style: black theme, #212121 cards, rounded-[6px], no gradients, Tailwind CSS v4, React 19, TypeScript.
- Project TS rule: arrow functions only. Comments in simplified Chinese. Variables/types/functions need comments per AGENTS.md.

Create these files:
- src/renderer/src/components/pages/NotesPage.tsx
- src/renderer/src/components/pages/JournalPage.tsx
- src/renderer/src/components/pages/WeeklyReviewPage.tsx
- src/renderer/src/components/pages/ThemesPage.tsx
- src/renderer/src/components/pages/MemoriesPage.tsx

Requirements:
- Each page exports an arrow function component returning React.JSX.Element.
- Each page is static only; no CRUD, no persistence, no global state.
- Each page has distinct information architecture:
  - Notes: masonry/material pool with title text "自由笔记素材池".
  - Journal: date index + full reader with title text "历史日记条目".
  - WeeklyReview: dashboard/timeline with title text "周度策展复盘".
  - Themes: theme list + evolution detail with title text "长期主题追踪".
  - Memories: named memory relation wall with title text "记忆片段关联墙".
- Use only black/white/neutral colors already used in the project; no gradients.
- Keep pages responsive: desktop multi-column, mobile single-column.
- Use lucide-react icons if helpful, but keep imports minimal.
- Do not edit tests or App.tsx; return a summary of created files and exported component names.

Verification expectation:
- The code should pass TypeScript when imported by App.tsx later.
```

- [ ] **Step 2: Import new page components in App**

Update `src/renderer/src/App.tsx` imports:

```tsx
import { MemoriesPage } from './components/pages/MemoriesPage'
import { JournalPage } from './components/pages/JournalPage'
import { NotesPage } from './components/pages/NotesPage'
import { ThemesPage } from './components/pages/ThemesPage'
import { WeeklyReviewPage } from './components/pages/WeeklyReviewPage'
```

- [ ] **Step 3: Replace temporary route rendering**

Replace `renderActivePage` with:

```tsx
  /**
   * 根据当前侧栏页面渲染中间主内容。
   */
  const renderActivePage = (): React.JSX.Element => {
    switch (activePage) {
      case 'today':
        return <TodayWorkspace />
      case 'notes':
        return <NotesPage />
      case 'journal':
        return <JournalPage />
      case 'weekly':
        return <WeeklyReviewPage />
      case 'themes':
        return <ThemesPage />
      case 'memories':
        return <MemoriesPage />
    }
  }
```

- [ ] **Step 4: Run focused tests**

Run: `pnpm test -- App.test.tsx`

Expected: PASS, or fail only on exact accessible names if page titles are present but button names need test regex adjustment.

## Task 5: Full Verification And Cleanup

**Files:**
- Inspect all modified and created files.

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 3: Inspect git diff**

Run: `git diff -- src/renderer/src/App.tsx src/renderer/src/components/Sidebar.tsx src/renderer/src/App.test.tsx src/renderer/src/components/pages docs/superpowers/plans/2026-05-25-other-sidebar-tabs-routing.md docs/superpowers/specs/2026-05-25-other-sidebar-tabs-routing-design.md`

Expected: diff only contains static page routing work, spec, and this plan.

- [ ] **Step 4: Verify no forbidden styling**

Search created page files for gradients:

Run: `rg "gradient|from-|to-|via-" src/renderer/src/components/pages`

Expected: no matches.

- [ ] **Step 5: Report verification evidence**

Final response must include:

- Changed files summary.
- `pnpm test` result.
- `pnpm typecheck` result.
- Any residual risks.

## Self-Review

- Spec coverage: the plan covers all five requested pages, state routing, sidebar active semantics, tests, styling constraints, and no Settings route.
- Placeholder scan: no `TBD` or deferred implementation steps remain; Task 4 delegates concrete page creation to the required `frontend-design-agent` with exact titles and file paths.
- Type consistency: `SidebarPageId` is defined once in `Sidebar.tsx`, imported by `App.tsx`, and used by route switching and navigation item ids.
