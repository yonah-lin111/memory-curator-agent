import type { Edge, Node } from "@xyflow/react"

/**
 * 极简、方正的矩形拓扑布局算法
 *
 * 包含：
 * 1. 自动根据子卡片数量计算容器 (Task) 的自适应高度。
 * 2. 自动布局容器内部的子卡片。
 * 3. 对全局流采用 Sugiyama 启发式重心对齐 (Right-to-Left Heuristic)，保证连线顺畅。
 * 4. 扁平卡片全图布局逻辑。
 */
export const getLayoutedElements = (nodes: Node[], edges: Edge[], _direction = "LR") => {
  const independentTypes = ["comment", "variable", "group"]

  // 1. 区分流程节点、独立节点
  const flowNodes = nodes.filter((n) => !independentTypes.includes(n.data?.nodeType as string))
  const independentNodes = nodes.filter((n) =>
    independentTypes.includes(n.data?.nodeType as string),
  )

  if (flowNodes.length === 0) {
    return { nodes, edges }
  }

  // --- 1. 建立邻接表与入度表 ---
  const flowNodeIds = new Set(flowNodes.map((n) => n.id))
  const adj = new Map<string, string[]>()
  const revAdj = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const n of flowNodes) {
    adj.set(n.id, [])
    revAdj.set(n.id, [])
    inDegree.set(n.id, 0)
  }

  for (const e of edges) {
    if (flowNodeIds.has(e.source) && flowNodeIds.has(e.target)) {
      // 允许反向连线（如 c-format 传递给 c-compiler 但希望 c-format 排在后面）
      if (e.data && (e.data as any).isBackward) {
        adj.get(e.target)!.push(e.source)
        revAdj.get(e.source)!.push(e.target)
        inDegree.set(e.source, inDegree.get(e.source)! + 1)
      } else {
        adj.get(e.source)!.push(e.target)
        revAdj.get(e.target)!.push(e.source)
        inDegree.set(e.target, inDegree.get(e.target)! + 1)
      }
    }
  }

  // --- 2. 计算前向最长路径层级 ---
  const layers = new Map<string, number>()
  const queue: string[] = []

  for (const n of flowNodes) {
    if (inDegree.get(n.id) === 0) {
      layers.set(n.id, 0)
      queue.push(n.id)
    }
  }

  const tempInDegree = new Map(inDegree)
  while (queue.length > 0) {
    const curr = queue.shift()!
    const currLayer = layers.get(curr) || 0

    for (const next of adj.get(curr) || []) {
      const nextLayer = Math.max(layers.get(next) || 0, currLayer + 1)
      layers.set(next, nextLayer)

      tempInDegree.set(next, tempInDegree.get(next)! - 1)
      if (tempInDegree.get(next) === 0) {
        queue.push(next)
      }
    }
  }

  for (const n of flowNodes) {
    if (!layers.has(n.id)) {
      layers.set(n.id, 0)
    }
  }

  // --- 3. 反向推导，对齐无入边的叶子节点 ---
  for (const n of flowNodes) {
    if (inDegree.get(n.id) === 0) {
      const targets = adj.get(n.id) || []
      if (targets.length > 0) {
        const minTargetLayer = Math.min(...targets.map((t) => layers.get(t) || 0))
        if (minTargetLayer > 0) {
          layers.set(n.id, minTargetLayer - 1)
        }
      }
    }
  }

  // --- 4. 按层级对节点进行分组 ---
  const layerGroups = new Map<number, string[]>()
  for (const [id, layer] of layers.entries()) {
    if (!layerGroups.has(layer)) {
      layerGroups.set(layer, [])
    }
    layerGroups.get(layer)!.push(id)
  }

  const sortedLayers = Array.from(layerGroups.keys()).sort((a, b) => a - b)

  const edgeInfoMap = new Map<string, Edge>()
  for (const e of edges) {
    if (!edgeInfoMap.has(e.source)) {
      edgeInfoMap.set(e.source, e)
    }
  }

  const handleOrder = [
    "in-system_role",
    "in-objective",
    "in-constraints",
    "in-context",
    "in-assumptions",
    "in-definitions",
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
    "in-notes",
  ]

  // --- 5. 规整网格坐标分配 (考虑节点实际高度) ---
  const colWidth = 420 // 横向列宽
  const minGap = 120 // 纵向节点之间的最小视觉间距

  const positionedNodesMap = new Map<string, { x: number; y: number }>()
  const nodeDesiredY = new Map<string, number>()

  const getNodeHeight = (id: string) => {
    const node = flowNodes.find((n) => n.id === id)
    let estimatedH = 160
    if (node && node.data) {
      const data = node.data as any
      const portsCount = (data.inputs?.length || 0) + (data.outputs?.length || 0)
      if (portsCount > 0) {
        estimatedH = Math.max(160, 80 + portsCount * 36)
      }
    }
    return estimatedH
  }

  if (sortedLayers.length > 0) {
    const maxLayer = sortedLayers[sortedLayers.length - 1]

    for (let i = sortedLayers.length - 1; i >= 0; i--) {
      const layer = sortedLayers[i]
      const nodesInLayer = layerGroups.get(layer)!

      // 5.1 计算 desiredY
      nodesInLayer.forEach((id) => {
        if (layer === maxLayer) {
          nodeDesiredY.set(id, 0)
          return
        }
        const targets = adj.get(id) || []
        if (targets.length === 0) {
          nodeDesiredY.set(id, 0)
        } else {
          let sum = 0
          let count = 0
          for (const t of targets) {
            const tPos = positionedNodesMap.get(t)
            if (tPos) {
              const tHeight = getNodeHeight(t)
              sum += tPos.y + tHeight / 2
              count++
            }
          }
          let y = count > 0 ? sum / count : 0
          const edge = edgeInfoMap.get(id)
          if (edge && edge.targetHandle) {
            const hIdx = handleOrder.indexOf(edge.targetHandle)
            if (hIdx !== -1) {
              y += (hIdx - handleOrder.length / 2) * 10
            }
          }
          nodeDesiredY.set(id, y - getNodeHeight(id) / 2) // 转回 top Y
        }
      })

      nodesInLayer.sort((a, b) => {
        const dyA = nodeDesiredY.get(a) || 0
        const dyB = nodeDesiredY.get(b) || 0
        if (Math.abs(dyA - dyB) > 0.1) {
          return dyA - dyB
        }
        return a.localeCompare(b)
      })

      // 5.2 分配实际 Y 坐标 (1D 防重叠推挤算法)
      const currentYPositions: number[] = nodesInLayer.map((id) => nodeDesiredY.get(id) || 0)

      if (layer === maxLayer) {
        let startY = 0
        for (let j = 0; j < nodesInLayer.length; j++) {
          currentYPositions[j] = startY
          startY += getNodeHeight(nodesInLayer[j]) + minGap
        }
        const totalHeight = startY - minGap
        for (let j = 0; j < nodesInLayer.length; j++) {
          currentYPositions[j] -= totalHeight / 2
        }
      } else {
        let hasConflict = true
        let maxIters = 200
        const sortedIndices = nodesInLayer
          .map((_, i) => i)
          .sort((a, b) => currentYPositions[a] - currentYPositions[b])

        while (hasConflict && maxIters > 0) {
          hasConflict = false
          maxIters--

          for (let idx = 0; idx < sortedIndices.length - 1; idx++) {
            const i = sortedIndices[idx]
            const j = sortedIndices[idx + 1]

            const nodeAId = nodesInLayer[i]
            const nodeBId = nodesInLayer[j]

            const hA = getNodeHeight(nodeAId)
            const hB = getNodeHeight(nodeBId)

            const reqSpace = (hA + hB) / 2 + minGap
            const diff = currentYPositions[j] + hB / 2 - (currentYPositions[i] + hA / 2)

            if (diff < reqSpace) {
              hasConflict = true
              const overlap = reqSpace - diff
              currentYPositions[i] -= overlap / 2
              currentYPositions[j] += overlap / 2
            }
          }
        }
      }

      nodesInLayer.forEach((id, j) => {
        const x = layer * colWidth
        positionedNodesMap.set(id, { x, y: currentYPositions[j] })
      })
    }
  }

  // --- 6. 收尾：整体居中与独立节点排列 ---
  let minX = Infinity,
    minY = Infinity
  positionedNodesMap.forEach((pos) => {
    if (pos.x < minX) minX = pos.x
    if (pos.y < minY) minY = pos.y
  })
  if (minX === Infinity) minX = 0
  if (minY === Infinity) minY = 0

  const layoutedFlowNodes = flowNodes.map((node) => {
    const pos = positionedNodesMap.get(node.id) || { x: 0, y: 0 }
    return {
      ...node,
      position: pos,
    }
  })

  const indepStartX = minX - 320
  let currentY = minY
  const indepNodeHeight = 150

  const layoutedIndepNodes = independentNodes.map((node) => {
    const positionedNode = {
      ...node,
      position: {
        x: indepStartX,
        y: currentY,
      },
    }
    currentY += indepNodeHeight + 20
    return positionedNode
  })

  const layoutedNodes = [...layoutedIndepNodes, ...layoutedFlowNodes]

  return { nodes: layoutedNodes, edges }
}
