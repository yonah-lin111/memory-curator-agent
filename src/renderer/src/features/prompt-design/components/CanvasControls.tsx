import { useCallback } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import { ZoomIn, ZoomOut, Maximize, Workflow, Undo2, Redo2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { getLayoutedElements } from "../utils/layout";

export interface CanvasControlsProps {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  takeSnapshot: () => void;
}

export const CanvasControls = ({
  undo,
  redo,
  canUndo,
  canRedo,
  takeSnapshot,
}: CanvasControlsProps) => {
  const { zoomIn, zoomOut, fitView, getNodes, getEdges, setNodes, setEdges } = useReactFlow();

  const onLayout = useCallback(() => {
    takeSnapshot();
    const nodes = getNodes();
    const edges = getEdges();
    
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      "LR"
    );

    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [getNodes, getEdges, setNodes, setEdges, takeSnapshot]);

  return (
    <Panel position="bottom-left" className="flex flex-row items-center gap-1 m-4 bg-[#212121] p-1 border border-white/10 rounded-md shadow-lg">
      <Tooltip content="自动整理排版" placement="top">
        <IconButton
          iconOnly
          onClick={onLayout}
        >
          <Workflow className="w-4 h-4" />
        </IconButton>
      </Tooltip>
      <Tooltip content="放大" placement="top">
        <IconButton
          iconOnly
          onClick={() => zoomIn({ duration: 300 })}
        >
          <ZoomIn className="w-4 h-4" />
        </IconButton>
      </Tooltip>
      <Tooltip content="缩小" placement="top">
        <IconButton
          iconOnly
          onClick={() => zoomOut({ duration: 300 })}
        >
          <ZoomOut className="w-4 h-4" />
        </IconButton>
      </Tooltip>
      <Tooltip content="适应视图" placement="top">
        <IconButton
          iconOnly
          onClick={() => fitView({ duration: 300, padding: 0.2 })}
        >
          <Maximize className="w-4 h-4" />
        </IconButton>
      </Tooltip>
      <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
      <Tooltip content="撤销" placement="top">
        <IconButton
          iconOnly
          onClick={undo}
          disabled={!canUndo}
        >
          <Undo2 className="w-4 h-4" />
        </IconButton>
      </Tooltip>
      <Tooltip content="重做" placement="top">
        <IconButton
          iconOnly
          onClick={redo}
          disabled={!canRedo}
        >
          <Redo2 className="w-4 h-4" />
        </IconButton>
      </Tooltip>
    </Panel>
  );
};
