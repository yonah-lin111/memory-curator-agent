# Agent 编写工作台页面设计

## 背景

当前应用使用左侧导航、中间页面、右侧 `AgentPanel` 的三栏结构。新的方向是移除右侧 `AgentPanel`，将 Agent 作为左侧栏中的一级页面入口，并提供一个静态的 Agent 编写工作台。

页面内容参考 `docs/project-development.md`，重点体现记忆策展 Agent 的能力边界、能力模块、输出结构与验收关注点。

## 范围

- 删除 `src/renderer/src/components/AgentPanel.tsx`。
- 从 `App.tsx` 移除右侧 Agent 折叠栏状态、渲染和相关 import。
- 在 `Sidebar` 增加 `agent` 页面入口。
- 新增 `src/renderer/src/components/pages/AgentPage.tsx`。
- 页面仅做静态结构和布局，不接入 LLM、表单保存、运行逻辑或持久化。

## 推荐方案

采用桌面三栏工作台布局：

- `Blueprint`：展示 Agent 目标、非目标、核心使用节奏和能力模块。
- `Authoring`：展示系统指令、输入来源、输出结构、安全边界。
- `Preview`：展示静态试运行样例、能力覆盖、验收关注点。

移动端改为单栏堆叠，保留所有内容层级。

## 导航与路由

- `SidebarPageId` 增加 `agent`。
- 路由白名单增加 `/agent`。
- `renderActivePage` 增加 `agent` 分支。
- Agent tab 建议放在独立 `INTELLIGENCE` 分组，避免和记录页、策展页混在一起。

## 视觉约束

- 保持黑色主题：主背景 `#000000`，卡片背景 `#212121`。
- 圆角统一 `6px`。
- 不使用渐变。
- 用卡片、边框、留白、弱对比标签建立层级。
- 桌面端主内容控制为三列，移动端单列。

## 测试关注

- 默认路由仍落到 `/today`。
- 点击左侧 `Agent` tab 后显示 Agent 编写工作台标题。
- `Agent` tab 可获得 `aria-current="page"`。
- 旧右侧 Agent 面板相关测试需要删除或改写。
- 类型检查和测试必须通过。

## 非目标

- 不做真实 Agent 编辑器。
- 不做 prompt 保存。
- 不做外部分析调用。
- 不迁移旧右侧栏内容为原样页面。
