import { describe, expect, it, vi } from 'vitest'
import { createSnippetQueryTool } from '@/agent/tools/snippetTool'
import type { SnippetsService } from '@/services/snippetsService'

describe('snippetTool_query', () => {
  it('support raw SQL select queries on snippets table', async () => {
    const mockQuerySql = vi.fn().mockReturnValue([
      {
        id: 1,
        entry_date: '2026-06-10',
        title: 'Test Snippet',
        content: 'const a = 1;',
        tags: '["js"]',
        created_at: '2026-06-10 12:00',
        updated_at: '2026-06-10 12:00'
      }
    ])
    const service = { querySql: mockQuerySql } as unknown as SnippetsService
    const tool = createSnippetQueryTool(service)

    const result = await tool.execute({
      sql: 'SELECT * FROM snippets WHERE title = \'Test Snippet\''
    })

    expect(mockQuerySql).toHaveBeenCalledWith(
      'SELECT * FROM snippets WHERE title = \'Test Snippet\' LIMIT 20'
    )
    expect(result.items).toEqual([
      {
        id: 1,
        entryDate: '2026-06-10',
        title: 'Test Snippet',
        content: 'const a = 1;',
        tags: ['js'],
        createdAt: '2026-06-10 12:00',
        updatedAt: '2026-06-10 12:00'
      }
    ])
  })

  it('rejects forbidden keywords or write operations in SQL', async () => {
    const service = { querySql: vi.fn() } as unknown as SnippetsService
    const tool = createSnippetQueryTool(service)

    await expect(
      tool.execute({
        sql: 'DELETE FROM snippets'
      })
    ).rejects.toThrow('Snippet SQL only allows SELECT queries')

    await expect(
      tool.execute({
        sql: 'SELECT * FROM snippets; DROP TABLE snippets;'
      })
    ).rejects.toThrow('Snippet SQL only allows a single SELECT statement without comments')

    await expect(
      tool.execute({
        sql: 'SELECT * FROM snippets JOIN todos'
      })
    ).rejects.toThrow('Snippet SQL contains a forbidden keyword')
  })

  it('supports structured queries', async () => {
    const mockQuerySql = vi.fn().mockReturnValue([])
    const service = { querySql: mockQuerySql } as unknown as SnippetsService
    const tool = createSnippetQueryTool(service)

    await tool.execute({
      query: 'React',
      entryDate: '2026-06-10',
      conditions: {
        tag: 'web'
      }
    })

    expect(mockQuerySql).toHaveBeenCalledWith(
      "SELECT id, entry_date, title, content, tags, created_at, updated_at FROM snippets WHERE entry_date = '2026-06-10' AND tags LIKE '%web%' AND (title LIKE '%React%' OR content LIKE '%React%') ORDER BY updated_at DESC, created_at DESC LIMIT 20"
    )
  })
})
