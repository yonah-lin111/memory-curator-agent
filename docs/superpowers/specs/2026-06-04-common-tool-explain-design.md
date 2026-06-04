# common_tool.explain 设计规格

## 目标

新增 `common_tool.explain`，要求 Agent 在调用添加、修改、删除类写入工具前，先用一个简短 Markdown 说明告诉用户“即将写什么、改什么或删什么”。该说明必须作为工具步骤参与流式顺序展示，并使用 `MdPreview` 渲染。

## 当前上下文

现有 Agent 工具由 `src/main/agent/tools/toolRegistry.ts` 集中注册，`common_tool.ask`、`common_tool.time_now`、`common_tool.date_offset` 已经属于 `common_tool` 命名空间。People 写工具已经是 `people_tool.add`、`people_tool.update`、`people_tool.delete`，并在 `src/main/agent/core/reactAgent.ts` 中通过内部 `toolConfirmationProvider` 做二次确认。

渲染层通过 `tool_started` / `tool_finished` 事件生成 `AiToolStep`，再由 `src/renderer/src/features/ai-chat/components/AiToolCallBlock.tsx` 展示。普通 AI 正文和思考块已经使用 `md-editor-rt` 的 `MdPreview`，其中 `AiChatThinkingBlock.tsx` 的暗色主题、13px 字号、左侧边线和生成中不折叠代码块行为可作为本需求的样式基准。

## 推荐方案

采用一个独立工具 `common_tool.explain`，而不是把说明塞进最终回答，也不把说明参数内嵌到每个写工具。原因很简单：独立工具可以被 Agent 核心按工具调用顺序硬校验，前端也能按现有 `toolSteps` 顺序自然流式展示，改动面最小。

备选方案如下：

- 在 `people_tool.add/update/delete` 内部自动生成说明：实现简单，但模型无法在写入前基于查询结果组织人类可读说明，也不符合“调用 explain 工具”的显式要求。
- 让模型直接输出普通文本说明：UI 流式最自然，但执行层无法证明写入前确实输出过说明，容易被模型跳过。
- 新增 `common_tool.explain`：多一个工具和门禁，但能同时满足顺序约束、审计、流式展示和最小侵入。

选择第三种。

## 工具定义

`common_tool.explain` 参数：

- `targetTool`：字符串枚举，初始只允许 `people_tool.add`、`people_tool.update`、`people_tool.delete`。
- `action`：字符串枚举，允许 `add`、`update`、`delete`。
- `content`：Markdown 文本，长度上限 800 字符。内容必须简洁，不写长篇推理，不输出不确定事实。

返回结构化数据：

```json
{
  "kind": "explain",
  "targetTool": "people_tool.delete",
  "action": "delete",
  "content": "将删除人物资料：阿明（朋友）。"
}
```

`observation` 直接使用清洗后的 `content`，方便前端在工具步骤内渲染。

## 触发时机

`common_tool.explain` 的硬规则：

- 在每次调用 `people_tool.add`、`people_tool.update`、`people_tool.delete` 前必须调用。
- 如果写操作需要先查找目标，例如用户只给姓名或关系，顺序应为 `people_tool.query` -> `common_tool.explain` -> 对应写工具。
- 添加人物时，说明预添加信息，至少包含姓名、关系和已知关键信息；未知字段不编造。
- 修改人物时，说明目标人物、即将修改的字段和新值；如果是完整替换，说明会按当前合并后的完整资料保存。
- 删除人物时，说明要删除的人物基本信息，至少包含 ID 或姓名，以及关系、状态等已知核对信息。
- `common_tool.explain` 不能替代 `common_tool.ask` 的缺失信息澄清，也不能替代系统内部写入确认。
- `common_tool.explain` 不能在查询、读时间、普通回答前强制调用；只约束写入类工具。

## 执行门禁

在 `runReactAgent` 执行工具前新增“写入前解释门禁”。当模型请求 `people_tool.add/update/delete` 时，核心逻辑检查当前消息历史中最近一次同目标工具的 `common_tool.explain` 工具结果：

- 必须存在于同一用户请求之后。
- 必须发生在当前写工具之前。
- `targetTool` 必须等于当前写工具名。
- `action` 必须与当前写工具动作匹配。
- `content` 必须非空。

不满足时，拒绝执行写工具，把错误作为工具失败结果回灌给模型，要求先调用 `common_tool.explain`。该门禁先于内部确认请求执行；只有解释通过后，才进入现有 People 写入确认流程。

为了避免跨任务误放行，每次成功执行 `common_tool.explain` 后只放行后续一次匹配的写工具。写工具完成或取消后，本次解释视为已消费。

## 前端展示

`AiToolCallBlock` 对 `common_tool.explain` 做专门展示：

- 使用 `MdPreview` 渲染 `content` 或 `observation`。
- 容器样式参考 `AiChatThinkingBlock`：`markdown-preview-container`、`select-text`、`max-w-full`、`border-l border-white/10 pl-3 text-white/50`，内联 `fontSize: "13px"`。
- `MdPreview` 使用 `theme="dark"`、`previewTheme="default"`、`codeTheme="atom"`、透明背景、`showCodeRowNumber={false}`。
- 运行中 `autoFoldThreshold={Infinity}`，完成后 `autoFoldThreshold={0}`。
- 标题仍显示工具名 `common_tool.explain`，但观察正文不再被 96 字符摘要截断。

这能满足“工具输出使用流式输出”和“使用 mdpreview 组件”的要求：主进程继续通过现有工具事件实时推送，前端按工具步骤顺序更新，同一个步骤完成后用 Markdown 预览展示完整简短说明。

## 测试范围

- `common_tool.explain` 工具单测：工具名、schema、prompt、内容裁剪、空内容拒绝、返回 `kind: "explain"`。
- 工具注册单测：内置工具顺序包含 `common_tool.explain`，并且 prompt 明确触发时机。
- Agent 核心单测：未 explain 时拒绝 People 写工具；explain 后允许进入内部确认；targetTool/action 不匹配时拒绝；一次 explain 不能放行两个写工具。
- 渲染层单测：`common_tool.explain` 使用 `MdPreview` 展示完整 Markdown，保留 13px 字号，不走普通 observation 截断。
- 现有回归：People 写工具确认、Ask、普通查询、AI 流式文本顺序不变。

## 非目标

- 不新增新的数据库写入能力。
- 不改变 `people_tool.query` 的 SQL 安全策略。
- 不取消现有 People 写入内部确认。
- 不把所有工具都强制 explain，本次只覆盖添加、修改、删除类写入工具，初始目标为 People 写工具。

## 自检

- 无 TBD/TODO。
- 规格没有要求 explain 替代确认，确认仍由现有内部门禁负责。
- `targetTool/action/content` 三个字段能唯一判定 explain 是否能放行后续写工具。
- 前端方案复用现有工具步骤流，不引入新的消息协议。
