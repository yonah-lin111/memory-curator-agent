import type { Node, Edge } from "@xyflow/react";

/**
 * 极简、方正的矩形拓扑布局算法
 * 
 * 放弃默认 Dagre 的不规则排版，采用标准的最长路径分层（Columnar Grid Layout）算法：
 * 1. 自动计算各连线节点在拓扑流中的最长路径作为其列索引（Layer）。
 * 2. 自动对无入边的输入节点进行反向对齐（如把只连向 Layer 4 的节点，自动拉回至 Layer 3），防止在 Column 0 产生孤岛。
 * 3. 每一列内部的卡片纵向均分对齐，保证整体布局整齐划一、极其方正美观。
 * 4. 独立卡片（变量、注释等）统一收纳在左侧侧边，不干扰主流程。
 */
export const getLayoutedElements = (nodes: Node[], edges: Edge[], _direction = "LR") => {
  const independentTypes = ["comment", "variable", "group"];
  
  // 1. 区分流程节点与独立节点
  const flowNodes = nodes.filter(n => !independentTypes.includes(n.data?.nodeType as string));
  const independentNodes = nodes.filter(n => independentTypes.includes(n.data?.nodeType as string));

  if (flowNodes.length === 0) {
    return { nodes, edges };
  }

  // 2. 建立邻接表与入度表
  const flowNodeIds = new Set(flowNodes.map(n => n.id));
  const adj = new Map<string, string[]>();
  const revAdj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const n of flowNodes) {
    adj.set(n.id, []);
    revAdj.set(n.id, []);
    inDegree.set(n.id, 0);
  }

  for (const e of edges) {
    if (flowNodeIds.has(e.source) && flowNodeIds.has(e.target)) {
      adj.get(e.source)!.push(e.target);
      revAdj.get(e.target)!.push(e.source);
      inDegree.set(e.target, inDegree.get(e.target)! + 1);
    }
  }

  // 3. 计算前向最长路径层级
  const layers = new Map<string, number>();
  const queue: string[] = [];
  
  for (const n of flowNodes) {
    if (inDegree.get(n.id) === 0) {
      layers.set(n.id, 0);
      queue.push(n.id);
    }
  }

  const tempInDegree = new Map(inDegree);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currLayer = layers.get(curr) || 0;
    
    for (const next of adj.get(curr) || []) {
      const nextLayer = Math.max(layers.get(next) || 0, currLayer + 1);
      layers.set(next, nextLayer);
      
      tempInDegree.set(next, tempInDegree.get(next)! - 1);
      if (tempInDegree.get(next) === 0) {
        queue.push(next);
      }
    }
  }

  // 补全由于循环或异常未分层的节点
  for (const n of flowNodes) {
    if (!layers.has(n.id)) {
      layers.set(n.id, 0);
    }
  }

  // 4. 反向推导，对齐无入边的叶子/输入节点，使其向右靠拢贴近目标节点
  for (const n of flowNodes) {
    if (inDegree.get(n.id) === 0) {
      const targets = adj.get(n.id) || [];
      if (targets.length > 0) {
        const minTargetLayer = Math.min(...targets.map(t => layers.get(t) || 0));
        if (minTargetLayer > 0) {
          layers.set(n.id, minTargetLayer - 1);
        }
      }
    }
  }

  // 5. 按层级对节点进行分组
  const layerGroups = new Map<number, string[]>();
  for (const [id, layer] of layers.entries()) {
    if (!layerGroups.has(layer)) {
      layerGroups.set(layer, []);
    }
    layerGroups.get(layer)!.push(id);
  }

  const sortedLayers = Array.from(layerGroups.keys()).sort((a, b) => a - b);

  // 6. 规整网格坐标分配
  const colWidth = 320;   // 横向列宽（保证卡片间距适中）
  const rowHeight = 260;  // 纵向行高（预留卡片内容展示高度）
  
  const positionedNodesMap = new Map<string, { x: number; y: number }>();
  let minX = 0;
  let minY = 0;

  sortedLayers.forEach((layer) => {
    const nodeIds = layerGroups.get(layer)!;
    // 排序以保持稳定的纵向展现顺序
    nodeIds.sort((a, b) => a.localeCompare(b));
    
    const numNodes = nodeIds.length;
    nodeIds.forEach((id, idx) => {
      const x = layer * colWidth;
      // 每一列节点纵向居中对齐
      const y = (idx - (numNodes - 1) / 2) * rowHeight;
      positionedNodesMap.set(id, { x, y });
      
      if (x < minX) minX = x;
      if (y < minY) minY = y;
    });
  });

  const layoutedFlowNodes = flowNodes.map((node) => {
    const pos = positionedNodesMap.get(node.id) || { x: 0, y: 0 };
    return {
      ...node,
      position: pos,
    };
  });

  // 7. 独立卡片（注释、变量等）在最左侧靠拢整齐排列
  const indepStartX = minX - 280;
  let currentY = minY - 50;
  const indepNodeHeight = 120;

  const layoutedIndepNodes = independentNodes.map((node) => {
    const positionedNode = {
      ...node,
      position: {
        x: indepStartX,
        y: currentY,
      },
    };
    currentY += indepNodeHeight + 20;
    return positionedNode;
  });

  const layoutedNodes = [...layoutedIndepNodes, ...layoutedFlowNodes];

  return { nodes: layoutedNodes, edges };
};
