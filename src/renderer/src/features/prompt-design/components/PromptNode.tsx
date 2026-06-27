import { memo } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { useToast } from "@/components/ui/Toast";
import {
  Bot,
  User,
  MessageSquare,
  FileText,
  Settings,
  Settings2,
  Database,
  BrainCircuit,
  Wrench,
  Info,
  GitBranch,
  RefreshCw,
  CornerDownRight,
  Hash,
  StickyNote,
  FolderOpen,
  Layers,
  X,
} from "lucide-react";

/** 提示词卡片类型 */
export type PromptCardType =
  | "system"
  | "user"
  | "assistant"
  | "tool_message"
  | "template"
  | "context"
  | "assemble"
  | "condition"
  | "loop"
  | "output"
  | "variable"
  | "comment"
  | "group";

/** 卡片类型元数据 */
export type CardTypeMeta = {
  label: string;
  defaultIcon: string;
  color: string;
  isIndependent: boolean;
};

export const cardTypeMeta: Record<PromptCardType, CardTypeMeta> = {
  system:       { label: "系统指令",    defaultIcon: "Settings2",        color: "text-rose-400 bg-rose-500/20",       isIndependent: false },
  user:         { label: "用户消息",    defaultIcon: "User",             color: "text-sky-400 bg-sky-500/20",         isIndependent: false },
  assistant:    { label: "助手消息",    defaultIcon: "Bot",              color: "text-emerald-400 bg-emerald-500/20",  isIndependent: false },
  tool_message: { label: "工具消息",    defaultIcon: "Wrench",           color: "text-blue-400 bg-blue-500/20",        isIndependent: false },
  template:     { label: "模板片段",    defaultIcon: "FileText",         color: "text-amber-400 bg-amber-500/20",      isIndependent: false },
  context:      { label: "上下文注入",  defaultIcon: "Database",         color: "text-purple-400 bg-purple-500/20",    isIndependent: false },
  assemble:     { label: "消息组装",    defaultIcon: "Layers",           color: "text-teal-400 bg-teal-500/20",        isIndependent: false },
  condition:    { label: "条件分支",    defaultIcon: "GitBranch",        color: "text-orange-400 bg-orange-500/20",    isIndependent: false },
  loop:         { label: "循环迭代",    defaultIcon: "RefreshCw",        color: "text-cyan-400 bg-cyan-500/20",        isIndependent: false },
  output:       { label: "输出终点",    defaultIcon: "CornerDownRight",  color: "text-lime-400 bg-lime-500/20",        isIndependent: false },
  variable:     { label: "变量定义",    defaultIcon: "Hash",             color: "text-yellow-400 bg-yellow-500/20",    isIndependent: true },
  comment:      { label: "注释说明",    defaultIcon: "StickyNote",       color: "text-gray-400 bg-gray-500/20",        isIndependent: true },
  group:        { label: "卡片分组",    defaultIcon: "FolderOpen",       color: "text-zinc-400 bg-zinc-500/20",        isIndependent: true },
};

export const iconMap: Record<string, React.ReactNode> = {
  Bot:              <Bot className="w-4 h-4" />,
  User:             <User className="w-4 h-4" />,
  MessageSquare:    <MessageSquare className="w-4 h-4" />,
  FileText:         <FileText className="w-4 h-4" />,
  Settings:         <Settings className="w-4 h-4" />,
  Settings2:        <Settings2 className="w-4 h-4" />,
  Database:         <Database className="w-4 h-4" />,
  BrainCircuit:     <BrainCircuit className="w-4 h-4" />,
  Wrench:           <Wrench className="w-4 h-4" />,
  GitBranch:        <GitBranch className="w-4 h-4" />,
  RefreshCw:        <RefreshCw className="w-4 h-4" />,
  CornerDownRight:  <CornerDownRight className="w-4 h-4" />,
  Hash:             <Hash className="w-4 h-4" />,
  StickyNote:       <StickyNote className="w-4 h-4" />,
  FolderOpen:       <FolderOpen className="w-4 h-4" />,
  Layers:           <Layers className="w-4 h-4" />,
};

export type PromptNodeData = {
  title: string;
  description?: string;
  nodeType: PromptCardType;
  icon?: string;
  inputs?: Array<{ id: string; name: string; type: string }>;
  outputs?: Array<{ id: string; name: string; type: string }>;
  content?: string;
  variables?: string[];
};

/** @see cardTypeMeta */
export const isIndependentType = (t: PromptCardType): boolean =>
  cardTypeMeta[t].isIndependent;

const baseIcon = <Settings className="w-4 h-4" />;

export const PromptNode = memo(
  ({ id, data, selected }: { id: string; data: PromptNodeData; selected?: boolean }) => {
    const { deleteElements } = useReactFlow();
    const toast = useToast();
    const meta = cardTypeMeta[data.nodeType];
    const iconName = data.icon || meta.defaultIcon;
    const hasOutputs = data.outputs && data.outputs.length > 0;

    const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteElements({ nodes: [{ id }] });
      toast.info("节点已删除");
    };

    return (
      <div
        className={`group/node relative w-80 rounded-xl border bg-[#1C1C1C] transition-all duration-200 ${
          meta.isIndependent
            ? "border-dashed border-white/10"
            : selected
              ? "border-white"
              : "border-transparent"
        } ${meta.isIndependent || !hasOutputs ? "pb-4" : ""}`}
      >
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

        {/* 节点头部 */}
        <div className="flex w-full flex-1 items-center gap-2 overflow-hidden px-4 py-3 border-b border-white/5">
          <div className={`mr-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${meta.color}`}>
            {iconMap[iconName] || baseIcon}
          </div>
          <div className="flex flex-1 overflow-hidden">
            <span className="truncate text-sm font-medium text-white/90">
              {data.title}
            </span>
          </div>
          <span className={`ml-auto flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded ${meta.color}`}>
            {meta.label}
          </span>
        </div>

        {/* 节点描述 */}
        {data.description && (
          <div className="px-4 pb-3 pt-3 text-xs leading-5 text-white/50">
            {data.description}
          </div>
        )}

        {/* 提示词正文 */}
        {data.content && (
          <div className="px-4 py-2 mx-3 mb-3 bg-black/20 border border-white/5 rounded text-xs font-mono text-white/60 whitespace-pre-wrap leading-relaxed">
            {data.content}
          </div>
        )}

        {/* 引用变量标签 */}
        {data.variables && data.variables.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1">
            {data.variables.map((v) => (
              <span
                key={v}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 font-mono"
              >
                {`{{${v}}}`}
              </span>
            ))}
          </div>
        )}

        {/* 输入输出端口（仅连线型卡片） */}
        {!meta.isIndependent && (
          <div className="relative cursor-auto pointer-events-auto">
            {data.inputs?.map((input) => (
              <div
                key={input.id}
                className="relative flex min-h-10 w-full flex-wrap items-center justify-between px-5 py-2 hover:bg-white/[0.02] transition-colors"
              >
                <Handle
                  type="target"
                  position={Position.Left}
                  id={input.id}
                  className="!w-3 !h-3 !border-2 !border-[#1C1C1C] !bg-indigo-400 !-left-1.5 transition-transform hover:scale-125"
                />
                <div className="flex w-full items-center justify-between text-sm">
                  <div className="flex w-full items-center truncate">
                    <span className="text-sm font-medium text-white/80">
                      {input.name}
                    </span>
                    <Info className="ml-1.5 h-3 w-3 text-white/30 cursor-help" />
                  </div>
                  <span className="text-[10px] text-white/30 font-mono px-1.5 py-0.5 bg-black/20 rounded">
                    {input.type}
                  </span>
                </div>
              </div>
            ))}

            {data.outputs?.map((output, idx) => {
              const isLast = idx === data.outputs!.length - 1;
              return (
                <div
                  key={output.id}
                  className={`relative flex min-h-11 w-full flex-wrap items-center justify-between px-5 py-2 transition-colors ${
                    isLast ? "rounded-b-xl" : "border-b border-white/5"
                  }`}
                >
                  <div className="flex w-full items-center justify-end truncate text-sm">
                    <span className="text-[10px] text-white/30 font-mono px-1.5 py-0.5 bg-white/5 rounded mr-2">
                      {output.type}
                    </span>
                    <span className="text-sm font-medium text-white/80">
                      {output.name}
                    </span>
                  </div>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={output.id}
                    className="!w-3 !h-3 !border-2 !border-[#1C1C1C] !bg-indigo-400 !-right-1.5 transition-transform hover:scale-125"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);

PromptNode.displayName = "PromptNode";
