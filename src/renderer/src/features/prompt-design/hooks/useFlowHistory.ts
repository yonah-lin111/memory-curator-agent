import { useCallback, useState } from "react";
import { Node, Edge } from "@xyflow/react";

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY_LENGTH = 50;

export function useFlowHistory(
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void,
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void
) {
  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);

  const takeSnapshot = useCallback(() => {
    setPast((prev) => {
      const newPast = [...prev, { nodes, edges }];
      if (newPast.length > MAX_HISTORY_LENGTH) {
        newPast.shift(); // 移除最旧的记录
      }
      return newPast;
    });
    setFuture([]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setPast(newPast);
    setFuture((prev) => [{ nodes, edges }, ...prev]);
    
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [nodes, edges, past, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast((prev) => [...prev, { nodes, edges }]);
    setFuture(newFuture);
    
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [nodes, edges, future, setNodes, setEdges]);

  return {
    undo,
    redo,
    takeSnapshot,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
