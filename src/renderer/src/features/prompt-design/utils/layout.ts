import * as dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

const nodeWidth = 280; // 预估宽度，因为包含了内容稍微宽一点，增大宽度边界
const nodeHeight = 220; // 流节点预估平均高度（考虑到有很多输入输出和内容），增大高度边界
const indepNodeHeight = 100; // 独立卡片预估高度

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "LR") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 设置图的排版方向和节点间距
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 80, // 同一层级节点之间的间距（竖向间距）- 增大以防止连线穿过节点
    ranksep: 200, // 层级之间的间距（横向间距）- 增大以为连线提供空间
    edgesep: 50, // 边与边之间的间距
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
  const indepStartX = minX - nodeWidth - 60; // 左侧间距 60
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
