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

  /* ── 连线卡片：系统角色 ── */
  {
    id: "sys-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "前端专家角色",
      description: "设定 AI 的前端开发角色",
      nodeType: "system",
      content: "你是一个资深的前端开发工程师，精通 {{framework}}，擅长编写安全、优雅且符合现代 UI 规范的登录组件。",
      variables: ["framework"],
      outputs: [
        { id: "out-sys", name: "System", type: "message/system" },
      ],
    } as PromptNodeData,
  },

  /* ── 上下文注入 ── */
  {
    id: "ctx-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "API 接口与设计规范",
      description: "注入后端登录接口文档",
      nodeType: "context",
      outputs: [
        { id: "out-ctx", name: "Context", type: "context" },
      ],
    } as PromptNodeData,
  },

  /* ── 用户任务 ── */
  {
    id: "tpl-task",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "登录表单需求",
      nodeType: "template",
      content: "请实现一个登录页面。要求：\n1. 包含邮箱和密码输入框，并支持表单校验；\n2. 包含“记住我”复选框和“忘记密码”链接；\n3. 提交时调用上下文中提供的登录接口，处理 loading 状态与错误提示。\n\n技术栈限定：{{framework}} + {{ui_library}}",
      variables: ["framework", "ui_library"],
      outputs: [
        { id: "out-task", name: "User Task", type: "message/user" },
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
      description: "按序拼接登录功能提示词",
      nodeType: "assemble",
      inputs: [
        { id: "in-asm-sys", name: "角色设定", type: "message/system" },
        { id: "in-asm-ctx", name: "接口文档", type: "context" },
        { id: "in-asm-task", name: "具体需求", type: "message/user" },
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
  { id: "e-sys-asm",   source: "sys-1",     target: "asm-1", sourceHandle: "out-sys",   targetHandle: "in-asm-sys" },
  { id: "e-ctx-asm",   source: "ctx-1",     target: "asm-1", sourceHandle: "out-ctx",   targetHandle: "in-asm-ctx" },
  { id: "e-task-asm",  source: "tpl-task",  target: "asm-1", sourceHandle: "out-task",  targetHandle: "in-asm-task" },
  { id: "e-asm-out",   source: "asm-1",     target: "out-1", sourceHandle: "out-asm",   targetHandle: "in-out" },
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
