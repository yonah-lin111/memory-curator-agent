import type React from "react";
import { Layers, CalendarDays, Sparkles, Activity } from "lucide-react";

/* ==========================================
 * TS 类型定义
 * ========================================== */

// 长期主题演化轨迹节点类型。
type ThemeMilestone = {
  // 节点的日期 (格式: YYYY-MM-DD)。
  date: string;
  // 节点标题。
  title: string;
  // 该变化节点对应的输入来源。
  source: "随手随记" | "深度日记" | "会议记录";
  // 节点的详细具体描述。
  description: string;
};

// 长期主题项类型。
type ThemeItem = {
  // 唯一标识。
  id: string;
  // 主题名称。
  name: string;
  // 主题状态。
  status: "活跃中" | "有积累" | "待检视" | "已归档";
  // 创建/首次浮现日期。
  startDate: string;
  // 本周关联的随记/日记条目数量。
  recordCount: number;
  // 主题最新状态描述。
  summary: string;
  // 主题与行为、感受等神经元关系的总结。
  relationshipSummary: string;
  // 主题核心关联情绪标签。
  moods: string[];
  // 该主题跨日期的演化变化里程碑。
  milestones: ThemeMilestone[];
};

/* ==========================================
 * 静态模拟数据
 * ========================================== */

// 长期追踪的主题静态列表。
const TRACKED_THEMES: ThemeItem[] = [
  {
    id: "t-1",
    name: "数字海马体机制设计",
    status: "活跃中",
    startDate: "2026-05-19",
    recordCount: 12,
    summary:
      "探索记忆的外在工具如何从“传统堆积记事”演化为“智能海马体”。核心在于引入轻量主动策展与退避遗忘机制，只在本地保留最高信噪比的主观核心神经元与事实。",
    relationshipSummary:
      "该主题的演化与你在雨天的平静度（呈显著正相关）以及对社交平台推荐算法的抵触情绪深度交织。在行为上，它主要由你对杂乱聊天记录的主动归档动作触发。",
    moods: ["平静 / 专注", "失落 / 警醒"],
    milestones: [
      {
        date: "2026-05-25",
        title: "Today 策展工作台原型搭建完毕",
        source: "深度日记",
        description:
          "成功将“快速随手捕获、每日待办、情绪日记”融合入经典黑色客户端，标志着数字海马体从纯概念探讨进入第一个可用的原型测试阶段。",
      },
      {
        date: "2026-05-24",
        title: "安福路午后：算法侵蚀与记忆主权反思",
        source: "深度日记",
        description:
          "探讨推荐算法如何无意识切碎和接管个人的深度思考与回忆。明确了 Memory Curator 建立完全离线的脑电波映射对于维护思维主权的核心哲学定位。",
      },
      {
        date: "2026-05-20",
        title: "微信群关于 AI 协同个人边界讨论",
        source: "随手随记",
        description:
          "记录了对“AI 快速输出 vs 保护个人注意力”的辩证思考。确立了必须在本地沙盒建立策展壁垒、不向公共大模型倾倒原始心智碎片的架构原则。",
      },
      {
        date: "2026-05-19",
        title: "数字海马体主动过滤与遗忘设想",
        source: "随手随记",
        description:
          "在读完海马体生理机制文章后，顿悟：信息过载的解药不是更强的搜索引擎，而是克制、主动的遗忘算法。所有的临时闪念都不应自动成为长期记忆。",
      },
    ],
  },
  {
    id: "t-2",
    name: "本地优先安全架构",
    status: "活跃中",
    startDate: "2026-05-15",
    recordCount: 18,
    summary:
      "构建完全局限于本地 Keychain 和沙盒的加密存取方案。通过在本地二进制分片进行高并发的神经关联度衰减图谱计算，保障极致的低延迟体验和绝对的个人数据隐私。",
    relationshipSummary:
      "该主题多在技术攻坚阶段浮现，通常伴随极高能量的主观心境。在行为上，你极度抗拒平庸通用的第三方云服务托管数据库，倾向于自研硬核、第一性原理的存取机制。",
    moods: ["精疲力竭 / 充实", "专注"],
    milestones: [
      {
        date: "2026-05-25",
        title: "Local Vault 成功同步存储",
        source: "深度日记",
        description:
          "今天成功调试通过本地冷启动数据分片懒加载，将 Local-first 状态稳定运行于客户端底层，实现了 120ms 的冷启动无缝载入。",
      },
      {
        date: "2026-05-22",
        title: "Rust 多维二进制解密首通",
        source: "深度日记",
        description:
          "在连续报错数小时后，成功用 Rust 编译通过了高并发的本地碎块解密与关联图谱衰减模型，多维图谱首次首屏渲染耗时被压低至硬核的 15ms。",
      },
      {
        date: "2026-05-19",
        title: "异步分片后台懒加载预处理决策",
        source: "会议记录",
        description:
          "为了解决冷启动时因多维神经图谱庞大而导致的卡顿，与 Yonah 决策：App 启动只初始化 Today 面板，将大体积关联网格全部交给后台子线程异步懒加载。",
      },
      {
        date: "2026-05-15",
        title: "确立“架构第一性原理”离线方案",
        source: "随手随记",
        description:
          "否定了传统 Web 云数据库加本地缓存的妥协方案。决定底层数据只存放于本地沙盒文件碎块，密钥直接由硬件级 Keychain 保护。云备份必须采用完全非对称加密碎碎化存储。",
      },
    ],
  },
  {
    id: "t-3",
    name: "计划延后拖延机制",
    status: "待检视",
    startDate: "2026-05-10",
    recordCount: 7,
    summary:
      "深入剖析自身在开发高难度架构设计或复杂渲染系统时，潜意识里用“解决微小、重复的无意义技术 Lint 报错或界面微调”来获取虚假成就感、从而逃避核心痛点的“创造性拖延模式”。",
    relationshipSummary:
      "该主题主要伴随高强度的焦虑和烦躁。它的触发条件十分精准：只要当天的待办列表中存在需要耗费长考的、无先例可循的高难度架构任务，这一主题的记录就会在当晚日记中飙升。",
    moods: ["焦虑 / 自省"],
    milestones: [
      {
        date: "2026-05-25",
        title: "本周 Review 触发拖延信号高亮警示",
        source: "深度日记",
        description:
          "本周策展复盘中，Agent 自动将你在 21 日因为修整 Lint 而将 UI 审核推迟了一整个下午的记录捕获。该延迟模式已向你提供明显的拖延预警。",
      },
      {
        date: "2026-05-21",
        title: "Today 工作台审核再次因为修 Lint 延后",
        source: "随手随记",
        description:
          "本来计划下午两点对工作台进行视觉自审，但我却花了四个多小时在研究如何完美消除 TS 编译产生的边缘 Linter 告警。这就是最经典的创造性逃避。",
      },
      {
        date: "2026-05-10",
        title: "多维关联可视化首度推迟",
        source: "随手随记",
        description:
          "因为对如何在画布中绘制不等高神经元的力导向算法没有十足的把握，选择在当晚找借口出去散步，拖延了多维图谱核心界面的开发。",
      },
    ],
  },
];

/**
 * ThemesPage 组件 - 展示长期主题追踪。
 * 采用左侧长期主题列表、右侧演化详情轨迹线的布局，帮助用户看清主题如何跨日期形成和变化。
 */
export const ThemesPage = (): React.JSX.Element => {
  // 当前静态展开的长期主题。
  const activeTheme = TRACKED_THEMES[0];

  return (
    <section
      aria-label="长期主题追踪页面"
      className="flex-1 flex flex-col gap-3 h-auto lg:h-full overflow-y-auto lg:overflow-hidden px-1 lg:px-2"
    >
      {/* 顶部标题栏 */}
      <header className="flex flex-col gap-1 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-white/40">
          <span>CURATION</span>
          <span>/</span>
          <span>LONG-TERM THEMES</span>
        </div>
        <h1 className="text-lg font-bold tracking-tight text-white">
          长期主题追踪
        </h1>
      </header>

      {/* 主页面：大屏分栏，小屏流式 */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 overflow-y-auto lg:overflow-hidden">
        {/* 左侧：长期主题列表 */}
        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar lg:pr-1">
          <div className="rounded-[6px] border border-white/5 bg-[#212121] p-3 flex items-center justify-between">
            <span className="text-sm font-bold tracking-widest text-white/40 uppercase">
              追踪主题列表
            </span>
            <span className="text-xs font-mono text-white/70 font-bold bg-white/5 px-1.5 py-0.5 rounded-[6px]">
              活跃中: 2
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {TRACKED_THEMES.map((theme) => {
              const isSelected = theme.id === activeTheme.id;
              const isAlert = theme.status === "待检视";

              return (
                <div
                  key={theme.id}
                  className={`w-full text-left rounded-[6px] border p-3.5 flex flex-col gap-2.5 transition-all duration-150 ${
                    isSelected
                      ? "bg-white border-white text-black"
                      : "bg-[#212121] border-white/5 text-white/70"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-bold leading-none truncate pr-2">
                      {theme.name}
                    </span>
                    <span
                      className={`rounded-[6px] px-1.5 py-0.5 text-xs font-bold leading-none ${
                        isSelected
                          ? "bg-black/10 text-black border border-black/10"
                          : isAlert
                            ? "bg-white/10 text-white/70 border border-white/10"
                            : "bg-white/5 text-white/65 border border-white/10"
                      }`}
                    >
                      {theme.status}
                    </span>
                  </div>

                  <p
                    className={`text-xs line-clamp-2 leading-relaxed ${isSelected ? "text-black/70 font-medium" : "text-white/40"}`}
                  >
                    {theme.summary}
                  </p>

                  <div className="flex items-center justify-between w-full text-xs font-mono">
                    <span
                      className={isSelected ? "text-black/50" : "text-white/30"}
                    >
                      建档: {theme.startDate}
                    </span>
                    <span
                      className={`font-bold ${isSelected ? "text-black/60" : "text-white/40"}`}
                    >
                      积累关联: {theme.recordCount} 条
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧：长期主题详情及跨日期变化演化轨迹区 */}
        <div className="flex-1 rounded-[6px] border border-white/5 bg-[#212121] p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          {/* 详情头部 */}
          <div className="border-b border-white/5 pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-white/50" />
                <h2 className="text-sm font-bold text-white">
                  主题演化轨迹与关联图谱
                </h2>
              </div>
              <h2 className="text-base font-bold text-white mt-1.5">
                {activeTheme.name}
              </h2>
              <p className="text-xs text-white/40 mt-1 font-mono">
                首次检测到该模式浮现于:{" "}
                <span className="text-white/70">{activeTheme.startDate}</span> •
                当前已积累 {activeTheme.recordCount} 条神经关联
              </p>
            </div>

            <span className="rounded-[6px] border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 font-semibold self-start">
              状态: {activeTheme.status}
            </span>
          </div>

          {/* 核心总结卡片 */}
          <div className="rounded-[6px] bg-[#000000] border border-white/5 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-white/65" />
              <h3 className="text-sm font-bold text-white/85">
                主题深度意图结晶
              </h3>
            </div>
            <p className="text-xs text-white/70 leading-relaxed font-sans whitespace-pre-wrap">
              {activeTheme.summary}
            </p>
          </div>

          {/* 长期主题与行为/心境的神经元关系 */}
          <div className="rounded-[6px] border border-white/5 bg-white/[0.01] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-white/65" />
              <h3 className="text-sm font-bold text-white/80">
                心境与行为模式神经元交织
              </h3>
            </div>
            <p className="text-xs text-white/50 leading-relaxed font-sans pr-1 sm:pr-4">
              {activeTheme.relationshipSummary}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              <span className="text-[9.5px] font-mono text-white/30 self-center">
                高频交织心境:
              </span>
              {activeTheme.moods.map((mood) => (
                <span
                  key={mood}
                  className="rounded-[6px] bg-white/5 border border-white/5 px-2 py-0.5 text-[9.5px] text-white/60 font-medium"
                >
                  {mood}
                </span>
              ))}
            </div>
          </div>

          {/* 演化轨迹线轴 (Milestones Timeline) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-white/5 pb-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-white/50" />
              <span className="text-sm font-bold text-white/85">
                演化历史与关键变化节点
              </span>
            </div>

            <div className="relative pl-4 border-l border-white/10 flex flex-col gap-4.5 my-1.5">
              {activeTheme.milestones.map((milestone) => (
                <div key={milestone.title} className="relative">
                  {/* 小圆点 */}
                  <div className="absolute -left-[20.5px] top-1.5 h-3 w-3 rounded-full border border-[#212121] bg-white" />

                  {/* 节点内容 */}
                  <div className="flex flex-col gap-1 pl-2">
                    <div className="flex items-center gap-2 text-[10.5px]">
                      <span className="font-mono font-bold text-white/70">
                        {milestone.date}
                      </span>
                      <span>•</span>
                      <span className="rounded-[6px] bg-white/5 px-1.5 py-0.2 text-[8.5px] text-white/40">
                        {milestone.source}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white/85">
                      {milestone.title}
                    </h4>
                    <p className="text-xs text-white/45 leading-relaxed font-sans mt-0.5 pr-2 sm:pr-4">
                      {milestone.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
