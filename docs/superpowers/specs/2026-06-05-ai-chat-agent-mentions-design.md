# AI Chat Agent Mention 设计

## 目标

在 `src/renderer/src/features/ai-chat/components/AiChatInput.tsx` 中加入 `@` agent mention 交互。用户输入 `@` 后唤醒 agent 面板，可选择 `people`、`todo`、`snippets`、`journal`、`notes`、`today`。选择后输入框内插入对应 token，例如 `@people_agent`，并以不同颜色展示。发送时 token 不进入用户消息正文，而是转成独立 agent hint，用来告诉主进程和模型优先使用对应领域能力；若所选 agent 没有相关能力或数据，则允许使用其他工具和上下文。

## 已确认决策

- 使用现有 `textarea` 作为真实输入层，新增只读高亮镜像层渲染彩色 token。
- 发送时剥离 `@people_agent` 等 token，用户消息、标题和 prompt history 只保留干净文本。
- 允许选择多个 agent，按 token 出现顺序决定优先级。
- 发送后清空输入文本和 agent 选择状态。
- 不引入 `contenteditable`，避免重写 IME、光标、复制粘贴、历史和可访问性逻辑。

## Agent 列表

首期内置 6 个 agent：

| Agent ID | Token | 显示名 | 首期能力 |
| --- | --- | --- | --- |
| `people` | `@people_agent` | `people` | 优先提示模型使用已有 `people_tool.*` |
| `todo` | `@todo_agent` | `todo` | 注入任务领域优先 hint，等待后续 todo tool 接入 |
| `snippets` | `@snippets_agent` | `snippets` | 注入片段领域优先 hint，等待后续 snippets tool 接入 |
| `journal` | `@journal_agent` | `journal` | 注入日记领域优先 hint，等待后续 journal tool 接入 |
| `notes` | `@notes_agent` | `notes` | 注入笔记领域优先 hint，等待后续 notes tool 接入 |
| `today` | `@today_agent` | `today` | 注入今日上下文优先 hint，等待后续 today tool 接入 |

每个 token 使用不同颜色，但必须遵守项目黑色主题、6px 圆角和无渐变约束。颜色只用于 token 文本，不改变整体输入框视觉语言。

## 输入框交互

`AiChatInput` 保留现有 `/clear`、`/undo` 命令、prompt history、Enter 发送和 textarea 自适应高度逻辑。新增 agent 面板与当前斜杠命令面板互斥。

触发规则：

1. 光标前刚输入 `@` 时打开 agent 面板。
2. 在 `@` 后继续输入非空白查询文本时过滤 agent，例如 `@pe` 命中 `people`。
3. 查询串包含空格或换行时关闭面板。
4. 光标移动到触发 `@` 前时关闭面板。
5. 输入以 `/` 开头时优先走现有斜杠命令面板，不同时打开 agent 面板。

选择规则：

1. 面板支持方向键上下切换。
2. `Enter` 或点击选项后，将触发区间从 `@` 到当前光标替换为完整 token 加一个空格。
3. 选择后关闭面板，焦点回到 textarea，光标移动到 token 后。
4. 重复选择同一个 agent 允许出现在文本中，但发送时按首次出现去重。

删除规则：

1. `Backspace` 在无选区且光标紧贴完整合法 token 末尾时，一次删除整个 token。
2. 有选区时使用浏览器默认删除行为。
3. 光标在 token 中间或 token 不完整时使用普通文本删除行为。

粘贴和手动输入：

1. 用户手动输入完整合法 token 时，镜像层应着色。
2. 粘贴包含多个合法 token 的文本时，镜像层应着色，发送时应提取并剥离。
3. `@people` 不是完整 token，只作为过滤态或普通文本，不作为 agent hint。

## 高亮镜像层

由于 textarea 不支持局部文本着色，采用透明 textarea 加镜像层：

1. textarea 继续作为真实输入源，保留 `value`、光标、IME、复制粘贴、键盘事件和可访问性。
2. textarea 文本颜色设置为透明，`caret-color` 保持白色。
3. 镜像层绝对定位在 textarea 下方，使用相同字体、字号、行高、padding、换行和滚动行为。
4. 镜像层按 token 扫描结果分片渲染普通文本与 agent token。
5. agent token 使用配置表中的颜色 class。
6. 镜像层 `pointer-events: none`，避免抢占输入交互。
7. textarea 滚动时同步镜像层滚动位置，避免多行内容错位。

这套方案最小化改动现有输入系统，同时满足输入框内彩色 token 的视觉要求。

## 数据结构

渲染层新增 agent mention 类型：

```ts
export type AiChatAgentId = "people" | "todo" | "snippets" | "journal" | "notes" | "today";

export type AiChatInputAgentMention = {
  id: AiChatAgentId;
  token: string;
  label: string;
  priority: number;
};

export type AiChatSendPayload = {
  text: string;
  agents: AiChatInputAgentMention[];
};

export type AiChatAgentHint = {
  id: AiChatAgentId;
  priority: number;
};
```

`AiChatInputProps.onSendMessage` 从 `(text: string) => void` 调整为 `(payload: AiChatSendPayload) => void`。`AiChatWorkspace` 和 `useAiChatController` 继续向下传递 payload。重新发送历史消息时没有 agent 选择，使用空数组。

发送前处理：

1. 扫描 `inputText` 中所有完整合法 token。
2. 按出现顺序去重生成 `agents`，`priority` 从 1 开始。
3. 从文本中剥离所有完整合法 token。
4. 归一化多余空白，得到干净 `text`。
5. 若干净 `text` 为空，则不发送。
6. `onSendMessage({ text, agents })`。
7. prompt history 只保存干净 `text`。

## 发送链路

渲染层：

1. `AiChatInput` 生成 `{ text, agents }`。
2. `AiChatWorkspace` 将 payload 转交 `useAiChatController.handleSendMessage`。
3. `startAiChatMessage` 使用干净 `text` 创建乐观用户消息。
4. `window.api.ai.startChat` payload 增加 `agents` 字段。
5. `buildStartContextItems` 仍只构造历史上下文，不承载 agent hints。

主进程：

1. `AiChatStartPayload` 增加 `agents?: AiChatAgentHint[]`。
2. `aiHandlers` 校验 agent id 白名单和 priority。
3. 在 `buildContextAgentMessages` 之前把 agents 渲染成可信 agent directive，并追加到 `createSystemPrompt()` 返回的 system message 内容中。
4. agent directive 只参与本轮模型输入，不作为用户消息持久化。
5. 首期不改数据库结构；如后续需要审计或恢复 agent 选择，再扩展 run 持久化字段。

不能把 agent hints 作为普通 `kind: "agent"` context item 传入现有 `buildContextAgentMessages`。当前非消息、非工具上下文会被包进 `UNTRUSTED_CONTEXT_START`，并明确要求模型不要执行其中指令；agent 选择是可信 UI 元数据，应进入 system directive，而不是不可信参考数据。

## Agent Hint 内容

agent hint 不是强制工具白名单，而是优先级提示。模型应优先尝试所选 agent 相关工具、页面数据或记忆；如果没有相关能力、数据或用户问题不匹配，则正常使用其他可用工具和上下文。

示例内容：

```text
Selected agent priority:
1. people_agent: Prefer People-related tools and memory first. Current available People tools include people_tool.query, people_tool.add, people_tool.update, and people_tool.delete.
2. todo_agent: Prefer Todo-related task and daily planning context second.

Rule:
Use selected agents first when relevant. If a selected agent has no relevant capability or data, use other available tools/context. Do not force unrelated tools.
```

边界：

1. 首期不限制 `prepareToolsForModel` 返回的工具集合，避免误伤 `common_tool.ask`、时间工具和跨领域查询。
2. `people_agent` 目前有真实工具映射，因此提示应更具体。
3. 其他 agent 暂时只做领域路由 hint，等对应工具注册后在同一 agent 配置表补充工具列表。

## 错误处理

1. 渲染层只生成白名单 agent，不接受未知 token 作为 agent hint。
2. 主进程再次校验 `agents`，未知 id 直接丢弃，避免因旧 UI 或粘贴内容中断聊天。
3. 如果 agent hint 构造失败，降级为无 agent hint 的普通聊天，不影响发送。
4. 如果 token 剥离后文本为空，前端不发送，并保持现有禁用发送按钮逻辑。
5. 如果 slash 命令与 agent 面板状态冲突，以 slash 命令优先。

## 测试计划

渲染层测试：

1. 输入 `@` 打开 agent 面板并显示 6 个选项。
2. 输入 `@pe` 只匹配 `people`。
3. 选择 `people` 后插入 `@people_agent `，光标位于 token 后。
4. 多选 `@people_agent @todo_agent` 后，发送 payload 中 agents 顺序为 `people`、`todo`。
5. 发送 payload 的 `text` 不包含 agent token。
6. 用户消息气泡和 prompt history 不包含 agent token。
7. `Backspace` 在 token 后一次删除完整 token。
8. 手动输入或粘贴 token 能高亮并被剥离。
9. `/clear`、`/undo` 仍按现有逻辑执行。
10. textarea 自适应高度和滚动时镜像层不明显错位。

主进程测试：

1. `AiChatStartPayload.agents` 只接受白名单 agent。
2. `people_agent` 生成包含 People 工具优先说明的 system directive。
3. 多 agent hint 保持 priority 顺序。
4. 无 agent 时现有聊天启动行为不变。

验证命令：

1. `npm run lint`
2. `npm run typecheck`
3. 若项目已有相关单测命令，再运行对应测试。

## 非目标

1. 不实现 `todo`、`snippets`、`journal`、`notes`、`today` 的新主进程工具。
2. 不做 contenteditable 富文本输入框替换。
3. 不把 agent token 写入用户消息正文、标题或 prompt history。
4. 不做跨会话持久化 agent 选择。
5. 不引入工具白名单或硬限制模型只能使用所选 agent。

## 后续演进

后续对应业务工具接入后，只需要扩展 agent 配置表：为每个 agent 增加工具名列表、能力说明和可用数据源。主进程 hint 构造逻辑可复用当前 `agents` payload，无需改动输入框交互。
