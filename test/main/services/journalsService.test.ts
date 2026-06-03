import { beforeEach, describe, expect, it } from 'vitest'
import type { JournalRow } from '../../../src/main/db/schema'
import { createJournalsService, type DatabaseConnection, type DatabaseStatement } from '../../../src/main/services/journalsService'

let sqlite: MemoryJournalsDatabase

class MemoryJournalsDatabase implements DatabaseConnection {
  journalRows: JournalRow[] = []

  prepare = (sql: string): DatabaseStatement => {
    if (
      sql.startsWith(
        'SELECT id, entry_date, content, created_at, updated_at FROM journals WHERE entry_date = ?'
      )
    ) {
      return {
        all: () => [],
        get: (...values) => this.journalRows.find((row) => row.entry_date === values[0]),
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
          const entryDate = values[2] as string
          const row = this.journalRows.find((row) => row.entry_date === entryDate)
          if (row) {
            row.content = values[0] as string
            row.updated_at = values[1] as string
          }
          return { changes: 1 }
        }
      }
    }

    if (sql.startsWith('DELETE FROM journals WHERE entry_date = ?')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.journalRows = this.journalRows.filter((row) => row.entry_date !== values[0])
          return { changes: 1 }
        }
      }
    }

    throw new Error(`Unhandled SQL: ${sql}`)
  }
}

beforeEach(() => {
  sqlite = new MemoryJournalsDatabase()
})

describe('journalsService', () => {
  it('支持创建、查询、更新和删除日记', () => {
    const service = createJournalsService(sqlite)

    // 查询为空
    expect(service.get('2026-05-27')).toBeNull()

    // 保存 (新建)
    const first = service.save({
      entryDate: '2026-05-27',
      content: '今日晴，风清。'
    })
    expect(first.entryDate).toBe('2026-05-27')
    expect(first.content).toBe('今日晴，风清。')

    // 查询
    const fetched = service.get('2026-05-27')
    expect(fetched).not.toBeNull()
    expect(fetched!.content).toBe('今日晴，风清。')

    // 保存 (更新)
    const updated = service.save({
      entryDate: '2026-05-27',
      content: '今日晴转多云。'
    })
    expect(updated.content).toBe('今日晴转多云。')

    // 删除
    service.delete('2026-05-27')
    expect(service.get('2026-05-27')).toBeNull()
  })

  it('校验错误的输入', () => {
    const service = createJournalsService(sqlite)

    expect(() =>
      service.save({
        entryDate: 'invalid-date',
        content: '内容'
      })
    ).toThrow('工作台日期格式不正确')

    expect(() =>
      service.save({
        entryDate: '2026-05-27',
        content: ' '
      })
    ).toThrow('日记内容不能为空')
  })
})
