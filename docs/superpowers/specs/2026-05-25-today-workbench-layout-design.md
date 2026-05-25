# Today 工作台页面结构设计

## 背景

本设计基于 `docs/electron-tech-stack.md` 与 `docs/project-development.md`。当前阶段只实现页面结构与布局，不接数据库、不接 LLM、不实现真实业务流程。

项目首屏聚焦 `Today 工作台`，服务“日输入 + 周整理 + 长期追踪”的第一环：让用户每天能快速输入、区分 todo/笔记/日记，并看到 Agent 策展线索的占位结构。

## 设计目标

- 使用桌面端三栏工作台结构。
- 保持黑色主题：主背景 `#000000`，面板背景 `#212121`。
- 保持圆角 `6px`，禁止渐变。
- 只使用静态结构与 mock 数据。
- 让信息类型边界清晰：todo、自由笔记、日记、记忆片段、长期主题不能混成同一个列表。
- 预留隐私边界提示：未来 LLM 请求前需展示发送范围。

## 页面结构

### 左侧导航栏

左侧承担应用级导航与日期定位。

包含：

- 产品标识：`MEMORY CURATOR`。
- 主导航：Today、Notes、Journal、Weekly Review、Themes、Memories、Settings。
- 日期导航：当前周或当前月的轻量日期入口。
- 本地状态：SQLite、本地优先、LLM 请求审查提示。

左侧需要支持后续折叠，但本阶段可先保留静态展开态。

### 中间 Today 主工作区

中间是首屏核心。

包含：

- 顶部标题：当前日期与“今天的计划、素材与主观记录”。
- 快速输入区：静态 textarea 或输入占位，提示可粘贴 todo、随记、日记、聊天片段、截图识别文本。
- 今日概览：展示 todo、notes、journal、memory hints 等静态统计。
- 每日 todo 计划区：展示待办与完成状态的静态列表。
- 自由笔记区：展示当天笔记卡片或列表。
- 日记与主观表达区：保留完整表达入口，不以摘要替代原文。

中间区域优先保证日常记录顺畅，避免过早做复杂富文本或图谱。

### 右侧 Agent 策展栏

右侧承载 Agent 的解释、建议和长期线索，但当前只做静态占位。

包含：

- 输入归类建议：展示 mock 的 todo/note/journal/memory fragment 分类结果。
- 相关记忆：展示与当天输入有关的静态记忆条目。
- 长期主题线索：展示几个主题 chip，例如创作方向、计划延后、关系消耗。
- 风险与隐私提示：说明未来发送给模型前需要用户审查输入范围。

右侧不替用户下结论，不做诊断式表达，只呈现可复核线索。

## 组件边界

建议最小拆分为：

- `App`：维护当前静态页面壳，不承载复杂 UI 细节。
- `Sidebar`：左侧导航与日期状态。
- `TodayWorkspace`：中间 Today 主工作区。
- `AgentPanel`：右侧 Agent 策展栏。

实现落点限定在渲染层 React UI：

- 可修改 `src/renderer/src/App.tsx`。
- 可新增或替换 `src/renderer/src/components` 下的展示组件。
- 可按需修改 `src/renderer/src/styles.css` 中的全局滚动条、body 与基础样式。
- mock 数据只能放在相关展示组件文件内，或放在同目录轻量常量中；不得新增数据访问层。
- 不修改 `src/main`、`src/preload`、数据库、IPC、LLM provider 或构建配置。
- 不引入 Zustand、TanStack Query、路由、表单库或富文本编辑器。

## 视觉规则

- 外层使用 `h-screen w-screen overflow-hidden bg-[#000000] p-3 gap-3`。
- 三栏面板统一 `rounded-[6px] border border-white/5 bg-[#212121]`。
- 中间栏自适应宽度，左侧约 `260px`，右侧约 `360px`。
- 内容区独立滚动，避免 body 滚动。
- 文案层级使用白色透明度区分，不引入彩色渐变。
- 交互状态只做 hover、active、focus 的克制反馈。

## 非目标

- 不实现数据库读写。
- 不实现 LLM 调用。
- 不实现真实输入提交。
- 不实现截图 OCR。
- 不实现路由系统。
- 不实现复杂富文本编辑器。

## 验证标准

- `pnpm typecheck` 通过。
- `pnpm lint` 通过。
- 页面在 Electron/Vite 渲染层可正常编译。
- 首屏能清晰看出左侧导航、中间 Today、右侧 Agent 三栏结构。
- 不新增数据库读写、LLM 调用、OCR、路由、IPC 或真实提交逻辑。
- 不修改主进程、预加载层、数据库 schema 或构建配置。
- 所有新增 UI 数据均为静态 mock 数据。
- 代码遵循项目 TS 规范：函数统一使用箭头函数。
- 注释遵循项目规范：变量、type、interface、enum 使用单行简体中文注释说明；方法和函数使用多行简体中文注释说明；函数内部仅在关键逻辑、边界条件或非直观决策处添加简短注释。
