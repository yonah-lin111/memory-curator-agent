# 规格说明书 (Spec)：AI 聊天图片生命周期维护

本规格说明书定义了当 AI 聊天会话或消息被删除时，本地聊天图片文件的全生命周期垃圾收集（Garbage Collection）与安全维护设计。

---

## 1. 核心诉求与背景

在用户使用 AI 聊天助手（Agent Chat）时，上传的图片和 AI 生成的图片会被保存至本地物理目录 `~/.mc/img/chat`。
但在目前的设计中，删除对话或单条消息仅会触发 SQLite 数据库记录的物理删除，这导致本地磁盘对应的图片资源发生“泄漏”（沦为无引用的孤儿文件），长此以往会积压大量本地磁盘空间。

因此，我们需要设计一套**高容错、自动化、高内聚**的聊天图片垃圾回收机制，兼顾磁盘清理和防误删的逆向还原。

---

## 2. 详细技术方案 (Approach 2)

本方案采用**全后台高内聚、数据一致性驱动**的设计。业务层无需关心图片搬运，仅需专注于数据库的删除。专门的维护调度器会在后台自动实现垃圾清理与逆向恢复。

### 2.1 目录结构升级

新增聊天垃圾箱（Trash）物理目录，专门用于临时封存已被删除但可能需要恢复的聊天图片。

*   **活跃图片目录**：`~/.mc/img/chat`（对应 `getAiChatImageDir()`）
*   **回收站目录**：`~/.mc/img/chat-trash`（对应 `getAiChatImageTrashDir()`）

### 2.2 数据库引用关系解析

为寻找“孤儿图片”，需要提取目前仍在使用的所有图片。

1.  **AI 聊天图片协议**：`mc-img://chat/<fileName>`。
2.  **提取来源**：
    从 SQLite `ai_chat_messages` 表中的 `content` 字段及 `parts_json` 字段内进行全局正则匹配。
3.  **引用匹配正则**：
    ```typescript
    const AI_CHAT_IMAGE_URL_PATTERN = /(?:mc-img:\/\/chat\/|file:\/\/[^\s"'()]*\/img\/chat\/)([^)\s"'#?]+)/g
    ```

### 2.3 文件服务（`FilesService`）接口扩充

在 `src/main/services/filesService.ts` 中增加以下核心方法：

1.  `listUnusedAiChatImages()`：
    *   读取 `ai_chat_messages` 中的活跃引用，与 `img/chat` 目录下的所有物理文件进行差集比对，列出所有无引用的本地图片。
2.  `deleteUnusedAiChatImages(options?: MarkdownImageCleanupOptions)`：
    *   将未引用的图片剪切（`rename`）并移至垃圾箱目录。支持指定最小闲置时间（`minUnusedAgeMs`），实现延迟清理（默认 30 秒缓冲时间）。
3.  `restoreReferencedAiChatImages()`：
    *   逆向检测机制。如果已被移入垃圾箱的某个图片文件名在数据库中再次被引用（例如用户撤销了删除，或数据库写回），系统会自动将其从 `img/chat-trash` 重新移回 `img/chat`。
4.  `cleanExpiredTrash(retentionMs?: number)`：
    *   **全回收站定期过期物理清理**：对整个垃圾桶根目录（`~/.mc/trash`）生效。深度递归遍历该目录，比对每个文件的最后修改时间（`mtime`）。如果其在回收站内的保留时间已超过 `retentionMs`（默认 **7天**），则予以永久物理删除，并自动回收空的子文件夹。

### 2.4 自动化后台调度器（`aiChatImageMaintenance.ts`）

创建 `src/main/services/aiChatImageMaintenance.ts` 来控制触发时机：

*   **延迟清理策略**：
    *   在删除聊天、删除单轮、撤销最后一轮对话的 IPC Handler 中，异步调度聊天图片维护任务。
    *   **黄金 30 秒缓冲**：触发时并不立即物理删除，而是推迟 30 秒（`MARKDOWN_IMAGE_CLEANUP_DELAY_MS`），期间若无新引用，才搬移到垃圾箱，给用户完美的撤销操作反应时间。
*   **启动静默维护与回收站物理清理**：
    *   应用启动 30 秒后（避免抢占冷启动资源），自动进行一次全量的聊天图片整理与垃圾桶过期清理：
        1. 恢复数据库重新引用的垃圾箱图片。
        2. 清理没有引用的非活跃图片到垃圾箱中。
        3. 异步物理销毁回收站（`~/.mc/trash`）中所有保留时间超过 7 天的陈旧图片及空文件夹，彻底释放磁盘。

### 2.5 图片协议重命名与合并

为保持协议层架构的高内聚与通用性，将原 `src/main/protocols/markdownImages.ts` 重命名为更通用的 `src/main/protocols/localImages.ts`。其内聚集成了 Markdown 图片 (`md`)、人物头像 (`people`) 与 AI 聊天图片 (`chat`) 三大本地多主机路由访问 URL 构造与本地路径双向解析逻辑，底层通过通用 `mc-img` 协议进行服务。

---

## 3. 单元测试与验证方案

1.  **文件服务测试**：
    *   在 `test/main/services/filesService.test.ts` 中，为 `listUnusedAiChatImages`、`deleteUnusedAiChatImages`、`restoreReferencedAiChatImages` 编写单元测试。
2.  **维护逻辑测试**：
    *   模拟消息被删除 -> 触发调度维护 -> 30 秒后图片被移至垃圾箱。
    *   模拟在 30 秒内恢复消息 -> 调度维护 -> 图片完好保存在活跃目录。

---

## 4. 风险控制与合规性

1.  **极简微创**：修改仅局限在 `filesService`，`paths` 与新建维护服务，确保对既有聊天持久层无性能侵入。
2.  **防覆盖**：当移入垃圾箱存在同名文件冲突时，使用 UUID 重命名备份。
3.  **禁止Unicode替换字符**：在整个代码注释和文件中禁止出现 `\uFFFD`（）。
