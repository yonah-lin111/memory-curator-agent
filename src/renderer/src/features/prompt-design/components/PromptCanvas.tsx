import { useState, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
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
import { getLayoutedElements } from "../utils/layout";
import { CanvasControls } from "./CanvasControls";
import { useFlowHistory } from "../hooks/useFlowHistory";
import { PromptCanvasContextMenu, type ContextMenuState } from "./PromptCanvasContextMenu";
import { useToast } from "@/components/ui/Toast";
import { usePromptDesignStore } from "../store/promptDesignStore";

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

export const PromptCanvas = () => {
  const activeDesignId = usePromptDesignStore((state) => state.activeDesignId);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition } = useReactFlow();
  const { takeSnapshot, undo, redo, canUndo, canRedo } = useFlowHistory(nodes, edges, setNodes, setEdges);

  // ── 监听 activeDesignId 动态加载该设计的节点与连线 ──
  useEffect(() => {
    const loadDesignData = async () => {
      if (!activeDesignId) {
        setNodes([]);
        setEdges([]);
        return;
      }
      try {
        const list = await (window.api as any).promptDesign.designs.list();
        const current = list.find((d: any) => d.id === activeDesignId);
        if (current && current.designData) {
          const { nodes: loadedNodes = [], edges: loadedEdges = [] } = current.designData;
          setNodes(loadedNodes);
          setEdges(loadedEdges);
        } else {
          setNodes([]);
          setEdges([]);
        }
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
        const taskConns = incomingConnections[tId] || {};

        // 寻找相连的 a 组装卡片
        const globalSources = taskConns["in-global"] || [];
        if (globalSources.length > 0) {
          firstGlobalAssemblerId = globalSources[0];
        }

        // 解析 Task 各自子属性卡片 (现在它们是子节点，不在连线里找，而是通过 parentId 找)
        const childNodes = nodes.filter(n => n.parentId === tId);
        
        const getChildValue = (type: PromptCardType) => {
           const n = childNodes.find(c => c.data.nodeType === type);
           return n ? (n.data as PromptNodeData).content || "" : "";
        };

        const titleContent        = getChildValue("task_title");
        const goalContent         = getChildValue("task_goal");
        const instructionsContent = getChildValue("task_instructions");
        const rulesContent        = getChildValue("task_rules");
        const priorityContent     = getChildValue("task_priority");
        const dependsOnContent    = getChildValue("task_depends_on");
        const variablesContent    = getChildValue("task_variables");
        const resourcesContent    = getChildValue("task_resources");
        const exampleContent      = getChildValue("task_example");
        const outputContent       = getChildValue("task_output");
        const taskValContent      = getChildValue("task_validation");
        const notesContent        = getChildValue("task_notes");

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
        
        // 退化模式下也需要从子节点读取
        const childNodes = nodes.filter(n => n.parentId === tId);
        const getChildValue = (type: PromptCardType) => {
           const n = childNodes.find(c => c.data.nodeType === type);
           return n ? (n.data as PromptNodeData).content || "" : "";
        };

        const titleContent        = getChildValue("task_title");
        const goalContent         = getChildValue("task_goal");
        const instructionsContent = getChildValue("task_instructions");
        const outputContent       = getChildValue("task_output");

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

  const validateNodePlacement = useCallback((type: PromptCardType, targetTaskNodeId?: string) => {
    const meta = cardTypeMeta[type];
    if (!meta) return null;
    
    if (meta.category === "task_field") {
      if (!targetTaskNodeId) {
        return "任务属性卡片只能添加到任务容器中";
      }
      const existingChild = nodes.find(n => n.parentId === targetTaskNodeId && n.data.nodeType === type);
      if (existingChild) {
        return `该任务容器中已存在 [${meta.label}]`;
      }
    } else {
      if (targetTaskNodeId) {
        return "全局卡片或任务容器不能嵌套在任务容器中";
      }
      
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
        isCollapsed: type === "task" ? true : undefined,
        expandedHeight: type === "task" ? 600 : undefined,
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

      // 检查是否落入 Task 容器中
      const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
      let targetTaskNodeId: string | undefined;

      if (elementBelow) {
        // 向上寻找是否有 class 包含 "react-flow__node-promptNode" 的元素
        const nodeEl = elementBelow.closest('.react-flow__node-promptNode');
        if (nodeEl) {
          const nodeId = nodeEl.getAttribute('data-id');
          if (nodeId) {
            const targetNode = nodes.find(n => n.id === nodeId);
            if (targetNode && targetNode.data.nodeType === "task") {
              targetTaskNodeId = nodeId;
            }
          }
        }
      }

      const errorMsg = validateNodePlacement(type as PromptCardType, targetTaskNodeId);
      if (errorMsg) {
        toast.warning(errorMsg);
        return;
      }

      takeSnapshot();
      
      const meta = cardTypeMeta[type as PromptCardType];
      // 如果拖拽的是 task 属性卡片，并且拖到了某个 Task 容器中
      if (targetTaskNodeId && meta && meta.category === "task_field") {
        // 作为子节点加入
        const newNode = createNewNode(type as PromptCardType, position) as Node;
        newNode.parentId = targetTaskNodeId;
        newNode.extent = "parent";
        // 相对坐标计算：可以基于目前鼠标落点。这里简化为居中或者直接用 Flow position减去父节点position (暂用 0, 0 会被容器自动排版或手动拖动)
        const parentNode = nodes.find(n => n.id === targetTaskNodeId);
        if (parentNode) {
          newNode.position = {
            x: position.x - parentNode.position.x,
            y: position.y - parentNode.position.y
          };
          if (parentNode.data.isCollapsed) {
            newNode.hidden = true;
          }
        }

        setNodes((nds) => nds.concat(newNode));
        toast.success(`已添加到容器 ${parentNode?.data.title}`);
      } else {
         const newNode = createNewNode(type as PromptCardType, position) as Node;
         if (type === "task") {
           // 对于容器，赋予它足够的宽高，并设置独立样式或在渲染端控制
           newNode.style = { width: 500, height: 10 };
         }
         setNodes((nds) => nds.concat(newNode));
      }
    },
    [screenToFlowPosition, setNodes, takeSnapshot, createNewNode, isLocked, toast, nodes, validateNodePlacement],
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
          const isTask = (n.data as PromptNodeData)?.nodeType === "task";
          const baseWidth = n.measured?.width ?? (typeof n.style?.width === 'number' ? n.style.width : (isTask ? 500 : 300));
          let baseHeight = n.measured?.height ?? (typeof n.style?.height === 'number' ? n.style.height : (isTask ? 10 : 150));
          
          if (isTask && typeof n.style?.height !== 'number' && typeof n.measured?.height !== 'number') {
            baseHeight = (n.data as PromptNodeData).isCollapsed ? 10 : ((n.data as PromptNodeData).expandedHeight || 600);
          }

          // task 容器在 PromptNode 中有 absolute 定位的 header (上偏) 和 footer (下偏)，它们不包含在 ReactFlow 的 baseHeight 内。
          // header 大约高 90px，footer 大约高 45px
          const headerOffset = isTask ? 90 : 0;
          const footerOffset = isTask ? 45 : 0;

          const w = baseWidth;
          const h = baseHeight + headerOffset + footerOffset;
          const cx = n.position.x + w / 2;
          const cy = n.position.y - headerOffset + h / 2;
          
          return { w, h, cx, cy };
        };

        // 迭代 3 次，处理“多米诺骨牌”式的链式碰撞 (例如 A推B，B又撞到C)
        for (let iter = 0; iter < 3; iter++) {
          let hasCollision = false;
          
          for (let i = 0; i < newNodes.length; i++) {
            for (let j = i + 1; j < newNodes.length; j++) {
              const nodeA = newNodes[i];
              const nodeB = newNodes[j];
              
              // 忽略嵌套在容器内(Task)的子节点，或被隐藏的节点
              if (nodeA.parentId || nodeB.parentId || nodeA.hidden || nodeB.hidden) continue;
              
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

    const elementBelow = document.elementFromPoint(clientX, clientY);
    let targetTaskNodeId: string | undefined;

    if (elementBelow) {
      const nodeEl = elementBelow.closest('.react-flow__node-promptNode');
      if (nodeEl) {
        const nodeId = nodeEl.getAttribute('data-id');
        if (nodeId) {
          const targetNode = nodes.find(n => n.id === nodeId);
          if (targetNode && targetNode.data.nodeType === "task") {
            targetTaskNodeId = nodeId;
          }
        }
      }
    }

    const type = copiedNode.data.nodeType as PromptCardType;
    const errorMsg = validateNodePlacement(type, targetTaskNodeId);
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

    if (targetTaskNodeId && cardTypeMeta[type]?.category === "task_field") {
      newNode.parentId = targetTaskNodeId;
      newNode.extent = "parent";
      const parentNode = nodes.find(n => n.id === targetTaskNodeId);
      if (parentNode) {
        newNode.position = {
          x: position.x - parentNode.position.x,
          y: position.y - parentNode.position.y
        };
        if (parentNode.data.isCollapsed) {
          newNode.hidden = true;
        }
      }
    } else {
      // 确保粘贴到画布的节点没有不应该有的 parentId 和 extent
      delete newNode.parentId;
      delete newNode.extent;
      delete newNode.hidden;
    }

    setNodes((nds) => nds.concat(newNode));
    toast.success("节点已粘贴");
  }, [copiedNode, screenToFlowPosition, setNodes, takeSnapshot, toast, nodes, validateNodePlacement]);

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
    } catch (err) {
      console.error("Failed to save design:", err);
      toast.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
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
