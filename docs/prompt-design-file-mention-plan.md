# PromptAiChatInput `@` 文件提及功能设计方案

## 背景
在 Prompt 设计画板的 AI 聊天框（`PromptAiChatInput.tsx`）中添加 `@` 唤起项目文件搜索补全功能，参考 `opencode-dev` 的 `@` 文件提及以及本项目 `AiChatInput.tsx` 中已有的 `MentionCommandPanels` 命令面板设计。聊天 AI（即普通的 `AiChatInput`）不需要这个功能。

## 核心设计要求
1. **触发方式**：在输入框输入 `@`（且其左侧无字符或为空格）唤醒文件命令面板。
2. **面板展示**：复用项目中现有的 `CommandPanel` 组件。
3. **数据来源**：通过 IPC 接口实时读取当前活动项目目录下的文件。
4. **排除限制**：搜索时需要过滤掉常见的第三方或编译目录（如 `node_modules`, `.git`, `dist`, `build` 等）。
5. **处理结果**：选中文件后，在 textarea 中插入纯文本引用（例如 `@src/utils/index.ts`），后端处理消息时只依赖该路径。

## 详细实现步骤

### 1. IPC / Main 层 (Node.js)
需要在主进程的文件处理注册代码中添加目录递归搜索接口：
- **涉及文件**: `src/main/ipc/filesHandlers.ts`（或者新建独立的 handler，如 `promptDesignHandlers.ts` 中）
- **通信通道**: `prompt-design:files:search`
- **入参**: `{ directory: string, query: string }`
- **逻辑实现**: 
  - 使用 `fs.readdir` 结合递归查询获取文件相对路径，不使用第三方 glob。
  - 自动跳过 `node_modules`, `.git`, `dist`, `build`, `.DS_Store` 等忽略目录。
  - 利用输入的 `query`（`@` 后面的字符串）进行子字符串模糊过滤。
  - 最多返回 50 条记录以确保性能。

### 2. Preload 桥接层
- **涉及文件**: `src/preload/index.ts`
- **注册接口**: `window.api.promptDesign.searchFiles(query: string, directory: string): Promise<string[]>`

### 3. Hook 层管理 (Renderer)
- **新建文件**: `src/renderer/src/features/prompt-design/hooks/useFileMention.ts`
- **实现细节**:
  - 复刻 `useAiChatMentions.ts` 的结构和 `@` 区间检测逻辑（利用已有的 `resolveAgentMentionPanelState` 辅助函数）。
  - 根据输入变化，若检测到处于 `@查询区`，则从 `promptDesignStore` 中获取 `activeProjectId`，再从 `projects` 里取对应的 `path` 作为根目录，调用 IPC 查询文件。
  - 维护文件列表状态、当前焦点项 `activeIndex` 以及开启/关闭状态。
  - 提供 `selectFileMention` 回调将文件路径拼装入 `inputText` 中，并保持焦点。

### 4. UI 层渲染 (Renderer)
- **涉及文件**: `src/renderer/src/features/prompt-design/components/PromptAiChatInput.tsx`
- **改动内容**:
  - 引入上面创建的 `useFileMention` 和 `promptDesignStore` 的选定项目逻辑。
  - 在 `textarea` 外层引入复用的 `CommandPanel` 组件：
    ```tsx
    <CommandPanel
      isOpen={isFilePanelOpen}
      ariaLabel="File Mentions"
      items={matchedFiles.map(path => ({ id: path, path }))}
      activeIndex={activeFileIndex}
      onActiveIndexChange={setActiveFileIndex}
      onItemSelect={(item) => selectFileMention(item.path)}
      renderItem={(item) => (
        <div className="flex items-center gap-2 overflow-hidden">
          <FileText className="h-4 w-4 shrink-0 opacity-50" />
          <span className="truncate text-sm">{item.path}</span>
        </div>
      )}
      idPrefix="prompt-file-mention"
    />
    ```
  - `onKeyDown` 劫持：
    - `Enter`: 阻止默认（即发送消息），触发面板选中项。
    - `ArrowUp` / `ArrowDown`: 阻止光标跳动，切换面板激活项。
    - `Escape`: 关闭面板。
  - 在 `textarea` 被点击、粘贴等操作导致光标变更时，实时校验并可能关闭面板。

### 5. 质量校验
- 改动完成后，运行 `npx tsc --noEmit` 进行 TypeScript 类型严格校验以确保类型安全。