# Electron PC 端技术栈推荐

## 1. 项目开发目标

记忆策展 Agent 适合开发为本地优先的 PC 端应用。项目核心不是单次记录或单次摘要，而是围绕个人长期输入形成日视图、周度回顾、长期主题追踪、记忆片段命名与关联。

Electron 方案需要重点支持以下目标：

- 提供稳定的桌面端工作台体验。
- 支持本地保存个人长期记录。
- 支持 LLM 对输入内容进行识别、归类、整理和策展。
- 支持截图文本提取与外部素材整理。
- 保持个人敏感数据的隐私边界清晰。

## 2. 推荐总体技术栈

推荐使用以下技术组合：

```txt
Electron + electron-vite
React + TypeScript
Tailwind CSS + shadcn/ui + lucide-react
SQLite + Drizzle ORM + better-sqlite3
Zustand + TanStack Query
Zod
OpenAI-compatible LLM provider abstraction
electron-builder
Vitest + Testing Library + Playwright
```

这套组合适合构建以信息组织、长期记录和 Agent 辅助整理为核心的桌面应用。它兼顾开发效率、类型安全、本地数据能力、后续可维护性和跨平台打包能力。

## 3. 桌面端工程方案

### 3.1 Electron

Electron 负责提供桌面端运行环境，并承载本地文件、数据库、系统截图、窗口管理和系统 API 等能力。

推荐按照 Electron 的进程模型划分职责：

- 主进程：负责数据库、文件系统、系统 API、截图、LLM 请求代理和应用生命周期。
- 预加载层：通过安全 IPC 暴露有限能力给渲染层。
- 渲染层：负责 React 用户界面和交互状态。

### 3.2 electron-vite

推荐使用 `electron-vite` 作为工程脚手架和构建工具。

它可以降低 Electron 与 Vite 集成成本，清晰组织主进程、预加载层和渲染层代码，也方便后续进行开发热更新和生产构建。

### 3.3 electron-builder

推荐使用 `electron-builder` 进行应用打包。

它适合后续支持 macOS、Windows 和 Linux 桌面端分发。MVP 阶段可以先以 macOS 为主要目标，待核心功能稳定后再补充 Windows 打包配置。

## 4. 前端技术栈

### 4.1 React

推荐使用 React 构建渲染层。

项目会包含日视图、笔记列表、日记时间线、周度回顾、长期主题、记忆片段关联等多个高交互界面。React 生态成熟，适合承载复杂工作台型界面。

### 4.2 TypeScript

推荐全项目使用 TypeScript。

本项目存在较多结构化数据，包括 todo、note、journal、memory fragment、theme、weekly review 和 LLM 输出结果。TypeScript 可以减少跨模块数据结构漂移，提升长期维护稳定性。

### 4.3 Tailwind CSS

推荐使用 Tailwind CSS 作为样式方案。

项目级视觉规范要求黑色主题、固定圆角和禁止渐变色。Tailwind 适合建立受控的设计 token，并能快速实现高密度、层级清晰的桌面端工作台界面。

### 4.4 shadcn/ui

推荐使用 `shadcn/ui` 或基于 Radix UI 的自建轻量组件层。

它适合快速搭建按钮、对话框、菜单、Tabs、输入框、表单、Toast、Popover 等基础交互组件，同时保留样式控制权。

### 4.5 lucide-react

推荐使用 `lucide-react` 作为图标库。

桌面工作台会大量使用工具按钮、状态操作、筛选入口和导航图标。lucide 图标风格克制，适合本项目的工具型界面。

## 5. 本地数据层

### 5.1 SQLite

推荐使用 SQLite 作为本地数据库。

项目以个人长期记录为核心，数据主要保存在本机。SQLite 不需要独立数据库服务，适合桌面端应用，并且能够支持时间线、主题关联、周度回顾和变化对比等查询场景。

### 5.2 Drizzle ORM

推荐使用 Drizzle ORM 管理数据库 schema、查询和迁移。

Drizzle 与 TypeScript 结合较好，适合维护长期演进的数据模型。相比直接写零散 SQL，Drizzle 更利于保持类型一致和迁移可控。

### 5.3 better-sqlite3

推荐使用 `better-sqlite3` 作为 SQLite Node 端驱动。

它在 Electron 主进程中使用直接，性能稳定，适合本地桌面应用的数据读写场景。

## 6. 状态管理与数据请求

### 6.1 Zustand

推荐使用 Zustand 管理轻量 UI 状态。

适合存放当前选中日期、当前视图、侧栏展开状态、选中的主题、编辑器临时状态等客户端状态。

### 6.2 TanStack Query

推荐使用 TanStack Query 管理异步数据状态。

它适合处理本地数据库查询、IPC 调用、LLM 生成任务、周度回顾刷新、主题重新分析等异步流程，并能统一管理缓存、加载态、错误态和重新请求。

## 7. LLM 与 Agent 层

### 7.1 Provider 抽象

推荐把 LLM 调用封装成独立 provider，而不是直接写在 UI 组件中。

建议支持 OpenAI-compatible API，后续可以切换 OpenAI、其他云端模型或本地模型服务。

推荐抽象方向：

- `classifyInput`：识别输入类型。
- `curateDailyRecord`：整理当天记录。
- `generateWeeklyReview`：生成周度策展。
- `extractLongTermThemes`：提炼长期主题。
- `comparePeriodChanges`：对比不同时期变化。
- `nameMemoryFragment`：为重要记忆片段命名。
- `linkMemoryFragments`：建立记忆关联。

### 7.2 结构化输出

LLM 输出必须经过结构化校验。

推荐使用 Zod 定义输出 schema，并在写入数据库前进行校验。这样可以避免模型输出格式不稳定导致数据库污染或 UI 崩溃。

### 7.3 隐私边界

项目处理的是个人长期记录，隐私边界需要在架构早期明确。

建议在 MVP 阶段就支持以下能力：

- 用户可配置 LLM provider 和 API key。
- 明确提示哪些内容会被发送给模型。
- LLM 请求前保留可审查的输入范围。
- 本地数据库默认不上传。
- 后续预留本地模型接入能力。

## 8. 截图与文本提取

MVP 阶段可以先支持图片导入或截图后交给视觉模型识别。

推荐分两阶段实现：

### 8.1 第一阶段

- 支持粘贴图片或导入截图。
- 调用视觉模型识别截图中的文字和语义。
- 将识别结果转为普通文本输入，并进入输入分类流程。

### 8.2 第二阶段

- 接入本地 OCR，例如系统 OCR 能力或 `tesseract.js`。
- 保存图片素材与识别文本之间的关联。
- 支持从截图中提取 todo、事件、主观表达和长期主题线索。

## 9. 编辑器方案

MVP 不建议一开始引入复杂富文本编辑器。

推荐先使用：

- 普通文本输入框。
- Markdown 文本编辑。
- 简单预览能力。

等日输入、周度策展和长期主题追踪流程稳定后，再评估是否引入 `Tiptap`。

这个项目早期重点是记录、归类、回顾和关联，不是复杂排版。

## 10. 推荐界面结构

PC 端推荐采用三栏工作台结构：

- 左侧：日期导航、周视图、长期主题、记忆片段入口。
- 中间：当日计划视图，集中展示 todo、笔记和日记。
- 右侧：Agent 建议、输入归类、相关记忆、主题线索和风险提示。

推荐主要页面：

- Today：当天输入、todo、笔记、日记和 Agent 归类。
- Notes：自由笔记列表和筛选。
- Journal：日记时间线。
- Weekly Review：周度策展结果。
- Themes：长期主题追踪。
- Memories：命名记忆片段和关联关系。
- Settings：模型配置、隐私设置、数据路径和导出能力。

## 11. MVP 开发顺序

推荐按以下顺序开发：

1. 搭建 Electron + React + TypeScript 工程。
2. 建立 SQLite + Drizzle 数据模型。
3. 实现 todo、note、journal 的本地增删改查。
4. 实现 Today 当日视图。
5. 实现 LLM 输入分类。
6. 实现笔记列表和日记查看。
7. 实现周度策展。
8. 实现长期主题追踪。
9. 实现记忆片段命名与关联。
10. 实现截图文本提取。

这个顺序可以先保证本地记录闭环，再逐步增强 Agent 策展能力。

## 12. 不建议优先采用的方案

### 12.1 不建议只用 JSON 文件存储

JSON 文件适合极小型原型，但本项目后续会有多类型记录、长期主题、记忆片段和关联关系。纯 JSON 文件会让查询、迁移和数据一致性变复杂。

### 12.2 不建议一开始做复杂富文本

复杂富文本会提前消耗大量开发成本，但对 MVP 的核心价值帮助有限。应优先验证日输入、周整理和长期追踪。

### 12.3 不建议把 LLM 逻辑写进 UI 组件

LLM 调用涉及 provider 配置、隐私边界、结构化校验、错误处理和重试策略。直接写进 UI 组件会导致后续难以维护。

### 12.4 不建议一开始做云同步

项目处理个人敏感记录，云同步会显著增加账户、加密、冲突合并和隐私合规复杂度。MVP 阶段推荐本地优先。

## 13. 主要风险点

- 个人数据敏感，必须明确 LLM 调用范围和用户可控性。
- 长期主题追踪不能只靠关键词匹配，需要保存主题与记录之间的明确证据链。
- 周度策展不能只是摘要，需要体现计划执行、感受变化、重复主题和关键记忆。
- Electron 需要保持主进程、预加载层和渲染层的安全边界。
- 数据模型需要为后续迁移预留空间，避免早期 schema 过度随意。

## 14. 结论

该项目推荐使用 Electron 构建本地优先的 PC 端应用，以 React 和 TypeScript 承载桌面工作台界面，以 SQLite 和 Drizzle 管理长期个人数据，以结构化 LLM provider 支撑输入识别、周度策展、长期主题追踪和记忆关联。

MVP 应优先完成本地记录闭环和 Today 视图，再逐步增加 Agent 能力。这样可以避免在基础数据流尚未稳定前过早投入复杂富文本、图谱、云同步或自动化集成。
