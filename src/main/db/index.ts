import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

// SQLite 数据库连接。
let sqlite: Database.Database | null = null

/**
 * 创建 Notes 表。
 */
export const createNotesTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      tags TEXT NOT NULL,
      time TEXT NOT NULL,
      is_curated INTEGER NOT NULL DEFAULT 0,
      clue TEXT
    );
  `)
}

/**
 * 初始化本地 SQLite 数据库。
 */
export const initDatabase = (): Database.Database => {
  if (sqlite) {
    return sqlite
  }

  const userDataPath = app.getPath('userData')
  mkdirSync(userDataPath, { recursive: true })
  sqlite = new Database(join(userDataPath, 'curator.db'))
  createNotesTable(sqlite)

  return sqlite
}

/**
 * 获取 SQLite 数据库连接。
 */
export const getDatabase = (): Database.Database => sqlite ?? initDatabase()
