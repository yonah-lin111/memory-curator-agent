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
      title: "{{framework}}",
      description: "前端框架变量",
      nodeType: "variable",
      variables: ["framework"],
    } as PromptNodeData,
  },
  {
    id: "cmt-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "设计备忘",
      nodeType: "comment",
      content: "这是一个用于生成【登录功能】代码的提示词流程：\n结合了技术栈变量、系统角色定义以及接口文档上下文。",
    } as PromptNodeData,
  },

  /* ── 连线卡片：模板片段 ── */
  {
    id: "tpl-role",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "角色设定",
      description: "设定 AI 的前端开发角色",
      nodeType: "template",
      content: "你是一个资深的前端开发工程师，精通 {{framework}}，擅长编写安全、优雅且符合现代 UI 规范的登录组件。",
      variables: ["framework"],
      outputs: [
        { id: "out-role", name: "Output", type: "text" },
      ],
    } as PromptNodeData,
  },
  {
    id: "ctx-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "API 文档",
      description: "注入后端登录接口规范",
      nodeType: "context",
      content: "【登录接口】\nPOST /api/v1/auth/login\n请求体：{ email, password, captcha }\n响应：{ token, user: { id, name, avatar, roles } }\n注意处理 401 和 429 状态码。",
      outputs: [
        { id: "out-ctx", name: "Output", type: "text" },
      ],
    } as PromptNodeData,
  },
  {
    id: "tpl-task",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "需求描述",
      description: "业务需求明细",
      nodeType: "template",
      content: "请使用 {{framework}} 实现一个登录页面。\n要求包含邮箱和密码校验，并在提交时展示 loading 状态。\n界面要包含“忘记密码”入口。",
      variables: ["framework"],
      outputs: [
        { id: "out-task", name: "Output", type: "text" },
      ],
    } as PromptNodeData,
  },
  {
    id: "cond-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "框架选择?",
      description: "根据变量分支输出",
      nodeType: "condition",
      inputs: [
        { id: "in-cond", name: "Input", type: "text" },
      ],
      outputs: [
        { id: "out-true", name: "React", type: "text" },
        { id: "out-false", name: "Vue", type: "text" },
      ],
    } as PromptNodeData,
  },
  {
    id: "tpl-react",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "React 版",
      nodeType: "template",
      content: "使用 React + Tailwind CSS 实现组件。",
      inputs: [
        { id: "in-react", name: "Input", type: "text" },
      ],
      outputs: [
        { id: "out-react", name: "Output", type: "text" },
      ],
    } as PromptNodeData,
  },
  {
    id: "tpl-vue",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "Vue 版",
      nodeType: "template",
      content: "使用 Vue 3 + Element Plus 实现组件。",
      inputs: [
        { id: "in-vue", name: "Input", type: "text" },
      ],
      outputs: [
        { id: "out-vue", name: "Output", type: "text" },
      ],
    } as PromptNodeData,
  },
  {
    id: "out-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "最终提示词",
      nodeType: "output",
      inputs: [
        { id: "in-out-role", name: "角色", type: "text" },
        { id: "in-out-ctx", name: "文档", type: "text" },
        { id: "in-out-res", name: "结果", type: "text" },
      ],
    } as PromptNodeData,
  },
];

const rawInitialEdges: Edge[] = [
  { id: "e-role-out",  source: "tpl-role",  target: "out-1",     sourceHandle: "out-role",  targetHandle: "in-out-role" },
  { id: "e-ctx-out",   source: "ctx-1",     target: "out-1",     sourceHandle: "out-ctx",   targetHandle: "in-out-ctx" },
  { id: "e-task-cond", source: "tpl-task",  target: "cond-1",    sourceHandle: "out-task",  targetHandle: "in-cond" },
  { id: "e-cond-react",source: "cond-1",    target: "tpl-react", sourceHandle: "out-true",  targetHandle: "in-react" },
  { id: "e-cond-vue",  source: "cond-1",    target: "tpl-vue",   sourceHandle: "out-false", targetHandle: "in-vue" },
  { id: "e-react-out", source: "tpl-react", target: "out-1",     sourceHandle: "out-react", targetHandle: "in-out-res" },
  { id: "e-vue-out",   source: "tpl-vue",   target: "out-1",     sourceHandle: "out-vue",   targetHandle: "in-out-res" },
].map((e) => ({
  ...e,
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
      if (window.electron && window.electron.ipcRenderer) {
        const result = await window.electron.ipcRenderer.invoke(
          "dialog:showSaveDialog",
          {
            title: "导出提示词流程",
            defaultPath: `prompt_flow_${Date.now()}.md`,
            filters: [{ name: "Markdown Files", extensions: ["md"] }],
          }
        );
        if (result && !result.canceled && result.filePath) {
          await window.electron.ipcRenderer.invoke(
            "fs:writeFile",
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
