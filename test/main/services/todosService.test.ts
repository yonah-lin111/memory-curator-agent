import { beforeEach, describe, expect, it } from 'vitest'
import type { TodoRow } from '../../../src/main/db/schema'
import { createTodosService, type DatabaseConnection, type DatabaseStatement } from '../../../src/main/services/todosService'

let sqlite: MemoryTodosDatabase

class MemoryTodosDatabase implements DatabaseConnection {
  todoRows: TodoRow[] = []
  nextTodoId = 1

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

    if (
      sql.startsWith('UPDATE todos SET text = ?, priority = ?, completed = ?, updated_at = ? WHERE id = ?')
    ) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          const id = values[4] as number
          const row = this.todoRows.find((row) => row.id === id)
          if (row) {
            row.text = values[0] as string
            row.priority = values[1] as TodoRow['priority']
            row.completed = values[2] as number
            row.updated_at = values[3] as string
          }
          return { changes: 1 }
        }
      }
    }

    if (
      sql.startsWith('UPDATE todos SET sort_order = ?, updated_at = ? WHERE id = ? AND entry_date = ?')
    ) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          const id = values[2] as number
          const entryDate = values[3] as string
          const row = this.todoRows.find((row) => row.id === id && row.entry_date === entryDate)
          if (row) {
            row.sort_order = values[0] as number
            row.updated_at = values[1] as string
          }
          return { changes: 1 }
        }
      }
    }

    if (sql.startsWith('DELETE FROM todos WHERE id = ?')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.todoRows = this.todoRows.filter((row) => row.id !== values[0])
          return { changes: 1 }
        }
      }
    }

    throw new Error(`Unhandled SQL: ${sql}`)
  }
}

beforeEach(() => {
  sqlite = new MemoryTodosDatabase()
})

describe('todosService', () => {
  it('支持创建、查询、更新、删除和重排待办', () => {
    const service = createTodosService(sqlite)

    // 创建
    const first = service.create({
      entryDate: '2026-05-27',
      text: '待办一',
      priority: 'P1'
    })
    const second = service.create({
      entryDate: '2026-05-27',
      text: '待办二',
      priority: 'P2'
    })

    expect(first.id).toBe(1)
    expect(first.text).toBe('待办一')
    expect(first.priority).toBe('P1')
    expect(first.sortOrder).toBe(0)

    expect(second.id).toBe(2)
    expect(second.sortOrder).toBe(1)

    // 查询
    expect(service.listByDate('2026-05-27')).toEqual([first, second])

    // 更新
    const updated = service.update(1, {
      text: '已完成的待办一',
      priority: 'P0',
      completed: true
    })
    expect(updated.text).toBe('已完成的待办一')
    expect(updated.completed).toBe(true)

    // 重排
    const sorted = service.reorder({
      entryDate: '2026-05-27',
      ids: [2, 1]
    })
    expect(sorted.map((item) => item.id)).toEqual([2, 1])

    // 删除
    service.delete(1)
    expect(service.listByDate('2026-05-27').map((item) => item.id)).toEqual([2])
  })

  it('校验错误的输入', () => {
    const service = createTodosService(sqlite)

    expect(() =>
      service.create({
        entryDate: 'invalid-date',
        text: '待办',
        priority: 'P1'
      })
    ).toThrow('工作台日期格式不正确')

    expect(() =>
      service.create({
        entryDate: '2026-05-27',
        text: ' ',
        priority: 'P1'
      })
    ).toThrow('待办内容不能为空')
  })
})
