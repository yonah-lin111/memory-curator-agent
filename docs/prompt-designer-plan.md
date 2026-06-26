# 提示词设计器功能实现计划

## Context

当前项目缺少提示词设计与管理功能。Header 组件中已预留了 `isPromptsOpen` / `onPromptsToggle` 属性及 Book 图标按钮，但从未在 App.tsx 中接入。需要新增一个完整的「提示词设计器」功能模块，支持：
- 项目-提示词两级层级管理
- AI 辅助提示词设计与优化（共用现有 agent，添加文件读取工具）
- 新颖的编辑器+AI 协作交互体验
- 数据通过 IPC 持久化到主进程文件系统

---

## 一、共享 AI 控制器的策略

**问题**：`useAiChatController` 是单例 hook，管理模型选项加载与缓存。提示词设计器需要自己的 AI 会话，但应共享同一个模型选择。

**方案**：从 `useAiChatController` 中抽取模型状态管理为独立 hook `useAiModelState`：
- 该 hook 负责加载 provider/model 列表、管理 `selectedAiModel`（含 localStorage 持久化）
- `useAiChatController` 改为接受可选的 `modelState` 入参；传入时跳过内部加载逻辑（向后兼容）
- `usePromptDesignerController` 同样接受 `modelState`，共享同一份模型状态
- 两个控制器各自维护独立的 session 列表和 IPC 事件订阅

**文件变更**：
- 新建 `src/renderer/src/features/ai-chat/useAiModelState.ts`
- 修改 `useAiChatController.ts` — 添加可选 `modelState` 参数
- 修改 `App.tsx` — 提升 `useAiModelState` 到 AppContent 层

---

## 二、App.tsx 接入

在 `AppContent` 中添加：
- `const [isPromptsOpen, setIsPromptsOpen] = useState(false)`
- `handlePromptsToggle` — 若 chat 已打开则先关闭 chat，再切换 prompts
- 第三个 overlay 层（与 chat 并列），交叉淡入淡出 PromptDesignerWorkspace
- Sidebar 在 prompts 打开时保持 `"navigation"` 模式

---

## 三、数据模型

```typescript
// 项目
type PromptProject = {
  id: string;           // 紧凑 UUID
  name: string;
  description?: string;
  createdAt: string;    // ISO 时间戳
  updatedAt: string;
};

// 提示词版本
type PromptVersion = {
  id: string;
  content: string;
  versionNumber: number;
  notes?: string;
  createdAt: string;
};

// 提示词
type PromptDesign = {
  id: string;
  projectId: string;
  name: string;
  content: string;              // 当前最新正文
  currentVersionNumber: number;
  versions: PromptVersion[];    // 全量版本历史（内联存储）
  createdAt: string;
  updatedAt: string;
};
```

**存储方式**：主进程文件系统 JSON，路径 `{userData}/prompt-designer/`：
- `projects.json` — 项目列表
- `prompts/{promptId}.json` — 单个提示词（含版本历史）

**IPC 通道**（全为 `ipcRenderer.invoke` → `ipcMain.handle`）：

| Channel | 描述 |
|---|---|
| `prompt-designer:projects:list` | 获取全部项目 |
| `prompt-designer:projects:create` | 创建项目 |
| `prompt-designer:projects:update` | 更新项目 |
| `prompt-designer:projects:delete` | 删除项目（级联删除所含提示词） |
| `prompt-designer:prompts:list` | 按 projectId 列出提示词 |
| `prompt-designer:prompts:get` | 获取单个提示词详情 |
| `prompt-designer:prompts:create` | 创建提示词 |
| `prompt-designer:prompts:update` | 更新提示词（自动追加版本） |
| `prompt-designer:prompts:delete` | 删除提示词 |

---

## 四、Agent 文件读取工具

现有 agent 只有数据库 CRUD 工具，需要添加两个通用文件操作工具。

### 工具设计（参考 opencode-dev read.ts）

命名以 `common_tool_` 为前缀，确保 `common` agent 场景下可用（`chatRunner.ts` 第 83-86 行会按此前缀过滤）。

**`common_tool_read_file`**：
- 参数：`filePath` (必填，绝对路径)、`offset` (起始行号)、`limit` (最大行数，默认 2000)
- 返回：带行号的文件内容，XML 包裹（`<path>`, `<type>`, `<content>`）
- 安全：检测二进制文件后拒绝；路径不存在时模糊匹配建议

**`common_tool_list_directory`**：
- 参数：`directoryPath` (必填)
- 返回：排序后的文件/目录列表，带类型标记

**涉及文件**：
- 新建 `src/main/agent/tools/readFileTool.ts`
- 新建 `src/main/agent/tools/listDirectoryTool.ts`
- 修改 `src/main/agent/tools/toolRegistry.ts` — 在 `builtinToolFactories` 中添加

---

## 五、组件树

```
features/prompt-designer/
├── types.ts                              # 类型定义
├── usePromptDesignerController.ts        # AI 会话控制器
├── usePromptDesignerStore.ts             # Zustand store（项目/提示词 CRUD 状态）
├── components/
│   ├── PromptDesignerWorkspace.tsx        # 顶层覆盖层容器（三栏布局）
│   ├── PromptDesignerSidebar.tsx          # 内部左侧栏（项目-提示词树）
│   ├── PromptEditor.tsx                   # 提示词编辑器（核心交互区）
│   ├── PromptAIAssistant.tsx             # 右侧 AI 助手面板（可折叠）
│   ├── PromptAIAssistantMessageList.tsx   # 助手消息列表（精简版）
│   └── PromptAIAssistantInput.tsx         # 助手输入框（复用 AiChatInput 模式）
```

### 三栏布局（PromptDesignerWorkspace）

```
+-------------------+------------------------+-------------------+
| 左侧栏 (260px)    | 提示词编辑器 (flex-1)   | AI 助手 (340px)   |
| 可折叠            |                        | 可折叠            |
|                   |  [工具栏: 保存/测试/   |                   |
| Projects          |   版本/变量]          |  消息列表         |
|  ├ Project A      |                        |                   |
|  │  ├ Prompt 1 ◉  |  [大型编辑区]          |  [输入框]         |
|  │  └ Prompt 2    |                        |                   |
|  └ Project B      |  [底部状态栏:         |                   |
|                   |   字数/Token/版本]    |                   |
+-------------------+------------------------+-------------------+
```

分栏线使用 1px `border-white/5`，悬停时变亮为 `border-white/10`（暗示可拖拽，实际不实现复杂拖拽）。

---

## 六、新颖交互设计

### 6.1 编辑器特性

1. **变量高亮**：`{{变量名}}` 以 Tag 样式（蓝色/琥珀色）内联渲染，点击弹出测试值输入浮层
2. **版本 diff 快速切换**：编辑器右上角版本选择器（Select 组件），切换时编辑器内容以短暂闪烁（150ms）动效提示内容变化，底部状态栏显示当前版本号
3. **AI 建议内联应用**：AI 的建议以卡片形式嵌入编辑器顶部（可关闭），点击「应用」后直接替换编辑器内容
4. **实时 token 估算**：底部状态栏左侧实时显示 token 估算数（约 1 token ≈ 0.75 中文字符）

### 6.2 AI 协作流

1. **「测试提示词」按钮**：将当前提示词作为系统消息，发送一个测试输入给 AI，展示 AI 如何响应该提示词
2. **「优化提示词」按钮**：发送当前提示词给 AI，请求优化建议（精简、结构化、添加 few-shot 等）
3. **AI 面板**：默认折叠（仅显示一个小标签/把手），点击或通过快捷键 `Cmd+J` 展开/折叠；展开时编辑器宽度平滑收缩（300ms transition）

### 6.3 快捷键

| 快捷键 | 操作 |
|---|---|
| `Cmd+S` | 保存当前提示词 |
| `Cmd+J` | 切换 AI 助手面板 |
| `Cmd+N` | 在 AI 面板聚焦时等同于发送 |
| `Escape` | 关闭 AI 面板 / 取消 AI 生成 |

### 6.4 动效

- 左侧栏项目折叠/展开：`ChevronDown` 旋转动画 + 子列表 `max-height` 过渡
- AI 面板展开/折叠：`transition-all duration-300 ease-out`，从右侧 340px → 0px
- AI 建议卡片进入：从上方 -8px 滑入 + 淡入（220ms）
- 版本切换闪烁：短暂 `bg-white/5` 高亮（200ms 后消退）

---

## 七、实现步骤

### Phase 1：基础设施（主进程 + IPC）
1. 新建 `src/main/services/promptDesignerService.ts` — 文件持久化服务
2. 新建 `src/main/ipc/promptDesignerHandlers.ts` — IPC handlers
3. 在 `src/main/index.ts` 注册服务与 handlers
4. 新建 `src/main/agent/tools/readFileTool.ts` — 文件读取工具
5. 新建 `src/main/agent/tools/listDirectoryTool.ts` — 目录列表工具
6. 修改 `src/main/agent/tools/toolRegistry.ts` — 注册工厂
7. 修改 `src/preload/index.ts` — 暴露 `window.api.promptDesigner`

### Phase 2：模型状态抽取（共享 AI）
8. 新建 `src/renderer/src/features/ai-chat/useAiModelState.ts`
9. 修改 `useAiChatController.ts` — 支持外部 modelState
10. 修改 `App.tsx` — 提升模型状态 + 添加 prompts 切换

### Phase 3：前端控制器与状态管理
11. 新建 `features/prompt-designer/types.ts`
12. 新建 `features/prompt-designer/usePromptDesignerStore.ts`
13. 新建 `features/prompt-designer/usePromptDesignerController.ts`

### Phase 4：UI 组件
14. 新建 `PromptDesignerWorkspace.tsx` — 三栏容器
15. 新建 `PromptDesignerSidebar.tsx` — 项目-提示词树
16. 新建 `PromptEditor.tsx` — 编辑器 + 工具栏 + 状态栏
17. 新建 `PromptAIAssistant.tsx` — AI 助手面板
18. 新建 `PromptAIAssistantMessageList.tsx` — 消息列表
19. 新建 `PromptAIAssistantInput.tsx` — 输入框
20. 在 `App.tsx` 中集成 PromptDesignerWorkspace

---

## 八、验证

1. **编译检查**：`npx tsc --noEmit` 零错误
2. **功能验证**（启动应用后）：
   - 点击 Header Book 图标 → 提示词设计器全屏打开，当前页面隐藏
   - 左侧栏：创建项目、创建提示词、展开/折叠项目、重命名/删除
   - 编辑器：输入提示词、`{{变量}}` 高亮、保存、版本切换
   - AI 面板：打开/折叠、发送消息、文件读取工具调用、取消生成
   - 「测试提示词」按钮：发送提示词给 AI 测试
   - 点击 AI 面板关闭按钮或按 Escape → 面板折叠
   - 点击 Header 关闭按钮 → 返回原页面
   - 提示词按钮与聊天按钮互斥（打开一个时另一个隐藏）
   - 数据持久化：关闭重开后项目/提示词/版本历史完整保留
