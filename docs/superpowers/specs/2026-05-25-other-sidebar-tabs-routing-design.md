# Other Sidebar Tabs Routing Design

## 背景

当前应用已经完成 `Today` 三栏工作台和左侧栏节奏分组导航。左侧栏除 `Today` 外还包含 `Notes`、`Journal`、`Weekly Review`、`Themes`、`Memories` 五个主导航入口，但这些入口尚未切换到对应页面。

本次设计目标是补齐这些 tab 的静态页面与页面切换能力，让产品信息架构从单个 Today 工作台扩展为完整的“日输入 + 周整理 + 长期追踪”原型。页面内容参考 `docs/project-development.md`，用于表达功能定位，不接入真实数据、持久化或业务 CRUD。

## 范围

包含以下页面：

- `Notes`：自由笔记列表。
- `Journal`：历史日记条目查看。
- `Weekly Review`：周度策展。
- `Themes`：长期主题追踪。
- `Memories`：重要记忆片段命名与关联。

不包含 `Settings`。`Settings` 继续作为底部辅助入口静态展示，不参与本次页面路由。

## 目标

- 左侧栏五个非 Today 主导航入口可以切换到对应静态页面。
- 每个页面使用独立布局表达不同功能，而不是复用同一种通用占位页。
- 页面内容清晰体现项目文档中的记录归类、周度策展、长期主题、变化追踪、记忆命名与关联能力。
- 保持黑色主题、`#212121` 次级容器、`6px` 圆角、无渐变约束。
- 保留现有三栏壳层、左侧折叠、右侧 Agent 策展栏折叠与待办弹窗行为。

## 非目标

- 不引入数据库、IPC、文件持久化或真实数据模型。
- 不实现新增、编辑、删除、筛选、搜索等真实业务交互。
- 不引入 `react-router` 或其他路由依赖。
- 不实现浏览器地址栏 URL 同步。
- 不改造右侧 `AgentPanel` 为页面级上下文面板。
- 不重构现有 `TodayWorkspace` 的业务结构。

## 方案选择

采用“每页独立静态布局 + App 内部状态路由”的方案。

用户选择了每个 tab 使用差异化布局。该方案比共享页面壳更能展示产品层次，也比只做路由占位更符合 `docs/project-development.md` 的功能表达要求。为避免页面堆砌，差异化仅体现在信息架构和布局节奏，基础视觉仍遵循当前黑色桌面工作台风格。

## 路由设计

不引入真实路由库。当前项目只有 6 个静态页面切换需求，引入完整路由库会增加依赖和抽象成本。

`App.tsx` 维护当前页面状态：

- 默认页面为 `today`。
- `Sidebar` 接收 `activePage` 和 `onPageChange`。
- 点击左侧主导航按钮时调用 `onPageChange(pageId)`。
- `App` 根据 `activePage` 渲染 `TodayWorkspace` 或新增静态页面。

页面标识建议使用联合类型，避免字符串散落：

- `today`
- `notes`
- `journal`
- `weekly`
- `themes`
- `memories`

## 侧栏交互

左侧主导航项从静态 `div` 改为 `button`。

导航按钮要求：

- 当前页使用 `aria-current="page"`。
- 当前页保持白底黑字激活态。
- 非当前页保持低透明度白色文本，并增加克制 hover/focus 状态。
- 折叠态隐藏标题与描述，但保留图标按钮和当前页激活态。
- 移动端继续沿用当前纵向块状导航，不固定为窄侧栏。

## 页面信息架构

### Notes

`Notes` 页面表达自由笔记作为素材池的定位。布局采用不等高素材卡片或多列卡片区，重点展示来源、标签、记录时间、待策展状态与可能进入主题的线索。

核心内容：

- 自由笔记数量与待整理素材数量。
- 多来源素材卡片，例如临时想法、聊天摘录、事实记录、产品思考。
- 标签和来源信息，例如 `聊天粘贴`、`产品思考`、`截图文字`。
- 可进入周度回顾或长期主题的提示。

### Journal

`Journal` 页面表达历史日记条目查看。布局采用左侧日期索引、右侧完整日记阅读区，避免用摘要替代原始主观表达。

核心内容：

- 历史日期列表和轻量心境标识。
- 当前选中日记的完整正文。
- 日记关联的感受、人物、主题线索。
- 与过去记录的轻量连接提示。

### Weekly Review

`Weekly Review` 页面表达周度策展。布局采用复盘仪表板，突出计划执行、延后事项、感受变化、重复主题和关键记忆。

核心内容：

- 本周完成、延后、记录、主题浮现等指标。
- 一周关键事件时间线。
- 感受变化与重复主题观察。
- 值得保留的关键记忆片段。

### Themes

`Themes` 页面表达长期主题追踪。布局采用主题列表加主题详情/轨迹区，让用户看到主题如何跨日期形成和变化。

核心内容：

- 长期主题列表，例如本地优先架构、数字海马体、计划延后模式。
- 主题状态，例如活跃中、有积累、待检视。
- 主题出现日期、相关记录数量、变化节点。
- 主题与行为、感受或记忆片段之间的关系。

### Memories

`Memories` 页面表达重要记忆片段命名与关联。布局采用记忆节点墙或关联卡片区，强调“这些内容为什么有关”，避免关键词标签堆积。

核心内容：

- 被命名的记忆片段。
- 每个片段的日期、来源和命名理由。
- 片段之间的关联说明，例如共同主题、相似感受、同一决策问题。
- 冲突、断裂或未完成议题的克制提示。

## 组件边界

推荐新增页面目录：

- `src/renderer/src/components/pages/NotesPage.tsx`
- `src/renderer/src/components/pages/JournalPage.tsx`
- `src/renderer/src/components/pages/WeeklyReviewPage.tsx`
- `src/renderer/src/components/pages/ThemesPage.tsx`
- `src/renderer/src/components/pages/MemoriesPage.tsx`

`App.tsx` 继续负责应用壳层组合、左右栏折叠状态和当前页面状态。

`Sidebar.tsx` 负责导航项渲染、折叠态布局、当前页激活态和导航点击回调。

页面组件只负责静态展示，不持有业务状态。若某个页面需要局部选中态，首版先用静态高亮表达，不实现真实切换。

## 样式约束

- 主背景为 `#000000`。
- 卡片容器使用 `#212121` 或 `bg-white/[0.02]` 的黑色系层级。
- 圆角统一为 `rounded-[6px]`。
- 禁止渐变色。
- 动效只使用颜色、透明度、位移和宽度的克制过渡。
- 页面在桌面端占据中间主内容区域，保持独立滚动。
- 移动端沿用纵向流式布局，页面卡片改为单列或两列自适应。

## 无障碍

- 左侧导航按钮必须有明确文本或 `aria-label`。
- 当前页使用 `aria-current="page"`。
- 页面主区域使用清晰的标题层级。
- 可点击导航项必须是 `button`，不使用无交互语义的 `div` 伪装。
- 静态卡片不制造假按钮，除非确实有点击行为。

## 测试计划

更新 `App.test.tsx`，覆盖以下行为：

- 默认渲染 `Today` 页面，且 `Today` 导航项有 `aria-current="page"`。
- 点击 `Notes` 后显示自由笔记页面核心文案，`Notes` 导航项有当前页语义。
- 点击 `Journal` 后显示日记条目页面核心文案。
- 点击 `Weekly Review` 后显示周度策展页面核心文案。
- 点击 `Themes` 后显示长期主题追踪页面核心文案。
- 点击 `Memories` 后显示记忆片段关联页面核心文案。
- 左侧栏折叠后仍能保留折叠按钮与当前页激活语义。
- 现有右侧策展栏折叠、待办弹窗、自由随记弹窗测试继续通过。

验证命令：

- `pnpm test`
- `pnpm typecheck`

## 风险与处理

主要风险是五个独立页面导致重复 JSX 增多。处理方式是只抽取真正能降低噪声的小型展示结构；如果抽象反而增加命名和跳转成本，则保持页面内局部 JSX。

第二个风险是侧栏从静态元素改成按钮后影响折叠测试和无障碍查询。处理方式是明确使用 `aria-current` 和按钮名称作为稳定测试入口，不依赖具体 DOM 结构。

第三个风险是页面内容过于像占位页。处理方式是每个页面都放入能映射项目文档能力的静态 mock 数据，包括来源、时间、主题、感受、关联理由和未完成议题提示。

## 交付范围

预计修改：

- `src/renderer/src/App.tsx`
- `src/renderer/src/components/Sidebar.tsx`
- `src/renderer/src/App.test.tsx`

预计新增：

- `src/renderer/src/components/pages/NotesPage.tsx`
- `src/renderer/src/components/pages/JournalPage.tsx`
- `src/renderer/src/components/pages/WeeklyReviewPage.tsx`
- `src/renderer/src/components/pages/ThemesPage.tsx`
- `src/renderer/src/components/pages/MemoriesPage.tsx`

默认不修改：

- `src/renderer/src/components/TodayWorkspace.tsx`
- `src/renderer/src/components/AgentPanel.tsx`
- `src/renderer/src/styles.css`

## Git 处理

本 spec 按 superpower 流程写入，但项目级规则禁止在未明确要求时执行 `git commit`。因此本次不提交 commit。
