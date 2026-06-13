# Design Spec: Weekly Review Page with Innovative Origami Layout & ECharts

This spec details the design and implementation of the `WeeklyReviewPage` featuring an innovative, asymmetrical "Origami Grid" layout, integration with ECharts for weekly insights, and a custom global weekly navigator in the header.

## Requirements

1. **Global Header Integration**:
   - Update `Header.tsx` to include `"weekly"` in the `activePage` whitelist for displaying `dateNavigator`.
   - Implement `PageWeekNavigator` component to handle weekly boundaries (Monday to Sunday).
   - Right and left navigation shifts dates by 7 days (one full week).
   - Calendar popup highlights the entire hovered week and selects that week.

2. **Data Orchestration**:
   - Given an `entryDate`, compute the starting Monday and ending Sunday.
   - Fetch daily data (`todos`, `snippets`, `journal`) for all 7 days in parallel using `window.api.daily.listDay(date)`.
   - Aggregate statistics:
     - To-Do completion metrics.
     - Snippet counts and tag clouds.
     - Journal density and high-lighted thoughts.

3. **ECharts Visualizations**:
   - **Weekly Multi-Dimensional Star Radar**: Visualizes metrics such as Todo completion rate, journal continuity, snippet capture rate, priority handling, and total activities.
   - **Weekly Heatmap / Activity Scatter**: Demonstrates input intensity per day.

4. **Origami Grid Layout**:
   - Left Panel (40% width): Fixed container displaying weekly overview statistics, interactive ECharts Radar, and active Tag Cloud.
   - Right Panel (60% width): An asymmetrical "Time Stream" composed of 7 card items representing the days of the week.
   - Design guidelines: Dark theme (background `#000000`, card background `#212121`), round corners `6px`, default font size `13px` (`text-sm`), detail font size `12px` (`text-xs`). Zero gradients.

## Proposed Code Changes

### 1. Header whitelist update in `src/renderer/src/components/layout/Header.tsx`

Add `"weekly"` to allow displaying date selectors for the weekly review page:

```tsx
        {["today", "todo", "snippets", "journal", "weekly"].includes(activePage) && !isChatOpen && dateNavigator && (
          <span className="flex items-center ml-2">{dateNavigator}</span>
        )}
```

### 2. Creation of `PageWeekNavigator.tsx` at `src/renderer/src/components/ui/PageWeekNavigator.tsx`

A customized navigator for week-level control:
- Displays `YYYY.MM.DD - YYYY.MM.DD [Week NN]`.
- Provides left/right chevron buttons that shift the baseline by $\pm 7$ days.
- Features a drop-down month calendar that highlights the entire Monday-Sunday week during hover or active focus.

### 3. Implementation of `WeeklyReviewPage.tsx`

- Use Zustand store or state passing via header store.
- Use `useEffect` inside `WeeklyReviewPage` to publish the `<PageWeekNavigator>` to `setHeaderStore`.
- Compute the week span (Monday to Sunday) from selected `entryDate`.
- Parallel fetch: `Promise.all` calling `window.api.daily.listDay(date)`.
- Render the dual-pane Origami Layout:
  - **Left Side**: Global analytics card & interactive radar/activity charts.
  - **Right Side**: Vertical scrollable list of 7 daily cards, styled with micro-hover interactions, zero gradients, and high contrast typography.

## Testing & Verification

1. Verify that selecting a date via the header navigator updates the week bounds on the page.
2. Confirm parallel DB fetching behaves reliably without timing out or missing days.
3. Validate ECharts resize listener works correctly on window resize.
4. Ensure code typechecks successfully using `npm run typecheck`.
