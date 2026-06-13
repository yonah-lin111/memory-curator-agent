# Design Spec: Weekly Review Page Layout Redesign (Origami Folding Stream & 4D Dashboard)

This document details the layout redesign for `@src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx`.

## 1. Design & Layout Goals

### 1.1 Left Panel (Origami Accordion / Time Stream)
- **Width**: `55%` or `lg:w-[55%]`.
- **UI Concept**: Accordion folding cards (Monday to Sunday) that act as an asymmetric timeline.
- **State**: A state variable `expandedDate: string | null` (defaults to the Monday of the current week).
- **Collapsed Card Visuals**: Shows the day name (e.g., 周一), date, and compact status badges (e.g. "📝 1 篇日记", "✅ 3/4 待办", "🔖 2 个片段") in a single row.
- **Expanded Card Visuals**: Shows the day header and full content blocks:
  - **Journal Section**: Content with a compact scrolling box, clean font styles, high-contrast, no background gradient.
  - **Grid of Activity**:
    - **To-Do Completed list**: Custom checkmarks, support scrolling for long lists, slice to show a max list or proper scrolling.
    - **Snippets Captured**: Bulleted list of titles with timestamp prefix `[HH:MM]`.
- **Transitions**: Smooth animations for card expand/collapse (e.g., max-height, scale transitions) utilizing Tailwind and basic CSS transitions.

### 1.2 Right Panel (4D Dashboard Panel)
- **Width**: `45%` or `lg:w-[45%]`.
- **Background**: Secondary dark color `#212121` with high-contrast text and a subtle borders `border-white/5`.
- **Top Metrics**: Grid of 3 clean stat cards (Completion Rate, Snippet Count, Journal Count) using large bold white text.
- **Grid of ECharts**: A grid or multi-row layout showcasing exactly 4 custom charts:
  1. **五维策展星盘 (Radar Chart)**: Shows the current 5 stats (Todo Completion, Knowledge Accumulation, Journal Continuity, Focus Attack, Information Curation) in a compact layout.
  2. **记忆标签环形图 (Doughnut Pie Chart)**: Visualizes the proportion of the top 5-6 tags. If no tags, shows a beautiful placeholder.
  3. **每日行动与片段趋势双轴图 (Line + Bar Chart)**: Daily bar heights representing (Completed / Total) todos, with a line representing the snippet captures count.
  4. **周中律动密度气泡图 (Scatter Chart)**: Existing scatter bubble chart.

---

## 2. Technical Implementation Details

### 2.1 ECharts Instance Management
To prevent memory leaks and overlapping chart containers on resize/refetch:
- Use unique `useRef` handles for each of the 4 chart containers:
  - `radarChartRef`
  - `doughnutChartRef`
  - `lineBarChartRef`
  - `scatterChartRef`
- Maintain respective ECharts instances:
  - `radarInstance`
  - `doughnutInstance`
  - `lineBarInstance`
  - `scatterInstance`
- In `useEffect`, check loading state before initializing. Dispose old instances properly or use `.setOption` dynamically.
- Implement an automatic window resize listener that triggers `.resize()` on all instantiated charts.
- Properly run `instance.dispose()` on unmount or in the clean-up return of the render effect.

### 2.2 Data Aggregation and Metrics Math
For the two new charts:
- **Doughnut Chart (Tags Distribution)**:
  - Aggregate tag counts across all 7 days from `snippets`.
  - Slice the top 5 tags + group the rest into "Other", or just show top 6 tags.
- **Line + Bar Chart (Daily Trend)**:
  - X-axis: `['周一', '周二', '周三', '周四', '周五', '周六', '周日']`.
  - Bar series 1: `Completed Todos` (e.g. count of `completed: true`).
  - Bar series 2: `Total Todos`.
  - Line series: `Snippets Count`.
  - Use custom muted colors: white, gray, and subtle semi-transparent fills to fit the `#212121` dark mode.

---

## 3. Style and Theme Compliance
- Strict adherence to the `AGENTS.md` conventions:
  - Color: Primary `#000000`, Secondary `#212121`.
  - Rounded Corners: `6px` (`rounded-[6px]`).
  - Font Size: Default `13px` (`text-sm`), badges/tags/details `12px` (`text-xs`).
  - Comment style: Simplified Chinese, minimal comments explaining *why*, not *what*.
  - No gradients!

---

## 4. Verification Plan
- Run `npm run typecheck` to verify TypeScript builds successfully.
- Run `npm run lint` or `pnpm typecheck` to ensure no errors.
