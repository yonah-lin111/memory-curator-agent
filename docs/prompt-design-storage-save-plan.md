# Prompt Design Storage & Hotkey Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现提示词无限画布大 JSON 持久化，配合专属提取表 `prompt_active_nodes` 提供秒级业务节点提取编译服务，并支持前端按 `Ctrl + S` (macOS: `Cmd + S`) 触发画布和节点的高效增量保存。

**Architecture:** 采用 CQRS 混合存储架构。ReactFlow 所有复杂的坐标、把手、连线及视觉状态整包以 `design_data` JSON 格式持久化在 `prompt_design_items` 表。后端在保存时自动触发事务：清洗当前画布的历史业务节点，提取 `nodes` 数组中高价值的业务内容并独立扁平化同步保存至 `prompt_active_nodes` 表。前端注册全局键盘守卫捕获 `Ctrl+S` 事件，避免任何定时保存对大文档造成的写入性能抖动，提升交互掌控感。

**Tech Stack:** Electron, SQLite (better-sqlite3), ReactFlow, TypeScript, TailwindCSS

---

## 涉及文件与结构图

```
设计画布文件流：
PromptCanvas (Ctrl + S) → usePromptDesignStore (activeDesignId)
  └─→ IPC Channel: "prompt-design:designs:update"
        └─→ promptDesignHandlers.ts
              └─→ promptDesignService.ts
                    ├─→ 更新 prompt_design_items (存储整包大 JSON)
                    └─→ 开启数据库事务同步 prompt_active_nodes (存储提纯的业务提示词节点)
```

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/main/db/schema.ts` | 修改 | 新增 `PromptActiveNodeRow` 数据库实体类型和相关映射定义 |
| `src/main/db/index.ts` | 修改 | 新增 `prompt_active_nodes` 建表 SQL 与数据库版本重构逻辑 |
| `src/main/services/promptDesignService.ts` | 修改 | 重构 `updateDesign`，加入事务机制，自动清洗并同步写入 `prompt_active_nodes` 表 |
| `src/renderer/src/features/prompt-design/components/PromptCanvas.tsx` | 修改 | 注册 `Ctrl + S` / `Cmd + S` 键盘守卫，并封装防抖、无锁的 `handleSave` 瞬时保存机制 |

---

## 任务拆解与实施步骤

### Task 1: 数据库 schema 拓展与建表逻辑

**Files:**
- Modify: `src/main/db/schema.ts`（增加 `PromptActiveNodeRow` 类型声明）
- Modify: `src/main/db/index.ts`（增加 `prompt_active_nodes` 表定义与 `rebuildLegacyTables`、`createPromptActiveNodesTable` 逻辑）

- [ ] **Step 1: 拓展 `src/main/db/schema.ts` 类型声明**

在 `src/main/db/schema.ts` 中找到合适位置（比如 `PromptDesignRow` 的下方）插入 `PromptActiveNodeRow` 及实体描述：

```typescript
/** 提示词业务节点提纯数据库行（方案二 CQRS 核心表） */
export type PromptActiveNodeRow = {
  id: number;
  external_id: string;      // 对应前端 ReactFlow 节点的唯一 id
  design_item_id: string;   // 关联 prompt_design_items 的 external_id (UUID)
  parent_node_id: string | null; // 嵌套父容器的 external_id (用于 Task Field 物理定位)
  node_type: string;        // 节点业务类型 (system_role, task, output_format, 等)
  title: string;            // 节点标题
  content: string | null;   // 精华提示词正文
  sort_order: number;       // 用于后端按顺序流式编译的序号
  updated_at: string;
};
```

- [ ] **Step 2: 在 `src/main/db/index.ts` 中注册 `prompt_active_nodes` 重建方法**

在 `src/main/db/index.ts` 中的 `rebuildLegacyTables` 函数末尾（例如 `ai_agent_tool_calls` 表的下方），加入该表的自动迁移和重构注册：

```typescript
  rebuildTable(database, {
    tableName: 'prompt_active_nodes',
    columnsSql: `
      external_id TEXT NOT NULL UNIQUE,
      design_item_id TEXT NOT NULL,
      parent_node_id TEXT,
      node_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL,
      FOREIGN KEY (design_item_id) REFERENCES prompt_design_items(external_id) ON DELETE CASCADE
    `.trim(),
    insertColumns: ['external_id', 'design_item_id', 'parent_node_id', 'node_type', 'title', 'content', 'sort_order', 'updated_at'],
    selectColumns: ['external_id', 'design_item_id', 'parent_node_id', 'node_type', 'title', 'content', 'sort_order', 'updated_at'],
    orderByClause: 'sort_order ASC, id ASC',
    timestampColumns: ['updated_at'],
    requiredColumns: ['external_id']
  })
```

- [ ] **Step 3: 在 `src/main/db/index.ts` 中添加物理建表方法**

在 `src/main/db/index.ts` 中找到并添加：

```typescript
/**
 * 创建 prompt_active_nodes 业务节点表。
 */
export const createPromptActiveNodesTable = (database: Database.Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS prompt_active_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL UNIQUE,
      design_item_id TEXT NOT NULL,
      parent_node_id TEXT,
      node_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL,
      FOREIGN KEY (design_item_id) REFERENCES prompt_design_items(external_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_active_nodes_design_item ON prompt_active_nodes(design_item_id);
    CREATE INDEX IF NOT EXISTS idx_prompt_active_nodes_parent ON prompt_active_nodes(parent_node_id);
  `)
}
```

并在 `src/main/db/index.ts` 执行全部建表的入口处加入：
`createPromptActiveNodesTable(db);`

---

### Task 2: 后端服务层同步机制重构

**Files:**
- Modify: `src/main/services/promptDesignService.ts`（重构 `updateDesign` 函数，加入大 JSON 保存时的节点提取及底层 SQLite 事务写入逻辑）

- [ ] **Step 1: 在 `promptDesignService.ts` 中重构 `updateDesign` 方法**

修改 `src/main/services/promptDesignService.ts` 的 `updateDesign`，提取传入 `designData` 中的 `nodes`，在同一数据库事务中将其清洗和增量覆盖：

```typescript
  updateDesign: (id: string, input: PromptDesignUpdateInput): void => {
    const db = getDatabase()
    const now = new Date().toISOString()
    
    // 采用 sqlite 事务，保证画布 JSON 状态和扁平化业务节点的强一致性
    const transaction = db.transaction(() => {
      // 1. 更新主设计项大 JSON
      if (input.name !== undefined && input.designData !== undefined) {
        db.prepare("UPDATE prompt_design_items SET name = ?, design_data = ?, updated_at = ? WHERE external_id = ?").run(
          input.name,
          JSON.stringify(input.designData),
          now,
          id
        )
      } else if (input.name !== undefined) {
        db.prepare("UPDATE prompt_design_items SET name = ?, updated_at = ? WHERE external_id = ?").run(
          input.name,
          now,
          id
        )
      } else if (input.designData !== undefined) {
        db.prepare("UPDATE prompt_design_items SET design_data = ?, updated_at = ? WHERE external_id = ?").run(
          JSON.stringify(input.designData),
          now,
          id
        )
      }

      // 2. 方案二 CQRS：仅在 designData 实际发生更新时，才触发节点同步解析与落库
      if (input.designData !== undefined && Array.isArray(input.designData.nodes)) {
        // 先清理本设计项下的历史同步业务节点
        db.prepare("DELETE FROM prompt_active_nodes WHERE design_item_id = ?").run(id)

        const nodes = input.designData.nodes
        
        // 计算 sort_order 的方式：按节点 Y 坐标升序，X 坐标为第二权重，使画布上看起来“从上到下、从左到右”的节点天然具备合理的顺序
        const sortedNodes = [...nodes].sort((a, b) => {
          const yA = a.position?.y ?? 0
          const yB = b.position?.y ?? 0
          if (yA !== yB) return yA - yB
          return (a.position?.x ?? 0) - (b.position?.x ?? 0)
        })

        const insertStmt = db.prepare(`
          INSERT INTO prompt_active_nodes (
            external_id, design_item_id, parent_node_id, node_type, title, content, sort_order, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)

        sortedNodes.forEach((node, index) => {
          const nodeData = node.data || {}
          // 仅记录核心业务节点，剔除没有任何提示词实体的容器、连接辅助板
          const nodeType = nodeData.nodeType
          if (!nodeType || nodeType === "assemble_a" || nodeType === "compiler_c") {
            return
          }

          const externalId = node.id
          const parentNodeId = node.parentId || null
          const title = nodeData.title || ""
          const content = nodeData.content !== undefined ? String(nodeData.content) : null

          insertStmt.run(
            externalId,
            id,
            parentNodeId,
            nodeType,
            title,
            content,
            index, // 排序序号
            now
          )
        })
      }
    })

    transaction()
  },
```

---

### Task 3: 前端 ReactFlow Canvas Ctrl + S 键盘监听与增量保存

**Files:**
- Modify: `src/renderer/src/features/prompt-design/components/PromptCanvas.tsx`（添加快捷键监听、防抖，并在按下后通过 window.api 进行大包保存）

- [ ] **Step 1: 在 `PromptCanvas.tsx` 中注册 `Ctrl + S` 键盘事件**

打开 `src/renderer/src/features/prompt-design/components/PromptCanvas.tsx`，在组件内部，通过 `useEffect` 注册防抖的按键捕获。按下后调用 `designs.update`，并通过 toast 发送优雅提示。

```typescript
  // ── Ctrl + S 物理按键监听及极速保存逻辑 ──
  const activeDesignId = usePromptDesignStore((state) => state.activeDesignId);

  const handleSave = useCallback(async () => {
    if (!activeDesignId) {
      toast.warning("未检测到有效设计项目，无法保存");
      return;
    }

    try {
      // 捕获 ReactFlow 最新的画布状态并整体打包
      const payload = {
        designData: {
          nodes,
          edges,
        },
      };

      await (window.api as any).promptDesign.designs.update(activeDesignId, payload);
      toast.success("画布保存成功");
    } catch (err) {
      console.error("Failed to save design:", err);
      toast.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [nodes, edges, activeDesignId, toast]);

  // 将 handleSave 挂载到 window，便于某些页面在卸载时触发自动安全落库
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 完美兼容 Windows (Ctrl) 与 macOS (Cmd / Meta)
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
        e.preventDefault(); // 阻止浏览器/系统默认保存网页弹出窗
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSave]);
```

- [ ] **Step 2: 在组件内部状态更新时添加合理的防抖状态（可选，用于防止多击）**

在 `PromptCanvas` 的 return 面板前，可以利用 `isLocked` 的相同状态让用户能看到是否有未保存或者锁定标识。按 Ctrl+S 后状态归零。

---

### Task 4: 严密静态类型检查与业务系统自检 (No Toleration)

**Files:**
- Test: 运行静态类型测试验证

- [ ] **Step 1: 运行 TypeScript 严格自检**

在控制台执行编译检验，不允许有任何 unhandled types 或者是 errors：
Run: `npx tsc --noEmit`
Expected: 全绿通过。

- [ ] **Step 2: 进行数据库写入持久化测试**

1. 拖入几个卡片（例如 System Role 节点、一个 Task 容器、一个 Task Title 等）。
2. 在画布上按下 `Ctrl + S` (macOS 下按 `Cmd + S`)。
3. 观察右下角是否有 "画布保存成功" 的优雅 Toast。
4. 退出该项目并重新进入，确认所有坐标、节点内文字、收折折叠状态以及连线完整复原。
5. （通过本地 SQLite 工具查看）`prompt_active_nodes` 表，确认记录了干净的、按 `position.y` 严密排列好的提纯业务节点。

---

## 备份：删除的结构化 Mock 数据集

以下是在重构 CRUD 动态加载时从 `PromptCanvas.tsx` 中移除的完整初始结构化画布测试数据集，供后续参考或数据测试：

```typescript
// ── 用户要求的结构化 MOCK 数据 ──
const rawInitialNodes: Node[] = [
  /* ── a组: 全局配置输入节点 ── */
  {
    id: "a-role",
    type: "promptNode",
    position: { x: 50, y: 50 },
    data: {
      title: "系统角色 (System Role)",
      description: "定义 AI 前端架构专家的人设",
      nodeType: "system_role",
      content: "你是一个资深的前端 React 架构师。请使用 TypeScript 和 Tailwind CSS 设计并生成高质量的、符合企业级规范的 React 组件。",
      outputs: [{ id: "out-role", name: "Output", type: "text" }],
    } as PromptNodeData,
  } as Node,
  {
    id: "a-obj",
    type: "promptNode",
    position: { x: 50, y: 190 },
    data: {
      title: "整体目标 (Objective)",
      description: "设定 AI 最终交付的目标",
      nodeType: "objective",
      content: "分析用户的业务任务，输出高内聚、高响应性、零缺陷的前端 React 完整源码实现。",
      outputs: [{ id: "out-obj", name: "Output", type: "text" }],
    } as PromptNodeData,
  } as Node,
  {
    id: "a-const",
    type: "promptNode",
    position: { x: 50, y: 330 },
    data: {
      title: "全局约束 (Constraints)",
      description: "开发必须严格遵守的红线",
      nodeType: "constraints",
      content: "- 严禁使用任何外部全局状态库\n- 必须实现 100% 的 TypeScript 强类型声明",
      outputs: [{ id: "out-const", name: "Output", type: "text" }],
    } as PromptNodeData,
  } as Node,

  /* ── a-组装卡片 (Global Assembler) ── */
  {
    id: "a-assembler",
    type: "promptNode",
    position: { x: 380, y: 150 },
    data: {
      title: "A-全局组装 (Global Config)",
      description: "收集并打包所有全局前置标签 (a)",
      nodeType: "assemble_a",
      inputs: [
        { id: "in-system_role", name: "系统角色 (System Role)", type: "text" },
        { id: "in-objective", name: "整体目标 (Objective)", type: "text" },
        { id: "in-constraints", name: "全局约束 (Constraints)", type: "text" },
      ],
      outputs: [{ id: "out-global", name: "打包输出", type: "global_config" }],
    } as PromptNodeData,
  } as Node,

  /* ── b1组: 任务1 (Task 1 Container + Fields) ── */
  {
    id: "b1-container",
    type: "promptNode",
    position: { x: 800, y: 10 },
    style: { width: 500, height: 10 },
    data: {
      title: "b1 任务: 表格架构搭建",
      description: "拖入子属性卡片到此区域中",
      nodeType: "task",
      taskId: "1",
      isCollapsed: true,
      expandedHeight: 600,
    } as PromptNodeData,
  } as Node,
  {
    id: "b1-title",
    type: "promptNode",
    position: { x: 20, y: 80 },
    parentId: "b1-container",
    extent: "parent",
    hidden: true,
    data: {
      title: "任务1 名称",
      nodeType: "task_title",
      content: "数据表格核心骨架实现",
    } as PromptNodeData,
  } as Node,
  {
    id: "b1-goal",
    type: "promptNode",
    position: { x: 20, y: 220 },
    parentId: "b1-container",
    extent: "parent",
    hidden: true,
    data: {
      title: "任务1 目标",
      nodeType: "task_goal",
      content: "创建自适应表格布局，保证加载中与无数据状态交互连贯。",
    } as PromptNodeData,
  } as Node,
  {
    id: "b1-instructions",
    type: "promptNode",
    position: { x: 20, y: 360 },
    parentId: "b1-container",
    extent: "parent",
    hidden: true,
    data: {
      title: "执行步骤 (Instructions)",
      nodeType: "task_instructions",
      content: "1. 拆分 Table Header 和 Body\n2. 注入 Mock 数据渲染\n3. 添加 Loading 骨架屏",
    } as PromptNodeData,
  } as Node,
  {
    id: "b1-rules",
    type: "promptNode",
    position: { x: 20, y: 500 },
    parentId: "b1-container",
    extent: "parent",
    hidden: true,
    data: {
      title: "任务规则 (Rules)",
      nodeType: "task_rules",
      content: "组件必须使用 forwardRef，确保父级可获取 table 实例。",
    } as PromptNodeData,
  } as Node,
  {
    id: "b1-output",
    type: "promptNode",
    position: { x: 20, y: 640 },
    parentId: "b1-container",
    extent: "parent",
    hidden: true,
    data: {
      title: "输出要求 (Output)",
      nodeType: "task_output",
      content: "只返回 DataTable.tsx 的源码，无需解释。",
    } as PromptNodeData,
  } as Node,

  /* ── b2组: 任务2 (Task 2 Container + Fields) ── */
  {
    id: "b2-container",
    type: "promptNode",
    position: { x: 800, y: 650 },
    style: { width: 500, height: 10 },
    data: {
      title: "b2 任务: 搜索与分页逻辑",
      description: "拖入子属性卡片到此区域中",
      nodeType: "task",
      taskId: "2",
      isCollapsed: true,
      expandedHeight: 600,
    } as PromptNodeData,
  } as Node,
  {
    id: "b2-title",
    type: "promptNode",
    position: { x: 20, y: 80 },
    parentId: "b2-container",
    extent: "parent",
    hidden: true,
    data: {
      title: "任务2 名称",
      nodeType: "task_title",
      content: "数据流控制与分页核心",
    } as PromptNodeData,
  } as Node,
  {
    id: "b2-goal",
    type: "promptNode",
    position: { x: 20, y: 220 },
    parentId: "b2-container",
    extent: "parent",
    hidden: true,
    data: {
      title: "任务2 目标",
      nodeType: "task_goal",
      content: "提供每页数量切换以及防抖过滤检索，空态无缝重置。",
    } as PromptNodeData,
  } as Node,
  {
    id: "b2-depends",
    type: "promptNode",
    position: { x: 20, y: 360 },
    parentId: "b2-container",
    extent: "parent",
    hidden: true,
    data: {
      title: "任务依赖 (Depends On)",
      nodeType: "task_depends_on",
      content: "依赖 任务1 (数据表格核心骨架实现) 的完成。",
    } as PromptNodeData,
  } as Node,
  {
    id: "b2-instructions",
    type: "promptNode",
    position: { x: 20, y: 500 },
    parentId: "b2-container",
    extent: "parent",
    hidden: true,
    data: {
      title: "执行步骤 (Instructions)",
      nodeType: "task_instructions",
      content: "1. 接入 useDebounce hook\n2. 实现 usePagination\n3. 将状态下发至 DataTable",
    } as PromptNodeData,
  } as Node,

  /* ── c最终导出卡片 (Compiler Terminal) ── */
  {
    id: "c-compiler",
    type: "promptNode",
    position: { x: 1420, y: 250 },
    data: {
      title: "C-最终导出 (Compiler Terminal)",
      description: "汇聚 A全局配置、B任务列表及 C后置配置 以进行一键编译",
      nodeType: "compiler_c",
      inputs: [
        { id: "in-tasks", name: "任务列表 (Tasks)", type: "task" },
        { id: "in-format", name: "输出格式 (Format)", type: "text", handlePosition: "right" },
        { id: "in-validation", name: "全局校验 (Validation)", type: "text", handlePosition: "right" },
      ],
    } as PromptNodeData,
  } as Node,

  /* ── c组: 后置全局配置节点 ── */
  {
    id: "c-format",
    type: "promptNode",
    position: { x: 1750, y: 150 },
    data: {
      title: "输出格式 (Output Format)",
      description: "严格约束最终的代码交付标准",
      nodeType: "output_format",
      content: "提供用 ```tsx 标记包裹的单文件完整代码，尾部必须提供 Jest 单元测试示范用例。",
      outputs: [{ id: "out-format", name: "Output", type: "text", handlePosition: "left" }],
    } as PromptNodeData,
  } as Node,
  {
    id: "c-validation",
    type: "promptNode",
    position: { x: 1750, y: 350 },
    data: {
      title: "全局校验 (Validation)",
      description: "定义大模型交付前自检清单",
      nodeType: "validation",
      content: "检查所有任务是否圆满完成，并确认完全符合开发约束。",
      outputs: [{ id: "out-validation", name: "Output", type: "text", handlePosition: "left" }],
    } as PromptNodeData,
  } as Node,
];

const rawInitialEdges: Edge[] = [
  /* ── a (全局输入) -> a组装卡片 ── */
  { id: "e-a-role", source: "a-role", target: "a-assembler", sourceHandle: "out-role", targetHandle: "in-system_role" },
  { id: "e-a-obj", source: "a-obj", target: "a-assembler", sourceHandle: "out-obj", targetHandle: "in-objective" },
  { id: "e-a-const", source: "a-const", target: "a-assembler", sourceHandle: "out-const", targetHandle: "in-constraints" },

  /* ── a组装卡片 -> b1 & b2 任务输入 ── */
  { id: "e-assemble-b1", source: "a-assembler", target: "b1-container", sourceHandle: "out-global", targetHandle: "in-global" },
  { id: "e-assemble-b2", source: "a-assembler", target: "b2-container", sourceHandle: "out-global", targetHandle: "in-global" },

  /* ── b1 & b2 任务整合 -> c (最终编译端) ── */
  { id: "e-b1-final", source: "b1-container", target: "c-compiler", sourceHandle: "out-task", targetHandle: "in-tasks" },
  { id: "e-b2-final", source: "b2-container", target: "c-compiler", sourceHandle: "out-task", targetHandle: "in-tasks" },

  /* ── c (后置输入) -> c组装卡片 (但为了排版，设置为反向边 isBackward) ── */
  { id: "e-c-format", source: "c-format", target: "c-compiler", sourceHandle: "out-format", targetHandle: "in-format", data: { isBackward: true } },
  { id: "e-c-validation", source: "c-validation", target: "c-compiler", sourceHandle: "out-validation", targetHandle: "in-validation", data: { isBackward: true } },
];
```

