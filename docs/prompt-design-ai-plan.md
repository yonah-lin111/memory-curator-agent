# 提示词设计 AI (Prompt Design AI) 工具调用与架构设计方案

## 1. 架构目标与隔离策略

提示词设计页面的 AI 助手与全局悬浮的聊天 AI 虽然在 UI 表现形式上高度一致，但在底层职责与数据归属上存在根本差异。提示词 AI 必须**严格归属于特定的 Prompt Design Item**，且其具备的 AI 工具箱必须针对“提示词设计”这一特定场景（如本地文件读取、提示词沙盒测试等），**严禁与聊天 AI 的工具链（如 MCP、搜索、日历等）发生交叉。**

因此，整体架构采用 **UI 高度复用，数据与逻辑彻底隔离** 的设计思想。

---

## 2. 数据库设计方案 (已完成)

**结论：禁止复用聊天 AI 数据库表，采用「带层级外键的独立隔离表」方案。**

为了防止层级关系错乱以及互相污染，我们新建了以 `prompt_ai_` 为前缀的 5 张专属数据表，并实现了和主聊天 AI 等同的双层存储架构。

### 核心表结构

1. **`prompt_ai_chat_sessions` (会话表)**
   - 核心外键：`design_item_id` (关联 `prompt_design_items`)，带有 `ON DELETE CASCADE`，保证提示词项目删除时清理全部脏数据。
   - 主键使用 `TEXT` 类型 UUID。
2. **`prompt_ai_chat_messages` (消息表)**
   - 包含 `parts_json`（多模态内容）和 `tool_steps_json`（仅存极轻量的前端 UI 渲染摘要，如“正在读取文件”）。
3. **`prompt_ai_agent_runs` (运行生命周期表)**
   - 记录每次大模型请求的状态、耗时与报错，支持未来打断和重试。
4. **`prompt_ai_agent_tool_calls` (工具调用详情表 —— 存储核心)**
   - 真正存储工具入参、出参和几十 KB 文件源码的大表，防止消息表体积爆炸导致前端卡顿。
5. **`prompt_ai_agent_context_snapshots` (上下文快照表)**
   - 记录用户触发 `@文件` 时注入给 AI 的文件静态快照。

---

## 3. 前端 UI 与控制器逻辑

- **UI 渲染复用**：提示词设计的聊天气泡 `PromptAiChatMessageBubble.tsx` 将完全复用聊天 AI 已有的渲染组件，包括：
  - `AiToolCallBlock`：显示工具执行状态。
  - `AiChatThinkingBlock`：显示思考过程。
  - `MdPreview`：渲染 Markdown 回复。
- **状态管理控制**：新建专属 Hook `usePromptAiChatController`，它将代替原有的 `useAiChatController`，负责维护流式响应和本地会话状态，其底层 IPC 通信管道将使用专属的隔离通道（如 `api.promptAi.startSession`）。

---

## 4. 后端 Agent 与专属工具隔离

- **专属 Agent 实例**：在主进程建立完全独立的 `PromptAiAgentService`。在调用 Vercel AI SDK 构建模型请求时，其 `tools` 字段将被重新定义。
- **专属工具开发 (以 `read_document` 为例)**：
  - 参考 `opencode-dev` 项目的读取文档工具设计，在专门的工具库中实现本地文件读取工具（项目地址为：/Users/yonah/projects/agent/opencode-dev）。
  - 该工具接收 `filePath`, `limit`, `offset`，调用底层 `fs` 模块。
  - 必须包含严格的安全拦截机制：限制支持读取的文件格式后缀、限制文件大小，并在过长时抛出截断警告。

---

## 5. @ 命令功能设计 (限定 `@文件`)

- **交互逻辑**：
  1. 在 `PromptAiChatWorkspace` 中引入定制化的 `PromptCommandPanel` (可基于原聊天 AI 的面板精简修改)。
  2. 用户在 `PromptAiChatInput` 中输入 `@` 触发面板，发起对本地项目的文件检索 (globbing/find)，显示候选文件列表及路径。
- **上报与组装**：
  1. 用户回车选中后，输入框插入对应文件的 Token（例如 `@App.tsx`）。
  2. 当发送对话时，前端提取出被 `@` 的文件路径列表发往主进程。
  3. 主进程的 `PromptAiAgentService` 在组装大模型上下文时，自动读取这些文件源码，以额外的 System Prompt 区块或附件形式注入，确保模型能感知这些文件的代码内容。
