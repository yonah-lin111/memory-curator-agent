import type { Node, Edge } from "@xyflow/react";

/**
 * 极简、方正的矩形拓扑布局算法
 * 
 * 包含：
 * 1. 自动根据子卡片数量计算容器 (Task) 的自适应高度。
 * 2. 自动布局容器内部的子卡片。
 * 3. 对全局流采用 Sugiyama 启发式重心对齐 (Right-to-Left Heuristic)，保证连线顺畅。
 */
export const getLayoutedElements = (nodes: Node[], edges: Edge[], _direction = "LR") => {
  const independentTypes = ["comment", "variable", "group"];
  
  // 1. 区分流程节点、独立节点与子节点
  const childNodes = nodes.filter(n => n.parentId);
  const rootNodes = nodes.filter(n => !n.parentId);
  
  const flowNodes = rootNodes.filter(n => !independentTypes.includes(n.data?.nodeType as string));
  const independentNodes = rootNodes.filter(n => independentTypes.includes(n.data?.nodeType as string));

  if (flowNodes.length === 0) {
    return { nodes, edges };
  }

  // --- 1. 子节点内部布局 (Task Container Auto-sizing) ---
  const parentMap = new Map<string, Node[]>();
  childNodes.forEach(n => {
    if (!parentMap.has(n.parentId!)) parentMap.set(n.parentId!, []);
    parentMap.get(n.parentId!)!.push(n);
  });

  const layoutedChildNodes: Node[] = [];
  const parentSizes = new Map<string, { w: number, h: number }>();
  
  const CHILD_WIDTH = 210; // 卡片宽
  const COL_GAP = 24; // 列间距
  const CONTAINER_WIDTH = 500; // 容器宽度
  const EXTRA_CONTAINER_MARGIN = 60; // 容器底部留白

  // 任务卡片标准排序
  const taskFieldOrder = [
    "task_title",
    "task_goal",
    "task_priority",
    "task_depends_on",
    "task_instructions",
    "task_rules",
    "task_variables",
    "task_resources",
    "task_example",
    "task_output",
    "task_validation",
    "task_notes"
  ];

  // 动态估算子卡片高度
  const getChildHeightEstimate = (child: Node) => {
    let baseHeight = 85; // 标题与边距基础高度
    if (child.data?.content) {
      const text = child.data.content as string;
      const lines = text.split('\n').length;
      const chars = text.length;
      // 假设 210px 宽度约能容纳 15 个中文字符
      const wrappedLines = Math.ceil(chars / 15);
      const totalLines = Math.max(lines, wrappedLines);
      baseHeight += totalLines * 18 + 24; // 文本行高估算
    }
    return Math.max(130, baseHeight);
  };

  for (const [pId, children] of parentMap.entries()) {
    // 按照指定逻辑顺序排列
    children.sort((a, b) => {
      const typeA = a.data?.nodeType as string;
      const typeB = b.data?.nodeType as string;
      let idxA = taskFieldOrder.indexOf(typeA);
      let idxB = taskFieldOrder.indexOf(typeB);
      if (idxA === -1) idxA = 99;
      if (idxB === -1) idxB = 99;
      return idxA - idxB;
    });
    
    // 双列瀑布流布局算法
    const leftColX = (CONTAINER_WIDTH - (CHILD_WIDTH * 2 + COL_GAP)) / 2;
    const rightColX = leftColX + CHILD_WIDTH + COL_GAP;
    
    let leftY = 80;
    let rightY = 80;
    
    children.forEach((child) => {
       // 瀑布流：总是放入当前高度较小的一列
       const isLeft = leftY <= rightY;
       const x = isLeft ? leftColX : rightColX;
       const y = isLeft ? leftY : rightY;
       
       layoutedChildNodes.push({
         ...child,
         position: { x, y }
       });
       
       const childH = getChildHeightEstimate(child) + COL_GAP;
       if (isLeft) {
         leftY += childH;
       } else {
         rightY += childH;
       }
    });

    const maxColY = Math.max(leftY, rightY);
    const containerHeight = Math.max(200, maxColY); 
    parentSizes.set(pId, { w: CONTAINER_WIDTH, h: containerHeight + EXTRA_CONTAINER_MARGIN });
  }

  // 覆盖更新包含子节点的容器宽高
  const flowNodesWithSize = flowNodes.map(n => {
    if (parentSizes.has(n.id)) {
       return {
         ...n,
         style: { ...n.style, width: parentSizes.get(n.id)!.w, height: parentSizes.get(n.id)!.h }
       };
    }
    return n;
  });

  // --- 2. 建立邻接表与入度表 (基于更新后包含 size 的根节点) ---
  const flowNodeIds = new Set(flowNodesWithSize.map(n => n.id));
  const adj = new Map<string, string[]>();
  const revAdj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const n of flowNodesWithSize) {
    adj.set(n.id, []);
    revAdj.set(n.id, []);
    inDegree.set(n.id, 0);
  }

  for (const e of edges) {
    if (flowNodeIds.has(e.source) && flowNodeIds.has(e.target)) {
      // 允许反向连线（如 c-format 传递给 c-compiler 但希望 c-format 排在后面）
      if (e.data && e.data.isBackward) {
        adj.get(e.target)!.push(e.source);
        revAdj.get(e.source)!.push(e.target);
        inDegree.set(e.source, inDegree.get(e.source)! + 1);
      } else {
        adj.get(e.source)!.push(e.target);
        revAdj.get(e.target)!.push(e.source);
        inDegree.set(e.target, inDegree.get(e.target)! + 1);
      }
    }
  }

  // --- 3. 计算前向最长路径层级 ---
  const layers = new Map<string, number>();
  const queue: string[] = [];
  
  for (const n of flowNodesWithSize) {
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

  for (const n of flowNodesWithSize) {
    if (!layers.has(n.id)) {
      layers.set(n.id, 0);
    }
  }

  // --- 4. 反向推导，对齐无入边的叶子节点 ---
  for (const n of flowNodesWithSize) {
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

  // --- 5. 按层级对节点进行分组 ---
  const layerGroups = new Map<number, string[]>();
  for (const [id, layer] of layers.entries()) {
    if (!layerGroups.has(layer)) {
      layerGroups.set(layer, []);
    }
    layerGroups.get(layer)!.push(id);
  }

  const sortedLayers = Array.from(layerGroups.keys()).sort((a, b) => a - b);

  const edgeInfoMap = new Map<string, Edge>();
  for (const e of edges) {
    if (!edgeInfoMap.has(e.source)) {
      edgeInfoMap.set(e.source, e);
    }
  }

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

  // --- 6. 规整网格坐标分配 (考虑节点实际高度) ---
  const colWidth = 560;   // 横向列宽 (增大防止容器与下一列重叠)
  const minGap = 160;      // 显著增大纵向节点之间的最小视觉间距，防止重叠
  
  const positionedNodesMap = new Map<string, { x: number; y: number }>();
  const nodeDesiredY = new Map<string, number>();

  const getNodeHeight = (id: string) => {
    if (parentSizes.has(id)) return parentSizes.get(id)!.h; // 这个 h 已经包含了 EXTRA_CONTAINER_MARGIN
    
    // 如果是普通节点，根据其内部的 input / output 数量做一个动态估算
    const node = flowNodesWithSize.find(n => n.id === id);
    let estimatedH = 200;
    if (node && node.data) {
      const data = node.data as any;
      const portsCount = (data.inputs?.length || 0) + (data.outputs?.length || 0);
      if (portsCount > 0) {
        estimatedH = Math.max(200, 100 + portsCount * 40);
      }
    }
    return estimatedH;
  };

  if (sortedLayers.length > 0) {
    const maxLayer = sortedLayers[sortedLayers.length - 1];
    
    for (let i = sortedLayers.length - 1; i >= 0; i--) {
      const layer = sortedLayers[i];
      const nodesInLayer = layerGroups.get(layer)!;

      // 6.1 计算 desiredY
      nodesInLayer.forEach(id => {
        if (layer === maxLayer) {
          nodeDesiredY.set(id, 0);
          return;
        }
        const targets = adj.get(id) || [];
        if (targets.length === 0) {
          nodeDesiredY.set(id, 0);
        } else {
          let sum = 0;
          let count = 0;
          for (const t of targets) {
            const tPos = positionedNodesMap.get(t);
            if (tPos) {
              // 计算连线目标的中心点 Y 坐标作为重心
              const tHeight = getNodeHeight(t);
              sum += tPos.y + tHeight / 2;
              count++;
            }
          }
          let y = count > 0 ? sum / count : 0;
          const edge = edgeInfoMap.get(id);
          if (edge && edge.targetHandle) {
             const hIdx = handleOrder.indexOf(edge.targetHandle);
             if (hIdx !== -1) {
                y += (hIdx - handleOrder.length / 2) * 10;
             }
          }
          nodeDesiredY.set(id, y - getNodeHeight(id) / 2); // 转回 top Y
        }
      });

      nodesInLayer.sort((a, b) => {
        const dyA = nodeDesiredY.get(a) || 0;
        const dyB = nodeDesiredY.get(b) || 0;
        if (Math.abs(dyA - dyB) > 0.1) {
          return dyA - dyB;
        }
        return a.localeCompare(b);
      });

      // 6.2 分配实际 Y 坐标 (1D 防重叠推挤算法)
      const currentYPositions: number[] = nodesInLayer.map(id => nodeDesiredY.get(id) || 0);

      if (layer === maxLayer) {
        let startY = 0;
        for (let j = 0; j < nodesInLayer.length; j++) {
          currentYPositions[j] = startY;
          startY += getNodeHeight(nodesInLayer[j]) + minGap;
        }
        const totalHeight = startY - minGap;
        for (let j = 0; j < nodesInLayer.length; j++) {
          currentYPositions[j] -= totalHeight / 2;
        }
      } else {
        let hasConflict = true;
        let maxIters = 200;
        // 先按当前想要的 Y 从上到下排序再推挤，防止乱序交叉
        const sortedIndices = nodesInLayer.map((_, i) => i).sort((a, b) => currentYPositions[a] - currentYPositions[b]);
        
        while (hasConflict && maxIters > 0) {
          hasConflict = false;
          for (let k = 0; k < sortedIndices.length - 1; k++) {
            const j = sortedIndices[k];
            const jNext = sortedIndices[k + 1];
            
            const h1 = getNodeHeight(nodesInLayer[j]);
            const requiredSpace = (h1 + getNodeHeight(nodesInLayer[jNext])) / 2 + minGap;
            
            // 比较中心点距离
            const center1 = currentYPositions[j] + h1 / 2;
            const center2 = currentYPositions[jNext] + getNodeHeight(nodesInLayer[jNext]) / 2;
            const diff = center2 - center1;

            if (diff < requiredSpace) {
              hasConflict = true;
              const overlap = requiredSpace - diff;
              // 严格保证相对顺序：上面的往上走，下面的往下走
              currentYPositions[j] -= overlap / 2;
              currentYPositions[jNext] += overlap / 2;
            }
          }
          maxIters--;
        }
      }

      nodesInLayer.forEach((id, j) => {
        const x = layer * colWidth;
        positionedNodesMap.set(id, { x, y: currentYPositions[j] });
      });
    }
  }

  // --- 7. 收尾：整体居中与独立节点排列 ---
  let minX = Infinity, minY = Infinity;
  positionedNodesMap.forEach(pos => {
    if (pos.x < minX) minX = pos.x;
    if (pos.y < minY) minY = pos.y;
  });
  if (minX === Infinity) minX = 0;
  if (minY === Infinity) minY = 0;

  const layoutedFlowNodes = flowNodesWithSize.map((node) => {
    const pos = positionedNodesMap.get(node.id) || { x: 0, y: 0 };
    return {
      ...node,
      position: pos,
    };
  });

  const indepStartX = minX - 320;
  let currentY = minY;
  const indepNodeHeight = 150;

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

  const layoutedNodes = [...layoutedIndepNodes, ...layoutedFlowNodes, ...layoutedChildNodes];

  return { nodes: layoutedNodes, edges };
};
