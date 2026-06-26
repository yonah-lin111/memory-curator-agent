import type React from "react";
import { useState } from "react";
import {
  ReactFlow,
  Background,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
  type OnConnectEnd,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PromptCard } from "./PromptCard";

// 定义卡片节点数据类型
export interface PromptNodeData extends Record<string, unknown> {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: number;
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
      />
    </div>
  );
};

const CustomConditionEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [isEditing, setIsEditing] = useState(false);
  // 对于这里，本地状态更新只修改了组件自己，可能需要一种方式通知父级。这里暂且保留本地状态。
  const [condition, setCondition] = useState((data?.condition as string) || "");

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasCondition) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    // 这里如果需要通知父组件，可以从 data 中传入一个 onChange 回调
    if (typeof data?.onChange === "function") {
      data.onChange(id, condition);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.stopPropagation();
      handleBlur();
    }
  };

  const hasCondition = condition.trim().length > 0;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className={`nodrag nopan z-50 flex items-center justify-center ${!hasCondition && !isEditing ? 'w-16 h-8' : ''}`}
        >
          {isEditing ? (
            <input
              autoFocus
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="bg-[#212121] border border-white/20 text-white text-[12px] px-2 py-1 rounded-[6px] outline-none w-24 text-center transition-all backdrop-blur-md focus:border-white/40"
              placeholder="输入条件..."
            />
          ) : hasCondition ? (
            <div
              className={`
                group relative cursor-pointer px-2 py-0.5 rounded-[4px] text-[12px] transition-colors duration-200
                bg-[#212121] text-white/90 border border-white/20 hover:border-white/40 hover:bg-[#2a2a2a]
              `}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
            >
              <div className="flex items-center">
                {condition}
              </div>
            </div>
          ) : (
            <div
              className="absolute inset-0 cursor-pointer"
              onDoubleClick={handleDoubleClick}
              title="双击添加条件"
            />
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const nodeTypes = {
  promptCard: CustomPromptNode,
};

const edgeTypes = {
  condition: CustomConditionEdge,
};

interface PromptCanvasProps {
  nodes: Node<PromptNodeData>[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onConnectEnd?: OnConnectEnd;
  onPaneDoubleClick?: (event: React.MouseEvent) => void;
  onSelectionChange?: (params: { nodes: Node[]; edges: Edge[] }) => void;
}

export const PromptCanvas = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onConnectEnd,
  onPaneDoubleClick,
  onSelectionChange,
}: PromptCanvasProps) => {
  return (
    <div className="absolute inset-0 bg-[#151515]" onDoubleClick={onPaneDoubleClick}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid={true}
        snapGrid={[20, 20]}
        defaultEdgeOptions={{
          style: { stroke: "rgba(255, 255, 255, 0.4)", strokeWidth: 2 },
          type: "condition",
          focusable: true,
          deletable: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "rgba(255, 255, 255, 0.4)",
          },
        }}
        proOptions={{ hideAttribution: true }}
        connectionRadius={40}
        zoomOnDoubleClick={false}
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
