import * as dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

const nodeWidth = 260; // 卡片真实宽度约 240px，预留一点边距
const nodeHeight = 160; // 流节点预估平均高度（适当调小让占位更加紧凑）
const indepNodeHeight = 100; // 独立卡片预估高度

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "LR") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 设置图的排版方向和节点间距
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 40, // 同一层级节点之间的间距（竖向间距）- 让占位更加紧凑
    ranksep: 80, // 层级之间的间距（横向间距）- 缩小以让连接线更短
    edgesep: 20, // 边与边之间的间距
    ranker: "network-simplex", // 使用 network-simplex 算法，通常能减少交叉
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
  const indepStartX = minX - nodeWidth - 40; // 缩小左侧间距让布局紧凑
  let currentY = minY;

  const layoutedIndepNodes = independentNodes.map((node) => {
    const positionedNode = {
      ...node,
      position: {
        x: indepStartX,
        y: currentY,
      },
    };
    currentY += indepNodeHeight + 20; // 缩小纵向间距
    return positionedNode;
  });

  const layoutedNodes = [...layoutedIndepNodes, ...layoutedFlowNodes];

  return { nodes: layoutedNodes, edges };
};
