# Phase 1: AI 周度总结 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 替换 WeeklyReviewPage 右下角占位符，实现一键 AI 流式生成当周数据总结，并持久化保存。

**Architecture:** Main 进程新增 `weeklySummaryService`（SQLite CRUD）和 `weeklyHandlers`（IPC）；生成时直接调用 `provider.streamTurn()` 不走 ReAct loop；前端新增 `WeeklySummaryPanel` 子组件替换占位符，通过 IPC push 事件接收流式 delta。

**Tech Stack:** Electron IPC, better-sqlite3, @ai-sdk (via existing providerFactory), React, Tailwind CSS

---

## 关键约束

- 所有 SQL 手写，不使用 drizzle 查询构建（与现有 service 一致）
- 建表用 `CREATE TABLE IF NOT EXISTS`，不做 migration，不破坏现有数据
- 流式推送事件通道：`weekly:summary:delta`（`{ text: string }`）和 `weekly:summary:done`（完整 `WeeklySummaryItem`）
- Push 事件在 handler 中通过 `event.sender.send(channel, payload)` 发送
- preload 事件监听模式与 `window.api.ai.onChatEvent` 一致，返回 unsubscribe 函数

---

## File Map

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/main/db/schema.ts` | 修改 | 追加 `WeeklySummaryRow` / `WeeklySummaryItem` / `WeeklySummarySaveInput` 类型 |
| `src/main/db/index.ts` | 修改 | 新增 `createWeeklySummariesTable()`；在 `initDatabase()` 末尾调用 |
| `src/main/services/weeklySummaryService.ts` | 新建 | CRUD service：`getByWeekStart` / `save` / `delete` |
| `src/main/ipc/weeklyHandlers.ts` | 新建 | 注册 4 个 IPC channel，核心含流式生成逻辑 |
| `src/main/index.ts` | 修改 | 导入并调用 `registerWeeklyHandlers()` |
| `src/preload/index.ts` | 修改 | 暴露 `window.api.weekly` 命名空间 + push 事件订阅 |
| `src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx` | 修改 | 渲染 `WeeklySummaryPanel`，替换占位符；传入 `weekStartDate` |
| `src/renderer/src/pages/weekly-review/components/WeeklySummaryPanel.tsx` | 新建 | 状态机组件：idle / loading / streaming / done |

---

## Task 1: DB Schema 类型定义

**Files:**
- Modify: `src/main/db/schema.ts`

- [ ] **Step 1.1: 在 schema.ts 末尾追加三个类型**

在文件最后一行 `})` 后追加：

```typescript
// 周度总结数据库行类型。
export type WeeklySummaryRow = {
  // 自增主键。
  id: number
  // 周起始日期，格式 'YYYY-MM-DD'（周一）。
  week_start_date: string
  // 总结标题。
  title: string
  // 总结正文，Markdown 格式。
  content: string
  // 生成所用模型标识。
  model_used: string | null
  // 生成时间，格式 'YYYY-MM-DD HH:mm'。
  generated_at: string
}

// 页面使用的周度总结类型。
export type WeeklySummaryItem = {
  // 自增主键。
  id: number
  // 周起始日期，格式 'YYYY-MM-DD'（周一）。
  weekStartDate: string
  // 总结标题。
  title: string
  // 总结正文，Markdown 格式。
  content: string
  // 生成所用模型标识。
  modelUsed: string | null
  // 生成时间，格式 'YYYY-MM-DD HH:mm'。
  generatedAt: string
}

// 周度总结保存输入类型。
export type WeeklySummarySaveInput = {
  // 周起始日期，格式 'YYYY-MM-DD'（周一）。
  weekStartDate: string
  // 总结标题。
  title: string
  // 总结正文，Markdown 格式。
  content: string
  // 生成所用模型标识。
  modelUsed?: string | null
  // 生成时间，格式 'YYYY-MM-DD HH:mm'。
  generatedAt: string
}
```

---

## Task 2: 数据库建表函数

**Files:**
- Modify: `src/main/db/index.ts`

- [ ] **Step 2.1: 新增 createWeeklySummariesTable 函数**

在 `createAiChatPersistenceTables` 函数结束之后（约 726 行后），新增：

```typescript
/**
 * 创建周度总结表。
 */
export const createWeeklySummariesTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS weekly_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start_date TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      model_used TEXT,
      generated_at TEXT NOT NULL
    );
  `)
}
```

- [ ] **Step 2.2: 在 initDatabase() 末尾调用建表**

在 `createAiChatPersistenceTables(sqlite)` 调用之后加一行：

```typescript
createWeeklySummariesTable(sqlite)
```

---

## Task 3: WeeklySummaryService

**Files:**
- Create: `src/main/services/weeklySummaryService.ts`

- [ ] **Step 3.1: 创建 weeklySummaryService.ts**

```typescript
import type { WeeklySummaryItem, WeeklySummaryRow, WeeklySummarySaveInput } from '@/db/schema'

// 数据库语句接口。
type DatabaseStatement = {
  all: (...values: unknown[]) => unknown[]
  get: (...values: unknown[]) => unknown
  run: (...values: unknown[]) => { lastInsertRowid?: number | bigint } | unknown
}

// Weekly summary service 依赖的最小数据库接口。
export type DatabaseConnection = {
  prepare: (sql: string) => DatabaseStatement
}

// Weekly summary service 方法集合。
export type WeeklySummaryService = {
  // 按周起始日期查询总结，不存在返回 null。
  getByWeekStart: (weekStartDate: string) => WeeklySummaryItem | null
  // 保存（upsert）总结，返回保存后的完整记录。
  save: (input: WeeklySummarySaveInput) => WeeklySummaryItem
  // 按周起始日期删除总结。
  delete: (weekStartDate: string) => void
}

/**
 * 将数据库行映射为页面使用的类型。
 */
const rowToItem = (row: WeeklySummaryRow): WeeklySummaryItem => ({
  id: row.id,
  weekStartDate: row.week_start_date,
  title: row.title,
  content: row.content,
  modelUsed: row.model_used,
  generatedAt: row.generated_at
})

/**
 * 创建 WeeklySummary 服务。
 */
export const createWeeklySummaryService = (database: DatabaseConnection): WeeklySummaryService => ({
  getByWeekStart: (weekStartDate) => {
    const row = database
      .prepare('SELECT * FROM weekly_summaries WHERE week_start_date = ?')
      .get(weekStartDate) as WeeklySummaryRow | undefined

    return row ? rowToItem(row) : null
  },

  save: (input) => {
    database
      .prepare(
        `INSERT INTO weekly_summaries (week_start_date, title, content, model_used, generated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(week_start_date) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           model_used = excluded.model_used,
           generated_at = excluded.generated_at`
      )
      .run(
        input.weekStartDate,
        input.title,
        input.content,
        input.modelUsed ?? null,
        input.generatedAt
      )

    const row = database
      .prepare('SELECT * FROM weekly_summaries WHERE week_start_date = ?')
      .get(input.weekStartDate) as WeeklySummaryRow

    return rowToItem(row)
  },

  delete: (weekStartDate) => {
    database
      .prepare('DELETE FROM weekly_summaries WHERE week_start_date = ?')
      .run(weekStartDate)
  }
})
```

---

## Task 4: IPC Handler（含流式生成核心）

**Files:**
- Create: `src/main/ipc/weeklyHandlers.ts`

- [ ] **Step 4.1: 创建 weeklyHandlers.ts**

先阅读 `src/main/agent/providers/aiSdkProvider.ts` 确认 `streamTurn` 返回的是 `AsyncIterable<ModelStreamEvent>`，然后写：

```typescript
import { ipcMain } from 'electron'
import { getDatabase } from '@/db'
import {
  createWeeklySummaryService,
  type DatabaseConnection
} from '@/services/weeklySummaryService'
import { createDailyService } from '@/services/dailyService'
import { loadProviderConfig } from '@/agent/providers/providerConfig'
import { createModelProvider } from '@/agent/providers/providerFactory'
import type { WeeklySummarySaveInput } from '@/db/schema'
import type { AgentMessage } from '@/agent/types'

// 周度总结生成载荷。
type WeeklySummaryGeneratePayload = {
  // 周起始日期，格式 'YYYY-MM-DD'（周一）。
  weekStartDate: string
  // 可选模型标识，不传则使用默认模型。
  model?: string
  // 可选 provider 标识，不传则使用默认 provider。
  provider?: string
}

/**
 * 计算从周一起的 7 天日期列表。
 */
const getWeekDates = (weekStartDate: string): string[] => {
  const start = new Date(weekStartDate)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

/**
 * 格式化当前时间为 'YYYY-MM-DD HH:mm'。
 */
const formatNow = (): string => {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/**
 * 注册周度总结相关 IPC handlers。
 */
export const registerWeeklyHandlers = (): void => {
  const database = getDatabase()
  const weeklySummaryService = createWeeklySummaryService(database as unknown as DatabaseConnection)
  const dailyService = createDailyService(database as unknown as import('@/services/dailyService').DatabaseConnection)

  // 获取某周总结。
  ipcMain.handle('weekly:summary:get', (_, weekStartDate: string) =>
    weeklySummaryService.getByWeekStart(weekStartDate)
  )

  // 手动保存总结。
  ipcMain.handle('weekly:summary:save', (_, input: WeeklySummarySaveInput) =>
    weeklySummaryService.save(input)
  )

  // 删除总结。
  ipcMain.handle('weekly:summary:delete', (_, weekStartDate: string) =>
    weeklySummaryService.delete(weekStartDate)
  )

  // AI 流式生成总结（核心）。
  ipcMain.handle('weekly:summary:generate', async (event, payload: WeeklySummaryGeneratePayload) => {
    const { weekStartDate, model: requestedModel, provider: requestedProvider } = payload

    // 并发拉取 7 天数据。
    const dates = getWeekDates(weekStartDate)
    const dayDataList = await Promise.all(dates.map((d) => dailyService.listDay(d)))

    // 构造数据摘要（限制 token 消耗，每天各 500 字以内）。
    const weekDataSummary = dates.map((date, i) => {
      const day = dayDataList[i]
      const todos = day.todos.map((t) => `[${t.completed ? 'x' : ' '}] ${t.text}`).join('\n')
      const snippets = day.snippets
        .map((s) => `${s.title}: ${s.content.slice(0, 200)}`)
        .join('\n')
      const journal = day.journal ? day.journal.content.slice(0, 500) : '（无日记）'
      return `## ${date}\n### 待办\n${todos || '无'}\n### 片段\n${snippets || '无'}\n### 日记\n${journal}`
    }).join('\n\n')

    // 加载 provider 配置并创建 provider。
    const config = loadProviderConfig()
    const providerId = requestedProvider ?? config.defaultProvider
    const modelId = requestedModel ?? config.defaultModel
    const providerConfig = config.providers[providerId]
    if (!providerConfig) {
      throw new Error(`Provider not found: ${providerId}`)
    }
    const provider = await createModelProvider(providerConfig)

    // 构造 prompt。
    const systemMessage: AgentMessage = {
      role: 'system',
      content: `你是一位专注于个人成长的记忆策展人。请根据用户提供的一周数据，生成一份深刻的周度总结。

总结要求：
- 第一行为简洁标题（15 字以内），格式：# 标题
- 正文使用 Markdown 格式
- 涵盖：本周完成情况（完成率）、关键事件与片段、情绪与思维模式、重复出现的主题
- 末尾提出 1-2 个值得深入思考的问题
- 语言真诚直接，避免空话套话
- 控制在 600 字以内`
    }

    const userMessage: AgentMessage = {
      role: 'user',
      content: `以下是我本周（${weekStartDate} 起）的记录数据，请生成周度总结：\n\n${weekDataSummary}`
    }

    // 流式生成，收集完整文本并发送 delta 事件。
    let fullText = ''
    const stream = provider.streamTurn({
      model: modelId,
      messages: [systemMessage, userMessage],
      tools: []
    })

    for await (const streamEvent of stream) {
      if (streamEvent.type === 'text_delta') {
        fullText += streamEvent.delta
        event.sender.send('weekly:summary:delta', { text: streamEvent.delta })
      }
    }

    // 提取标题（首行 # 后内容）并保存。
    const firstLine = fullText.split('\n')[0] ?? ''
    const title = firstLine.replace(/^#+\s*/, '').trim() || `${weekStartDate} 周度总结`
    const saveInput: WeeklySummarySaveInput = {
      weekStartDate,
      title,
      content: fullText,
      modelUsed: modelId,
      generatedAt: formatNow()
    }
    const savedItem = weeklySummaryService.save(saveInput)

    // 通知前端生成完成。
    event.sender.send('weekly:summary:done', savedItem)

    return savedItem
  })
}
```

---

## Task 5: 注册 Handler 到 main 进程

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 5.1: 导入并注册 weeklyHandlers**

在现有 import 区块末尾追加：

```typescript
import { registerWeeklyHandlers } from '@/ipc/weeklyHandlers'
```

在 `app.whenReady()` 内，`registerConfigHandlers()` 之后追加：

```typescript
registerWeeklyHandlers()
```

---

## Task 6: Preload 暴露 window.api.weekly

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 6.1: 在 preload 顶部追加 WeeklySummaryItem 类型（本地定义，不从 main 导入）**

在 preload 顶部类型定义区块追加：

```typescript
// 周度总结项类型（preload 本地声明，与 main 的 WeeklySummaryItem 对齐）。
type WeeklySummaryItem = {
  id: number
  weekStartDate: string
  title: string
  content: string
  modelUsed: string | null
  generatedAt: string
}

// 周度总结保存载荷类型。
type WeeklySummarySavePayload = {
  weekStartDate: string
  title: string
  content: string
  modelUsed?: string | null
  generatedAt: string
}

// 周度总结生成载荷类型。
type WeeklySummaryGeneratePayload = {
  weekStartDate: string
  model?: string
  provider?: string
}

// 周度总结 delta 事件。
type WeeklySummaryDeltaEvent = {
  text: string
}
```

- [ ] **Step 6.2: 在 api 对象中追加 weekly 命名空间**

在 `ai: { ... }` 闭合的 `}` 之后（636 行 `}` 前），插入：

```typescript
  weekly: {
    summary: {
      get: (weekStartDate: string): Promise<WeeklySummaryItem | null> =>
        ipcRenderer.invoke('weekly:summary:get', weekStartDate),
      save: (payload: WeeklySummarySavePayload): Promise<WeeklySummaryItem> =>
        ipcRenderer.invoke('weekly:summary:save', payload),
      delete: (weekStartDate: string): Promise<void> =>
        ipcRenderer.invoke('weekly:summary:delete', weekStartDate),
      generate: (payload: WeeklySummaryGeneratePayload): Promise<WeeklySummaryItem> =>
        ipcRenderer.invoke('weekly:summary:generate', payload),
      onDelta: (listener: (event: WeeklySummaryDeltaEvent) => void): (() => void) => {
        const wrapped = (_: Electron.IpcRendererEvent, event: WeeklySummaryDeltaEvent): void => {
          listener(event)
        }
        ipcRenderer.on('weekly:summary:delta', wrapped)
        return () => ipcRenderer.removeListener('weekly:summary:delta', wrapped)
      },
      onDone: (listener: (item: WeeklySummaryItem) => void): (() => void) => {
        const wrapped = (_: Electron.IpcRendererEvent, item: WeeklySummaryItem): void => {
          listener(item)
        }
        ipcRenderer.on('weekly:summary:done', wrapped)
        return () => ipcRenderer.removeListener('weekly:summary:done', wrapped)
      }
    }
  }
```

---

## Task 7: WeeklySummaryPanel 组件

**Files:**
- Create: `src/renderer/src/pages/weekly-review/components/WeeklySummaryPanel.tsx`

- [ ] **Step 7.1: 创建目录**

```bash
mkdir -p src/renderer/src/pages/weekly-review/components
```

- [ ] **Step 7.2: 创建 WeeklySummaryPanel.tsx**

```typescript
import { useEffect, useRef, useState } from 'react'
import { MdEditor } from 'md-editor-rt'
import 'md-editor-rt/lib/preview.css'
import { RefreshCw, Edit2, FileText } from 'lucide-react'

// 组件 Props。
interface WeeklySummaryPanelProps {
  // 当前周的起始日期，格式 'YYYY-MM-DD'。
  weekStartDate: string
}

// 周度总结项类型（与 preload 对齐）。
type WeeklySummaryItem = {
  id: number
  weekStartDate: string
  title: string
  content: string
  modelUsed: string | null
  generatedAt: string
}

// 面板状态类型。
type PanelState = 'idle' | 'loading' | 'streaming' | 'done'

/**
 * 周度总结面板。
 * 状态机：idle -> loading -> streaming -> done，支持重新生成与编辑。
 */
export const WeeklySummaryPanel = ({ weekStartDate }: WeeklySummaryPanelProps) => {
  // 当前面板状态。
  const [state, setState] = useState<PanelState>('idle')
  // 已保存的总结数据。
  const [summary, setSummary] = useState<WeeklySummaryItem | null>(null)
  // 流式累积文本（使用 ref 避免频繁 state 更新）。
  const streamTextRef = useRef('')
  // 触发 RAF 渲染用的计数器。
  const [streamRenderTick, setStreamRenderTick] = useState(0)
  // RAF handle，用于清理。
  const rafRef = useRef<number | null>(null)
  // 是否在编辑模式。
  const [isEditing, setIsEditing] = useState(false)
  // 编辑中的内容。
  const [editContent, setEditContent] = useState('')

  // 初始化时加载已有总结。
  useEffect(() => {
    if (!weekStartDate) return

    window.api.weekly.summary.get(weekStartDate).then((item) => {
      if (item) {
        setSummary(item)
        setState('done')
      } else {
        setState('idle')
        setSummary(null)
      }
    })
  }, [weekStartDate])

  /**
   * 触发 AI 生成。
   */
  const handleGenerate = async () => {
    setState('loading')
    streamTextRef.current = ''
    setStreamRenderTick(0)

    // 订阅 delta 事件，用 RAF 批量更新渲染。
    const unsubDelta = window.api.weekly.summary.onDelta(({ text }) => {
      streamTextRef.current += text
      setState('streaming')
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          setStreamRenderTick((t) => t + 1)
        })
      }
    })

    // 订阅 done 事件。
    const unsubDone = window.api.weekly.summary.onDone((item) => {
      unsubDelta()
      unsubDone()
      setSummary(item)
      setState('done')
    })

    try {
      await window.api.weekly.summary.generate({ weekStartDate })
    } catch (err) {
      unsubDelta()
      unsubDone()
      setState(summary ? 'done' : 'idle')
      console.error('周度总结生成失败', err)
    }
  }

  /**
   * 保存编辑内容。
   */
  const handleSaveEdit = async () => {
    if (!summary) return

    const firstLine = editContent.split('\n')[0] ?? ''
    const title = firstLine.replace(/^#+\s*/, '').trim() || summary.title
    const updated = await window.api.weekly.summary.save({
      weekStartDate,
      title,
      content: editContent,
      modelUsed: summary.modelUsed,
      generatedAt: summary.generatedAt
    })
    setSummary(updated)
    setIsEditing(false)
  }

  // 当前展示的 Markdown 文本。
  const displayText = state === 'streaming' ? streamTextRef.current : summary?.content ?? ''

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 标题栏 */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-white/60" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
            周度总结
          </h3>
        </div>

        {state === 'done' && !isEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditContent(summary?.content ?? ''); setIsEditing(true) }}
              className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              <Edit2 className="h-3 w-3" />
              编辑
            </button>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              重新生成
            </button>
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col min-h-[300px] flex-grow overflow-hidden">
        {(state === 'idle') && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-xs text-white/25">本周尚无总结</p>
            <button
              onClick={handleGenerate}
              className="px-4 py-2 text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 rounded-[6px] border border-white/10 transition-colors"
            >
              生成周度总结
            </button>
          </div>
        )}

        {(state === 'loading') && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        {(state === 'streaming' || state === 'done') && !isEditing && (
          <div className="flex-1 overflow-y-auto prose prose-invert prose-sm max-w-none text-white/80 text-xs leading-relaxed">
            <MdEditor
              modelValue={displayText}
              previewOnly
              theme="dark"
              style={{ background: 'transparent', padding: 0 }}
            />
            {state === 'streaming' && (
              <span className="inline-block w-2 h-3 bg-white/40 animate-pulse ml-0.5" />
            )}
          </div>
        )}

        {isEditing && (
          <div className="flex flex-col gap-2 flex-1">
            <MdEditor
              modelValue={editContent}
              onChange={setEditContent}
              theme="dark"
              style={{ height: '100%', background: '#212121' }}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white/70 rounded-[6px] border border-white/10 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        )}
      </div>

      {state === 'done' && summary && (
        <p className="text-xs text-white/20 text-right">
          {summary.generatedAt} · {summary.modelUsed ?? '未知模型'}
        </p>
      )}
    </div>
  )
}
```

---

## Task 8: 修改 WeeklyReviewPage 集成面板

**Files:**
- Modify: `src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx`

- [ ] **Step 8.1: 导入 WeeklySummaryPanel**

在文件顶部 import 区块末尾追加：

```typescript
import { WeeklySummaryPanel } from '@/pages/weekly-review/components/WeeklySummaryPanel'
```

- [ ] **Step 8.2: 替换占位符（第 701-717 行）**

将：

```tsx
{/* 右列：周度总结 */}
<div className="w-full flex flex-col bg-[#000000]">
  <div className="flex-shrink-0 mb-3 flex items-center justify-between border-b border-white/5 pb-2">
    <div className="flex items-center gap-2">
      <FileText className="h-4 w-4 text-white/60" />
      <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
        周度总结
      </h3>
    </div>
  </div>

  <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col min-h-[300px] flex-grow">
    <div className="flex-1 flex items-center justify-center text-xs text-white/25 border border-dashed border-white/5 rounded-[6px] py-12">
      总结功能筹备中...
    </div>
  </div>
</div>
```

替换为：

```tsx
{/* 右列：周度总结 */}
<div className="w-full flex flex-col bg-[#000000]">
  <WeeklySummaryPanel weekStartDate={weekStartDate} />
</div>
```

其中 `weekStartDate` 是该组件中已有的 state 变量（`const [weekStartDate, setWeekStartDate] = useState(...)`），需确认实际变量名（读 WeeklyReviewPage 顶部状态定义）。

---

## Task 9: 类型检查验证

**Files:** 无新文件

- [ ] **Step 9.1: 运行 TypeScript 类型检查**

```bash
npm run typecheck
```

预期：0 个错误。如有错误，检查：
- preload 中 `WeeklySummaryItem` 类型与 main 的字段是否对齐
- `window.api.weekly.summary` 调用参数是否与 preload 类型匹配
- `WeeklySummaryPanel` 的 `window.api` 调用是否覆盖了全部方法

- [ ] **Step 9.2: 运行 lint**

```bash
npm run lint
```

预期：0 个 error（warning 可接受）。

---

## 注意事项

1. **weekStartDate 变量名**：Step 8.2 中需确认 `WeeklyReviewPage` 里存当前周起始日期的 state 名，从代码读取确认（见 `src/renderer/src/pages/weekly-review/WeeklyReviewPage.tsx:59-67`）。

2. **md-editor-rt previewOnly 用法**：确认 `md-editor-rt` 版本支持 `previewOnly` prop，如不支持换用 `MdPreview` 组件（同库导出）。

3. **流式结束时序**：`weekly:summary:done` 在 main 进程 `for await` 结束后才发送；前端在 `onDone` 回调中取消订阅，避免内存泄漏。

4. **错误处理**：`generate` 的 catch 块仅 console.error，可后续改为 toast 通知（Phase 1 暂不实现）。

