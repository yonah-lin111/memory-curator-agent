# AI Chat Image Upload and Multimodal Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement image uploading (click, paste, drag & drop) in AI Chat, persist images to configured local path (`~/.mc/img/chat`), store paths in SQLite `parts_json`, restrict uploads based on selected model modalities, and adapt messages to various AI SDKs (such as OpenAI, Anthropic, Gemini, etc.) using Vercel AI SDK multimodal content formats.

**Architecture:** Extended sequential parts model (`AiChatMessagePart` with a new `'image'` type) mapped to standard Vercel AI SDK multimodal messages, backed by a custom secure protocol `mc-img://chat/<filename>` on the main process and a reusable, highly polished, premium previewable `Image` component.

**Tech Stack:** React, TypeScript, Electron, SQLite (Drizzle ORM), TailwindCSS, Vercel AI SDK, Vitest.

---

## Files Mapping

- **Create**:
  - `src/renderer/src/components/ui/Image.tsx` - Reusable image preview component.
  - `test/renderer/components/ui/Image.test.tsx` - Unit tests for the Image component.
- **Modify**:
  - `src/main/paths.ts` - Path configurations for `getAiChatImageDir()`.
  - `src/main/protocols/markdownImages.ts` - Multi-host route configurations for `AI_CHAT_IMAGE_HOST`.
  - `src/main/protocols/imageProtocol.ts` - Host mapping for local protocols.
  - `src/main/services/filesService.ts` - Image storage engine expansion (`saveAiChatImage`).
  - `src/main/ipc/filesHandlers.ts` - Register `files:ai-chat-image:save` IPC handler.
  - `src/preload/index.ts` - Expose API layer `files.saveAiChatImage`.
  - `src/renderer/src/env.d.ts` - Expose TypeScript declarations.
  - `src/main/db/schema.ts` - Extend `AiChatMessagePart` database union.
  - `src/renderer/src/features/ai-chat/types.ts` - Extend frontend `AiChatMessagePart` union.
  - `src/main/agent/providers/aiSdkProvider.ts` - Multimodal adapter mapping for AI SDK messages.
  - `src/main/agent/core/contextMessages.ts` - Context assembly & payload preservation.
  - `src/main/ipc/aiHandlers.ts` - Append image parts in startChat handlers.
  - `src/renderer/src/features/ai-chat/components/AiChatInput.tsx` - Drag/Paste upload and preview layout.
  - `src/renderer/src/features/ai-chat/components/AiChatMessageBubble.tsx` - Multimodal message parsing and component rendering.

---

## Tasks Decomposition

### Task 1: Main Process File Engine, Path & Custom Protocol

**Files:**
- Modify: `src/main/paths.ts`
- Modify: `src/main/protocols/markdownImages.ts`
- Modify: `src/main/protocols/imageProtocol.ts`
- Modify: `src/main/services/filesService.ts`
- Modify: `src/main/ipc/filesHandlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`
- Test: `test/main/services/filesService.test.ts`

- [ ] **Step 1: Write path & protocols tests**
Write a failing test case in `test/main/services/filesService.test.ts` verifying saving an AI chat image and resolving its protocol URL.
```typescript
import { createFilesService } from '@/services/filesService'
// test saveAiChatImage returns filename, path, and mc-img://chat/ url
```

- [ ] **Step 2: Add getAiChatImageDir to paths.ts**
```typescript
// src/main/paths.ts:31-35
export const getAiChatImageDir = (): string => join(getAppDataRoot(), 'img', 'chat')
```

- [ ] **Step 3: Add AI_CHAT_IMAGE_HOST to markdownImages.ts**
```typescript
export const AI_CHAT_IMAGE_HOST = 'chat'
export const createAiChatImageUrl = (fileName: string): string =>
  `${MARKDOWN_IMAGE_PROTOCOL}://${AI_CHAT_IMAGE_HOST}/${encodeURIComponent(fileName)}`
export const resolveAiChatImageFileName = (requestUrl: string): string | null => {
  const url = new URL(requestUrl)
  if (url.protocol !== `${MARKDOWN_IMAGE_PROTOCOL}:` || url.hostname !== AI_CHAT_IMAGE_HOST) {
    return null
  }
  return basename(decodeURIComponent(url.pathname.slice(1))) || null
}
export const resolveAiChatImagePath = (requestUrl: string): string | null => {
  const fileName = resolveAiChatImageFileName(requestUrl)
  return fileName ? join(getAiChatImageDir(), fileName) : null
}
```

- [ ] **Step 4: Register route in imageProtocol.ts**
```typescript
    let filePath = resolveMarkdownImagePath(request.url)
    if (!filePath) {
      filePath = resolvePeopleAvatarPath(request.url)
    }
    if (!filePath) {
      filePath = resolveAiChatImagePath(request.url)
    }
```

- [ ] **Step 5: Implement saveAiChatImage in filesService.ts**
```typescript
    saveAiChatImage: async (input) => {
      if (!input.mimeType.startsWith('image/')) {
        throw new Error('仅支持保存图片文件')
      }
      const extension = resolveImageExtension(input.name, input.mimeType)
      const fileName = `${createSafeFileStem(input.name)}-${createCompactUuid()}${extension}`
      const chatImageDir = getAiChatImageDir()
      const filePath = join(chatImageDir, fileName)
      await mkdir(chatImageDir, { recursive: true })
      await writeFile(filePath, Buffer.from(new Uint8Array(input.bytes)))
      return {
        fileName,
        filePath,
        url: createAiChatImageUrl(fileName)
      }
    }
```

- [ ] **Step 6: Register IPC handler & Preload API**
In `src/main/ipc/filesHandlers.ts`:
```typescript
  ipcMain.handle('files:ai-chat-image:save', (_, input: MarkdownImageSaveInput) =>
    filesService.saveAiChatImage(input)
  )
```
In `src/preload/index.ts`:
```typescript
    saveAiChatImage: (payload: MarkdownImageSavePayload): Promise<MarkdownImageSaveResult> =>
      ipcRenderer.invoke('files:ai-chat-image:save', payload)
```
In `src/renderer/src/env.d.ts`:
```typescript
    saveAiChatImage: (payload: MarkdownImageSavePayload) => Promise<MarkdownImageSaveResult>
```

- [ ] **Step 7: Run test to verify it passes**
Run: `pnpm test filesService`
Expected: PASS.

- [ ] **Step 8: Commit**
```bash
git add src/main src/preload src/renderer/src/env.d.ts test/main/services/filesService.test.ts
git commit -m "feat: implement main process chat image local storage & custom protocols"
```

---

### Task 2: Schema Expansion & AI SDK Multimodal Integration

**Files:**
- Modify: `src/main/db/schema.ts`
- Modify: `src/renderer/src/features/ai-chat/types.ts`
- Modify: `src/main/agent/providers/aiSdkProvider.ts`
- Modify: `src/main/agent/core/contextMessages.ts`
- Modify: `src/main/ipc/aiHandlers.ts`
- Test: `test/main/agent/providers/aiSdkProvider.test.ts`

- [ ] **Step 1: Write failing test for multi-modal conversion**
Write a failing test in `test/main/agent/providers/aiSdkProvider.test.ts` to verify converting user message with image part into Vercel AI SDK CoreMessage.

- [ ] **Step 2: Update database schema and types**
In `src/main/db/schema.ts` & `src/renderer/src/features/ai-chat/types.ts` append `'image'` to `AiChatMessagePart`:
```typescript
export type AiChatMessagePart =
  | { id: string; kind: 'text'; content: string }
  | { id: string; kind: 'reasoning'; content: string }
  | { id: string; kind: 'tool'; stepId: string }
  | { id: string; kind: 'image'; url: string } // Local custom url protocol
```

- [ ] **Step 3: Modify toAiSdkMessage in aiSdkProvider.ts**
Read parts, load local image base64, and construct multi-modal CoreMessage:
```typescript
// Import readFileSync and resolve path helper in aiSdkProvider.ts
const readImageAsBase64 = (url: string): { base64: string; mimeType: string } | null => {
  try {
    let filePath: string | null = null
    if (url.startsWith('mc-img://chat/')) {
      filePath = resolveAiChatImagePath(url)
    } else if (url.startsWith('mc-img://md/')) {
      filePath = resolveMarkdownImagePath(url)
    } else if (url.startsWith('mc-img://people/')) {
      filePath = resolvePeopleAvatarPath(url)
    }
    if (!filePath) return null
    const ext = extname(filePath).toLowerCase()
    const mimeType = MIME_TYPES[ext] || 'image/png'
    const buffer = readFileSync(filePath)
    return { base64: buffer.toString('base64'), mimeType }
  } catch {
    return null
  }
}
```
Update `toAiSdkMessage` structure:
```typescript
const toAiSdkMessage = (message: AgentMessage): ModelMessage => {
  // Check if message has image parts
  if (message.parts && message.parts.some((p) => p.kind === 'image')) {
    const parts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string; mimeType: string }> = []
    for (const part of message.parts) {
      if (part.kind === 'text') {
        parts.push({ type: 'text', text: part.content })
      } else if (part.kind === 'image') {
        const base64Data = readImageAsBase64(part.url)
        if (base64Data) {
          parts.push({
            type: 'image',
            image: base64Data.base64,
            mimeType: base64Data.mimeType
          })
        }
      }
    }
    return { role: message.role, content: parts } as ModelMessage
  }
  // Fallback to normal text...
}
```

- [ ] **Step 4: Update buildContextAgentMessages in contextMessages.ts**
Allow `BuildContextAgentMessagesInput` to accept `userParts?: AiChatMessagePart[]` and attach it to the current user message:
```typescript
  return [
    systemMessage,
    ...contextMessages,
    {
      role: 'user',
      content: userMessage,
      parts: userParts
    }
  ]
```
Also preserve historical message parts inside `toContextAgentMessages`:
```typescript
const toContextAgentMessages = (item: SelectedContextItem): AgentMessage[] => {
  if (item.kind !== 'tool') {
    return [
      {
        role: resolveContextRole(item),
        content: item.content,
        parts: item.meta?.parts ? JSON.parse(item.meta.parts as string) : undefined
      }
    ]
  }
  ...
}
```

- [ ] **Step 5: Bind parts parameter to aiHandlers.ts**
In `aiHandlers.ts`:
Expand `AiChatStartPayload` to support `parts?: AiChatMessagePart[]`.
Pass `payload.parts` to `createRunWithMessages` for `userMessage.parts`.
And inject `payload.parts` as `userParts` in `buildContextAgentMessages`:
```typescript
          messages: buildContextAgentMessages({
            systemMessage: appendAiChatAgentDirectiveToSystemMessage(createSystemPrompt(), agentHints),
            userMessage: payload.message,
            userParts: payload.parts, // Inject user parts
            ...
```

- [ ] **Step 6: Run tests to verify all tests pass**
Run: `pnpm test aiSdkProvider`
Expected: PASS.

- [ ] **Step 7: Commit**
```bash
git add src/main/db src/renderer/src/features/ai-chat/types.ts src/main/agent src/main/ipc
git commit -m "feat: implement sqlite parts and Vercel AI SDK multimodal integration"
```

---

### Task 3: Premium UI Image Component with Preview

**Files:**
- Create: `src/renderer/src/components/ui/Image.tsx`
- Create: `test/renderer/components/ui/Image.test.tsx`

- [ ] **Step 1: Write comprehensive test for Image component**
Write tests in `test/renderer/components/ui/Image.test.tsx` ensuring:
- Loading skeleton is shown initially.
- Correct layout on load.
- Displays full-screen Lightbox on click.
- Fully supports keyboard Esc key to close Lightbox.

- [ ] **Step 2: Implement premium Image.tsx with full Zoom-In Lightbox**
```tsx
import type React from "react";
import { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  preview?: boolean;
}

export const Image = ({ src, alt = "", preview = true, className = "", ...props }: ImageProps): React.JSX.Element => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showLightbox) {
        setShowLightbox(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLightbox]);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));
  const handleRotate = () => setRotate(r => (r + 90) % 360);

  return (
    <>
      <div className={`relative overflow-hidden rounded-[6px] bg-white/[0.02] border border-white/5 group/img-box ${className}`}>
        {loading && <div className="absolute inset-0 bg-white/[0.03] animate-pulse" />}
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          onClick={() => !error && preview && setShowLightbox(true)}
          className={`h-full w-full object-cover transition-all duration-300 ${loading ? "opacity-0" : "opacity-100"} ${error ? "hidden" : ""} ${preview && !error ? "cursor-zoom-in hover:scale-105" : ""}`}
          {...props}
        />
        {error && (
          <div className="flex h-full w-full items-center justify-center p-4 text-xs text-white/40">
            图片加载失败
          </div>
        )}
      </div>

      {showLightbox && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm select-none" onClick={() => setShowLightbox(false)}>
          {/* Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <button className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition" onClick={handleZoomIn}><ZoomIn className="h-4 w-4" /></button>
            <button className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition" onClick={handleZoomOut}><ZoomOut className="h-4 w-4" /></button>
            <button className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition" onClick={handleRotate}><RotateCw className="h-4 w-4" /></button>
            <button className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition" onClick={() => setShowLightbox(false)}><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-[85vh] max-w-[85vw] overflow-hidden flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <img
              src={src}
              alt={alt}
              style={{ transform: `scale(${scale}) rotate(${rotate}deg)`, transition: "transform 0.2s ease-out" }}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
};
```

- [ ] **Step 3: Run Vitest and confirm 100% pass**
Run: `pnpm test Image`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add src/renderer/src/components/ui/Image.tsx test/renderer/components/ui/Image.test.tsx
git commit -m "feat: implement high fidelity previewable Image UI component"
```

---

### Task 4: Input Area Multi-Image Upload, Drag & Paste, Modal Check

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatInput.tsx`
- Test: Modify and run frontend vitest specs.

- [ ] **Step 1: Check support modal for current model**
Check if the selected model supports images:
```typescript
  const selectedModelOption = modelOptions
    .find((p) => p.id === selectedModel?.provider)
    ?.models.find((m) => m.id === selectedModel?.model);
  const isImageSupported = selectedModelOption?.modalities?.input?.includes("image") ?? false;
```

- [ ] **Step 2: Clear selected images if switched to a model without image support**
```typescript
  useEffect(() => {
    if (!isImageSupported && selectedImages.length > 0) {
      setSelectedImages([]);
      toast.info("当前选择模型不支持图像输入，已清空图片。");
    }
  }, [selectedModelValue, isImageSupported]);
```

- [ ] **Step 3: Drag & Drop upload + Paste Upload**
Implement file processing and local saving via bridge:
```typescript
  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!isImageSupported) {
      toast.error("当前选择的模型不支持图片输入。");
      return;
    }
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) {
        toast.warning("图片大小超出 10MB 限制。");
        continue;
      }
      try {
        const buffer = await file.arrayBuffer();
        const result = await window.api.files.saveAiChatImage({
          name: file.name,
          mimeType: file.type,
          bytes: buffer
        });
        uploaded.push(result.url);
      } catch {
        toast.error(`图片 ${file.name} 上传失败`);
      }
    }
    if (uploaded.length > 0) {
      setSelectedImages(prev => [...prev, ...uploaded]);
    }
  };
```
Bind handlers:
- **Paste Event**: Bind `onPaste` on textarea.
- **Drag Over Event**: Add `isDragging` overlay inside container. Render overlay when `isDragging` is true.

- [ ] **Step 4: Integrate visual preview gallery inside ChatInput**
Under textarea, before control bar, render selected images horizontally:
- Width: `56px`, Height: `56px`, Hover displays floating small close button to remove selected images.

- [ ] **Step 5: Attach parts to send payload**
When executing `handleSend()` / `onSendMessage()`:
```typescript
  const handleSend = () => {
    // Construct message parts list
    const parts: AiChatMessagePart[] = [];
    if (inputText.trim()) {
      parts.push({ id: `msg-text-${Date.now()}`, kind: "text", content: inputText });
    }
    selectedImages.forEach((url, i) => {
      parts.push({ id: `msg-img-${i}-${Date.now()}`, kind: "image", url });
    });
    // Send message payload
    onSendMessage({
      text: inputText,
      parts // Extend sendPayload
    });
    // Reset...
    setSelectedImages([]);
  };
```

- [ ] **Step 6: Commit**
```bash
git add src/renderer/src/features/ai-chat/components/AiChatInput.tsx
git commit -m "feat: implement Drag, Paste and click image uploading inside AiChatInput"
```

---

### Task 5: Multimodal Rendering inside Message Bubble

**Files:**
- Modify: `src/renderer/src/features/ai-chat/components/AiChatMessageBubble.tsx`

- [ ] **Step 1: Expand user message bubble parser**
Update the rendering logic of `AiChatMessageBubble` to support rendering `message.parts` for `isUser`:
```tsx
// Inside AiChatMessageBubble.tsx, if isUser is true and message.parts exists, map parts
const userParts = message.parts || [{ id: `${message.id}-text`, kind: 'text', content: message.content }];
```
If parts contain images, render our newly created premium `<Image>` component:
```tsx
{userParts.map((part) => {
  if (part.kind === "text") {
    return <div className="pr-1 select-text">{part.content}</div>;
  }
  if (part.kind === "image") {
    return <Image src={part.url} className="w-[200px] h-[150px] mt-1.5" />;
  }
  return null;
})}
```

- [ ] **Step 2: Ensure assistant message bubble renders markdown image links correctly via local protocols**
Confirm that local protocols support direct preview loading inside MdPreview.

- [ ] **Step 3: Run comprehensive workspace verification**
Execute linter, formatter and typechecks:
Run: `npm run typecheck && npm run lint`

- [ ] **Step 4: Commit**
```bash
git add src/renderer/src/features/ai-chat/components/AiChatMessageBubble.tsx
git commit -m "feat: render multimodal image parts inside chat bubble"
```
