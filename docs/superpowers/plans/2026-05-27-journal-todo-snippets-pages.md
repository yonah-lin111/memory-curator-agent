# Journal / Todo / Snippets Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `JournalPage`、`TodoPage`、`SnippetsPage` 实现独特页面布局、样式和基于现有 workspace SQLite / IPC 的日期维度 CRUD。

**Architecture:** 保持主进程数据库、preload bridge 和 `window.api.workspace` 不变；渲染层按页面拆分专属布局组件，并抽出少量跨页日期 / 空状态原子组件。页面层统一负责 `entryDate`、加载 / 错误 / toast、CRUD 调用，子组件只负责展示和交互输入。

**Tech Stack:** Electron, React 19, TypeScript, Tailwind, Vitest, Testing Library, `@uiw/react-md-editor`, Lucide。

---

## File Structure

**Create:**
- `src/renderer/src/components/ui/PageDateNavigator.tsx`
- `src/renderer/src/components/ui/EmptyState.tsx`
- `src/renderer/src/pages/components/workspacePageShared.ts`
- `src/renderer/src/pages/components/JournalDateRail.tsx`
- `src/renderer/src/pages/components/JournalEditorSurface.tsx`
- `src/renderer/src/pages/components/TodoControlTower.tsx`
- `src/renderer/src/pages/components/SnippetsTagMap.tsx`
- `src/renderer/src/pages/components/SnippetDetailDrawer.tsx`
- `src/renderer/src/pages/JournalPage.test.tsx`
- `src/renderer/src/pages/TodoPage.test.tsx`
- `src/renderer/src/pages/SnippetsPage.test.tsx`

**Modify:**
- `src/renderer/src/pages/JournalPage.tsx`
- `src/renderer/src/pages/TodoPage.tsx`
- `src/renderer/src/pages/SnippetsPage.tsx`
- `src/renderer/src/App.test.tsx`

**Verification:**
- `pnpm test -- src/renderer/src/pages/JournalPage.test.tsx`
- `pnpm test -- src/renderer/src/pages/TodoPage.test.tsx`
- `pnpm test -- src/renderer/src/pages/SnippetsPage.test.tsx`
- `pnpm test -- src/renderer/src/App.test.tsx`
- `pnpm typecheck`

**Repository rule:** `AGENTS.md` 禁止自动执行 `git commit/merge`，本计划不包含提交步骤。

### Task 1: Shared Date / Empty-State Primitives

**Files:**
- Create: `src/renderer/src/components/ui/PageDateNavigator.tsx`
- Create: `src/renderer/src/components/ui/EmptyState.tsx`
- Create: `src/renderer/src/pages/components/workspacePageShared.ts`
- Test: `src/renderer/src/pages/JournalPage.test.tsx`
- Test: `src/renderer/src/pages/TodoPage.test.tsx`
- Test: `src/renderer/src/pages/SnippetsPage.test.tsx`

- [ ] **Step 1: Write the failing tests that prove all three pages need a shared date navigator**

```tsx
// src/renderer/src/pages/JournalPage.test.tsx
it('支持切换日期并重新读取日记', async () => {
  const listDay = vi
    .fn()
    .mockResolvedValueOnce({
      todos: [],
      snippets: [],
      journal: {
        entryDate: '2026-05-27',
        content: '今天的日记',
        createdAt: '2026-05-27 09:00',
        updatedAt: '2026-05-27 09:30',
      },
    })
    .mockResolvedValueOnce({
      todos: [],
      snippets: [],
      journal: {
        entryDate: '2026-05-26',
        content: '昨天的日记',
        createdAt: '2026-05-26 09:00',
        updatedAt: '2026-05-26 09:30',
      },
    })

  window.api = {
    workspace: {
      listDay,
      saveJournal: vi.fn(),
      deleteJournal: vi.fn(),
      createTodo: vi.fn(),
      updateTodo: vi.fn(),
      deleteTodo: vi.fn(),
      sortTodos: vi.fn(),
      createSnippet: vi.fn(),
      updateSnippet: vi.fn(),
      deleteSnippet: vi.fn(),
    },
    notes: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    electron: {} as never,
  } as Window['api'] & { electron: Window['electron'] }

  render(<JournalPage />)

  expect(await screen.findByDisplayValue('今天的日记')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: '查看前一天 2026-05-26' }))

  expect(listDay).toHaveBeenLastCalledWith('2026-05-26')
  expect(await screen.findByDisplayValue('昨天的日记')).toBeInTheDocument()
})
```

```tsx
// src/renderer/src/pages/TodoPage.test.tsx
it('切换日期后重新加载待办', async () => {
  const listDay = vi
    .fn()
    .mockResolvedValueOnce({
      todos: [{ id: 1, entryDate: '2026-05-27', text: '今天任务', completed: false, priority: 'P1', sortOrder: 0, createdAt: '2026-05-27 09:00', updatedAt: '2026-05-27 09:00' }],
      snippets: [],
      journal: null,
    })
    .mockResolvedValueOnce({
      todos: [{ id: 2, entryDate: '2026-05-26', text: '昨天任务', completed: false, priority: 'P0', sortOrder: 0, createdAt: '2026-05-26 09:00', updatedAt: '2026-05-26 09:00' }],
      snippets: [],
      journal: null,
    })

  window.api.workspace.listDay = listDay

  render(<TodoPage />)

  expect(await screen.findByText('今天任务')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '查看前一天 2026-05-26' }))
  expect(await screen.findByText('昨天任务')).toBeInTheDocument()
})
```

```tsx
// src/renderer/src/pages/SnippetsPage.test.tsx
it('切换日期后重新加载片段', async () => {
  const listDay = vi
    .fn()
    .mockResolvedValueOnce({
      todos: [],
      snippets: [{ id: 1, entryDate: '2026-05-27', title: '今天片段', content: 'A', tags: ['记录'], time: '09:00', createdAt: '2026-05-27 09:00', updatedAt: '2026-05-27 09:00' }],
      journal: null,
    })
    .mockResolvedValueOnce({
      todos: [],
      snippets: [{ id: 2, entryDate: '2026-05-26', title: '昨天片段', content: 'B', tags: ['回看'], time: '09:00', createdAt: '2026-05-26 09:00', updatedAt: '2026-05-26 09:00' }],
      journal: null,
    })

  window.api.workspace.listDay = listDay

  render(<SnippetsPage />)

  expect(await screen.findByText('今天片段')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '查看前一天 2026-05-26' }))
  expect(await screen.findByText('昨天片段')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the page tests to confirm the shared date controls do not exist yet**

Run: `pnpm test -- src/renderer/src/pages/JournalPage.test.tsx src/renderer/src/pages/TodoPage.test.tsx src/renderer/src/pages/SnippetsPage.test.tsx`

Expected: FAIL because the pages still render `COMING SOON` and there is no `查看前一天 ...` button.

- [ ] **Step 3: Add the shared date helpers and generic UI primitives**

```tsx
// src/renderer/src/pages/components/workspacePageShared.ts
// 页面日期工具函数，供三页复用。
export const createTodayEntryDate = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${date}`
}

// 把 YYYY-MM-DD 转成供头部和卡片展示的紧凑标签。
export const formatEntryDateLabel = (entryDate: string): string => {
  const [year, month, date] = entryDate.split('-')
  return `${year}.${month}.${date}`
}

// 计算前后一天的 entryDate。
export const shiftEntryDate = (entryDate: string, offsetDays: number): string => {
  const baseDate = new Date(`${entryDate}T00:00:00`)
  baseDate.setDate(baseDate.getDate() + offsetDays)

  const year = baseDate.getFullYear()
  const month = String(baseDate.getMonth() + 1).padStart(2, '0')
  const date = String(baseDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${date}`
}

// 没有 preload bridge 的测试 / 预览环境保护。
export const hasWorkspaceBridge = (): boolean => Boolean(window.api?.workspace)
```

```tsx
// src/renderer/src/components/ui/PageDateNavigator.tsx
import type React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from '@renderer/components/ui/IconButton'
import { formatEntryDateLabel, shiftEntryDate } from '@renderer/pages/components/workspacePageShared'

interface PageDateNavigatorProps {
  entryDate: string
  label: string
  onChange: (nextDate: string) => void
}

/**
 * PageDateNavigator - 页面顶部日期切换器。
 */
export const PageDateNavigator = ({
  entryDate,
  label,
  onChange,
}: PageDateNavigatorProps): React.JSX.Element => {
  const previousDate = shiftEntryDate(entryDate, -1)
  const nextDate = shiftEntryDate(entryDate, 1)

  return (
    <div className="flex items-center justify-between rounded-[6px] border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/30">{label}</p>
        <p className="text-sm font-semibold text-white/88">{formatEntryDateLabel(entryDate)}</p>
      </div>
      <div className="flex items-center gap-1">
        <IconButton
          aria-label={`查看前一天 ${previousDate}`}
          className="h-8 w-8 bg-white/[0.03] text-white/60 hover:bg-white/[0.08] hover:text-white"
          onClick={() => onChange(previousDate)}
        >
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <IconButton
          aria-label={`查看后一天 ${nextDate}`}
          className="h-8 w-8 bg-white/[0.03] text-white/60 hover:bg-white/[0.08] hover:text-white"
          onClick={() => onChange(nextDate)}
        >
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  )
}
```

```tsx
// src/renderer/src/components/ui/EmptyState.tsx
import type React from 'react'

interface EmptyStateProps {
  title: string
  description: string
  action?: React.ReactNode
}

/**
 * EmptyState - 通用空状态卡片。
 */
export const EmptyState = ({
  title,
  description,
  action,
}: EmptyStateProps): React.JSX.Element => (
  <div className="rounded-[6px] border border-dashed border-white/10 bg-white/[0.015] px-4 py-5">
    <p className="text-sm font-semibold text-white/82">{title}</p>
    <p className="mt-1 text-xs leading-5 text-white/42">{description}</p>
    {action ? <div className="mt-3">{action}</div> : null}
  </div>
)
```

- [ ] **Step 4: Re-run the page tests for the shared date controls**

Run: `pnpm test -- src/renderer/src/pages/JournalPage.test.tsx src/renderer/src/pages/TodoPage.test.tsx src/renderer/src/pages/SnippetsPage.test.tsx`

Expected: still FAIL, but now the failures should be about the page bodies / CRUD behavior, not about missing date primitives.

### Task 2: Build JournalPage With Autosave CRUD

**Files:**
- Create: `src/renderer/src/pages/components/JournalDateRail.tsx`
- Create: `src/renderer/src/pages/components/JournalEditorSurface.tsx`
- Modify: `src/renderer/src/pages/JournalPage.tsx`
- Test: `src/renderer/src/pages/JournalPage.test.tsx`

- [ ] **Step 1: Write the failing Journal CRUD tests**

```tsx
// src/renderer/src/pages/JournalPage.test.tsx
vi.mock('@uiw/react-md-editor', () => ({
  default: ({ value, onChange, textareaProps }: { value?: string; onChange?: (value?: string) => void; textareaProps?: React.TextareaHTMLAttributes<HTMLTextAreaElement> }) => (
    <textarea
      aria-label={textareaProps?.['aria-label'] ?? '日记正文'}
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value)}
      onBlur={textareaProps?.onBlur}
    />
  ),
}))

it('输入日记后自动保存并刷新保存时间', async () => {
  vi.useFakeTimers()
  const saveJournal = vi.fn().mockResolvedValue({
    entryDate: '2026-05-27',
    content: '新的内容',
    createdAt: '2026-05-27 09:00',
    updatedAt: '2026-05-27 09:35',
  })

  window.api.workspace = {
    ...window.api.workspace,
    listDay: vi.fn().mockResolvedValue({ todos: [], snippets: [], journal: null }),
    saveJournal,
    deleteJournal: vi.fn(),
  }

  render(<JournalPage />)

  await userEvent.type(await screen.findByLabelText('日记正文'), '新的内容')
  await act(async () => {
    vi.advanceTimersByTime(700)
  })

  await waitFor(() => {
    expect(saveJournal).toHaveBeenCalledWith({ entryDate: '2026-05-27', content: '新的内容' })
  })
  expect(screen.getByText(/最近保存/)).toHaveTextContent('09:35')
})

it('清空正文后调用删除接口', async () => {
  vi.useFakeTimers()
  const deleteJournal = vi.fn().mockResolvedValue(undefined)

  window.api.workspace = {
    ...window.api.workspace,
    listDay: vi.fn().mockResolvedValue({
      todos: [],
      snippets: [],
      journal: {
        entryDate: '2026-05-27',
        content: '旧内容',
        createdAt: '2026-05-27 09:00',
        updatedAt: '2026-05-27 09:05',
      },
    }),
    saveJournal: vi.fn(),
    deleteJournal,
  }

  render(<JournalPage />)

  const editor = await screen.findByLabelText('日记正文')
  await userEvent.clear(editor)
  await act(async () => {
    vi.advanceTimersByTime(700)
  })

  await waitFor(() => {
    expect(deleteJournal).toHaveBeenCalledWith('2026-05-27')
  })
})
```

- [ ] **Step 2: Run the Journal tests to verify the page still fails**

Run: `pnpm test -- src/renderer/src/pages/JournalPage.test.tsx`

Expected: FAIL because `JournalPage.tsx` still contains the placeholder section and no CRUD logic.

- [ ] **Step 3: Implement the Journal page-specific components and page state**

```tsx
// src/renderer/src/pages/components/JournalDateRail.tsx
import type React from 'react'
import { BookOpen, Clock3, Focus, Sparkles, Trash2 } from 'lucide-react'
import { IconButton } from '@renderer/components/ui/IconButton'

interface JournalDateRailProps {
  entryDate: string
  wordCount: number
  lastSavedAt: string | null
  moodLabel: string
  isDirty: boolean
  onClear: () => void
  onFocusEditor: () => void
}

/**
 * JournalDateRail - 日记页左侧日期脊柱和状态摘要。
 */
export const JournalDateRail = ({
  entryDate,
  wordCount,
  lastSavedAt,
  moodLabel,
  isDirty,
  onClear,
  onFocusEditor,
}: JournalDateRailProps): React.JSX.Element => (
  <aside className="flex flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/28">Journal Spine</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{entryDate}</p>
    </div>
    <div className="grid gap-2">
      <div className="rounded-[6px] border border-white/8 bg-black/30 p-3">
        <div className="flex items-center gap-2 text-white/72"><BookOpen className="h-3.5 w-3.5" />字数</div>
        <p className="mt-2 text-lg font-semibold text-white">{wordCount}</p>
      </div>
      <div className="rounded-[6px] border border-white/8 bg-black/30 p-3">
        <div className="flex items-center gap-2 text-white/72"><Clock3 className="h-3.5 w-3.5" />最近保存</div>
        <p className="mt-2 text-sm text-white/84">{lastSavedAt ?? '未保存'}</p>
      </div>
      <div className="rounded-[6px] border border-white/8 bg-black/30 p-3">
        <div className="flex items-center gap-2 text-white/72"><Sparkles className="h-3.5 w-3.5" />情绪线索</div>
        <p className="mt-2 text-sm text-white/84">{moodLabel}</p>
      </div>
    </div>
    <div className="mt-auto flex items-center gap-2">
      <IconButton aria-label="聚焦日记编辑器" iconOnly={false} className="h-9 px-3 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white" onClick={onFocusEditor}>
        <Focus className="mr-1.5 h-3.5 w-3.5" />
        聚焦
      </IconButton>
      <IconButton aria-label="清空当日日记" iconOnly={false} className="h-9 px-3 bg-white/5 text-white/70 hover:bg-white/10 hover:text-rose-300" onClick={onClear}>
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        {isDirty ? '清空草稿' : '清空'}
      </IconButton>
    </div>
  </aside>
)
```

```tsx
// src/renderer/src/pages/components/JournalEditorSurface.tsx
import type React from 'react'
import { useState } from 'react'
import MDEditor from '@uiw/react-md-editor'
import { Columns2 } from 'lucide-react'
import { IconButton } from '@renderer/components/ui/IconButton'

interface JournalEditorSurfaceProps {
  value: string
  statusText: string
  errorMessage: string | null
  onChange: (value: string) => void
  onBlur: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

/**
 * JournalEditorSurface - 日记页右侧沉浸编辑器。
 */
export const JournalEditorSurface = ({
  value,
  statusText,
  errorMessage,
  onChange,
  onBlur,
}: JournalEditorSurfaceProps): React.JSX.Element => {
  const [previewMode, setPreviewMode] = useState<'edit' | 'live'>('edit')

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-[6px] border border-white/6 bg-[#212121] p-4">
      <div className="mb-3 flex items-center justify-between border-b border-white/6 pb-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/28">Long-form Entry</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">日记条目回看</h2>
        </div>
        <IconButton
          aria-label="切换双栏预览"
          className="h-8 w-8 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
          onClick={() => setPreviewMode((currentMode) => (currentMode === 'edit' ? 'live' : 'edit'))}
        >
          <Columns2 className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[6px] border border-white/6 bg-black/25 p-2">
        <MDEditor
          value={value}
          preview={previewMode}
          visibleDragbar={false}
          height={560}
          textareaProps={{ 'aria-label': '日记正文', onBlur }}
          onChange={(nextValue) => onChange(nextValue ?? '')}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className={errorMessage ? 'text-rose-300' : 'text-white/38'}>{errorMessage ?? statusText}</span>
        <span className="text-white/30">{value.length} 字</span>
      </div>
    </section>
  )
}
```

```tsx
// src/renderer/src/pages/JournalPage.tsx
import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@renderer/components/ui/Toast'
import { PageDateNavigator } from '@renderer/components/ui/PageDateNavigator'
import { JournalDateRail } from '@renderer/pages/components/JournalDateRail'
import { JournalEditorSurface } from '@renderer/pages/components/JournalEditorSurface'
import { createTodayEntryDate, hasWorkspaceBridge } from '@renderer/pages/components/workspacePageShared'

/**
 * JournalPage 组件 - 单日日记的沉浸书写与回看。
 */
export const JournalPage = (): React.JSX.Element => {
  const toast = useToast()
  const [entryDate, setEntryDate] = useState<string>(() => createTodayEntryDate())
  const [journalContent, setJournalContent] = useState<string>('')
  const [savedJournalContent, setSavedJournalContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const persistRef = useRef<(rawValue: string) => Promise<void>>(async () => undefined)

  useEffect(() => {
    const loadJournal = async (): Promise<void> => {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        if (!hasWorkspaceBridge()) {
          setJournalContent('')
          setSavedJournalContent('')
          setLastSavedAt(null)
          return
        }

        const workspace = await window.api.workspace.listDay(entryDate)
        const nextValue = workspace.journal?.content ?? ''
        setJournalContent(nextValue)
        setSavedJournalContent(nextValue)
        setLastSavedAt(workspace.journal?.updatedAt ?? null)
      } catch (error) {
        setErrorMessage('读取日记失败，请稍后再试。')
        toast.error('读取日记失败')
      } finally {
        setIsLoading(false)
      }
    }

    void loadJournal()
  }, [entryDate, toast])

  persistRef.current = async (rawValue: string): Promise<void> => {
    const normalizedValue = rawValue.trim()
    if (normalizedValue === savedJournalContent.trim()) {
      return
    }

    setIsSaving(true)
    setErrorMessage(null)
    try {
      if (!hasWorkspaceBridge()) {
        setSavedJournalContent(normalizedValue)
        setLastSavedAt(normalizedValue ? `${entryDate} 00:00` : null)
        return
      }

      if (!normalizedValue) {
        await window.api.workspace.deleteJournal(entryDate)
        setSavedJournalContent('')
        setLastSavedAt(null)
        return
      }

      const saved = await window.api.workspace.saveJournal({ entryDate, content: normalizedValue })
      setSavedJournalContent(saved.content)
      setLastSavedAt(saved.updatedAt)
    } catch (error) {
      setErrorMessage('自动保存失败，内容已保留在当前页面。')
      toast.error('自动保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (isLoading) {
      return
    }
    const timer = window.setTimeout(() => {
      void persistRef.current(journalContent)
    }, 650)

    return () => window.clearTimeout(timer)
  }, [isLoading, journalContent])

  const moodLabel = useMemo(() => {
    if (journalContent.includes('焦虑')) return '紧绷'
    if (journalContent.includes('推进')) return '专注'
    return '平稳'
  }, [journalContent])

  return (
    <section aria-label="Journal 页面" className="flex h-full min-h-0 flex-col gap-3 text-white">
      <PageDateNavigator entryDate={entryDate} label="Journal" onChange={setEntryDate} />
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <JournalDateRail
          entryDate={entryDate}
          wordCount={journalContent.length}
          lastSavedAt={lastSavedAt}
          moodLabel={moodLabel}
          isDirty={journalContent.trim() !== savedJournalContent.trim()}
          onClear={() => setJournalContent('')}
          onFocusEditor={() => {
            const element = document.querySelector<HTMLTextAreaElement>('[aria-label=\"日记正文\"]')
            element?.focus()
          }}
        />
        <JournalEditorSurface
          value={journalContent}
          statusText={isLoading ? '正在读取日记...' : isSaving ? '正在自动保存...' : '自动保存已开启'}
          errorMessage={errorMessage}
          onChange={setJournalContent}
          onBlur={() => {
            void persistRef.current(journalContent)
          }}
          textareaRef={{ current: null }}
        />
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run the Journal tests and fix until they pass**

Run: `pnpm test -- src/renderer/src/pages/JournalPage.test.tsx`

Expected: PASS with the autosave and delete-path tests green.

### Task 3: Build TodoPage With Control Tower CRUD

**Files:**
- Create: `src/renderer/src/pages/components/TodoControlTower.tsx`
- Modify: `src/renderer/src/pages/TodoPage.tsx`
- Test: `src/renderer/src/pages/TodoPage.test.tsx`

- [ ] **Step 1: Write the failing Todo CRUD tests**

```tsx
// src/renderer/src/pages/TodoPage.test.tsx
it('支持新增、切换完成、切换优先级和删除待办', async () => {
  const listDay = vi.fn().mockResolvedValue({
    todos: [
      { id: 1, entryDate: '2026-05-27', text: '旧任务', completed: false, priority: 'P1', sortOrder: 0, createdAt: '2026-05-27 09:00', updatedAt: '2026-05-27 09:00' },
    ],
    snippets: [],
    journal: null,
  })
  const createTodo = vi.fn().mockResolvedValue({
    id: 2,
    entryDate: '2026-05-27',
    text: '新任务',
    completed: false,
    priority: 'P2',
    sortOrder: 1,
    createdAt: '2026-05-27 09:30',
    updatedAt: '2026-05-27 09:30',
  })
  const updateTodo = vi.fn().mockResolvedValue({
    id: 1,
    entryDate: '2026-05-27',
    text: '旧任务',
    completed: true,
    priority: 'P0',
    sortOrder: 0,
    createdAt: '2026-05-27 09:00',
    updatedAt: '2026-05-27 09:40',
  })
  const deleteTodo = vi.fn().mockResolvedValue(undefined)

  window.api.workspace = {
    ...window.api.workspace,
    listDay,
    createTodo,
    updateTodo,
    deleteTodo,
    sortTodos: vi.fn().mockResolvedValue([]),
  }

  render(<TodoPage />)

  await userEvent.type(await screen.findByPlaceholderText('添加一个待办，回车保存'), '新任务{enter}')
  await waitFor(() => expect(createTodo).toHaveBeenCalled())

  await userEvent.click(screen.getByRole('button', { name: '标记为已完成' }))
  await waitFor(() => expect(updateTodo).toHaveBeenCalled())

  await userEvent.click(screen.getByRole('button', { name: /切换 旧任务 的优先级/ }))
  await waitFor(() => expect(updateTodo).toHaveBeenCalledTimes(2))

  await userEvent.click(screen.getByRole('button', { name: '删除待办 旧任务' }))
  await waitFor(() => expect(deleteTodo).toHaveBeenCalledWith(1))
})
```

- [ ] **Step 2: Run the Todo tests to prove the page is still missing**

Run: `pnpm test -- src/renderer/src/pages/TodoPage.test.tsx`

Expected: FAIL because the placeholder page does not expose the todo composer or CRUD controls.

- [ ] **Step 3: Implement the Todo page and right-side control tower**

```tsx
// src/renderer/src/pages/components/TodoControlTower.tsx
import type React from 'react'
import { CheckCircle2, ListTodo, Layers3 } from 'lucide-react'
import { IconButton } from '@renderer/components/ui/IconButton'

interface TodoControlTowerProps {
  totalCount: number
  completedCount: number
  p0Count: number
  onSort: () => void
}

/**
 * TodoControlTower - 待办页右侧统计和动作侧栏。
 */
export const TodoControlTower = ({
  totalCount,
  completedCount,
  p0Count,
  onSort,
}: TodoControlTowerProps): React.JSX.Element => (
  <aside className="flex flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
    <div className="rounded-[6px] border border-white/8 bg-black/30 p-3">
      <div className="flex items-center gap-2 text-white/70"><ListTodo className="h-3.5 w-3.5" />总任务</div>
      <p className="mt-2 text-2xl font-semibold text-white">{totalCount}</p>
    </div>
    <div className="rounded-[6px] border border-white/8 bg-black/30 p-3">
      <div className="flex items-center gap-2 text-white/70"><CheckCircle2 className="h-3.5 w-3.5" />已完成</div>
      <p className="mt-2 text-2xl font-semibold text-white">{completedCount}</p>
    </div>
    <div className="rounded-[6px] border border-white/8 bg-black/30 p-3">
      <div className="flex items-center gap-2 text-white/70"><Layers3 className="h-3.5 w-3.5" />P0 聚焦</div>
      <p className="mt-2 text-2xl font-semibold text-white">{p0Count}</p>
    </div>
    <IconButton
      aria-label="重新排序待办"
      iconOnly={false}
      className="h-9 justify-center bg-white/5 px-3 text-white/70 hover:bg-white/10 hover:text-white"
      onClick={onSort}
    >
      重新排序
    </IconButton>
  </aside>
)
```

```tsx
// src/renderer/src/pages/TodoPage.tsx
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '@renderer/components/ui/EmptyState'
import { PageDateNavigator } from '@renderer/components/ui/PageDateNavigator'
import { useToast } from '@renderer/components/ui/Toast'
import { TodayTodoPanel } from '@renderer/pages/components/TodayTodoPanel'
import { TodoControlTower } from '@renderer/pages/components/TodoControlTower'
import { createTodayEntryDate, hasWorkspaceBridge } from '@renderer/pages/components/workspacePageShared'

/**
 * TodoPage 组件 - 单日待办执行控制台。
 */
export const TodoPage = (): React.JSX.Element => {
  const toast = useToast()
  const [entryDate, setEntryDate] = useState<string>(() => createTodayEntryDate())
  const [todos, setTodos] = useState<WorkspaceTodoItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const loadTodos = async (): Promise<void> => {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        if (!hasWorkspaceBridge()) {
          setTodos([])
          return
        }

        const workspace = await window.api.workspace.listDay(entryDate)
        setTodos(workspace.todos)
      } catch (error) {
        setErrorMessage('读取待办失败，请稍后再试。')
        toast.error('读取待办失败')
      } finally {
        setIsLoading(false)
      }
    }

    void loadTodos()
  }, [entryDate, toast])

  const completedCount = useMemo(() => todos.filter((todo) => todo.completed).length, [todos])
  const p0Count = useMemo(() => todos.filter((todo) => !todo.completed && todo.priority === 'P0').length, [todos])

  return (
    <section aria-label="Todo 页面" className="flex h-full min-h-0 flex-col gap-3 text-white">
      <PageDateNavigator entryDate={entryDate} label="Todo" onChange={setEntryDate} />
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        {todos.length === 0 && !isLoading ? (
          <EmptyState title="这一天还没有待办" description="从最重要的一件事开始，回车即保存。" />
        ) : (
          <TodayTodoPanel
            todos={todos}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onCreateTodo={async (draft) => {
              const created = await window.api.workspace.createTodo({ entryDate, ...draft })
              setTodos((currentTodos) => [created, ...currentTodos])
              return true
            }}
            onUpdateTodo={async (id, patch) => {
              const updated = await window.api.workspace.updateTodo(id, patch)
              setTodos((currentTodos) => currentTodos.map((todo) => (todo.id === id ? updated : todo)))
              return true
            }}
            onDeleteTodo={async (id) => {
              await window.api.workspace.deleteTodo(id)
              setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id))
              return true
            }}
            onSortTodos={async () => {
              const reordered = await window.api.workspace.sortTodos({ entryDate, ids: todos.map((todo) => todo.id) })
              setTodos(reordered)
              return true
            }}
          />
        )}
        <TodoControlTower totalCount={todos.length} completedCount={completedCount} p0Count={p0Count} onSort={() => void 0} />
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run the Todo tests and adjust the page until they pass**

Run: `pnpm test -- src/renderer/src/pages/TodoPage.test.tsx`

Expected: PASS with create / update / delete coverage green.

### Task 4: Build SnippetsPage With Tag Map And Detail Drawer

**Files:**
- Create: `src/renderer/src/pages/components/SnippetsTagMap.tsx`
- Create: `src/renderer/src/pages/components/SnippetDetailDrawer.tsx`
- Modify: `src/renderer/src/pages/SnippetsPage.tsx`
- Test: `src/renderer/src/pages/SnippetsPage.test.tsx`

- [ ] **Step 1: Write the failing Snippets CRUD and tag-filter tests**

```tsx
// src/renderer/src/pages/SnippetsPage.test.tsx
it('支持按标签筛选并编辑片段', async () => {
  const updateSnippet = vi.fn().mockResolvedValue({
    id: 1,
    entryDate: '2026-05-27',
    title: '更新后的片段',
    content: '更新内容',
    tags: ['产品'],
    time: '09:30',
    createdAt: '2026-05-27 09:00',
    updatedAt: '2026-05-27 09:30',
  })

  window.api.workspace = {
    ...window.api.workspace,
    listDay: vi.fn().mockResolvedValue({
      todos: [],
      snippets: [
        { id: 1, entryDate: '2026-05-27', title: '产品想法', content: 'A', tags: ['产品'], time: '09:00', createdAt: '2026-05-27 09:00', updatedAt: '2026-05-27 09:00' },
        { id: 2, entryDate: '2026-05-27', title: '技术笔记', content: 'B', tags: ['技术'], time: '09:10', createdAt: '2026-05-27 09:10', updatedAt: '2026-05-27 09:10' },
      ],
      journal: null,
    }),
    createSnippet: vi.fn(),
    updateSnippet,
    deleteSnippet: vi.fn(),
  }

  render(<SnippetsPage />)

  expect(await screen.findByText('产品想法')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '筛选标签 产品' }))
  expect(screen.queryByText('技术笔记')).not.toBeInTheDocument()

  await userEvent.click(screen.getByText('产品想法'))
  await userEvent.clear(screen.getByLabelText('片段标题'))
  await userEvent.type(screen.getByLabelText('片段标题'), '更新后的片段')
  await userEvent.clear(screen.getByLabelText('片段正文'))
  await userEvent.type(screen.getByLabelText('片段正文'), '更新内容')
  await userEvent.click(screen.getByRole('button', { name: '保存片段' }))

  await waitFor(() => {
    expect(updateSnippet).toHaveBeenCalledWith(1, {
      title: '更新后的片段',
      content: '更新内容',
      tags: ['产品'],
    })
  })
})
```

- [ ] **Step 2: Run the Snippets tests to verify failure on the placeholder page**

Run: `pnpm test -- src/renderer/src/pages/SnippetsPage.test.tsx`

Expected: FAIL because no tag filter, card flow or detail editor exists yet.

- [ ] **Step 3: Implement the snippets tag map, detail drawer and page CRUD**

```tsx
// src/renderer/src/pages/components/SnippetsTagMap.tsx
import type React from 'react'
import { Tag } from '@renderer/components/ui/Tag'

interface SnippetsTagMapProps {
  tags: Array<{ value: string; count: number }>
  activeTag: string | null
  onChange: (tag: string | null) => void
}

/**
 * SnippetsTagMap - 片段页左侧标签地图。
 */
export const SnippetsTagMap = ({
  tags,
  activeTag,
  onChange,
}: SnippetsTagMapProps): React.JSX.Element => (
  <aside className="flex flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/28">Tag Map</p>
      <p className="mt-1 text-sm text-white/82">按标签切片查看当天片段。</p>
    </div>
    <button
      type="button"
      className="rounded-[6px] border border-white/8 bg-black/25 px-3 py-2 text-left text-sm text-white/84"
      onClick={() => onChange(null)}
    >
      全部片段
    </button>
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <Tag
          key={tag.value}
          highlighted={activeTag === tag.value}
          onClick={() => onChange(tag.value)}
          className="cursor-pointer"
        >
          {tag.value} · {tag.count}
        </Tag>
      ))}
    </div>
  </aside>
)
```

```tsx
// src/renderer/src/pages/components/SnippetDetailDrawer.tsx
import type React from 'react'
import { useMemo, useState } from 'react'
import { IconButton } from '@renderer/components/ui/IconButton'

interface SnippetDetailDrawerProps {
  selectedSnippet: WorkspaceSnippetItem | null
  onCreate: (draft: { title: string; content: string; tags: string[] }) => Promise<void>
  onSave: (id: number, draft: { title: string; content: string; tags: string[] }) => Promise<void>
}

const parseTags = (rawValue: string): string[] =>
  rawValue
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)

/**
 * SnippetDetailDrawer - 片段详情抽屉。
 */
export const SnippetDetailDrawer = ({
  selectedSnippet,
  onCreate,
  onSave,
}: SnippetDetailDrawerProps): React.JSX.Element => {
  const [title, setTitle] = useState<string>(selectedSnippet?.title ?? '')
  const [content, setContent] = useState<string>(selectedSnippet?.content ?? '')
  const [tagsText, setTagsText] = useState<string>((selectedSnippet?.tags ?? []).join(', '))

  const isEditing = Boolean(selectedSnippet)
  const currentTags = useMemo(() => parseTags(tagsText), [tagsText])

  return (
    <aside className="flex min-h-0 flex-col rounded-[6px] border border-white/6 bg-[#212121] p-4">
      <label className="text-xs text-white/40" htmlFor="snippet-title">片段标题</label>
      <input id="snippet-title" aria-label="片段标题" className="mt-1 rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={title} onChange={(event) => setTitle(event.target.value)} />
      <label className="mt-3 text-xs text-white/40" htmlFor="snippet-content">片段正文</label>
      <textarea id="snippet-content" aria-label="片段正文" className="mt-1 min-h-[220px] rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={content} onChange={(event) => setContent(event.target.value)} />
      <label className="mt-3 text-xs text-white/40" htmlFor="snippet-tags">标签</label>
      <input id="snippet-tags" aria-label="片段标签" className="mt-1 rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={tagsText} onChange={(event) => setTagsText(event.target.value)} />
      <div className="mt-4">
        <IconButton
          aria-label={isEditing ? '保存片段' : '创建片段'}
          iconOnly={false}
          className="h-9 w-full justify-center bg-white text-black hover:bg-white/90"
          onClick={() => {
            const payload = { title: title.trim(), content: content.trim(), tags: currentTags }
            if (selectedSnippet) {
              void onSave(selectedSnippet.id, payload)
              return
            }
            void onCreate(payload)
          }}
        >
          {isEditing ? '保存片段' : '创建片段'}
        </IconButton>
      </div>
    </aside>
  )
}
```

```tsx
// src/renderer/src/pages/SnippetsPage.tsx
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '@renderer/components/ui/EmptyState'
import { PageDateNavigator } from '@renderer/components/ui/PageDateNavigator'
import { useToast } from '@renderer/components/ui/Toast'
import { SnippetDetailDrawer } from '@renderer/pages/components/SnippetDetailDrawer'
import { SnippetsTagMap } from '@renderer/pages/components/SnippetsTagMap'
import { createTodayEntryDate, hasWorkspaceBridge } from '@renderer/pages/components/workspacePageShared'

/**
 * SnippetsPage 组件 - 当日片段档案页。
 */
export const SnippetsPage = (): React.JSX.Element => {
  const toast = useToast()
  const [entryDate, setEntryDate] = useState<string>(() => createTodayEntryDate())
  const [snippets, setSnippets] = useState<WorkspaceSnippetItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const loadSnippets = async (): Promise<void> => {
      setIsLoading(true)
      try {
        if (!hasWorkspaceBridge()) {
          setSnippets([])
          return
        }

        const workspace = await window.api.workspace.listDay(entryDate)
        setSnippets(workspace.snippets)
        setSelectedId(workspace.snippets[0]?.id ?? null)
      } catch (error) {
        toast.error('读取片段失败')
      } finally {
        setIsLoading(false)
      }
    }

    void loadSnippets()
  }, [entryDate, toast])

  const visibleSnippets = useMemo(
    () => (activeTag ? snippets.filter((snippet) => snippet.tags.includes(activeTag)) : snippets),
    [activeTag, snippets],
  )
  const tagItems = useMemo(() => {
    const counts = new Map<string, number>()
    snippets.forEach((snippet) => {
      snippet.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1))
    })
    return [...counts.entries()].map(([value, count]) => ({ value, count }))
  }, [snippets])
  const selectedSnippet = visibleSnippets.find((snippet) => snippet.id === selectedId) ?? null

  return (
    <section aria-label="随记 页面" className="flex h-full min-h-0 flex-col gap-3 text-white">
      <PageDateNavigator entryDate={entryDate} label="Snippets" onChange={setEntryDate} />
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        <SnippetsTagMap tags={tagItems} activeTag={activeTag} onChange={setActiveTag} />
        <div className="min-h-0 overflow-y-auto rounded-[6px] border border-white/6 bg-[#212121] p-4">
          {visibleSnippets.length === 0 && !isLoading ? (
            <EmptyState title="这一天还没有片段" description="从零散想法里挑一条值得保存的记录。" />
          ) : (
            <div className="grid gap-3">
              {visibleSnippets.map((snippet) => (
                <button
                  key={snippet.id}
                  type="button"
                  className="rounded-[6px] border border-white/8 bg-black/25 p-3 text-left hover:border-white/18"
                  onClick={() => setSelectedId(snippet.id)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white/86">{snippet.title}</p>
                    <span className="text-[10px] font-mono text-white/30">{snippet.updatedAt}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/46">{snippet.content}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <SnippetDetailDrawer
          selectedSnippet={selectedSnippet}
          onCreate={async (draft) => {
            const created = await window.api.workspace.createSnippet({ entryDate, ...draft })
            setSnippets((currentSnippets) => [created, ...currentSnippets])
            setSelectedId(created.id)
          }}
          onSave={async (id, draft) => {
            const updated = await window.api.workspace.updateSnippet(id, draft)
            setSnippets((currentSnippets) => currentSnippets.map((snippet) => (snippet.id === id ? updated : snippet)))
          }}
        />
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run the Snippets tests and keep fixing until they pass**

Run: `pnpm test -- src/renderer/src/pages/SnippetsPage.test.tsx`

Expected: PASS with tag filtering and update flow covered.

### Task 5: Route-Level Regression And Full Verification

**Files:**
- Modify: `src/renderer/src/App.test.tsx`
- Test: `src/renderer/src/pages/JournalPage.test.tsx`
- Test: `src/renderer/src/pages/TodoPage.test.tsx`
- Test: `src/renderer/src/pages/SnippetsPage.test.tsx`

- [ ] **Step 1: Replace the old route assertions that expect placeholder screens**

```tsx
// src/renderer/src/App.test.tsx
it('Journal / Todo / Snippets 路由进入正式页面而不是占位文案', async () => {
  const user = userEvent.setup()

  render(<App />)

  await user.click(screen.getByRole('button', { name: /Journal/ }))
  expect(screen.getByRole('button', { name: /查看前一天/ })).toBeInTheDocument()
  expect(screen.queryByText(/COMING SOON/)).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Todo/ }))
  expect(screen.getByPlaceholderText('添加一个待办，回车保存')).toBeInTheDocument()
  expect(screen.queryByText(/COMING SOON/)).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Snippets/ }))
  expect(screen.getByText('全部片段')).toBeInTheDocument()
  expect(screen.queryByText(/COMING SOON/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the route regression test**

Run: `pnpm test -- src/renderer/src/App.test.tsx`

Expected: PASS with the new route expectations.

- [ ] **Step 3: Run all newly added renderer tests together**

Run: `pnpm test -- src/renderer/src/pages/JournalPage.test.tsx src/renderer/src/pages/TodoPage.test.tsx src/renderer/src/pages/SnippetsPage.test.tsx src/renderer/src/App.test.tsx`

Expected: PASS with zero failures.

- [ ] **Step 4: Run the full type check before claiming completion**

Run: `pnpm typecheck`

Expected: PASS with zero TypeScript errors.

## Self-Review

- Spec coverage:
  - 日期切换：Task 1 + Task 2/3/4。
  - Journal 沉浸布局和自动保存：Task 2。
  - Todo 执行页与右侧统计：Task 3。
  - Snippets 标签筛选、卡片流、详情抽屉：Task 4。
  - 路由回归和整体验证：Task 5。
- Placeholder scan:
  - 无 `TBD`、`TODO`、`implement later` 等占位语句。
- Type consistency:
  - 统一使用现有 `WorkspaceTodoItem`、`WorkspaceSnippetItem`、`WorkspaceJournalItem` 和 `window.api.workspace.*` 签名。

