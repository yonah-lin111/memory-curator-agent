# AI 聊天图片生命周期维护实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当 AI 聊天会话/消息被删除或撤销时，本地对应的图片资源会异步移入安全垃圾箱 `img/chat-trash` 并在 30 秒缓冲期后安全物理隔离；若 30 秒内恢复则自动复原，彻底解决本地物理存储泄漏。

**Architecture:** 采用高内聚的数据驱动垃圾回收（GC）机制。通过 `FilesService` 检测数据库实际引用与物理文件的差异，利用 `aiChatImageMaintenance` 定时调度执行隔离与逆向复原。

**Tech Stack:** TypeScript, Node.js, Electron, SQLite, Vitest

---

## 1. 文件改动映射

| 职责/模块 | 涉及文件 | 操作 |
| :--- | :--- | :--- |
| **路径配置** | `src/main/paths.ts` | 修改 |
| **文件服务** | `src/main/services/filesService.ts` | 修改 |
| **单元测试** | `test/main/services/filesService.test.ts` | 修改 |
| **维护调度器** | `src/main/services/aiChatImageMaintenance.ts` | 新建 |
| **IPC 路由** | `src/main/ipc/aiHandlers.ts` | 修改 |
| **主进程加载** | `src/main/index.ts` | 修改 |

---

## 2. 任务细分步骤

### Task 1: 路径拓展（Paths Configuration）

**Files:**
- Modify: `src/main/paths.ts`

- [ ] **Step 1: 新增聊天回收站目录路径配置**

在 `src/main/paths.ts` 末尾新增 `getAiChatImageTrashDir()` 函数定义：

```typescript
/**
 * 获取 AI 聊天图片回收目录。
 */
export const getAiChatImageTrashDir = (): string => join(getAppDataRoot(), 'img', 'chat-trash')
```

- [ ] **Step 2: 导出新路径**

确保在 `src/main/paths.ts` 中将 `getAiChatImageTrashDir` 正确导出，并可在后续文件服务中直接导入。

- [ ] **Step 3: 运行类型检查以确保无编译问题**

运行：`pnpm typecheck`
预期：PASS

---

### Task 2: 文件服务功能升级（FilesService Upgrade）

**Files:**
- Modify: `src/main/services/filesService.ts`
- Test: `test/main/services/filesService.test.ts`

- [ ] **Step 1: 修改 `FilesService` 接口类型声明**

在 `FilesService` 类型声明中新增 3 个方法（约 105 行左右）：

```typescript
export type FilesService = {
  // ... 既有定义
  saveMarkdownImage: (input: MarkdownImageSaveInput) => Promise<MarkdownImageSaveResult>
  savePeopleAvatar: (input: MarkdownImageSaveInput) => Promise<MarkdownImageSaveResult>
  saveAiChatImage: (input: MarkdownImageSaveInput) => Promise<MarkdownImageSaveResult>
  listUnusedMarkdownImages: () => Promise<MarkdownImageItem[]>
  restoreReferencedMarkdownImages: () => Promise<MarkdownImageRestoreResult>
  deleteUnusedMarkdownImages: (options?: MarkdownImageCleanupOptions) => Promise<MarkdownImageCleanupResult>
  
  // ==================== 新增：AI 聊天图片维护 ====================
  // 列出未被 AI 聊天引用的图片。
  listUnusedAiChatImages: () => Promise<MarkdownImageItem[]>
  // 恢复已进入回收目录但仍被 AI 聊天引用的图片。
  restoreReferencedAiChatImages: () => Promise<MarkdownImageRestoreResult>
  // 删除未被 AI 聊天引用的图片。
  deleteUnusedAiChatImages: (options?: MarkdownImageCleanupOptions) => Promise<MarkdownImageCleanupResult>
}
```

- [ ] **Step 2: 实现引用名称解析逻辑**

在 `src/main/services/filesService.ts` 中，新增匹配正则与查询数据库的方法：

```typescript
// AI 聊天图片引用正则。
const AI_CHAT_IMAGE_URL_PATTERN = /(?:mc-img:\/\/chat\/|file:\/\/[^\s"'()]*\/img\/chat\/)([^)\s"'#?]+)/g

/**
 * 读取全部 AI 聊天正文（包含 content 和 parts_json）。
 */
const listAiChatContents = (database?: DatabaseConnection): string[] => {
  if (!database) {
    return []
  }

  const rows = database
    .prepare(
      `
      SELECT content FROM ai_chat_messages
      UNION ALL
      SELECT parts_json AS content FROM ai_chat_messages
      `
    )
    .all() as Array<{ content?: unknown }>

  return rows
    .map((row) => row.content)
    .filter((content): content is string => typeof content === 'string')
}

/**
 * 提取 AI 聊天正文引用的图片文件名。
 */
const extractReferencedAiChatImageNames = (contents: string[]): Set<string> => {
  const referencedNames = new Set<string>()

  contents.forEach((content) => {
    for (const match of content.matchAll(AI_CHAT_IMAGE_URL_PATTERN)) {
      const fileName = basename(decodeURIComponent(match[1] ?? ''))

      if (fileName) {
        referencedNames.add(fileName)
      }
    }
  })

  return referencedNames
}
```

同时，在 `createFilesService` 内部，解构依赖：
```typescript
const aiChatImageTrashDir = deps.markdownImageTrashDir ?? getAiChatImageTrashDir() // 使用独立或注入的 trash 路径
```

- [ ] **Step 3: 实现 `createFilesService` 内的 3 个核心方法**

```typescript
    listUnusedAiChatImages: async () => {
      const referencedNames = extractReferencedAiChatImageNames(listAiChatContents(deps.database))
      const images = await listMarkdownImageFiles(aiChatImageDir)

      return images.filter((image) => !referencedNames.has(image.fileName))
    },
    restoreReferencedAiChatImages: async () => {
      const referencedNames = extractReferencedAiChatImageNames(listAiChatContents(deps.database))
      const restoredImages: MarkdownImageItem[] = []

      await mkdir(aiChatImageDir, { recursive: true })
      await Promise.all(
        [...referencedNames].map(async (fileName) => {
          const livePath = join(aiChatImageDir, fileName)

          if (await pathExists(livePath)) {
            return
          }

          const trashPath = join(aiChatImageTrashDir, fileName)

          if (!(await pathExists(trashPath))) {
            return
          }

          await rename(trashPath, livePath)
          restoredImages.push(await getMarkdownImageItem(aiChatImageDir, fileName))
        })
      )

      return {
        restoredCount: restoredImages.length,
        restoredImages: restoredImages.sort((left, right) => left.fileName.localeCompare(right.fileName))
      }
    },
    deleteUnusedAiChatImages: async (options = {}) => {
      const unusedImages = await (async () => {
        const referencedNames = extractReferencedAiChatImageNames(listAiChatContents(deps.database))
        const images = await listMarkdownImageFiles(aiChatImageDir)
        const now = Date.now()

        return images.filter((image) => {
          if (referencedNames.has(image.fileName)) {
            return false
          }

          const minUnusedAgeMs = options.minUnusedAgeMs ?? 0

          if (minUnusedAgeMs <= 0) {
            return true
          }

          return now - new Date(image.updatedAt).getTime() >= minUnusedAgeMs
        })
      })()

      await mkdir(aiChatImageTrashDir, { recursive: true })
      await Promise.all(
        unusedImages.map(async (image) => {
          const targetPath = await createTrashTargetPath(aiChatImageTrashDir, image.fileName)

          await rename(image.filePath, targetPath)
        })
      )

      return {
        deletedCount: unusedImages.length,
        deletedImages: unusedImages
      }
    }
```

- [ ] **Step 4: 编写测试用例覆盖新增方法**

在 `test/main/services/filesService.test.ts` 中，增加对应的单元测试：

```typescript
  describe('AI Chat Images Maintenance', () => {
    it('should list and delete unused AI chat images, and restore them when referenced again', async () => {
      // 1. 初始化 Mock 数据库，并注入 filesService
      // 2. 使用 filesService.saveAiChatImage 保存一张测试图片
      // 3. 校验 listUnusedAiChatImages 应该包含该图片（当前数据库无此消息记录）
      // 4. 调用 deleteUnusedAiChatImages 剪切至垃圾箱
      // 5. 模拟在数据库中插入一条含有该图片引用的消息记录，再次执行 restoreReferencedAiChatImages
      // 6. 校验图片是否重新回到了活跃目录中
    })
  })
```

- [ ] **Step 5: 运行 Vitest 进行验证**

运行：`pnpm test`
预期：100% 单元测试通过

---

### Task 3: 创建维护器组件（Create Maintenance Scheduler）

**Files:**
- Create: `src/main/services/aiChatImageMaintenance.ts`

- [ ] **Step 1: 新建维护服务文件**

新建 `src/main/services/aiChatImageMaintenance.ts`，写入高容错的定时维护逻辑：

```typescript
import type { FilesService } from '@/services/filesService'

// 自动清理延迟：给用户撤销删除保留缓冲窗口（30秒）。
export const AI_CHAT_IMAGE_CLEANUP_DELAY_MS = 30_000

// 启动清理延迟：避免应用启动阶段抢占资源。
export const AI_CHAT_IMAGE_STARTUP_DELAY_MS = 30_000

// 最近一次自动清理定时器句柄。
let cleanupTimer: NodeJS.Timeout | null = null

/**
 * 执行 AI 聊天图片维护任务。
 */
const runAiChatImageMaintenance = async (filesService: FilesService): Promise<void> => {
  await filesService.restoreReferencedAiChatImages()
  await filesService.deleteUnusedAiChatImages({
    minUnusedAgeMs: AI_CHAT_IMAGE_CLEANUP_DELAY_MS
  })
}

/**
 * 调度 AI 聊天图片维护任务（防抖防卡）。
 */
export const scheduleAiChatImageMaintenance = (filesService: FilesService): void => {
  void filesService.restoreReferencedAiChatImages().catch(() => undefined)

  if (cleanupTimer) {
    clearTimeout(cleanupTimer)
  }

  cleanupTimer = setTimeout(() => {
    cleanupTimer = null
    void runAiChatImageMaintenance(filesService).catch(() => undefined)
  }, AI_CHAT_IMAGE_CLEANUP_DELAY_MS)
}

/**
 * 调度应用启动后的 AI 聊天图片维护任务。
 */
export const scheduleStartupAiChatImageMaintenance = (filesService: FilesService): void => {
  setTimeout(() => {
    void runAiChatImageMaintenance(filesService).catch(() => undefined)
  }, AI_CHAT_IMAGE_STARTUP_DELAY_MS)
}
```

- [ ] **Step 2: 运行类型检查确保导入/导出无误**

运行：`pnpm typecheck`
预期：PASS

---

### Task 4: 主进程与 IPC 事件调度绑定（Main Process & IPC Bindings）

**Files:**
- Modify: `src/main/ipc/aiHandlers.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: 绑定消息删除 / 撤销事件触发点**

在 `src/main/ipc/aiHandlers.ts` 中：
1.  在顶部引入：
    ```typescript
    import { scheduleAiChatImageMaintenance } from '@/services/aiChatImageMaintenance'
    import { createFilesService, type DatabaseConnection as FilesDatabaseConnection } from '@/services/filesService'
    ```
2.  在 `registerAiHandlers` 的底部删除/撤回相关的 handler 中：
    *   在会话被删除后，触发维护任务。
    *   在单轮对话被删除后，触发维护任务。
    *   在对话被撤回（undo）后，触发维护任务。

```typescript
  // 1. 删除会话
  ipcMain.handle('ai:session:delete', async (_, sessionId: string) => {
    aiChatService.deleteSession(sessionId)
    // 触发图片垃圾收集调度
    const filesService = createFilesService({ database: database as unknown as FilesDatabaseConnection })
    scheduleAiChatImageMaintenance(filesService)
  })

  // 2. 撤回单轮
  ipcMain.handle('ai:session:turn:undo', async (_, sessionId: string) => {
    const result = await aiChatService.undoLastTurn(sessionId, createTimestamp())
    const filesService = createFilesService({ database: database as unknown as FilesDatabaseConnection })
    scheduleAiChatImageMaintenance(filesService)
    return result
  })

  // 3. 删除消息轮次
  ipcMain.handle('ai:session:turn:delete', async (_, sessionId: string, messageId: string) => {
    const result = await aiChatService.deleteTurnByMessageId(sessionId, messageId, createTimestamp())
    const filesService = createFilesService({ database: database as unknown as FilesDatabaseConnection })
    scheduleAiChatImageMaintenance(filesService)
    return result
  })
```

- [ ] **Step 2: 绑定启动时自动清理逻辑**

在 `src/main/index.ts` 中引入并激活启动清理：

```typescript
import { scheduleStartupAiChatImageMaintenance } from '@/services/aiChatImageMaintenance'
```

并在 `app.whenReady().then(...)` 的对应地方加上：

```typescript
  scheduleStartupMarkdownImageMaintenance(
    createFilesService({ database: database as unknown as FilesDatabaseConnection })
  )
  // 新增：AI 聊天图片冷启动自检
  scheduleStartupAiChatImageMaintenance(
    createFilesService({ database: database as unknown as FilesDatabaseConnection })
  )
```

---

### Task 5: 全量验证与静态检查（Full Verification）

**Files:**
- Run commands only

- [ ] **Step 1: 运行单元测试**

运行：`pnpm test`
确保没有任何测试失败。

- [ ] **Step 2: 静态类型检查**

运行：`pnpm typecheck`
确保没有引入任何 TypeScript 类型遗漏。
