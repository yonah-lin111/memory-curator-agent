import { useCallback } from "react";
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  NodeTypes
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LangflowNode, type LangflowNodeData } from "./LangflowNode";

const nodeTypes: NodeTypes = {
  langflowNode: LangflowNode,
};

const initialNodes = [
  {
    id: "node-1",
    type: "langflowNode",
    position: { x: 50, y: 50 },
    data: {
      title: "Chat OpenAI",
      description: "OpenAI 聊天模型。支持 GPT-3.5, GPT-4 等各种 OpenAI 提供的大模型。",
      icon: "Bot",
      nodeType: "model",
      inputs: [
        { id: "input-api-key", name: "API Key", type: "string" },
        { id: "input-prompt", name: "Prompt", type: "Prompt" },
      ],
      outputs: [
        { id: "output-text", name: "Text", type: "string" },
      ],
    } as LangflowNodeData,
  },
  {
    id: "node-2",
    type: "langflowNode",
    position: { x: -300, y: 50 },
    data: {
      title: "Prompt Template",
      description: "创建一个带有变量的提示词模板。",
      icon: "FileText",
      nodeType: "prompt",
      inputs: [
        { id: "input-topic", name: "Topic", type: "string" },
      ],
      outputs: [
        { id: "output-prompt", name: "Prompt", type: "Prompt" },
      ],
    } as LangflowNodeData,
  },
  {
    id: "node-3",
    type: "langflowNode",
    position: { x: 450, y: 100 },
    data: {
      title: "Agent Tool",
      description: "执行外部操作的智能体工具。",
      icon: "Wrench",
      nodeType: "tool",
      inputs: [
        { id: "input-text", name: "Input Text", type: "string" },
      ],
      outputs: [],
    } as LangflowNodeData,
  }
];

const initialEdges: Edge[] = [
  { 
    id: "e1-2", 
    source: "node-2", 
    target: "node-1", 
    sourceHandle: "output-prompt", 
    targetHandle: "input-prompt",
    animated: true,
    style: { stroke: '#818cf8', strokeWidth: 2 }
  },
  { 
    id: "e2-3", 
    source: "node-1", 
    target: "node-3", 
    sourceHandle: "output-text", 
    targetHandle: "input-text",
    style: { stroke: '#818cf8', strokeWidth: 2 }
  },
];

export const LangflowCanvas = () => {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: { stroke: '#818cf8', strokeWidth: 2 }
    } as Edge, eds)),
    [setEdges],
  );

  return (
    <div className="h-full w-full bg-[#111111] rounded-[6px] overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        colorMode="dark"
        minZoom={0.1}
        maxZoom={4}
      >
        <Background color="#444" gap={20} size={1} />
        <Controls 
          className="!bg-[#212121] !border-white/10 !fill-white/80" 
          showInteractive={false}
        />
        <MiniMap 
          nodeColor={(n) => {
            if (n.data?.nodeType === 'model') return '#10b981';
            if (n.data?.nodeType === 'prompt') return '#f59e0b';
            if (n.data?.nodeType === 'tool') return '#3b82f6';
            return '#6366f1';
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
          className="!bg-[#212121] !border-white/10"
        />
      </ReactFlow>
    </div>
  );
};
