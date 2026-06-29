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
  system:       "#fb7185",
  user:         "#38bdf8",
  assistant:    "#34d399",
  tool_message: "#60a5fa",
  template:     "#fbbf24",
  context:      "#c084fc",
  assemble:     "#2dd4bf",
  condition:    "#fb923c",
  loop:         "#22d3ee",
  output:       "#a3e635",
  variable:     "#facc15",
  comment:      "#9ca3af",
  group:        "#a1a1aa",
};

const rawInitialNodes = [
  /* ── 独立卡片 ── */
  {
    id: "var-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "{{framework}}",
      description: "前端框架变量",
      nodeType: "variable",
      variables: ["framework"],
    } as PromptNodeData,
  },
  {
    id: "cmt-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "设计备忘",
      nodeType: "comment",
      content: "这是一个用于生成【登录功能】代码的提示词流程：\n结合了技术栈变量、系统角色定义以及接口文档上下文。",
    } as PromptNodeData,
  },

  /* ── 连线卡片：系统角色 ── */
  {
    id: "sys-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "前端专家角色",
      description: "设定 AI 的前端开发角色",
      nodeType: "system",
      content: "你是一个资深的前端开发工程师，精通 {{framework}}，擅长编写安全、优雅且符合现代 UI 规范的登录组件。",
      variables: ["framework"],
      outputs: [
        { id: "out-sys", name: "System", type: "message/system" },
      ],
    } as PromptNodeData,
  },

  /* ── 上下文注入 ── */
  {
    id: "ctx-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "API 接口与设计规范",
      description: "注入后端登录接口文档",
      nodeType: "context",
      outputs: [
        { id: "out-ctx", name: "Context", type: "context" },
      ],
    } as PromptNodeData,
  },

  /* ── 用户任务 ── */
  {
    id: "tpl-task",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "登录表单需求",
      nodeType: "template",
      content: "请实现一个登录页面。要求：\n1. 包含邮箱和密码输入框，并支持表单校验；\n2. 包含“记住我”复选框和“忘记密码”链接；\n3. 提交时调用上下文中提供的登录接口，处理 loading 状态与错误提示。\n\n技术栈限定：{{framework}} + {{ui_library}}",
      variables: ["framework", "ui_library"],
      outputs: [
        { id: "out-task", name: "User Task", type: "message/user" },
      ],
    } as PromptNodeData,
  },

  /* ── 其他演示卡片：用户、助手、工具、组、条件、循环 ── */
  {
    id: "usr-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "补充用户输入",
      description: "用户的实际提问",
      nodeType: "user",
      content: "我需要你基于这个登录组件的规范，生成一份可用的代码，并且给出详细注释。",
      outputs: [
        { id: "out-usr", name: "User", type: "message/user" },
      ],
    } as PromptNodeData,
  },
  {
    id: "ast-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "助手预设回复",
      description: "设定助手的默认思考/引导",
      nodeType: "assistant",
      content: "好的，我已经理解了您的需求。接下来我将分析上下文：\n1. 您提供的登录接口包含邮箱和密码校验...\n2. 前端框架选用 {{framework}}...",
      variables: ["framework"],
      outputs: [
        { id: "out-ast", name: "Assistant", type: "message/assistant" },
      ],
    } as PromptNodeData,
  },
  {
    id: "tool-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "文件读取工具",
      description: "读取本地组件库规范文件",
      nodeType: "tool_message",
      content: "{\n  \"components\": [\"Button\", \"Input\", \"Checkbox\"],\n  \"style\": \"TailwindCSS\"\n}",
      outputs: [
        { id: "out-tool", name: "Tool", type: "message/tool" },
      ],
    } as PromptNodeData,
  },
  {
    id: "cond-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "是否需要移动端适配",
      description: "根据需求判断代码生成逻辑",
      nodeType: "condition",
      content: "if ({{ui_library}} === 'Ant Design Mobile')",
      variables: ["ui_library"],
      inputs: [
        { id: "in-cond", name: "Input", type: "any" },
      ],
      outputs: [
        { id: "out-cond-true", name: "分支 1 (True)", type: "branch" },
        { id: "out-cond-false", name: "分支 2 (False)", type: "branch" },
      ],
    } as PromptNodeData,
  },
  {
    id: "loop-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "遍历错误码字典",
      description: "生成所有接口错误处理逻辑",
      nodeType: "loop",
      content: "for each error_code in {{error_codes}}",
      variables: ["error_codes"],
      inputs: [
        { id: "in-loop", name: "Input", type: "any" },
      ],
      outputs: [
        { id: "out-loop", name: "Output", type: "any" },
      ],
    } as PromptNodeData,
  },
  {
    id: "grp-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "安全相关约束组",
      description: "安全与审计要求的集合",
      nodeType: "group",
      content: "- 密码传输必须使用 HTTPS\n- 密码在前端不进行任何哈希计算\n- 对登录失败进行防暴破限流提示",
      outputs: [
        { id: "out-grp", name: "Group", type: "any" },
      ],
    } as PromptNodeData,
  },

  /* ── 消息组装 ── */
  {
    id: "asm-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "消息组装",
      description: "按序拼接登录功能提示词",
      nodeType: "assemble",
      inputs: [
        { id: "in-asm-sys", name: "角色设定", type: "message/system" },
        { id: "in-asm-ctx", name: "接口文档", type: "context" },
        { id: "in-asm-grp", name: "安全约束", type: "any" },
        { id: "in-asm-task", name: "具体需求", type: "message/user" },
        { id: "in-asm-tool", name: "工具结果", type: "message/tool" },
        { id: "in-asm-cond", name: "条件分支", type: "branch" },
        { id: "in-asm-usr", name: "用户补充", type: "message/user" },
        { id: "in-asm-ast", name: "助手引导", type: "message/assistant" },
      ],
      outputs: [
        { id: "out-asm", name: "Messages", type: "messages" },
      ],
    } as PromptNodeData,
  },

  /* ── 输出终点 ── */
  {
    id: "out-1",
    type: "promptNode",
    position: { x: 0, y: 0 },
    data: {
      title: "最终提示词",
      nodeType: "output",
      inputs: [
        { id: "in-out", name: "Messages", type: "messages" },
      ],
    } as PromptNodeData,
  },
];

const rawInitialEdges: Edge[] = [
  { id: "e-sys-asm",   source: "sys-1",     target: "asm-1", sourceHandle: "out-sys",   targetHandle: "in-asm-sys" },
  { id: "e-ctx-asm",   source: "ctx-1",     target: "asm-1", sourceHandle: "out-ctx",   targetHandle: "in-asm-ctx" },
  { id: "e-grp-asm",   source: "grp-1",     target: "asm-1", sourceHandle: "out-grp",   targetHandle: "in-asm-grp" },
  { id: "e-task-asm",  source: "tpl-task",  target: "asm-1", sourceHandle: "out-task",  targetHandle: "in-asm-task" },
  { id: "e-tool-asm",  source: "tool-1",    target: "asm-1", sourceHandle: "out-tool",  targetHandle: "in-asm-tool" },
  { id: "e-loop-cond", source: "loop-1",    target: "cond-1", sourceHandle: "out-loop",  targetHandle: "in-cond" },
  { id: "e-cond-asm",  source: "cond-1",    target: "asm-1", sourceHandle: "out-cond-true", targetHandle: "in-asm-cond" },
  { id: "e-usr-asm",   source: "usr-1",     target: "asm-1", sourceHandle: "out-usr",   targetHandle: "in-asm-usr" },
  { id: "e-ast-asm",   source: "ast-1",     target: "asm-1", sourceHandle: "out-ast",   targetHandle: "in-asm-ast" },
  { id: "e-asm-out",   source: "asm-1",     target: "out-1", sourceHandle: "out-asm",   targetHandle: "in-out" },
].map((e) => ({
  ...e,
  animated: true,
  style: { stroke: "#818cf8", strokeWidth: 2 },
}));

// 初始化时即进行一次排版
const { nodes: initialNodes, edges: initialEdges } = getLayoutedElements(
  rawInitialNodes,
  rawInitialEdges,
  "LR"
);

export const PromptCanvas = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();

  const [menuState, setMenuState] = useState<ContextMenuState>({ type: null, x: 0, y: 0 });
  const [copiedNode, setCopiedNode] = useState<Node | null>(null);
  const isLocked = usePromptDesignStore((state) => state.isCanvasLocked);
  const exportRequest = usePromptDesignStore((state) => state.exportRequest);
  const resetExportRequest = usePromptDesignStore((state) => state.resetExportRequest);
  const toast = useToast();

  const handleExport = useCallback(async () => {
    if (nodes.length === 0) {
      toast.warning("画布为空，没有可导出的内容");
      return;
    }

    // ── 数据结构准备 ──
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const dataMap = new Map(nodes.map((n) => [n.id, n.data as PromptNodeData]));

    const outgoing = new Map<string, Edge[]>();
    const incoming = new Map<string, Edge[]>();
    for (const e of edges) {
      if (!outgoing.has(e.source)) outgoing.set(e.source, []);
      outgoing.get(e.source)!.push(e);
      if (!incoming.has(e.target)) incoming.set(e.target, []);
      incoming.get(e.target)!.push(e);
    }

    // ── 从 Output 节点反向 BFS 找出连通子图 ──
    const outputIds = nodes
      .filter((n) => dataMap.get(n.id)?.nodeType === "output")
      .map((n) => n.id);
    const connected = new Set<string>();
    const bfsQueue: string[] = outputIds.length > 0 ? [...outputIds] : [...nodes.map((n) => n.id)];
    while (bfsQueue.length) {
      const id = bfsQueue.shift()!;
      if (connected.has(id)) continue;
      connected.add(id);
      for (const e of incoming.get(id) || []) bfsQueue.push(e.source);
      // 若没有 output 节点，则也正向扩展使所有节点可见
      if (outputIds.length === 0)
        for (const e of outgoing.get(id) || []) bfsQueue.push(e.target);
    }

    // ── 拓扑排序 (Kahn) —— 叶子先、Output 最后 ──
    const inDegree = new Map<string, number>();
    for (const id of connected) {
      const ins = (incoming.get(id) || []).filter((e) => connected.has(e.source));
      inDegree.set(id, ins.length);
    }
    const topoOrder: string[] = [];
    const deg0: string[] = [];
    for (const [id, d] of inDegree) if (d === 0) deg0.push(id);
    while (deg0.length) {
      const id = deg0.shift()!;
      topoOrder.push(id);
      for (const e of outgoing.get(id) || []) {
        if (!connected.has(e.target)) continue;
        const nd = (inDegree.get(e.target) || 1) - 1;
        inDegree.set(e.target, nd);
        if (nd === 0) deg0.push(e.target);
      }
    }
    // 兜底：因环等原因未入列的节点直接追加
    for (const id of connected) if (!topoOrder.includes(id)) topoOrder.push(id);

    // ── 显示映射 ──
    const TYPE_LABEL: Record<string, string> = {
      system: "SYSTEM", user: "USER", assistant: "ASSISTANT",
      context: "CONTEXT", template: "TEMPLATE", variable: "VARIABLE",
      assemble: "ASSEMBLE", condition: "CONDITION", loop: "LOOP",
      output: "OUTPUT", comment: "COMMENT", tool_message: "TOOL",
      group: "GROUP",
    };
    const TYPE_CN: Record<string, string> = {
      system: "系统角色", user: "用户消息", assistant: "助手消息",
      context: "上下文", template: "模板", variable: "变量",
      assemble: "组装", condition: "条件", loop: "循环",
      output: "输出", comment: "注释", tool_message: "工具消息",
      group: "分组",
    };

    // ── 工具函数 ──
    const mId = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, "_");
    const esc = (s: string) =>
      s.replace(/"/g, "'").replace(/\n/g, " ").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const hName = (data: PromptNodeData, handleId: string | null | undefined, isInput: boolean) => {
      if (!handleId) return "?";
      const list = isInput ? data.inputs : data.outputs;
      return list?.find((h) => h.id === handleId)?.name || handleId;
    };

    let md = `# 提示词架构导出\n\n`;
    md += `> 导出时间: ${new Date().toLocaleString()}\n`;
    md += `> 节点: ${nodes.length} | 连线: ${edges.length} | 连通节点: ${connected.size}\n\n`;

    // ═══════ Mermaid 架构图 ═══════
    md += `## 架构图\n\n\`\`\`mermaid\nflowchart LR\n`;
    for (const node of nodes) {
      const d = dataMap.get(node.id);
      const title = esc(d?.title || node.id);
      const tag = TYPE_LABEL[d?.nodeType || ""] || (d?.nodeType || "").toUpperCase();
      const mid = mId(node.id);
      if (d?.nodeType === "output") md += `  ${mid}(["${title}<br/>${tag}"])\n`;
      else if (d?.nodeType === "condition") md += `  ${mid}{{"${title}<br/>${tag}"}}\n`;
      else md += `  ${mid}["${title}<br/>${tag}"]\n`;
    }
    for (const e of edges) {
      const src = mId(e.source);
      const tgt = mId(e.target);
      const lbl = esc(hName(dataMap.get(e.source)!, e.sourceHandle, false));
      md += `  ${src} -- "${lbl}" --> ${tgt}\n`;
    }
    md += `\`\`\`\n\n`;

    // ═══════ 连通流程 (拓扑序) ═══════
    md += `## 完整流程\n\n`;

    for (const id of topoOrder) {
      const d = dataMap.get(id);
      if (!d) continue;
      const tag = TYPE_LABEL[d.nodeType] || d.nodeType;
      const cn = TYPE_CN[d.nodeType] || d.nodeType;

      md += `### ${d.title || id}  \`[${tag}]\`\n`;
      md += `> **ID** \`${id}\` | **类型** ${cn}`;
      if (d.description) md += ` | ${d.description}`;
      md += `\n\n`;

      if (d.content) {
        const multiline = d.content.includes("\n");
        if (multiline) md += `\`\`\`\n${d.content}\n\`\`\`\n\n`;
        else md += `${d.content}\n\n`;
      }

      if (d.variables?.length) {
        md += `> 变量: ${d.variables.map((v) => `\`${v}\``).join(", ")}\n\n`;
      }

      // ── 输入 ──
      const ins = (incoming.get(id) || []).filter((e) => connected.has(e.source));
      const outs = (outgoing.get(id) || []).filter((e) => connected.has(e.target));

      if (d.nodeType === "assemble" && d.inputs) {
        md += `**输入插槽**:\n\n| # | 插槽 | 类型 | 来源 |\n|---|------|------|------|\n`;
        for (let i = 0; i < d.inputs.length; i++) {
          const slot = d.inputs[i];
          const edge = ins.find((e) => e.targetHandle === slot.id);
          if (edge) {
            const srcD = dataMap.get(edge.source);
            md += `| ${i + 1} | ${slot.name} | \`${slot.type}\` | ${srcD?.title || edge.source} (\`${edge.source}\`) |\n`;
          } else {
            md += `| ${i + 1} | ${slot.name} | \`${slot.type}\` | *未连接* |\n`;
          }
        }
        md += "\n";
      } else if (ins.length > 0) {
        md += "**输入**:\n";
        for (const e of ins) {
          const srcD = dataMap.get(e.source);
          md += `- ${hName(d, e.targetHandle, true)} ← **${srcD?.title || e.source}** (\`${e.source}\`)\n`;
        }
        md += "\n";
      }

      // ── 输出 (条件节点特殊处理分支) ──
      if (d.nodeType === "condition" && d.outputs) {
        md += "**分支输出**:\n";
        for (const branch of d.outputs) {
          const edge = outs.find((e) => e.sourceHandle === branch.id);
          if (edge) {
            const tgtD = dataMap.get(edge.target);
            md += `- ✅ **${branch.name}** → **${tgtD?.title || edge.target}** (\`${edge.target}\`) | 插槽: ${hName(dataMap.get(edge.target)!, edge.targetHandle, true)}\n`;
          } else {
            md += `- ❌ **${branch.name}** → *未连接*\n`;
          }
        }
        md += "\n";
      } else if (outs.length > 0) {
        md += "**输出**:\n";
        for (const e of outs) {
          const tgtD = dataMap.get(e.target);
          md += `- ${hName(d, e.sourceHandle, false)} → **${tgtD?.title || e.target}** (\`${e.target}\`) | 插槽: ${hName(dataMap.get(e.target)!, e.targetHandle, true)}\n`;
        }
        md += "\n";
      }

      if (ins.length === 0 && outs.length === 0) {
        md += "*无连接*\n\n";
      }

      md += "---\n\n";
    }

    // ═══════ 未连接节点 ═══════
    const orphans = nodes.filter((n) => !connected.has(n.id));
    if (orphans.length > 0) {
      md += `## 未连接节点\n\n`;
      for (const node of orphans) {
        const d = dataMap.get(node.id);
        if (!d) continue;
        const tag = TYPE_LABEL[d.nodeType] || d.nodeType;
        md += `### ${d.title || node.id}  \`[${tag}]\`\n`;
        md += `> **ID** \`${node.id}\` | **类型** ${TYPE_CN[d.nodeType] || d.nodeType}`;
        if (d.description) md += ` | ${d.description}`;
        md += `\n\n`;
        if (d.content) md += `\`\`\`\n${d.content}\n\`\`\`\n\n`;
        if (d.variables?.length)
          md += `> 变量: ${d.variables.map((v) => `\`${v}\``).join(", ")}\n\n`;
        md += "---\n\n";
      }
    }

    // ═══════ 写出文件 ═══════
    try {
      if ("showSaveFilePicker" in window) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: `prompt-export-${Date.now()}.md`,
          types: [
            {
              description: "Markdown File",
              accept: { "text/markdown": [".md"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(md);
        await writable.close();
        toast.success("提示词导出成功");
      } else {
        const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `prompt-export-${Date.now()}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error("导出失败: " + err.message);
      }
    }
  }, [nodes, edges, toast]);
  
  useEffect(() => {
    if (exportRequest > 0) {
      handleExport();
      resetExportRequest();
    }
  }, [exportRequest, handleExport, resetExportRequest]);

  const { undo, redo, canUndo, canRedo, takeSnapshot } = useFlowHistory(
    nodes,
    edges,
    setNodes,
    setEdges
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const createNewNode = useCallback((type: PromptCardType, position: { x: number; y: number }) => {
    let initialInputs: any[] = [];
    let initialOutputs: any[] = [];

    const meta = cardTypeMeta[type as PromptCardType];
    if (meta && !meta.isIndependent) {
      if (type === "condition") {
        initialInputs = [{ id: `in_${Date.now()}`, name: "Input", type: "any" }];
        initialOutputs = [
          { id: `branch_true_${Date.now()}`, name: "分支 1", type: "branch" },
          { id: `branch_false_${Date.now()}`, name: "分支 2", type: "branch" },
        ];
      } else if (type === "system" || type === "context") {
        initialOutputs = [{ id: `out_${Date.now()}`, name: "Output", type: "any" }];
      } else if (type === "output") {
        initialInputs = [{ id: `in_${Date.now()}`, name: "Input", type: "any" }];
      } else if (type === "assemble") {
        initialInputs = [
          { id: `in_1_${Date.now()}`, name: "Input 1", type: "any" },
          { id: `in_2_${Date.now()}`, name: "Input 2", type: "any" }
        ];
        initialOutputs = [{ id: `out_${Date.now()}`, name: "Output", type: "any" }];
      } else {
        initialInputs = [{ id: `in_${Date.now()}`, name: "Input", type: "any" }];
        initialOutputs = [{ id: `out_${Date.now()}`, name: "Output", type: "any" }];
      }
    }

    return {
      id: `node_${Date.now()}`,
      type: "promptNode",
      position,
      data: {
        title: meta?.label || "新卡片",
        nodeType: type,
        inputs: initialInputs.length > 0 ? initialInputs : undefined,
        outputs: initialOutputs.length > 0 ? initialOutputs : undefined,
      } as PromptNodeData,
    };
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

      takeSnapshot();

      const newNode = createNewNode(type as PromptCardType, position);
      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, takeSnapshot, createNewNode, isLocked, toast],
  );

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      if (isLocked) return;
      takeSnapshot();
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "#818cf8", strokeWidth: 2 },
          } as Edge,
          eds,
        ),
      );
    },
    [setEdges, takeSnapshot, isLocked],
  );

  const onNodeDragStart = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

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
    };

    setNodes((nds) => nds.concat(newNode));
    toast.success("节点已粘贴");
  }, [copiedNode, screenToFlowPosition, setNodes, takeSnapshot, toast]);

  const handleAddNodeFromMenu = useCallback((type: PromptCardType, clientX: number, clientY: number) => {
    takeSnapshot();
    const position = screenToFlowPosition({ x: clientX, y: clientY });
    const newNode = createNewNode(type, position);
    setNodes((nds) => nds.concat(newNode));
    toast.success("卡片已添加");
  }, [screenToFlowPosition, createNewNode, setNodes, takeSnapshot, toast]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    takeSnapshot();
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    toast.info("连线已删除");
  }, [setEdges, takeSnapshot, toast]);

  return (
    <div className="h-full w-full bg-[#111111] rounded-[6px] overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeDragStart={onNodeDragStart}
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
            const t = n.data?.nodeType as string;
            return minimapColors[t] || "#6366f1";
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
          className="!bg-[#212121] !border-white/10"
          position="top-right"
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
