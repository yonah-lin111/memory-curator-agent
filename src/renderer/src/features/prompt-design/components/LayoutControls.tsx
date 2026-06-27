import { useCallback } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import { LayoutDashboard } from "lucide-react";
import { getLayoutedElements } from "../utils/layout";

export const LayoutControls = () => {
  const { getNodes, getEdges, setNodes, setEdges, fitView } = useReactFlow();

  const onLayout = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    
    // 我们传入 TB (Top to Bottom) 或者 LR (Left to Right) 均可
    // LR 对于提示词流程比较符合直觉
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      "LR"
    );

    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);

    // 使用 requestAnimationFrame 确保在 React 渲染更新节点位置后再 fitView
    window.requestAnimationFrame(() => {
      fitView({ duration: 800, padding: 0.2 });
    });
  }, [getNodes, getEdges, setNodes, setEdges, fitView]);

  return (
    <Panel position="top-right" className="mr-14">
      <button
        onClick={onLayout}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#212121] border border-white/10 rounded-md text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors shadow-lg"
        title="自动整理排版"
      >
        <LayoutDashboard className="w-4 h-4" />
        <span>自动整理排版</span>
      </button>
    </Panel>
  );
};
