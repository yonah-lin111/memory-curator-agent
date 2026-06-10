import { beforeEach, describe, expect, it } from 'vitest'
import type { SnippetRow } from '@/db/schema'
import { createSnippetsService, type DatabaseConnection, type DatabaseStatement } from '@/services/snippetsService'

let sqlite: MemorySnippetsDatabase

class MemorySnippetsDatabase implements DatabaseConnection {
  snippetRows: SnippetRow[] = []
  nextSnippetId = 1

  prepare = (sql: string): DatabaseStatement => {
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

    if (
      sql.startsWith('UPDATE snippets SET title = ?, content = ?, tags = ?, updated_at = ? WHERE id = ?')
    ) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          const id = values[4] as number
          const row = this.snippetRows.find((row) => row.id === id)
          if (row) {
            row.title = values[0] as string
            row.content = values[1] as string
            row.tags = values[2] as string
            row.updated_at = values[3] as string
          }
          return { changes: 1 }
        }
      }
    }

    if (sql.startsWith('DELETE FROM snippets WHERE id = ?')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.snippetRows = this.snippetRows.filter((row) => row.id !== values[0])
          return { changes: 1 }
        }
      }
    }

    if (sql.startsWith('SELECT id FROM snippets')) {
      return {
        all: () => this.snippetRows.map((r) => ({ id: r.id })),
        get: () => undefined,
        run: () => undefined
      }
    }

    throw new Error(`Unhandled SQL: ${sql}`)
  }
}

beforeEach(() => {
  sqlite = new MemorySnippetsDatabase()
})

describe('snippetsService', () => {
  it('支持创建、查询、更新和删除片段', () => {
    const service = createSnippetsService(sqlite)

    // 创建
    const first = service.create({
      entryDate: '2026-05-27',
      title: '片段一',
      content: '正文一',
      tags: ['A', 'B']
    })
    expect(first.id).toBe(1)
    expect(first.title).toBe('片段一')
    expect(first.content).toBe('正文一')
    expect(first.tags).toEqual(['A', 'B'])

    // 查询
    expect(service.listByDate('2026-05-27')).toEqual([first])

    // 更新
    const updated = service.update(1, {
      title: '修改后的标题',
      content: '修改后的正文',
      tags: ['C']
    })
    expect(updated.title).toBe('修改后的标题')
    expect(updated.content).toBe('修改后的正文')
    expect(updated.tags).toEqual(['C'])

    // 删除
    service.delete(1)
    expect(service.listByDate('2026-05-27')).toEqual([])
  })

  it('校验错误的输入', () => {
    const service = createSnippetsService(sqlite)

    expect(() =>
      service.create({
        entryDate: 'invalid-date',
        title: '片段一',
        content: '内容',
        tags: []
      })
    ).toThrow('工作台日期格式不正确')

    expect(() =>
      service.create({
        entryDate: '2026-05-27',
        title: '',
        content: ' ',
        tags: []
      })
    ).toThrow('片段标题或内容至少保留一项')
  })

  it('支持只读 SQL 查询', () => {
    const service = createSnippetsService(sqlite)
    service.create({
      entryDate: '2026-05-27',
      title: '片段一',
      content: '正文一',
      tags: ['A']
    })
    const result = service.querySql('SELECT id FROM snippets')
    expect(result).toEqual([{ id: 1 }])
  })
})
