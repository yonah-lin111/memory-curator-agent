# Today Workbench Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current memory-detail mock screen with a static `Today` three-column desktop workbench layout.

**Architecture:** Keep all work inside the renderer React UI. `App` owns only shell composition, `Sidebar` owns navigation/date/local status, `TodayWorkspace` owns the center daily input layout, and `AgentPanel` owns right-side static curation hints.

**Tech Stack:** Electron renderer, React 19, TypeScript, Tailwind CSS, lucide-react.

---

## File Structure

- Modify: `src/renderer/src/App.tsx` - compose the three-panel Today workbench and remove unused memory selection state.
- Modify: `src/renderer/src/components/Sidebar.tsx` - replace the memory-category navigation with product navigation, date strip, and local status.
- Create: `src/renderer/src/components/TodayWorkspace.tsx` - static center column for quick input, daily stats, todo, notes, and journal blocks.
- Create: `src/renderer/src/components/AgentPanel.tsx` - static right column for classification suggestions, related memories, theme clues, and privacy notice.
- Modify: `src/renderer/src/styles.css` - only if global layout/scrollbar polish is needed.
- Do not modify: `src/main/**`, `src/preload/**`, database code, IPC, LLM provider, OCR, routes, build config.
- Do not commit: project instructions prohibit git commit unless explicitly requested.

## Task 1: App Shell

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Replace stateful memory shell with static Today composition**

Use this exact structure:

```tsx
import type React from 'react'
import { AgentPanel } from './components/AgentPanel'
import { Sidebar } from './components/Sidebar'
import { TodayWorkspace } from './components/TodayWorkspace'

/**
 * 记忆策展 Agent 的 Today 三栏工作台页面。
 */
export const App = (): React.JSX.Element => {
  return (
    <main className="flex h-screen w-screen gap-3 overflow-hidden bg-[#000000] p-3 text-white antialiased">
      <Sidebar />
      <TodayWorkspace />
      <AgentPanel />
    </main>
  )
}
```

- [ ] **Step 2: Run renderer typecheck**

Run: `pnpm typecheck`

Expected: it may fail because `AgentPanel` and `TodayWorkspace` do not exist yet. Continue to Task 2.

## Task 2: Sidebar Static Navigation

**Files:**
- Modify: `src/renderer/src/components/Sidebar.tsx`

- [ ] **Step 1: Replace old sidebar with focused Today navigation**

Requirements:

- Export `Sidebar` as an arrow function.
- Remove props and state callbacks.
- Use static arrays for navigation and week dates.
- Add single-line Simplified Chinese comments for each type/interface and static data variable.
- Keep `#212121`, `#000000`, `rounded-[6px]`, no gradients.

Recommended content:

```tsx
import type React from 'react'
import { BookOpen, Brain, CalendarDays, Clock3, Database, FileText, Home, Layers, Settings, Sparkles } from 'lucide-react'

// 主导航项类型，描述左侧应用级入口。
type NavigationItem = {
  // 导航项唯一标识。
  id: string
  // 导航项显示名称。
  label: string
  // 导航项辅助说明。
  description: string
  // 导航项图标组件。
  icon: React.ComponentType<{ className?: string }>
}

// 周日期项类型，描述 Today 页面中的日期定位入口。
type WeekDateItem = {
  // 星期短名称。
  weekday: string
  // 日期数字。
  day: string
  // 是否为当前选中日期。
  active: boolean
}

// 左侧主导航静态数据。
const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: 'today', label: 'Today', description: '今日工作台', icon: Home },
  { id: 'notes', label: 'Notes', description: '自由笔记', icon: FileText },
  { id: 'journal', label: 'Journal', description: '日记时间线', icon: BookOpen },
  { id: 'weekly', label: 'Weekly', description: '周度策展', icon: CalendarDays },
  { id: 'themes', label: 'Themes', description: '长期主题', icon: Layers },
  { id: 'memories', label: 'Memories', description: '记忆片段', icon: Sparkles },
  { id: 'settings', label: 'Settings', description: '模型与隐私', icon: Settings }
]

// 当前周日期静态数据。
const WEEK_DATES: WeekDateItem[] = [
  { weekday: 'Tue', day: '19', active: false },
  { weekday: 'Wed', day: '20', active: false },
  { weekday: 'Thu', day: '21', active: false },
  { weekday: 'Fri', day: '22', active: false },
  { weekday: 'Sat', day: '23', active: false },
  { weekday: 'Sun', day: '24', active: false },
  { weekday: 'Mon', day: '25', active: true }
]
```

- [ ] **Step 2: Render panel sections**

Render these sections in order:

- Product header with `Brain` icon, `MEMORY CURATOR`, `LOCAL FIRST DESKTOP`.
- `NAVIGATION_ITEMS` list with Today active.
- Current week date strip from `WEEK_DATES`.
- Local privacy/status card with `Database` and `Clock3`.

- [ ] **Step 3: Verify no business behavior exists**

Check file manually: no `useState`, no IPC, no fetch/query, no LLM/OCR text.

## Task 3: Today Workspace Center Column

**Files:**
- Create: `src/renderer/src/components/TodayWorkspace.tsx`

- [ ] **Step 1: Create static data types and arrays**

Include static mock data for stats, todos, notes, and journal prompts. All variables/types need Simplified Chinese comments.

- [ ] **Step 2: Render center column**

Required sections:

- Header: `TODAY / 2026-05-25` and title `今天的计划、素材与主观记录`.
- Quick input card: textarea-like static area with chips `文本输入`、`聊天粘贴`、`截图文本`.
- Daily stats cards: todo、notes、journal、memory hints.
- Two-column body: daily todo plan and free notes.
- Full-width journal block: preserve complete expression, not summary-only.

- [ ] **Step 3: Keep layout static**

Do not add form submit handlers, database calls, LLM calls, OCR, routing, Zustand, or TanStack Query.

## Task 4: Agent Panel Right Column

**Files:**
- Create: `src/renderer/src/components/AgentPanel.tsx`

- [ ] **Step 1: Create static data types and arrays**

Include classification suggestions, related memories, and theme clues as static arrays. All variables/types need Simplified Chinese comments.

- [ ] **Step 2: Render right column**

Required sections:

- Header: `AGENT CURATION` and `建议、归类与记忆线索`.
- Input classification suggestions.
- Related memories.
- Long-term theme clues.
- Privacy boundary notice stating model-send range must be reviewed later.

- [ ] **Step 3: Keep claims restrained**

Do not write diagnostic language. Use wording like “线索”“建议”“待复核”， not “结论”“诊断”.

## Task 5: Verification

**Files:**
- Review all modified files.

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`

Expected: success.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

Expected: success.

- [ ] **Step 3: Review diff for scope control**

Run: `git diff -- src/renderer/src/App.tsx src/renderer/src/components/Sidebar.tsx src/renderer/src/components/TodayWorkspace.tsx src/renderer/src/components/AgentPanel.tsx src/renderer/src/styles.css docs/superpowers/specs/2026-05-25-today-workbench-layout-design.md docs/superpowers/plans/2026-05-25-today-workbench-layout.md`

Expected:

- Only renderer UI files and docs changed.
- No `src/main` or `src/preload` changes.
- No database, IPC, LLM, OCR, routing, or business submission logic.
- No gradients.
- Panel backgrounds use `#000000` and `#212121`.
- Rounded corners remain `6px`.

## Self-Review

- Spec coverage: the plan covers Today default, three columns, static mock data, black theme, no business logic, and verification.
- Placeholder scan: no TBD/TODO/fill-later instructions remain.
- Type consistency: component names match imports: `Sidebar`, `TodayWorkspace`, `AgentPanel`.
- Project override: commit steps are intentionally omitted because project instructions prohibit git commit without explicit authorization.
