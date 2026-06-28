import * as dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

const nodeWidth = 340; // 预估宽度
const nodeHeight = 250; // 预估平均高度
const indepNodeHeight = 120; // 独立卡片预估高度

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "LR") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // 设置图的排版方向和节点间距
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 80, // 同一层级节点之间的间距
    ranksep: 120, // 层级之间的间距
  });

  const independentTypes = ["comment", "variable", "group"];
  const flowNodes: Node[] = [];
  const independentNodes: Node[] = [];

  nodes.forEach((node) => {
    const isIndependent = independentTypes.includes(node.data?.nodeType as string);
    if (isIndependent) {
      independentNodes.push(node);
    } else {
      flowNodes.push(node);
      dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    }
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  let minX = Infinity;
  let minY = Infinity;

  const layoutedFlowNodes = flowNodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const x = nodeWithPosition.x - nodeWidth / 2;
    const y = nodeWithPosition.y - (dagreGraph.node(node.id).height / 2);
    
    if (x < minX) minX = x;
    if (y < minY) minY = y;

    return {
      ...node,
      position: { x, y },
    };
  });

  // 如果没有流节点，就设个默认原点
  if (minX === Infinity) minX = 0;
  if (minY === Infinity) minY = 0;

  // 独立卡片排在流节点左侧，Y 轴对齐顶端，纵向堆叠
  const indepStartX = minX - nodeWidth - 120; // 左侧间距 120
  let currentY = minY;

  const layoutedIndepNodes = independentNodes.map((node) => {
    const positionedNode = {
      ...node,
      position: {
        x: indepStartX,
        y: currentY,
      },
    };
    currentY += indepNodeHeight + 40; // 纵向间距 40
    return positionedNode;
  });

  const layoutedNodes = [...layoutedIndepNodes, ...layoutedFlowNodes];

  return { nodes: layoutedNodes, edges };
};
