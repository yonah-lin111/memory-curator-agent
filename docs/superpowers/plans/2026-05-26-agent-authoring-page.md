# Agent Authoring Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the available `frontend-design-agent` subagent during execution to implement the static page layout. Steps use checkbox (`- [ ]`) syntax for tracking. Do not commit unless the user explicitly requests it.

**Goal:** Replace the right-side Agent panel with a left-sidebar `Agent` tab and a static Agent authoring workspace page.

**Architecture:** Keep the existing route-by-sidebar pattern in `App.tsx`. Add a focused `AgentPage` under `components/pages`, update `Sidebar` navigation metadata, and delete the obsolete right panel component. Update tests to cover the new tab/page and remove right-panel behavior expectations.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, lucide-react, Vitest, Testing Library.

---

## File Structure

- Create: `src/renderer/src/components/pages/AgentPage.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/Sidebar.tsx`
- Modify: `src/renderer/src/App.test.tsx`
- Delete: `src/renderer/src/components/AgentPanel.tsx`

## Task 1: Update Routing And Sidebar

- [ ] Add `agent` to `SidebarPageId` in `src/renderer/src/components/Sidebar.tsx`.
- [ ] Add an `INTELLIGENCE` navigation group with an `Agent` item using a lucide icon such as `Bot`.
- [ ] Add `agent` to the `validPages` list in `src/renderer/src/App.tsx`.
- [ ] Import `AgentPage` in `App.tsx` and return it from `renderActivePage`.
- [ ] Remove `AgentPanel` import, right-panel state, and right-panel render from `App.tsx`.

## Task 2: Build Static Agent Page With @frontend-design-agent

- [ ] Use @frontend-design-agent to implement `src/renderer/src/components/pages/AgentPage.tsx`.
- [ ] Dispatch prompt: "Create the static React/Tailwind Agent authoring workspace page at `src/renderer/src/components/pages/AgentPage.tsx`, following `docs/project-development.md`, project style rules, and the plan file. Edit only that page file unless a compile error requires otherwise."
- [ ] Structure the page as a static desktop workspace with a header and three main columns: `Blueprint`, `Authoring`, `Preview`.
- [ ] Pull page copy from `docs/project-development.md`: goal, core rhythm, Agent capabilities, boundaries, input sources, output structure, safety boundary, acceptance points.
- [ ] Keep styles within existing project constraints: black theme, `#212121` cards, 6px radius, no gradients, responsive single-column layout on small screens.
- [ ] Use arrow functions, TypeScript `type` for local shape definitions, and Simplified Chinese comments for variables and functions.

## Task 3: Delete Obsolete AgentPanel

- [ ] Delete `src/renderer/src/components/AgentPanel.tsx`.
- [ ] Search for `AgentPanel`, `右侧策展栏`, and right-panel controls to ensure no dangling references remain.

## Task 4: Update Tests

- [ ] Remove tests that assert right-side Agent panel collapse, resize, or labels.
- [ ] Add a test that clicks the `Agent` sidebar item and expects the `记忆策展 Agent 编写工作台` heading.
- [ ] Assert `Agent` receives `aria-current="page"` after navigation.
- [ ] Add a direct route/popstate test proving `/agent` renders `AgentPage`.
- [ ] Keep existing route tests for `/today`, `/notes`, `/journal`, `/weekly`, `/themes`, and `/memories`.

## Task 5: Verify

- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run a focused search for removed panel references.
- [ ] Verify visual constraints in `AgentPage.tsx`: `#000000` outer context remains from `App`, page cards use `#212121`, rounded classes use `rounded-[6px]`, no `gradient` classes, desktop layout has three columns, small screens collapse to one column.
- [ ] Inspect `git diff` and confirm application changes are limited to the five source/test files listed above. Design and plan docs are the only allowed doc changes.

## Expected Outcome

- The app no longer renders a right-side Agent panel.
- The left sidebar contains an `Agent` tab.
- `/agent` displays a static Agent authoring workspace.
- Tests and typecheck pass.
