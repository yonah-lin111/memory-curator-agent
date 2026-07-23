# Agent Skills 功能开发计划

## 1. 目标
在本项目中引入 `Agent Skills` 功能，允许解析 `.md`（含有 Frontmatter）形式的 Skill 文件，并能够将其内容注入到 AI Agent 的上下文中。Skill 能够配置为仅限某些特定的 Agent 使用。在 UI 端提供 `/skill` 的 Slash Command 支持。

## 2. 需求拆解

### 2.1 主进程端 (Main Process)
1. **新建服务：`skillsService.ts`**
   - 职责：
     - 提供获取本地 Skill 文件目录的逻辑（`/Users/yonah/.mc/skills`）。
     - 提供扫描并解析 `*.md` 文件的能力。解析工具选用 `gray-matter`。
     - 解析出的元数据（Frontmatter）中支持自定义属性 `supportedAgents: string[]`（如果为空或不存在，则认为是全局通用的）。
   - 提供给渲染进程暴露的 IPC 接口（如：`skills:list`）。

2. **IPC 与 Preload (preload/index.ts & ipc/)**
   - 在主进程注册处理 `skills:get-list` 的 IPC Handler。
   - 在 `preload/index.ts` 暴露 `window.api.skills.getList()` 接口，返回所有解析后的 Skill 信息。

3. **Agent 集成增强 (promptAiPersistenceService.ts 或 agent core)**
   - 当构建 Agent 上下文（System Prompt）时，需要从已选的 Skill 中抽取对应的内容。
   - 过滤逻辑：判断当前请求所使用的 `agentId` 是否在该 Skill 的 `supportedAgents` 列表内，或者该 Skill 是否为全局通用。

### 2.2 渲染进程端 (Renderer Process - 前端交互)
1. **新增 `/skill` Slash Command 配置**
   - 在 `AiChatInput/constants.ts` 的 `AI_CHAT_INPUT_COMMANDS` 中追加 `/skill` 命令。

2. **编写微 Hook `useAiChatSkills`**
   - 类似于 `useAiChatModels.ts`，负责监听输入框的文本（`inputText`）。
   - 如果用户输入 `/skill`，则请求 IPC 接口拉取本地可用 Skill（并在本地通过缓存或 React State 持久化）。
   - 提供基于用户在 `/skill ` 后面输入的 query 进行本地过滤（支持模糊搜索 name 或 description）的功能。

3. **Slash 面板支持 (MentionCommandPanels.tsx)**
   - 增加关于 `isSkillMode` 的面板展示分支（和模型选择 UI 相似）。
   - 面板需展示过滤后的 Skill 列表。
   - 用户使用键盘 `↑/↓/Enter` 选中某个 Skill 后，执行确认逻辑（将该 Skill 加入到发送上下文状态或直接注入当前会话）。

4. **输入框组装逻辑修改 (useAiChatInput.ts)**
   - 引入并使用上述 `useAiChatSkills` Hook。
   - 处理 Skill 确认事件后的回显：将选中 Skill 转换成类似 tag 的形式展示在输入框顶部或直接将 `inputText` 设置为其引用标志，同时清除输入框。

### 2.3 规范对齐
- UI 组件使用 TailwindCSS，匹配深色主题（主#000000、次#212121）。
- 所有业务层函数采用箭头函数。
- TS interface 用于对象结构扩展，type 用于组合与函数。
- 注释必须使用简体中文，禁止冗余解释。

## 3. 下一步计划
确认此计划后，我们将进入具体的编码阶段。我们将优先完成主进程 `skillsService.ts` 的编写以及与 `preload` 层的打通。

### 2.4 安装依赖
由于需要解析 markdown 的 frontmatter，需要安装 `gray-matter`。
`pnpm add gray-matter`
`pnpm add -D @types/gray-matter`

### 2.5 类型定义增强 (types.ts)
```typescript
export interface AiAgentSkill {
  id: string; // 唯一标识，例如 skill name
  name: string; // 显示名称
  description: string; // 简短描述
  supportedAgents?: string[]; // 支持的 agent 列表，若无则全局可用
  content: string; // 实际的 prompt 内容
  location: string; // 所在路径
}
```

### 2.6 Agent Core 增强
在 `promptAiPersistenceService.ts` 的 `createAiChatSession` 或在通过 `core` (`AiAgentContextBuilder` 等) 组装 `system prompt` 之前，我们需要加入如下逻辑：
```typescript
const skills = await skillsService.getAvailableSkillsForAgent(agentOption.id); // 传入类似 'prompt-design', 'common' 等
let skillContext = "";
if (skills.length > 0) {
  skillContext = "\n\n# User provided Skills:\n" + skills.map(s => s.content).join("\n\n");
}
```

注意，渲染端在对话输入框中选择了 `/skill name` 后，如果用户通过该指令将某个具体的技能绑定到**当前这一次对话请求**中，这也可以作为一个特殊的 `context` 项传递。这取决于我们在 UI 上的期望行为（目前 UI 期望是：输入框选择 skill，然后回显，可能用户发出去的时候该 skill 就带上了）。所以我们可以在 payload 的 `context` 属性中增加一种 `kind: 'skill'`，供主进程解析并动态注入。

在 preload 中可以扩展：
```typescript
type AiChatAgentContextItem = {
  // ... 其他已存在的字段
  kind: 'message' | 'memory' | 'page' | 'file' | 'tool' | 'agent' | 'skill'; // 增加 skill
  skillId?: string; // 如果 kind 是 skill
}
```

### 2.7 上下文生命周期设计 (采用方案 A)
用户在聊天中主动选择或通过 agent 限定加载的 Skill，其生命周期为**Session（会话级）**：
1. **自动挂载**：如果 Skill 的 `supportedAgents` 包含了当前启动的 Agent，那么在该 Agent 的任何会话中，该 Skill 的内容将自动合并至 System Prompt，持续生效。
2. **手动挂载**：如果在输入框中使用 `/skill [name]` 触发并发送，该 Skill 将被绑定到**当前会话 (Session)** 中。接下来的所有轮次交互都将携带该 Skill 的上下文，直到用户清空对话 (`/clear` 或新建 Session)。
3. **前端状态呈现**：对于手动挂载或特定的 Skill，UI 上（如聊天时间线顶部或输入框上方）会以 Tag 的形式展示当前会话已激活的技能（例如 `[Skill: xxx]`），以明确告知用户当前 Agent 的能力状态。
