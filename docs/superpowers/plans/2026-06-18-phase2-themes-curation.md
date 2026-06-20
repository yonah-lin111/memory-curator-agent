# Phase 2: 长期主题追踪（Themes Curation）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现长期主题追踪系统：用户手动定义 + AI 自动建议主题，将笔记/日记/片段关联到主题，追踪叙事演变；打通「周度总结 → 长期主题」闭环。

**Architecture:** 遵循现有 Electron + React + TypeScript + SQLite (Drizzle/sqlite3) 三层架构。新增 `themes` + `theme_items` 两张表 → `themesService` → IPC handler → preload → 前端 ThemesPage。Agent tool 层提供 6 个工具供 AI 对话使用。周度总结完成后自动触发主题提取。

**Tech Stack:** Electron, React 18, TypeScript, better-sqlite3 (raw SQL via `Database.prepare`), Tailwind CSS, lucide-react, echarts (可选，时间线视图)

---

## 文件结构

```
Create:
  src/main/services/themesService.ts        — 主题 CRUD + 提取 + 标签导入 + 时间线
  src/main/agent/tools/themeTool.ts         — 6 个 Agent tool
  src/main/ipc/themesHandlers.ts            — IPC handlers

Modify:
  src/main/db/schema.ts                     — 新增 themes/theme_items 表定义 + 类型导出
  src/main/db/index.ts                      — createThemesTable + createThemeItemsTable + initDatabase
  src/main/agent/tools/toolRegistry.ts      — 注册 themeTools
  src/main/agent/core/agentHints.ts         — 可选：注册 curation agent（Phase 4 前置）
  src/main/index.ts                         — registerThemesHandlers()
  src/main/ipc/weeklyHandlers.ts            — prompt 追加主题 JSON 输出（2.7）+ done 后提取（可选）
  src/preload/index.ts                      — window.api.themes
  src/renderer/src/env.d.ts                 — ThemeItem, ThemeItemsItem 等类型声明
  src/renderer/src/pages/themes/ThemesPage.tsx  — 完整重写
```

---

### Task 1: Schema — 数据库表定义与类型导出

**Files:**
- Modify: `src/main/db/schema.ts`

- [ ] **Step 1: 在 `src/main/db/schema.ts` 末尾新增 themes 和 theme_items 表定义及所有类型**

在第 618 行（`export const associatedPeople = sqliteTable(...)` 之前）插入以下代码：

```typescript
// ==================== Themes Curation (Phase 2) ====================

/** 主题数据库行类型 */
export type ThemeRow = {
  id: number
  external_id: string
  name: string
  description: string
  color: string | null
  status: string
  created_at: string
  updated_at: string
}

/** 主题页面使用类型 */
export type ThemeItem = {
  id: number
  externalId: string
  name: string
  description: string
  color: string | null
  status: string
  createdAt: string
  updatedAt: string
  /** 关联素材数量（JOIN 时填充） */
  itemCount?: number
}

/** 主题创建输入 */
export type ThemeCreateInput = {
  name: string
  description?: string
  color?: string | null
  status?: string
}

/** 主题更新输入 */
export type ThemeUpdateInput = {
  name?: string
  description?: string
  color?: string | null
  status?: string
}

/** 主题素材关联数据库行类型 */
export type ThemeItemRow = {
  id: number
  external_id: string
  theme_external_id: string
  source_type: string
  source_id: string
  relevance_note: string
  ai_extracted: number
  created_at: string
}

/** 主题素材关联页面使用类型 */
export type ThemeItemsItem = {
  id: number
  externalId: string
  themeExternalId: string
  sourceType: string
  sourceId: string
  relevanceNote: string
  aiExtracted: number
  createdAt: string
  /** JOIN 来源信息（用于前端展示） */
  sourceTitle?: string
  sourceContent?: string
  sourceEntryDate?: string
}

/** 主题素材关联创建输入 */
export type ThemeItemsCreateInput = {
  themeExternalId: string
  sourceType: string
  sourceId: string
  relevanceNote?: string
  aiExtracted?: number
}

/** 主题时间线节点 (跨周分布) */
export type ThemeTimelineItem = {
  /** 自然周起始日期 */
  weekStartDate: string
  /** 该周关联素材数 */
  itemCount: number
  /** 是否在周度总结中被提及 */
  mentionedInSummary: boolean
}

export const themes = sqliteTable("themes", {
  id: integer("id").primaryKey(),
  externalId: text("external_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: text("color"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const themeItems = sqliteTable(
  "theme_items",
  {
    id: integer("id").primaryKey(),
    externalId: text("external_id").notNull().unique(),
    themeExternalId: text("theme_external_id").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    relevanceNote: text("relevance_note").notNull().default(""),
    aiExtracted: integer("ai_extracted").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    unqThemeSource: unique("unq_theme_source").on(
      table.themeExternalId,
      table.sourceType,
      table.sourceId
    ),
  }),
);
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit src/main/db/schema.ts
```

Expected: 无类型错误。

---

### Task 2: Database — 建表与初始化注册

**Files:**
- Modify: `src/main/db/index.ts`

- [ ] **Step 1: 在 `src/main/db/index.ts` 末尾的 `initDatabase` 之前，添加两个建表函数**

```typescript
/**
 * 创建 themes 表。
 */
export const createThemesTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS themes (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      color TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_themes_status
    ON themes(status);

    CREATE INDEX IF NOT EXISTS idx_themes_updated_at
    ON themes(updated_at DESC);
  `)
}

/**
 * 创建 theme_items 表。
 */
export const createThemeItemsTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS theme_items (
      id INTEGER PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      theme_external_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      relevance_note TEXT NOT NULL DEFAULT '',
      ai_extracted INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL,
      UNIQUE(theme_external_id, source_type, source_id)
    );

    CREATE INDEX IF NOT EXISTS idx_theme_items_theme
    ON theme_items(theme_external_id);

    CREATE INDEX IF NOT EXISTS idx_theme_items_source
    ON theme_items(source_type, source_id);
  `)
}
```

- [ ] **Step 2: 在 `initDatabase` 函数内（第 820 行附近）注册建表调用**

在 `createWeeklySummariesTable(database)` 之后添加：

```typescript
  createThemesTable(database)
  createThemeItemsTable(database)
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit src/main/db/index.ts
```

---

### Task 3: Service — themesService.ts

**Files:**
- Create: `src/main/services/themesService.ts`

- [ ] **Step 1: 创建 `src/main/services/themesService.ts`**

```typescript
import type {
  ThemeCreateInput,
  ThemeItem,
  ThemeItemsCreateInput,
  ThemeItemsItem,
  ThemeItemRow,
  ThemeRow,
  ThemeUpdateInput,
  ThemeTimelineItem,
} from "@/db/schema";
import { createCompactUuid } from "@/id";

/** 数据库语句接口 */
type Statement = {
  all: (...values: unknown[]) => unknown[];
  get: (...values: unknown[]) => unknown;
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown;
};

export type DatabaseConnection = {
  prepare: (sql: string) => Statement;
};

/** 主题服务方法集合 */
export type ThemesService = {
  list: (status?: string) => ThemeItem[];
  getByExternalId: (id: string) => ThemeItem | null;
  create: (input: ThemeCreateInput) => ThemeItem;
  update: (id: string, input: ThemeUpdateInput) => ThemeItem;
  delete: (id: string) => void;

  addItem: (input: ThemeItemsCreateInput) => ThemeItemsItem;
  removeItem: (themeExternalId: string, sourceType: string, sourceId: string) => void;
  listItems: (themeExternalId: string) => ThemeItemsItem[];
  getItemCount: (themeExternalId: string) => number;

  /** 批量从片段标签创建主题 */
  batchCreateFromTags: (tags: string[]) => ThemeItem[];
  /** 从周度总结全文解析并 upsert 主题建议 */
  extractThemesFromSummary: (summaryContent: string, summaryId: number) => number;
  /** 获取某主题的跨周分布时间线 */
  getTimeline: (themeExternalId: string) => ThemeTimelineItem[];

  querySql: (sql: string) => unknown[];
};

/** 生成当前时间戳 */
const createTimestamp = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

/** 数据库行 -> 页面主题 */
const mapThemeRow = (row: ThemeRow): ThemeItem => ({
  id: row.id,
  externalId: row.external_id,
  name: row.name,
  description: row.description,
  color: row.color,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** 数据库行 -> 页面关联项 */
const mapThemeItemRow = (row: ThemeItemRow & {
  source_title?: string;
  source_content?: string;
  source_entry_date?: string;
}): ThemeItemsItem => ({
  id: row.id,
  externalId: row.external_id,
  themeExternalId: row.theme_external_id,
  sourceType: row.source_type,
  sourceId: row.source_id,
  relevanceNote: row.relevance_note,
  aiExtracted: row.ai_extracted,
  createdAt: row.created_at,
  sourceTitle: row.source_title,
  sourceContent: row.source_content,
  sourceEntryDate: row.source_entry_date,
});

/** 提取 SQLite 自增主键 */
const readLastInsertId = (result: unknown): number =>
  Number(
    result &&
    typeof result === "object" &&
    "lastInsertRowid" in result
      ? result.lastInsertRowid
      : 0
  );

/**
 * 创建 Themes 服务。
 */
export const createThemesService = (database: DatabaseConnection): ThemesService => ({
  list: (status) => {
    const sql = status
      ? `SELECT t.*, (SELECT COUNT(*) FROM theme_items ti WHERE ti.theme_external_id = t.external_id) AS item_count FROM themes t WHERE t.status = ? ORDER BY t.updated_at DESC`
      : `SELECT t.*, (SELECT COUNT(*) FROM theme_items ti WHERE ti.theme_external_id = t.external_id) AS item_count FROM themes t ORDER BY t.updated_at DESC`;
    const rows = database.prepare(sql).all(...(status ? [status] : [])) as (ThemeRow & { item_count?: number })[];
    return rows.map((row) => {
      const item = mapThemeRow(row as ThemeRow);
      item.itemCount = row.item_count ?? 0;
      return item;
    });
  },

  getByExternalId: (id) => {
    const row = database
      .prepare("SELECT * FROM themes WHERE external_id = ?")
      .get(id) as ThemeRow | undefined;
    return row ? mapThemeRow(row) : null;
  },

  create: (input) => {
    if (!input.name.trim()) throw new Error("主题名称不能为空");
    const timestamp = createTimestamp();
    const externalId = createCompactUuid();
    database
      .prepare(
        `INSERT INTO themes (external_id, name, description, color, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        externalId,
        input.name.trim(),
        input.description?.trim() ?? "",
        input.color ?? null,
        input.status ?? "active",
        timestamp,
        timestamp
      );
    const row = database
      .prepare("SELECT * FROM themes WHERE external_id = ?")
      .get(externalId) as ThemeRow;
    return mapThemeRow(row);
  },

  update: (id, input) => {
    const existing = database
      .prepare("SELECT * FROM themes WHERE external_id = ?")
      .get(id) as ThemeRow | undefined;
    if (!existing) throw new Error("主题不存在");
    const timestamp = createTimestamp();
    database
      .prepare(
        `UPDATE themes SET name = ?, description = ?, color = ?, status = ?, updated_at = ? WHERE external_id = ?`
      )
      .run(
        input.name?.trim() ?? existing.name,
        input.description?.trim() ?? existing.description,
        input.color !== undefined ? input.color : existing.color,
        input.status ?? existing.status,
        timestamp,
        id
      );
    const row = database
      .prepare("SELECT * FROM themes WHERE external_id = ?")
      .get(id) as ThemeRow;
    return mapThemeRow(row);
  },

  delete: (id) => {
    database.prepare("DELETE FROM theme_items WHERE theme_external_id = ?").run(id);
    database.prepare("DELETE FROM themes WHERE external_id = ?").run(id);
  },

  addItem: (input) => {
    const timestamp = createTimestamp();
    const externalId = createCompactUuid();
    database
      .prepare(
        `INSERT INTO theme_items (external_id, theme_external_id, source_type, source_id, relevance_note, ai_extracted, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(theme_external_id, source_type, source_id) DO UPDATE SET
           relevance_note = excluded.relevance_note,
           ai_extracted = excluded.ai_extracted`
      )
      .run(
        externalId,
        input.themeExternalId,
        input.sourceType,
        input.sourceId,
        input.relevanceNote ?? "",
        input.aiExtracted ?? 0,
        timestamp
      );
    const row = database
      .prepare("SELECT * FROM theme_items WHERE external_id = ?")
      .get(externalId) as ThemeItemRow;
    return mapThemeItemRow(row);
  },

  removeItem: (themeExternalId, sourceType, sourceId) => {
    database
      .prepare(
        "DELETE FROM theme_items WHERE theme_external_id = ? AND source_type = ? AND source_id = ?"
      )
      .run(themeExternalId, sourceType, sourceId);
  },

  listItems: (themeExternalId) => {
    const sql = `
      SELECT ti.*,
        CASE ti.source_type
          WHEN 'snippet' THEN (SELECT title FROM snippets WHERE id = CAST(ti.source_id AS INTEGER))
          WHEN 'journal' THEN (SELECT '日记 ' || entry_date FROM journals WHERE id = CAST(ti.source_id AS INTEGER))
          WHEN 'note' THEN (SELECT title FROM notes WHERE id = CAST(ti.source_id AS INTEGER))
          ELSE NULL
        END AS source_title,
        CASE ti.source_type
          WHEN 'snippet' THEN (SELECT content FROM snippets WHERE id = CAST(ti.source_id AS INTEGER))
          WHEN 'journal' THEN (SELECT content FROM journals WHERE id = CAST(ti.source_id AS INTEGER))
          WHEN 'note' THEN (SELECT content FROM notes WHERE id = CAST(ti.source_id AS INTEGER))
          ELSE NULL
        END AS source_content,
        CASE ti.source_type
          WHEN 'snippet' THEN (SELECT entry_date FROM snippets WHERE id = CAST(ti.source_id AS INTEGER))
          WHEN 'journal' THEN (SELECT entry_date FROM journals WHERE id = CAST(ti.source_id AS INTEGER))
          ELSE NULL
        END AS source_entry_date
      FROM theme_items ti
      WHERE ti.theme_external_id = ?
      ORDER BY ti.created_at DESC
    `;
    const rows = database.prepare(sql).all(themeExternalId) as (ThemeItemRow & {
      source_title?: string;
      source_content?: string;
      source_entry_date?: string;
    })[];
    return rows.map(mapThemeItemRow);
  },

  getItemCount: (themeExternalId) => {
    const row = database
      .prepare("SELECT COUNT(*) AS cnt FROM theme_items WHERE theme_external_id = ?")
      .get(themeExternalId) as { cnt?: number } | undefined;
    return row?.cnt ?? 0;
  },

  batchCreateFromTags: (tags) => {
    const created: ThemeItem[] = [];
    const timestamp = createTimestamp();
    for (const tag of tags) {
      const trimmed = tag.trim();
      if (!trimmed) continue;
      const exists = database
        .prepare("SELECT external_id FROM themes WHERE name = ?")
        .get(trimmed) as { external_id?: string } | undefined;
      if (exists?.external_id) continue;
      const externalId = createCompactUuid();
      database
        .prepare(
          `INSERT INTO themes (external_id, name, description, color, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(externalId, trimmed, `从 #${trimmed} 标签导入`, null, "active", timestamp, timestamp);
      const row = database
        .prepare("SELECT * FROM themes WHERE external_id = ?")
        .get(externalId) as ThemeRow;
      created.push(mapThemeRow(row));
    }
    return created;
  },

  extractThemesFromSummary: (summaryContent, summaryId) => {
    // 正则匹配 "## 主题建议" 后的 JSON 区块
    const sectionMatch = summaryContent.match(/##\s*主题建议\s*\n+([\s\S]*?)$/);
    if (!sectionMatch) return 0;

    const jsonBlock = sectionMatch[1].trim();
    let themes: Array<{ name: string; confidence: number; evidence: string; relatedSection: string }> = [];
    try {
      const parsed = JSON.parse(jsonBlock);
      themes = Array.isArray(parsed) ? parsed : [];
    } catch {
      // 尝试逐行解析
      const lines = jsonBlock.split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const obj = JSON.parse(line.trim());
          if (obj.name) themes.push(obj);
        } catch { /* skip */ }
      }
    }
    if (!themes.length) return 0;

    const timestamp = createTimestamp();
    let count = 0;
    for (const theme of themes) {
      if (!theme.name?.trim()) continue;
      // 模糊匹配已有主题
      const existing = database
        .prepare("SELECT external_id FROM themes WHERE name LIKE ?")
        .get(`%${theme.name.trim()}%`) as { external_id?: string } | undefined;

      let themeExternalId: string;
      if (existing?.external_id) {
        // 更新已有主题时间
        database
          .prepare("UPDATE themes SET updated_at = ? WHERE external_id = ?")
          .run(timestamp, existing.external_id);
        themeExternalId = existing.external_id;
      } else {
        // 创建新主题
        themeExternalId = createCompactUuid();
        database
          .prepare(
            `INSERT INTO themes (external_id, name, description, color, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            themeExternalId,
            theme.name.trim(),
            theme.evidence?.slice(0, 200) ?? "",
            null,
            "active",
            timestamp,
            timestamp
          );
      }

      // 创建关联到本周总结
      const itemExternalId = createCompactUuid();
      database
        .prepare(
          `INSERT INTO theme_items (external_id, theme_external_id, source_type, source_id, relevance_note, ai_extracted, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(theme_external_id, source_type, source_id) DO NOTHING`
        )
        .run(
          itemExternalId,
          themeExternalId,
          "weekly_summary",
          String(summaryId),
          theme.evidence?.slice(0, 200) ?? "",
          1,
          timestamp
        );
      count++;
    }
    return count;
  },

  getTimeline: (themeExternalId) => {
    const sql = `
      SELECT
        strftime('%Y-%m-%d', ti.created_at, 'weekday 1', '-6 days') AS week_start_date,
        COUNT(*) AS item_count,
        MAX(CASE WHEN ti.source_type = 'weekly_summary' THEN 1 ELSE 0 END) AS mentioned_in_summary
      FROM theme_items ti
      WHERE ti.theme_external_id = ?
      GROUP BY week_start_date
      ORDER BY week_start_date ASC
    `;
    const rows = database.prepare(sql).all(themeExternalId) as Array<{
      week_start_date: string;
      item_count: number;
      mentioned_in_summary: number;
    }>;
    return rows.map((r) => ({
      weekStartDate: r.week_start_date,
      itemCount: r.item_count,
      mentionedInSummary: r.mentioned_in_summary === 1,
    }));
  },

  querySql: (sql) => database.prepare(sql).all(),
});
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit src/main/services/themesService.ts
```

---

### Task 4: Agent Tool — themeTool.ts

**Files:**
- Create: `src/main/agent/tools/themeTool.ts`

- [ ] **Step 1: 创建 `src/main/agent/tools/themeTool.ts`**

```typescript
import type { AgentTool } from "@/agent/types";
import type { ThemesService } from "@/services/themesService";

/** 校验 SQL 只读 */
const CHECK_SQL_READONLY = /^(SELECT|WITH|EXPLAIN|PRAGMA)\b/i;

/**
 * 创建主题策展相关 Agent 工具集。
 */
export const createThemeTools = (
  themesService: ThemesService,
  confirmWrite: (toolName: string, summary: string) => Promise<boolean>
): AgentTool[] => [
  {
    name: "theme_tool_query",
    description: "查询当前所有主题及其关联，支持 SQL 查询。列出所有主题、某主题的所有关联素材、或执行自定义只读 SQL。",
    prompt: {
      summary: "查询主题与关联数据，获取跨周/跨类型素材对应的叙事聚合信息。",
      whenToUse: [
        "用户询问已有主题有哪些",
        "用户想知道某主题下有哪些关联素材",
        "用户要求统计主题分布",
        "需要执行复杂查询分析主题趋势"
      ],
      safety: ["仅执行只读 SELECT/WITH/EXPLAIN/PRAGMA 查询"],
      examples: [
        '用户: "我有哪些主题？" → theme_tool_query({ action: "list_themes" })',
        '用户: "职业转型这个主题下有什么？" → theme_tool_query({ action: "list_items", themeExternalId: "xxx" })',
        '用户: "本周哪个主题被提及最多？" → theme_tool_query({ action: "sql", sql: "SELECT ..." })'
      ],
    },
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list_themes", "list_items", "sql"],
          description: "操作类型：list_themes 列出所有主题，list_items 列出某主题的关联，sql 执行自定义只读查询"
        },
        themeExternalId: {
          type: "string",
          description: "主题 external_id，list_items 时必填"
        },
        sql: {
          type: "string",
          description: "SQL 查询语句，仅支持 SELECT/WITH/EXPLAIN/PRAGMA，action=sql 时必填"
        },
        status: {
          type: "string",
          enum: ["active", "archived"],
          description: "筛选主题状态，action=list_themes 时可选"
        }
      },
      required: ["action"]
    },
    execute: async (input) => {
      const args = input as {
        action: string;
        themeExternalId?: string;
        sql?: string;
        status?: string;
      };
      if (args.action === "list_themes") {
        const themes = themesService.list(args.status);
        return {
          observation: themes.length
            ? themes.map((t) => `- ${t.name} (${t.status}, ${t.itemCount ?? 0}项关联): ${t.description || "无描述"}`).join("\n")
            : "当前没有任何主题。",
          data: themes,
        };
      }
      if (args.action === "list_items") {
        if (!args.themeExternalId) {
          return { observation: "请指定 themeExternalId", data: null };
        }
        const items = themesService.listItems(args.themeExternalId);
        return {
          observation: items.length
            ? items.map((i) => `- [${i.sourceType}] ${i.sourceTitle ?? "无标题"}` + (i.relevanceNote ? `: ${i.relevanceNote}` : "")).join("\n")
            : "该主题下没有关联素材。",
          data: items,
        };
      }
      if (args.action === "sql") {
        if (!args.sql) {
          return { observation: "请提供 SQL 查询语句", data: null };
        }
        if (!CHECK_SQL_READONLY.test(args.sql.trim())) {
          return { observation: "仅允许只读查询（SELECT/WITH/EXPLAIN/PRAGMA）", data: null };
        }
        try {
          const rows = themesService.querySql(args.sql);
          return {
            observation: rows.length > 20
              ? `查询返回 ${rows.length} 行，前 20 行：\n${JSON.stringify(rows.slice(0, 20), null, 2)}`
              : JSON.stringify(rows, null, 2),
            data: rows,
          };
        } catch (err) {
          return { observation: `查询失败: ${String(err)}`, data: null };
        }
      }
      return { observation: "未知操作", data: null };
    },
  },
  {
    name: "theme_tool_add",
    description: "创建一个新的长期主题。创建前会请求用户确认。",
    confirmation: {
      requireConfirmation: true,
      autoDenyWhen: "用户明确拒绝创建该主题或主题名称已被使用",
    },
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "主题名称，如「职业转型」「亲密关系」" },
        description: { type: "string", description: "主题描述" },
        color: { type: "string", description: "可选 hex 颜色" },
      },
      required: ["name"],
    },
    execute: async (input) => {
      const args = input as { name: string; description?: string; color?: string };
      const theme = themesService.create({ name: args.name, description: args.description, color: args.color });
      return {
        observation: `已创建主题「${theme.name}」`,
        data: theme,
      };
    },
  },
  {
    name: "theme_tool_update",
    description: "更新已有主题的名称、描述、状态或颜色。更新前会请求用户确认。",
    confirmation: {
      requireConfirmation: true,
      autoDenyWhen: "用户明确拒绝修改",
    },
    parameters: {
      type: "object",
      properties: {
        themeExternalId: { type: "string", description: "主题 external_id" },
        name: { type: "string", description: "新名称" },
        description: { type: "string", description: "新描述" },
        status: { type: "string", enum: ["active", "archived"], description: "新状态" },
        color: { type: "string", description: "新颜色" },
      },
      required: ["themeExternalId"],
    },
    execute: async (input) => {
      const args = input as {
        themeExternalId: string;
        name?: string;
        description?: string;
        status?: string;
        color?: string;
      };
      const theme = themesService.update(args.themeExternalId, {
        name: args.name,
        description: args.description,
        status: args.status,
        color: args.color,
      });
      return { observation: `已更新主题「${theme.name}」`, data: theme };
    },
  },
  {
    name: "theme_tool_delete",
    description: "删除一个主题及其所有关联。删除前会请求用户二次确认。",
    confirmation: {
      requireConfirmation: true,
      autoDenyWhen: "用户明确拒绝删除",
    },
    parameters: {
      type: "object",
      properties: {
        themeExternalId: { type: "string", description: "要删除的主题 external_id" },
      },
      required: ["themeExternalId"],
    },
    execute: async (input) => {
      const args = input as { themeExternalId: string };
      const existing = themesService.getByExternalId(args.themeExternalId);
      if (!existing) return { observation: "主题不存在", data: null };
      themesService.delete(args.themeExternalId);
      return { observation: `已删除主题「${existing.name}」及其所有关联`, data: null };
    },
  },
  {
    name: "theme_tool_item_add",
    description: "将一篇素材（笔记、日记、片段）关联到指定主题。关联前会请求用户确认。",
    confirmation: {
      requireConfirmation: true,
      autoDenyWhen: "用户明确拒绝关联",
    },
    parameters: {
      type: "object",
      properties: {
        themeExternalId: { type: "string", description: "目标主题 external_id" },
        sourceType: { type: "string", enum: ["note", "journal", "snippet"], description: "素材类型" },
        sourceId: { type: "string", description: "素材 ID（数字字符串）" },
        relevanceNote: { type: "string", description: "AI 生成的关联说明" },
      },
      required: ["themeExternalId", "sourceType", "sourceId"],
    },
    execute: async (input) => {
      const args = input as {
        themeExternalId: string;
        sourceType: string;
        sourceId: string;
        relevanceNote?: string;
      };
      const theme = themesService.getByExternalId(args.themeExternalId);
      if (!theme) return { observation: "主题不存在", data: null };
      const item = themesService.addItem({
        themeExternalId: args.themeExternalId,
        sourceType: args.sourceType,
        sourceId: args.sourceId,
        relevanceNote: args.relevanceNote ?? "",
        aiExtracted: 1,
      });
      return {
        observation: `已将 [${item.sourceType}] 素材关联到主题「${theme.name}」`,
        data: item,
      };
    },
  },
  {
    name: "theme_tool_item_remove",
    description: "解除某篇素材与主题的关联。操作前会请求用户确认。",
    confirmation: {
      requireConfirmation: true,
      autoDenyWhen: "用户明确拒绝解除关联",
    },
    parameters: {
      type: "object",
      properties: {
        themeExternalId: { type: "string", description: "主题 external_id" },
        sourceType: { type: "string", enum: ["note", "journal", "snippet", "weekly_summary"], description: "素材类型" },
        sourceId: { type: "string", description: "素材 ID" },
      },
      required: ["themeExternalId", "sourceType", "sourceId"],
    },
    execute: async (input) => {
      const args = input as {
        themeExternalId: string;
        sourceType: string;
        sourceId: string;
      };
      themesService.removeItem(args.themeExternalId, args.sourceType, args.sourceId);
      return { observation: "已解除关联", data: null };
    },
  },
];
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit src/main/agent/tools/themeTool.ts
```

---

### Task 5: IPC — themesHandlers.ts

**Files:**
- Create: `src/main/ipc/themesHandlers.ts`

- [ ] **Step 1: 创建 `src/main/ipc/themesHandlers.ts`**

```typescript
import { ipcMain } from "electron";
import { getDatabase } from "@/db";
import type { DatabaseConnection } from "@/services/themesService";
import { createThemesService } from "@/services/themesService";
import type { ThemeCreateInput, ThemeItemsCreateInput, ThemeUpdateInput } from "@/db/schema";

/**
 * 注册主题 IPC 处理器。
 */
export const registerThemesHandlers = (): void => {
  const database = getDatabase();
  const themesService = createThemesService(database as unknown as DatabaseConnection);

  ipcMain.handle("themes:list", (_, status?: string) => themesService.list(status));

  ipcMain.handle("themes:get", (_, externalId: string) =>
    themesService.getByExternalId(externalId)
  );

  ipcMain.handle("themes:create", (_, input: ThemeCreateInput) =>
    themesService.create(input)
  );

  ipcMain.handle("themes:update", (_, externalId: string, input: ThemeUpdateInput) =>
    themesService.update(externalId, input)
  );

  ipcMain.handle("themes:delete", (_, externalId: string) => {
    themesService.delete(externalId);
  });

  ipcMain.handle("themes:items:list", (_, themeExternalId: string) =>
    themesService.listItems(themeExternalId)
  );

  ipcMain.handle("themes:items:add", (_, input: ThemeItemsCreateInput) =>
    themesService.addItem(input)
  );

  ipcMain.handle(
    "themes:items:remove",
    (_, themeExternalId: string, sourceType: string, sourceId: string) => {
      themesService.removeItem(themeExternalId, sourceType, sourceId);
    }
  );

  ipcMain.handle("themes:import-from-tags", (_, tags: string[]) =>
    themesService.batchCreateFromTags(tags)
  );

  ipcMain.handle("themes:timeline", (_, themeExternalId: string) =>
    themesService.getTimeline(themeExternalId)
  );
};
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit src/main/ipc/themesHandlers.ts
```

---

### Task 6: Registration — main/index.ts + toolRegistry.ts

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/agent/tools/toolRegistry.ts`

- [ ] **Step 1: 在 `src/main/index.ts` 注册 themesHandlers**

在第 13 行 `import { registerWeeklyHandlers } from '@/ipc/weeklyHandlers'` 后添加：

```typescript
import { registerThemesHandlers } from '@/ipc/themesHandlers'
```

在 `app.whenReady()` 回调中（第 65 行 `registerWeeklyHandlers()` 后）添加：

```typescript
  registerThemesHandlers()
```

- [ ] **Step 2: 在 `src/main/agent/tools/toolRegistry.ts` 注册 themeTools**

需要查看当前 toolRegistry 的具体结构来插入，搜索位置后依现有模式添加 themeTools。基本模式：

```typescript
import { createThemeTools } from "@/agent/tools/themeTool";
```

在 `builtinToolFactories` 中注册。在 `AgentToolRegistryContext` 中添加 `themesService` 字段。

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit
```

---

### Task 7: Preload + Type Declarations — 前端 API 暴露

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`

- [ ] **Step 1: 在 `src/renderer/src/env.d.ts` 的 `AppAPI` 类型中添加 themes 类型**

在 `weekly?: { ... }` 后（第 845 行附近）添加：

```typescript
  /** 主题追踪 API */
  themes?: {
    /** 列出所有主题 */
    list: (status?: string) => Promise<ThemeItem[]>
    /** 获取单个主题 */
    get: (externalId: string) => Promise<ThemeItem | null>
    /** 创建主题 */
    create: (input: ThemeCreateInput) => Promise<ThemeItem>
    /** 更新主题 */
    update: (externalId: string, input: ThemeUpdateInput) => Promise<ThemeItem>
    /** 删除主题 */
    delete: (externalId: string) => Promise<void>
    /** 获取某主题的所有关联素材 */
    listItems: (themeExternalId: string) => Promise<ThemeItemsItem[]>
    /** 添加主题素材关联 */
    addItem: (input: ThemeItemsCreateInput) => Promise<ThemeItemsItem>
    /** 移除主题素材关联 */
    removeItem: (themeExternalId: string, sourceType: string, sourceId: string) => Promise<void>
    /** 从标签批量导入主题种子 */
    importFromTags: (tags: string[]) => Promise<ThemeItem[]>
    /** 获取某主题跨周时间线 */
    timeline: (themeExternalId: string) => Promise<ThemeTimelineItem[]>
  }
```

并在文件顶部附近添加新的类型声明（与其他类型声明并列）：

```typescript
/** 主题项 */
type ThemeItem = {
  id: number
  externalId: string
  name: string
  description: string
  color: string | null
  status: string
  createdAt: string
  updatedAt: string
  itemCount?: number
}

/** 主题创建输入 */
type ThemeCreateInput = {
  name: string
  description?: string
  color?: string | null
  status?: string
}

/** 主题更新输入 */
type ThemeUpdateInput = {
  name?: string
  description?: string
  color?: string | null
  status?: string
}

/** 主题素材关联项 */
type ThemeItemsItem = {
  id: number
  externalId: string
  themeExternalId: string
  sourceType: string
  sourceId: string
  relevanceNote: string
  aiExtracted: number
  createdAt: string
  sourceTitle?: string
  sourceContent?: string
  sourceEntryDate?: string
}

/** 主题素材关联创建输入 */
type ThemeItemsCreateInput = {
  themeExternalId: string
  sourceType: string
  sourceId: string
  relevanceNote?: string
  aiExtracted?: number
}

/** 主题时间线节点 */
type ThemeTimelineItem = {
  weekStartDate: string
  itemCount: number
  mentionedInSummary: boolean
}
```

- [ ] **Step 2: 在 `src/preload/index.ts` 中添加 themes API**

在 `weekly: { ... }` 后（第 720 行附近 `})` 闭合前）添加：

```typescript
    themes: {
      list: (status?: string): Promise<ThemeItem[]> =>
        ipcRenderer.invoke('themes:list', status),
      get: (externalId: string): Promise<ThemeItem | null> =>
        ipcRenderer.invoke('themes:get', externalId),
      create: (input: ThemeCreateInput): Promise<ThemeItem> =>
        ipcRenderer.invoke('themes:create', input),
      update: (externalId: string, input: ThemeUpdateInput): Promise<ThemeItem> =>
        ipcRenderer.invoke('themes:update', externalId, input),
      delete: (externalId: string): Promise<void> =>
        ipcRenderer.invoke('themes:delete', externalId),
      listItems: (themeExternalId: string): Promise<ThemeItemsItem[]> =>
        ipcRenderer.invoke('themes:items:list', themeExternalId),
      addItem: (input: ThemeItemsCreateInput): Promise<ThemeItemsItem> =>
        ipcRenderer.invoke('themes:items:add', input),
      removeItem: (themeExternalId: string, sourceType: string, sourceId: string): Promise<void> =>
        ipcRenderer.invoke('themes:items:remove', themeExternalId, sourceType, sourceId),
      importFromTags: (tags: string[]): Promise<ThemeItem[]> =>
        ipcRenderer.invoke('themes:import-from-tags', tags),
      timeline: (themeExternalId: string): Promise<ThemeTimelineItem[]> =>
        ipcRenderer.invoke('themes:timeline', themeExternalId),
    },
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit
```

---

### Task 8: UI — ThemesPage.tsx 完整重写

**Files:**
- Modify: `src/renderer/src/pages/themes/ThemesPage.tsx`

这是最大的任务。页面布局参考 `WeeklyReviewPage.tsx`（`bg-[#000000]`、`rounded-[6px]`、`border-white/5`、`bg-[#212121]` 卡片风格），采用 **双侧分栏** 布局：

- **左侧 (w-72)**：主题列表 → 卡片式，可新建/编辑/删除/归档
- **右侧 (flex-1)**：选中主题后的详情面板 → 基本信息 + 关联素材列表 + 时间线（可选）

- [ ] **Step 1: 创建完整的 ThemesPage 组件**

```typescript
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  FileText,
  Bookmark,
  Calendar,
  Hash,
  ChevronRight,
  Clock,
  Download,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { IconButton } from "@/components/ui/IconButton";
import { Tag } from "@/components/ui/Tag";

/** 主题项类型（与 preload 对齐） */
type ThemeItem = {
  id: number;
  externalId: string;
  name: string;
  description: string;
  color: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
};

/** 主题关联素材类型 */
type ThemeItemsItem = {
  id: number;
  externalId: string;
  themeExternalId: string;
  sourceType: string;
  sourceId: string;
  relevanceNote: string;
  aiExtracted: number;
  createdAt: string;
  sourceTitle?: string;
  sourceContent?: string;
  sourceEntryDate?: string;
};

/** 主题时间线节点 */
type ThemeTimelineItem = {
  weekStartDate: string;
  itemCount: number;
  mentionedInSummary: boolean;
};

/** 素材类型图标映射 */
const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  note: FileText,
  journal: Bookmark,
  snippet: Hash,
};

/** 素材类型中文映射 */
const SOURCE_LABELS: Record<string, string> = {
  note: "笔记",
  journal: "日记",
  snippet: "片段",
  weekly_summary: "周度总结",
};

/**
 * ThemesPage - 长期主题追踪页面。
 * 左侧主题列表 + 右侧详情面板，支持新建/编辑/删除/归档/从标签导入。
 */
export const ThemesPage = (): React.JSX.Element => {
  const toast = useToast();

  const [themes, setThemes] = useState<ThemeItem[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [items, setItems] = useState<ThemeItemsItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [timeline, setTimeline] = useState<ThemeTimelineItem[]>([]);

  // 创建/编辑弹窗状态
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ThemeItem | null>(null);
  const [editorName, setEditorName] = useState("");
  const [editorDesc, setEditorDesc] = useState("");
  const [editorSaving, setEditorSaving] = useState(false);

  /** 加载主题列表 */
  const loadThemes = async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (window.api?.themes) {
        const list = await window.api.themes.list();
        setThemes(list);
      }
    } catch {
      toast.error("加载主题列表失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadThemes();
  }, []);

  /** 加载选中主题的关联素材 */
  useEffect(() => {
    if (!selectedThemeId || !window.api?.themes) return;
    setItemsLoading(true);
    Promise.all([
      window.api.themes.listItems(selectedThemeId),
      window.api.themes.timeline(selectedThemeId),
    ])
      .then(([itemsResult, timelineResult]) => {
        setItems(itemsResult);
        setTimeline(timelineResult);
      })
      .catch(() => toast.error("加载主题详情失败"))
      .finally(() => setItemsLoading(false));
  }, [selectedThemeId]);

  const selectedTheme = useMemo(
    () => themes.find((t) => t.externalId === selectedThemeId) ?? null,
    [themes, selectedThemeId]
  );

  const activeThemes = useMemo(
    () => themes.filter((t) => t.status === "active"),
    [themes]
  );
  const archivedThemes = useMemo(
    () => themes.filter((t) => t.status === "archived"),
    [themes]
  );

  /** 新建主题 */
  const openCreateEditor = (): void => {
    setEditTarget(null);
    setEditorName("");
    setEditorDesc("");
    setIsEditorOpen(true);
  };

  /** 编辑主题 */
  const openEditEditor = (theme: ThemeItem): void => {
    setEditTarget(theme);
    setEditorName(theme.name);
    setEditorDesc(theme.description);
    setIsEditorOpen(true);
  };

  /** 保存主题（创建/更新） */
  const handleSaveTheme = async (): Promise<void> => {
    if (!editorName.trim()) {
      toast.error("主题名称不能为空");
      return;
    }
    setEditorSaving(true);
    try {
      if (!window.api?.themes) return;
      if (editTarget) {
        await window.api.themes.update(editTarget.externalId, {
          name: editorName.trim(),
          description: editorDesc.trim(),
        });
        toast.success("主题已更新");
      } else {
        await window.api.themes.create({
          name: editorName.trim(),
          description: editorDesc.trim(),
        });
        toast.success("主题已创建");
      }
      setIsEditorOpen(false);
      await loadThemes();
    } catch {
      toast.error("保存主题失败");
    } finally {
      setEditorSaving(false);
    }
  };

  /** 删除主题 */
  const handleDeleteTheme = async (theme: ThemeItem): Promise<void> => {
    if (!confirm(`确定删除主题「${theme.name}」及其所有关联？`)) return;
    try {
      if (!window.api?.themes) return;
      await window.api.themes.delete(theme.externalId);
      if (selectedThemeId === theme.externalId) setSelectedThemeId(null);
      toast.success(`已删除「${theme.name}」`);
      await loadThemes();
    } catch {
      toast.error("删除主题失败");
    }
  };

  /** 归档/恢复主题 */
  const handleToggleArchive = async (theme: ThemeItem): Promise<void> => {
    const newStatus = theme.status === "active" ? "archived" : "active";
    try {
      if (!window.api?.themes) return;
      await window.api.themes.update(theme.externalId, { status: newStatus });
      await loadThemes();
      toast.success(newStatus === "archived" ? "已归档" : "已恢复");
    } catch {
      toast.error("操作失败");
    }
  };

  /** 从标签导入主题种子 */
  const handleImportFromTags = async (): Promise<void> => {
    // 聚合所有时段的片段标签（简化：从已知主题名取反向）
    const existingNames = new Set(themes.map((t) => t.name));
    const prompt = window.prompt("输入要导入的标签（逗号分隔）：");
    if (!prompt?.trim()) return;
    const tags = prompt.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean);
    const newTags = tags.filter((t) => !existingNames.has(t));
    if (!newTags.length) {
      toast.error("所有标签已作为主题存在");
      return;
    }
    try {
      if (!window.api?.themes) return;
      const created = await window.api.themes.importFromTags(newTags);
      toast.success(`已导入 ${created.length} 个标签为主题`);
      await loadThemes();
    } catch {
      toast.error("导入失败");
    }
  };

  /** 解除关联 */
  const handleRemoveItem = async (item: ThemeItemsItem): Promise<void> => {
    if (!selectedThemeId || !window.api?.themes) return;
    try {
      await window.api.themes.removeItem(selectedThemeId, item.sourceType, item.sourceId);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("已解除关联");
    } catch {
      toast.error("操作失败");
    }
  };

  return (
    <div
      aria-label="Themes Page"
      className="w-full h-full bg-[#000000] overflow-y-auto custom-scrollbar py-4 px-1 lg:px-2 [scrollbar-gutter:stable] flex flex-col text-sm"
    >
      {/* 页面标题 */}
      <div className="flex-shrink-0 mb-4 flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-white/60" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
            主题策展
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            preset="add"
            iconOnly={false}
            size="small"
            onClick={openCreateEditor}
            className="text-white/45 hover:bg-white/[0.04] hover:text-white"
          >
            <span className="text-xs">新建主题</span>
          </IconButton>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* 左侧：主题列表 */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1">
          {isLoading ? (
            <div className="text-xs text-white/30 font-mono py-8 text-center">
              加载中...
            </div>
          ) : themes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Layers className="h-8 w-8 text-white/10" />
              <p className="text-xs text-white/30 font-mono">暂无主题</p>
              <p className="text-[11px] text-white/20 text-center max-w-[200px] leading-relaxed">
                创建你的第一个长期主题，或在 AI 对话中说「@curation 帮我分析主题」
              </p>
              <button
                className="mt-1 rounded-[6px] border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white hover:border-white/20 transition-colors"
                onClick={handleImportFromTags}
              >
                <Download className="h-3 w-3 inline mr-1" />
                从标签导入
              </button>
            </div>
          ) : (
            <>
              {/* 活跃主题 */}
              {activeThemes.map((theme) => (
                <button
                  key={theme.externalId}
                  onClick={() => setSelectedThemeId(theme.externalId)}
                  className={`text-left rounded-[6px] border p-3 transition-all duration-200 ${
                    selectedThemeId === theme.externalId
                      ? "border-white/15 bg-[#1a1a1a]"
                      : "border-white/5 bg-[#212121] hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white/85 truncate">
                      {theme.name}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconButton
                        preset="edit"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditEditor(theme);
                        }}
                      />
                      <IconButton
                        preset="delete"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTheme(theme);
                        }}
                      />
                    </div>
                  </div>
                  {theme.description && (
                    <p className="text-xs text-white/40 mt-1 line-clamp-2">
                      {theme.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-white/25 font-mono">
                      {(theme.itemCount ?? 0)}项关联
                    </span>
                    <Tag size="small" color="gray">
                      {theme.status}
                    </Tag>
                  </div>
                </button>
              ))}

              {/* 已归档主题 */}
              {archivedThemes.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Archive className="h-3 w-3 text-white/20" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white/20">
                      已归档
                    </span>
                  </div>
                  {archivedThemes.map((theme) => (
                    <button
                      key={theme.externalId}
                      onClick={() => setSelectedThemeId(theme.externalId)}
                      className={`w-full text-left rounded-[6px] border p-2.5 mb-1.5 transition-all ${
                        selectedThemeId === theme.externalId
                          ? "border-white/10 bg-[#1a1a1a]"
                          : "border-white/[0.03] bg-black/30 hover:border-white/8"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/50 truncate">
                          {theme.name}
                        </span>
                        <IconButton
                          preset="default"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleArchive(theme);
                          }}
                          title="恢复"
                        >
                          <RotateCcw className="h-2.5 w-2.5" />
                        </IconButton>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* 右侧：主题详情 */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {!selectedTheme ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Layers className="h-10 w-10 text-white/8 mx-auto" />
                <p className="mt-3 text-xs text-white/25 font-mono">
                  选择一个主题查看详情
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 基本信息卡片 */}
              <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white/90">
                      {selectedTheme.name}
                    </h2>
                    {selectedTheme.description && (
                      <p className="text-xs text-white/45 mt-1">
                        {selectedTheme.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      preset="edit"
                      size="small"
                      onClick={() => openEditEditor(selectedTheme)}
                    />
                    <IconButton
                      preset={selectedTheme.status === "active" ? "default" : "default"}
                      size="small"
                      onClick={() => handleToggleArchive(selectedTheme)}
                      title={selectedTheme.status === "active" ? "归档" : "恢复"}
                    >
                      {selectedTheme.status === "active" ? (
                        <Archive className="h-3.5 w-3.5" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                    </IconButton>
                    <IconButton
                      preset="delete"
                      size="small"
                      onClick={() => handleDeleteTheme(selectedTheme)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 text-[10px] text-white/25 font-mono">
                  <span>创建: {selectedTheme.createdAt}</span>
                  <span>更新: {selectedTheme.updatedAt}</span>
                  <span>{(selectedTheme.itemCount ?? 0)}项关联</span>
                </div>
              </div>

              {/* 关联素材列表 */}
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center gap-1.5 mb-3">
                  <FileText className="h-3.5 w-3.5 text-white/40" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
                    关联素材
                  </span>
                </div>

                {itemsLoading ? (
                  <div className="text-xs text-white/30 font-mono py-8 text-center">
                    加载中...
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-xs text-white/20 font-mono py-8 text-center bg-[#212121] rounded-[6px] border border-white/5">
                    尚未关联任何素材
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1">
                    {items.map((item) => (
                      <div
                        key={item.externalId}
                        className="bg-[#212121] rounded-[6px] border border-white/5 p-3 flex flex-col gap-1.5 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Tag size="small" color="gray">
                              {SOURCE_LABELS[item.sourceType] ?? item.sourceType}
                            </Tag>
                            <span className="text-xs text-white/70 font-semibold truncate max-w-[400px]">
                              {item.sourceTitle ?? `${item.sourceType} #${item.sourceId}`}
                            </span>
                            {item.aiExtracted === 1 && (
                              <span className="text-[9px] text-white/20 font-mono bg-white/[0.03] px-1 py-0.5 rounded">
                                AI
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {item.sourceEntryDate && (
                              <span className="text-[10px] text-white/25 font-mono">
                                {item.sourceEntryDate}
                              </span>
                            )}
                            <IconButton
                              preset="close"
                              size="small"
                              onClick={() => handleRemoveItem(item)}
                              title="解除关联"
                            />
                          </div>
                        </div>
                        {item.relevanceNote && (
                          <p className="text-[11px] text-white/35 leading-relaxed">
                            {item.relevanceNote}
                          </p>
                        )}
                        {item.sourceContent && (
                          <p className="text-[11px] text-white/25 line-clamp-2 leading-relaxed bg-black/30 p-2 rounded-[4px]">
                            {item.sourceContent.slice(0, 200)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 时间线（可选，简化版） */}
              {timeline.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="h-3.5 w-3.5 text-white/40" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
                      时间线
                    </span>
                  </div>
                  <div className="flex items-end gap-1 h-16 bg-[#212121] rounded-[6px] border border-white/5 p-2">
                    {timeline.map((point) => (
                      <div
                        key={point.weekStartDate}
                        className="flex-1 flex flex-col items-center justify-end gap-1"
                        title={`${point.weekStartDate}: ${point.itemCount}项${point.mentionedInSummary ? ' (总结提及)' : ''}`}
                      >
                        <div
                          className="w-full rounded-t-[2px] transition-all"
                          style={{
                            height: `${Math.min(point.itemCount * 8, 40)}px`,
                            backgroundColor: point.mentionedInSummary
                              ? "rgba(255,255,255,0.35)"
                              : "rgba(255,255,255,0.08)",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 创建/编辑主题弹窗 */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#212121] rounded-[6px] border border-white/10 p-5 w-[400px] max-w-[90vw] shadow-2xl">
            <h3 className="text-sm font-bold text-white/90 mb-4">
              {editTarget ? "编辑主题" : "新建主题"}
            </h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/30 mb-1 block">
                  名称
                </label>
                <input
                  className="w-full bg-black/40 border border-white/10 rounded-[6px] px-3 py-2 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-white/20"
                  placeholder="如：职业转型、亲密关系"
                  value={editorName}
                  onChange={(e) => setEditorName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/30 mb-1 block">
                  描述
                </label>
                <textarea
                  className="w-full bg-black/40 border border-white/10 rounded-[6px] px-3 py-2 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-white/20 resize-none h-20"
                  placeholder="为什么追踪这个主题？"
                  value={editorDesc}
                  onChange={(e) => setEditorDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="rounded-[6px] border border-white/10 px-4 py-1.5 text-xs text-white/50 hover:text-white hover:border-white/20 transition-colors"
                onClick={() => setIsEditorOpen(false)}
              >
                取消
              </button>
              <button
                className="rounded-[6px] bg-white text-black px-4 py-1.5 text-xs font-semibold hover:bg-white/90 transition-colors disabled:opacity-40"
                onClick={handleSaveTheme}
                disabled={editorSaving || !editorName.trim()}
              >
                {editorSaving ? "保存中..." : editTarget ? "更新" : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit src/renderer/src/pages/themes/ThemesPage.tsx
```

---

### Task 9: 周度总结联动 — 自动主题提取（2.7）

**Files:**
- Modify: `src/main/ipc/weeklyHandlers.ts`

- [ ] **Step 1: 在总结生成的 system prompt 末尾追加主题建议输出要求**

在 `weekly:summary:generate` handler 的 systemMessage content 末尾（第 241 行 `)}` 之前），追加：

```
---
## 主题建议
根据上述分析，提取 2-5 个可追踪的长期主题建议。每个主题一行，JSON 格式：
{"name": "主题名", "confidence": 0-100, "evidence": "引用分析中的关键句"}

如果本周内容不足以提取新主题，输出空数组 []。
```

在 `weekly:curator:generate` handler 的 systemMessage content 末尾（第 396 行）同样追加。

- [ ] **Step 2: 在 `weekly:summary:done` 和 `weekly:curator:done` 发送后自动提取主题**

在两个 handler 的 `weeklySummaryService.save(saveInput)` 之后、`event.sender.send("weekly:summary:done", savedItem)` 之前，插入：

```typescript
      // 自动提取主题建议
      if (savedItem.isMeaningful === 1) {
        try {
          const themesService = createThemesService(
            database as unknown as import("@/services/themesService").DatabaseConnection
          );
          const extractedCount = themesService.extractThemesFromSummary(fullText, savedItem.id);
          if (extractedCount > 0) {
            console.log(`从周度总结中提取了 ${extractedCount} 个主题`);
          }
        } catch (err) {
          console.error("自动主题提取失败:", err);
        }
      }
```

需要在文件顶部添加 import：

```typescript
import { createThemesService } from "@/services/themesService";
```

注意：这个 import 可能因循环依赖导致问题，需要检查。如果 `themesService` 被 `weeklyHandlers` 导入而无循环引用（themesService 不依赖 weeklyHandlers），则是安全的。

---

### Task 10: 最终验证

- [ ] **Step 1: 全局 TypeScript 编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: 运行现有测试**

```bash
npm test
```

- [ ] **Step 3: 手动验证清单**
  - [ ] 启动应用，侧栏 themes 导航可见
  - [ ] ThemesPage 空态展示引导 + 从标签导入
  - [ ] 新建主题正常弹出编辑框并保存
  - [ ] 编辑主题名称/描述正常更新
  - [ ] 删除主题前有 confirm 确认
  - [ ] 归档/恢复主题切换正常
  - [ ] 右侧详情面板展示主题基本信息
  - [ ] 关联素材列表展示来源类型/标题/时间
  - [ ] 时间线柱状图正常渲染
  - [ ] 解除关联正常
  - [ ] 周度总结生成后自动提取主题（可选验证）
```

---

## 自我审查

### 1. Spec 覆盖

| 实现计划需求 | 任务 |
|---|---|
| 2.1 数据库 themes + theme_items | Task 1 (schema) + Task 2 (migration) |
| 2.2 Service | Task 3 |
| 2.3 Agent Tool (6 工具) | Task 4 |
| 2.4 IPC | Task 5 |
| 2.5 UI 重写 | Task 8 |
| 2.6 注册点 | Task 6 (main/index + toolRegistry) |
| 2.7 总结联动 | Task 9 |
| 2.8 标签预热 | Task 3 (batchCreateFromTags) + Task 8 (UI 导入按钮) |
| 2.9 跨周追踪 | Task 3 (getTimeline) + Task 8 (时间线柱状图) |
| 2.10 注册点汇总 | 覆盖在 Task 1-9 中 |

### 2. Placeholder 扫描

无 TBD / TODO / "implement later"。所有步骤有确切代码。

### 3. 类型一致性

- `ThemeItem`, `ThemeItemsItem` 等类型在 schema.ts、env.d.ts、ThemesPage.tsx 中命名一致
- IPC channel 命名遵循 `themes:action` 规范
- Service 方法签名与 IPC handler 一致
