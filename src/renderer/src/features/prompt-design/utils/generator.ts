import { Edge, Node } from "@xyflow/react"

/** 提示词卡片类型 */
export type PromptCardType =
  | "system_role"
  | "objective"
  | "context"
  | "assumptions"
  | "constraints"
  | "definitions"
  | "variables"
  | "resources"
  | "assemble_a"
  | "compiler_c"
  | "task"
  | "task_title"
  | "task_goal"
  | "task_instructions"
  | "task_rules"
  | "task_priority"
  | "task_depends_on"
  | "task_variables"
  | "task_resources"
  | "task_example"
  | "task_output"
  | "task_validation"
  | "task_notes"
  | "output_format"
  | "validation"
  | "input_data"

export interface PromptNodeData {
  title: string
  description?: string
  nodeType: PromptCardType
  icon?: string
  inputs?: Array<{ id: string; name: string; type: string; handlePosition?: "left" | "right" }>
  outputs?: Array<{ id: string; name: string; type: string; handlePosition?: "left" | "right" }>
  content?: string
  variables?: string[]
  taskId?: string
  isCollapsed?: boolean
  expandedHeight?: number
  [key: string]: any // 兼容并满足 ReactFlow 的 Record<string, unknown> 数据格式
}

export const cardTypeMeta: Record<PromptCardType, { label: string }> = {
  system_role: { label: "系统角色 (System Role)" },
  objective: { label: "整体目标 (Objective)" },
  context: { label: "背景上下文 (Context)" },
  assumptions: { label: "边界与假设 (Assumptions)" },
  constraints: { label: "开发约束 (Constraints)" },
  definitions: { label: "关键定义 (Definitions)" },
  variables: { label: "全局变量 (Variables)" },
  resources: { label: "参考资源 (Resources)" },
  assemble_a: { label: "A-全局组装 (Global Config)" },
  compiler_c: { label: "C-最终导出 (Compiler Terminal)" },
  task: { label: "任务" },
  task_title: { label: "任务名称" },
  task_goal: { label: "任务目标" },
  task_instructions: { label: "执行步骤 (Instructions)" },
  task_rules: { label: "任务规则 (Rules)" },
  task_priority: { label: "优先级" },
  task_depends_on: { label: "任务依赖 (Depends On)" },
  task_variables: { label: "任务变量" },
  task_resources: { label: "任务资源" },
  task_example: { label: "参考示例" },
  task_output: { label: "输出要求" },
  task_validation: { label: "任务校验" },
  task_notes: { label: "备注说明" },
  output_format: { label: "输出格式 (Output Format)" },
  validation: { label: "全局校验 (Validation)" },
  input_data: { label: "输入数据 (Input Data)" },
}

/**
 * 将 React Flow 的节点和连线关系，编译转换为结构化的 Markdown / XML 提示词
 */
export const generateStructuredPrompt = (
  nodes: Node[],
  edges: Edge[],
  exportFormat: "markdown" | "xml" = "markdown",
): string => {
  if (nodes.length === 0) {
    return ""
  }

  const dataMap = new Map(nodes.map((n) => [n.id, n.data as unknown as unknown as PromptNodeData]))

  // 1. 映射所有入边连接 targetNodeId -> Record<targetHandleId, string[]>
  const incomingConnections: Record<string, Record<string, string[]>> = {}
  for (const e of edges) {
    if (!incomingConnections[e.target]) {
      incomingConnections[e.target] = {}
    }
    if (!incomingConnections[e.target][e.targetHandle || ""]) {
      incomingConnections[e.target][e.targetHandle || ""] = []
    }
    incomingConnections[e.target][e.targetHandle || ""].push(e.source)
  }

  // 2. 辅助函数：获取连接到某句柄的单个节点内容
  const getSingleNodeValue = (targetId: string, handleId: string): string => {
    const sources = incomingConnections[targetId]?.[handleId] || []
    if (sources.length === 0) return ""
    return dataMap.get(sources[0])?.content || ""
  }

  // 3. 辅助函数：通用包装区块
  const wrapBlock = (type: PromptCardType, content: string, indent = "", mdLevel = 2): string => {
    const trimmed = content.trim()
    if (!trimmed) return ""
    if (exportFormat === "markdown") {
      const title = cardTypeMeta[type]?.label || type
      const prefix = "#".repeat(mdLevel)
      return `${prefix} ${title}\n\n${trimmed}`
    } else {
      // XML 模式
      let tag = type as string
      if (tag.startsWith("task_")) {
        tag = tag.replace("task_", "")
      }
      if (trimmed.includes("\n")) {
        return `${indent}<${tag}>\n\n${trimmed
          .split("\n")
          .map((l) => `${indent}    ${l}`)
          .join("\n")}\n\n${indent}</${tag}>`
      }
      return `${indent}<${tag}>${trimmed}</${tag}>`
    }
  }

  // 寻找根节点 compiler_c (c 最终导出)
  const rootNodes = nodes.filter(
    (n) => (n.data as unknown as PromptNodeData).nodeType === "compiler_c",
  )
  const rootNode = rootNodes[0]

  // 定义提取的数据临时变量
  let systemRoleXML = ""
  let objectiveXML = ""
  let contextXML = ""
  let assumptionsXML = ""
  let constraintsXML = ""
  let definitionsXML = ""
  let variablesXML = ""
  let resourcesXML = ""
  let taskListXML = ""
  let outputFormatXML = ""
  let validationXML = ""
  let inputDataXML = ""

  const variablesSet = new Set<string>()
  for (const n of nodes) {
    if ((n.data as unknown as PromptNodeData).variables) {
      ;(n.data as unknown as PromptNodeData).variables!.forEach((v) => variablesSet.add(v))
    }
  }

  if (rootNode) {
    const rootId = rootNode.id
    const rootConns = incomingConnections[rootId] || {}

    // ── c 后置全局 ──
    outputFormatXML = getSingleNodeValue(rootId, "in-format")
    validationXML = getSingleNodeValue(rootId, "in-validation")
    inputDataXML = getSingleNodeValue(rootId, "in-input_data")

    // ── b 任务列表 ──
    const taskSources = rootConns["in-tasks"] || []
    const taskNodesOnCanvas = nodes.filter(
      (n) =>
        (n.data as unknown as PromptNodeData).nodeType === "task" && taskSources.includes(n.id),
    )

    // 按 TaskID 排序以保持逻辑结构
    const sortedTaskNodes = [...taskNodesOnCanvas].sort((a, b) => {
      const dataA = a.data as unknown as PromptNodeData
      const dataB = b.data as unknown as PromptNodeData
      const idA = dataA.taskId || ""
      const idB = dataB.taskId || ""
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: "base" })
    })

    const taskBlocks: string[] = []
    let firstGlobalAssemblerId = ""

    for (const task of sortedTaskNodes) {
      const tId = task.id

      // 解析 Task 各自子属性卡片
      const getConnectedFieldValue = (handleId: string) => {
        return getSingleNodeValue(tId, handleId)
      }

      const titleContent = getConnectedFieldValue("in-title")
      const goalContent = getConnectedFieldValue("in-goal")
      const instructionsContent = getConnectedFieldValue("in-instructions")
      const rulesContent = getConnectedFieldValue("in-rules")
      const priorityContent = getConnectedFieldValue("in-priority")
      const dependsOnContent = getConnectedFieldValue("in-depends_on")
      const variablesContent = getConnectedFieldValue("in-variables")
      const resourcesContent = getConnectedFieldValue("in-resources")
      const exampleContent = getConnectedFieldValue("in-example")
      const outputContent = getConnectedFieldValue("in-output")
      const taskValContent = getConnectedFieldValue("in-validation")
      const notesContent = getConnectedFieldValue("in-notes")

      const taskInner: string[] = []
      if (titleContent) taskInner.push(wrapBlock("task_title", titleContent, "        ", 3))
      if (goalContent) taskInner.push(wrapBlock("task_goal", goalContent, "        ", 3))
      if (instructionsContent)
        taskInner.push(wrapBlock("task_instructions", instructionsContent, "        ", 3))
      if (rulesContent) taskInner.push(wrapBlock("task_rules", rulesContent, "        ", 3))
      if (priorityContent)
        taskInner.push(wrapBlock("task_priority", priorityContent, "        ", 3))
      if (dependsOnContent)
        taskInner.push(wrapBlock("task_depends_on", dependsOnContent, "        ", 3))
      if (variablesContent)
        taskInner.push(wrapBlock("task_variables", variablesContent, "        ", 3))
      if (resourcesContent)
        taskInner.push(wrapBlock("task_resources", resourcesContent, "        ", 3))
      if (exampleContent) taskInner.push(wrapBlock("task_example", exampleContent, "        ", 3))
      if (outputContent) taskInner.push(wrapBlock("task_output", outputContent, "        ", 3))
      if (taskValContent)
        taskInner.push(wrapBlock("task_validation", taskValContent, "        ", 3))
      if (notesContent) taskInner.push(wrapBlock("task_notes", notesContent, "        ", 3))

      const taskId = (task.data as unknown as PromptNodeData).taskId || "1"
      if (exportFormat === "markdown") {
        const taskMD = `## 任务 ${taskId}\n\n${taskInner.filter(Boolean).join("\n\n")}`
        taskBlocks.push(taskMD)
      } else {
        const taskXML = `        <task id="${taskId}">\n${taskInner.filter(Boolean).join("\n\n")}\n        </task>`
        taskBlocks.push(taskXML)
      }
    }

    if (taskBlocks.length > 0) {
      if (exportFormat === "markdown") {
        taskListXML = `# 任务列表\n\n${taskBlocks.join("\n\n")}`
      } else {
        taskListXML = `    <tasks>\n${taskBlocks.join("\n\n")}\n    </tasks>`
      }
    }

    // ── a 前置全局 (从组装卡片中解析) ──
    const globalId =
      firstGlobalAssemblerId ||
      nodes.find((n) => (n.data as unknown as PromptNodeData).nodeType === "assemble_a")?.id
    if (globalId) {
      systemRoleXML = getSingleNodeValue(globalId, "in-system_role")
      objectiveXML = getSingleNodeValue(globalId, "in-objective")
      contextXML = getSingleNodeValue(globalId, "in-context")
      assumptionsXML = getSingleNodeValue(globalId, "in-assumptions")
      constraintsXML = getSingleNodeValue(globalId, "in-constraints")
      definitionsXML = getSingleNodeValue(globalId, "in-definitions")
      variablesXML = getSingleNodeValue(globalId, "in-variables")
      resourcesXML = getSingleNodeValue(globalId, "in-resources")
    }
  } else {
    // 退化模式：若无 C 卡片连线，则按全局搜索形式提取数据
    const findNodesContentByType = (type: PromptCardType): string => {
      return nodes
        .filter((n) => (n.data as unknown as PromptNodeData).nodeType === type)
        .map((n) => (n.data as unknown as PromptNodeData).content || "")
        .filter(Boolean)
        .join("\n\n")
    }

    systemRoleXML = findNodesContentByType("system_role")
    objectiveXML = findNodesContentByType("objective")
    contextXML = findNodesContentByType("context")
    assumptionsXML = findNodesContentByType("assumptions")
    constraintsXML = findNodesContentByType("constraints")
    definitionsXML = findNodesContentByType("definitions")
    variablesXML = findNodesContentByType("variables")
    resourcesXML = findNodesContentByType("resources")
    outputFormatXML = findNodesContentByType("output_format")
    validationXML = findNodesContentByType("validation")
    inputDataXML = findNodesContentByType("input_data")

    // 单独找所有任务
    const taskNodes = nodes.filter((n) => (n.data as unknown as PromptNodeData).nodeType === "task")
    const taskBlocks: string[] = []
    for (const t of taskNodes) {
      const taskId = (t.data as unknown as PromptNodeData).taskId || "1"
      const content = (t.data as unknown as PromptNodeData).content || ""
      if (content) {
        if (exportFormat === "markdown") {
          taskBlocks.push(`## 任务 ${taskId}\n\n${content}`)
        } else {
          taskBlocks.push(
            `        <task id="${taskId}">\n            ${content.split("\n").join("\n            ")}\n        </task>`,
          )
        }
      }
    }

    if (taskBlocks.length > 0) {
      if (exportFormat === "markdown") {
        taskListXML = `# 任务列表\n\n${taskBlocks.join("\n\n")}`
      } else {
        taskListXML = `    <tasks>\n${taskBlocks.join("\n\n")}\n    </tasks>`
      }
    }
  }

  // ── 4. 合成完整的代码 ──
  const globalTags: string[] = []
  if (systemRoleXML) globalTags.push(wrapBlock("system_role", systemRoleXML, "    "))
  if (objectiveXML) globalTags.push(wrapBlock("objective", objectiveXML, "    "))
  if (contextXML) globalTags.push(wrapBlock("context", contextXML, "    "))
  if (assumptionsXML) globalTags.push(wrapBlock("assumptions", assumptionsXML, "    "))
  if (constraintsXML) globalTags.push(wrapBlock("constraints", constraintsXML, "    "))
  if (definitionsXML) globalTags.push(wrapBlock("definitions", definitionsXML, "    "))

  // 变量处理
  if (variablesSet.size > 0 || variablesXML) {
    let varInner = variablesXML
    if (!varInner && variablesSet.size > 0) {
      varInner = Array.from(variablesSet)
        .map((v) => `${v} = [请输入 ${v} 的实际定义]`)
        .join("\n")
    }
    if (varInner) globalTags.push(wrapBlock("variables", varInner, "    "))
  }

  if (resourcesXML) globalTags.push(wrapBlock("resources", resourcesXML, "    "))
  if (taskListXML) globalTags.push(taskListXML)
  if (outputFormatXML) globalTags.push(wrapBlock("output_format", outputFormatXML, "    "))
  if (validationXML) globalTags.push(wrapBlock("validation", validationXML, "    "))
  if (inputDataXML) globalTags.push(wrapBlock("input_data", inputDataXML, "    "))

  const md =
    exportFormat === "markdown"
      ? globalTags.filter(Boolean).join("\n\n") + "\n"
      : `<prompt>\n\n${globalTags.filter(Boolean).join("\n\n")}\n\n</prompt>\n`

  return md
}

export const DEFAULT_TEMPLATE = {
  nodes: [
    {
      id: "a-role",
      type: "promptNode",
      position: { x: 50, y: 50 },
      data: {
        title: "系统角色 (System Role)",
        description: "定义 AI 前端架构专家的人设",
        nodeType: "system_role",
        content:
          "你是一个资深的前端 React 架构师。请使用 TypeScript 和 Tailwind CSS 设计并生成高质量的、符合企业级规范的 React 组件。",
        outputs: [{ id: "out-role", name: "Output", type: "text" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "a-obj",
      type: "promptNode",
      position: { x: 50, y: 220 },
      data: {
        title: "整体目标 (Objective)",
        description: "设定 AI 最终交付的目标",
        nodeType: "objective",
        content: "分析用户的业务任务，输出高内聚、高响应性、零缺陷的前端 React 完整源码实现。",
        outputs: [{ id: "out-obj", name: "Output", type: "text" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "a-const",
      type: "promptNode",
      position: { x: 50, y: 390 },
      data: {
        title: "全局约束 (Constraints)",
        description: "开发必须严格遵守的红线",
        nodeType: "constraints",
        content: "- 严禁使用任何外部全局状态库\n- 必须实现 100% 的 TypeScript 强类型声明",
        outputs: [{ id: "out-const", name: "Output", type: "text" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "a-assembler",
      type: "promptNode",
      position: { x: 380, y: 220 },
      data: {
        title: "A-全局组装 (Global Config)",
        description: "收集并打包所有全局前置标签 (a)",
        nodeType: "assemble_a",
        inputs: [
          { id: "in-system_role", name: "系统角色 (System Role)", type: "text" },
          { id: "in-objective", name: "整体目标 (Objective)", type: "text" },
          { id: "in-constraints", name: "全局约束 (Constraints)", type: "text" },
        ],
        outputs: [{ id: "out-global", name: "打包输出", type: "global_config" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "b1-title",
      type: "promptNode",
      position: { x: 700, y: -200 },
      data: {
        title: "任务1 名称",
        nodeType: "task_title",
        content: "数据表格核心骨架实现",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "b1-goal",
      type: "promptNode",
      position: { x: 700, y: -40 },
      data: {
        title: "任务1 目标",
        nodeType: "task_goal",
        content: "创建自适应表格布局，保证加载中与无数据状态交互连贯。",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "b1-instructions",
      type: "promptNode",
      position: { x: 700, y: 120 },
      data: {
        title: "执行步骤 (Instructions)",
        nodeType: "task_instructions",
        content: "1. 拆分 Table Header 和 Body\n2. 注入 Mock 数据渲染\n3. 添加 Loading 骨架屏",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "b1-rules",
      type: "promptNode",
      position: { x: 700, y: 280 },
      data: {
        title: "任务规则 (Rules)",
        nodeType: "task_rules",
        content: "组件必须使用 forwardRef，确保父级可获取 table 实例。",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "b1-output",
      type: "promptNode",
      position: { x: 700, y: 440 },
      data: {
        title: "输出要求 (Output)",
        nodeType: "task_output",
        content: "只返回 DataTable.tsx 的源码，无需解释。",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "b1-container",
      type: "promptNode",
      position: { x: 1020, y: 100 },
      data: {
        title: "b1 任务: 表格架构搭建",
        description: "表格搭建核心任务单元",
        nodeType: "task",
        taskId: "1",
        inputs: [
          { id: "in-global", name: "A全局配置 (Global Config)", type: "global_config" },
          { id: "in-title", name: "任务名称 (Title)", type: "text" },
          { id: "in-goal", name: "任务目标 (Goal)", type: "text" },
          { id: "in-instructions", name: "执行步骤 (Instructions)", type: "text" },
          { id: "in-rules", name: "任务规则 (Rules)", type: "text" },
          { id: "in-output", name: "输出要求 (Output)", type: "text" },
        ],
        outputs: [{ id: "out-task", name: "任务整合", type: "task" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "b2-title",
      type: "promptNode",
      position: { x: 700, y: 640 },
      data: {
        title: "任务2 名称",
        nodeType: "task_title",
        content: "数据流控制与分页核心",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "b2-goal",
      type: "promptNode",
      position: { x: 700, y: 800 },
      data: {
        title: "任务2 目标",
        nodeType: "task_goal",
        content: "提供每页数量切换以及防抖过滤检索，空态无缝重置。",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "b2-depends",
      type: "promptNode",
      position: { x: 700, y: 960 },
      data: {
        title: "任务依赖 (Depends On)",
        nodeType: "task_depends_on",
        content: "依赖 任务1 (数据表格核心骨架实现) 的完成。",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "b2-instructions",
      type: "promptNode",
      position: { x: 700, y: 1120 },
      data: {
        title: "执行步骤 (Instructions)",
        nodeType: "task_instructions",
        content: "1. 接入 useDebounce hook\n2. 实现 usePagination\n3. 将状态下发至 DataTable",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "b2-container",
      type: "promptNode",
      position: { x: 1020, y: 850 },
      data: {
        title: "b2 任务: 搜索与分页 logic",
        description: "数据流与高级分页检索单元",
        nodeType: "task",
        taskId: "2",
        inputs: [
          { id: "in-global", name: "A全局配置 (Global Config)", type: "global_config" },
          { id: "in-title", name: "任务名称 (Title)", type: "text" },
          { id: "in-goal", name: "任务目标 (Goal)", type: "text" },
          { id: "in-depends_on", name: "任务依赖 (Depends On)", type: "text" },
          { id: "in-instructions", name: "执行步骤 (Instructions)", type: "text" },
        ],
        outputs: [{ id: "out-task", name: "任务整合", type: "task" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "c-compiler",
      type: "promptNode",
      position: { x: 1380, y: 480 },
      data: {
        title: "C-最终导出 (Compiler Terminal)",
        description: "汇聚 A全局配置、B任务列表及 C后置配置 以进行一键编译",
        nodeType: "compiler_c",
        inputs: [
          { id: "in-tasks", name: "任务列表 (Tasks)", type: "task" },
          { id: "in-format", name: "输出格式 (Format)", type: "text", handlePosition: "right" },
          {
            id: "in-validation",
            name: "全局校验 (Validation)",
            type: "text",
            handlePosition: "right",
          },
        ],
      } as unknown as PromptNodeData,
    },
    {
      id: "c-format",
      type: "promptNode",
      position: { x: 1720, y: 380 },
      data: {
        title: "输出格式 (Output Format)",
        description: "严格约束最终的代码交付标准",
        nodeType: "output_format",
        content: "提供用 ```tsx 标记包裹的单文件完整代码，尾部必须提供 Jest 单元测试示范用例。",
        outputs: [{ id: "out-format", name: "Output", type: "text", handlePosition: "left" }],
      } as unknown as PromptNodeData,
    },
    {
      id: "c-validation",
      type: "promptNode",
      position: { x: 1720, y: 580 },
      data: {
        title: "全局校验 (Validation)",
        description: "定义大模型交付前自检清单",
        nodeType: "validation",
        content: "检查所有任务是否圆满完成，并确认完全符合开发约束。",
        outputs: [{ id: "out-validation", name: "Output", type: "text", handlePosition: "left" }],
      } as unknown as PromptNodeData,
    },
  ],
  edges: [
    {
      id: "e-a-role",
      source: "a-role",
      target: "a-assembler",
      sourceHandle: "out-role",
      targetHandle: "in-system_role",
      style: { stroke: "#22d3ee", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-a-obj",
      source: "a-obj",
      target: "a-assembler",
      sourceHandle: "out-obj",
      targetHandle: "in-objective",
      style: { stroke: "#a78bfa", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-a-const",
      source: "a-const",
      target: "a-assembler",
      sourceHandle: "out-const",
      targetHandle: "in-constraints",
      style: { stroke: "#ef4444", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-assemble-b1",
      source: "a-assembler",
      target: "b1-container",
      sourceHandle: "out-global",
      targetHandle: "in-global",
      style: { stroke: "#fb923c", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-assemble-b2",
      source: "a-assembler",
      target: "b2-container",
      sourceHandle: "out-global",
      targetHandle: "in-global",
      style: { stroke: "#fb923c", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-b1-title",
      source: "b1-title",
      target: "b1-container",
      sourceHandle: "out-val",
      targetHandle: "in-title",
      style: { stroke: "#9ca3af", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-b1-goal",
      source: "b1-goal",
      target: "b1-container",
      sourceHandle: "out-val",
      targetHandle: "in-goal",
      style: { stroke: "#9ca3af", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-b1-instructions",
      source: "b1-instructions",
      target: "b1-container",
      sourceHandle: "out-val",
      targetHandle: "in-instructions",
      style: { stroke: "#9ca3af", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-b1-rules",
      source: "b1-rules",
      target: "b1-container",
      sourceHandle: "out-val",
      targetHandle: "in-rules",
      style: { stroke: "#9ca3af", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-b1-output",
      source: "b1-output",
      target: "b1-container",
      sourceHandle: "out-val",
      targetHandle: "in-output",
      style: { stroke: "#9ca3af", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-b2-title",
      source: "b2-title",
      target: "b2-container",
      sourceHandle: "out-val",
      targetHandle: "in-title",
      style: { stroke: "#9ca3af", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-b2-goal",
      source: "b2-goal",
      target: "b2-container",
      sourceHandle: "out-val",
      targetHandle: "in-goal",
      style: { stroke: "#9ca3af", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-b2-depends",
      source: "b2-depends",
      target: "b2-container",
      sourceHandle: "out-val",
      targetHandle: "in-depends_on",
      style: { stroke: "#9ca3af", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-b2-instructions",
      source: "b2-instructions",
      target: "b2-container",
      sourceHandle: "out-val",
      targetHandle: "in-instructions",
      style: { stroke: "#9ca3af", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-b1-final",
      source: "b1-container",
      target: "c-compiler",
      sourceHandle: "out-task",
      targetHandle: "in-tasks",
      style: { stroke: "#e879f9", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-b2-final",
      source: "b2-container",
      target: "c-compiler",
      sourceHandle: "out-task",
      targetHandle: "in-tasks",
      style: { stroke: "#e879f9", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-c-format",
      source: "c-format",
      target: "c-compiler",
      sourceHandle: "out-format",
      targetHandle: "in-format",
      style: { stroke: "#818cf8", strokeWidth: 2 },
      animated: true,
    },
    {
      id: "e-c-validation",
      source: "c-validation",
      target: "c-compiler",
      sourceHandle: "out-validation",
      targetHandle: "in-validation",
      style: { stroke: "#34d399", strokeWidth: 2 },
      animated: true,
    },
  ],
}
