import { useState, useCallback } from "react";
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
      title: "{{role}}",
      description: "角色变量：助手 / 专家 / 教练",
      nodeType: "variable",
      variables: ["role"],
    } as PromptNodeData,
  },
  {
    id: "cmt-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "设计备忘",
      nodeType: "comment",
      content: "条件分支根据用户意图将对话\n路由到不同的提示词模板",
    } as PromptNodeData,
  },

  /* ── 连线卡片：系统角色 ── */
  {
    id: "sys-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "系统角色定义",
      description: "为整个对话设定 AI 的行为边界与角色",
      nodeType: "system",
      content: "你是专业的{{role}}，请根据用户意图提供对应服务。",
      variables: ["role"],
      outputs: [
        { id: "out-sys", name: "System", type: "message/system" },
      ],
    } as PromptNodeData,
  },

  /* ── 条件分支 ── */
  {
    id: "cond-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "意图路由",
      description: "根据用户意图分发到不同模板",
      nodeType: "condition",
      inputs: [
        { id: "in-cond", name: "System", type: "message/system" },
      ],
      outputs: [
        { id: "branch-creative", name: "创作", type: "branch" },
        { id: "branch-analytic", name: "分析", type: "branch" },
      ],
    } as PromptNodeData,
  },

  /* ── 上下文注入 ── */
  {
    id: "ctx-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "知识库上下文",
      description: "RAG 检索结果注入到消息流",
      nodeType: "context",
      outputs: [
        { id: "out-ctx", name: "Context", type: "context" },
      ],
    } as PromptNodeData,
  },

  /* ── 分支 A：创作模板 ── */
  {
    id: "tpl-creative",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "创作提示词",
      nodeType: "template",
      content: "以{{style}}风格创作关于{{topic}}的内容。\n要求：语言流畅、结构清晰。",
      variables: ["style", "topic"],
      inputs: [
        { id: "in-tpl1", name: "分支", type: "branch" },
      ],
      outputs: [
        { id: "out-tpl1", name: "Template", type: "message/user" },
      ],
    } as PromptNodeData,
  },

  /* ── 分支 B：分析模板 ── */
  {
    id: "tpl-analytic",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "分析提示词",
      nodeType: "template",
      content: "分析{{topic}}的关键因素与潜在影响。\n请以结构化方式输出结论。",
      variables: ["topic"],
      inputs: [
        { id: "in-tpl2", name: "分支", type: "branch" },
      ],
      outputs: [
        { id: "out-tpl2", name: "Template", type: "message/user" },
      ],
    } as PromptNodeData,
  },

  /* ── 消息组装 ── */
  {
    id: "asm-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "消息组装",
      description: "按序拼接 System + Context + 用户消息",
      nodeType: "assemble",
      inputs: [
        { id: "in-asm1", name: "创作分支", type: "message/user" },
        { id: "in-asm2", name: "分析分支", type: "message/user" },
        { id: "in-asm3", name: "上下文", type: "context" },
      ],
      outputs: [
        { id: "out-asm", name: "Messages", type: "messages" },
      ],
    } as PromptNodeData,
  },

  /* ── 输出终点 ── */
  {
    id: "out-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "最终提示词",
      nodeType: "output",
      inputs: [
        { id: "in-out", name: "Messages", type: "messages" },
      ],
    } as PromptNodeData,
  },
];

const rawInitialEdges: Edge[] = [
  { id: "e-sys-cond",  source: "sys-1",         target: "cond-1",        sourceHandle: "out-sys",         targetHandle: "in-cond" },
  { id: "e-cond-crt",  source: "cond-1",        target: "tpl-creative",  sourceHandle: "branch-creative", targetHandle: "in-tpl1" },
  { id: "e-cond-anl",  source: "cond-1",        target: "tpl-analytic",  sourceHandle: "branch-analytic", targetHandle: "in-tpl2" },
  { id: "e-crt-asm",   source: "tpl-creative",  target: "asm-1",         sourceHandle: "out-tpl1",        targetHandle: "in-asm1" },
  { id: "e-anl-asm",   source: "tpl-analytic",  target: "asm-1",         sourceHandle: "out-tpl2",        targetHandle: "in-asm2" },
  { id: "e-ctx-asm",   source: "ctx-1",         target: "asm-1",         sourceHandle: "out-ctx",         targetHandle: "in-asm3" },
  { id: "e-asm-out",   source: "asm-1",         target: "out-1",         sourceHandle: "out-asm",         targetHandle: "in-out" },
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

  const [menuState, setMenuState] = useState<ContextMenuState>({ type: null, x: 0, y: 0 });
  const [copiedNode, setCopiedNode] = useState<Node | null>(null);
  const isLocked = usePromptDesignStore((state) => state.isCanvasLocked);
  const toast = useToast();

  const { undo, redo, canUndo, canRedo, takeSnapshot } = useFlowHistory(
    nodes,
    edges,
    setNodes,
    setEdges
  );

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
          { id: `branch_true_${Date.now()}`, name: "分支 1", type: "branch" },
          { id: `branch_false_${Date.now()}`, name: "分支 2", type: "branch" },
        ];
      } else if (type === "system" || type === "context") {
        initialOutputs = [{ id: `out_${Date.now()}`, name: "Output", type: "any" }];
      } else if (type === "output") {
        initialInputs = [{ id: `in_${Date.now()}`, name: "Input", type: "any" }];
      } else if (type === "assemble") {
        initialInputs = [
          { id: `in_1_${Date.now()}`, name: "Input 1", type: "any" },
          { id: `in_2_${Date.now()}`, name: "Input 2", type: "any" }
        ];
        initialOutputs = [{ id: `out_${Date.now()}`, name: "Output", type: "any" }];
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
    
    // Copy input and output IDs to be unique
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
