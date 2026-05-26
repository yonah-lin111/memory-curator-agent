import type React from "react";
import {
  Bot,
  Compass,
  Layers,
  ShieldCheck,
  Terminal,
  Activity,
} from "lucide-react";

// Agent 核心规则数据结构
type RuleItem = {
  // 规则标题
  title: string;
  // 规则核心要义
  desc: string;
};

// 能力模块数据结构
type CapabilityItem = {
  // 能力名称
  name: string;
  // 对应功能描述
  desc: string;
};

// 核心规则静态数据
const CORE_RULES: RuleItem[] = [
  {
    title: "多源分流，秩序井然",
    desc: "精准分流 todo（执行）、笔记（素材）与日记（主观），保留原始表达，各归其位。",
  },
  {
    title: "周期提炼，拒绝堆积",
    desc: "周度策展强调高含金量阶段回顾，提取进展、情绪起伏与浮现的主题，拒绝简单字数压缩。",
  },
  {
    title: "本地优先，捍卫主权",
    desc: "所有分析在本地沙盒离线进行，严禁泄露隐私。仅客观呈现行为模式，严禁提供任何医疗诊断。",
  },
];

// 核心能力静态数据
const CAPABILITIES: CapabilityItem[] = [
  {
    name: "输入理解 (Input)",
    desc: "低负荷输入，智能识别内容来源、用途与归属。",
  },
  {
    name: "长期追踪 (Tracking)",
    desc: "发现跨越周期的关注点，自动为分散记录命名与串联。",
  },
  {
    name: "模式识别 (Pattern)",
    desc: "客观呈现实践惯性与叙事冲突，呈现规律而不评判。",
  },
];

/**
 * 记忆策展 Agent 编写工作台页面组件。
 * 该页面是一个纯静态的工作区，紧凑、清晰地呈现了策展 Agent 的设计目标、核心规则、能力模块和输出预览。
 *
 * @returns {React.JSX.Element} 返回工作台页面的 JSX 元素
 */
export const AgentPage = (): React.JSX.Element => {
  return (
    <section className="flex h-auto min-h-0 w-full flex-1 flex-col overflow-y-auto rounded-[6px] border border-white/5 bg-[#000000] p-4 text-neutral-100 select-none lg:h-full lg:overflow-hidden">
      {/* 顶部标题栏区：短头部 */}
      <header className="flex items-center justify-between border-b border-neutral-900 pb-4 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#212121] rounded-[6px] border border-neutral-800">
            <Bot className="w-5 h-5 text-neutral-200" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-semibold tracking-wide text-neutral-100">
              记忆策展 Agent 编写工作台
            </h1>
            <p className="text-[12px] text-neutral-500 font-mono">
              Digital Hippocampus Authoring Workspace
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#212121] rounded-[6px] border border-neutral-800 text-[12px] text-neutral-400">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
          <span>本地沙盒已就绪</span>
        </div>
      </header>

      {/* 两栏紧凑布局：响应式网格 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        
        {/* 左侧：Agent 目的与核心规则 */}
        <div className="flex flex-col gap-4">
          {/* Agent 目的卡片 */}
          <div className="bg-[#212121] rounded-[6px] p-4 border border-white/5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-neutral-200">
              <Compass className="w-4 h-4 text-neutral-400" />
              <span>Agent 愿景与定位 (Purpose)</span>
            </div>
            <p className="text-[12px] text-neutral-300 leading-relaxed">
              记忆策展 Agent 是一个面向个人长期记录与回顾的记忆整理工具。它帮助用户把每天产生的计划、执行过程、自由笔记、日记内容与主观感受整理到同一套个人工作台中，通过“日输入 + 周整理 + 长期追踪”的核心节奏，提炼出具有长期追踪意义的人生线索，维护个体的思维与记忆主权。
            </p>
          </div>

          {/* 核心规则卡片 */}
          <div className="bg-[#212121] rounded-[6px] p-4 border border-white/5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-neutral-200">
              <Layers className="w-4 h-4 text-neutral-400" />
              <span>核心设计原则与规则 (Core Rules)</span>
            </div>
            <div className="space-y-3">
              {CORE_RULES.map((rule, idx) => (
                <div key={idx} className="border-l-2 border-neutral-700 pl-3">
                  <h4 className="text-[12px] font-semibold text-neutral-200">
                    {idx + 1}. {rule.title}
                  </h4>
                  <p className="text-[12px] text-neutral-400 mt-0.5 leading-relaxed">
                    {rule.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
          
          {/* 安全防线声明 */}
          <div className="bg-[#212121] rounded-[6px] p-4 border border-white/5 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-neutral-200">安全与道德边界 (Safety Boundary)</span>
              <p className="text-[12px] text-neutral-400 leading-relaxed">
                系统致力于辅助用户观察行为与感受波动，不提供任何主观诊断、心理干预或临床医学建议。
              </p>
            </div>
          </div>
        </div>

        {/* 右侧：能力模块与输出预览 */}
        <div className="flex flex-col gap-4">
          {/* 能力模块卡片 */}
          <div className="bg-[#212121] rounded-[6px] p-4 border border-white/5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-neutral-200">
              <Activity className="w-4 h-4 text-neutral-400" />
              <span>关键能力模块 (Capabilities)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {CAPABILITIES.map((cap, idx) => (
                <div key={idx} className="bg-[#1a1a1a] rounded-[6px] p-3 border border-neutral-800">
                  <h5 className="text-[12px] font-semibold text-neutral-200">{cap.name}</h5>
                  <p className="text-[12px] text-neutral-400 mt-1 leading-relaxed">
                    {cap.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 输出预览卡片 */}
          <div className="bg-[#212121] rounded-[6px] p-4 border border-white/5 flex flex-col gap-3 flex-1">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-neutral-200">
              <Terminal className="w-4 h-4 text-neutral-400" />
              <span>策展输出结构预览 (Output Preview)</span>
            </div>
            
            <div className="bg-[#161616] rounded-[6px] p-3 border border-neutral-900 font-mono text-[12px] text-neutral-300 space-y-3 leading-relaxed">
              <div>
                <span className="text-neutral-500 font-semibold">[Today View - 日度视图]</span>
                <div className="pl-3 text-neutral-400 space-y-0.5">
                  <p>• 待办：[已完成] 记忆策展工作台重新设计</p>
                  <p>• 随记：本地优先架构下的数字海马体遗忘机制研究</p>
                  <p>• 情绪：在安福路目睹社交算法对注意力的蚕食，保持警惕</p>
                </div>
              </div>

              <div className="border-t border-neutral-800/60 pt-2">
                <span className="text-neutral-500 font-semibold">[Weekly Review - 周度复盘]</span>
                <div className="pl-3 text-neutral-400 space-y-0.5">
                  <p>• 进展：攻克本地个人索引核心机制，共记录 12 条闪念</p>
                  <p>• 状态：平稳且专注；周中攻坚时有轻微精力消耗</p>
                  <p>• 主题：本地优先心智安全 (关联事件 4 次，情绪契合)</p>
                </div>
              </div>

              <div className="border-t border-neutral-800/60 pt-2">
                <span className="text-neutral-500 font-semibold">[Long-term Theme - 长期追踪]</span>
                <div className="pl-3 text-neutral-400 space-y-0.5">
                  <p>• 观察：你倾向于在静谧环境攻坚，多任务穿插时注意力极易受扰</p>
                  <p>• 冲突：高保真捕获所有闪念的需求与精简高效策展的初衷存在叙事冲突</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
