import type React from "react";
import {
  Sparkles,
  BookOpen,
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  FileText,
  Link2,
} from "lucide-react";

/* ==========================================
 * TS 类型定义
 * ========================================== */

// 被命名的关键记忆节点类型。
type NamedMemoryNode = {
  // 唯一标识。
  id: string;
  // 被命名的记忆标题 (用特殊书名号形式表达，如「xxx」)。
  name: string;
  // 记忆记录的日期 (格式: YYYY-MM-DD)。
  date: string;
  // 记忆来源的归属。
  source: string;
  // 用户对此记忆命名的核心理由 (为什么值得单独命名保留)。
  reason: string;
  // 记忆相关的情绪心境。
  mood: string;
};

// 记忆片段关联链条类型 (揭示它们为什么相关，而不是粗暴地平铺关键词标签)。
type MemoryRelationChain = {
  // 链条唯一标识。
  id: string;
  // 关联的主题或主线名称。
  pivotTheme: string;
  // 源记忆节点名称。
  sourceNodeName: string;
  // 目标记忆节点名称。
  targetNodeName: string;
  // 片段之间的深度关联说明 (为什么它们有关联)。
  relationDescription: string;
};

// 认知冲突与未完成议题类型。
type UnresolvedIssueItem = {
  // 唯一标识。
  id: string;
  // 冲突或未完成议题的简短标题。
  title: string;
  // 具体对立冲突表现或认知断裂事实。
  contradictionText: string;
  // 系统为帮助消除冲突或推进议题提出的克制建议。
  actionSuggestion: string;
};

/* ==========================================
 * 静态模拟数据
 * ========================================== */

// 命名记忆片段静态数据。
const NAMED_MEMORIES: NamedMemoryNode[] = [
  {
    id: "m-n1",
    name: "「15ms 神经关联本地解密首通」",
    date: "2026-05-22",
    source: "深度日记 & 随笔",
    reason:
      "首度在本地 Keychain 加密和沙盒碎块文件存储的基础上，成功编译 Rust 桥接层并跑通多维关联度衰减模型，首屏渲染解密耗时仅为 15ms。这在工程上验证了我们“极致性能 + 绝对离线”的底线原则。",
    mood: "精疲力竭 / 充实",
  },
  {
    id: "m-n2",
    name: "「安福路关于算法投喂的思考」",
    date: "2026-05-24",
    source: "深度日记",
    reason:
      "在周末安福路午后产生的心灵火花，深刻反思了算法投喂对个人心智完整性与记忆主权的蚕食，明确提出 Memory Curator 必须作为完全归属、绝对私密之数字海马体而存活的哲学命题。",
    mood: "失落 / 警醒",
  },
  {
    id: "m-n3",
    name: "「Today 工作台酷黑自审落地」",
    date: "2026-05-25",
    source: "日常开发 & 随笔",
    reason:
      "Today 三栏式主工作台完成静态编码与 Lint 规则自审。酷黑配色（#000000 & #212121）、6px 圆角的极静视觉自此落入物理肉身。体验流畅自如，象征着脑区从理论变为触手可及。",
    mood: "平静 / 专注",
  },
];

// 记忆关联链条数据 (阐述底层深刻关系)。
const MEMORY_RELATIONS: MemoryRelationChain[] = [
  {
    id: "r-1",
    pivotTheme: "本地优先与性能自律",
    sourceNodeName: "「15ms 神经关联本地解密首通」",
    targetNodeName: "「Today 工作台酷黑自审落地」",
    relationDescription:
      "这两者共同构成我们在底层技术上的第一性原理。因为我们固执地拒绝平庸托管，在 Rust 桥接层将计算限制在本地 Keychain 沙盒中，Today 工作台在加载海量多维神经元时才能实现 120ms 的秒开，并将解密耗时锁在 15ms 内，使得渲染层无需依靠复杂的动态加载 Loading 即可流畅切换。",
  },
  {
    id: "r-2",
    pivotTheme: "数字海马体的反快餐性",
    sourceNodeName: "「安福路关于算法投喂的思考」",
    targetNodeName: "「Today 工作台酷黑自审落地」",
    relationDescription:
      "Today 看板并行排布了“每日代办”、“自由笔记”以及“主观情绪日记”，这种独特的视觉呈现并不是随意的卡片拼接。它的底层逻辑来自于你在安福路对“信息主权”的反思——拒绝推荐算法喂养，还原一个供人冷静凝视、审阅自我脆弱一面的离线闭合空间。Today 即是这一哲学的物理载体。",
  },
];

// 认知断裂或未完成议题的克制提示。
const UNRESOLVED_ISSUES: UnresolvedIssueItem[] = [
  {
    id: "u-1",
    title: "关于“AI 协同与个人边界”的认知失调",
    contradictionText:
      "在 05-21 的随手随记中，你表达了对 AI 总结能力的激烈不信任，声称“机器的概括往往会过滤掉最主观珍贵的负面情绪，是一种粗暴的过度修饰”；但在今天（05-25）的复盘回顾中，你却对 Local Agent 自动为你归纳整理出的「计划延后拖延模式」高度认可并感到警醒。这两者之间显现出某种主观接受度的断裂。",
    actionSuggestion:
      "建议在下一次周整理策展中，与 Local Agent 启动一轮“人机边界自审”的闭合对话，明确理清哪些心智层次可以对本地模型开启智能结晶分析，哪些区域必须保持纯原始、无损的主观记录。",
  },
];

/**
 * MemoriesPage 组件 - 展示重要记忆片段命名与关联。
 * 布局采用被命名记忆节点区、记忆神经关联桥梁链条、以及认知断裂或未完成议题的克制提示区。
 */
export const MemoriesPage = (): React.JSX.Element => {
  return (
    <section
      aria-label="记忆片段关联墙页面"
      className="flex-1 flex flex-col gap-3 h-auto lg:h-full overflow-y-auto lg:overflow-hidden px-1 lg:px-2 [scrollbar-gutter:stable]"
    >
      {/* 顶部标题栏 */}
      <header className="flex flex-col gap-1 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-white/40">
          <span>CURATION</span>
          <span>/</span>
          <span>MEMORIES WALL</span>
        </div>
        <h1 className="text-lg font-bold tracking-tight text-white">
          记忆片段关联墙
        </h1>
      </header>

      {/* 滚动区 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-3.5">
        {/* 顶部思考导语 */}
        <div className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-white/65" />
            <span className="text-sm font-bold text-white/80">
              海马体的永久路标
            </span>
          </div>
          <p className="text-xs text-white/45 leading-relaxed font-sans mt-2">
            所有的碎片随记和工作记录都只是一过性的过客。当我们将某个特定时间、事件和情绪封装起来并赋予其名字时，它便从嘈杂的垃圾信息流中脱颖而出，被写入你的永久数字脑区中，成为海马体永恒的路标。
          </p>
        </div>

        {/* 1. 被命名的记忆节点卡片 */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 px-1">
            <BookOpen className="h-4 w-4 text-white/50" />
            <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">
              被命名的核心记忆节点
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {NAMED_MEMORIES.map((memory) => (
              <div
                key={memory.id}
                className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col justify-between gap-3.5"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="rounded-[6px] bg-white/5 px-2 py-0.5 text-xs text-white/40 font-mono">
                      {memory.date}
                    </span>
                    <span className="text-xs font-mono text-white/55">
                      心境: {memory.mood}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white leading-normal font-sans">
                    {memory.name}
                  </h3>
                  <p className="text-xs text-white/45 leading-relaxed font-sans">
                    {memory.reason}
                  </p>
                </div>
                <div className="border-t border-white/5 pt-2 flex items-center gap-1 text-xs text-white/30 font-mono">
                  <FileText className="h-3 w-3" />
                  <span>来源: {memory.source}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. 记忆片段关联桥梁 */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 px-1">
            <Link2 className="h-4 w-4 text-white/65" />
            <h2 className="text-sm font-bold text-white/75 uppercase tracking-wider">
              神经元关联桥梁 (为什么有关联)
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {MEMORY_RELATIONS.map((relation) => (
              <div
                key={relation.id}
                className="rounded-[6px] border border-white/5 bg-[#212121] p-4 flex flex-col gap-3.5"
              >
                {/* 桥梁头部 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white/85">
                      关联桥梁: {relation.pivotTheme}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-white/40">
                    <span className="truncate max-w-[130px] sm:max-w-none">
                      {relation.sourceNodeName.replace(/[「」]/g, "")}
                    </span>
                    <ArrowRight className="h-3 w-3 text-white/20" />
                    <span className="truncate max-w-[130px] sm:max-w-none">
                      {relation.targetNodeName.replace(/[「」]/g, "")}
                    </span>
                  </div>
                </div>

                {/* 桥梁内容描述 */}
                <div className="bg-[#000000] border border-white/5 rounded-[6px] p-3.5">
                  <p className="text-xs text-white/65 leading-relaxed font-sans pr-1 sm:pr-2">
                    {relation.relationDescription}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. 认知断裂与未完成议题的克制提示 */}
        <div className="flex flex-col gap-2.5 mb-1">
          <div className="flex items-center gap-2 px-1">
            <AlertTriangle className="h-4 w-4 text-white/65" />
            <h2 className="text-sm font-bold text-white/75 uppercase tracking-wider">
              认知冲突与未完成议题警告
            </h2>
          </div>

          {UNRESOLVED_ISSUES.map((issue) => (
            <div
              key={issue.id}
              className="rounded-[6px] border border-white/10 bg-[#212121] p-4 flex flex-col gap-3.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white/80">
                  {issue.title}
                </span>
              </div>

              {/* 冲突具体内容 */}
              <div className="bg-white/[0.01] border border-white/5 rounded-[6px] p-3.5">
                <p className="text-xs text-white/55 leading-relaxed font-sans">
                  {issue.contradictionText}
                </p>
              </div>

              {/* 消除冲突和推动议题的建议 */}
              <div className="flex items-start gap-2.5 px-1">
                <HelpCircle className="h-4 w-4 text-white/30 mt-0.5 flex-shrink-0" />
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-bold text-white/70">
                    Curator 处理指引:
                  </span>
                  <p className="text-xs text-white/45 leading-relaxed font-sans">
                    {issue.actionSuggestion}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
