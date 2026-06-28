import { useCallback } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Workflow,
  Undo2,
  Redo2,
  Lock,
  Unlock,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { getLayoutedElements } from "../utils/layout";
import { usePromptDesignStore } from "../store/promptDesignStore";

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
  const toast = useToast();
  const { zoomIn, zoomOut, fitView, getNodes, getEdges, setNodes, setEdges } =
    useReactFlow();
  const isLocked = usePromptDesignStore((state) => state.isCanvasLocked);
  const setIsLocked = usePromptDesignStore((state) => state.setIsCanvasLocked);

  const onLayout = useCallback(() => {
    if (isLocked) {
      toast.warning("画布已锁定，无法自动排版");
      return;
    }
    takeSnapshot();
    const nodes = getNodes();
    const edges = getEdges();

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      "LR",
    );

    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
    toast.success("排版已完成");
  }, [getNodes, getEdges, setNodes, setEdges, takeSnapshot, toast, isLocked]);

  return (
    <Panel
      position="bottom-left"
      className="flex flex-row items-center gap-1 m-4 bg-[#212121] p-1 border border-white/10 rounded-md shadow-lg"
    >
      <Tooltip content="放大" placement="top">
        <IconButton iconOnly onClick={() => zoomIn({ duration: 300 })}>
          <ZoomIn className="w-4 h-4" />
        </IconButton>
      </Tooltip>
      <Tooltip content="缩小" placement="top">
        <IconButton iconOnly onClick={() => zoomOut({ duration: 300 })}>
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

      <Tooltip content="自动整理排版" placement="top">
        <IconButton iconOnly onClick={onLayout} disabled={isLocked}>
          <Workflow className="w-4 h-4" />
        </IconButton>
      </Tooltip>
      <Tooltip content={isLocked ? "解锁画布" : "锁定画布"} placement="top">
        <IconButton
          iconOnly
          onClick={() => {
            setIsLocked(!isLocked);
            toast.info(isLocked ? "画布已解锁" : "画布已锁定");
          }}
          className={isLocked ? "text-rose-400 bg-white/5 hover:bg-white/10" : ""}
        >
          {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </IconButton>
      </Tooltip>

      <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

      <Tooltip content="撤销" placement="top">
        <IconButton iconOnly onClick={undo} disabled={!canUndo || isLocked}>
          <Undo2 className="w-4 h-4" />
        </IconButton>
      </Tooltip>
      <Tooltip content="重做" placement="top">
        <IconButton iconOnly onClick={redo} disabled={!canRedo || isLocked}>
          <Redo2 className="w-4 h-4" />
        </IconButton>
      </Tooltip>
    </Panel>
  );
};
