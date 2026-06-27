import * as dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

const nodeWidth = 340; // 宽 80 = 320px + margin
const nodeHeight = 250; // 预估平均高度

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "LR") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // 设置图的排版方向和节点间距
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 80, // 同一层级节点之间的间距
    ranksep: 120, // 层级之间的间距
  });

  nodes.forEach((node) => {
    // 根据是否为独立节点（没有输入输出的节点如 comment/variable）稍微调整预估高度
    const isIndependent = ["comment", "variable", "group"].includes(node.data?.nodeType as string);
    const h = isIndependent ? 120 : nodeHeight;
    dagreGraph.setNode(node.id, { width: nodeWidth, height: h });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - (dagreGraph.node(node.id).height / 2),
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};
