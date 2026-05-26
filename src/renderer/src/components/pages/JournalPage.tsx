import type React from "react";
import { useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Clock,
  Tag,
  User,
  Sparkles,
  AlertCircle,
  Search,
  X,
  Brain,
  Layers,
  Sliders,
  Zap,
  Check,
  Copy,
} from "lucide-react";

/* ==========================================
 * TS 类型定义
 * ========================================== */

// 历史日记条目类型。
type JournalEntryItem = {
  // 唯一标识。
  id: string;
  // 日期文本 (格式: YYYY-MM-DD)。
  date: string;
  // 星期名称。
  weekday: string;
  // 记录的具体时间 (格式: HH:MM)。
  time: string;
  // 日记主观原文。
  content: string;
  // 主观情绪与状态感知。
  mood: string;
  // 日记关联的人物。
  people: string[];
  // 日记中浮现的主题线索。
  themes: string[];
  // 与更早历史记录的轻量连接分析。
  historicalConnection?: string;
};

/* ==========================================
 * 静态模拟数据
 * ========================================== */

// 历史日记条目静态列表。
const JOURNAL_ENTRIES: JournalEntryItem[] = [
  {
    id: "j-1",
    date: "2026-05-25",
    weekday: "Mon",
    time: "21:45",
    content:
      "今天上海又下了小雨。在写完了 Today 工作台的布局后，看着黑色的背景板 and 克制的白色边框，有一种异样的平静。人脑里的记忆其实也是这样，乱七八糟，而我们需要一个外在的、数字化的“海马体”来帮我们整理。我把那些写在碎纸片和微信文件传输助手里的垃圾信息全都归档了，只留下了最重要的几条。今晚不需要焦虑，明天继续推进 AEON 神经关联图谱的设计。希望这个界面能够作为我新生活的见证者。",
    mood: "平静 / 专注",
    people: ["自我", "Yonah"],
    themes: ["数字海马体", "设计系统"],
    historicalConnection:
      "本条目中的“微雨平静”与 3 天前 (05-22) 提到的“精疲力竭”形成情绪对冲，系统检测到你在雨天的专注度显著提升。",
  },
  {
    id: "j-2",
    date: "2026-05-24",
    weekday: "Sun",
    time: "16:30",
    content:
      "周末在安福路的咖啡馆坐了很久，看着人来人往，突然有些失落。现在的社交媒体无时无刻不在用算法投喂垃圾，把每个人的瞬间记忆切碎成以秒计算的短视频。我们在主动向算法让渡我们的记忆主权。如果有一天我们的回忆全是由字节跳动的推荐列表构成的，那我们还是我们自己吗？本地优先、纯粹归属个人的 Memory Curator 或许是唯一的解药。我要把我所有的脆弱和零碎想法都留在本地。",
    mood: "失落 / 警醒",
    people: ["自我"],
    themes: ["个人边界", "数字海马体"],
    historicalConnection:
      "这篇关于“记忆主权让渡”的思索，与 05-20 笔记中的「AI协同与个人边界」观点存在 89% 的思想契合，已自动聚合为主题“数字海马体”的底层支柱。",
  },
  {
    id: "j-3",
    date: "2026-05-22",
    weekday: "Fri",
    time: "23:10",
    content:
      "一整天都在和 Rust 的桥接层编译报错作斗争。由于多维关联图谱需要极致的性能，我固执地拒绝了现成的客户端 SQL 图谱，非要用本地二进制碎块进行神经关联度衰减模型计算。编译器一遍遍报错，中途差点想放弃退回轻量 SQLite。在晚上九点终于编译通过的那一刻，看着 15ms 的渲染耗时，我知道我的固执是值得的。极度疲惫，但是内心感觉被填满了。",
    mood: "精疲力竭 / 充实",
    people: ["自我"],
    themes: ["本地优先架构", "性能攻坚"],
    historicalConnection:
      "本篇中“拒绝妥协”的技术偏执，与上周五 (05-15) 在笔记里记录的“架构第一性原理”高度重合。你的行为模式显示：你在面对核心性能瓶颈时倾向于选择硬核自研。",
  },
  {
    id: "j-4",
    date: "2026-05-19",
    weekday: "Tue",
    time: "19:05",
    content:
      "今天本应该着手重构多维图谱冷启动的懒加载逻辑，但我却把一下午的时间花在修一个无关紧要的 Lint 报错上。事后回想，这是一种非常典型的“创造性拖延”——因为对重构冷启动的底层逻辑感到有些无从下手，所以潜意识里选择了用解决轻量错误来获取虚假的成就感。我不能再这样逃避核心问题。需要让 Agent 在未来的计划区中对此进行高亮警示。",
    mood: "焦虑 / 自省",
    people: ["自我", "Yonah"],
    themes: ["计划延后模式", "拖延机制"],
    historicalConnection:
      "本条目的“逃避心理自省”是你在 5 月份第 4 次记录到“创造性拖延”。系统已把这一重复模式捕获到长期追踪主题「计划延后模式」中。",
  },
];

/* ==========================================
 * AI 策展分析静态映射
 * ========================================== */

// AI 为各日记生成的深度提炼模型。
const MOCK_AI_INSIGHTS: Record<
  string,
  { intensity: string; emotion: string; advice: string }
> = {
  "j-1": {
    intensity: "🧠 记忆强度：极高。包含高频思考词 [数字海马体, 个人边界]",
    emotion: "⚡ 情绪指征：平静且沉淀。检测到从工作状态向内省状态的过渡",
    advice: "📌 策展建议：已自动关联至主题「数字海马体」",
  },
  "j-2": {
    intensity: "🧠 记忆强度：高。涉及对算法推荐系统的批判性哲学反思",
    emotion: "⚡ 情绪指征：警醒与隐忧。检测到对数字主权流失的底层焦虑",
    advice: "📌 策展建议：本段落思想密度极高，推荐作为周回顾核心素材",
  },
  "j-3": {
    intensity: "🧠 记忆强度：极高。记录了 15ms 编译通过的技术高峰体验",
    emotion: "⚡ 情绪指征：精疲力竭但内心充实。高心流、充实感极强",
    advice: "📌 策展建议：已自动归档至「本地优先架构」与「性能攻坚」",
  },
  "j-4": {
    intensity: "🧠 记忆强度：中等。包含高频动作词 [拖延, 重构, 焦虑]",
    emotion: "⚡ 情绪指征：自省且微焦虑。检测到明显的防御性“创造性拖延”",
    advice: "📌 策展建议：将在未来计划区高亮本模式，防范逃避倾向",
  },
};

/**
 * JournalPage 组件 - 展示历史日记条目。
 * 采用左侧高交互时间轴索引与快速过滤器、右侧多维智能阅读区的经典分栏架构，支持全交互切换。
 */
export const JournalPage = (): React.JSX.Element => {
  // 维护当前正在阅读的活动日记条目，供右侧详细数据视图和分析面板订阅
  const [activeEntryId, setActiveEntryId] = useState<string>("j-1");

  // 支持对内容、主题、人物、时间等多字段模糊匹配，实现零时滞的动态搜索过滤
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 按分类索引快速过滤关联文章，帮助用户在一组主题内穿梭
  const [selectedTheme, setSelectedTheme] = useState<string>("全部");

  // 模拟对日记存储半衰期的权重控制，支持数字海马体的自动衰退/长久驻留策略
  const [persistenceWeights, setPersistenceWeights] = useState<Record<string, string>>({
    "j-1": "永久 (DECAY_NONE)",
    "j-2": "周期 (1年)",
    "j-3": "永久 (DECAY_NONE)",
    "j-4": "暂存 (30天)",
  });

  // 记录每个神经元条目是否被标记加入周回顾缓存池
  const [weeklyReviewPinned, setWeeklyReviewPinned] = useState<Record<string, boolean>>({
    "j-1": true,
    "j-2": false,
    "j-3": true,
    "j-4": false,
  });

  // 全文拷贝时触发成功态
  const [isCopied, setIsCopied] = useState<boolean>(false);

  /**
   * 拷贝日记全文至系统剪贴板。
   *
   * @param text 待拷贝的纯文本内容。
   */
  const handleCopy = (text: string): void => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  // 获取所有条目中涉及的不重复主题标签
  const allThemes = [
    "全部",
    ...Array.from(new Set(JOURNAL_ENTRIES.flatMap((entry) => entry.themes))),
  ];

  // 根据搜索词和选中的主题标签对日记进行多维过滤
  const filteredEntries = JOURNAL_ENTRIES.filter((entry) => {
    const matchesTheme =
      selectedTheme === "全部" || entry.themes.includes(selectedTheme);
    const matchesSearch =
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.mood.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.themes.some((t) =>
        t.toLowerCase().includes(searchQuery.toLowerCase()),
      ) ||
      entry.people.some((p) =>
        p.toLowerCase().includes(searchQuery.toLowerCase()),
      ) ||
      entry.date.includes(searchQuery);
    return matchesTheme && matchesSearch;
  });

  // 获取当前正在阅读的活动日记条目
  const activeEntry =
    JOURNAL_ENTRIES.find((entry) => entry.id === activeEntryId) ||
    JOURNAL_ENTRIES[0];

  return (
    <section
      aria-label="历史日记条目页面"
      className="flex-1 flex flex-col gap-3 h-auto lg:h-full overflow-y-auto lg:overflow-hidden px-1 lg:px-2 [scrollbar-gutter:stable]"
    >
      {/* 顶部标题栏 */}
      <header className="flex flex-col gap-1 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-white/40">
          <span>LIBRARY</span>
          <span>/</span>
          <span>JOURNAL</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-white">
            历史日记条目
          </h1>
          <div className="text-xs text-white/40 font-mono tracking-wider">
            ARCHIVED NEURONS: {JOURNAL_ENTRIES.length}
          </div>
        </div>
      </header>

      {/* 页面主内容区域：在大屏下为分栏，小屏下垂直流动 */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-y-auto lg:overflow-hidden mt-1">
        {/* 左侧：时间轴索引与快速过滤器 */}
        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto lg:overflow-hidden">
          {/* 搜索与过滤组件面板 */}
          <div className="rounded-[6px] border border-white/5 bg-[#212121] p-3 flex flex-col gap-2.5">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-white/30" />
              <input
                type="text"
                placeholder="检索记忆、情绪或关联词..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-[#000000] border border-white/5 rounded-[6px] text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/10 transition-all duration-150 font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-white/40 hover:text-white transition-colors h-5 flex items-center"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* 主题过滤器横向滑动区 */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
              {allThemes.map((theme) => {
                const isThemeActive = selectedTheme === theme;
                return (
                  <button
                    key={theme}
                    onClick={() => setSelectedTheme(theme)}
                    className={`flex-shrink-0 px-2 py-0.5 rounded-[6px] text-[10px] font-medium transition-all duration-150 ${
                      isThemeActive
                        ? "bg-white text-black font-semibold"
                        : "bg-[#000000]/40 border border-white/5 text-white/50 hover:text-white/80 hover:border-white/10"
                    }`}
                  >
                    {theme}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 具有视觉导轨的垂直时间轴 */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative min-h-[200px] lg:min-h-0">
            {/* 时间轴连线 */}
            <div className="absolute left-[13px] top-2 bottom-2 w-[1px] bg-white/10 z-0" />

            <div className="flex flex-col gap-2.5 relative z-10 pl-6">
              {filteredEntries.length > 0 ? (
                filteredEntries.map((entry) => {
                  const isSelected = entry.id === activeEntry.id;
                  return (
                    <div
                      key={entry.id}
                      onClick={() => setActiveEntryId(entry.id)}
                      className={`group relative w-full text-left rounded-[6px] border p-3.5 flex flex-col gap-2 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "bg-white border-white text-black shadow-lg"
                          : "bg-[#212121] border-white/5 text-white/70 hover:border-white/15 hover:bg-white/[0.01]"
                      }`}
                    >
                      {/* 时间轴节点 */}
                      <span
                        className={`absolute -left-[17px] top-[18px] w-2 h-2 rounded-full z-20 transition-all duration-200 ${
                          isSelected
                            ? "bg-white ring-4 ring-white/20 scale-125"
                            : "bg-[#212121] border border-white/30 group-hover:bg-white/60 group-hover:border-white/60"
                        }`}
                      />

                      {/* 卡片头部 */}
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1 text-xs font-bold font-mono">
                          <CalendarDays
                            className={`h-3 w-3 ${isSelected ? "text-black" : "text-white/40"}`}
                          />
                          <span>{entry.date}</span>
                          <span
                            className={`text-[10px] ${isSelected ? "text-black/50" : "text-white/30"}`}
                          >
                            ({entry.weekday})
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono ${isSelected ? "text-black/50" : "text-white/30"}`}
                        >
                          {entry.time}
                        </span>
                      </div>

                      {/* 卡片缩略内容 */}
                      <div className="flex flex-col gap-1">
                        <span
                          className={`text-[11px] font-bold ${
                            isSelected ? "text-black/80" : "text-white/60"
                          }`}
                        >
                          心境: {entry.mood}
                        </span>
                        <p
                          className={`text-xs line-clamp-2 leading-relaxed ${
                            isSelected ? "text-black/70" : "text-white/40"
                          }`}
                        >
                          {entry.content}
                        </p>
                      </div>

                      {/* 主题微型徽章 */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {entry.themes.map((t) => (
                          <span
                            key={t}
                            className={`text-[9px] px-1.5 py-0.5 rounded-[4px] font-medium ${
                              isSelected
                                ? "bg-black/5 text-black/60 border border-black/10"
                                : "bg-black/20 text-white/40 border border-white/5"
                            }`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[6px] border border-white/5 bg-[#212121] p-6 text-center flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="h-5 w-5 text-white/30" />
                  <span className="text-xs text-white/40">无匹配的历史记忆节点</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：完整日记智能策展与多维阅读区 */}
        <div className="flex-1 rounded-[6px] border border-white/5 bg-[#212121] p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          {/* 阅读区头部元数据 */}
          <div className="border-b border-white/5 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-4xl font-mono font-bold tracking-tighter text-white">
                {activeEntry.date.split("-")[2]}
              </div>
              <div className="flex flex-col border-l border-white/10 pl-3">
                <span className="text-xs font-mono font-bold tracking-wider text-white">
                  {activeEntry.date.split("-")[0]} / {activeEntry.date.split("-")[1]}
                </span>
                <span className="text-[10px] tracking-widest text-white/40 font-bold uppercase mt-0.5 flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {activeEntry.weekday === "Mon"
                    ? "MONDAY"
                    : activeEntry.weekday === "Sun"
                      ? "SUNDAY"
                      : activeEntry.weekday === "Fri"
                        ? "FRIDAY"
                        : "TUESDAY"}
                </span>
              </div>
            </div>

            {/* 心境感知与认知能量分析仪 */}
            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <div className="rounded-[6px] bg-white/5 border border-white/5 px-2.5 py-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                <span className="text-xs text-white/80 font-medium font-sans">
                  主观心境感知: {activeEntry.mood}
                </span>
              </div>

              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] font-mono tracking-wider text-white/30 mr-1 uppercase">
                  COGNITIVE ENERGY:
                </span>
                {[1, 2, 3, 4, 5].map((idx) => {
                  const isFilled =
                    idx <=
                    (activeEntry.id === "j-3"
                      ? 5
                      : activeEntry.id === "j-1"
                        ? 4
                        : activeEntry.id === "j-2"
                          ? 3
                          : 2);
                  return (
                    <span
                      key={idx}
                      className={`w-2.5 h-2.5 rounded-[1px] border border-white/10 transition-colors duration-300 ${
                        isFilled ? "bg-white" : "bg-transparent"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* AI 脑力策展萃取简报 */}
          <div className="rounded-[6px] border border-dashed border-white/10 bg-[#000000]/30 p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-white/60 animate-pulse" />
              <h3 className="text-xs font-bold tracking-wider text-white/70 uppercase">
                AI 记忆策展与分析
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-white/50 font-sans">
              <div className="flex items-start gap-1.5">
                <span className="text-white/85">
                  {MOCK_AI_INSIGHTS[activeEntry.id]?.intensity ||
                    "🧠 记忆强度：正在运算中..."}
                </span>
              </div>
              <div className="flex items-start gap-1.5 border-t md:border-t-0 md:border-x border-white/5 pt-2.5 md:pt-0 md:px-3">
                <span className="text-white/85">
                  {MOCK_AI_INSIGHTS[activeEntry.id]?.emotion ||
                    "⚡ 情绪指征：正在提取中..."}
                </span>
              </div>
              <div className="flex items-start gap-1.5 border-t md:border-t-0 pt-2.5 md:pt-0">
                <span className="text-white/85">
                  {MOCK_AI_INSIGHTS[activeEntry.id]?.advice ||
                    "📌 策展建议：正在汇总中..."}
                </span>
              </div>
            </div>
          </div>

          {/* 完整原文段落：大尺寸精美排版 */}
          <div className="flex-1 bg-[#000000] border border-white/5 rounded-[6px] p-6 flex flex-col justify-between gap-4 min-h-[220px]">
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
              <p className="text-[14px] text-white/85 leading-loose font-sans whitespace-pre-wrap tracking-wide pl-4 border-l-2 border-white/20">
                {activeEntry.content}
              </p>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-white/30 border-t border-white/5 pt-3 mt-1">
              <span className="tracking-wider">
                ENTRY_ID: {activeEntry.id.toUpperCase()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                RECORDED AT {activeEntry.time}
              </span>
            </div>
          </div>

          {/* 关联因子与神经元链路 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 提到人物与关联主题 */}
            <div className="rounded-[6px] border border-white/5 bg-white/[0.01] p-4 flex flex-col gap-3">
              <h4 className="text-xs font-bold tracking-wider text-white/50 uppercase flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                关联因子与实体
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {activeEntry.people.map((person) => (
                  <span
                    key={person}
                    className="flex items-center gap-1 rounded-[6px] bg-[#212121] border border-white/5 px-2.5 py-1 text-xs text-white/60 hover:border-white/25 hover:text-white transition-all duration-150"
                  >
                    <User className="h-3 w-3 text-white/30" />
                    {person}
                  </span>
                ))}
                {activeEntry.themes.map((theme) => (
                  <span
                    key={theme}
                    className="flex items-center gap-1 rounded-[6px] bg-[#212121] border border-white/5 px-2.5 py-1 text-xs text-white/60 hover:border-white/25 hover:text-white transition-all duration-150"
                  >
                    <Tag className="h-3 w-3 text-white/30" />
                    主题: {theme}
                  </span>
                ))}
              </div>
            </div>

            {/* 历史连接分析 */}
            <div className="rounded-[6px] border border-white/5 bg-white/[0.01] p-4 flex flex-col gap-3">
              <h4 className="text-xs font-bold tracking-wider text-white/50 uppercase flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                神经元时空关联
              </h4>
              {activeEntry.historicalConnection ? (
                <p className="text-xs text-white/55 leading-relaxed font-sans">
                  {activeEntry.historicalConnection}
                </p>
              ) : (
                <div className="flex items-center gap-1 text-xs text-white/30">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>暂未生成历史神经元连接分析，正在累积数据。</span>
                </div>
              )}
            </div>
          </div>

          {/* 快捷控制面板：微调保存周期与周度回顾控制 */}
          <div className="rounded-[6px] border border-white/5 bg-[#000000]/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* 半衰期权重控制 */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Sliders className="h-4 w-4 text-white/40 flex-shrink-0" />
              <div className="flex flex-col gap-1 w-full sm:w-48">
                <div className="flex justify-between text-[10px] font-mono tracking-wider text-white/40 uppercase">
                  <span>记忆半衰权重</span>
                  <span className="text-white/60">
                    {persistenceWeights[activeEntry.id] || "永久 (DECAY_NONE)"}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="3"
                  value={
                    persistenceWeights[activeEntry.id] === "暂存 (30天)"
                      ? 1
                      : persistenceWeights[activeEntry.id] === "周期 (1年)"
                        ? 2
                        : 3
                  }
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    const label =
                      val === 1
                        ? "暂存 (30天)"
                        : val === 2
                          ? "周期 (1年)"
                          : "永久 (DECAY_NONE)";
                    setPersistenceWeights((prev) => ({
                      ...prev,
                      [activeEntry.id]: label,
                    }));
                  }}
                  className="w-full accent-white h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* 功能动作按钮组 */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => {
                  setWeeklyReviewPinned((prev) => ({
                    ...prev,
                    [activeEntry.id]: !prev[activeEntry.id],
                  }));
                }}
                className={`flex items-center gap-1.5 rounded-[6px] border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  weeklyReviewPinned[activeEntry.id]
                    ? "bg-white text-black border-white hover:bg-white/90"
                    : "bg-transparent border-white/5 text-white/65 hover:border-white/10 hover:bg-white/5"
                }`}
              >
                <Zap
                  className={`h-3 w-3 ${weeklyReviewPinned[activeEntry.id] ? "fill-black" : ""}`}
                />
                {weeklyReviewPinned[activeEntry.id]
                  ? "已编入周回顾"
                  : "加入周回顾候选"}
              </button>

              <button
                onClick={() => handleCopy(activeEntry.content)}
                className="flex items-center gap-1.5 rounded-[6px] border border-white/5 bg-transparent px-3 py-1.5 text-xs font-medium text-white/65 hover:border-white/10 hover:bg-white/5 transition-all duration-150"
              >
                {isCopied ? (
                  <>
                    <Check className="h-3 w-3 text-white/80" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 text-white/40" />
                    拷贝全文
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
