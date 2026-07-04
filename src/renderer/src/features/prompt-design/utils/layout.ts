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

  // 预处理边信息，用于后续精确排序（如把连接到特定 targetHandle 的节点排在前面）
  const edgeInfoMap = new Map<string, Edge>();
  for (const e of edges) {
    // 假设一个节点主要只有一个前向输出边
    if (!edgeInfoMap.has(e.source)) {
      edgeInfoMap.set(e.source, e);
    }
  }

  // 端口定义的默认顺序（如果在 task_container 中）
  const handleOrder = [
    "in-global",
    "in-title",
    "in-goal",
    "in-instructions",
    "in-rules",
    "in-priority",
    "in-depends_on",
    "in-variables",
    "in-resources",
    "in-example",
    "in-output",
    "in-validation",
    "in-notes"
  ];

  // 6. 规整网格坐标分配 (Sugiyama-style Right-to-Left Heuristic)
  const colWidth = 400;   // 横向列宽（增大一点，避免文字和连线拥挤）
  const minSpace = 250;   // 纵向节点之间的最小间距（保证卡片不重叠）
  
  const positionedNodesMap = new Map<string, { x: number; y: number }>();
  const nodeDesiredY = new Map<string, number>();

  if (sortedLayers.length > 0) {
    const maxLayer = sortedLayers[sortedLayers.length - 1];
    
    // 从右向左遍历计算 desiredY，并分配无重叠的实际 Y
    for (let i = sortedLayers.length - 1; i >= 0; i--) {
      const layer = sortedLayers[i];
      const nodesInLayer = layerGroups.get(layer)!;

      // 6.1 根据其在 layer+1 目标的实际 Y 来计算 desiredY
      nodesInLayer.forEach(id => {
        if (layer === maxLayer) {
          nodeDesiredY.set(id, 0); // 最右侧层初始化
          return;
        }
        const targets = adj.get(id) || [];
        if (targets.length === 0) {
          nodeDesiredY.set(id, 0);
        } else {
          // 计算目标节点 Y 的平均值
          let sum = 0;
          let count = 0;
          for (const t of targets) {
            const tPos = positionedNodesMap.get(t);
            if (tPos) {
              sum += tPos.y;
              count++;
            }
          }
          // 对于目标 Y 可以加入一个微小的偏移，确保连接到靠上 handle 的节点 desiredY 稍微偏小
          let y = count > 0 ? sum / count : 0;
          const edge = edgeInfoMap.get(id);
          if (edge && edge.targetHandle) {
             const hIdx = handleOrder.indexOf(edge.targetHandle);
             if (hIdx !== -1) {
                // 微调 Y 值，使靠上的 handle 具有较小的 desiredY
                y += (hIdx - handleOrder.length / 2) * 10;
             }
          }
          nodeDesiredY.set(id, y);
        }
      });

      // 6.2 将本层节点按照 desiredY 排序。如果 desiredY 相同，则根据节点 ID 保证稳定排序。
      nodesInLayer.sort((a, b) => {
        const dyA = nodeDesiredY.get(a) || 0;
        const dyB = nodeDesiredY.get(b) || 0;
        if (Math.abs(dyA - dyB) > 0.1) {
          return dyA - dyB;
        }
        return a.localeCompare(b);
      });

      // 6.3 分配无重叠的实际 Y 坐标 (1D collision resolution)
      const currentYPositions: number[] = nodesInLayer.map(id => nodeDesiredY.get(id) || 0);

      // 如果最右侧，直接按照间距展开
      if (layer === maxLayer) {
        const totalHeight = (nodesInLayer.length - 1) * minSpace;
        let startY = -totalHeight / 2;
        for (let j = 0; j < nodesInLayer.length; j++) {
          currentYPositions[j] = startY;
          startY += minSpace;
        }
      } else {
        // 迭代推挤直到没有冲突
        let hasConflict = true;
        let maxIters = 200;
        while (hasConflict && maxIters > 0) {
          hasConflict = false;
          for (let j = 0; j < nodesInLayer.length - 1; j++) {
            const diff = currentYPositions[j + 1] - currentYPositions[j];
            if (diff < minSpace) {
              hasConflict = true;
              const overlap = minSpace - diff;
              // 按照权重推挤，如果想要保持整体重心不变，各推一半
              currentYPositions[j] -= overlap / 2;
              currentYPositions[j + 1] += overlap / 2;
            }
          }
          maxIters--;
        }
      }

      // 将计算好的实际 Y 存入
      nodesInLayer.forEach((id, j) => {
        const x = layer * colWidth;
        positionedNodesMap.set(id, { x, y: currentYPositions[j] });
      });
    }
  }

  // 居中对齐整体视图
  let minX = Infinity, minY = Infinity;
  positionedNodesMap.forEach(pos => {
    if (pos.x < minX) minX = pos.x;
    if (pos.y < minY) minY = pos.y;
  });
  if (minX === Infinity) minX = 0;
  if (minY === Infinity) minY = 0;

  const layoutedFlowNodes = flowNodes.map((node) => {
    const pos = positionedNodesMap.get(node.id) || { x: 0, y: 0 };
    return {
      ...node,
      position: pos,
    };
  });

  // 7. 独立卡片（注释、变量等）在最左侧靠拢整齐排列
  const indepStartX = minX - 320;
  let currentY = minY;
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
