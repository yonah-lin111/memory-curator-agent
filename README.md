<p align="center">
  <h1 align="center">Memory Curator Agent</h1>
  <p align="center">本地优先的记忆策展桌面应用 — 记录、回顾、洞察、成长。</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.1-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm&logoColor=white" alt="pnpm" />
</p>

---

## 概述

**Memory Curator Agent** 是一个面向个人的本地桌面应用，聚焦长期记录、记忆管理与深度回顾。

不同于传统笔记工具的"海量堆积"，它强调持续**策展（Curation）**——在日常记录中理清头绪，在周度回顾中发现阶段变化，在长期追踪中洞察行为与情绪模式，最终帮助用户构建**属于自己的人生叙事**。

## 页面概览

应用内页面按侧边栏分组组织：

| 分组 | 页面 | 说明 |
|------|------|------|
| DAILY | Today | 今日概览聚合页 |
| LIBRARY | Notes / Journal / Todo / Snippets / Bills / People | 日常输入与结构化记录 |
| CURATION | Weekly Review / Themes / Memories | 周度回顾、主题追踪、记忆关联 |
| DEVELOPER | Showcase / Style Test | UI 组件展板与样式实验（仅开发环境） |
| SYSTEM | Settings | 应用设置 |

## 核心功能

### 📋 日常记录
- **待办 (Todo)**：P0–P3 优先级排序，拖拽排序，快速标记完成
- **随记 (Snippets)**：灵感碎片、情绪记录、生活琐事，标签归类
- **日记 (Journal)**：每日系统总结与主观感悟，Markdown 书写
- **今日概览**：待办 + 随记 + 日记的聚合视图，一日尽收眼底

### 🎨 提示词设计 (Prompt Design)
- **可视化画布**：基于 `@xyflow/react` 的无限画布，13 种节点类型（system/user/assistant/template/condition/loop 等），拖拽创建与连线编排
- **项目管理**：多项目支持，保存/加载/重命名/删除，Zustand 持久化
- **AI 助手侧边栏**：右侧 AI 面板辅助提示词优化（骨架就绪）
- **增强交互**：dagre 自动布局、撤销/重做历史、画布锁定/解锁、右键上下文菜单、缩放与适配视图
- **组件面板**：可搜索的节点调色板，支持拖拽到画布

### 📝 长期知识管理
- **笔记 (Notes)**：结构化知识、深度思考、读书笔记，不限单日
- **分类体系**：自定义笔记分类，灵活归类

### 👥 人际关系追踪
- 维护人物档案（伴侣/家人/朋友/同事），头像、生日、联系方式、标签
- Markdown 详细档案 + 互动关系追踪

### 🤖 AI 对话 Agent
- ReAct Agent 循环，多轮工具调用，流式输出 + 思考链可视化
- 8 种内置工具：笔记、日记、人物、待办、随记、账单、主题、通用
- Agent Mention 系统：`@people` `@todo` `@snippets` `@journal` `@notes` `@today` `@common` `@bills`
- 支持 OpenAI / Anthropic / Google 多 Provider，可自定义端点
- Ask 交互、工具操作确认、上下文压缩、Doom Loop 检测
- `/context` `/fullscreen` `/session` `/model` 等斜杠命令
- 会话历史管理：数据库搜索、批量删除、行内重命名、生成完成通知

### 📊 周度回顾
- AI 自动提炼：计划完成度、情绪波动、重复主题、关键事件
- 把关机制：预判本周实质内容，避免无效总结
- **人际策展**：基于人物档案的 AI 关系分析

### 🧭 主题追踪
- 提炼长期主题（职业、关系、创作等），跨周追踪叙事变化
- 笔记/日记/随记多源素材关联，时间线可视化

### 🔗 记忆关联 (Memories)
- 跨日/跨周的记忆片段关联与聚合（即将推出）
- 与周度回顾、主题追踪共同构成策展闭环

### 💰 账单追踪
- 15 种分类（餐饮/交通/购物/娱乐/居住/医疗/教育/工资/兼职/理财等）
- 今日账单摘要

### 🧩 UI 组件展板 (Showcase)
- 内置组件 Playground，用于浏览和测试所有基础 UI 组件
- 交互式展示：Toast、Tag、Select、MarkdownEditor、IconButton、Tooltip、PageDateNavigator
- 仅供开发参考（侧边栏 DEVELOPER 分组）

## 技术架构

```
┌──────────────────────────────────────────────────┐
│             React 前端（渲染进程）                  │
│  ┌──────────────────┐  ┌───────────────────────┐ │
│  │  OverlayWorkspace  │  │  主页面区域            │ │
│  │  (AI Chat /       │  │  Today / Notes /      │ │
│  │   Prompt Design)  │  │  Journal / Todo /      │ │
│  └──────────────────┘  │  Snippets / Bills /    │ │
│                         │  People / Themes /      │ │
│  ┌──────────────────┐  │  Memories / Showcase    │ │
│  │  Sidebar (3 模式)  │  │  Weekly Review         │ │
│  │  导航/聊天/提示词   │  └───────────────────────┘ │
│  └──────────────────┘         Zustand + React Query │
├──────────────────────────────────────────────────┤
│                  preload (contextBridge)           │
├──────────────────────────────────────────────────┤
│                  Electron 主进程                    │
│  ┌────────────────┐  ┌─────────────────────────┐ │
│  │  Services (CRUD) │  │  AI Agent (ReAct)       │ │
│  │                   │  │  Tools + Providers     │ │
│  └──────┬─────────┘  └─────────────────────────┘ │
│         └──────────┬─────────────┘               │
│              Drizzle ORM + better-sqlite3          │
├──────────────────────────────────────────────────┤
│                    本地 SQLite                      │
└──────────────────────────────────────────────────┘
```

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) ≥ 22
- [pnpm](https://pnpm.io/) ≥ 9

### 安装与运行

```bash
# 克隆仓库
git clone git@github.com:yonah-lin111/memory-curator-agent.git
cd memory-curator-agent

# 安装依赖（自动重建原生模块）
pnpm install

# 启动开发服务器
pnpm dev
```

### 可用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发模式（热重载） |
| `pnpm build` | 类型检查 + 生产构建 |
| `pnpm preview` | 预览生产构建 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | 运行测试 (Vitest) |

### AI 配置

应用启动后，进入 **设置 (Settings)** 页面配置 AI Provider（OpenAI / Anthropic / Google）。API Key 仅在本地存储。

## 技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | Electron 39 + electron-vite |
| 前端 | React 19 + TypeScript 5.9 |
| 样式 | Tailwind CSS 4.1 |
| 状态管理 | Zustand 5 + TanStack React Query 5 |
| 数据库 | better-sqlite3 + Drizzle ORM |
| AI SDK | Vercel AI SDK (OpenAI / Anthropic / Google) |
| 图表 | ECharts 6.1 |
| 流程图/画布 | @xyflow/react + dagre |
| Markdown | md-editor-rt |
| 图标 | Lucide React |
| 拖拽 | @dnd-kit |
| 日期处理 | date-fns |
| 校验 | Zod 4 |
| 测试 | Vitest + Testing Library + Playwright |
| 打包 | electron-builder (macOS DMG) |
| 包管理 | pnpm |

## 许可证

MIT
