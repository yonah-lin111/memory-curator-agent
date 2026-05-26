import type React from "react";
import {
  BookOpen,
  CalendarDays,
  Clock,
  Tag,
  User,
  Sparkles,
  AlertCircle,
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

/**
 * JournalPage 组件 - 展示历史日记条目。
 * 采用左侧日期索引、右侧完整阅读区的经典分栏架构，静态保留最新日记原文。
 */
export const JournalPage = (): React.JSX.Element => {
  // 当前静态展示的日记详情。
  const activeEntry = JOURNAL_ENTRIES[0];

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
        <h1 className="text-lg font-bold tracking-tight text-white">
          历史日记条目
        </h1>
      </header>

      {/* 页面主内容区域：在大屏下为分栏，小屏下垂直流动 */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 overflow-y-auto lg:overflow-hidden">
        {/* 左侧：日期索引列表 */}
        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar lg:pr-1">
          <div className="rounded-[6px] border border-white/5 bg-[#212121] p-3">
            <span className="text-sm font-bold tracking-widest text-white/40 uppercase">
              时间轴索引
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {JOURNAL_ENTRIES.map((entry) => {
              const isSelected = entry.id === activeEntry.id;
              return (
                <div
                  key={entry.id}
                  className={`w-full text-left rounded-[6px] border p-3 flex flex-col gap-2 transition-all duration-150 ${
                    isSelected
                      ? "bg-white border-white text-black"
                      : "bg-[#212121] border-white/5 text-white/70"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <CalendarDays
                        className={`h-3.5 w-3.5 ${isSelected ? "text-black" : "text-white/40"}`}
                      />
                      <span>{entry.date}</span>
                      <span
                        className={`text-xs ${isSelected ? "text-black/50" : "text-white/30"}`}
                      >
                        ({entry.weekday})
                      </span>
                    </div>
                    <span
                      className={`text-xs font-mono ${isSelected ? "text-black/50" : "text-white/30"}`}
                    >
                      {entry.time}
                    </span>
                  </div>

                  {/* 情绪及卡片摘要 */}
                  <div className="flex flex-col gap-1">
                    <span
                      className={`text-xs font-medium ${
                        isSelected ? "text-black/60" : "text-white/65"
                      }`}
                    >
                      心境: {entry.mood}
                    </span>
                    <p
                      className={`text-xs line-clamp-2 ${
                        isSelected ? "text-black/75" : "text-white/45"
                      }`}
                    >
                      {entry.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧：完整日记阅读区 */}
        <div className="flex-1 rounded-[6px] border border-white/5 bg-[#212121] p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          {/* 阅读区头部元数据 */}
          <div className="border-b border-white/5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-white/50" />
                <h2 className="text-sm font-bold text-white">日记正文</h2>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-white/40 mt-1">
                <span className="font-bold text-white/70">
                  {activeEntry.date}
                </span>
                <span>•</span>
                <span>
                  星期
                  {activeEntry.weekday === "Mon"
                    ? "一"
                    : activeEntry.weekday === "Sun"
                      ? "日"
                      : activeEntry.weekday === "Fri"
                        ? "五"
                        : "二"}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="h-3 w-3" />
                  {activeEntry.time}
                </span>
              </div>
            </div>

            <div className="rounded-[6px] bg-white/5 border border-white/5 px-3 py-1.5 self-start sm:self-center">
              <span className="text-xs text-white/70 font-medium">
                主观心境感知: {activeEntry.mood}
              </span>
            </div>
          </div>

          {/* 完整原文段落 */}
          <div className="flex-1 bg-[#000000] border border-white/5 rounded-[6px] p-5">
            <p className="text-sm text-white/85 leading-loose font-sans whitespace-pre-wrap tracking-wide">
              {activeEntry.content}
            </p>
          </div>

          {/* 关联信息区块 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
            {/* 关联的主题和人物 */}
            <div className="rounded-[6px] border border-white/5 bg-white/[0.01] p-3 flex flex-col gap-2">
              <h3 className="text-sm font-bold text-white/75">
                提及人物 & 关联线索
              </h3>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {activeEntry.people.map((person) => (
                  <span
                    key={person}
                    className="flex items-center gap-1 rounded-[6px] bg-white/5 px-2 py-0.5 text-xs text-white/50"
                  >
                    <User className="h-2.5 w-2.5 text-white/30" />
                    {person}
                  </span>
                ))}
                {activeEntry.themes.map((theme) => (
                  <span
                    key={theme}
                    className="flex items-center gap-1 rounded-[6px] bg-white/5 px-2 py-0.5 text-xs text-white/50 border border-white/5"
                  >
                    <Tag className="h-2.5 w-2.5 text-white/30" />
                    主题: {theme}
                  </span>
                ))}
              </div>
            </div>

            {/* 轻量级历史连接提示（神经元关联） */}
            <div className="rounded-[6px] border border-white/5 bg-white/[0.01] p-3 flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-white/65" />
                <h3 className="text-sm font-bold text-white/75">
                  数字海马体神经元关联
                </h3>
              </div>
              {activeEntry.historicalConnection ? (
                <p className="text-xs text-white/50 leading-relaxed font-sans">
                  {activeEntry.historicalConnection}
                </p>
              ) : (
                <div className="flex items-center gap-1 text-xs text-white/30">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>暂未生成历史神经元连接分析，正在累积日记数据中。</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
