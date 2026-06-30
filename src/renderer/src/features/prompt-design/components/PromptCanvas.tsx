import { useState, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PromptNode, type PromptNodeData, cardTypeMeta, type PromptCardType } from "./PromptNode";
import { getLayoutedElements } from "../utils/layout";
import { CanvasControls } from "./CanvasControls";
import { useFlowHistory } from "../hooks/useFlowHistory";
import { PromptCanvasContextMenu, type ContextMenuState } from "./PromptCanvasContextMenu";
import { useToast } from "@/components/ui/Toast";
import { usePromptDesignStore } from "../store/promptDesignStore";

const nodeTypes: NodeTypes = {
  promptNode: PromptNode,
};

/** minimap 颜色映射 */
const minimapColors: Record<string, string> = {
  system:       "#fb7185",
  user:         "#38bdf8",
  assistant:    "#34d399",
  tool_message: "#60a5fa",
  template:     "#fbbf24",
  context:      "#c084fc",
  assemble:     "#2dd4bf",
  condition:    "#fb923c",
  loop:         "#22d3ee",
  output:       "#a3e635",
  variable:     "#facc15",
  comment:      "#9ca3af",
  group:        "#a1a1aa",
};

const rawInitialNodes = [
  /* ── 独立卡片 ── */
  {
    id: "var-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "{{component}}",
      description: "组件名称",
      nodeType: "variable",
      variables: ["component"],
    } as PromptNodeData,
  },
  {
    id: "var-2",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "{{theme}}",
      description: "UI 主题风格",
      nodeType: "variable",
      variables: ["theme"],
    } as PromptNodeData,
  },
  {
    id: "cmt-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "需求梳理",
      nodeType: "comment",
      content: "这是一个生成复杂 React 组件的提示词。\n目标是支持自动注入 UI 规范、解析业务需求，并在需要时生成 mock 数据。\n涉及到条件判断以决定是否包含测试代码，以及循环处理多个相似的子组件。",
    } as PromptNodeData,
  },

  /* ── 连线卡片 ── */
  {
    id: "tpl-role",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "角色设定",
      description: "定义 AI 前端专家身份",
      nodeType: "role",
      content: "你是一个资深的 React 架构师。请使用 TypeScript 和 Tailwind CSS 为我实现一个高质量的 {{component}} 组件。\n请遵循当前项目的 {{theme}} 主题规范。",
      variables: ["component", "theme"],
      outputs: [
        { id: "out-role", name: "Output", type: "text" },
      ],
    } as PromptNodeData,
  },
  {
    id: "ctx-api",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "UI 规范上下文",
      description: "注入项目设计系统文档",
      nodeType: "context",
      content: "【设计规范】\n- 按钮圆角：rounded-md\n- 主色调：bg-indigo-600 hover:bg-indigo-700\n- 阴影：shadow-sm\n- 字体：font-sans text-sm\n所有交互元素必须包含焦点状态 (focus-visible)。",
      outputs: [
        { id: "out-ctx-api", name: "Output", type: "text" },
      ],
    } as PromptNodeData,
  },
  {
    id: "tpl-task-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "需求: 基础框架",
      description: "描述组件的核心骨架",
      nodeType: "template",
      content: "该组件需要展示一个数据表格的整体布局骨架，包括表头、表格主体区域，并支持基础响应式。",
      inputs: [
        { id: "in-task1-role", name: "角色设定", type: "text" },
        { id: "in-task1-ctx", name: "UI 规范", type: "text" },
      ],
      outputs: [
        { id: "out-task-1", name: "基础要求", type: "text" },
      ],
    } as PromptNodeData,
  },
  {
    id: "tpl-task-2",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "需求: 分页功能",
      description: "描述分页组件逻辑",
      nodeType: "requirement",
      content: "在表格底部增加分页控制器，包含上一页、下一页和页码快速跳转。支持每页展示数量切换。",
      inputs: [
        { id: "in-task2-base", name: "依赖骨架", type: "text" },
      ],
      outputs: [
        { id: "out-task-2", name: "分页要求", type: "text" },
      ],
    } as PromptNodeData,
  },
  {
    id: "tpl-task-3",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "需求: 搜索与过滤",
      description: "描述表头搜索逻辑",
      nodeType: "requirement",
      content: "在表格顶部增加搜索框和列过滤器。要求实现搜索防抖，并且清空搜索时重置回第一页。",
      inputs: [
        { id: "in-task3-base", name: "依赖骨架", type: "text" },
      ],
      outputs: [
        { id: "out-task-3", name: "搜索要求", type: "text" },
      ],
    } as PromptNodeData,
  },
  {
    id: "cond-test",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "数据源类型?",
      description: "根据数据获取方式分支",
      nodeType: "condition",
      inputs: [
        { id: "in-cond", name: "集成所有需求", type: "text" },
      ],
      outputs: [
        { id: "out-true", name: "API 联调", type: "text" },
        { id: "out-false", name: "纯前端 Mock", type: "text" },
      ],
    } as PromptNodeData,
  },
  {
    id: "tpl-api",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "请求逻辑生成",
      nodeType: "template",
      content: "请使用 SWR 或 React Query 编写数据请求钩子。处理 isLoading 和 error 状态，实现接口请求参数与分页、搜索状态的双向绑定。",
      inputs: [
        { id: "in-api", name: "前置需求", type: "text" },
      ],
      outputs: [
        { id: "out-api", name: "Output", type: "text" },
      ],
    } as PromptNodeData,
  },
  {
    id: "loop-mock",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "生成 Mock 数据",
      description: "为表格列生成测试数据",
      nodeType: "loop",
      content: "对于表格中的每一列，生成 20 条符合字段类型的随机 mock 数据。实现一个本地的假分页和搜索过滤逻辑。",
      inputs: [
        { id: "in-loop", name: "前置需求", type: "text" },
      ],
      outputs: [
        { id: "out-loop", name: "Output", type: "text" },
      ],
    } as PromptNodeData,
  },
  {
    id: "out-final",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "最终代码生成",
      nodeType: "output",
      inputs: [
        { id: "in-out-api", name: "API版代码", type: "text" },
        { id: "in-out-mock", name: "Mock版代码", type: "text" },
      ],
    } as PromptNodeData,
  },
];

const rawInitialEdges: Edge[] = [
  // 角色和规范 -> 需求1（骨架）
  { id: "e-role-task1", source: "tpl-role", target: "tpl-task-1", sourceHandle: "out-role", targetHandle: "in-task1-role" },
  { id: "e-ctx-task1", source: "ctx-api", target: "tpl-task-1", sourceHandle: "out-ctx-api", targetHandle: "in-task1-ctx" },
  
  // 需求1（骨架）-> 需求2 和 需求3 (并行拆解功能)
  { id: "e-task1-task2", source: "tpl-task-1", target: "tpl-task-2", sourceHandle: "out-task-1", targetHandle: "in-task2-base" },
  { id: "e-task1-task3", source: "tpl-task-1", target: "tpl-task-3", sourceHandle: "out-task-1", targetHandle: "in-task3-base" },

  // 需求2 和 需求3 -> 汇聚到条件判断
  // 这里通过复用 in-cond 接口来汇集多个需求流，在实际业务中可能也是个集线器（这里为了简便直接连到条件）
  { id: "e-task2-cond", source: "tpl-task-2", target: "cond-test", sourceHandle: "out-task-2", targetHandle: "in-cond" },
  { id: "e-task3-cond", source: "tpl-task-3", target: "cond-test", sourceHandle: "out-task-3", targetHandle: "in-cond" },
  
  // 条件 -> 真实API请求模块 (True 分支)
  { id: "e-cond-api", source: "cond-test", target: "tpl-api", sourceHandle: "out-true", targetHandle: "in-api" },
  // 条件 -> Mock生成模块 (False 分支)
  { id: "e-cond-mock", source: "cond-test", target: "loop-mock", sourceHandle: "out-false", targetHandle: "in-loop" },
  
  // 分支模块 -> 最终输出
  { id: "e-api-out", source: "tpl-api", target: "out-final", sourceHandle: "out-api", targetHandle: "in-out-api" },
  { id: "e-mock-out", source: "loop-mock", target: "out-final", sourceHandle: "out-loop", targetHandle: "in-out-mock" },
].map((e) => ({
  ...e,
  type: "smoothstep", // 使用 smoothstep 类型
  animated: true,
  style: { stroke: "#818cf8", strokeWidth: 2 },
}));

// 初始化时即进行一次排版
const { nodes: initialNodes, edges: initialEdges } = getLayoutedElements(
  rawInitialNodes,
  rawInitialEdges,
  "LR"
);

export const PromptCanvas = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();
  const { takeSnapshot, undo, redo, canUndo, canRedo } = useFlowHistory(nodes, edges, setNodes, setEdges);

  const [menuState, setMenuState] = useState<ContextMenuState>({ type: null, x: 0, y: 0 });
  const [copiedNode, setCopiedNode] = useState<Node | null>(null);
  const isLocked = usePromptDesignStore((state) => state.isCanvasLocked);
  const exportRequest = usePromptDesignStore((state) => state.exportRequest);
  const resetExportRequest = usePromptDesignStore((state) => state.resetExportRequest);
  const toast = useToast();

  const handleExport = useCallback(async () => {
    if (nodes.length === 0) {
      toast.warning("画布为空，没有可导出的内容");
      return;
    }

    // ── 数据结构准备 ──
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const dataMap = new Map(nodes.map((n) => [n.id, n.data as PromptNodeData]));

    const outgoing = new Map<string, Edge[]>();
    for (const e of edges) {
      if (!outgoing.has(e.source)) outgoing.set(e.source, []);
      outgoing.get(e.source)!.push(e);
    }

    // ── 从 Output 节点反向 BFS 找出连通子图 ──
    const outputIds = nodes
      .filter((n) => dataMap.get(n.id)?.nodeType === "output")
      .map((n) => n.id);
    
    // 如果没有 output 节点，提示用户
    if (outputIds.length === 0) {
      toast.warning("请添加至少一个「输出终点」卡片");
      return;
    }

    const connected = new Set<string>();
    const bfsQueue: string[] = [...outputIds];
    const incomingReverse = new Map<string, string[]>();
    for (const e of edges) {
      if (!incomingReverse.has(e.target)) incomingReverse.set(e.target, []);
      incomingReverse.get(e.target)!.push(e.source);
    }

    while (bfsQueue.length) {
      const curr = bfsQueue.shift()!;
      if (!connected.has(curr)) {
        connected.add(curr);
        const prevNodes = incomingReverse.get(curr) || [];
        for (const p of prevNodes) {
          if (!connected.has(p)) bfsQueue.push(p);
        }
      }
    }

    // 将独立的变量节点也加入（只要存在就导出到变量表）
    const allVariables = new Set<string>();
    for (const n of nodes) {
      const data = dataMap.get(n.id);
      if (data?.nodeType === "variable" && data.variables?.length) {
        data.variables.forEach(v => allVariables.add(v));
      }
      if (connected.has(n.id) && data?.variables) {
        data.variables.forEach(v => allVariables.add(v));
      }
    }

    // ── 拓扑排序 (Kahn's algorithm) ──
    const inDegree = new Map<string, number>();
    for (const id of connected) {
      inDegree.set(id, 0);
    }
    for (const e of edges) {
      if (connected.has(e.source) && connected.has(e.target)) {
        inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    const sortedIds: string[] = [];
    while (queue.length) {
      const curr = queue.shift()!;
      sortedIds.push(curr);
      const outEdges = outgoing.get(curr) || [];
      for (const e of outEdges) {
        if (connected.has(e.target)) {
          const deg = (inDegree.get(e.target) || 0) - 1;
          inDegree.set(e.target, deg);
          if (deg === 0) queue.push(e.target);
        }
      }
    }

    if (sortedIds.length !== connected.size) {
      toast.warning("检测到循环依赖，导出结果可能不准确");
    }

    // ── 组装 Markdown ──
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    let md = `# 提示词导出\n> ${dateStr} | ${sortedIds.length} 节点\n\n`;

    // 1. Mermaid 架构图
    md += `## 架构图\n\`\`\`mermaid\nflowchart LR\n`;
    const safeName = (id: string) => {
      const title = dataMap.get(id)?.title || id;
      return title.replace(/["\[\]\(\)\{\}]/g, ''); // 移除在 Mermaid 中可能引起语法错误的特殊字符
    };
    
    for (const e of edges) {
      if (connected.has(e.source) && connected.has(e.target)) {
        const sourceData = dataMap.get(e.source);
        let linkLabel = "";
        if (sourceData?.nodeType === "condition") {
          if (e.sourceHandle === "out-true") linkLabel = " -- True --> ";
          else if (e.sourceHandle === "out-false") linkLabel = " -- False --> ";
          else linkLabel = " --> ";
        } else {
          linkLabel = " --> ";
        }
        
        let targetShape = `[${safeName(e.target)}]`;
        if (dataMap.get(e.target)?.nodeType === "output") {
          targetShape = `((${safeName(e.target)}))`;
        } else if (dataMap.get(e.target)?.nodeType === "condition") {
          targetShape = `{${safeName(e.target)}}`;
        }

        let sourceShape = `[${safeName(e.source)}]`;
        if (sourceData?.nodeType === "condition") {
           sourceShape = `{${safeName(e.source)}}`;
        }
        
        md += `  ${e.source.replace(/-/g, '_')}${sourceShape}${linkLabel}${e.target.replace(/-/g, '_')}${targetShape}\n`;
      }
    }
    md += `\`\`\`\n\n`;

    // 2. 流程内容
    md += `## 流程\n\n`;
    for (const id of sortedIds) {
      const data = dataMap.get(id);
      if (!data) continue;

      if (data.nodeType === "comment" || data.nodeType === "variable") continue; // 跳过

      md += `### ${data.title}`;
      if (data.nodeType === "condition") md += ` \`[条件]\``;
      if (data.nodeType === "output") md += ` \`[输出]\``;
      md += `\n`;

      if (data.nodeType === "condition") {
        md += `**分支**:\n`;
        const outs = outgoing.get(id) || [];
        const trueTarget = outs.find(e => e.sourceHandle === "out-true")?.target;
        const falseTarget = outs.find(e => e.sourceHandle === "out-false")?.target;
        
        if (trueTarget) md += `- ✅ True → 输出到 **${dataMap.get(trueTarget)?.title || trueTarget}**\n`;
        if (falseTarget) md += `- ❌ False → 输出到 **${dataMap.get(falseTarget)?.title || falseTarget}**\n`;
      } else {
        if (data.description) {
           md += `*${data.description}*\n\n`;
        }
        if (data.content) {
          if (data.content.includes('\n')) {
             md += `\`\`\`\n${data.content}\n\`\`\`\n`;
          } else {
             md += `${data.content}\n`;
          }
        }
      }
      md += `\n`;
    }

    md += `---\n\n`;

    // 3. 变量表
    if (allVariables.size > 0) {
      md += `### 变量\n| 变量 | 占位符 |\n|------|--------|\n`;
      for (const v of allVariables) {
        md += `| \`{{${v}}}\` | ${v} |\n`;
      }
    } else {
      md += `*无变量定义*\n`;
    }

    try {
      if (window.api && window.api.dialog) {
        const result = await window.api.dialog.showSaveDialog(
          {
            title: "导出提示词流程",
            defaultPath: `prompt_flow_${Date.now()}.md`,
            filters: [{ name: "Markdown Files", extensions: ["md"] }],
          }
        );
        if (result && !result.canceled && result.filePath) {
          // 这里可以使用 files 模块的 API 或者是增加一个 writeFile API
          // 暂时使用 Blob 下载的方式来作为 fallback，或者我们增加一个 writeFile API
          // 比较正规的做法是增加 api.files.writeFile
          
          // 我们先修改调用方式，这里直接调用 ipcRenderer 如果是在 preload 中暴露的话
          await window.api.fs.writeFile(
            result.filePath,
            md
          );
          toast.success("导出成功", { description: result.filePath });
        }
      } else {
        const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `prompt_flow_${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("导出成功");
      }
    } catch (err) {
      console.error(err);
      toast.error("导出失败", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      resetExportRequest();
    }
  }, [nodes, edges, resetExportRequest, toast]);

  useEffect(() => {
    if (exportRequest > 0) {
      handleExport();
    }
  }, [exportRequest, handleExport]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const createNewNode = useCallback((type: PromptCardType, position: { x: number; y: number }) => {
    let initialInputs: any[] = [];
    let initialOutputs: any[] = [];

    const meta = cardTypeMeta[type as PromptCardType];
    if (meta && !meta.isIndependent) {
      if (type === "condition") {
        initialInputs = [{ id: `in_${Date.now()}`, name: "Input", type: "any" }];
        initialOutputs = [
          { id: "out-true", name: "True", type: "branch" },
          { id: "out-false", name: "False", type: "branch" },
        ];
      } else if (type === "context" || type === "template") {
        initialInputs = [{ id: `in_${Date.now()}`, name: "Input", type: "any" }];
        initialOutputs = [{ id: `out_${Date.now()}`, name: "Output", type: "any" }];
      } else if (type === "output") {
        initialInputs = [{ id: `in_${Date.now()}`, name: "Input", type: "any" }];
      } else {
        initialInputs = [{ id: `in_${Date.now()}`, name: "Input", type: "any" }];
        initialOutputs = [{ id: `out_${Date.now()}`, name: "Output", type: "any" }];
      }
    }

    return {
      id: `node_${Date.now()}`,
      type: "promptNode",
      position,
      data: {
        title: meta?.label || "新卡片",
        nodeType: type,
        inputs: initialInputs.length > 0 ? initialInputs : undefined,
        outputs: initialOutputs.length > 0 ? initialOutputs : undefined,
      } as PromptNodeData,
    };
  }, []);
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (isLocked) {
        toast.warning("画布已锁定，无法添加组件");
        return;
      }

      const type = event.dataTransfer.getData("application/reactflow");

      if (typeof type === "undefined" || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      takeSnapshot();

      const newNode = createNewNode(type as PromptCardType, position);
      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, takeSnapshot, createNewNode, isLocked, toast],
  );

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      if (isLocked) return;
      takeSnapshot();
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep", // 新连接的线也使用 smoothstep
            animated: true,
            style: { stroke: "#818cf8", strokeWidth: 2 },
          } as Edge,
          eds,
        ),
      );
    },
    [setEdges, takeSnapshot, isLocked],
  );

  const onNodeDragStart = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  const onNodesDelete = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  const onEdgesDelete = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    if (isLocked) return;
    setMenuState({
      type: "node",
      x: event.clientX,
      y: event.clientY,
      id: node.id,
    });
  }, [isLocked]);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    if (isLocked) return;
    setMenuState({
      type: "edge",
      x: event.clientX,
      y: event.clientY,
      id: edge.id,
    });
  }, [isLocked]);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    if (isLocked) return;
    setMenuState({
      type: "pane",
      x: event.clientX,
      y: event.clientY,
    });
  }, [isLocked]);

  const closeContextMenu = useCallback(() => {
    setMenuState({ type: null, x: 0, y: 0 });
  }, []);

  const handleCopyNode = useCallback((nodeId: string) => {
    const nodeToCopy = nodes.find((n) => n.id === nodeId);
    if (nodeToCopy) {
      setCopiedNode(nodeToCopy);
      toast.success("节点已复制");
    }
  }, [nodes, toast]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    takeSnapshot();
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    toast.info("节点已删除");
  }, [setNodes, setEdges, takeSnapshot, toast]);

  const handlePasteNode = useCallback((clientX: number, clientY: number) => {
    if (!copiedNode) return;
    takeSnapshot();
    const position = screenToFlowPosition({ x: clientX, y: clientY });
    
    // 复制输入和输出的 ID 使其唯一
    const newData = { ...(copiedNode.data as PromptNodeData) };
    if (newData.inputs) {
      newData.inputs = newData.inputs.map(i => ({ ...i, id: `in_${Date.now()}_${Math.random().toString(36).substring(7)}` }));
    }
    if (newData.outputs) {
      newData.outputs = newData.outputs.map(o => ({ ...o, id: `out_${Date.now()}_${Math.random().toString(36).substring(7)}` }));
    }

    const newNode: Node = {
      ...copiedNode,
      id: `node_${Date.now()}`,
      position,
      selected: false,
      data: newData,
    };

    setNodes((nds) => nds.concat(newNode));
    toast.success("节点已粘贴");
  }, [copiedNode, screenToFlowPosition, setNodes, takeSnapshot, toast]);

  const handleAddNodeFromMenu = useCallback((type: PromptCardType, clientX: number, clientY: number) => {
    takeSnapshot();
    const position = screenToFlowPosition({ x: clientX, y: clientY });
    const newNode = createNewNode(type, position);
    setNodes((nds) => nds.concat(newNode));
    toast.success("卡片已添加");
  }, [screenToFlowPosition, createNewNode, setNodes, takeSnapshot, toast]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    takeSnapshot();
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    toast.info("连线已删除");
  }, [setEdges, takeSnapshot, toast]);

  return (
    <div className="h-full w-full bg-[#111111] rounded-[6px] overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeDragStart={onNodeDragStart}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={closeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode="dark"
        minZoom={0.1}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        deleteKeyCode={isLocked ? null : ['Backspace', 'Delete']}
      >
        <Background color="#444" gap={20} size={1} />
        <CanvasControls
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          takeSnapshot={takeSnapshot}
        />
        <MiniMap
          nodeColor={(n) => {
            const t = n.data?.nodeType as string;
            return minimapColors[t] || "#6366f1";
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
          className="!bg-[#212121] !border-white/10"
          position="top-right"
        />
        <PromptCanvasContextMenu
          menuState={menuState}
          onClose={closeContextMenu}
          onCopyNode={handleCopyNode}
          onDeleteNode={handleDeleteNode}
          onPasteNode={handlePasteNode}
          onAddNode={handleAddNodeFromMenu}
          onDeleteEdge={handleDeleteEdge}
          canPaste={!!copiedNode}
        />
      </ReactFlow>
    </div>
  );
};
