import { useState, useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PromptNode, type PromptNodeData, cardTypeMeta, type PromptCardType } from "./PromptNode";
import { CanvasControls } from "./CanvasControls";
import { useFlowHistory } from "../hooks/useFlowHistory";
import { PromptCanvasContextMenu, type ContextMenuState } from "./PromptCanvasContextMenu";
import { useToast } from "@/components/ui/Toast";
import { usePromptDesignStore } from "../store/promptDesignStore";
import { Workflow } from "lucide-react";

const nodeTypes: NodeTypes = {
  promptNode: PromptNode,
};

/** minimap 颜色映射 */
const minimapColors: Record<string, string> = {
  system_role:       "#22d3ee", // cyan-400
  objective:         "#a78bfa", // violet-400
  context:           "#c084fc", // 紫色
  assumptions:       "#38bdf8", // 天蓝
  constraints:       "#ef4444", // 红色
  definitions:       "#2dd4bf", // 蒂芙尼蓝
  variables:         "#facc15", // 黄色
  resources:         "#fbbf24", // 琥珀黄
  assemble_a:        "#fb923c", // 橙色
  compiler_c:        "#a3e635", // 莱姆绿
  task:              "#e879f9", // 紫罗兰
  task_title:        "#9ca3af", // 灰色
  task_goal:         "#9ca3af",
  task_instructions: "#9ca3af",
  task_rules:        "#9ca3af",
  task_priority:     "#9ca3af",
  task_depends_on:   "#9ca3af",
  task_variables:    "#9ca3af",
  task_resources:    "#9ca3af",
  task_example:      "#9ca3af",
  task_output:       "#9ca3af",
  task_validation:   "#9ca3af",
  task_notes:        "#9ca3af",
  output_format:     "#818cf8", // 靛蓝
  validation:        "#34d399", // 绿色
  input_data:        "#60a5fa", // 蓝色
};

// 获取连接线的颜色
const getEdgeColor = (nodeType?: string): string => {
  const colors: Record<string, string> = {
    system_role:       "#22d3ee",
    objective:         "#a78bfa",
    context:           "#c084fc",
    assumptions:       "#38bdf8",
    constraints:       "#ef4444",
    definitions:       "#2dd4bf",
    variables:         "#facc15",
    resources:         "#fbbf24",
    assemble_a:        "#fb923c",
    compiler_c:        "#a3e635",
    task:              "#e879f9",
    output_format:     "#818cf8",
    validation:        "#34d399",
    input_data:        "#60a5fa",
  };
  return colors[nodeType || ""] || "#9ca3af";
};

// ── 改装后的平铺连接型 MOCK 初始数据集 ──
const DEFAULT_TEMPLATE = {
  nodes: [
    /* ── a组: 全局配置输入节点 ── */
    {
      id: "a-role",
      type: "promptNode",
      position: { x: 50, y: 50 },
      data: {
        title: "系统角色 (System Role)",
        description: "定义 AI 前端架构专家的人设",
        nodeType: "system_role",
        content: "你是一个资深的前端 React 架构师。请使用 TypeScript 和 Tailwind CSS 设计并生成高质量的、符合企业级规范的 React 组件。",
        outputs: [{ id: "out-role", name: "Output", type: "text" }],
      } as PromptNodeData,
    } as Node,
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
      } as PromptNodeData,
    } as Node,
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
      } as PromptNodeData,
    } as Node,

    /* ── a-组装卡片 (Global Assembler) ── */
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
      } as PromptNodeData,
    } as Node,

    /* ── b1 任务卡片与各自平铺的属性节点 ── */
    {
      id: "b1-title",
      type: "promptNode",
      position: { x: 700, y: -200 },
      data: {
        title: "任务1 名称",
        nodeType: "task_title",
        content: "数据表格核心骨架实现",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as PromptNodeData,
    } as Node,
    {
      id: "b1-goal",
      type: "promptNode",
      position: { x: 700, y: -40 },
      data: {
        title: "任务1 目标",
        nodeType: "task_goal",
        content: "创建自适应表格布局，保证加载中与无数据状态交互连贯。",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as PromptNodeData,
    } as Node,
    {
      id: "b1-instructions",
      type: "promptNode",
      position: { x: 700, y: 120 },
      data: {
        title: "执行步骤 (Instructions)",
        nodeType: "task_instructions",
        content: "1. 拆分 Table Header 和 Body\n2. 注入 Mock 数据渲染\n3. 添加 Loading 骨架屏",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as PromptNodeData,
    } as Node,
    {
      id: "b1-rules",
      type: "promptNode",
      position: { x: 700, y: 280 },
      data: {
        title: "任务规则 (Rules)",
        nodeType: "task_rules",
        content: "组件必须使用 forwardRef，确保父级可获取 table 实例。",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as PromptNodeData,
    } as Node,
    {
      id: "b1-output",
      type: "promptNode",
      position: { x: 700, y: 440 },
      data: {
        title: "输出要求 (Output)",
        nodeType: "task_output",
        content: "只返回 DataTable.tsx 的源码，无需解释。",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as PromptNodeData,
    } as Node,

    /* ── b1 主任务核心节点 ── */
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
      } as PromptNodeData,
    } as Node,

    /* ── b2 任务卡片与各自平铺的属性节点 ── */
    {
      id: "b2-title",
      type: "promptNode",
      position: { x: 700, y: 640 },
      data: {
        title: "任务2 名称",
        nodeType: "task_title",
        content: "数据流控制与分页核心",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as PromptNodeData,
    } as Node,
    {
      id: "b2-goal",
      type: "promptNode",
      position: { x: 700, y: 800 },
      data: {
        title: "任务2 目标",
        nodeType: "task_goal",
        content: "提供每页数量切换以及防抖过滤检索，空态无缝重置。",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as PromptNodeData,
    } as Node,
    {
      id: "b2-depends",
      type: "promptNode",
      position: { x: 700, y: 960 },
      data: {
        title: "任务依赖 (Depends On)",
        nodeType: "task_depends_on",
        content: "依赖 任务1 (数据表格核心骨架实现) 的完成。",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as PromptNodeData,
    } as Node,
    {
      id: "b2-instructions",
      type: "promptNode",
      position: { x: 700, y: 1120 },
      data: {
        title: "执行步骤 (Instructions)",
        nodeType: "task_instructions",
        content: "1. 接入 useDebounce hook\n2. 实现 usePagination\n3. 将状态下发至 DataTable",
        outputs: [{ id: "out-val", name: "属性输出", type: "text" }],
      } as PromptNodeData,
    } as Node,

    /* ── b2 主任务核心节点 ── */
    {
      id: "b2-container",
      type: "promptNode",
      position: { x: 1020, y: 850 },
      data: {
        title: "b2 任务: 搜索与分页逻辑",
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
      } as PromptNodeData,
    } as Node,

    /* ── c最终导出卡片 (Compiler Terminal) ── */
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
          { id: "in-validation", name: "全局校验 (Validation)", type: "text", handlePosition: "right" },
        ],
      } as PromptNodeData,
    } as Node,

    /* ── c组: 后置全局配置节点 ── */
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
      } as PromptNodeData,
    } as Node,
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
      } as PromptNodeData,
    } as Node,
  ],

  edges: [
    /* ── a (全局输入) -> a组装卡片 ── */
    { id: "e-a-role", source: "a-role", target: "a-assembler", sourceHandle: "out-role", targetHandle: "in-system_role", style: { stroke: "#22d3ee", strokeWidth: 2 }, animated: true },
    { id: "e-a-obj", source: "a-obj", target: "a-assembler", sourceHandle: "out-obj", targetHandle: "in-objective", style: { stroke: "#a78bfa", strokeWidth: 2 }, animated: true },
    { id: "e-a-const", source: "a-const", target: "a-assembler", sourceHandle: "out-const", targetHandle: "in-constraints", style: { stroke: "#ef4444", strokeWidth: 2 }, animated: true },

    /* ── a组装卡片 -> b1 & b2 任务输入 ── */
    { id: "e-assemble-b1", source: "a-assembler", target: "b1-container", sourceHandle: "out-global", targetHandle: "in-global", style: { stroke: "#fb923c", strokeWidth: 2 }, animated: true },
    { id: "e-assemble-b2", source: "a-assembler", target: "b2-container", sourceHandle: "out-global", targetHandle: "in-global", style: { stroke: "#fb923c", strokeWidth: 2 }, animated: true },

    /* ── b1 任务属性卡片 -> b1 主任务核心 ── */
    { id: "e-b1-title", source: "b1-title", target: "b1-container", sourceHandle: "out-val", targetHandle: "in-title", style: { stroke: "#9ca3af", strokeWidth: 2 }, animated: true },
    { id: "e-b1-goal", source: "b1-goal", target: "b1-container", sourceHandle: "out-val", targetHandle: "in-goal", style: { stroke: "#9ca3af", strokeWidth: 2 }, animated: true },
    { id: "e-b1-instructions", source: "b1-instructions", target: "b1-container", sourceHandle: "out-val", targetHandle: "in-instructions", style: { stroke: "#9ca3af", strokeWidth: 2 }, animated: true },
    { id: "e-b1-rules", source: "b1-rules", target: "b1-container", sourceHandle: "out-val", targetHandle: "in-rules", style: { stroke: "#9ca3af", strokeWidth: 2 }, animated: true },
    { id: "e-b1-output", source: "b1-output", target: "b1-container", sourceHandle: "out-val", targetHandle: "in-output", style: { stroke: "#9ca3af", strokeWidth: 2 }, animated: true },

    /* ── b2 任务属性卡片 -> b2 主任务核心 ── */
    { id: "e-b2-title", source: "b2-title", target: "b2-container", sourceHandle: "out-val", targetHandle: "in-title", style: { stroke: "#9ca3af", strokeWidth: 2 }, animated: true },
    { id: "e-b2-goal", source: "b2-goal", target: "b2-container", sourceHandle: "out-val", targetHandle: "in-goal", style: { stroke: "#9ca3af", strokeWidth: 2 }, animated: true },
    { id: "e-b2-depends", source: "b2-depends", target: "b2-container", sourceHandle: "out-val", targetHandle: "in-depends_on", style: { stroke: "#9ca3af", strokeWidth: 2 }, animated: true },
    { id: "e-b2-instructions", source: "b2-instructions", target: "b2-container", sourceHandle: "out-val", targetHandle: "in-instructions", style: { stroke: "#9ca3af", strokeWidth: 2 }, animated: true },

    /* ── b1 & b2 任务整合 -> c (最终编译端) ── */
    { id: "e-b1-final", source: "b1-container", target: "c-compiler", sourceHandle: "out-task", targetHandle: "in-tasks", style: { stroke: "#e879f9", strokeWidth: 2 }, animated: true },
    { id: "e-b2-final", source: "b2-container", target: "c-compiler", sourceHandle: "out-task", targetHandle: "in-tasks", style: { stroke: "#e879f9", strokeWidth: 2 }, animated: true },

    /* ── c (后置输入) -> c组装卡片 (但为了排版，设置为反向边 isBackward) ── */
    { id: "e-c-format", source: "c-format", target: "c-compiler", sourceHandle: "out-format", targetHandle: "in-format", data: { isBackward: true } as any, style: { stroke: "#818cf8", strokeWidth: 2 }, animated: true },
    { id: "e-c-validation", source: "c-validation", target: "c-compiler", sourceHandle: "out-validation", targetHandle: "in-validation", data: { isBackward: true } as any, style: { stroke: "#34d399", strokeWidth: 2 }, animated: true },
  ]
};

export const PromptCanvas = () => {
  const activeDesignId = usePromptDesignStore((state) => state.activeDesignId);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition } = useReactFlow();
  const { takeSnapshot, undo, redo, canUndo, canRedo } = useFlowHistory(nodes, edges, setNodes, setEdges);

  const [isUnsaved, setIsUnsaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const isFirstLoadDone = useRef(false);
  const lastSavedDataRef = useRef<string>("");

  // ── 当节点或连线变化时，进行序列化比对，确定是否处于未保存状态 ──
  useEffect(() => {
    if (!isFirstLoadDone.current) return;
    const currentDataStr = JSON.stringify({ nodes, edges });
    if (currentDataStr !== lastSavedDataRef.current) {
      setIsUnsaved(true);
    } else {
      setIsUnsaved(false);
    }
  }, [nodes, edges]);

  // ── 监听 activeDesignId 动态加载该设计的节点与连线 ──
  useEffect(() => {
    const loadDesignData = async () => {
      if (!activeDesignId) {
        setNodes([]);
        setEdges([]);
        setIsUnsaved(false);
        isFirstLoadDone.current = false;
        lastSavedDataRef.current = "";
        return;
      }
      try {
        isFirstLoadDone.current = false;
        setIsUnsaved(false);
        const list = await (window.api as any).promptDesign.designs.list();
        const current = list.find((d: any) => d.id === activeDesignId);
        if (current && current.designData) {
          const { nodes: loadedNodes = [], edges: loadedEdges = [] } = current.designData;
          setNodes(loadedNodes);
          setEdges(loadedEdges);
          lastSavedDataRef.current = JSON.stringify({ nodes: loadedNodes, edges: loadedEdges });
        } else {
          setNodes(DEFAULT_TEMPLATE.nodes);
          setEdges(DEFAULT_TEMPLATE.edges);
          lastSavedDataRef.current = JSON.stringify({ nodes: DEFAULT_TEMPLATE.nodes, edges: DEFAULT_TEMPLATE.edges });
        }
        requestAnimationFrame(() => {
          isFirstLoadDone.current = true;
        });
      } catch (err) {
        console.error("Failed to load design data:", err);
      }
    };
    loadDesignData();
  }, [activeDesignId, setNodes, setEdges]);

  const [menuState, setMenuState] = useState<ContextMenuState>({ type: null, x: 0, y: 0 });
  const [copiedNode, setCopiedNode] = useState<Node | null>(null);
  const isLocked = usePromptDesignStore((state) => state.isCanvasLocked);
  const exportRequest = usePromptDesignStore((state) => state.exportRequest);
  const exportFormat = usePromptDesignStore((state) => state.exportFormat);
  const resetExportRequest = usePromptDesignStore((state) => state.resetExportRequest);
  const edgeType = usePromptDesignStore((state) => state.edgeType);
  const toast = useToast();

  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        type: edgeType,
      }))
    );
  }, [edgeType, setEdges]);

  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...newData,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  useEffect(() => {
    usePromptDesignStore.getState().setUpdateNodeData(updateNodeData);
  }, [updateNodeData]);

  // ── XML 提示词多维度整合引擎 ──
  const handleExport = useCallback(async () => {
    if (nodes.length === 0) {
      toast.warning("画布为空，没有可导出的内容");
      return;
    }

    const dataMap = new Map(nodes.map((n) => [n.id, n.data as PromptNodeData]));

    // 映射所有入边连接
    // targetNodeId -> Record<targetHandleId, string[]>
    const incomingConnections: Record<string, Record<string, string[]>> = {};
    for (const e of edges) {
      if (!incomingConnections[e.target]) {
        incomingConnections[e.target] = {};
      }
      if (!incomingConnections[e.target][e.targetHandle || ""]) {
        incomingConnections[e.target][e.targetHandle || ""] = [];
      }
      incomingConnections[e.target][e.targetHandle || ""].push(e.source);
    }

    // 辅助：获取连接到某句柄的单个节点内容
    const getSingleNodeValue = (targetId: string, handleId: string): string => {
      const sources = incomingConnections[targetId]?.[handleId] || [];
      if (sources.length === 0) return "";
      return dataMap.get(sources[0])?.content || "";
    };

    // 辅助：通用包装区块
    const wrapBlock = (type: PromptCardType, content: string, indent = "", mdLevel = 2): string => {
      const trimmed = content.trim();
      if (!trimmed) return "";
      if (exportFormat === "markdown") {
        const title = cardTypeMeta[type]?.label || type;
        const prefix = "#".repeat(mdLevel);
        return `${prefix} ${title}\n\n${trimmed}`;
      } else {
        // XML 模式
        let tag = type as string;
        if (tag.startsWith("task_")) {
          tag = tag.replace("task_", "");
        }
        if (trimmed.includes("\n")) {
          return `${indent}<${tag}>\n\n${trimmed.split("\n").map(l => `${indent}    ${l}`).join("\n")}\n\n${indent}</${tag}>`;
        }
        return `${indent}<${tag}>${trimmed}</${tag}>`;
      }
    };

    // 寻找根节点 compiler_c (c 最终导出)
    const rootNodes = nodes.filter(n => (n.data as PromptNodeData).nodeType === "compiler_c");
    const rootNode = rootNodes[0];

    // 如果找不到 c 导出卡片，退化为全局卡片搜集
    let systemRoleXML = "";
    let objectiveXML = "";
    let contextXML = "";
    let assumptionsXML = "";
    let constraintsXML = "";
    let definitionsXML = "";
    let variablesXML = "";
    let resourcesXML = "";
    let taskListXML = "";
    let outputFormatXML = "";
    let validationXML = "";
    let inputDataXML = "";

    const variablesSet = new Set<string>();
    for (const n of nodes) {
      if ((n.data as PromptNodeData).variables) {
        (n.data as PromptNodeData).variables!.forEach(v => variablesSet.add(v));
      }
    }

    if (rootNode) {
      const rootId = rootNode.id;
      const rootConns = incomingConnections[rootId] || {};

      // ── c 后置全局 ──
      outputFormatXML = getSingleNodeValue(rootId, "in-format");
      validationXML   = getSingleNodeValue(rootId, "in-validation");
      inputDataXML     = getSingleNodeValue(rootId, "in-input_data");

      // ── b 任务列表 ──
      const taskSources = rootConns["in-tasks"] || [];
      const taskNodesOnCanvas = nodes.filter(n => (n.data as PromptNodeData).nodeType === "task" && taskSources.includes(n.id));

      // 按 TaskID 排序以保持逻辑结构
      const sortedTaskNodes = [...taskNodesOnCanvas].sort((a, b) => {
        const dataA = a.data as PromptNodeData;
        const dataB = b.data as PromptNodeData;
        const idA = dataA.taskId || "";
        const idB = dataB.taskId || "";
        return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
      });

      const taskBlocks: string[] = [];
      let firstGlobalAssemblerId = "";

      for (const task of sortedTaskNodes) {
        const tId = task.id;

        // 解析 Task 各自子属性卡片 (现在它们是平铺节点，通过 target 端口连线获取内容)
        const getConnectedFieldValue = (handleId: string) => {
          return getSingleNodeValue(tId, handleId);
        };

        const titleContent        = getConnectedFieldValue("in-title");
        const goalContent         = getConnectedFieldValue("in-goal");
        const instructionsContent = getConnectedFieldValue("in-instructions");
        const rulesContent        = getConnectedFieldValue("in-rules");
        const priorityContent     = getConnectedFieldValue("in-priority");
        const dependsOnContent    = getConnectedFieldValue("in-depends_on");
        const variablesContent    = getConnectedFieldValue("in-variables");
        const resourcesContent    = getConnectedFieldValue("in-resources");
        const exampleContent      = getConnectedFieldValue("in-example");
        const outputContent       = getConnectedFieldValue("in-output");
        const taskValContent      = getConnectedFieldValue("in-validation");
        const notesContent        = getConnectedFieldValue("in-notes");

        const taskInner: string[] = [];
        if (titleContent)        taskInner.push(wrapBlock("task_title", titleContent, "        ", 3));
        if (goalContent)         taskInner.push(wrapBlock("task_goal", goalContent, "        ", 3));
        if (instructionsContent) taskInner.push(wrapBlock("task_instructions", instructionsContent, "        ", 3));
        if (rulesContent)        taskInner.push(wrapBlock("task_rules", rulesContent, "        ", 3));
        if (priorityContent)     taskInner.push(wrapBlock("task_priority", priorityContent, "        ", 3));
        if (dependsOnContent)    taskInner.push(wrapBlock("task_depends_on", dependsOnContent, "        ", 3));
        if (variablesContent)    taskInner.push(wrapBlock("task_variables", variablesContent, "        ", 3));
        if (resourcesContent)    taskInner.push(wrapBlock("task_resources", resourcesContent, "        ", 3));
        if (exampleContent)      taskInner.push(wrapBlock("task_example", exampleContent, "        ", 3));
        if (outputContent)       taskInner.push(wrapBlock("task_output", outputContent, "        ", 3));
        if (taskValContent)      taskInner.push(wrapBlock("task_validation", taskValContent, "        ", 3));
        if (notesContent)        taskInner.push(wrapBlock("task_notes", notesContent, "        ", 3));

        const taskId = (task.data as PromptNodeData).taskId || "1";
        if (exportFormat === "markdown") {
          const taskMD = `## 任务 ${taskId}\n\n${taskInner.filter(Boolean).join("\n\n")}`;
          taskBlocks.push(taskMD);
        } else {
          const taskXML = `        <task id="${taskId}">\n${taskInner.filter(Boolean).join("\n\n")}\n        </task>`;
          taskBlocks.push(taskXML);
        }
      }

      if (taskBlocks.length > 0) {
        if (exportFormat === "markdown") {
          taskListXML = `# 任务列表\n\n${taskBlocks.join("\n\n")}`;
        } else {
          taskListXML = `    <tasks>\n${taskBlocks.join("\n\n")}\n    </tasks>`;
        }
      }

      // ── a 前置全局 (从组装卡片中解析) ──
      const globalId = firstGlobalAssemblerId || nodes.find(n => (n.data as PromptNodeData).nodeType === "assemble_a")?.id;
      if (globalId) {
        systemRoleXML  = getSingleNodeValue(globalId, "in-system_role");
        objectiveXML   = getSingleNodeValue(globalId, "in-objective");
        contextXML     = getSingleNodeValue(globalId, "in-context");
        assumptionsXML = getSingleNodeValue(globalId, "in-assumptions");
        constraintsXML = getSingleNodeValue(globalId, "in-constraints");
        definitionsXML = getSingleNodeValue(globalId, "in-definitions");
        variablesXML   = getSingleNodeValue(globalId, "in-variables");
        resourcesXML   = getSingleNodeValue(globalId, "in-resources");
      }
    } else {
      // 退化模式：若无 C 卡片连线，则按之前的方式全局提取
      systemRoleXML  = nodes.filter(n => (n.data as PromptNodeData).nodeType === "system_role").map(m => (m.data as PromptNodeData).content || "").join("\n\n");
      objectiveXML   = nodes.filter(n => (n.data as PromptNodeData).nodeType === "objective").map(m => (m.data as PromptNodeData).content || "").join("\n\n");
      contextXML     = nodes.filter(n => (n.data as PromptNodeData).nodeType === "context").map(m => (m.data as PromptNodeData).content || "").join("\n\n");
      assumptionsXML = nodes.filter(n => (n.data as PromptNodeData).nodeType === "assumptions").map(m => (m.data as PromptNodeData).content || "").join("\n\n");
      constraintsXML = nodes.filter(n => (n.data as PromptNodeData).nodeType === "constraints").map(m => (m.data as PromptNodeData).content || "").join("\n\n");
      definitionsXML = nodes.filter(n => (n.data as PromptNodeData).nodeType === "definitions").map(m => (m.data as PromptNodeData).content || "").join("\n\n");
      resourcesXML   = nodes.filter(n => (n.data as PromptNodeData).nodeType === "resources").map(m => (m.data as PromptNodeData).content || "").join("\n\n");
      outputFormatXML= nodes.filter(n => (n.data as PromptNodeData).nodeType === "output_format").map(m => (m.data as PromptNodeData).content || "").join("\n\n");
      validationXML  = nodes.filter(n => (n.data as PromptNodeData).nodeType === "validation").map(m => (m.data as PromptNodeData).content || "").join("\n\n");
      inputDataXML   = nodes.filter(n => (n.data as PromptNodeData).nodeType === "input_data").map(m => (m.data as PromptNodeData).content || "").join("\n\n");

      // 提取任务列表
      const taskBlocks: string[] = [];
      const taskNodesOnCanvas = nodes.filter(n => (n.data as PromptNodeData).nodeType === "task");
      const sortedTaskNodes = [...taskNodesOnCanvas].sort((a, b) => ((a.data as PromptNodeData).taskId || "").localeCompare((b.data as PromptNodeData).taskId || "", undefined, { numeric: true }));
      for (const t of sortedTaskNodes) {
        const tId = t.id;

        const getConnectedFieldValue = (handleId: string) => {
          return getSingleNodeValue(tId, handleId);
        };

        const titleContent        = getConnectedFieldValue("in-title");
        const goalContent         = getConnectedFieldValue("in-goal");
        const instructionsContent = getConnectedFieldValue("in-instructions");
        const outputContent       = getConnectedFieldValue("in-output");

        const taskInner: string[] = [];
        if (titleContent)        taskInner.push(wrapBlock("task_title", titleContent, "        ", 3));
        if (goalContent)         taskInner.push(wrapBlock("task_goal", goalContent, "        ", 3));
        if (instructionsContent) taskInner.push(wrapBlock("task_instructions", instructionsContent, "        ", 3));
        if (outputContent)       taskInner.push(wrapBlock("task_output", outputContent, "        ", 3));

        const taskId = (t.data as PromptNodeData).taskId || "1";
        if (exportFormat === "markdown") {
          taskBlocks.push(`## 任务 ${taskId}\n\n${taskInner.filter(Boolean).join("\n\n")}`);
        } else {
          taskBlocks.push(`        <task id="${taskId}">\n${taskInner.filter(Boolean).join("\n\n")}\n        </task>`);
        }
      }
      if (taskBlocks.length > 0) {
        if (exportFormat === "markdown") {
          taskListXML = `# 任务列表\n\n${taskBlocks.join("\n\n")}`;
        } else {
          taskListXML = `    <tasks>\n${taskBlocks.join("\n\n")}\n    </tasks>`;
        }
      }
    }

    // ── 4. 合成完整的代码 ──
    const globalTags: string[] = [];
    if (systemRoleXML)  globalTags.push(wrapBlock("system_role", systemRoleXML, "    "));
    if (objectiveXML)   globalTags.push(wrapBlock("objective", objectiveXML, "    "));
    if (contextXML)     globalTags.push(wrapBlock("context", contextXML, "    "));
    if (assumptionsXML) globalTags.push(wrapBlock("assumptions", assumptionsXML, "    "));
    if (constraintsXML) globalTags.push(wrapBlock("constraints", constraintsXML, "    "));
    if (definitionsXML) globalTags.push(wrapBlock("definitions", definitionsXML, "    "));

    // 变量
    if (variablesSet.size > 0 || variablesXML) {
      let varInner = variablesXML;
      if (!varInner && variablesSet.size > 0) {
        varInner = Array.from(variablesSet).map(v => `${v} = [请输入 ${v} 的实际定义]`).join("\n");
      }
      if (varInner) globalTags.push(wrapBlock("variables", varInner, "    "));
    }

    if (resourcesXML)   globalTags.push(wrapBlock("resources", resourcesXML, "    "));
    if (taskListXML)    globalTags.push(taskListXML);
    if (outputFormatXML)globalTags.push(wrapBlock("output_format", outputFormatXML, "    "));
    if (validationXML)  globalTags.push(wrapBlock("validation", validationXML, "    "));
    if (inputDataXML)   globalTags.push(wrapBlock("input_data", inputDataXML, "    "));

    const md = exportFormat === "markdown"
      ? globalTags.filter(Boolean).join("\n\n") + "\n"
      : `\`\`\`xml\n<prompt>\n\n${globalTags.filter(Boolean).join("\n\n")}\n\n</prompt>\n\`\`\`\n`;

    const fileExt = exportFormat === "markdown" ? "md" : "md"; // both save as .md, one contains raw markdown, another contains xml codeblock
    const titleExt = exportFormat === "markdown" ? "Markdown" : "XML";

    try {
      if (window.api && (window.api as any).dialog) {
        const result = await (window.api as any).dialog.showSaveDialog(
          {
            title: `导出 ${titleExt} 提示词`,
            defaultPath: `prompt_${exportFormat}_${Date.now()}.${fileExt}`,
            filters: [{ name: "Markdown Files", extensions: ["md"] }],
          }
        );
        if (result && !result.canceled && result.filePath) {
          await (window.api as any).fs.writeFile(
            result.filePath,
            md
          );
          toast.success(`导出成功: ${result.filePath}`);
        }
      } else {
        const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `prompt_${exportFormat}_${Date.now()}.${fileExt}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("导出成功");
      }
    } catch (err) {
      console.error(err);
      toast.error(`导出失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      resetExportRequest();
    }
  }, [nodes, edges, resetExportRequest, toast, exportFormat]);

  useEffect(() => {
    if (exportRequest > 0) {
      handleExport();
    }
  }, [exportRequest, handleExport]);

  const validateNodePlacement = useCallback((type: PromptCardType, _targetTaskNodeId?: string) => {
    const meta = cardTypeMeta[type];
    if (!meta) return null;

    if (meta.category !== "task_field") {
      const repeatableGlobalTypes = ["variables", "resources", "task"];
      if (!repeatableGlobalTypes.includes(type)) {
        const existingGlobal = nodes.find(n => n.data.nodeType === type);
        if (existingGlobal) {
          return `画布中已存在 [${meta.label}]`;
        }
      }
    }
    return null;
  }, [nodes]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const createNewNode = useCallback((type: PromptCardType, position: { x: number; y: number }): Node => {
    let initialInputs: any[] = [];
    let initialOutputs: any[] = [];

    const meta = cardTypeMeta[type];

    if (type === "assemble_a") {
      initialInputs = [
        { id: "in-system_role", name: "系统角色 (System Role)", type: "text" },
        { id: "in-objective", name: "整体目标 (Objective)", type: "text" },
        { id: "in-constraints", name: "全局约束 (Constraints)", type: "text" },
        { id: "in-context", name: "背景上下文 (Context)", type: "text" },
        { id: "in-assumptions", name: "默认假设 (Assumptions)", type: "text" },
        { id: "in-definitions", name: "术语定义 (Definitions)", type: "text" },
        { id: "in-variables", name: "参数变量 (Variables)", type: "text" },
        { id: "in-resources", name: "参考资料 (Resources)", type: "text" },
      ];
      initialOutputs = [{ id: "out-global", name: "打包输出 (Global)", type: "global_config" }];
    } else if (type === "compiler_c") {
      initialInputs = [
        { id: "in-tasks", name: "任务列表 (Tasks)", type: "task" },
        { id: "in-format", name: "输出格式 (Format)", type: "text", handlePosition: "right" },
        { id: "in-validation", name: "全局校验 (Validation)", type: "text", handlePosition: "right" },
        { id: "in-input_data", name: "输入数据 (Input Data)", type: "text", handlePosition: "right" },
      ];
    } else if (type === "task") {
      initialInputs = [
        { id: "in-global", name: "A全局配置 (Global Config)", type: "global_config" },
        { id: "in-title", name: "任务名称 (Title)", type: "text" },
        { id: "in-goal", name: "任务目标 (Goal)", type: "text" },
        { id: "in-instructions", name: "执行步骤 (Instructions)", type: "text" },
        { id: "in-rules", name: "任务规则 (Rules)", type: "text" },
        { id: "in-priority", name: "优先级 (Priority)", type: "text" },
        { id: "in-depends_on", name: "任务依赖 (Depends On)", type: "text" },
        { id: "in-variables", name: "任务参数 (Variables)", type: "text" },
        { id: "in-resources", name: "任务参考 (Resources)", type: "text" },
        { id: "in-example", name: "示例 (Example)", type: "text" },
        { id: "in-output", name: "输出要求 (Output)", type: "text" },
        { id: "in-validation", name: "任务检查 (Validation)", type: "text" },
        { id: "in-notes", name: "补充说明 (Notes)", type: "text" }
      ];
      initialOutputs = [{ id: "out-task", name: "任务整合", type: "task" }];
    } else if (meta && meta.category === "global_a") {
      initialOutputs = [{ id: "out-val", name: "属性输出", type: "text" }];
    } else if (meta && meta.category === "global_c") {
      initialOutputs = [{ id: "out-val", name: "属性输出", type: "text", handlePosition: "left" }];
    } else if (meta && meta.category === "task_field") {
      initialOutputs = [{ id: "out-val", name: "属性输出", type: "text" }];
    }

    return {
      id: `node_${Date.now()}`,
      type: "promptNode",
      position,
      data: {
        title: meta?.label || "新标签卡片",
        nodeType: type,
        inputs: initialInputs.length > 0 ? initialInputs : undefined,
        outputs: initialOutputs.length > 0 ? initialOutputs : undefined,
        content: type === "task" || type === "assemble_a" || type === "compiler_c" ? undefined : "",
      } as PromptNodeData,
    } as Node;
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (isLocked) {
        toast.warning("画布已锁定，无法添加组件");
        return;
      }

      const type = event.dataTransfer.getData("application/reactflow");

      if (typeof type === "undefined" || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const errorMsg = validateNodePlacement(type as PromptCardType, undefined);
      if (errorMsg) {
        toast.warning(errorMsg);
        return;
      }

      takeSnapshot();

      const newNode = createNewNode(type as PromptCardType, position) as Node;
      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, takeSnapshot, createNewNode, isLocked, toast, validateNodePlacement],
  );

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      if (isLocked) return;
      takeSnapshot();
      setEdges((eds) => {
        const sourceNode = nodes.find((n) => n.id === params.source);
        const sourceType = sourceNode?.data?.nodeType;
        const strokeColor = getEdgeColor(sourceType as string);
        return addEdge(
          {
            ...params,
            type: edgeType, // 动态使用 store 中的连接线类型
            animated: true,
            style: { stroke: strokeColor, strokeWidth: 2 },
          } as Edge,
          eds,
        );
      });
    },
    [setEdges, takeSnapshot, isLocked, nodes, edgeType],
  );

  const onNodeDragStart = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  // ── 卡片防重叠逻辑 (碰撞检测与自适应避让) ──
  const onNodeDrag = useCallback(
    (_: any, draggedNode: Node) => {
      if (isLocked) return;

      setNodes((nds) => {
        const padding = 20; // 卡片之间的最小安全间距
        let newNodes = [...nds];

        const getAABB = (n: Node) => {
          const w = n.measured?.width ?? 240;
          const h = n.measured?.height ?? 150;
          const cx = n.position.x + w / 2;
          const cy = n.position.y + h / 2;

          return { w, h, cx, cy };
        };

        // 迭代 3 次，处理“多米诺骨牌”式的链式碰撞 (例如 A推B，B又撞到C)
        for (let iter = 0; iter < 3; iter++) {
          let hasCollision = false;

          for (let i = 0; i < newNodes.length; i++) {
            for (let j = i + 1; j < newNodes.length; j++) {
              const nodeA = newNodes[i];
              const nodeB = newNodes[j];

              if (nodeA.hidden || nodeB.hidden) continue;

              const aabbA = getAABB(nodeA);
              const aabbB = getAABB(nodeB);

              // 中心点距离
              const dx = aabbB.cx - aabbA.cx;
              const dy = aabbB.cy - aabbA.cy;
              
              // 最小安全距离
              const minDistX = aabbA.w / 2 + aabbB.w / 2 + padding;
              const minDistY = aabbA.h / 2 + aabbB.h / 2 + padding;

              // AABB 碰撞检测
              if (Math.abs(dx) < minDistX && Math.abs(dy) < minDistY) {
                hasCollision = true;
                const overlapX = minDistX - Math.abs(dx);
                const overlapY = minDistY - Math.abs(dy);

                // 权重计算：当前正被鼠标拖拽的节点不动(权重0)，受击节点避让(权重1)
                // 如果是其他节点之间发生的次生碰撞，则各分担 50% 避让距离
                let moveA = 0.5;
                let moveB = 0.5;
                
                if (nodeA.id === draggedNode.id) {
                  moveA = 0; moveB = 1;
                } else if (nodeB.id === draggedNode.id) {
                  moveA = 1; moveB = 0;
                }

                // 找出重叠量较小的轴，优先沿该轴推开，实现平滑的“滑开”效果
                if (overlapX < overlapY) {
                  const dirX = dx > 0 ? 1 : -1;
                  newNodes[i] = { ...nodeA, position: { ...nodeA.position, x: nodeA.position.x - overlapX * dirX * moveA } };
                  newNodes[j] = { ...nodeB, position: { ...nodeB.position, x: nodeB.position.x + overlapX * dirX * moveB } };
                } else {
                  const dirY = dy > 0 ? 1 : -1;
                  newNodes[i] = { ...nodeA, position: { ...nodeA.position, y: nodeA.position.y - overlapY * dirY * moveA } };
                  newNodes[j] = { ...nodeB, position: { ...nodeB.position, y: nodeB.position.y + overlapY * dirY * moveB } };
                }
              }
            }
          }
          // 无碰撞则提前中断迭代，提升性能
          if (!hasCollision) break;
        }
        return newNodes;
      });
    },
    [isLocked, setNodes]
  );

  const onNodesDelete = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  const onEdgesDelete = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    if (isLocked) return;
    setMenuState({
      type: "node",
      x: event.clientX,
      y: event.clientY,
      id: node.id,
    });
  }, [isLocked]);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    if (isLocked) return;
    setMenuState({
      type: "edge",
      x: event.clientX,
      y: event.clientY,
      id: edge.id,
    });
  }, [isLocked]);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    if (isLocked) return;
    setMenuState({
      type: "pane",
      x: event.clientX,
      y: event.clientY,
    });
  }, [isLocked]);

  const closeContextMenu = useCallback(() => {
    setMenuState({ type: null, x: 0, y: 0 });
  }, []);

  const handleCopyNode = useCallback((nodeId: string) => {
    const nodeToCopy = nodes.find((n) => n.id === nodeId);
    if (nodeToCopy) {
      setCopiedNode(nodeToCopy);
      toast.success("节点已复制");
    }
  }, [nodes, toast]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    takeSnapshot();
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    toast.info("节点已删除");
  }, [setNodes, setEdges, takeSnapshot, toast]);

  const handlePasteNode = useCallback((clientX: number, clientY: number) => {
    if (!copiedNode) return;

    const type = copiedNode.data.nodeType as PromptCardType;
    const errorMsg = validateNodePlacement(type, undefined);
    if (errorMsg) {
      toast.warning(errorMsg);
      return;
    }

    takeSnapshot();
    const position = screenToFlowPosition({ x: clientX, y: clientY });

    // 复制输入和输出的 ID 使其唯一
    const newData = { ...(copiedNode.data as PromptNodeData) };
    if (newData.inputs) {
      newData.inputs = newData.inputs.map(i => ({ ...i, id: `in_${Date.now()}_${Math.random().toString(36).substring(7)}` }));
    }
    if (newData.outputs) {
      newData.outputs = newData.outputs.map(o => ({ ...o, id: `out_${Date.now()}_${Math.random().toString(36).substring(7)}` }));
    }

    const newNode: Node = {
      ...copiedNode,
      id: `node_${Date.now()}`,
      position,
      selected: false,
      data: newData,
    } as Node;

    // 确保粘贴到画布的节点没有不应该有的 parentId 和 extent
    delete newNode.parentId;
    delete newNode.extent;
    delete newNode.hidden;

    setNodes((nds) => nds.concat(newNode));
    toast.success("节点已粘贴");
  }, [copiedNode, screenToFlowPosition, setNodes, takeSnapshot, toast, validateNodePlacement]);

  const handleAddNodeFromMenu = useCallback((type: PromptCardType, clientX: number, clientY: number) => {
    // 右键菜单添加节点，假设 targetTaskNodeId 始终为 undefined（因为目前菜单在画布空白处触发）
    const errorMsg = validateNodePlacement(type, undefined);
    if (errorMsg) {
      toast.warning(errorMsg);
      return;
    }

    takeSnapshot();
    const position = screenToFlowPosition({ x: clientX, y: clientY });
    const newNode = createNewNode(type, position);
    setNodes((nds) => nds.concat(newNode));
    toast.success("卡片已添加");
  }, [screenToFlowPosition, createNewNode, setNodes, takeSnapshot, toast, validateNodePlacement]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    takeSnapshot();
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    toast.info("连线已删除");
  }, [setEdges, takeSnapshot, toast]);

  // ── Ctrl + S 物理按键监听及极速保存逻辑 ──
  const handleSave = useCallback(async () => {
    if (!activeDesignId) {
      toast.warning("未检测到有效设计项目，无法保存");
      return;
    }

    setIsSaving(true);
    try {
      // 捕获 ReactFlow 最新的画布状态并整体打包
      const payload = {
        designData: {
          nodes,
          edges,
        },
      };

      await (window.api as any).promptDesign.designs.update(activeDesignId, payload);
      toast.success("画布保存成功");
      lastSavedDataRef.current = JSON.stringify({ nodes, edges });
      setIsUnsaved(false);
    } catch (err) {
      console.error("Failed to save design:", err);
      toast.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, activeDesignId, toast]);

  // 将 handleSave 挂载到 window，便于某些页面在卸载时触发自动安全落库
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 完美兼容 Windows (Ctrl) 与 macOS (Cmd / Meta)
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
        e.preventDefault(); // 阻止浏览器/系统默认保存网页弹出窗
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSave]);

  // ── 未选择任何设计项目时，渲染精美空状态 ──
  if (!activeDesignId) {
    return (
      <div className="h-full w-full bg-[#111111] rounded-[6px] flex flex-col items-center justify-center gap-4 text-white/50 select-none border border-white/5" style={{ borderRadius: "6px" }}>
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-white/40">
          <Workflow className="w-6 h-6 animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h3 className="text-sm font-bold text-white/80">未选择设计项目</h3>
          <p className="text-xs text-white/40 max-w-[280px]">
            请在左侧侧边栏中选择已有的提示词，或右键项目新建一个画布
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#111111] rounded-[6px] overflow-hidden" style={{ borderRadius: "6px" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={closeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode="dark"
        minZoom={0.1}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        deleteKeyCode={isLocked ? null : ['Backspace', 'Delete']}
      >
        <Background color="#444" gap={20} size={1} />
        <Panel
          position="top-left"
          className="m-4 bg-[#212121] px-2.5 py-1 border border-white/5 rounded-[6px] flex items-center gap-2 text-xs select-none shadow-lg"
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isSaving ? "bg-amber-400 animate-pulse" : isUnsaved ? "bg-amber-500" : "bg-[#34d399]"
            }`}
          />
          <span className="text-white/80 font-semibold font-mono">
            {isSaving ? "保存中" : isUnsaved ? "未保存" : "已保存"}
          </span>
        </Panel>
        <CanvasControls
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          takeSnapshot={takeSnapshot}
        />
        <MiniMap
          nodeColor={(n) => {
            const t = (n.data as PromptNodeData)?.nodeType as string;
            return minimapColors[t] || "#6366f1";
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
          className="!bg-[#212121] !border-white/10"
          position="top-right"
          nodeComponent={(props: any) => {
            const { x, y, width, height, color, id } = props;
            const node = nodes.find((n) => n.id === id);
            const isTask = (node?.data as PromptNodeData)?.nodeType === "task";

            let rectY = y;
            let rectHeight = height;

            if (isTask) {
              rectY = y - 90;
              rectHeight = height + 135;
            }

            return (
              <rect
                x={x}
                y={rectY}
                width={width}
                height={rectHeight}
                fill={color}
                fillOpacity={1}
                rx={6}
                ry={6}
              />
            );
          }}
        />
        <PromptCanvasContextMenu
          menuState={menuState}
          onClose={closeContextMenu}
          onCopyNode={handleCopyNode}
          onDeleteNode={handleDeleteNode}
          onPasteNode={handlePasteNode}
          onAddNode={handleAddNodeFromMenu}
          onDeleteEdge={handleDeleteEdge}
          canPaste={!!copiedNode}
        />
      </ReactFlow>
    </div>
  );
};
