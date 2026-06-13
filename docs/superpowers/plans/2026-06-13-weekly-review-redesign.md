# Weekly Review Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Weekly Review Page with an innovative Origami Accordion layout and a 4-chart ECharts dashboard.

**Architecture:** Left-right split layout where the left column (55% width) holds a high-end folding Accordion of Mon-Sun cards, and the right column (45% width) hosts 3 metric cards and a grid of 4 specialized ECharts instances.

**Tech Stack:** React 19, ECharts 6.1, Tailwind 4, Lucide Icons.

---

### Task 1: State Management and Interface Scaffold

**Files:**
- Modify: `src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx`

- [ ] **Step 1: Read page and update state structure**
  Add state `expandedDate: string | null` to track the open card in the accordion. Ensure that when weekly data loads, we automatically open the first day of the week (the Monday).

  ```tsx
  // Track the active expanded date in the time stream accordion
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // In the fetch data useEffect or after data loads:
  useEffect(() => {
    if (weeklyData.length > 0 && !expandedDate) {
      setExpandedDate(weeklyData[0].entryDate);
    }
  }, [weeklyData]);
  ```

- [ ] **Step 2: Commit base state changes**
  ```bash
  git add src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx
  git commit -m "feat(weekly-review): add accordion active date state"
  ```

---

### Task 2: Origami Handaccordion Timeline Layout

**Files:**
- Modify: `src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx`

- [ ] **Step 1: Refactor Left Timeline Column with Accordion Cards**
  Replace the existing Timeline column with an elegant accordion of cards. Each day card will:
  - Have a hover transform (`hover:-translate-y-[2px] transition-all duration-300`).
  - Be collapsed by default unless `day.entryDate === expandedDate`.
  - On collapsed state: Show horizontal badges ("📝 1 篇日记", "✅ 3/4 待办", "🔖 2 个片段") and Chevron icon.
  - On expanded state: Expand with smooth scale/max-height transition, showing the daily high-light box and detailed grid (scrollable lists of actions/todos and snippets).

- [ ] **Step 2: Add CSS animations and Tailwind classes for transition**
  Ensure the card uses strict border-radius `6px`, background `#212121`, border `border-white/5`, no gradients, and clean Lucide icons.

- [ ] **Step 3: Verify style compilation**
  Run compilation check:
  `pnpm typecheck`
  Expected: PASS

- [ ] **Step 4: Commit Accordion changes**
  ```bash
  git add src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx
  git commit -m "feat(weekly-review): implement origami accordion day cards"
  ```

---

### Task 3: Right Dashboard Panel and Top Metric Cards

**Files:**
- Modify: `src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx`

- [ ] **Step 1: Create 3 Clean Metric Cards in Left Dashboard Header**
  Add 3 clean cards for top stats:
  - To-Do Completion Rate (e.g. `stats.completionRate%`)
  - Knowledge Accumulation (e.g. `stats.totalSnippets` 个片段)
  - Journal Writing continuity (e.g. `stats.journalsCount/7` 天)
  Use strict style: Background `#212121`, border `white/5`, text-sm labels, large bold white value text.

- [ ] **Step 2: Layout the ECharts Grid Container**
  Set up a responsive grid container for ECharts inside the dashboard panel with unique refs for each of the 4 charts:
  - `radarChartRef` (Radar)
  - `doughnutChartRef` (Doughnut Tag cloud)
  - `lineBarChartRef` (Trend line-bar)
  - `scatterChartRef` (Scatter activity)

- [ ] **Step 3: Commit dashboard scaffolding**
  ```bash
  git add src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx
  git commit -m "feat(weekly-review): setup metrics cards and chart containers grid"
  ```

---

### Task 4: Integrate All 4 ECharts Instances

**Files:**
- Modify: `src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx`

- [ ] **Step 1: Declare all Refs and ECharts Instances**
  Set up refs for all 4 containers and the 4 ECharts instances at the top of the component:
  ```tsx
  const radarChartRef = useRef<HTMLDivElement | null>(null);
  const doughnutChartRef = useRef<HTMLDivElement | null>(null);
  const lineBarChartRef = useRef<HTMLDivElement | null>(null);
  const scatterChartRef = useRef<HTMLDivElement | null>(null);

  const radarInstance = useRef<echarts.ECharts | null>(null);
  const doughnutInstance = useRef<echarts.ECharts | null>(null);
  const lineBarInstance = useRef<echarts.ECharts | null>(null);
  const scatterInstance = useRef<echarts.ECharts | null>(null);
  ```

- [ ] **Step 2: Configure Chart 1 (五维策展星盘 Radar)**
  Build a clean radar chart utilizing white lines, black backgrounds, and subtle filled areas, indicating 5 curation axes.

- [ ] **Step 3: Configure Chart 2 (记忆标签环形分布 Doughnut)**
  Calculate tag proportions from snippets. Render a doughnut chart displaying the top tags with distinct percentages in monospaced fonts. If no tags, show a centered text indicator.

- [ ] **Step 4: Configure Chart 3 (每日产出趋势双轴 Line + Bar)**
  X-axis has周一 to 周日. Bar series represent Total Todos and Completed Todos. Line series represents Snippet capture count. Keep it high contrast (gray and white).

- [ ] **Step 5: Configure Chart 4 (每周行为律动 Scatter)**
  X-axis is days of the week, Y-axis is categories (待办, 片段, 日记). Bubble size represents active count of items.

- [ ] **Step 6: Handle Responsive Resize and Safe Disposal**
  Add window resize handler to trigger `.resize()` on all instantiated ECharts. Disposes of all 4 instances in clean-up hook on unmount.

- [ ] **Step 7: Verify builds and types**
  Run: `pnpm typecheck`
  Expected: PASS

- [ ] **Step 8: Commit ECharts integrations**
  ```bash
  git add src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx
  git commit -m "feat(weekly-review): integrate radar, doughnut, line-bar, and scatter charts"
  ```

---

### Task 5: Testing and Polish

**Files:**
- Modify: `src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx`

- [ ] **Step 1: Verify layout behavior**
  Verify the interaction when clicking days and verify all 4 charts load perfectly without canvas overlap.

- [ ] **Step 2: Commit final polish and changes**
  ```bash
  git add src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx
  git commit -m "style(weekly-review): finish layout polish and interaction details"
  ```
