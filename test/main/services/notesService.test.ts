import { beforeEach, describe, expect, it } from 'vitest'
import type { NoteRow } from '@/db/schema'
import { createNotesService, type DatabaseConnection, type DatabaseStatement } from '@/services/notesService'

// 测试数据库连接。
let sqlite: MemoryNotesDatabase

// 内存 Notes 数据库，用于避免 Node/Vitest 加载 Electron ABI 的原生 SQLite 模块。
class MemoryNotesDatabase implements DatabaseConnection {
  // 内存笔记行。
  private rows: NoteRow[] = []

  // 自增主键游标。
  private nextId = 1

  /**
   * 准备内存 SQL 语句。
   */
  prepare = (sql: string): DatabaseStatement => {
    if (sql.startsWith('SELECT n.id, n.title, n.content, n.tags, n.time, n.category_id, nc.name AS category_name')) {
      return {
        all: (...values: unknown[]) => {
          const categoryId = values[0] as number | undefined
          const filtered = categoryId !== undefined
            ? this.rows.filter((row) => row.category_id === categoryId)
            : this.rows
          return [...filtered].sort((left, right) => right.time.localeCompare(left.time) || right.id - left.id)
        },
        get: (...values: unknown[]) => this.rows.find((row) => row.id === values[0]),
        run: () => undefined
      }
    }

    if (sql.startsWith('INSERT INTO notes')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          const insertedId = this.nextId
          this.nextId += 1
          this.rows.push({
            id: insertedId,
            title: values[0] as string,
            content: values[1] as string,
            tags: values[2] as string,
            time: values[3] as string,
            category_id: (values[4] as number | null) ?? null,
            category_name: null
          })

          return { lastInsertRowid: insertedId }
        }
      }
    }

    if (sql.startsWith('UPDATE notes SET')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.rows = this.rows.map((row) =>
            row.id === values[4]
              ? {
                  ...row,
                  title: values[0] as string,
                  content: values[1] as string,
                  tags: values[2] as string,
                  category_id: (values[3] as number | null) ?? null
                }
              : row
          )
        }
      }
    }

    if (sql.startsWith('DELETE FROM notes WHERE id =')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.rows = this.rows.filter((row) => row.id !== values[0])
        }
      }
    }

    throw new Error(`未支持的测试 SQL: ${sql}`)
  }
}

beforeEach(() => {
  sqlite = new MemoryNotesDatabase()
})

describe('notesService', () => {
  it('新数据库默认没有笔记', () => {
    const service = createNotesService(sqlite)

    expect(service.list()).toEqual([])
  })

  it('支持创建、读取、更新、删除笔记', () => {
    const service = createNotesService(sqlite)

    const created = service.create({
      title: 'SQLite 笔记',
      content: '持久化 Markdown 内容',
      tags: ['本地存储', 'CRUD']
    })

    expect(created).toMatchObject({
      title: 'SQLite 笔记',
      content: '持久化 Markdown 内容',
      tags: ['本地存储', 'CRUD']
    })
    expect(typeof created.id).toBe('number')
    expect(created.time).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    expect(service.list()).toEqual([created])

    const updated = service.update(created.id, {
      title: '更新后的笔记',
      content: '更新后的 Markdown 内容',
      tags: ['更新']
    })

    expect(updated).toEqual({
      ...created,
      title: '更新后的笔记',
      content: '更新后的 Markdown 内容',
      tags: ['更新']
    })
    expect(service.list()).toEqual([updated])

    service.delete(created.id)

    expect(service.list()).toEqual([])
  })
})
