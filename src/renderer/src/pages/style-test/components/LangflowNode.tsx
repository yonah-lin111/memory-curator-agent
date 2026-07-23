import { Handle, Position } from "@xyflow/react"
import {
  Bot,
  BrainCircuit,
  Database,
  FileText,
  Info,
  Link,
  MessageSquare,
  Settings,
  Wrench,
} from "lucide-react"
import { memo } from "react"

export type LangflowNodeData = {
  title: string
  description?: string
  icon?: string
  inputs?: Array<{ id: string; name: string; type: string }>
  outputs?: Array<{ id: string; name: string; type: string }>
  nodeType?: "agent" | "prompt" | "model" | "tool" | "memory"
}

const iconMap: Record<string, React.ReactNode> = {
  Bot: <Bot className="w-4 h-4" />,
  MessageSquare: <MessageSquare className="w-4 h-4" />,
  FileText: <FileText className="w-4 h-4" />,
  Settings: <Settings className="w-4 h-4" />,
  Database: <Database className="w-4 h-4" />,
  Link: <Link className="w-4 h-4" />,
  BrainCircuit: <BrainCircuit className="w-4 h-4" />,
  Wrench: <Wrench className="w-4 h-4" />,
}

const typeColors: Record<string, string> = {
  agent: "text-indigo-400 bg-indigo-500/20",
  prompt: "text-amber-400 bg-amber-500/20",
  model: "text-emerald-400 bg-emerald-500/20",
  tool: "text-blue-400 bg-blue-500/20",
  memory: "text-purple-400 bg-purple-500/20",
  default: "text-gray-400 bg-gray-500/20",
}

export const LangflowNode = memo(
  ({ data, selected }: { data: LangflowNodeData; selected?: boolean }) => {
    const iconColor = typeColors[data.nodeType || "default"]

    return (
      <div
        className={`group/node relative w-80 rounded-xl border bg-[#1C1C1C] transition-all duration-200 ${
          selected ? "border-white" : "border-transparent"
        } ${!data.outputs || data.outputs.length === 0 ? "pb-4" : ""}`}
      >
        {/* 节点头部 */}
        <div className="flex w-full flex-1 items-center justify-between gap-2 overflow-hidden px-4 py-3 border-b border-white/5">
          <div className="flex items-center overflow-hidden">
            <div
              className={`mr-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${iconColor}`}
            >
              {iconMap[data.icon || ""] || <Settings className="w-4 h-4" />}
            </div>
            <div className="flex flex-1 overflow-hidden">
              <span className="truncate text-sm font-medium text-white/90">{data.title}</span>
            </div>
          </div>
        </div>

        {/* 节点描述 */}
        {data.description && (
          <div className="px-4 pb-3 pt-3 text-xs leading-5 text-white/50">{data.description}</div>
        )}

        {/* 输入与输出参数区 */}
        <div className="relative cursor-auto pointer-events-auto">
          {/* 输入 */}
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
                  <span className="text-sm font-medium text-white/80">{input.name}</span>
                  <Info className="ml-1.5 h-3 w-3 text-white/30 cursor-help" />
                </div>
                <span className="text-[10px] text-white/30 font-mono px-1.5 py-0.5 bg-black/20 rounded">
                  {input.type}
                </span>
              </div>
            </div>
          ))}

          {/* 输出 */}
          {data.outputs?.map((output, idx) => {
            const isLast = idx === data.outputs!.length - 1
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
                  <span className="text-sm font-medium text-white/80">{output.name}</span>
                </div>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={output.id}
                  className="!w-3 !h-3 !border-2 !border-[#1C1C1C] !bg-indigo-400 !-right-1.5 transition-transform hover:scale-125"
                />
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)

LangflowNode.displayName = "LangflowNode"
