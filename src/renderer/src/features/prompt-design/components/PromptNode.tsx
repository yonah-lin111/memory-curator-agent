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
} from "lucide-react";

/** 提示词卡片类型 */
export type PromptCardType =
  | "template"
  | "context"
  | "condition"
  | "loop"
  | "output"
  | "variable"
  | "comment"
  | "requirement"
  | "role";

/** 
 * 卡片类型元数据 
 * 
 * 卡片设计定位及使用场景：
 * 
 * 1. 内容定义类（构建提示词的主体）：
 * - role (角色设定): 流程起点，设定 AI 的人设、技能栈和语气 (如："你是一个资深 React 架构师")。
 * - context (上下文注入): 提供 AI 完成任务所需的背景知识、前置规则或参考文档 (如：API文档、设计规范)。
 * - requirement (业务需求): 清晰描述具体要 AI 执行的任务目标 (如："实现一个带分页的数据表格")。
 * - template (模板片段): 通用的内容组装块，用于格式要求、补充说明等 (如："请只输出代码，不带解释")。
 * 
 * 2. 逻辑控制类（让提示词具备动态变化能力）：
 * - condition (条件分支): 根据前置条件决定提示词的拼接走向 (如："是否生成测试"，True 拼接测试要求，False 拼接 Mock 数据)。
 * - loop (循环迭代): 指示 AI 对一组数据执行重复操作的指令包装。
 * 
 * 3. 终点类：
 * - output (输出终点): 所有连线的归宿，负责将连入的碎片合并成最终发送给大模型的完整提示词。
 * 
 * 4. 变量与辅助类（独立存在，isIndependent: true）：
 * - variable (变量定义): 定义运行时动态传入的占位符 (如：{{framework}})。
 * - comment (注释说明): 仅供设计者阅读的便签，不参与最终提示词生成。
 */
export type CardTypeMeta = {
  label: string;
  defaultIcon: string;
  color: string;
  isIndependent: boolean;
};

export const cardTypeMeta: Record<PromptCardType, CardTypeMeta> = {
  template:     { label: "模板片段",    defaultIcon: "FileText",         color: "text-amber-400 bg-amber-500/20",      isIndependent: false },
  context:      { label: "上下文注入",  defaultIcon: "Database",         color: "text-purple-400 bg-purple-500/20",    isIndependent: false },
  condition:    { label: "条件分支",    defaultIcon: "GitBranch",        color: "text-orange-400 bg-orange-500/20",    isIndependent: false },
  loop:         { label: "循环迭代",    defaultIcon: "RefreshCw",        color: "text-cyan-400 bg-cyan-500/20",        isIndependent: false },
  output:       { label: "输出终点",    defaultIcon: "CornerDownRight",  color: "text-lime-400 bg-lime-500/20",        isIndependent: false },
  variable:     { label: "变量定义",    defaultIcon: "Hash",             color: "text-yellow-400 bg-yellow-500/20",    isIndependent: true },
  comment:      { label: "注释说明",    defaultIcon: "StickyNote",       color: "text-gray-400 bg-gray-500/20",        isIndependent: true },
  requirement:  { label: "业务需求",    defaultIcon: "FolderOpen",       color: "text-blue-400 bg-blue-500/20",        isIndependent: false },
  role:         { label: "角色设定",    defaultIcon: "User",             color: "text-pink-400 bg-pink-500/20",        isIndependent: false },
};

export const iconMap: Record<string, React.ReactNode> = {
  FileText:         <FileText className="w-4 h-4" />,
  Database:         <Database className="w-4 h-4" />,
  GitBranch:        <GitBranch className="w-4 h-4" />,
  RefreshCw:        <RefreshCw className="w-4 h-4" />,
  CornerDownRight:  <CornerDownRight className="w-4 h-4" />,
  Hash:             <Hash className="w-4 h-4" />,
  StickyNote:       <StickyNote className="w-4 h-4" />,
  FolderOpen:       <FolderOpen className="w-4 h-4" />,
  User:             <User className="w-4 h-4" />,
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
    const isLocked = usePromptDesignStore((state) => state.isCanvasLocked);
    const meta = cardTypeMeta[data.nodeType];
    const iconName = data.icon || meta.defaultIcon;
    const hasOutputs = data.outputs && data.outputs.length > 0;

    const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isLocked) return;
      deleteElements({ nodes: [{ id }] });
      toast.info("节点已删除");
    };

    return (
      <div
        className={`group/node relative w-[240px] rounded-xl border bg-[#1C1C1C] transition-all duration-200 ${
          meta.isIndependent
            ? "border-dashed border-white/10"
            : selected && !isLocked
              ? "border-white"
              : "border-transparent"
        } ${meta.isIndependent || !hasOutputs ? "pb-2" : ""}`}
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
        {data.content && (
          <div className="px-2.5 py-1.5 mx-2 mb-2 bg-black/20 border border-white/5 rounded text-[10px] font-mono text-white/60 line-clamp-2">
            {data.content}
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

        {/* 输入输出端口（仅连线型卡片） */}
        {!meta.isIndependent && (
          <div className="relative cursor-auto pointer-events-auto">
            {data.inputs?.map((input) => (
              <div
                key={input.id}
                className="relative flex min-h-8 w-full flex-wrap items-center justify-between px-3 py-1 hover:bg-white/[0.02] transition-colors"
              >
                <Handle
                  type="target"
                  position={Position.Left}
                  id={input.id}
                  className="!w-2.5 !h-2.5 !border-2 !border-[#1C1C1C] !bg-indigo-400 !-left-1.5 transition-transform hover:scale-125"
                />
                <div className="flex w-full items-center justify-between text-xs">
                  <div className="flex w-full items-center truncate">
                    <span className="text-xs font-medium text-white/80">
                      {input.name}
                    </span>
                    <Info className="ml-1 h-2.5 w-2.5 text-white/30 cursor-help" />
                  </div>
                  <span className="text-[9px] text-white/30 font-mono px-1 py-0.5 bg-black/20 rounded">
                    {input.type}
                  </span>
                </div>
              </div>
            ))}

            {data.outputs?.map((output, idx) => {
              const isLast = idx === data.outputs!.length - 1;
              // 条件节点的输出分别给 True(绿色) 和 False(红色) 的特殊样式
              let handleColor = "!bg-indigo-400";
              if (data.nodeType === "condition") {
                if (output.id === "out-true") handleColor = "!bg-emerald-400";
                if (output.id === "out-false") handleColor = "!bg-rose-400";
              }

              return (
                <div
                  key={output.id}
                  className={`relative flex min-h-8 w-full flex-wrap items-center justify-between px-3 py-1 transition-colors ${
                    isLast ? "rounded-b-xl" : "border-b border-white/5"
                  }`}
                >
                  <div className="flex w-full items-center justify-end truncate text-xs">
                    <span className="text-[9px] text-white/30 font-mono px-1 py-0.5 bg-white/5 rounded mr-1.5">
                      {output.type}
                    </span>
                    <span className="text-xs font-medium text-white/80">
                      {output.name}
                    </span>
                  </div>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={output.id}
                    className={`!w-2.5 !h-2.5 !border-2 !border-[#1C1C1C] ${handleColor} !-right-1.5 transition-transform hover:scale-125`}
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
