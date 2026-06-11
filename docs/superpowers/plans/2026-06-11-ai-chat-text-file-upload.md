# AI Chat Text File Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AI 聊天输入框支持文本文件上传（附件/粘贴/拖拽），最多6个，文件列表在图片上方，支持预览与删除策略。

**Architecture:** 新增 `TextFile` UI 组件、`text-file` 消息片段类型，扩展现有 `mc-img` 协议用 `chat-text` host 服务文本内容。复用 filesService 模式，文本文件存入 `~/.mc/text/chat`，删除移至 `~/.mc/trash/text/chat`。

**Tech Stack:** React + TypeScript + Electron + Vitest + Testing Library

---

## 文件结构

| # | 文件 | 操作 | 职责 |
|---|------|------|------|
| 1 | `src/main/paths.ts` | 修改 | 新增 `getAiChatTextDir` / `getAiChatTextTrashDir` |
| 2 | `src/main/protocols/localImages.ts` | 修改 | 新增 `AI_CHAT_TEXT_HOST`、`createAiChatTextFileUrl`、`resolveAiChatTextFilePath` |
| 3 | `src/main/protocols/imageProtocol.ts` | 修改 | 协议处理器增加 chat-text host 解析 |
| 4 | `src/main/services/filesService.ts` | 修改 | 新增 `saveAiChatTextFile`、`deleteAiChatTextFile` |
| 5 | `src/main/ipc/filesHandlers.ts` | 修改 | 注册 `files:ai-chat-text:save` / `files:ai-chat-text:delete` |
| 6 | `src/preload/index.ts` | 修改 | 暴露 `saveAiChatTextFile` / `deleteAiChatTextFile` |
| 7 | `src/renderer/src/env.d.ts` | 修改 | 声明 `AiChatTextFileSaveResult` 与 API 类型 |
| 8 | `src/renderer/src/features/ai-chat/types.ts` | 修改 | `AiChatMessagePart` 增加 `kind: "text-file"` |
| 9 | `src/renderer/src/components/ui/TextFile.tsx` | **新建** | 文本文件卡片组件（图标/文件名/大小/预览弹窗） |
| 10 | `test/renderer/components/ui/TextFile.test.tsx` | **新建** | TextFile 组件测试 |
| 11 | `src/renderer/src/features/ai-chat/components/AiChatInput.tsx` | 修改 | 文本文件上传/预览/发送逻辑 |
| 12 | `src/renderer/src/features/ai-chat/components/AiChatMessageBubble.tsx` | 修改 | 渲染 text-file parts + 动态间距 |

---

### Task 1: 新增文本文件目录路径

**Files:**
- Modify: `src/main/paths.ts`

- [ ] **Step 1: 添加路径函数**

在 `getAiChatImageTrashDir` 下方新增：

```typescript
/**
 * 获取 AI 聊天文本文件存储目录。
 */
export const getAiChatTextDir = (): string => join(getAppDataRoot(), 'text', 'chat')

/**
 * 获取 AI 聊天文本文件回收目录。
 */
export const getAiChatTextTrashDir = (): string => join(getAppDataRoot(), 'trash', 'text', 'chat')
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit -p src/main/tsconfig.json 2>&1 | head -5
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/main/paths.ts
git commit -m "feat(paths): add AI chat text file storage and trash directories"
```

---

### Task 2: 新增文本文件协议 URL 辅助函数

**Files:**
- Modify: `src/main/protocols/localImages.ts`

- [ ] **Step 1: 添加 host 常量与 URL/路径函数**

在 `AI_CHAT_IMAGE_HOST` 下方新增 host 常量：

```typescript
// AI 聊天文本文件协议主机名。
export const AI_CHAT_TEXT_HOST = 'chat-text'
```

在文件末尾（`resolveAiChatImagePath` 之后）新增：

```typescript
/**
 * 创建 AI 聊天文本文件访问 URL。
 */
export const createAiChatTextFileUrl = (fileName: string): string =>
  `${MARKDOWN_IMAGE_PROTOCOL}://${AI_CHAT_TEXT_HOST}/${encodeURIComponent(fileName)}`

/**
 * 从 AI 聊天文本文件 URL 解析文件名。
 */
export const resolveAiChatTextFileName = (requestUrl: string): string | null => {
  const url = new URL(requestUrl)

  if (url.protocol !== `${MARKDOWN_IMAGE_PROTOCOL}:` || url.hostname !== AI_CHAT_TEXT_HOST) {
    return null
  }

  const fileName = basename(decodeURIComponent(url.pathname.slice(1)))

  if (!fileName) {
    return null
  }

  return fileName
}

/**
 * 从 AI 聊天文本文件 URL 解析本机文件路径。
 */
export const resolveAiChatTextFilePath = (requestUrl: string): string | null => {
  const fileName = resolveAiChatTextFileName(requestUrl)

  return fileName ? join(getAiChatTextDir(), fileName) : null
}
```

需要在顶部引入 `getAiChatTextDir`：

```typescript
import { getAiChatImageDir, getAiChatTextDir, getMarkdownImageDir, getPeopleAvatarDir } from '@/paths'
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit -p src/main/tsconfig.json 2>&1 | head -5
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/main/protocols/localImages.ts
git commit -m "feat(protocols): add AI chat text file URL helpers"
```

---

### Task 3: 扩展协议处理器支持文本文件

**Files:**
- Modify: `src/main/protocols/imageProtocol.ts`

- [ ] **Step 1: 扩展处理器解析 text 文件路径**

在 import 中新增：

```typescript
import { getAiChatTextDir, getAiChatTextTrashDir, getMarkdownImageDir, getMarkdownImageTrashDir } from '@/paths'
```

在 import localImages 中新增：

```typescript
import {
  MARKDOWN_IMAGE_PROTOCOL,
  resolveAiChatImagePath,
  resolveAiChatTextFilePath,
  resolveMarkdownImageFileName,
  resolveMarkdownImagePath,
  resolvePeopleAvatarPath
} from '@/protocols/localImages'
```

在 `registerImageProtocolHandler` 中 `resolveAiChatImagePath` 后增加文本文件路径解析：

```typescript
if (!filePath) {
  filePath = resolveAiChatTextFilePath(request.url)
}
```

同时新增异步恢复函数，处理从 trash 恢复被引用的文本文件。在现有 `restoreRequestedImageFromTrash` 之后新增：

```typescript
/**
 * 从回收目录恢复被预览重新引用的文本文件。
 */
const restoreRequestedTextFileFromTrash = async (requestUrl: string): Promise<void> => {
  const { resolveAiChatTextFileName } = await import('@/protocols/localImages')
  const fileName = resolveAiChatTextFileName(requestUrl)

  if (!fileName) {
    return
  }

  const livePath = join(getAiChatTextDir(), fileName)

  if (await pathExists(livePath)) {
    return
  }

  const trashPath = join(getAiChatTextTrashDir(), fileName)

  if (!(await pathExists(trashPath))) {
    return
  }

  await mkdir(getAiChatTextDir(), { recursive: true })
  await rename(trashPath, livePath)
}
```

然后在 `registerImageProtocolHandler` 的 handler 开头同时调用两个恢复函数：

```typescript
await restoreRequestedImageFromTrash(request.url)
await restoreRequestedTextFileFromTrash(request.url)
```

完整 handler 逻辑：

```typescript
export const registerImageProtocolHandler = (): void => {
  protocol.handle(MARKDOWN_IMAGE_PROTOCOL, async (request) => {
    await restoreRequestedImageFromTrash(request.url)
    await restoreRequestedTextFileFromTrash(request.url)

    let filePath = resolveMarkdownImagePath(request.url)
    if (!filePath) {
      filePath = resolvePeopleAvatarPath(request.url)
    }
    if (!filePath) {
      filePath = resolveAiChatImagePath(request.url)
    }
    if (!filePath) {
      filePath = resolveAiChatTextFilePath(request.url)
    }

    if (!filePath) {
      return new Response('', { status: 404 })
    }

    return net.fetch(pathToFileURL(filePath).href)
  })
}
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit -p src/main/tsconfig.json 2>&1 | head -5
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/main/protocols/imageProtocol.ts
git commit -m "feat(protocols): extend handler to serve AI chat text files"
```

---

### Task 4: 新增文本文件服务方法

**Files:**
- Modify: `src/main/services/filesService.ts`

- [ ] **Step 1: 新增类型定义**

在 `MarkdownImageSaveResult` 类型下方新增：

```typescript
// AI 聊天文本文件保存结果。
export type AiChatTextFileSaveResult = {
  // 落盘文件名。
  fileName: string
  // 本机绝对路径。
  filePath: string
  // 可访问文本文件的应用 URL。
  url: string
  // 原始文件名。
  originalName: string
  // 文件大小（字节）。
  sizeBytes: number
}
```

在 `FilesService` 类型中 `deleteUnusedAiChatImages` 之后新增：

```typescript
// 保存 AI 聊天文本文件。
saveAiChatTextFile: (input: MarkdownImageSaveInput) => Promise<AiChatTextFileSaveResult>
// 删除 AI 聊天文本文件（移到回收站）。
deleteAiChatTextFile: (fileName: string) => Promise<void>
```

在 createFilesService 函数开头新增文本目录变量：

```typescript
const aiChatTextDir = join(getAppDataRoot(), 'text', 'chat')
const aiChatTextTrashDir = join(getAppDataRoot(), 'trash', 'text', 'chat')
```

需要在顶部 import 中新增：

```typescript
import { getAiChatImageDir, getAiChatImageTrashDir, getAiChatTextDir, getAiChatTextTrashDir, getMarkdownImageDir, getMarkdownImageTrashDir, getPeopleAvatarDir, getAppDataRoot } from '@/paths'
import { createAiChatImageUrl, createAiChatTextFileUrl, createMarkdownImageUrl, createPeopleAvatarUrl } from '@/protocols/localImages'
```

在 return 对象中，`cleanExpiredTrash` 之前新增两个方法：

```typescript
saveAiChatTextFile: async (input) => {
  const extension = extname(input.name).toLowerCase() || '.txt'
  const fileName = `${createSafeFileStem(input.name)}-${createCompactUuid()}${extension}`
  const filePath = join(aiChatTextDir, fileName)

  await mkdir(aiChatTextDir, { recursive: true })
  await writeFile(filePath, Buffer.from(new Uint8Array(input.bytes)))

  const fileStat = await stat(filePath)

  return {
    fileName,
    filePath,
    url: createAiChatTextFileUrl(fileName),
    originalName: input.name,
    sizeBytes: fileStat.size
  }
},
deleteAiChatTextFile: async (fileName) => {
  const filePath = join(aiChatTextDir, fileName)

  if (!(await pathExists(filePath))) {
    return
  }

  await mkdir(aiChatTextTrashDir, { recursive: true })
  const targetPath = await createTrashTargetPath(aiChatTextTrashDir, fileName)
  await rename(filePath, targetPath)
}
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit -p src/main/tsconfig.json 2>&1 | head -10
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/main/services/filesService.ts
git commit -m "feat(filesService): add save and delete methods for AI chat text files"
```

---

### Task 5: 注册文本文件 IPC 处理器

**Files:**
- Modify: `src/main/ipc/filesHandlers.ts`

- [ ] **Step 1: 添加 IPC handler**

在 `registerFilesHandlers` 函数末尾新增：

```typescript
ipcMain.handle('files:ai-chat-text:save', (_, input: MarkdownImageSaveInput) =>
  filesService.saveAiChatTextFile(input)
)

ipcMain.handle('files:ai-chat-text:delete', (_, fileName: string) =>
  filesService.deleteAiChatTextFile(fileName)
)
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit -p src/main/tsconfig.json 2>&1 | head -5
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/filesHandlers.ts
git commit -m "feat(ipc): register AI chat text file IPC handlers"
```

---

### Task 6: 预加载桥接暴露文本文件 API

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: 新增类型与 API 方法**

在 `MarkdownImageSaveResult` 类型下方新增：

```typescript
// AI 聊天文本文件保存结果类型。
type AiChatTextFileSaveResult = {
  // 落盘文件名。
  fileName: string
  // 本机绝对路径。
  filePath: string
  // 可访问文本文件的应用 URL。
  url: string
  // 原始文件名。
  originalName: string
  // 文件大小（字节）。
  sizeBytes: number
}
```

在 `api.files` 对象中新增两个方法：

```typescript
saveAiChatTextFile: (payload: MarkdownImageSavePayload): Promise<AiChatTextFileSaveResult> =>
  ipcRenderer.invoke('files:ai-chat-text:save', payload),
deleteAiChatTextFile: (fileName: string): Promise<void> =>
  ipcRenderer.invoke('files:ai-chat-text:delete', fileName)
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit -p src/preload/tsconfig.json 2>&1 | head -5
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat(preload): expose AI chat text file save/delete to renderer"
```

---

### Task 7: 声明渲染进程类型

**Files:**
- Modify: `src/renderer/src/env.d.ts`

- [ ] **Step 1: 新增类型与 API 声明**

在 `MarkdownImageSaveResult` 类型下方新增：

```typescript
// AI 聊天文本文件保存结果类型。
type AiChatTextFileSaveResult = {
  // 落盘文件名。
  fileName: string
  // 本机绝对路径。
  filePath: string
  // 可访问文本文件的应用 URL。
  url: string
  // 原始文件名。
  originalName: string
  // 文件大小（字节）。
  sizeBytes: number
}
```

在 `AppAPI` 的 `files` 对象中新增：

```typescript
// 保存 AI 聊天文本文件。
saveAiChatTextFile?: (payload: MarkdownImageSavePayload) => Promise<AiChatTextFileSaveResult>
// 删除 AI 聊天文本文件。
deleteAiChatTextFile?: (fileName: string) => Promise<void>
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 | head -5
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/env.d.ts
git commit -m "feat(types): declare AI chat text file API types for renderer"
```

---

### Task 8: 新增 text-file 消息片段类型

**Files:**
- Modify: `src/renderer/src/features/ai-chat/types.ts`

- [ ] **Step 1: 扩展 AiChatMessagePart**

在 `kind: "image"` 分支之后新增：

```typescript
  | {
      // 片段唯一标识。
      id: string;
      // 片段类型。
      kind: "text-file";
      // 文本文件的本地协议地址。
      url: string;
      // 原始文件名。
      fileName: string;
      // 文件大小（字节）。
      sizeBytes: number;
    }
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 | head -5
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/features/ai-chat/types.ts
git commit -m "feat(ai-chat): add text-file part kind to AiChatMessagePart"
```

---

### Task 9: 创建 TextFile UI 组件

**Files:**
- Create: `src/renderer/src/components/ui/TextFile.tsx`

- [ ] **Step 1: 编写组件**

```typescript
import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { FileText, X } from "lucide-react";

export interface TextFileProps {
  // 文本文件协议 URL。
  url: string;
  // 原始文件名。
  fileName: string;
  // 文件大小（字节）。
  sizeBytes: number;
  // 是否支持点击预览。
  preview?: boolean;
  // 附加容器类名。
  className?: string;
}

// 文件大小格式化。
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// 文本文件图标色映射。
const TEXT_EXTENSION_COLORS: Record<string, string> = {
  ".md": "text-blue-400",
  ".json": "text-yellow-400",
  ".csv": "text-green-400",
  ".xml": "text-orange-400",
  ".yaml": "text-red-400",
  ".yml": "text-red-400",
  ".toml": "text-purple-400",
  ".py": "text-cyan-400",
  ".js": "text-yellow-300",
  ".ts": "text-blue-300",
  ".jsx": "text-cyan-300",
  ".tsx": "text-blue-300",
  ".html": "text-orange-300",
  ".css": "text-blue-300",
  ".sh": "text-green-300",
  ".bash": "text-green-300",
  ".zsh": "text-green-300",
  ".sql": "text-purple-300",
  ".java": "text-red-300",
  ".c": "text-gray-300",
  ".cpp": "text-gray-300",
  ".rs": "text-orange-300",
  ".go": "text-cyan-300",
  ".rb": "text-red-300",
  ".env": "text-gray-400",
  ".log": "text-gray-400",
  ".txt": "text-white/60",
};

/**
 * TextFile - 文本文件卡片组件，支持悬浮信息展示与内容预览弹窗。
 */
export const TextFile = ({
  url,
  fileName,
  sizeBytes,
  preview = true,
  className = "",
}: TextFileProps): React.JSX.Element => {
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  const iconColor = TEXT_EXTENSION_COLORS[extension] ?? "text-white/50";

  // 关闭预览时重置状态。
  useEffect(() => {
    if (!showPreview) {
      setPreviewContent(null);
      setPreviewLoading(false);
      setPreviewError(false);
    }
  }, [showPreview]);

  // Escape 键关闭。
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showPreview) {
        setShowPreview(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPreview]);

  /**
   * 点击打开预览，拉取文本内容。
   */
  const handleClick = useCallback((): void => {
    if (!preview) {
      return;
    }

    setShowPreview(true);
    setPreviewLoading(true);
    setPreviewError(false);

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch");
        }

        return response.text();
      })
      .then((text) => {
        setPreviewContent(text);
        setPreviewLoading(false);
      })
      .catch(() => {
        setPreviewError(true);
        setPreviewLoading(false);
      });
  }, [url, preview]);

  return (
    <>
      <div
        data-testid="text-file-card"
        onClick={handleClick}
        className={`relative flex items-center gap-2 rounded-[6px] border border-white/10 bg-white/[0.02] px-2.5 py-1.5 select-none ${preview ? "cursor-pointer hover:bg-white/[0.04]" : ""} ${className}`}
        title={fileName}
      >
        <FileText className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
        <span className="text-xs text-white/70 truncate max-w-[120px]">
          {fileName}
        </span>
        <span className="text-[10px] text-white/30 shrink-0">
          {formatFileSize(sizeBytes)}
        </span>
      </div>

      {showPreview && (
        <div
          data-testid="text-file-preview"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setShowPreview(false)}
        >
          {/* 标题栏 */}
          <div
            className="absolute top-4 right-4 flex items-center gap-2 z-[10000]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs text-white/50 mr-2">{fileName}</span>
            <button
              aria-label="Close preview"
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/5"
              onClick={() => setShowPreview(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 内容区 */}
          <div
            className="max-h-[85vh] max-w-[85vw] w-[700px] rounded-[6px] border border-white/10 bg-[#1a1a1a] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {previewLoading && (
              <div className="flex items-center justify-center h-40 text-xs text-white/40 animate-pulse">
                加载中...
              </div>
            )}
            {previewError && (
              <div className="flex items-center justify-center h-40 text-xs text-white/40">
                文件加载失败
              </div>
            )}
            {previewContent !== null && !previewLoading && !previewError && (
              <pre className="p-4 text-xs text-white/80 font-mono whitespace-pre-wrap break-all overflow-auto max-h-[85vh] custom-scrollbar leading-relaxed select-text">
                {previewContent}
              </pre>
            )}
          </div>
        </div>
      )}
    </>
  );
};
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 | head -10
```

Expected: 无新增错误。

---

### Task 10: 编写 TextFile 组件测试

**Files:**
- Create: `test/renderer/components/ui/TextFile.test.tsx`

- [ ] **Step 1: 编写测试文件**

```typescript
/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TextFile } from "@/components/ui/TextFile";

describe("TextFile Component", () => {
  beforeAll(() => {
    // 模拟 fetch 返回文本内容。
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("line 1\nline 2\nline 3"),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders file name, size, and icon", () => {
    render(
      <TextFile
        url="mc-img://chat-text/test-file.txt"
        fileName="readme.md"
        sizeBytes={2048}
      />
    );

    expect(screen.getByTestId("text-file-card")).toBeInTheDocument();
    expect(screen.getByText("readme.md")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
  });

  it("formats bytes correctly", () => {
    const { rerender } = render(
      <TextFile
        url="mc-img://chat-text/a.txt"
        fileName="a.txt"
        sizeBytes={500}
      />
    );

    expect(screen.getByText("500 B")).toBeInTheDocument();

    cleanup();

    render(
      <TextFile
        url="mc-img://chat-text/b.txt"
        fileName="b.txt"
        sizeBytes={1536000}
      />
    );

    expect(screen.getByText("1.5 MB")).toBeInTheDocument();
  });

  it("opens preview modal on click and displays text content", async () => {
    render(
      <TextFile
        url="mc-img://chat-text/test.txt"
        fileName="test.txt"
        sizeBytes={100}
      />
    );

    expect(screen.queryByTestId("text-file-preview")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("text-file-card"));

    expect(screen.getByTestId("text-file-preview")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("line 1\nline 2\nline 3")).toBeInTheDocument();
    });
  });

  it("does not open preview when preview prop is false", () => {
    render(
      <TextFile
        url="mc-img://chat-text/test.txt"
        fileName="test.txt"
        sizeBytes={100}
        preview={false}
      />
    );

    fireEvent.click(screen.getByTestId("text-file-card"));
    expect(screen.queryByTestId("text-file-preview")).not.toBeInTheDocument();
  });

  it("closes preview via Close button and Escape key", async () => {
    render(
      <TextFile
        url="mc-img://chat-text/test.txt"
        fileName="test.txt"
        sizeBytes={100}
      />
    );

    fireEvent.click(screen.getByTestId("text-file-card"));
    expect(screen.getByTestId("text-file-preview")).toBeInTheDocument();

    const closeBtn = screen.getByLabelText("Close preview");
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId("text-file-preview")).not.toBeInTheDocument();

    // 重新打开后按 Escape
    fireEvent.click(screen.getByTestId("text-file-card"));
    expect(screen.getByTestId("text-file-preview")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("text-file-preview")).not.toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("fail"));

    render(
      <TextFile
        url="mc-img://chat-text/bad.txt"
        fileName="bad.txt"
        sizeBytes={100}
      />
    );

    fireEvent.click(screen.getByTestId("text-file-card"));

    await waitFor(() => {
      expect(screen.getByText("文件加载失败")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败（组件尚未创建完整）**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx vitest run test/renderer/components/ui/TextFile.test.tsx 2>&1 | tail -15
```

- [ ] **Step 3: 完成 Task 9 的组件后运行测试**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx vitest run test/renderer/components/ui/TextFile.test.tsx 2>&1 | tail -15
```

Expected: 全部通过。

- [ ] **Step 4: Commit**

```bash
git add test/renderer/components/ui/TextFile.test.tsx src/renderer/src/components/ui/TextFile.tsx
git commit -m "feat(TextFile): add text file card component with preview modal"
```

---

### Task 11: 修改 AiChatInput 支持文本文件上传

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput.tsx`

- [ ] **Step 1: 新增导入**

在现有 import 中新增 `TextFile` 组件导入：

```typescript
import { TextFile } from "@/components/ui/TextFile";
```

- [ ] **Step 2: 新增状态与常量**

在 `selectedImages` 状态下方新增文本文件状态类型与状态：

```typescript
// 文本文件支持的最大数量。
const MAX_TEXT_FILES = 6;

// 文本文件 MIME 类型集合。
const SUPPORTED_TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/xml",
  "text/html",
  "text/css",
  "text/javascript",
  "text/x-python",
  "text/x-java",
  "text/x-c",
  "text/x-c++",
  "text/x-sh",
  "text/x-bash",
  "text/x-zsh",
  "text/x-ruby",
  "text/x-go",
  "text/x-rust",
  "text/x-swift",
  "text/x-kotlin",
  "text/x-scala",
  "text/x-lua",
  "text/x-perl",
  "text/x-php",
  "text/x-sql",
  "text/yaml",
  "application/json",
  "application/x-yaml",
  "application/toml",
  "application/typescript",
  "application/xml",
  "application/x-sh",
]);

// 已选文本文件条目。
type SelectedTextFile = {
  // 落盘文件名。
  fileName: string;
  // 协议 URL。
  url: string;
  // 原始文件名。
  originalName: string;
  // 文件大小（字节）。
  sizeBytes: number;
};
```

在 `selectedImages` 状态下方新增：

```typescript
const [selectedTextFiles, setSelectedTextFiles] = useState<SelectedTextFile[]>([]);
```

- [ ] **Step 3: 新增文本文件上传处理函数**

在 `handleUploadFiles` 函数之后，新增文本文件专用上传函数：

```typescript
/**
 * 判断文件是否为支持的文本类型。
 */
const isTextFile = (file: File): boolean => {
  if (SUPPORTED_TEXT_MIME_TYPES.has(file.type)) {
    return true;
  }

  // MIME 回退时通过扩展名判断。
  const supportedExtensions = [
    ".txt", ".md", ".json", ".csv", ".log", ".xml",
    ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
    ".env", ".sh", ".bash", ".zsh", ".py", ".js", ".ts",
    ".jsx", ".tsx", ".html", ".css", ".scss", ".less",
    ".sql", ".java", ".c", ".cpp", ".h", ".hpp", ".rs",
    ".go", ".rb", ".php", ".swift", ".kt", ".scala",
    ".r", ".lua", ".pl", ".pm", ".bat", ".ps1",
  ];

  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

  return supportedExtensions.includes(ext);
};

/**
 * 异步上传并存储文本文件。
 */
const handleUploadTextFiles = async (files: FileList | File[]): Promise<void> => {
  if (!window.api?.files?.saveAiChatTextFile) {
    toast.error("当前环境不支持保存文本文件，无法上传。");
    return;
  }

  const currentCount = selectedTextFiles.length;

  if (currentCount >= MAX_TEXT_FILES) {
    toast.warning(`最多只能上传 ${MAX_TEXT_FILES} 个文本文件`);
    return;
  }

  const remainingSlots = MAX_TEXT_FILES - currentCount;
  const fileArray = Array.from(files);
  const textFiles = fileArray.filter((file) => isTextFile(file));

  if (textFiles.length === 0 && fileArray.length > 0) {
    toast.warning("仅支持上传常见文本/代码文件");
    return;
  }

  if (textFiles.length > remainingSlots) {
    toast.warning(`最多只能上传 ${MAX_TEXT_FILES} 个文本文件，已自动截取前 ${remainingSlots} 个`);
  }

  const allowedFiles = textFiles.slice(0, remainingSlots);
  const uploaded: SelectedTextFile[] = [];

  for (const file of allowedFiles) {
    if (file.size > 5 * 1024 * 1024) {
      toast.warning(`文件 ${file.name} 超过 5MB 限制`);
      continue;
    }

    try {
      const buffer = await file.arrayBuffer();
      const result = await window.api.files.saveAiChatTextFile({
        name: file.name,
        mimeType: file.type,
        bytes: buffer,
      });

      uploaded.push({
        fileName: result.fileName,
        url: result.url,
        originalName: result.originalName,
        sizeBytes: result.sizeBytes,
      });
    } catch (err) {
      toast.error(`文件 ${file.name} 上传失败`);
    }
  }

  if (uploaded.length > 0) {
    setSelectedTextFiles((prev) => [...prev, ...uploaded]);
  }
};
```

- [ ] **Step 4: 修改现有处理函数以支持文本文件**

修改 `handleDragOver` — 文本文件拖拽始终允许（不依赖 `isImageSupported`）：

```typescript
const handleDragOver = (e: React.DragEvent): void => {
  e.preventDefault();
  setIsDragging(true);
};
```

修改 `handleDragLeave` — 无需变更。

修改 `handleDrop` — 同时处理图片和文本文件：

```typescript
const handleDrop = async (e: React.DragEvent): Promise<void> => {
  e.preventDefault();
  setIsDragging(false);

  const files = e.dataTransfer.files;

  if (files && files.length > 0) {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter((f) => f.type.startsWith("image/"));
    const textFiles = fileArray.filter((f) => !f.type.startsWith("image/") && isTextFile(f));

    if (isImageSupported && imageFiles.length > 0) {
      await handleUploadFiles(imageFiles);
    }

    if (textFiles.length > 0) {
      await handleUploadTextFiles(textFiles);
    }
  }
};
```

修改 `handlePaste` — 同时处理图片和文本文件粘贴：

```typescript
const handlePaste = async (
  e: React.ClipboardEvent<HTMLTextAreaElement>,
): Promise<void> => {
  const items = e.clipboardData?.items;
  if (!items) return;

  const imageFiles: File[] = [];
  const textFileList: File[] = [];

  for (const item of Array.from(items)) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) imageFiles.push(file);
    } else {
      const file = item.getAsFile();
      if (file && isTextFile(file)) textFileList.push(file);
    }
  }

  if (imageFiles.length > 0 || textFileList.length > 0) {
    e.preventDefault();
    if (isImageSupported && imageFiles.length > 0) {
      await handleUploadFiles(imageFiles);
    }
    if (textFileList.length > 0) {
      await handleUploadTextFiles(textFileList);
    }
  }
};
```

修改 `handleAttachmentClick` — 文件选择同时接受文本文件：

```typescript
const fileInputRef = useRef<HTMLInputElement>(null);
```

`<input>` 的 `accept` 改为：

```typescript
accept={isImageSupported ? "image/*,.txt,.md,.json,.csv,.log,.xml,.yaml,.yml,.toml,.ini,.cfg,.conf,.env,.sh,.bash,.zsh,.py,.js,.ts,.jsx,.tsx,.html,.css,.scss,.less,.sql,.java,.c,.cpp,.h,.hpp,.rs,.go,.rb,.php,.swift,.kt,.scala,.r,.lua,.pl,.pm,.bat,.ps1" : ".txt,.md,.json,.csv,.log,.xml,.yaml,.yml,.toml,.ini,.cfg,.conf,.env,.sh,.bash,.zsh,.py,.js,.ts,.jsx,.tsx,.html,.css,.scss,.less,.sql,.java,.c,.cpp,.h,.hpp,.rs,.go,.rb,.php,.swift,.kt,.scala,.r,.lua,.pl,.pm,.bat,.ps1"}
```

修改 `onChange` handler 分发文本与图片文件：

```typescript
onChange={(e) => {
  if (e.target.files) {
    const fileArray = Array.from(e.target.files);
    const imageFiles = fileArray.filter((f) => f.type.startsWith("image/"));
    const textFiles = fileArray.filter((f) => !f.type.startsWith("image/") && isTextFile(f));

    if (isImageSupported && imageFiles.length > 0) {
      void handleUploadFiles(imageFiles);
    }
    if (textFiles.length > 0) {
      void handleUploadTextFiles(textFiles);
    }
  }
  e.target.value = "";
}}
```

- [ ] **Step 5: 修改拖拽覆盖层提示语**

```typescript
{isDragging && (
  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[6px] border-2 border-dashed border-white/20 bg-black/90 backdrop-blur-xs text-white/90 pointer-events-none">
    <Paperclip className="h-6 w-6 mb-2 animate-bounce" />
    <span className="text-xs font-medium">松手即可上传图片或文本文件</span>
  </div>
)}
```

- [ ] **Step 6: 插入文本文件列表渲染（在图片列表上方）**

在图片列表 `{selectedImages.length > 0 && (` 之前插入文本文件列表：

```typescript
{/* 上传文本文件微缩预览横轴 */}
{selectedTextFiles.length > 0 && (
  <div className="flex flex-wrap gap-2 px-1.5 py-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
    {selectedTextFiles.map((file, idx) => (
      <div key={idx} className="relative group/preview-txt">
        <TextFile
          url={file.url}
          fileName={file.originalName}
          sizeBytes={file.sizeBytes}
          preview={true}
        />
        <button
          type="button"
          aria-label="Remove text file"
          onClick={() => setSelectedTextFiles((prev) => prev.filter((_, i) => i !== idx))}
          className="absolute -top-1.5 -right-1.5 z-10 hidden group-hover/preview-txt:flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-500 transition-colors"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 7: 修改 handleSend 将文本文件拼入消息 parts**

在 `handleSend` 中，于图片 parts 之前插入文本文件 parts：

```typescript
selectedTextFiles.forEach((file, i) => {
  parts.push({
    id: `msg-txtfile-${i}-${Date.now()}`,
    kind: "text-file",
    url: file.url,
    fileName: file.originalName,
    sizeBytes: file.sizeBytes,
  });
});
```

同时更新 `canSend` 条件：

```typescript
const canSend = Boolean(inputSendPayload.text.trim() || selectedImages.length > 0 || selectedTextFiles.length > 0);
```

- [ ] **Step 8: 修改 handleClearInput 清空文本文件**

```typescript
setSelectedTextFiles([]);
```

- [ ] **Step 9: 验证编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 | head -10
```

Expected: 无新增错误。

- [ ] **Step 10: Commit**

```bash
git add src/renderer/src/features/ai-chat/components/AiChatInput.tsx
git commit -m "feat(ai-chat): add text file upload with preview, paste, and drag-drop support"
```

---

### Task 12: 修改 AiChatMessageBubble 渲染文本文件

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatMessageBubble.tsx`

- [ ] **Step 1: 新增 TextFile 导入**

```typescript
import { TextFile } from "@/components/ui/TextFile";
```

- [ ] **Step 2: 在用户消息气泡中渲染文本文件**

在现有的图片渲染块（`message.parts && message.parts.some((p) => p.kind === "image")`）之前，新增文本文件渲染块：

```typescript
{message.parts && message.parts.some((p) => p.kind === "text-file") && (
  <div className="flex flex-wrap gap-2 mb-2 justify-end w-full">
    {message.parts
      .filter((p) => p.kind === "text-file")
      .map((part, i) => (
        <TextFile
          key={i}
          url={part.url}
          fileName={part.fileName}
          sizeBytes={part.sizeBytes}
          preview={true}
        />
      ))}
  </div>
)}
```

此块放置于 `userBubbleRef` 内部、文本内容 `div` 之前，与图片渲染块同级。

完整用户消息区域的渲染顺序：
1. 文本文件列表
2. 图片列表
3. 文本内容
4. 展开/收起按钮

- [ ] **Step 3: 验证编译**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 | head -10
```

Expected: 无新增错误。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/features/ai-chat/components/AiChatMessageBubble.tsx
git commit -m "feat(ai-chat): render text file parts in user message bubbles"
```

---

### Task 13: 运行全量测试验证

**Files:**
- 全部已修改文件

- [ ] **Step 1: 运行所有测试**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx vitest run 2>&1 | tail -20
```

Expected: 全部通过，无失败。

- [ ] **Step 2: 运行 TypeScript 全面类型检查**

```bash
cd /Users/yonah/projects/agent/memory-curator-agent && npx tsc --noEmit -p src/main/tsconfig.json 2>&1 && npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 && npx tsc --noEmit -p src/preload/tsconfig.json 2>&1
```

Expected: 全部无错误。

- [ ] **Step 3: 如通过，最终 commit**

```bash
git add -A
git commit -m "chore: finalize text file upload feature with all tests passing"
```
