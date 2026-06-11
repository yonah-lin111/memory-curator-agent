# 规格设计：AI 聊天图片上传与多模态交互功能 (Image Upload in AI Chat)

本项目设计方案基于第一性原理，旨在为 `memory-curator-agent` 带来最底层、健壮且优雅的图片上传与多模态渲染交互能力。

## 1. 核心意图与架构设计

### 1.1 核心数据流

本方案采用 **方案 1：微创式片段多模态架构 (Recommended)**。
- **前端输入**：用户点击附件、粘贴或拖拽图片到输入框时，通过新增的 IPC 管道 `window.api.files.saveAiChatImage(file)` 将图片保存到本机目录 `~/.mc/img/chat/`，返回安全的自定义协议 URL `mc-img://chat/<filename>`。
- **历史持久化**：不更改已有的 SQLite DDL 表结构，利用已存在的 `parts_json` 字段，向 `AiChatMessagePart` 中扩展一个 `'image'` 类型。消息在落库和渲染时一律以片段流的逻辑加载。
- **大模型适配**：在 `aiSdkProvider.ts` 翻译层，检测到用户消息带有 `'image'` 片段时，将单条消息拼装为 `Vercel AI SDK` 支持的标准多模态 `CoreMessage`（通过读取本地图片并构造成 Base64 传递给底层的 Anthropic / OpenAI / Google SDK）。

```
+---------------+         IPC: saveAiChatImage        +---------------------+
|  Renderer JS  | ----------------------------------> |   Electron Main     |
| (Drag/Paste/  | <---------------------------------- | (Local Dir/Protocol)|
| Click Attachment)   URL: mc-img://chat/<filename>   +---------------------+
+---------------+                                                |
        |                                                        v
        | SQLite: save parts_json                     +---------------------+
        v                                             |    Vercel AI SDK    |
+---------------+       Build Multi-modal Message      | (Anthropic/OpenAI/  |
|  SQLite DB    | ----------------------------------> | Google Multi-modal) |
+---------------+                                     +---------------------+
```

---

## 2. 详细规格与交互体验设计

### 2.1 交互设计亮点 (美观、新颖、极简)
- **拖拽体验 (Drag Over Overlay)**：当检测到图片或文件被拖拽至主窗口时，整个输入框区域上方会平滑渐显一个毛玻璃遮罩（Overlay），带有虚线边框以及“松手即可上传”的动画提示，提供极佳的沉浸式反馈。
- **粘贴/粘贴板直传**：用户在输入框内按 `Cmd/Ctrl+V`，无需中转，直接检测剪贴板文件流并执行异步保存，并自动在输入框上方渲染预览微缩图。
- **附件选择器**：附件按钮激活。点击弹出多选图片窗口。
- **多图预览区 (Image Gallery Preview)**：输入框正上方设计一个高颜值微缩图横向列表。包含：
  - 微缩图骨架屏加载态。
  - Hover 显示精美的悬浮删除按钮。
  - 数量上限与单张大小（最大 10MB）拦截保护。
- **预览光箱 (Lightbox Zoom-In)**：图片组件具有“全屏全焦预览”能力。点击图片，会伴随着弹性（Elastic）缩放过渡动画展开一个黑底毛玻璃遮罩，支持滚轮缩放、拖拽和 Esc 一键关闭。
- **模型模态限制 (Modality Restriction & Check)**：
  - 加载模型列表时，检查当前选中模型的 `modalities.input` 数组是否包含 `"image"`。
  - 若不支持图片，在点击附件/拖拽/粘贴时抛出带有淡出动效的 `Toast` 错误提醒。
  - 在切换模型时：若新模型不支持图片，立刻调用清理函数移除所有已选择/已上传的临时图片。

---

## 3. 实现细则与类定义扩展

### 3.1 路径与自定义图片协议扩展 (`src/main/paths.ts` & `markdownImages.ts`)
1. 在 `paths.ts` 中增加 `getAiChatImageDir()` 指向 `~/.mc/img/chat`。
2. 在 `markdownImages.ts` 中增加 `AI_CHAT_IMAGE_HOST = 'chat'`，实现对协议主机名的优雅路由解析。
3. 在 `imageProtocol.ts` 的协议处理器中，支持向 `resolveAiChatImagePath` 进行路径映射。

### 3.2 数据库与数据类型扩展 (`src/main/db/schema.ts` & `types.ts`)
1. 在 `src/main/db/schema.ts` 和 `src/renderer/src/features/ai-chat/types.ts` 中，将 `AiChatMessagePart` 拓展为三叉 Union：
```typescript
export type AiChatMessagePart =
  | { id: string; kind: 'text'; content: string }
  | { id: string; kind: 'reasoning'; content: string }
  | { id: string; kind: 'tool'; stepId: string }
  | { id: string; kind: 'image'; url: string } // 新增：保存的图片本地协议地址
```

### 3.3 大模型翻译层适配 (`src/main/agent/providers/aiSdkProvider.ts`)
1. 在 `toAiSdkMessage` 转换前，读取 `AgentMessage.parts`。
2. 如果包含 `kind === 'image'` 的片段，将消息转换成 Vercel AI SDK 多模态形式：
```typescript
const toAiSdkMessage = (message: AgentMessage): ModelMessage => {
  if (message.parts && message.parts.some(p => p.kind === 'image')) {
    const parts: Array<TextPart | ImagePart> = []
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
  // 兜底为普通文本
  return { role: message.role, content: message.content } as ModelMessage
}
```

### 3.4 前端气泡渲染与图片预览组件开发 (`src/renderer/src/components/ui/Image.tsx`)
在 `src/renderer/src/components/ui/Image.tsx` 下实现全新、自包含、优雅的高级图片预览组件 `Image`：
- 支持 `className`，具有默认的 `6px` 圆角（遵循 `GEMINI.md`）。
- hover 有微交互放大与滤镜过渡动效。
- 集成 Lightbox 预览层（支持滚轮缩放、左右切换、拖拽、Esc 关闭）。

---

## 4. 自动化单元测试策略 (Vitest)
我们将为新的和重构的模块提供 100% 满覆盖、端到端质量保障的自动化测试：
1. **组件单元测试**：
   - `@test/renderer/components/ui/Image.test.tsx`：验证 Image 组件在 `loading` 态、`loaded` 态、`error` 态以及点击展示全屏 Lightbox 交互的正确性。
2. **多模态翻译测试**：
   - `@test/main/agent/providers/aiSdkProvider.test.ts`：增加多模态转换测试，验证图片解析与转换为 Vercel AI SDK 接收参数的正确性。
3. **数据库与落盘 IPC 测试**：
   - `@test/main/services/filesService.test.ts`：验证 `saveAiChatImage` 的二进制流写入、路径安全隔离及自定义本地协议读取。
