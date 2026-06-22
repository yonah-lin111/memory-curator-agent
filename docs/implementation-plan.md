# Memory Curator Agent — 策展功能实现方案

## 现状分析

当前代码库已有成熟的 Electron + React + TypeScript + SQLite (Drizzle) 架构，包含：

- 完整的 AI ReAct Agent 对话系统（工具调用、流式输出、多 provider）
- 日常记录 CRUD（Todos、Snippets、Journals、Notes、People）
- Weekly Review 页面：数据仪表盘已完成（ECharts 图表），但 **AI 总结面板为占位符**
- Themes / Memories 页面：纯 `COMING SOON` 空壳

**核心策展能力（AI 总结、主题追踪、记忆关联、模式识别）全部缺失。**

---

## Phase 1: AI 周度总结 ✅ (已完成)

### 目标

替换 WeeklyReviewPage 右下角 `"总结功能筹备中..."` 占位符，实现一键 AI 总结当周数据，流式输出。

### ✅ 1.1 数据库 — `weekly_summaries` 表（实际实现）

在 `src/main/db/schema.ts` 新增，**超越原始计划的关键扩展**：

- **添加 `type` 列**：`'summary' | 'interpersonal'`，支持双面板（周度总结 + 人际策展）
- **联合唯一约束**：`UNIQUE(week_start_date, type)` 替代原单列 `unique`，允许同一周有两条不同类型记录
- **添加 `is_meaningful` 列**：0/1 标记，前端根据此字段决定是否显示兜底文案（如"本周暂无值得总结的记录"）
- **完整迁移逻辑**（`src/main/db/index.ts`：旧 `-curator` 后缀 → 新 `type` 列；补加 `is_meaningful` 列；清洗 `'curator'` → `'interpersonal'`）

最终 DDL：

```sql
CREATE TABLE IF NOT EXISTS weekly_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start_date TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'summary',       -- 'summary' | 'interpersonal'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  model_used TEXT,
  generated_at TEXT NOT NULL,
  is_meaningful INTEGER NOT NULL DEFAULT 1,    -- 0=无实质内容, 1=有
  UNIQUE(week_start_date, type)
);
```

### ✅ 1.2 Service — `weeklySummaryService.ts`

**新文件** `src/main/services/weeklySummaryService.ts`，**基于原始计划扩展**：

- `getByWeekStart(weekStartDate, type?)` — 新增可选 `type` 过滤
- `save(input)` — `ON CONFLICT(week_start_date, type)` upsert，包含 `type` 和 `isMeaningful`
- `delete(weekStartDate, type?)` — 新增可选 `type` 过滤
- `rowToItem(row)` — 映射 `type` 和 `isMeaningful`

### ✅ 1.3 IPC Handler — `weeklyHandlers.ts`

**新文件** `src/main/ipc/weeklyHandlers.ts`，**超越原始计划的关键扩展**：

| IPC Channel               | 用途                    | 实现                                  |
| ------------------------- | ----------------------- | ------------------------------------- |
| `weekly:summary:get`      | 获取某周总结            | `weeklySummaryService.getByWeekStart` |
| `weekly:summary:save`     | 手动保存/编辑           | `weeklySummaryService.save`           |
| `weekly:summary:delete`   | 删除总结                | `weeklySummaryService.delete`         |
| `weekly:summary:generate` | AI 流式生成总结（核心） | 见下方详述                            |
| `weekly:curator:get`      | 获取人际策展            | `weeklySummaryService.getByWeekStart` |
| `weekly:curator:save`     | 保存人际策展            | `weeklySummaryService.save`           |
| `weekly:curator:delete`   | 删除人际策展            | `weeklySummaryService.delete`         |
| `weekly:curator:generate` | AI 流式生成人际策展     | 见下方详述                            |

#### ✅ `weekly:summary:generate` 流程

1. 并发拉取周一至周日 7 天 `DayData`，**按模板压缩**（todo/snippet/journal 各有限额，每天 < 500字）
2. 从 `loadProviderConfig()` 读取 `weeklySummary` 段的 provider/model 配置（**支持多 provider 路由**）
3. **把关检查（Gatekeeper）**：AI 预判本周是否有实质内容值得总结 → 若无则直接写入 `isMeaningful=0` 的空记录并返回兜底文案
4. 构造 **结构化 Markdown system prompt**（固定标题层级：本周记录与进展、状态与情绪反思、发现的问题与收获、习惯改进与行动、核心反思问题）
5. `provider.streamTurn()` 流式输出，每段 `text_delta` 实时推送到前端
6. 收集全文 → 提取标题（# 首行）→ upsert 到 `weekly_summaries` 表（`type='summary'`）
7. 发送 `weekly:summary:done` 事件

#### ✅ `weekly:curator:generate` 流程

1. **额外加载 `peopleService.list()` 人物档案**，用作策展 context
2. 把关检查：判断本周是否有**人际互动相关**实质内容（gatekeeper prompt 含人物档案）
3. 构造 **人际策展 system prompt**（本周人际互动、互动感受与反思、人物细节洞察、关系改进与行动）
4. 其余流程同 summary generate

### ✅ 1.4 UI 改造

#### `<WeeklySummaryPanel>` 子组件 — 基于原始计划大幅扩展

位于 `src/renderer/src/pages/weekly-review/components/WeeklySummaryPanel.tsx`

**状态机（每个 Tab 独立）：**
```
idle ──→ loading ──→ streaming ──→ done
  │                                    │
  └──────── 重新生成 ─────────────────┘
```

**双 Tab 设计：**
- 「总结报告」Tab：调用 `weekly:summary:*` IPC
- 「人际策展」Tab：调用 `weekly:curator:*` IPC

**扩展功能：**
- **`requestAnimationFrame` 批量渲染**：流式累积 `useRef` + RAF 节流，避免高频 DOM 更新
- **历史周自动生成**：`isHistoricWeek` 检测 → 数据非空且无总结时静默自动触发
- **编辑模式**：`MdEditor` Markdown 编辑器 + 保存/取消
- **有意义检测**：`isMeaningful` 为 0 时显示前端兜底文案
- **页脚**：显示模型名和生成时间
- **`isEmpty` 支持**：本周数据为空时禁用生成按钮并显示提示
- **Tab 切换标签**：使用 `Tag` 组件做切换

#### `WeeklyReviewPage.tsx` — 页面级增强

- 集成 `WeeklySummaryPanel` 替换原占位符
- **页面初始化静默生成**：首次加载时检查上一周是否需要自动生成总结
- **`isEmpty` 计算**：基于 7 天数据判断是否有实质内容
- **响应式布局**：时间溪流 + 总结面板各自独占一行

### ✅ 1.5 Preload 暴露

`window.api.weekly` 命名空间（`src/preload/index.ts`），**分两个子命名空间**：

| 方法                | 说明                          |
| ------------------- | ----------------------------- |
| `weekly.summary.*`  | get / save / delete / generate / onDelta / onDone |
| `weekly.curator.*`  | get / save / delete / generate / onDelta / onDone |

每个 `onDelta` / `onDone` 返回取消监听函数，支持 React 中 clean up。

### ✅ 1.6 注册点

| 文件                                        | 变更                                                |
| ------------------------------------------- | --------------------------------------------------- |
| `src/main/db/schema.ts`                     | 新增 `WeeklySummaryRow/Item/SaveInput` 类型         |
| `src/main/db/index.ts`                      | 新增 `createWeeklySummariesTable()` + 迁移逻辑      |
| `src/main/services/weeklySummaryService.ts` | **新文件**                                          |
| `src/main/ipc/weeklyHandlers.ts`            | **新文件**（含 summary + curator 双 handler）       |
| `src/main/index.ts`                         | `registerWeeklyHandlers()` 注册                     |
| `src/preload/index.ts`                      | 暴露 `window.api.weekly.summary` + `.curator`       |
| `src/renderer/src/pages/weekly-review/`     | 新增 `WeeklySummaryPanel.tsx`，修改 `WeeklyReviewPage.tsx` |

---

## Phase 2: 长期主题追踪（Themes）✅ (已完成)

### 目标

用户手动定义 + AI 自动建议长期主题（如「职业转型」「亲密关系」等），将笔记/日记/片段关联到主题，追踪叙事演变。**核心增强：打通「周度总结 → 长期主题」闭环，在每次周总结生成时自动提取主题建议，实现无感的主题积累。**

### ✅ 2.1 数据库 — `themes` + `theme_items` 表

在 `src/main/db/schema.ts:713-743` 新增，**超越原始计划的扩展**：

- **表结构**：`themes`（id, externalId, name, description, color, status, createdAt, updatedAt）+ `theme_items`（id, externalId, themeExternalId, sourceType, sourceId, relevanceNote, aiExtracted, createdAt）+ 唯一约束 `(themeExternalId, sourceType, sourceId)`
- **额外迁移**（`src/main/db/index.ts:547-548`）：通过 SQL `ALTER TABLE` 追加了 `ai_generated INTEGER` 列（DDL schema 中省略但通过迁移补充）
- **类型导出**：`ThemeItem`, `ThemeCreateInput`, `ThemeUpdateInput`, `ThemeRow`, `ThemeItemRow`, `ThemeItemsItem`, `ThemeItemsCreateInput`, `ThemeTimelineItem`（`schema.ts:635-711`）
- `sourceType` 支持 `'note' | 'journal' | 'snippet' | 'weekly_summary'`，覆盖周度总结映射

### ✅ 2.2 Service — `themesService.ts`

**新文件** `src/main/services/themesService.ts`（394 行），**超越原始计划的扩展**：

| 方法                                                | 用途                                      |
| --------------------------------------------------- | ----------------------------------------- |
| `list(status?)`                                     | 获取所有主题（可选按状态过滤，含关联数） |
| `getByExternalId(id)`                               | 单个主题                                  |
| `create(input)`                                     | 新建（生成 externalId，含 aiGenerated）   |
| `update(id, input)`                                 | 更新名称/描述/状态/颜色                   |
| `delete(id)`                                        | 删除（级联删除 items）                    |
| `addItem(input)`                                    | 添加关联条目（ON CONFLICT upsert）        |
| `removeItem(themeExternalId, sourceType, sourceId)` | 移除关联                                  |
| `listItems(themeExternalId)`                        | 某主题的所有关联条目（join 源表获取摘要） |
| `getItemCount(themeExternalId)`                     | 关联计数（用于列表展示）                   |
| `batchCreateFromTags(tags)`                         | 从标签批量创建主题种子                    |
| `extractThemesFromSummary(content, summaryId)`      | 从总结全文解析 JSON 并 upsert 主题建议    |
| `getTimeline(themeExternalId)`                      | 跨周分布时间线                            |
| `cleanupOrphanedAiThemes()`                         | 清理无关联的 AI 自动生成主题              |
| `querySql(sql)`                                     | 供 AI Agent 原始查询                      |

### ✅ 2.3 Agent Tool — `themeTool.ts`

**新文件** `src/main/agent/tools/themeTool.ts`（275 行），6 个工具，分组导出 `createThemeTools(themesService): AgentTool[]`：

| 工具                     | 类型           | 说明                    |
| ------------------------ | -------------- | ----------------------- |
| `theme_tool_query`       | 查询           | 列出主题/关联，支持 sql |
| `theme_tool_add`         | 写入（带确认） | 创建新主题              |
| `theme_tool_update`      | 写入（带确认） | 更新主题                |
| `theme_tool_delete`      | 写入（带确认） | 删除主题                |
| `theme_tool_item_add`    | 写入（带确认） | 关联素材到主题          |
| `theme_tool_item_remove` | 写入（带确认） | 移除关联                |

### ✅ 2.4 IPC — `themesHandlers.ts`

**新文件** `src/main/ipc/themesHandlers.ts`（66 行），**超越原始计划的扩展**：

```
themes:list / themes:get / themes:create / themes:update / themes:delete
themes:items:list / themes:items:add / themes:items:remove
themes:import-from-tags / themes:timeline / themes:update-description
```

- `themes:update-description` 调用 `themeDescriptionUpdater.ts`，AI 自动生成主题描述

### ✅ 2.5 UI — ThemesPage 完整页面

**新文件** `src/renderer/src/pages/themes/ThemesPage.tsx`（650 行），替换原占位符：

- **左列（主题列表，~w-72）**：卡片式列表（活跃/已归档分组），名称/描述/关联数/状态标签，hover 显示编辑/删除操作
- **右列（主题详情）**：选中主题后展开：
  - 基本信息卡片（名称、描述、创建/更新时间、关联数）
  - 关联素材列表（来源类型标签 `note/journal/snippet/weekly_summary` + 标题 + AI 标记 + 可预览内容 + 解除关联）
  - 时间线简化版（柱状图，高亮周度总结提及的节点）
- **弹窗**：新建/编辑主题弹窗 + 从标签导入弹窗
- **空态**：引导文案 + 「从标签导入」按钮

### ✅ 2.6 注册点

| 文件                                     | 变更                                              |
| ---------------------------------------- | ------------------------------------------------- |
| `src/main/db/schema.ts:713-743`          | 新增 `themes` + `theme_items` 2 表 + 9 个类型     |
| `src/main/db/index.ts:547-548`           | 迁移：`ALTER TABLE themes ADD COLUMN ai_generated` |
| `src/main/services/themesService.ts`     | **新文件**（394 行）                               |
| `src/main/agent/tools/themeTool.ts`      | **新文件**（275 行，6 个 Agent tool）              |
| `src/main/agent/tools/toolRegistry.ts:9` | 注册 `createThemeTools`                            |
| `src/main/ipc/themesHandlers.ts`         | **新文件**（66 行，10 个 IPC）                     |
| `src/main/ipc/themeDescriptionUpdater.ts` | **新文件**：AI 自动生成主题描述                    |
| `src/main/index.ts:67`                   | `registerThemesHandlers()`                         |
| `src/preload/index.ts:697-719`           | `window.api.themes`（12 个方法）                   |
| `src/renderer/src/pages/themes/`         | 重写为完整页面（ThemesPage.tsx，650 行）            |
| `test/main/services/themesService.test.ts` | **新测试文件**                                   |

### ✅ 2.7 周度总结联动 — 自动主题提取（核心增强）

**实际实现采用路径 B（独立 AI 调用）**，路径 A（内联 prompt 追加）未采用。

#### 方案

`weeklyHandlers.ts:111-183` 新增 `extractThemesWithAI()`：

1. 在 `weekly:summary:generate` 完成总结生成并保存后（`:491-518`），启动独立 AI 调用
2. **语义对齐优先**：prompt 要求优先匹配已有主题候选池（`existingThemes`），仅当语义无重叠时才创建新主题
3. 响应为 JSON 数组：`{name, confidence, evidence}` → 调用 `saveExtractedThemes()` 落地
4. 每个成功提取的主题异步触发 `updateThemeDescription()` 自动补全描述
5. 异常不影响主流程（try-catch 包裹）

#### 注册点变更

| 文件                                     | 变更                                          |
| ---------------------------------------- | --------------------------------------------- |
| `src/main/ipc/weeklyHandlers.ts:111-183` | `extractThemesWithAI()` 函数                   |
| `src/main/ipc/weeklyHandlers.ts:491-518` | 总结完成后的主题提取集成                        |
| `src/main/services/themesService.ts:270` | `extractThemesFromSummary()`（备用解析方法）     |

### ✅ 2.8 标签预热 — 从标签引导主题种子

- `themesService.batchCreateFromTags(tags)` — 已实现（`:245-268`）
- `themes:import-from-tags` IPC — 已注册
- ThemesPage 空态/按钮 → 弹窗输入逗号分隔标签 → 跳过已有名称 → 批量创建（`aiGenerated=0`）
- **差异**：实际 UI 是手动输入标签而非自动扫描全量数据，更可控

### ✅ 2.9 跨周主题追踪与演化视图

- `themesService.getTimeline(themeExternalId)` — 已实现（`:357-378`）：`strftime` 按自然周聚合，标记 `mentionedInSummary`
- `themes:timeline` IPC — 已注册
- ThemesPage 详情底部柱状图 — 已实现（`:521-549`），简洁高度图 + 总结提及高亮

### 实际实现与原始计划的差异总结

| 计划项                       | 实际差异                                                       |
| ---------------------------- | -------------------------------------------------------------- |
| `ai_generated` 列            | 通过 SQL 迁移追加，不在 Drizzle schema 定义中                  |
| 主题提取方式                 | 采用路径 B（独立 AI 调用），而非路径 A（内联 prompt 追加）     |
| `extractThemesFromSummary()` | 作为备用方法存在，但实际流程使用 `extractThemesWithAI()`       |
| `themeDescriptionUpdater`    | **新文件**（未在原始计划中），AI 自动补全主题描述               |
| `cleanupOrphanedAiThemes`    | **新方法**（未在原始计划中），清理孤立 AI 主题                  |
| `getItemCount`               | **新方法**（未在原始计划中），列表关联数计数                    |
| `batchCreateFromTags` UI     | 手动输入标签而非自动扫描全量数据                                |
| 时间线 UI                    | 纯 CSS 柱状图而非 ECharts，更轻量                               |
| 测试                         | `test/main/services/themesService.test.ts` 已存在               |

---

## Phase 3: 记忆关联（Memories）— 三层架构

### 目标

AI 在用户素材之间发现并建立有意义的线索连接，支持图遍历查询与叙事线程追踪。**扩展为三层架构**：显式关联 → 智能发现 → 图分析。

---

### Layer 1: 显式关联（基础 CRUD + 状态机）

#### 3.1 数据库 — `memory_links` 表

在 `src/main/db/schema.ts` 新增，**扩展原方案**：

- **`sourceType`/`targetType` 扩展**：`'note' | 'journal' | 'snippet' | 'todo' | 'theme' | 'person' | 'weekly_summary'`，打通 Phase 1/2
- **`sourceId`/`targetId` 统一为 `text`**：兼容各类型 ID（theme externalId、person uuid、weekly summary id）
- **`rationale` 列**：存 AI 生成建议时的原始依据，供用户判断是否采纳
- **去重约束**：`UNIQUE(source_type, source_id, target_type, target_id)` 防止双向重复

```typescript
export const memoryLinks = sqliteTable("memory_links", {
  id: integer().primaryKey({ autoIncrement: true }),
  externalId: text("external_id").notNull().unique(),
  // 源
  sourceType: text("source_type").notNull(),
  //   'note' | 'journal' | 'snippet' | 'todo' | 'theme' | 'person' | 'weekly_summary'
  sourceId: text("source_id").notNull(),
  sourceExcerpt: text("source_excerpt").notNull().default(""),
  // 目标
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  targetExcerpt: text("target_excerpt").notNull().default(""),
  // 关联元数据
  linkType: text("link_type").notNull().default("related"),
  //   'related' | 'contradicts' | 'extends' | 'references' | 'causes' | 'echoes' | 'precedes'
  description: text().notNull().default(""),
  confidence: integer().notNull().default(50), // 0-100，动态衰减
  rationale: text().notNull().default(""),     // AI 生成时的原始依据
  status: text().notNull().default("suggested"),
  //   'suggested' | 'confirmed' | 'dismissed' | 'decayed'
  discoveryMethod: text("discovery_method").notNull().default("manual"),
  //   'manual' | 'keyword' | 'tag_overlap' | 'temporal' | 'ai'
  lastReinforcedAt: text("last_reinforced_at"), // 最后交互时间，用于衰减计算
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  sourceTargetUnique: uniqueIndex("idx_ml_source_target")
    .on(table.sourceType, table.sourceId, table.targetType, table.targetId),
  statusIdx: index("idx_ml_status").on(table.status),
  linkTypeIdx: index("idx_ml_link_type").on(table.linkType),
}));
```

导出类型：`MemoryLinkRow`, `MemoryLinkItem`, `MemoryLinkCreateInput`, `MemoryLinkUpdateInput`, `MemoryLinkCandidate`（候选建议类型）, `MemoryLinkListParams`, `MemoryGraphPath`, `NarrativeThread`, `CentralNode`.

#### 3.2 Service — `memoryLinksService.ts`

**新文件** `src/main/services/memoryLinksService.ts`（~450 行），参照 `themesService.ts` 模式：

| 方法 | 用途 | 层级 |
|------|------|------|
| `list(params)` | 分页列表，支持 status/linkType/sourceType 筛选、时间倒序 | L1 |
| `getByExternalId(id)` | 单条详情 | L1 |
| `create(input)` | 创建关联（externalId 自动生成），冲突 upsert | L1 |
| `update(id, input)` | 更新状态/描述/类型/置信度 | L1 |
| `delete(id)` | 删除单条 | L1 |
| `findByEntity(sourceType, sourceId)` | 查找某实体的所有关联（双向） | L1 |
| `querySql(sql)` | AI Agent 只读查询 | L1 |

| **`discoverCandidates(entityType, entityId, options)`** | **多信号候选生成管线**（核心） | **L2** |
| **`batchDiscover(entries, options)`** | **批量发现：对一组条目并发跑候选管线** | **L2** |
| **`decayConfidence(externalId)`** | **衰减单条链接置信度（按距上次强化时间）** | **L2** |
| **`reinforceLink(externalId)`** | **强化链接（更新 lastReinforcedAt，置信度 +10）** | **L2** |
| **`batchDecayStaleLinks(daysThreshold)`** | **批量衰减超过 N 天未强化的 suggested 链接** | **L2** |

| **`getGraphPath(fromType, fromId, toType, toId, maxDepth)`** | **SQLite CTE 最短路径查询** | **L3** |
| **`getCentralNodes(minDegree)`** | **度数 ≥ minDegree 的中心节点** | **L3** |
| **`getNarrativeThreads(startEntity, maxLength)`** | **链式追踪叙事线程** | **L3** |
| **`getEgoNetwork(entityType, entityId, radius)`** | **以某实体为中心的 N 跳邻居子图** | **L3** |
| **`getBridgeLinks()`** | **桥接链接检测（连接两个孤立子图的关键边）** | **L3** |

##### 多信号候选生成管线 (`discoverCandidates`)

不使用外部依赖（无向量嵌入），纯 SQLite 内置能力：

```
输入: { entityType, entityId, maxResults = 10, minScore = 0.3 }
管线:
  1. 读取源实体内容（通过各 service 回查）
  2. 提取关键词：取内容前 200 字符 + 标题，按空格/标点拆词，取频次 Top-10
  3. 四信号并行打分：
     a. 关键词重叠 (weight 0.35): SQLite FTS5 MATCH 或 LIKE 模糊匹配
     b. 标签共现   (weight 0.25): 与 snippets 的 tags 列 JOIN
     c. 时间邻近   (weight 0.20): 同一天或同周的条目 +5~10 分
     d. 主题重叠   (weight 0.20): 与 theme_items 表 JOIN
  4. 四信号加权求和 → 输出 score，按 score DESC 取 top maxResults
  5. 过滤已有链接、过滤自身、过滤已 dismissed
返回: MemoryLinkCandidate[] (含 targetType, targetId, title, excerpt, score, signals)
```

#### 3.3 Agent Tool — `memoryLinkTool.ts`

**新文件** `src/main/agent/tools/memoryLinkTool.ts`（~350 行），参照 `themeTool.ts` 模式，7 个工具：

| 工具 | 类型 | 说明 |
|------|------|------|
| `memory_link_tool_query` | 查询 | 查询已有关联，支持 status/linkType/sourceType 过滤；支持 SQL |
| `memory_link_tool_suggest` | 查询 | **多信号候选管线**：给定源实体，返回加权候选列表（含各信号得分明细） |
| `memory_link_tool_discover` | 查询 | **批量发现**：对一组条目（或指定日期范围）批量跑候选管线 |
| `memory_link_tool_graph` | 查询 | **图遍历**：action 枚举 path/central/narrative/ego/bridge |
| `memory_link_tool_add` | 写入（确认） | 创建关联，含 rationale |
| `memory_link_tool_update` | 写入（确认） | 确认/驳回/编辑/衰减 |
| `memory_link_tool_delete` | 写入（确认） | 删除关联 |

`memory_link_tool_graph` 的 action 枚举：
```typescript
action: 'shortest_path' | 'central_nodes' | 'narrative_threads' | 'ego_network' | 'bridge_links'
```

##### 图遍历 SQL 示例（SQLite WITH RECURSIVE CTE）

```sql
-- 最短路径：从实体 A 到实体 B，最多 4 跳
WITH RECURSIVE path_search(node_type, node_id, depth, visited, path_types) AS (
  SELECT target_type, target_id, 1,
         source_id || ',' || target_id,
         link_type
  FROM memory_links
  WHERE source_type = ? AND source_id = ? AND status = 'confirmed'
  UNION ALL
  SELECT ml.target_type, ml.target_id, ps.depth + 1,
         ps.visited || ',' || ml.target_id,
         ps.path_types || ' → ' || ml.link_type
  FROM memory_links ml
  JOIN path_search ps ON ml.source_type = ps.node_type AND ml.source_id = ps.node_id
  WHERE ml.status = 'confirmed'
    AND ps.depth < 4
    AND ps.visited NOT LIKE '%' || ml.target_id || '%'  -- 防环
)
SELECT * FROM path_search
WHERE node_type = ? AND node_id = ?
ORDER BY depth ASC LIMIT 1;

-- 中心节点：度数排名 Top-N
SELECT source_type, source_id, COUNT(*) AS degree
FROM memory_links WHERE status = 'confirmed'
GROUP BY source_type, source_id
HAVING degree >= ?
ORDER BY degree DESC;

-- 叙事线程：从某实体出发，按时间顺序追踪连续关联链（最大 6 跳）
WITH RECURSIVE thread(link_id, source_type, source_id, target_type, target_id,
                      link_type, depth, created_at, thread_path) AS (
  SELECT id, source_type, source_id, target_type, target_id,
         link_type, 1, created_at, source_id || '→' || target_id
  FROM memory_links
  WHERE source_type = ? AND source_id = ? AND status = 'confirmed'
  UNION ALL
  SELECT ml.id, ml.source_type, ml.source_id, ml.target_type, ml.target_id,
         ml.link_type, t.depth + 1, ml.created_at,
         t.thread_path || '→' || ml.target_id
  FROM memory_links ml
  JOIN thread t ON ml.source_type = t.target_type AND ml.source_id = t.target_id
  WHERE ml.status = 'confirmed'
    AND t.depth < 6
    AND ml.created_at > t.created_at  -- 时间单调前进
)
SELECT * FROM thread ORDER BY depth ASC;
```

#### 3.4 IPC — `memoryHandlers.ts`

**新文件** `src/main/ipc/memoryHandlers.ts`（~120 行），参照 `themesHandlers.ts` 模式：

```
memories:links:list / get / create / update / delete
memories:links:find-by-entity
memories:links:discover-candidates    ← 新增 L2 管线
memories:links:batch-discover         ← 新增 L2 批量
memories:links:decay                  ← 新增 L2 衰减
memories:links:graph                  ← 新增 L3 图遍历
memories:links:narrative-threads      ← 新增 L3 叙事线程
```

#### 3.5 周度总结联动 — 批量发现集成

在 `src/main/ipc/weeklyHandlers.ts` 中，总结/策展完成后（`weekly:summary:done` / `weekly:curator:done` 事件发送后），异步调用 `memoryLinksService.batchDiscover()`：

```
流程:
  1. 收集当周 7 天的新增条目（按 entryDate 过滤各表）
  2. 调用 batchDiscover(entries, { maxCandidatesPerEntry: 3, minScore: 0.4 })
  3. 得分 ≥ 0.6 的候选自动创建为 suggested 链接（discoveryMethod: 'auto'）
  4. 得分 0.4-0.6 的候选暂存，等下次 LLM 策展时作为上下文注入
  5. 异常不影响主流程（try-catch 包裹）
```

#### 3.6 UI — MemoriesPage 重写

当前 `MemoriesPage.tsx`（15 行占位符）→ 完整页面（~700 行）：

##### 布局：三栏结构

```
┌─ 左栏 (w-64) ────┬── 主区域 (flex-1) ──────────────┬── 右栏 (w-72) ──────┐
│ 筛选面板          │  记忆卡片瀑布流                   │  选中链接详情       │
│                   │                                  │                    │
│ ● 状态筛选        │  ┌─────────────────────────┐     │  源/目标双面板     │
│   suggested/      │  │ 源卡片   →   目标卡片    │     │  + 图上下文       │
│   confirmed/      │  │                          │     │                    │
│   dismissed/      │  │ [linkType 徽章] 置信度   │     │  叙事线程预览     │
│   decayed         │  │ 描述 + rationale         │     │  (选中链接参与    │
│                   │  │                          │     │   的线程链)       │
│ ● 类型筛选        │  │ [✅确认] [❌驳回] [✏️]  │     │                    │
│   related/        │  └─────────────────────────┘     │  关联图迷你视图   │
│   echoes/...      │                                  │  (ego network)    │
│                   │  ...更多卡片...                   │                    │
│ ● 来源类型筛选    │                                  │                    │
│   note/journal/.. │                                  │                    │
│                   │                                  │                    │
│ ● 发现方式筛选    │                                  │                    │
│   ai/manual/auto  │                                  │                    │
│                   │                                  │                    │
│ [跳转AI对话]      │                                  │                    │
│ [批量发现按钮]    │                                  │                    │
└───────────────────┴──────────────────────────────────┴────────────────────┘
```

##### 扩展功能

- **置信度衰减可视化**：用颜色渐变表示置信度（红=低 → 绿=高），hover 显示衰减倒计时
- **叙事线程面板**：选中链接时，右栏展示该链接参与的完整线程链（时间线形式，每节点可点击跳转）
- **批量发现入口**：顶部按钮「扫描新关联」，可选范围（本周/本月/全部未链接条目）
- **空态优化**：三档空态
  - 无数据：「尚未发现记忆关联。AI 会在每周总结后自动扫描，你也可以手动触发。」
  - 有 suggested 但未确认：「有 N 条待确认的关联建议」→ 引导审核
  - 全部 dismissed：「没有活跃关联。你可以调整筛选条件或重新扫描。」
- **跳转联动**：点击源/目标卡片可跳转到对应 Notes/Journal/Snippets/Themes/People 页面

#### 3.7 注册点

| 文件 | 变更 |
|------|------|
| `src/main/db/schema.ts` | 新增 `memoryLinks` Drizzle 表 + 12 个类型 |
| `src/main/db/index.ts` | 新增 `createMemoryLinksTable()` + 迁移逻辑 |
| `src/main/services/memoryLinksService.ts` | **新文件**（~450 行，20 个方法） |
| `src/main/agent/tools/memoryLinkTool.ts` | **新文件**（~350 行，7 个 Agent tool） |
| `src/main/agent/tools/toolRegistry.ts` | 注册 `createMemoryLinkTools` |
| `src/main/ipc/memoryHandlers.ts` | **新文件**（~120 行，10 个 IPC） |
| `src/main/ipc/weeklyHandlers.ts` | 总结完成后集成 `batchDiscover()` |
| `src/main/index.ts` | `registerMemoryHandlers()` |
| `src/preload/index.ts` | `window.api.memories`（10 个方法） |
| `src/renderer/src/env.d.ts` | `MemoriesAPI` 类型声明 |
| `src/renderer/src/pages/memories/` | 重写为完整页面（MemoriesPage.tsx ~700 行） |
| `test/main/services/memoryLinksService.test.ts` | **新测试文件** |

---

### 三层架构总览

```
┌─ Layer 1: 显式关联 (基础) ─────────────────────────┐
│  memory_links 表 + 完整 CRUD                        │
│  7 种 linkType + 4 种 status + 动态置信度           │
│  discoveryMethod 区分来源                           │
├─ Layer 2: 智能发现 (核心差异化) ────────────────────┤
│  多信号候选生成管线 (Keywords+Tags+Time+Theme)      │
│  批量发现（周总结联动）→ 静默自动生成                │
│  置信度衰减模型 → suggested 链接自动老化             │
├─ Layer 3: 图分析 (高级能力) ────────────────────────┤
│  SQLite RECURSIVE CTE 最短路径 / 中心节点            │
│  叙事线程追踪 / 自我网络 / 桥接检测                  │
│  Agent 可调用图遍历工具回答复杂策展问题               │
└─────────────────────────────────────────────────────┘
```

### 实现顺序建议

1. **Layer 1 先行**（~3 天）：schema + service CRUD + IPC + 基础 UI（筛选+卡片列表）
2. **Layer 2 并行**（~2 天）：候选管线 + 批量发现 + 衰减模型 + 周总结联动 + UI 批量入口
3. **Layer 3 收尾**（~2 天）：CTE 图查询 + 叙事线程 + 右栏详情 + Agent 图工具
4. **测试 + 打磨**（~1 天）：`memoryLinksService.test.ts` + 端到端验证

---

## Phase 4: Agent 主动策展交互

### 目标

将 Phase 1-3 的所有能力注入 AI Agent，让策展成为 Agent 的核心能力之一。

### 4.1 新增 curation agent

修改 `src/main/agent/core/agentHints.ts`：

```typescript
// AiChatAgentId 新增
type AiChatAgentId = 'people' | 'todo' | 'snippets' | 'journal'
  | 'notes' | 'today' | 'common' | 'curation'

// 新增 directive config
{
  id: 'curation',
  token: 'curation_agent',
  description: 'Prefer Memory Curation tools: weekly summaries, '
    + 'theme tracking, memory link discovery with graph traversal, '
    + 'pattern analysis, and proactive questioning for self-reflection.',
  tools: [
    // 周度总结
    'curation_tool_fetch_weekly_data',
    'curation_tool_save_weekly_summary',
    // 主题管理
    'theme_tool_query', 'theme_tool_add', 'theme_tool_update',
    'theme_tool_item_add', 'theme_tool_item_remove',
    // 记忆关联（含 L2 发现 + L3 图遍历）
    'memory_link_tool_query', 'memory_link_tool_suggest',
    'memory_link_tool_discover', 'memory_link_tool_graph',
    'memory_link_tool_add', 'memory_link_tool_update',
    // 通用策展
    'common_tool_ask', 'journal_tool_query',
    'notes_tool_query', 'snippets_tool_query',
  ],
}
```

### 4.2 增强 System Prompt

修改 `src/main/ipc/aiHandlers.ts` → `createSystemPrompt()`，**追加策展指令**：

```
## Curation Agent Guidelines
When the user invokes the curation agent (@curation) or shows curation
intent (review, reflection, pattern discovery, "what's going on with..."):

1. Weekly Review: Generate structured summaries covering completion rate,
   emotional fluctuations, key events, and repeating themes across the week.

2. Theme Tracking: Extract long-term themes from notes, journals, and
   snippets. Track narrative evolution across time. Proactively suggest
   themes when you notice patterns.

3. Memory Connections: Discover semantic connections between temporally
   distant entries. Use multi-signal discovery (keywords, tags, time,
   theme overlap) for candidate generation. Use graph traversal tools
   (shortest path, central nodes, narrative threads) to answer complex
   questions like "how are these two ideas connected?" or "what is the
   central theme in my recent thinking?"

4. Graph Analysis: Use memory_link_tool_graph to find:
   - Shortest path between two seemingly unrelated entries
   - Central/hub nodes that connect many disparate ideas
   - Narrative threads that chain across weeks/months
   - Bridge links that connect otherwise isolated clusters

5. Proactive Questioning: After presenting analysis, ask 1-2 follow-up
   questions to deepen the user's self-understanding. The goal is not
   to inform but to provoke reflection.
```

### 4.3 工具整合

修改 `src/main/agent/tools/toolRegistry.ts`：

- `AgentToolRegistryContext` 新增 `themesService` / `memoryLinksService`
- `builtinToolFactories` 新增 `themeTools` / `memoryLinkTools` factories

修改 `src/main/ipc/aiHandlers.ts`：

- `registerAiHandlers` 中创建 `themesService` / `memoryLinksService` 实例
- 注入到 `createAgentToolRegistry` 的 context
- 处理 `curation` agent 的工具过滤（非 curation agent 时排除策展工具）

### 4.4 ask tool 增强

修改 `src/main/agent/tools/askTool.ts`：

- 当模型发出 ask，且当前对话包含策展意图时 → 在 ask 文本中追加引导性提问
- ask 模板在策展路径下提供更结构化的选项（多选而非自由文本）

---

## 文件变更汇总

| 阶段        | 新文件 | 修改文件 | 关键风险 |
| ----------- | ------ | -------- | -------- |
| **Phase 1** | 2 (`weeklySummaryService`, `weeklyHandlers`) | 5 | 低 — 独立功能，不影响现有逻辑 |
| **Phase 2** | 5 (`themesService`, `themesHandlers`, `themeTool`, `themeDescriptionUpdater`, `ThemesPage`) | 7 | ✅ 已完成 — 含测试 `themesService.test.ts` |
| **Phase 3** | 3 (`memoryLinksService`, `memoryHandlers`, `memoryLinkTool`) | 8 | 中 — 多信号管线评分权重需调参；CTE 递归深度需限流 |
| **Phase 4** | 0 | 4 | 低 — 在已有 Agent 系统上扩展 |

**Phase 1-2 总计**：7 个新文件，约 12 个修改文件，2 个测试文件。
**Phase 3 扩展后**：3 个新文件，约 8 个修改文件，1 个测试文件，~1570 行代码（含 UI）。

---

## 风险与对策

| 风险 | 对策 |
|------|------|
| LLM 对中文策展的生成质量不稳定 | system prompt 中文示例 + temperature 调低 + 可选 re-generation |
| 多信号管线评分权重不合理 | 初始权重基于研究参考（关键词 0.35/标签 0.25/时间 0.20/主题 0.20），预留 `signalWeights` 可配置参数，用户反馈后调优 |
| CTE 递归图遍历性能随数据增长下降 | 限制递归深度 ≤ 6 跳 + `LIMIT` 子句 + 只在 `confirmed` 链接上遍历 + 可选 `maxDuration` 超时中断 |
| 批量发现在大数据库上耗时长 | 限制批处理范围（本周/本月）+ 每批上限 50 条 + 异步执行不阻塞主流程 |
| 跨类型回查源内容慢（JOIN 多表） | 候选管线内对每张表独立查询（非大 JOIN），仅取 `id, title, content` 三列，content 截断到 500 字 |
| 置信度衰减与用户预期不符 | `decayed` 状态不自动删除，仅降为低优先级显示；用户可手动 `reinforce` 恢复；衰减周期可配置（默认 30 天） |
| 数据库迁移（新增 `memory_links` 表） | `CREATE TABLE IF NOT EXISTS` 方式，不破坏现有数据 |
| 策展工具的确认逻辑影响 UX | 写操作保留确认机制，只读操作（suggest/discover/graph）直接执行 |

---

## 依赖关系图

```
Phase 1 (独立，无依赖)
  │
  ├──→ Phase 2 (独立，可并行) ✅
  │     │
  │     └──→ Phase 4 (依赖 Phase 2/3 的工具)
  │
  └──→ Phase 3 (独立，可并行) ← 扩展为三层架构
        │   Layer 1: 显式关联 CRUD
        │   Layer 2: 多信号智能发现 + 衰减
        │   Layer 3: CTE 图遍历 + 叙事线程
        │
        └──→ Phase 4
```

Phase 2 ✅ 已完成。Phase 3 三层架构可独立推进，Layer 1→2→3 顺序实现。

---
