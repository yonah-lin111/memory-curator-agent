import type React from "react";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  User,
  Bot,
  Wrench,
  FileText,
  Brain,
  Maximize2,
  Minimize2,
  ChevronsUpDown,
  ChevronsDownUp,
} from "lucide-react";
import type { AiChatMessage } from "@/features/ai-chat/types";
import type {
  AiChatContextBudget,
  AiChatContextItem,
} from "@/features/ai-chat/aiChatContextBuilder";

// AI 对话上下文时间线组件属性类型。
type AiChatContextTimelineProps = {
  // 当前会话上下文条目。
  items: AiChatContextItem[];
  // 当前上下文预算。
  budget: AiChatContextBudget;
  // 当前会话的原始消息列表。
  messages?: AiChatMessage[];
  // 是否全屏展示（替代原本聊天列表）
  isFullscreen?: boolean;
  // 切换全屏显示的回调。
  onToggleFullscreen?: () => void;
};

// QA 回合条目结构。
type QaTurn = {
  // 回合唯一标识。
  id: string;
  // 用户提问消息上下文（可选）。
  userMessage?: AiChatContextItem;
  // 助手回答消息上下文（可选）。
  assistantMessage?: AiChatContextItem;
  // 此回合调用的工具。
  tools: AiChatContextItem[];
  // 此回合注入的辅助上下文。
  injectedContexts: AiChatContextItem[];
  // 总估算 token 数。
  tokens: number;
  // 创建时间。
  createdAt: number;
};

/**
 * 将平铺的上下文条目聚合为 QA 回合。
 */
const groupItemsByQaTurn = (items: AiChatContextItem[]): QaTurn[] => {
  const sorted = [...items].sort((a, b) => a.createdAt - b.createdAt);
  const turns: QaTurn[] = [];
  let currentTurn: QaTurn | null = null;
  let pendingInjected: AiChatContextItem[] = [];

  const finalizeCurrentTurn = () => {
    if (currentTurn) {
      turns.push(currentTurn);
      currentTurn = null;
    }
  };

  for (const item of sorted) {
    if (item.kind === "message") {
      const role = item.meta?.role;
      if (role === "user") {
        finalizeCurrentTurn();
        currentTurn = {
          id: item.key,
          userMessage: item,
          tools: [],
          injectedContexts: [...pendingInjected],
          tokens: item.tokens,
          createdAt: item.createdAt,
        };
        pendingInjected = [];
      } else if (role === "assistant") {
        if (!currentTurn) {
          currentTurn = {
            id: item.key,
            assistantMessage: item,
            tools: [],
            injectedContexts: [...pendingInjected],
            tokens: item.tokens,
            createdAt: item.createdAt,
          };
          pendingInjected = [];
        } else {
          currentTurn.assistantMessage = item;
          currentTurn.tokens += item.tokens;
        }
      } else {
        if (currentTurn) {
          currentTurn.injectedContexts.push(item);
          currentTurn.tokens += item.tokens;
        } else {
          pendingInjected.push(item);
        }
      }
    } else if (item.kind === "tool") {
      if (currentTurn) {
        currentTurn.tools.push(item);
        currentTurn.tokens += item.tokens;
      } else {
        pendingInjected.push(item);
      }
    } else {
      if (currentTurn) {
        currentTurn.injectedContexts.push(item);
        currentTurn.tokens += item.tokens;
      } else {
        pendingInjected.push(item);
      }
    }
  }

  finalizeCurrentTurn();

  if (pendingInjected.length > 0) {
    turns.unshift({
      id: "preset-context",
      tools: [],
      injectedContexts: pendingInjected,
      tokens: pendingInjected.reduce((sum, i) => sum + i.tokens, 0),
      createdAt: pendingInjected[0].createdAt,
    });
  }

  return turns;
};

/**
 * AiChatContextTimeline - 以两个聊天列表形式展示在消息列表右侧的上下文调试时间线。
 */
export const AiChatContextTimeline = ({
  items,
  budget,
  messages = [],
  isFullscreen = false,
  onToggleFullscreen,
}: AiChatContextTimelineProps): React.JSX.Element => {
  const [expandedTurns, setExpandedTurns] = useState<Record<string, boolean>>({});
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [expandedParams, setExpandedParams] = useState<Record<string, boolean>>({});
  const [isAllExpanded, setIsAllExpanded] = useState<boolean>(false);

  const toolCount = items.filter((item) => item.kind === "tool").length;
  void budget;

  // 将平铺的数据分组为结构化的 QA 回合
  const turns = groupItemsByQaTurn(items);

  // 展开/折叠指定回合
  const toggleTurn = (turnId: string) => {
    setExpandedTurns((prev) => ({
      ...prev,
      [turnId]: !prev[turnId],
    }));
  };

  // 展开/折叠指定节点内容详情
  const toggleNode = (nodeKey: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeKey]: !prev[nodeKey],
    }));
  };

  // 展开/折叠工具参数 JSON
  const toggleParam = (nodeKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedParams((prev) => ({
      ...prev,
      [nodeKey]: !prev[nodeKey],
    }));
  };

  // 一键展开/折叠所有回合
  const handleToggleAll = () => {
    const nextState = !isAllExpanded;
    setIsAllExpanded(nextState);
    const nextStates: Record<string, boolean> = {};
    for (const t of turns) {
      nextStates[t.id] = nextState;
    }
    setExpandedTurns(nextStates);
  };

  return (
    <div
      className={`flex-shrink-0 flex flex-col min-h-0 bg-[#161616]/40 p-4 text-xs text-white/55 overflow-y-auto custom-scrollbar select-none ${
        isFullscreen ? "flex-1" : "w-[360px] lg:w-[420px] border-l border-white/5"
      }`}
      aria-label="AI Chat Context Timeline"
    >
      {/* 上下文概览统计 */}
      <div className="mb-2.5 flex items-center justify-between border-b border-white/5 pb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="font-medium text-white/80">上下文时间线</div>
          <div className="text-white/35">·</div>
          <div>{turns.length} 轮 QA</div>
          <div className="text-white/35">·</div>
          <div>{toolCount} 个工具</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {turns.length > 0 && (
            <button
              onClick={handleToggleAll}
              title={isAllExpanded ? "折叠全部" : "展开全部"}
              aria-label={isAllExpanded ? "Collapse all turns" : "Expand all turns"}
              className="text-white/35 hover:text-white transition-colors p-1 rounded hover:bg-white/5 cursor-pointer"
            >
              {isAllExpanded ? (
                <ChevronsDownUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              title={isFullscreen ? "恢复窗口" : "全屏查看"}
              aria-label={isFullscreen ? "Restore layout" : "Fullscreen timeline"}
              className="text-white/35 hover:text-white transition-colors p-1 rounded hover:bg-white/5 cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 时间线列表 */}
      {turns.length === 0 ? (
        <div className="text-white/35 py-8 text-center flex-1 flex flex-col items-center justify-center">
          暂无上下文记录
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
          {turns.map((turn, index) => {
            const isExpanded =
              expandedTurns[turn.id] !== undefined
                ? expandedTurns[turn.id]
                : index === turns.length - 1;

            // 回合标题提炼
            const titleText = turn.id === "preset-context"
              ? "预置环境上下文"
              : turn.userMessage?.summary
                ? turn.userMessage.summary
                : `QA 回合 #${index + 1}`;

            // 提取对应的助手消息原始结构以获取思考过程
            const fullMessage = messages.find((m) => m.id === turn.assistantMessage?.sourceId);

            return (
              <div key={turn.id} className="rounded-[6px] bg-white/[0.02] border border-white/[0.03]">
                {/* 折叠头部 */}
                <div
                  className="flex items-center gap-2 py-2 px-2.5 cursor-pointer hover:bg-white/[0.03] transition-colors select-none"
                  onClick={() => toggleTurn(turn.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-white/45 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-white/45 shrink-0" />
                  )}
                  <span className="truncate text-white/75 font-medium flex-1">
                    {titleText}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-white/35">
                    {turn.tokens.toLocaleString("zh-CN")} tokens
                  </span>
                </div>

                {/* 展开的时间线内容 */}
                {isExpanded && (
                  <div className="mx-3 mb-2.5 pl-3 border-l border-white/5 flex flex-col gap-3 relative mt-1 select-text">
                    {/* 1. 用户消息节点 */}
                    {turn.userMessage && (
                      <div className="relative pl-3 select-text">
                        <div className="absolute left-[-16px] top-1.5 flex h-1.5 w-1.5 items-center justify-center rounded-full bg-white/40 ring-[3px] ring-[#161616]" />
                        <div className="flex items-center gap-1.5 text-[11px] text-white/35 font-mono select-none">
                          <User className="h-3 w-3 shrink-0" />
                          <span>用户消息</span>
                          <span className="ml-auto text-white/20">
                            {turn.userMessage.tokens} tokens
                          </span>
                        </div>
                        <div
                          onClick={() => toggleNode(turn.userMessage!.key)}
                          className="text-white/70 mt-1 cursor-pointer hover:text-white select-text break-words whitespace-pre-wrap leading-relaxed transition-colors"
                        >
                          {expandedNodes[turn.userMessage.key]
                            ? turn.userMessage.content
                            : turn.userMessage.summary}
                          {turn.userMessage.content.length > turn.userMessage.summary.length && (
                            <span className="text-white/30 text-[10px] ml-1 select-none hover:underline">
                              {expandedNodes[turn.userMessage.key] ? "[折叠]" : "...[展开]"}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 2. 注入上下文节点 */}
                    {turn.injectedContexts.length > 0 && (
                      <div className="relative pl-3">
                        <div className="absolute left-[-16px] top-1.5 flex h-1.5 w-1.5 items-center justify-center rounded-full bg-blue-500/40 ring-[3px] ring-[#161616]" />
                        <div className="flex items-center gap-1.5 text-[11px] text-white/35 font-mono select-none">
                          <FileText className="h-3 w-3 shrink-0 text-blue-400/70" />
                          <span>注入上下文 ({turn.injectedContexts.length} 项)</span>
                        </div>
                        <div className="mt-1 flex flex-col gap-1.5 select-text">
                          {turn.injectedContexts.map((ctx) => (
                            <div key={ctx.key} className="bg-white/[0.01] p-1.5 rounded-[4px] border border-white/[0.02]">
                              <div className="flex items-center gap-1 text-[10px] text-white/45 font-mono select-none">
                                <span className="font-semibold text-blue-400/60">
                                  {ctx.kind.toUpperCase()}
                                </span>
                                <span>{ctx.title}</span>
                                <span className="ml-auto text-white/20">{ctx.tokens} tokens</span>
                              </div>
                              <div
                                onClick={() => toggleNode(ctx.key)}
                                className="text-white/50 mt-0.5 cursor-pointer hover:text-white/85 select-text break-words whitespace-pre-wrap leading-relaxed transition-colors"
                              >
                                {expandedNodes[ctx.key] ? ctx.content : ctx.summary}
                                {ctx.content.length > ctx.summary.length && (
                                  <span className="text-white/30 text-[10px] ml-1 select-none hover:underline">
                                    {expandedNodes[ctx.key] ? "[折叠]" : "...[展开]"}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. 助手执行过程（按照 parts 的真实时间线顺序，交错渲染思考和工具调用） */}
                    {(() => {
                      const nodes: React.JSX.Element[] = [];
                      const renderedToolKeys = new Set<string>();

                      // 如果能拿到消息的 parts，我们优先按照 parts 的时间线顺序进行渲染
                      if (fullMessage?.parts && fullMessage.parts.length > 0) {
                        fullMessage.parts.forEach((part) => {
                          if (part.kind === "reasoning") {
                            nodes.push(
                              <div key={part.id} className="relative pl-3 select-text">
                                <div className="absolute left-[-16px] top-1.5 flex h-1.5 w-1.5 items-center justify-center rounded-full bg-zinc-500/50 ring-[3px] ring-[#161616]" />
                                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400/80 font-mono select-none">
                                  <Brain className="h-3 w-3 shrink-0 text-zinc-400/60" />
                                  <span>思考过程</span>
                                  {part.status === "streaming" && (
                                    <span className="text-[10px] text-amber-400/60 animate-pulse">(思考中...)</span>
                                  )}
                                </div>
                                <div
                                  onClick={() => toggleNode(part.id)}
                                  className="text-white/45 mt-1 cursor-pointer hover:text-white select-text break-words whitespace-pre-wrap leading-relaxed transition-colors border-l-2 border-white/5 pl-2 italic font-serif text-[11px]"
                                >
                                  {expandedNodes[part.id]
                                    ? part.content
                                    : part.content.slice(0, 80) + (part.content.length > 80 ? "..." : "")}
                                  {part.content.length > 80 && (
                                    <span className="text-white/30 text-[10px] ml-1 select-none hover:underline font-mono not-italic">
                                      {expandedNodes[part.id] ? "[折叠]" : "...[展开]"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          } else if (part.kind === "tool") {
                            const tool = turn.tools.find((t) => t.sourceId === part.stepId);
                            if (tool) {
                              renderedToolKeys.add(tool.key);
                              
                              let parsedArgs: Record<string, unknown> | null = null;
                              if (tool.meta?.inputJson) {
                                try {
                                  parsedArgs = JSON.parse(tool.meta.inputJson as string);
                                } catch {
                                  // Ignored
                                }
                              }

                              nodes.push(
                                <div key={tool.key} className="relative pl-3 select-text">
                                  <div className="absolute left-[-16px] top-1.5 flex h-1.5 w-1.5 items-center justify-center rounded-full bg-amber-500/50 ring-[3px] ring-[#161616]" />
                                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400/70 font-mono select-none">
                                    <Wrench className="h-3 w-3 shrink-0" />
                                    <span>Tool: {String(tool.meta?.tool || "unknown")}</span>
                                    <span className="ml-auto text-white/20">{tool.tokens} tokens</span>
                                  </div>

                                  {/* 工具输入参数 (Parameters) */}
                                  {parsedArgs && (
                                    <div className="mt-1">
                                      <button
                                        onClick={(e) => toggleParam(tool.key, e)}
                                        className="flex items-center gap-1 text-[10px] text-amber-500/50 hover:text-amber-500/80 font-mono transition-colors select-none cursor-pointer"
                                      >
                                        <span>
                                          {expandedParams[tool.key] ? "[-] 收起参数" : "[+] 展开参数"}
                                        </span>
                                      </button>
                                      {expandedParams[tool.key] && (
                                        <pre className="mt-1 max-h-[140px] overflow-auto rounded-[4px] border border-white/5 bg-black/40 p-2 font-mono text-[10px] text-white/50 leading-normal custom-scrollbar select-all">
                                          {JSON.stringify(parsedArgs, null, 2)}
                                        </pre>
                                      )}
                                    </div>
                                  )}

                                  {/* 工具执行结果概要 */}
                                  <div
                                    onClick={() => toggleNode(tool.key)}
                                    className="text-white/50 mt-1 cursor-pointer hover:text-white/80 select-text break-words whitespace-pre-wrap leading-relaxed transition-colors"
                                  >
                                    {expandedNodes[tool.key] ? tool.content : tool.summary}
                                    {tool.content.length > tool.summary.length && (
                                      <span className="text-white/30 text-[10px] ml-1 select-none hover:underline">
                                        {expandedNodes[tool.key] ? "[折叠]" : "...[展开]"}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            } else {
                              // Fallback to model's own tool step state (e.g. if tool is running/failed/unsubmitted)
                              const step = fullMessage.toolSteps?.find((s) => s.id === part.stepId);
                              if (step) {
                                let parsedArgs: Record<string, unknown> | null = null;
                                if (step.input) {
                                  if (typeof step.input === "string") {
                                    try {
                                      parsedArgs = JSON.parse(step.input);
                                    } catch {
                                      // Ignored
                                    }
                                  } else {
                                    parsedArgs = step.input as Record<string, unknown>;
                                  }
                                }

                                nodes.push(
                                  <div key={step.id} className="relative pl-3 select-text">
                                    <div className="absolute left-[-16px] top-1.5 flex h-1.5 w-1.5 items-center justify-center rounded-full bg-amber-500/50 ring-[3px] ring-[#161616]" />
                                    <div className="flex items-center gap-1.5 text-[11px] text-amber-400/70 font-mono select-none">
                                      <Wrench className="h-3 w-3 shrink-0" />
                                      <span>Tool: {step.tool}</span>
                                      <span className="text-[10px] text-amber-500/60 font-sans select-none">({step.status})</span>
                                    </div>

                                    {/* 工具输入参数 (Parameters) */}
                                    {parsedArgs && (
                                      <div className="mt-1">
                                        <button
                                          onClick={(e) => toggleParam(step.id, e)}
                                          className="flex items-center gap-1 text-[10px] text-amber-500/50 hover:text-amber-500/80 font-mono transition-colors select-none cursor-pointer"
                                        >
                                          <span>
                                            {expandedParams[step.id] ? "[-] 收起参数" : "[+] 展开参数"}
                                          </span>
                                        </button>
                                        {expandedParams[step.id] && (
                                          <pre className="mt-1 max-h-[140px] overflow-auto rounded-[4px] border border-white/5 bg-black/40 p-2 font-mono text-[10px] text-white/50 leading-normal custom-scrollbar select-all">
                                            {JSON.stringify(parsedArgs, null, 2)}
                                          </pre>
                                        )}
                                      </div>
                                    )}

                                    {/* 工具执行观察结果 */}
                                    {step.observation && (
                                      <div
                                        onClick={() => toggleNode(step.id)}
                                        className="text-white/50 mt-1 cursor-pointer hover:text-white/80 select-text break-words whitespace-pre-wrap leading-relaxed transition-colors"
                                      >
                                        {expandedNodes[step.id]
                                          ? step.observation
                                          : step.observation.slice(0, 80) + (step.observation.length > 80 ? "..." : "")}
                                        {step.observation.length > 80 && (
                                          <span className="text-white/30 text-[10px] ml-1 select-none hover:underline">
                                            {expandedNodes[step.id] ? "[折叠]" : "...[展开]"}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            }
                          }
                        });
                      }

                      // 兜底：渲染未通过 parts 呈现的工具调用上下文记录（例如旧版本会话或非标准格式）
                      turn.tools.forEach((tool) => {
                        if (!renderedToolKeys.has(tool.key)) {
                          let parsedArgs: Record<string, unknown> | null = null;
                          if (tool.meta?.inputJson) {
                            try {
                              parsedArgs = JSON.parse(tool.meta.inputJson as string);
                            } catch {
                              // Ignored
                            }
                          }

                          nodes.push(
                            <div key={tool.key} className="relative pl-3 select-text">
                              <div className="absolute left-[-16px] top-1.5 flex h-1.5 w-1.5 items-center justify-center rounded-full bg-amber-500/50 ring-[3px] ring-[#161616]" />
                              <div className="flex items-center gap-1.5 text-[11px] text-amber-400/70 font-mono select-none">
                                <Wrench className="h-3 w-3 shrink-0" />
                                <span>Tool: {String(tool.meta?.tool || "unknown")}</span>
                                <span className="ml-auto text-white/20">{tool.tokens} tokens</span>
                              </div>

                              {/* 工具输入参数 (Parameters) */}
                              {parsedArgs && (
                                <div className="mt-1">
                                  <button
                                    onClick={(e) => toggleParam(tool.key, e)}
                                    className="flex items-center gap-1 text-[10px] text-amber-500/50 hover:text-amber-500/80 font-mono transition-colors select-none cursor-pointer"
                                  >
                                    <span>
                                      {expandedParams[tool.key] ? "[-] 收起参数" : "[+] 展开参数"}
                                    </span>
                                  </button>
                                  {expandedParams[tool.key] && (
                                    <pre className="mt-1 max-h-[140px] overflow-auto rounded-[4px] border border-white/5 bg-black/40 p-2 font-mono text-[10px] text-white/50 leading-normal custom-scrollbar select-all">
                                      {JSON.stringify(parsedArgs, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              )}

                              {/* 工具执行结果概要 */}
                              <div
                                onClick={() => toggleNode(tool.key)}
                                className="text-white/50 mt-1 cursor-pointer hover:text-white/80 select-text break-words whitespace-pre-wrap leading-relaxed transition-colors"
                              >
                                {expandedNodes[tool.key] ? tool.content : tool.summary}
                                {tool.content.length > tool.summary.length && (
                                  <span className="text-white/30 text-[10px] ml-1 select-none hover:underline">
                                    {expandedNodes[tool.key] ? "[折叠]" : "...[展开]"}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }
                      });

                      return nodes;
                    })()}

                    {/* 4. 助手回答节点 */}
                    {turn.assistantMessage && (
                      <div className="relative pl-3 select-text">
                        <div className="absolute left-[-16px] top-1.5 flex h-1.5 w-1.5 items-center justify-center rounded-full bg-purple-500/50 ring-[3px] ring-[#161616]" />
                        <div className="flex items-center gap-1.5 text-[11px] text-purple-400/80 font-mono select-none">
                          <Bot className="h-3 w-3 shrink-0" />
                          <span>助手回复</span>
                          <span className="ml-auto text-white/20">
                            {turn.assistantMessage.tokens} tokens
                          </span>
                        </div>
                        <div
                          onClick={() => toggleNode(turn.assistantMessage!.key)}
                          className="text-white/70 mt-1 cursor-pointer hover:text-white select-text break-words whitespace-pre-wrap leading-relaxed transition-colors"
                        >
                          {expandedNodes[turn.assistantMessage.key]
                            ? turn.assistantMessage.content
                            : turn.assistantMessage.summary}
                          {turn.assistantMessage.content.length > turn.assistantMessage.summary.length && (
                            <span className="text-white/30 text-[10px] ml-1 select-none hover:underline">
                              {expandedNodes[turn.assistantMessage.key] ? "[折叠]" : "...[展开]"}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
