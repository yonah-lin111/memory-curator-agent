import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * 获取应用配置与数据根目录。
 */
export const getAppDataRoot = (): string => join(homedir(), '.mc')

/**
 * 获取 SQLite 数据库目录。
 */
export const getDatabaseDir = (): string => join(getAppDataRoot(), 'db')

/**
 * 获取 SQLite 数据库文件路径。
 */
export const getDatabasePath = (): string => join(getDatabaseDir(), 'curator.db')
