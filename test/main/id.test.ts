import { describe, expect, it } from 'vitest'
import { createCompactUuid } from '@/id'

// 无连接符 UUID 格式。
const COMPACT_UUID_PATTERN = /^[\da-f]{32}$/i

describe('createCompactUuid', () => {
  it('创建 32 位无连接符 UUID', () => {
    const id = createCompactUuid()

    expect(id).toMatch(COMPACT_UUID_PATTERN)
    expect(id).not.toContain('-')
  })
})
