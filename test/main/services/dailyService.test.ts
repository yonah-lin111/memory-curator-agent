import { beforeEach, describe, expect, it } from 'vitest'
import type { JournalRow, SnippetRow, TodoRow } from '../../../src/main/db/schema'
import { createDailyService, type DatabaseConnection, type DatabaseStatement } from '../../../src/main/services/dailyService'

// 测试数据库连接。
let sqlite: MemoryDailyDatabase

// 内存 Daily 数据库。
class MemoryDailyDatabase implements DatabaseConnection {
  // 内存待办行。
  private todoRows: TodoRow[] = []

  // 内存片段行。
  private snippetRows: SnippetRow[] = []

  // 内存日记行。
  private journalRows: JournalRow[] = []

  // 待办自增主键游标。
  private nextTodoId = 1

  // 片段自增主键游标。
  private nextSnippetId = 1

  /**
   * 准备内存 SQL 语句。
   */
  prepare = (sql: string): DatabaseStatement => {
    if (
      sql.startsWith(
        'SELECT id, entry_date, text, priority, completed, sort_order, created_at, updated_at FROM todos WHERE entry_date = ? ORDER BY'
      )
    ) {
      return {
        all: (...values) =>
          this.todoRows
            .filter((row) => row.entry_date === values[0])
            .sort(
              (left, right) =>
                left.completed - right.completed ||
                left.sort_order - right.sort_order ||
                left.created_at.localeCompare(right.created_at)
            ),
        get: () => undefined,
        run: () => undefined
      }
    }

    if (sql.startsWith('SELECT entry_date, COUNT(*) AS item_count FROM todos WHERE entry_date LIKE ? GROUP BY entry_date')) {
      return {
        all: (...values) => {
          const monthPattern = String(values[0]).replace('%', '')
          const counts = new Map<string, number>()

          this.todoRows
            .filter((row) => row.entry_date.startsWith(monthPattern))
            .forEach((row) => counts.set(row.entry_date, (counts.get(row.entry_date) ?? 0) + 1))

          return [...counts.entries()].map(([entry_date, item_count]) => ({
            entry_date,
            item_count
          }))
        },
        get: () => undefined,
        run: () => undefined
      }
    }

    if (sql.startsWith('SELECT MAX(sort_order) AS max_sort_order FROM todos WHERE entry_date = ?')) {
      return {
        all: () => [],
        get: (...values) => {
          const rows = this.todoRows.filter((row) => row.entry_date === values[0])
          const maxSortOrder = rows.length === 0 ? null : Math.max(...rows.map((row) => row.sort_order))

          return { max_sort_order: maxSortOrder }
        },
        run: () => undefined
      }
    }

    if (sql.startsWith('INSERT INTO todos')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          const insertedId = this.nextTodoId
          this.nextTodoId += 1
          this.todoRows.push({
            id: insertedId,
            entry_date: values[0] as string,
            text: values[1] as string,
            priority: values[2] as TodoRow['priority'],
            completed: values[3] as number,
            sort_order: values[4] as number,
            created_at: values[5] as string,
            updated_at: values[6] as string
          })

          return { lastInsertRowid: insertedId }
        }
      }
    }

    if (
      sql.startsWith(
        'SELECT id, entry_date, text, priority, completed, sort_order, created_at, updated_at FROM todos WHERE id = ?'
      )
    ) {
      return {
        all: () => [],
        get: (...values) => this.todoRows.find((row) => row.id === values[0]),
        run: () => undefined
      }
    }

    if (sql.startsWith('UPDATE todos SET text = ?, priority = ?, completed = ?, updated_at = ? WHERE id = ?')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.todoRows = this.todoRows.map((row) =>
            row.id === values[4]
              ? {
                  ...row,
                  text: values[0] as string,
                  priority: values[1] as TodoRow['priority'],
                  completed: values[2] as number,
                  updated_at: values[3] as string
                }
              : row
          )
        }
      }
    }

    if (sql.startsWith('DELETE FROM todos WHERE id = ?')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.todoRows = this.todoRows.filter((row) => row.id !== values[0])
        }
      }
    }

    if (sql.startsWith('UPDATE todos SET sort_order = ?, updated_at = ? WHERE id = ? AND entry_date = ?')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.todoRows = this.todoRows.map((row) =>
            row.id === values[2] && row.entry_date === values[3]
              ? {
                  ...row,
                  sort_order: values[0] as number,
                  updated_at: values[1] as string
                }
              : row
          )
        }
      }
    }

    if (
      sql.startsWith(
        'SELECT id, entry_date, title, content, tags, created_at, updated_at FROM snippets WHERE entry_date = ? ORDER BY'
      )
    ) {
      return {
        all: (...values) =>
          this.snippetRows
            .filter((row) => row.entry_date === values[0])
            .sort((left, right) => right.created_at.localeCompare(left.created_at) || right.id - left.id),
        get: () => undefined,
        run: () => undefined
      }
    }

    if (
      sql.startsWith('SELECT entry_date, COUNT(*) AS item_count FROM snippets WHERE entry_date LIKE ? GROUP BY entry_date')
    ) {
      return {
        all: (...values) => {
          const monthPattern = String(values[0]).replace('%', '')
          const counts = new Map<string, number>()

          this.snippetRows
            .filter((row) => row.entry_date.startsWith(monthPattern))
            .forEach((row) => counts.set(row.entry_date, (counts.get(row.entry_date) ?? 0) + 1))

          return [...counts.entries()].map(([entry_date, item_count]) => ({
            entry_date,
            item_count
          }))
        },
        get: () => undefined,
        run: () => undefined
      }
    }

    if (sql.startsWith('INSERT INTO snippets')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          const insertedId = this.nextSnippetId
          this.nextSnippetId += 1
          this.snippetRows.push({
            id: insertedId,
            entry_date: values[0] as string,
            title: values[1] as string,
            content: values[2] as string,
            tags: values[3] as string,
            created_at: values[4] as string,
            updated_at: values[5] as string
          })

          return { lastInsertRowid: insertedId }
        }
      }
    }

    if (
      sql.startsWith(
        'SELECT id, entry_date, title, content, tags, created_at, updated_at FROM snippets WHERE id = ?'
      )
    ) {
      return {
        all: () => [],
        get: (...values) => this.snippetRows.find((row) => row.id === values[0]),
        run: () => undefined
      }
    }

    if (sql.startsWith('UPDATE snippets SET title = ?, content = ?, tags = ?, updated_at = ? WHERE id = ?')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.snippetRows = this.snippetRows.map((row) =>
            row.id === values[4]
              ? {
                  ...row,
                  title: values[0] as string,
                  content: values[1] as string,
                  tags: values[2] as string,
                  updated_at: values[3] as string
                }
              : row
          )
        }
      }
    }

    if (sql.startsWith('DELETE FROM snippets WHERE id = ?')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.snippetRows = this.snippetRows.filter((row) => row.id !== values[0])
        }
      }
    }

    if (sql.startsWith('SELECT id, entry_date, content, created_at, updated_at FROM journals WHERE entry_date = ?')) {
      return {
        all: () => [],
        get: (...values) => this.journalRows.find((row) => row.entry_date === values[0]),
        run: () => undefined
      }
    }

    if (sql.startsWith('SELECT entry_date, COUNT(*) AS item_count FROM journals WHERE entry_date LIKE ? GROUP BY entry_date')) {
      return {
        all: (...values) => {
          const monthPattern = String(values[0]).replace('%', '')
          const counts = new Map<string, number>()

          this.journalRows
            .filter((row) => row.entry_date.startsWith(monthPattern))
            .forEach((row) => counts.set(row.entry_date, (counts.get(row.entry_date) ?? 0) + 1))

          return [...counts.entries()].map(([entry_date, item_count]) => ({
            entry_date,
            item_count
          }))
        },
        get: () => undefined,
        run: () => undefined
      }
    }

    if (sql.startsWith('INSERT INTO journals')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          const id = this.journalRows.length + 1
          this.journalRows.push({
            id,
            entry_date: values[0] as string,
            content: values[1] as string,
            created_at: values[2] as string,
            updated_at: values[3] as string
          })
          return { lastInsertRowid: id }
        }
      }
    }

    if (sql.startsWith('UPDATE journals SET content = ?, updated_at = ? WHERE entry_date = ?')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.journalRows = this.journalRows.map((row) =>
            row.entry_date === values[2]
              ? {
                  ...row,
                  content: values[0] as string,
                  updated_at: values[1] as string
                }
              : row
          )
        }
      }
    }

    if (sql.startsWith('DELETE FROM journals WHERE entry_date = ?')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.journalRows = this.journalRows.filter((row) => row.entry_date !== values[0])
        }
      }
    }

    throw new Error(`未支持的测试 SQL: ${sql}`)
  }
}

beforeEach(() => {
  sqlite = new MemoryDailyDatabase()
})

describe('dailyService', () => {
  it('只返回指定日期的工作台数据', () => {
    const service = createDailyService(sqlite)

    const firstTodo = service.createTodo({
      entryDate: '2026-05-27',
      text: '今天的待办',
      priority: 'P1'
    })
    service.createTodo({
      entryDate: '2026-05-26',
      text: '昨天的待办',
      priority: 'P2'
    })
    const firstSnippet = service.createSnippet({
      entryDate: '2026-05-27',
      title: '今天的片段',
      content: '今天的内容',
      tags: ['今天']
    })
    const firstJournal = service.saveJournal({
      entryDate: '2026-05-27',
      content: '今天的日记'
    })
    service.createSnippet({
      entryDate: '2026-05-26',
      title: '昨天的片段',
      content: '昨天的内容',
      tags: ['昨天']
    })
    service.saveJournal({
      entryDate: '2026-05-26',
      content: '昨天的日记'
    })

    const result = service.listDay('2026-05-27')

    expect(result.todos).toEqual([firstTodo])
    expect(result.snippets).toEqual([firstSnippet])
    expect(result.journal).toEqual(firstJournal)
  })

  it('支持读取指定月份的工作台概览', () => {
    const service = createDailyService(sqlite)

    service.createTodo({
      entryDate: '2026-05-27',
      text: '今天的待办一',
      priority: 'P1'
    })
    service.createTodo({
      entryDate: '2026-05-27',
      text: '今天的待办二',
      priority: 'P2'
    })
    service.createSnippet({
      entryDate: '2026-05-27',
      title: '今天的片段',
      content: '内容',
      tags: ['今天']
    })
    service.saveJournal({
      entryDate: '2026-05-26',
      content: '昨天的日记'
    })
    service.createSnippet({
      entryDate: '2026-06-01',
      title: '六月片段',
      content: '不应被带入五月',
      tags: ['六月']
    })

    const result = service.listMonthOverview('2026-05')

    expect(result).toEqual({
      month: '2026-05',
      entries: [
        {
          entryDate: '2026-05-26',
          todoCount: 0,
          snippetCount: 0,
          journalCount: 1
        },
        {
          entryDate: '2026-05-27',
          todoCount: 2,
          snippetCount: 1,
          journalCount: 0
        }
      ]
    })
  })

  it('支持创建、更新、删除和重排待办', () => {
    const service = createDailyService(sqlite)

    const firstTodo = service.createTodo({
      entryDate: '2026-05-27',
      text: '整理今天的任务',
      priority: 'P1'
    })
    const secondTodo = service.createTodo({
      entryDate: '2026-05-27',
      text: '补充新的任务',
      priority: 'P2'
    })

    expect(typeof firstTodo.id).toBe('number')
    expect(typeof secondTodo.id).toBe('number')
    expect(firstTodo.sortOrder).toBe(0)
    expect(secondTodo.sortOrder).toBe(1)

    const updatedTodo = service.updateTodo(firstTodo.id, {
      text: '整理今天的核心任务',
      priority: 'P0',
      completed: true
    })

    expect(updatedTodo.text).toBe('整理今天的核心任务')
    expect(updatedTodo.priority).toBe('P0')
    expect(updatedTodo.completed).toBe(true)

    const reordered = service.reorderTodos({
      entryDate: '2026-05-27',
      ids: [secondTodo.id, firstTodo.id]
    })

    expect(reordered.map((todo) => ({ id: todo.id, sortOrder: todo.sortOrder }))).toEqual([
      { id: secondTodo.id, sortOrder: 0 },
      { id: firstTodo.id, sortOrder: 1 }
    ])

    service.deleteTodo(firstTodo.id)

    expect(service.listDay('2026-05-27').todos).toEqual([reordered[0]])
  })

  it('支持创建、更新和删除片段', () => {
    const service = createDailyService(sqlite)

    const created = service.createSnippet({
      entryDate: '2026-05-27',
      title: '随手片段',
      content: '记录一个想法',
      tags: ['灵感', '本地']
    })

    expect(typeof created.id).toBe('number')
    expect(created.time).toMatch(/^\d{2}:\d{2}$/)

    const updated = service.updateSnippet(created.id, {
      title: '更新后的片段',
      content: '记录一个新想法',
      tags: ['更新']
    })

    expect(updated.title).toBe('更新后的片段')
    expect(updated.content).toBe('记录一个新想法')
    expect(updated.tags).toEqual(['更新'])

    service.deleteSnippet(created.id)

    expect(service.listDay('2026-05-27').snippets).toEqual([])
  })

  it('支持创建、更新和删除日记', () => {
    const service = createDailyService(sqlite)

    const created = service.saveJournal({
      entryDate: '2026-05-27',
      content: '今天的第一版日记'
    })

    expect(created.entryDate).toBe('2026-05-27')
    expect(created.content).toBe('今天的第一版日记')

    const updated = service.saveJournal({
      entryDate: '2026-05-27',
      content: '今天的最终版日记'
    })

    expect(updated.entryDate).toBe('2026-05-27')
    expect(updated.content).toBe('今天的最终版日记')
    expect(updated.createdAt).toBe(created.createdAt)

    service.deleteJournal('2026-05-27')

    expect(service.listDay('2026-05-27').journal).toBeNull()
  })
})
