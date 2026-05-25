# Sidebar Navigation Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the left sidebar as a static rhythm-grouped navigation layout matching the memory curator product model.

**Architecture:** Keep the implementation inside the renderer React UI. `App` continues to own shell composition and collapse state; `Sidebar` owns static grouped navigation data, weekly locator display, local status display, and collapsed layout. No routing, persistence, IPC, or global state is introduced.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, lucide-react, Vitest, Testing Library.

---

## File Structure

- Modify: `src/renderer/src/components/Sidebar.tsx` - replace the flat navigation list with grouped static navigation, adjust weekly locator and footer status for expanded and collapsed states.
- Modify: `src/renderer/src/App.test.tsx` - update sidebar assertions for grouped labels and collapsed behavior while preserving existing collapse button tests.
- Create: `vitest.config.ts` - exclude project-local worktrees from root test discovery so isolated workspaces do not pollute `pnpm test`.
- No change by default: `src/renderer/src/App.tsx` - shell composition already passes `isCollapsed` and `onCollapsedChange` correctly.
- No change by default: `src/renderer/src/styles.css` - Tailwind classes cover the required layout and interaction states.

Project rules prohibit git commits unless explicitly requested. Do not run `git commit` during implementation.

## Task 1: Sidebar Tests For Grouped Static Structure

**Files:**
- Modify: `src/renderer/src/App.test.tsx`

- [ ] **Step 1: Update the collapse test to assert grouped sidebar structure**

Replace the first test block with this version:

```tsx
  it('支持分别折叠左侧导航栏与右侧策展栏', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(screen.getByText('MEMORY CURATOR')).toBeInTheDocument()
    expect(screen.getByText('DAILY')).toBeInTheDocument()
    expect(screen.getByText('LIBRARY')).toBeInTheDocument()
    expect(screen.getByText('CURATION')).toBeInTheDocument()
    expect(screen.getByText('计划 / 随记 / 日记')).toBeInTheDocument()
    expect(screen.queryByText('建议、归类与记忆线索')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '展开右侧策展栏' }))
    expect(screen.getByText('建议、归类与记忆线索')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '折叠右侧策展栏' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '折叠左侧导航栏' }))
    expect(screen.queryByText('MEMORY CURATOR')).not.toBeInTheDocument()
    expect(screen.queryByText('DAILY')).not.toBeInTheDocument()
    expect(screen.queryByText('LIBRARY')).not.toBeInTheDocument()
    expect(screen.queryByText('CURATION')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开左侧导航栏' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '折叠右侧策展栏' }))
    expect(screen.queryByText('建议、归类与记忆线索')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开右侧策展栏' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Add an explicit current-page semantics test**

Add this test after the small circular collapse button test:

```tsx
  it('默认将 Today 标记为当前侧栏页面', () => {
    render(<App />)

    expect(screen.getByText('Today').closest('[aria-current="page"]')).toBeInTheDocument()
  })
```

- [ ] **Step 3: Run focused tests and verify they fail before implementation**

Run: `pnpm test -- App.test.tsx`

Expected: FAIL because `DAILY`、`LIBRARY`、`CURATION` and `计划 / 随记 / 日记` are not rendered by the current flat sidebar.

## Task 2: Implement Grouped Sidebar Static Data

**Files:**
- Modify: `src/renderer/src/components/Sidebar.tsx`

- [ ] **Step 1: Replace the flat navigation type with grouped types**

Replace the existing `NavigationItem` type with these types:

```tsx
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

// 导航分组类型，描述产品使用节奏下的入口集合。
type NavigationGroup = {
  // 分组唯一标识。
  id: string
  // 分组显示名称。
  label: string
  // 分组下的导航项。
  items: NavigationItem[]
}
```

- [ ] **Step 2: Replace `NAVIGATION_ITEMS` with grouped static data**

Replace the existing `NAVIGATION_ITEMS` constant with this constant:

```tsx
// 左侧主导航分组静态数据。
const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    id: 'daily',
    label: 'DAILY',
    items: [{ id: 'today', label: 'Today', description: '计划 / 随记 / 日记', icon: Home }]
  },
  {
    id: 'library',
    label: 'LIBRARY',
    items: [
      { id: 'notes', label: 'Notes', description: '自由笔记列表', icon: FileText },
      { id: 'journal', label: 'Journal', description: '日记条目回看', icon: BookOpen }
    ]
  },
  {
    id: 'curation',
    label: 'CURATION',
    items: [
      { id: 'weekly', label: 'Weekly Review', description: '周度策展', icon: CalendarDays },
      { id: 'themes', label: 'Themes', description: '长期主题追踪', icon: Layers },
      { id: 'memories', label: 'Memories', description: '记忆片段关联', icon: Sparkles }
    ]
  }
]
```

- [ ] **Step 3: Run typecheck and verify the old render loop now fails**

Run: `pnpm typecheck`

Expected: FAIL because the JSX still references `NAVIGATION_ITEMS`.

## Task 3: Render Grouped Navigation Layout

**Files:**
- Modify: `src/renderer/src/components/Sidebar.tsx`

- [ ] **Step 1: Replace the existing `<nav>` render block**

Replace the current `<nav className="flex flex-col gap-1 w-full" aria-label="侧边栏主导航">...</nav>` block with this grouped render block:

```tsx
          {/* 应用级主导航按使用节奏分组，避免入口平铺成普通工具列表。 */}
          <nav className="flex flex-col gap-3 w-full" aria-label="侧边栏主导航">
            {NAVIGATION_GROUPS.map((group) => (
              <section key={group.id} className="flex flex-col gap-1.5">
                {!isCollapsed && (
                  <h3 className="px-1 text-[9px] font-bold tracking-[0.18em] text-white/30">
                    {group.label}
                  </h3>
                )}
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = item.id === 'today'

                    return (
                      <div
                        key={item.id}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex w-full items-center rounded-[6px] transition-all duration-150 ${
                          isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                        } ${isActive ? 'bg-white text-black font-semibold' : 'text-white/60'}`}
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
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </nav>
```

- [ ] **Step 2: Run focused tests and verify the grouped labels pass**

Run: `pnpm test -- App.test.tsx`

Expected: PASS for sidebar grouping assertions or reveal only remaining expected differences in footer/date content.

## Task 4: Refine Weekly Locator And Footer Status

**Files:**
- Modify: `src/renderer/src/components/Sidebar.tsx`

- [ ] **Step 1: Replace the weekly locator block with the rhythm layout version**

Inside the expanded-only fragment after the divider, replace the current weekly locator `<div className="flex flex-col gap-2">...</div>` with:

```tsx
              {/* 周定位卡片保持静态，服务 Today 页面上下文。 */}
              <div className="flex flex-col gap-2 rounded-[6px] border border-white/5 bg-white/[0.02] p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">
                    2026 MAY
                  </span>
                  <span className="text-[9px] font-mono text-white/25">WEEK 22</span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {WEEK_DATES.map((d) => (
                    <div
                      key={d.day}
                      className={`flex flex-col items-center justify-center py-1.5 rounded-[6px] transition-all duration-150 ${
                        d.active ? 'bg-white text-black font-bold' : 'text-white/40'
                      }`}
                    >
                      <span className={`text-[8px] uppercase font-bold ${d.active ? 'text-black/50' : 'text-white/20'}`}>
                        {d.weekday[0]}
                      </span>
                      <span className="mt-1 text-xs font-mono font-bold leading-none">
                        {d.day}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
```

- [ ] **Step 2: Add a collapsed current-date marker below the nav**

Immediately after the expanded-only fragment that contains the divider and weekly locator, add:

```tsx
          {isCollapsed && (
            <div className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-white/5 bg-white text-xs font-bold text-black">
              25
            </div>
          )}
```

- [ ] **Step 3: Replace bottom status copy**

Replace the expanded bottom status fragment with:

```tsx
            <>
              <div className="flex flex-col gap-2 rounded-[6px] bg-white/[0.02] border border-white/5 p-2.5">
                <div className="flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-bold text-white/80">Local Vault</span>
                </div>
                <div className="flex flex-col gap-1 pl-5 text-[10px] text-white/40 font-mono">
                  <div className="flex items-center gap-1.5">
                    <Clock3 className="h-3 w-3 text-white/30" />
                    <span>Last saved: Today 21:45</span>
                  </div>
                  <span>Storage: Local-first</span>
                  <span>Agent: Curation standby</span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-[10px] text-white/35">
                <Settings className="h-3.5 w-3.5" />
                <span>Settings</span>
              </div>
            </>
```

- [ ] **Step 4: Add collapsed Settings icon under the status icon**

Replace the collapsed bottom status branch with:

```tsx
            <div className="flex flex-col gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-white/[0.02] border border-white/5">
                <Database className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-white/[0.02] border border-white/5 text-white/45">
                <Settings className="h-3.5 w-3.5" />
              </div>
            </div>
```

- [ ] **Step 5: Run focused tests**

Run: `pnpm test -- App.test.tsx`

Expected: PASS.

## Task 5: Full Verification And Diff Review

**Files:**
- Verify: `src/renderer/src/components/Sidebar.tsx`
- Verify: `src/renderer/src/App.test.tsx`
- Verify: `vitest.config.ts`
- Verify: `docs/superpowers/specs/2026-05-25-sidebar-navigation-layout-design.md`
- Verify: `docs/superpowers/plans/2026-05-25-sidebar-navigation-layout.md`

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff -- src/renderer/src/components/Sidebar.tsx src/renderer/src/App.test.tsx vitest.config.ts docs/superpowers/specs/2026-05-25-sidebar-navigation-layout-design.md docs/superpowers/plans/2026-05-25-sidebar-navigation-layout.md`

Expected: Diff only contains the sidebar layout implementation, test updates, Vitest worktree exclusion, and superpowers design/plan docs. No unrelated file changes.

- [ ] **Step 4: Do not commit**

Expected: Leave changes uncommitted unless the user explicitly asks for a commit.

## Self-Review

- Spec coverage: The plan covers grouped static structure, collapsed state, weekly locator, footer status, no routing, mobile-preserving layout, tests, and the worktree test exclusion needed by the implementation workflow.
- Placeholder scan: No incomplete markers or unspecified implementation steps remain.
- Type consistency: `NavigationGroup`, `NAVIGATION_GROUPS`, `NavigationItem`, and `WeekDateItem` names are consistent across tasks.
- User/project constraint: The plan explicitly avoids `git commit` despite the generic skill template recommending frequent commits.
