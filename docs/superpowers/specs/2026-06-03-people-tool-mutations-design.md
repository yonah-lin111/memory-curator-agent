# People Tool Mutations 规格设计

## 目标

把当前只读 `people_query` 工具升级为命名空间形式的 People 工具组：`people_tool.query`、`people_tool.add`、`people_tool.update`、`people_tool.delete`。新增工具必须允许 Agent 对本地 People 表执行添加、修改、删除；查询能力保持现有行为，不降低 SQL 安全边界和详情返回策略。

## 背景

当前 `src/main/agent/tools/peopleTool.ts` 只导出 `createPeopleQueryTool`，工具名为 `people_query`。工具注册在 `src/main/agent/tools/toolRegistry.ts` 的内置工厂列表中完成，注册上下文只要求 `PeopleService` 的 `list` 与 `querySql`。实际服务层 `src/main/services/peopleService.ts` 已经有 `create`、`update`、`delete`，前端 IPC 也复用同一服务，不需要为 Agent 新造数据库写入路径。

历史设计文档把 People 工具定义为只读工具。本次需求明确要求支持写操作，因此旧的 “Do not use when the user asks to create, update, or delete people profiles.” 约束必须拆除，改成每个工具各自声明能力边界。

## 方案

采用扁平工具注册，工具名使用命名空间字符串：

- `people_tool.query`：替代旧 `people_query`，保留现有查询参数、受控 SQL、防注入校验、limit 约束和 observation 行为。
- `people_tool.add`：调用 `peopleService.create(input)`，创建一条关联人物记录，返回创建后的人物项。
- `people_tool.update`：接收 `id` 和完整人物输入，调用 `peopleService.update(id, input)`，返回更新后的人物项。
- `people_tool.delete`：接收 `id`，调用 `peopleService.delete(id)`，返回被删除 ID。

不引入一个大而全的 `people_tool` 单工具加 `action` 字段。理由：现有 Agent 工具模型是按 `AgentTool.name` 分发；拆成四个小工具能让参数 schema 更严格，避免 `action` 分支造成必填字段和校验逻辑发散。

## 工具契约

### `people_tool.query`

参数沿用旧 `people_query`：

- `query?: string`
- `relationship?: "女朋友" | "家人" | "朋友" | "同事" | "其他"`
- `conditions?: object`
- `sql?: string`
- `limit?: number`

行为沿用旧实现：

- 默认 `limit = 8`，最大 `20`。
- 只允许单条 `SELECT` 查询 `associated_people`。
- 禁止写关键字、注释、多语句、`JOIN`、`UNION`。
- 单条查询或详情命中场景返回 `details`，批量查询默认压缩掉 `details`。
- observation 只返回行数，不把人物详情原样塞回模型上下文。

### `people_tool.add`

参数使用完整 `AssociatedPersonCreateInput` 形状：

- `avatar: string`
- `name: string`
- `gender: string`
- `relationship: "女朋友" | "家人" | "朋友" | "同事" | "其他"`
- `status: string`
- `birthday: string`
- `contact: string`
- `tags: string[]`
- `details: string`

所有字段都设为必填，空值用空字符串或空数组表达。这样与现有 `PeopleService.create` 和渲染层表单保持一致，不制造半结构化写入。

添加人物时，如果用户没有给足创建所需信息，模型可以先调用 `ask_user` 追问缺失事实。真正调用 `people_tool.add` 前仍必须再次通过 `ask_user` 询问用户是否确认创建，并且只有用户给出肯定确认后才能执行。`details` 字段必须使用 Markdown 格式组织内容，允许标题、列表、段落和 Markdown 图片语法。

### `people_tool.update`

参数：

- `id: string`
- `avatar: string`
- `name: string`
- `gender: string`
- `relationship: "女朋友" | "家人" | "朋友" | "同事" | "其他"`
- `status: string`
- `birthday: string`
- `contact: string`
- `tags: string[]`
- `details: string`

更新采用完整替换，不做 partial patch。原因是 `PeopleService.update` 当前就是完整输入，并且完整输入可以避免模型只传一个字段导致其他字段被错误清空。若用户只想改一个字段，Agent 应先调用 `people_tool.query` 取出当前记录，再合并字段后调用 `people_tool.update`。

### `people_tool.delete`

参数：

- `id: string`

删除前不在工具层二次查询。工具只调用服务层删除，并返回 `Deleted people profile: <id>.`。是否先查询确认由 Agent 根据用户意图决定；若用户只给姓名而未给 ID，推荐先调用 `people_tool.query`。

## 安全与约束

写工具只暴露结构化参数，不支持 SQL 写入。`people_tool.query` 继续保持受控 SQL 的只读限制。`people_tool.add/update/delete` 的 prompt 必须明确：仅当用户明确要求创建、更新或删除人物资料时使用；用户表述模糊或可能误删时先调用 `ask_user`。

`people_tool.update` 必须要求 `id`，禁止按姓名直接更新。`people_tool.delete` 必须要求 `id`，禁止按姓名直接删除。这样把歧义压在 Agent 决策层，不让工具层做危险猜测。

`people_tool.add`、`people_tool.update` 与 `people_tool.delete` 执行前必须先调用 `ask_user` 做二次确认，并等待用户回答。该要求不能只写在 prompt 中，Agent 执行层需要硬拦截：如果当前用户请求之后没有 `ask_user` 的肯定确认回答，直接拒绝执行 add/update/delete，并把错误回灌给模型，要求模型先发起确认。取消、否定或无关回答不能视为确认。

更新人物还必须满足用户明确要求更新保存数据。模型不能因为用户只是陈述事实、偏好或纠正聊天内容，就自行调用 `people_tool.update`；这种限制写入工具 prompt，并由二次确认硬门禁兜底。

工具名包含点号，当前 `aiSdkProvider` 会把 `AgentTool.name` 原样作为 AI SDK 工具 key 传入。实现时必须增加 provider 单测，确认带点工具名可以在本地适配层中原样准备、回传和持久化。若真实第三方 provider 后续拒绝点号工具名，应另开兼容层方案；本次按显式需求对外暴露 `people_tool.query` 形式。

## 影响范围

需要更新：

- `src/main/agent/tools/peopleTool.ts`：导出四个 People 工具工厂或一个返回四工具数组的工厂。
- `src/main/agent/core/reactAgent.ts`：拦截未经 `ask_user` 二次确认的 `people_tool.update/delete`。
- `src/main/agent/tools/toolRegistry.ts`：注册上下文改为 `Pick<PeopleService, "list" | "querySql" | "create" | "update" | "delete">`，内置注册四个 People 工具。
- `src/main/agent/types.ts`：如需要新增 People 写工具结果类型，在这里补充类型。
- `test/main/agent/tools/peopleTool.test.ts`：覆盖 query 新名称以及 add/update/delete。
- `test/main/agent/tools/toolRegistry.test.ts`：覆盖注册顺序、意图筛选、结构化 prompt。
- `test/main/agent/providers/aiSdkProvider.test.ts`：覆盖带点工具名。
- 现有涉及 `people_query` 的主进程与渲染层测试：统一替换为 `people_tool.query`，并保留工具结果展示行为。

不需要更新数据库 schema、IPC People handlers、渲染层 People 页面。

## 测试策略

优先写失败测试，再改实现：

- People 工具单测：查询旧行为不变；新增 add/update/delete 调用正确服务方法，返回结构化 data 和简短 observation。
- Agent 核心单测：`people_tool.add/update/delete` 未经 `ask_user` 肯定二次确认时拒绝执行；同一轮先 `ask_user` 后 update/delete 时允许执行；取消回答不能放行写操作。
- 注册表单测：内置工具包含 `people_tool.query/add/update/delete`，普通闲聊不注入 People 工具，人物读取意图注入 query，创建/修改/删除意图注入对应写工具。
- Provider 单测：带点工具名在 AI SDK 工具集合中作为 key 保留，模型回传的 `toolName` 原样进入内部事件。
- Agent/Core/UI 既有测试：所有 `people_query` 期望更新为 `people_tool.query`，新增写工具错误文案至少覆盖一个 case。
- 全量校验：`pnpm test` 与 `pnpm lint`。

## 自检

- 无占位内容。
- 需求 “添加、修改、删除工具” 映射到 `people_tool.add/update/delete`。
- 需求 “people 工具修改为 people_tool.query、people_tool.add 等形式” 映射到四个命名空间工具名。
- 需求 “添加、修改、删除每次都必须调用 ask 工具确认是否操作” 映射到 Agent 执行层硬拦截和工具 prompt 约束。
- 需求 “只有用户明确指定更新才能更新” 映射到 update prompt 和 ask 肯定确认门禁。
- 需求 “添加人物也可以通过 ask 工具询问用户” 映射到 `people_tool.add` prompt。
- 需求 “设置 details 字段时使用 Markdown 格式内容” 映射到 People 写工具 schema 和 prompt。
- 不新增数据库写入路径，避免绕过现有 `PeopleService` 校验。
- 保留查询 SQL 安全边界。
