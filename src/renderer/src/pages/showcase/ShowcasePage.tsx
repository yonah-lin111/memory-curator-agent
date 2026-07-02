import type React from "react";
import { useState } from "react";
import {
  LayoutGrid,
  MessageSquare,
  Tag as TagIcon,
  Calendar,
  ChevronDown,
  Edit3,
  Sparkles,
  Star,
  Settings,
  Info,
} from "lucide-react";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { IconButton } from "@/components/ui/IconButton";
import {
  Select,
  type SelectOption,
  type SelectGroup,
} from "@/components/ui/Select";
import { PageDateNavigator } from "@/components/ui/PageDateNavigator";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { Tooltip } from "@/components/ui/Tooltip";

// 局部导航标签。
type ActiveSection =
  | "all"
  | "toast"
  | "tag"
  | "date"
  | "select"
  | "editor"
  | "button"
  | "tooltip";

/**
 * ShowcasePage - 公共原子组件展示与 Playground 面板。
 */
export const ShowcasePage = (): React.JSX.Element => {
  // 全局 Toast 提示挂钩。
  const toast = useToast();
  // 局部选中的导航栏锚点。
  const [activeSection, setActiveSection] = useState<ActiveSection>("all");

  // Tag 交互状态
  const [isTag1Highlighted, setIsTag1Highlighted] = useState<boolean>(false);
  const [isTag2Highlighted, setIsTag2Highlighted] = useState<boolean>(true);
  const [dynamicTags, setDynamicTags] = useState<string[]>([
    "Core",
    "Design",
    "Refactor",
  ]);

  // PageDateNavigator 交互状态
  const [entryDate, setEntryDate] = useState<string>("2026-06-05");
  const [visibleMonth, setVisibleMonth] = useState<string>("2026-06");
  const entryCountMap: Record<string, number> = {
    "2026-06-05": 3,
    "2026-06-12": 1,
    "2026-06-20": 5,
  };

  // Select 交互状态
  const [selectedValue, setSelectedValue] = useState<string>("option-1");
  const selectOptions: SelectOption<string>[] = [
    { value: "option-1", label: "Option One (极简风格)" },
    { value: "option-2", label: "Option Two (拟物风)" },
    { value: "option-3", label: "Option Three (高对比度)" },
  ];

  const [groupedValue, setGroupedValue] = useState<string>("java");
  const selectGroups: (SelectOption<string> | SelectGroup<string>)[] = [
    {
      label: "Frontend Stack",
      options: [
        { value: "react", label: "React" },
        { value: "typescript", label: "TypeScript" },
        { value: "tailwind", label: "Tailwind CSS" },
      ],
    },
    {
      label: "Backend Stack",
      options: [
        { value: "node", label: "Node.js" },
        { value: "java", label: "Java Spring" },
        { value: "rust", label: "Rust Lang" },
      ],
    },
  ];

  // MarkdownEditor 交互状态
  const [markdownText, setMarkdownText] = useState<string>(
    "### Hello Memory Curator\nThis is a live **MarkdownEditor** preview.\n- Support lists\n- Inline code: `const x = 1;`",
  );

  const sections = [
    { id: "all", label: "全部组件", desc: "All Components" },
    { id: "toast", label: "Toast & Notice", desc: "消息通知与提示" },
    { id: "tag", label: "Tag 标签", desc: "高复用标签体系" },
    { id: "date", label: "Date Navigator", desc: "日期选择与月历" },
    { id: "select", label: "Select 下拉框", desc: "自定义单选与分组" },
    { id: "editor", label: "Markdown Editor", desc: "统一Markdown编辑器" },
    { id: "button", label: "IconButton", desc: "极简圆角图标按钮" },
    { id: "tooltip", label: "Tooltip 提示", desc: "文字气泡提示组件" },
  ] as const;

  /**
   * 判断某一分类是否需要被渲染显示。
   */
  const isVisible = (sec: ActiveSection): boolean =>
    activeSection === "all" || activeSection === sec;

  return (
    <div className="flex h-full min-h-0 w-full gap-4 text-white">
      {/* 左侧 Mini 导航栏 */}
      <aside className="w-52 flex-shrink-0 flex flex-col gap-4 bg-[#212121] border border-white/5 rounded-[6px] p-4 select-none">
        <div className="flex items-center gap-2 border-b border-white/5 pb-3">
          <LayoutGrid className="h-4 w-4 text-white/70" />
          <span className="text-sm font-bold tracking-wider text-white">
            UI WORKSHOP
          </span>
        </div>
        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto custom-scrollbar" aria-label="Showcase sections">
          {sections.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                aria-label={sec.label}
                onClick={() => setActiveSection(sec.id)}
                className={`rounded-[6px] px-3 py-2 text-left ${
                  isActive
                    ? "bg-white text-black"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="block text-sm font-bold">{sec.label}</span>
                <span
                  className={`mt-1 block text-xs ${
                    isActive ? "text-black/55" : "text-white/30"
                  }`}
                >
                  {sec.desc}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 右侧展示内容区 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 pr-1">
        {/* 章节：Toast */}
        {isVisible("toast") && (
          <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-white/60" />
                Toast 消息提示 & useToast
              </h3>
              <span className="text-xs font-mono text-white/30">Toast.tsx</span>
            </div>
            <p className="text-xs text-white/50">
              全局唯一通知中心。每次触发新提示会直接替换，避免消息堆叠：
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={() => toast.success("成功更新配置信息！")}
                className="px-3 py-1.5 rounded-[6px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all duration-150"
              >
                Success Toast
              </button>
              <button
                type="button"
                onClick={() => toast.error("读取数据库片段失败。")}
                className="px-3 py-1.5 rounded-[6px] bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold hover:bg-rose-500/20 transition-all duration-150"
              >
                Error Toast
              </button>
              <button
                type="button"
                onClick={() => toast.warning("检测到尚未保存的修改记录。")}
                className="px-3 py-1.5 rounded-[6px] bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-all duration-150"
              >
                Warning Toast
              </button>
              <button
                type="button"
                onClick={() => toast.info("当前网络通信稳定。")}
                className="px-3 py-1.5 rounded-[6px] bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-all duration-150"
              >
                Info Toast
              </button>
            </div>
          </section>
        )}

        {/* 章节：Tag */}
        {isVisible("tag") && (
          <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <TagIcon className="h-4 w-4 text-white/60" />
                Tag 标签
              </h3>
              <span className="text-xs font-mono text-white/30">Tag.tsx</span>
            </div>
            <p className="text-xs text-white/50 font-medium">
              支持多种尺寸、高亮/非高亮，以及丰富的交互前缀与关闭事件：
            </p>

            <div className="flex flex-col gap-3 mt-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-white/30 w-24">
                  Sizes:
                </span>
                <div className="flex items-center gap-2">
                  <Tag size="small">Small Tag</Tag>
                  <Tag size="default">Default Tag</Tag>
                  <Tag size="large">Large Tag</Tag>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-xs font-mono text-white/30 w-24 mt-1.5">
                  Preset Colors:
                </span>
                <div className="flex flex-wrap gap-1.5 max-w-[500px]">
                  <Tag color="pink">Pink</Tag>
                  <Tag color="amber">Amber</Tag>
                  <Tag color="blue">Blue</Tag>
                  <Tag color="teal">Teal</Tag>
                  <Tag color="emerald">Emerald</Tag>
                  <Tag color="rose">Rose</Tag>
                  <Tag color="gray">Gray</Tag>
                  <Tag color="purple">Purple</Tag>
                  <Tag color="indigo">Indigo</Tag>
                  <Tag color="sky">Sky</Tag>
                  <Tag color="orange">Orange</Tag>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-white/30 w-24">
                  Interactive:
                </span>
                <div className="flex items-center gap-2">
                  <Tag
                    highlighted={isTag1Highlighted}
                    onClick={() => setIsTag1Highlighted(!isTag1Highlighted)}
                    prefix={<Sparkles className="h-3 w-3" />}
                  >
                    Click Me to Toggle
                  </Tag>
                  <Tag
                    highlighted={isTag2Highlighted}
                    onClick={() => setIsTag2Highlighted(!isTag2Highlighted)}
                    prefix="#"
                  >
                    Click Me too
                  </Tag>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-white/30 w-24">
                  Closable List:
                </span>
                <div className="flex flex-wrap gap-2">
                  {dynamicTags.map((t) => (
                    <Tag
                      key={t}
                      prefix="#"
                      onClose={() => {
                        setDynamicTags(dynamicTags.filter((tag) => tag !== t));
                        toast.info(`已移除标签: ${t}`);
                      }}
                    >
                      {t}
                    </Tag>
                  ))}
                  {dynamicTags.length === 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDynamicTags(["Core", "Design", "Refactor"])
                      }
                      className="text-xs text-white/45 hover:text-white hover:underline font-semibold"
                    >
                      Reset List
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 章节：PageDateNavigator */}
        {isVisible("date") && (
          <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-white/60" />
                PageDateNavigator 日期导航与月历
              </h3>
              <span className="text-xs font-mono text-white/30">
                PageDateNavigator.tsx
              </span>
            </div>
            <p className="text-xs text-white/50">
              弹出式极简日历，内置角标聚合显示（右上角角标数支持超过99时显示“99+”）：
            </p>
            <div className="mt-2 bg-black/20 rounded-[6px] border border-white/5 p-4 flex justify-start items-center">
              <PageDateNavigator
                entryDate={entryDate}
                visibleMonth={visibleMonth}
                entryCountMap={entryCountMap}
                onChange={(next) => {
                  setEntryDate(next);
                  toast.success(`切换日期至: ${next}`);
                }}
                onVisibleMonthChange={setVisibleMonth}
              />
            </div>
          </section>
        )}

        {/* 章节：Select */}
        {isVisible("select") && (
          <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-white/60" />
                Select 自定义下拉框
              </h3>
              <span className="text-xs font-mono text-white/30">
                Select.tsx
              </span>
            </div>
            <p className="text-xs text-white/50">
              支持标准的平铺选项和分组选项，配有精致的入场动画：
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-mono text-white/30">
                  Standard Select:
                </span>
                <Select
                  value={selectedValue}
                  onChange={(val) => {
                    setSelectedValue(val);
                    toast.info(`选择了: ${val}`);
                  }}
                  options={selectOptions}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-mono text-white/30">
                  Grouped Select:
                </span>
                <Select
                  value={groupedValue}
                  onChange={(val) => {
                    setGroupedValue(val);
                    toast.info(`分组选择变更为: ${val}`);
                  }}
                  options={selectGroups}
                />
              </div>
            </div>
          </section>
        )}

        {/* 章节：MarkdownEditor */}
        {isVisible("editor") && (
          <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-white/60" />
                MarkdownEditor
              </h3>
              <span className="text-xs font-mono text-white/30">
                MarkdownEditor.tsx
              </span>
            </div>
            <p className="text-xs text-white/50">
              集成了高亮、字数统计等功能的暗色系编辑器（高度自适应）：
            </p>
            <div className="mt-2" style={{ contentVisibility: "auto" }}>
              <MarkdownEditor
                id="showcase-md-editor"
                value={markdownText}
                onChange={setMarkdownText}
                placeholder="在此处编写 Markdown..."
                height={180}
              />
            </div>
          </section>
        )}

        {/* 章节：IconButton */}
        {isVisible("button") && (
          <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Star className="h-4 w-4 text-white/60" />
                IconButton 图标按钮
              </h3>
              <span className="text-xs font-mono text-white/30">
                IconButton.tsx
              </span>
            </div>
            <p className="text-xs text-white/50 font-medium">
              微动画悬停效果，支持高亮、禁用属性，以及丰富的开箱即用预设：
            </p>

            <div className="flex flex-col gap-4 mt-2">
              {/* 基础尺寸选择 */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono text-white/45">
                  Sizes (支持大中小尺寸自适应):
                </span>
                <div className="flex flex-wrap items-center gap-6 bg-black/20 rounded-[6px] p-4 border border-white/5">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      small (h-5 w-5)
                    </span>
                    <IconButton
                      size="small"
                      onClick={() => toast.info("点击了小尺寸按钮")}
                    >
                      <Settings className="h-3 w-3" />
                    </IconButton>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      medium (h-6 w-6, 默认)
                    </span>
                    <IconButton
                      size="medium"
                      onClick={() => toast.info("点击了默认中等尺寸按钮")}
                    >
                      <Settings className="h-4 w-4" />
                    </IconButton>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      large (h-7 w-7)
                    </span>
                    <IconButton
                      size="large"
                      onClick={() => toast.info("点击了大尺寸按钮")}
                    >
                      <Settings className="h-[18px] w-[18px]" />
                    </IconButton>
                  </div>
                  <div className="h-6 w-px bg-white/5 mx-2" />
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      preset small
                    </span>
                    <IconButton
                      preset="delete"
                      size="small"
                      onClick={() => toast.error("触发了小尺寸删除")}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      preset medium
                    </span>
                    <IconButton
                      preset="delete"
                      size="medium"
                      onClick={() => toast.error("触发了中等尺寸删除")}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      preset large
                    </span>
                    <IconButton
                      preset="delete"
                      size="large"
                      onClick={() => toast.error("触发了大尺寸删除")}
                    />
                  </div>
                </div>
              </div>

              {/* 基础交互状态 */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono text-white/45">
                  Basic States:
                </span>
                <div className="flex items-center gap-4 bg-black/20 rounded-[6px] p-4 border border-white/5">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      Default
                    </span>
                    <IconButton
                      onClick={() => toast.info("点击了默认 IconButton")}
                    >
                      <Settings className="h-4 w-4" />
                    </IconButton>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      Highlighted
                    </span>
                    <IconButton
                      highlighted
                      onClick={() => toast.info("点击了高亮 IconButton")}
                    >
                      <Settings className="h-4 w-4" />
                    </IconButton>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      Disabled
                    </span>
                    <IconButton disabled onClick={() => {}}>
                      <Settings className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              </div>

              {/* 开箱即用预设 */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono text-white/45">
                  Presets (开箱即用 + 智能语义 Hover):
                </span>
                <div className="flex flex-wrap items-center gap-6 bg-black/20 rounded-[6px] p-4 border border-white/5">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      add
                    </span>
                    <IconButton
                      preset="add"
                      onClick={() => toast.success("已触发：添加 (Add) 操作")}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      close
                    </span>
                    <IconButton
                      preset="close"
                      onClick={() => toast.info("已触发：关闭 (Close) 操作")}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      save
                    </span>
                    <IconButton
                      preset="save"
                      onClick={() => toast.success("已保存配置！")}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      confirm
                    </span>
                    <IconButton
                      preset="confirm"
                      onClick={() => toast.success("操作已确认")}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      delete
                    </span>
                    <IconButton
                      preset="delete"
                      onClick={() => toast.error("数据已删除！")}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      edit
                    </span>
                    <IconButton
                      preset="edit"
                      onClick={() => toast.info("开始编辑内容")}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/30">
                      default
                    </span>
                    <IconButton
                      preset="default"
                      onClick={() => toast.info("触发默认设置")}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 章节：Tooltip */}
        {isVisible("tooltip") && (
          <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Info className="h-4 w-4 text-white/60" />
                Tooltip 文字提示
              </h3>
              <span className="text-xs font-mono text-white/30">
                Tooltip.tsx
              </span>
            </div>
            <p className="text-xs text-white/50 font-medium">
              支持四个方位（top, bottom, left, right）、不同的触发模式（Hover,
              Click, Both）：
            </p>

            <div className="flex flex-col gap-5 mt-2">
              {/* 位置选项 */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono text-white/45">
                  Placements (Hover to Trigger):
                </span>
                <div className="flex flex-wrap items-center gap-6 bg-black/20 rounded-[6px] p-4 border border-white/5">
                  <Tooltip
                    placement="top"
                    content="Prompt text on top"
                    trigger="hover"
                  >
                    <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                      Top Tooltip
                    </button>
                  </Tooltip>

                  <Tooltip
                    placement="bottom"
                    content="Prompt text on bottom"
                    trigger="hover"
                  >
                    <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                      Bottom Tooltip
                    </button>
                  </Tooltip>

                  <Tooltip
                    placement="left"
                    content="Prompt text on left"
                    trigger="hover"
                  >
                    <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                      Left Tooltip
                    </button>
                  </Tooltip>

                  <Tooltip
                    placement="right"
                    content="Prompt text on right"
                    trigger="hover"
                  >
                    <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                      Right Tooltip
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* 触发选项 */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono text-white/45">
                  Triggers (Modes):
                </span>
                <div className="flex flex-wrap items-center gap-6 bg-black/20 rounded-[6px] p-4 border border-white/5">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] font-mono text-white/30">
                      trigger="hover"
                    </span>
                    <Tooltip trigger="hover" content="Triggers purely on hover">
                      <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                        Hover Trigger
                      </button>
                    </Tooltip>
                  </div>

                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] font-mono text-white/30">
                      trigger="click"
                    </span>
                    <Tooltip
                      trigger="click"
                      content="Triggers purely on click (Click outside to close)"
                    >
                      <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                        Click Trigger
                      </button>
                    </Tooltip>
                  </div>

                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] font-mono text-white/30">
                      trigger="both"
                    </span>
                    <Tooltip
                      trigger="both"
                      content="Supports both Hover and Click triggers"
                    >
                      <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                        Both Trigger
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>

              {/* ConfirmTooltip 展示 */}
              <div className="flex flex-col gap-2 border-t border-white/5 pt-4 mt-2">
                <span className="text-xs font-mono text-white/45">
                  Tooltip 行为二次确认 (Popconfirm):
                </span>
                <div className="flex flex-wrap items-center gap-6 bg-black/20 rounded-[6px] p-4 border border-white/5">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] font-mono text-white/30">
                      variant="primary" (自适应)
                    </span>
                    <Tooltip
                      title="确定执行保存吗？"
                      description="该操作会覆盖现有的云同步记录。"
                      variant="primary"
                      onConfirm={() => toast.success("主配置已成功保存！")}
                      onCancel={() => toast.info("保存已取消")}
                    >
                      <button className="px-3 py-1.5 rounded-[6px] bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all duration-150">
                        自适应确认
                      </button>
                    </Tooltip>
                  </div>

                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] font-mono text-white/30">
                      variant="danger" (自适应)
                    </span>
                    <Tooltip
                      title="确定清空所有人际档案？"
                      description="清空后所有本地缓存亦将失效，这是一项无法恢复的高风险操作！"
                      variant="danger"
                      onConfirm={() => toast.error("数据已被全部清空！")}
                      onCancel={() => toast.info("操作已安全取消")}
                    >
                      <button className="px-3 py-1.5 rounded-[6px] bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-all duration-150">
                        自适应确认
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
