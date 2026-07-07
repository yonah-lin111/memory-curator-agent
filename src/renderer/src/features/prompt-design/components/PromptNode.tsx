import { memo } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { useToast } from "@/components/ui/Toast";
import { usePromptDesignStore } from "../store/promptDesignStore";
import {
  User,
  FileText,
  Settings,
  Database,
  Info,
  GitBranch,
  RefreshCw,
  CornerDownRight,
  Hash,
  StickyNote,
  FolderOpen,
  X,
  Sparkles,
  Braces,
  Ban,
  Target,
  BookOpen,
  HelpCircle,
  FileCode,
  CheckSquare,
  Workflow,
  Layers,
  Sliders,
  Send,
} from "lucide-react";

/** 提示词卡片类型 - 完全映射自企业级 XML 规范 */
export type PromptCardType =
  // ── 全局配置类 (a) ──
  | "system_role"     // <system_role>
  | "objective"       // <objective>
  | "context"         // <context>
  | "assumptions"     // <assumptions>
  | "constraints"     // <constraints>
  | "definitions"     // <definitions>
  | "variables"       // <variables>
  | "resources"       // <resources>
  // ── 组装与终点 ──
  | "assemble_a"      // a组装卡片
  | "compiler_c"      // c最终导出
  // ── 任务容器 (b) ──
  | "task"            // <task id="...">
  // ── 任务属性类 ──
  | "task_title"       // <title>
  | "task_goal"        // <goal>
  | "task_instructions"// <instructions>
  | "task_rules"       // <rules>
  | "task_priority"    // <priority>
  | "task_depends_on"  // <depends_on>
  | "task_variables"   // <variables>
  | "task_resources"   // <resources>
  | "task_example"     // <example>
  | "task_output"      // <output>
  | "task_validation"  // <validation>
  | "task_notes"       // <notes>
  // ── 后置全局配置类 (c) ──
  | "output_format"   // <output_format>
  | "validation"      // <validation>
  | "input_data";     // <input_data>

/**
 * 卡片类型元数据
 */
export type CardTypeMeta = {
  label: string;
  defaultIcon: string;
  color: string;
  isIndependent: boolean;
  category: "global_a" | "assemble" | "task_b" | "task_field" | "global_c";
};

export const cardTypeMeta: Record<PromptCardType, CardTypeMeta> = {
  // ── 全局配置类 (a) ──
  system_role: {
    label: "系统角色",
    defaultIcon: "User",
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    isIndependent: false,
    category: "global_a",
  },
  objective: {
    label: "整体目标",
    defaultIcon: "Target",
    color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    isIndependent: false,
    category: "global_a",
  },
  context: {
    label: "背景上下文",
    defaultIcon: "Database",
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    isIndependent: false,
    category: "global_a",
  },
  assumptions: {
    label: "默认假设",
    defaultIcon: "HelpCircle",
    color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    isIndependent: false,
    category: "global_a",
  },
  constraints: {
    label: "全局约束",
    defaultIcon: "Ban",
    color: "text-red-400 bg-red-500/10 border-red-500/20",
    isIndependent: false,
    category: "global_a",
  },
  definitions: {
    label: "术语定义",
    defaultIcon: "BookOpen",
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    isIndependent: false,
    category: "global_a",
  },
  variables: {
    label: "参数变量",
    defaultIcon: "Hash",
    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    isIndependent: true,
    category: "global_a",
  },
  resources: {
    label: "参考资料",
    defaultIcon: "FileText",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    isIndependent: false,
    category: "global_a",
  },

  // ── 组装与终点 ──
  assemble_a: {
    label: "a全局组装",
    defaultIcon: "Sliders",
    color: "text-orange-400 bg-orange-500/15 border-orange-500/30",
    isIndependent: false,
    category: "assemble",
  },
  compiler_c: {
    label: "c最终导出",
    defaultIcon: "Send",
    color: "text-lime-400 bg-lime-500/15 border-lime-500/30",
    isIndependent: false,
    category: "assemble",
  },

  // ── 任务容器 (b) ──
  task: {
    label: "任务容器",
    defaultIcon: "Workflow",
    color: "text-fuchsia-400 bg-fuchsia-500/15 border-fuchsia-500/30",
    isIndependent: false,
    category: "task_b",
  },

  // ── 任务属性类 ──
  task_title: {
    label: "任务名称",
    defaultIcon: "Layers",
    color: "text-slate-300 bg-slate-500/10 border-slate-500/20",
    isIndependent: false,
    category: "task_field",
  },
  task_goal: {
    label: "任务目标",
    defaultIcon: "Target",
    color: "text-slate-300 bg-slate-500/10 border-slate-500/20",
    isIndependent: false,
    category: "task_field",
  },
  task_instructions: {
    label: "执行步骤",
    defaultIcon: "FileText",
    color: "text-slate-300 bg-slate-500/10 border-slate-500/20",
    isIndependent: false,
    category: "task_field",
  },
  task_rules: {
    label: "任务规则",
    defaultIcon: "Ban",
    color: "text-slate-300 bg-slate-500/10 border-slate-500/20",
    isIndependent: false,
    category: "task_field",
  },
  task_priority: {
    label: "优先级",
    defaultIcon: "Info",
    color: "text-slate-300 bg-slate-500/10 border-slate-500/20",
    isIndependent: false,
    category: "task_field",
  },
  task_depends_on: {
    label: "任务依赖",
    defaultIcon: "GitBranch",
    color: "text-slate-300 bg-slate-500/10 border-slate-500/20",
    isIndependent: false,
    category: "task_field",
  },
  task_variables: {
    label: "任务参数",
    defaultIcon: "Hash",
    color: "text-slate-300 bg-slate-500/10 border-slate-500/20",
    isIndependent: false,
    category: "task_field",
  },
  task_resources: {
    label: "任务参考",
    defaultIcon: "BookOpen",
    color: "text-slate-300 bg-slate-500/10 border-slate-500/20",
    isIndependent: false,
    category: "task_field",
  },
  task_example: {
    label: "示例(Fewshot)",
    defaultIcon: "Sparkles",
    color: "text-slate-300 bg-slate-500/10 border-slate-500/20",
    isIndependent: false,
    category: "task_field",
  },
  task_output: {
    label: "输出要求",
    defaultIcon: "CornerDownRight",
    color: "text-slate-300 bg-slate-500/10 border-slate-500/20",
    isIndependent: false,
    category: "task_field",
  },
  task_validation: {
    label: "任务检查",
    defaultIcon: "CheckSquare",
    color: "text-slate-300 bg-slate-500/10 border-slate-500/20",
    isIndependent: false,
    category: "task_field",
  },
  task_notes: {
    label: "补充说明",
    defaultIcon: "StickyNote",
    color: "text-slate-300 bg-slate-500/10 border-slate-500/20",
    isIndependent: false,
    category: "task_field",
  },

  // ── 后置全局配置类 (c) ──
  output_format: {
    label: "输出格式",
    defaultIcon: "Braces",
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    isIndependent: false,
    category: "global_c",
  },
  validation: {
    label: "全局校验",
    defaultIcon: "CheckSquare",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    isIndependent: false,
    category: "global_c",
  },
  input_data: {
    label: "输入数据",
    defaultIcon: "FileCode",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    isIndependent: false,
    category: "global_c",
  },
};

export const iconMap: Record<string, React.ReactNode> = {
  User: <User className="w-4 h-4" />,
  FileText: <FileText className="w-4 h-4" />,
  Settings: <Settings className="w-4 h-4" />,
  Database: <Database className="w-4 h-4" />,
  Info: <Info className="w-4 h-4" />,
  GitBranch: <GitBranch className="w-4 h-4" />,
  RefreshCw: <RefreshCw className="w-4 h-4" />,
  CornerDownRight: <CornerDownRight className="w-4 h-4" />,
  Hash: <Hash className="w-4 h-4" />,
  StickyNote: <StickyNote className="w-4 h-4" />,
  FolderOpen: <FolderOpen className="w-4 h-4" />,
  Sparkles: <Sparkles className="w-4 h-4" />,
  Braces: <Braces className="w-4 h-4" />,
  Ban: <Ban className="w-4 h-4" />,
  Target: <Target className="w-4 h-4" />,
  BookOpen: <BookOpen className="w-4 h-4" />,
  HelpCircle: <HelpCircle className="w-4 h-4" />,
  FileCode: <FileCode className="w-4 h-4" />,
  CheckSquare: <CheckSquare className="w-4 h-4" />,
  Workflow: <Workflow className="w-4 h-4" />,
  Layers: <Layers className="w-4 h-4" />,
  Sliders: <Sliders className="w-4 h-4" />,
  Send: <Send className="w-4 h-4" />,
};

export type PromptNodeData = {
  title: string;
  description?: string;
  nodeType: PromptCardType;
  icon?: string;
  inputs?: Array<{ id: string; name: string; type: string; handlePosition?: "left" | "right" }>;
  outputs?: Array<{ id: string; name: string; type: string; handlePosition?: "left" | "right" }>;
  content?: string;
  variables?: string[];
  taskId?: string; // 用于 task 容器卡片的 ID 编号
  isCollapsed?: boolean;
  expandedHeight?: number;
};

/** @see cardTypeMeta */
export const isIndependentType = (t: PromptCardType): boolean =>
  cardTypeMeta[t].isIndependent;

const baseIcon = <Settings className="w-4 h-4" />;

export const PromptNode = memo(
  ({ id, data, selected }: { id: string; data: PromptNodeData; selected?: boolean }) => {
    const { deleteElements } = useReactFlow();
    const toast = useToast();
    const isLocked = usePromptDesignStore((state) => state.isCanvasLocked);
    const meta = cardTypeMeta[data.nodeType];
    const iconName = data.icon || meta.defaultIcon;
    const hasOutputs = data.outputs && data.outputs.length > 0;
    const handleColorClass = meta.color.split(' ').find(c => c.startsWith('text-'))?.replace('text-', '!bg-') || '!bg-indigo-400';

    const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isLocked) return;
      deleteElements({ nodes: [{ id }] });
      toast.info("节点已删除");
    };

    const nodeBorderColor = meta.isIndependent
      ? "border-dashed border-white/20"
      : selected && !isLocked
        ? "border-white"
        : "border-white/20";

    return (
      <div
        className={`group/node relative rounded-[6px] border bg-[#1C1C1C] transition-all duration-200 ${nodeBorderColor} ${
          meta.isIndependent || !hasOutputs ? "pb-2" : ""
        } ${meta.category === 'task_field' ? 'shadow-lg bg-[#252525] w-[210px]' : data.nodeType === 'task' ? 'w-[280px]' : 'w-[240px]'}`}
        style={{ borderRadius: "6px" }}
      >
        {!isLocked && (
          <button
            type="button"
            aria-label="Delete node"
            onClick={handleDelete}
            className={`absolute -top-1.5 -right-1.5 z-10 h-4 w-4 items-center justify-center rounded-full bg-white text-[#1C1C1C] shadow-md hover:bg-gray-200 transition-colors ${
              selected ? "flex" : "hidden group-hover/node:flex"
            }`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}

        {/* 节点头部 */}
        <div className="flex w-full flex-1 items-center gap-1.5 overflow-hidden px-2.5 py-2 border-b border-white/5">
          <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[4px] ${meta.color}`}>
            {iconMap[iconName] || baseIcon}
          </div>
          <div className="flex flex-1 overflow-hidden">
            <span className="truncate text-xs font-medium text-white/90">
              {data.title}
            </span>
          </div>
          <span className={`ml-auto flex-shrink-0 text-[9px] px-1 py-0.5 rounded ${meta.color}`}>
            {meta.label}
          </span>
        </div>

        {/* 节点描述 */}
        {data.description && (
          <div className="px-2.5 pb-2 pt-2 text-[10px] leading-4 text-white/50 truncate">
            {data.description}
          </div>
        )}

        {/* 提示词正文 */}
        {data.content !== undefined && (
          <div className="px-2.5 py-1.5 mx-2 mb-2 mt-2 bg-black/40 border border-white/5 rounded text-[10px] font-mono text-white/80 whitespace-pre-wrap">
            {data.content || <span className="text-white/20 italic">双击输入内容...</span>}
          </div>
        )}

        {/* 引用变量标签 */}
        {data.variables && data.variables.length > 0 && (
          <div className="px-2.5 pb-2 flex flex-wrap gap-1">
            {data.variables.map((v) => (
              <span
                key={v}
                className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-white/50 font-mono"
              >
                {`{{${v}}}`}
              </span>
            ))}
          </div>
        )}

        {/* 输入输出端口（仅连线型卡片，容器内部的子卡片不需要连线） */}
        {!meta.isIndependent && (
          <div className="relative cursor-auto pointer-events-auto">
            {(() => {
              const allPorts = [
                ...(data.inputs || []).map((p) => ({ ...p, kind: "input" as const })),
                ...(data.outputs || []).map((p) => ({ ...p, kind: "output" as const })),
              ];

              // 将 c最终导出 (compiler_c) 的右侧端口排在上方，左侧的排在底部
              if (data.nodeType === "compiler_c") {
                const rightPorts = allPorts.filter((p) => p.handlePosition === "right");
                const leftPorts = allPorts.filter((p) => p.handlePosition !== "right");
                allPorts.length = 0;
                allPorts.push(...rightPorts, ...leftPorts);
              }

              return allPorts.map((port, idx) => {
                const isLast = idx === allPorts.length - 1;
                const borderClass = isLast
                  ? "rounded-b-[6px]"
                  : "border-b border-white/5";

                // 对于 input，默认 handle 在左边；但如果指定了 right，则渲染在右边，文字靠右（类似传统的 output 样式）
                const isHandleLeft = port.kind === "input" ? port.handlePosition !== "right" : port.handlePosition === "left";

                if (isHandleLeft) {
                  return (
                    <div
                      key={port.id}
                      className={`relative flex min-h-8 w-full flex-wrap items-center justify-between px-3 py-1 hover:bg-white/[0.02] transition-colors ${borderClass}`}
                    >
                      <Handle
                        type={port.kind === "input" ? "target" : "source"}
                        position={Position.Left}
                        id={port.id}
                        className={`!w-2.5 !h-2.5 !border-2 !border-[#1C1C1C] ${handleColorClass} !-left-1.5 transition-transform hover:scale-125`}
                      />
                      <div className="flex w-full items-center justify-between text-xs">
                        <div className="flex w-full items-center truncate">
                          <span className="text-[11px] font-medium text-white/85">
                            {port.name}
                          </span>
                        </div>
                        <span className="text-[9px] text-white/30 font-mono px-1 py-0.5 bg-black/20 rounded">
                          {port.type}
                        </span>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div
                      key={port.id}
                      className={`relative flex min-h-8 w-full flex-wrap items-center justify-between px-3 py-1 hover:bg-white/[0.02] transition-colors ${borderClass}`}
                    >
                      <div className="flex w-full items-center justify-end truncate text-xs">
                        <span className="text-[9px] text-white/30 font-mono px-1 py-0.5 bg-white/5 rounded mr-1.5">
                          {port.type}
                        </span>
                        <span className="text-[11px] font-medium text-white/85">
                          {port.name}
                        </span>
                      </div>
                      <Handle
                        type={port.kind === "input" ? "target" : "source"}
                        position={Position.Right}
                        id={port.id}
                        className={`!w-2.5 !h-2.5 !border-2 !border-[#1C1C1C] ${handleColorClass} !-right-1.5 transition-transform hover:scale-125`}
                      />
                    </div>
                  );
                }
              });
            })()}
          </div>
        )}
      </div>
    );
  },
);

PromptNode.displayName = "PromptNode";
