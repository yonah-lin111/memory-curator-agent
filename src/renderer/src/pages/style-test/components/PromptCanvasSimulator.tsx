import type React from "react";
import { useCallback, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  ReactFlow,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
  type OnConnectEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PromptCard } from "./PromptCard";

// 定义卡片节点数据类型
interface PromptNodeData extends Record<string, unknown> {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: number;
  onDelete: (id: string) => void;
  onAddCard: (sourceId: string) => void;
}

// 封装自定义节点组件
const CustomPromptNode = ({ data, selected }: { data: PromptNodeData; selected: boolean }) => {
  return (
    <div className={selected ? "ring-2 ring-white/30 rounded-[6px]" : ""}>
      <PromptCard
        id={data.id}
        title={data.title}
        content={data.content}
        tags={data.tags}
        updatedAt={data.updatedAt}
        isSelected={selected}
        onDelete={() => data.onDelete(data.id)}
        onAddCard={() => data.onAddCard(data.id)}
      />
    </div>
  );
};

const nodeTypes = {
  promptCard: CustomPromptNode,
};

const initialNodes: Node<PromptNodeData>[] = [
  {
    id: "card-1",
    type: "promptCard",
    position: { x: 100, y: 100 },
    data: {
      id: "card-1",
      title: "判断 SQL 注入",
      content:
        "判断以下代码是否存在 SQL 注入风险：\n\n```sql\nSELECT * FROM users WHERE id = ${userId}\n```\n\n请回答「是」或「否」，并附简要说明。",
      tags: ["安全", "SQL"],
      updatedAt: Date.now(),
      onDelete: () => {},
      onAddCard: () => {},
    },
  },
];

const initialEdges: Edge[] = [];

const Flow = () => {
  const [nodes, setNodes] = useState<Node<PromptNodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const handleDeleteCard = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, []);

  const handleAddCard = useCallback(
    (sourceId?: string) => {
      const newId = `card-${Date.now()}`;
      let newX = 200;
      let newY = 200;

      if (typeof sourceId === "string") {
        const sourceNode = nodes.find((n) => n.id === sourceId);
        if (sourceNode) {
          newX = sourceNode.position.x + 320;
          newY = sourceNode.position.y;
        }
      }

      const newNode: Node<PromptNodeData> = {
        id: newId,
        type: "promptCard",
        position: { x: newX, y: newY },
        data: {
          id: newId,
          title: `新建节点 ${nodes.length + 1}`,
          content: "在这里输入提示词内容...",
          tags: ["新建"],
          updatedAt: Date.now(),
          onDelete: handleDeleteCard,
          onAddCard: handleAddCard,
        },
      };

      setNodes((nds) => [...nds, newNode]);

      if (typeof sourceId === "string") {
        const newEdge: Edge = {
          id: `e-${sourceId}-${newId}`,
          source: sourceId,
          target: newId,
          type: "smoothstep",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "rgba(255, 255, 255, 0.4)",
          },
        };
        setEdges((eds) => addEdge(newEdge, eds));
      }
    },
    [nodes, handleDeleteCard]
  );

  // 绑定上下文给 initialNodes（解决初始节点没绑函数的问题）
  useState(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          onDelete: handleDeleteCard,
          onAddCard: handleAddCard,
        },
      }))
    );
  });

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<PromptNodeData>>[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params: Connection) => {
      // 防止自己连接自己
      if (params.source === params.target) {
        return;
      }
      setEdges((eds) => addEdge({
        ...params,
        type: "smoothstep",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "rgba(255, 255, 255, 0.4)",
        },
      }, eds));
    },
    []
  );

  const { screenToFlowPosition } = useReactFlow();

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (!connectionState.isValid && connectionState.fromNode) {
        // We only care if we ended up on a valid drop target (the card itself, not a handle)
        // Since React Flow natively handles connections to actual handles, this is for the "body" of the card
        
        let clientX = 0;
        let clientY = 0;
        if ("clientX" in event) {
          clientX = (event as MouseEvent).clientX;
          clientY = (event as MouseEvent).clientY;
        } else if ("changedTouches" in event && (event as TouchEvent).changedTouches.length > 0) {
          clientX = (event as TouchEvent).changedTouches[0].clientX;
          clientY = (event as TouchEvent).changedTouches[0].clientY;
        }

        const targetIsPane = (event.target as Element).classList.contains('react-flow__pane');
        if (targetIsPane) {
          // You dropped it on the background, maybe we could create a new node here if needed, but not required by prompt
          return;
        }
        
        // Find if we dropped on a node's DOM element
        // The PromptCard has w-[280px]
        const elementBelow = document.elementFromPoint(clientX, clientY);
        if (!elementBelow) return;

        // Try to find the react-flow__node parent
        const flowNodeElement = elementBelow.closest('.react-flow__node');
        
        if (flowNodeElement) {
          const targetNodeId = flowNodeElement.getAttribute('data-id');
          if (targetNodeId && targetNodeId !== connectionState.fromNode.id) {
            
            // It dropped on a node, but not on a specific handle (otherwise it would be valid)
            // We need to calculate which target handle is closest to the drop point
            const targetNode = nodes.find(n => n.id === targetNodeId);
            const sourceNode = nodes.find(n => n.id === connectionState.fromNode?.id);
            
            if (targetNode && sourceNode) {
              const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });
              
              // Simplistic closest handle logic: 
              // We compare dx/dy between source and target centers to guess the best handle
              // A better way is checking the drop point relative to the target node's bounding box
              
              const targetX = targetNode.position.x;
              const targetY = targetNode.position.y;
              
              // Node width is ~280, height is ~140 (rough estimation)
              const centerX = targetX + 140;
              const centerY = targetY + 70;
              
              const dx = flowPosition.x - centerX;
              const dy = flowPosition.y - centerY;
              
              let targetHandle = 'left';
              if (Math.abs(dx) > Math.abs(dy)) {
                targetHandle = dx > 0 ? 'right' : 'left';
              } else {
                targetHandle = dy > 0 ? 'bottom' : 'top';
              }
              
              // We also need the source handle
              const sourceHandle = connectionState.fromHandle?.id || 'right';

              setEdges((eds) => addEdge({
                id: `e-${sourceNode.id}-${sourceHandle}-${targetNode.id}-${targetHandle}`,
                source: sourceNode.id,
                sourceHandle: sourceHandle,
                target: targetNode.id,
                targetHandle: targetHandle,
                type: "smoothstep",
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: "rgba(255, 255, 255, 0.4)",
                },
              }, eds));
            }
          }
        }
      }
    },
    [nodes, screenToFlowPosition]
  );

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      // 阻止事件冒泡到画布
      event.stopPropagation();
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    []
  );

  const onDoubleClick = useCallback(
    (_event: React.MouseEvent) => {
      // 移除双击空白区域创建新卡片的功能
    },
    []
  );

  return (
    <div className="absolute inset-0 bg-[#151515]" onDoubleClick={onDoubleClick}>
      {/* 顶部工具栏 */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 p-1.5 rounded-[8px] bg-[#212121]/80 backdrop-blur border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          onClick={() => handleAddCard()}
        >
          <Plus size={16} />
          <span>添加卡片</span>
        </button>
        <div className="w-[1px] h-4 bg-white/10 mx-1" />
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          onClick={handleClearAll}
        >
          <Trash2 size={16} />
          <span>清空画布</span>
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid={true}
        snapGrid={[20, 20]}
        defaultEdgeOptions={{
          style: { stroke: "rgba(255, 255, 255, 0.4)", strokeWidth: 2 },
          type: "smoothstep",
          focusable: true,
          deletable: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "rgba(255, 255, 255, 0.4)",
          },
        }}
        proOptions={{ hideAttribution: true }}
        connectionRadius={40} // 适中的吸附半径
        zoomOnDoubleClick={false}
        onConnectEnd={onConnectEnd}
      >
        <Background
          color="rgba(255, 255, 255, 0.1)"
          gap={20}
          size={1}
        />
      </ReactFlow>
    </div>
  );
};

export const PromptCanvasSimulator = () => (
  <ReactFlowProvider>
    <Flow />
  </ReactFlowProvider>
);
