import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getAppDataRoot, getDatabaseDir, getDatabasePath } from './paths'

describe('main paths', () => {
  it('uses the current user home .mc directory for app data', () => {
    // 应用配置与数据根目录。
    const appDataRoot = join(homedir(), '.mc')

    expect(getAppDataRoot()).toBe(appDataRoot)
    expect(getDatabaseDir()).toBe(join(appDataRoot, 'db'))
    expect(getDatabasePath()).toBe(join(appDataRoot, 'db', 'curator.db'))
  })
})
