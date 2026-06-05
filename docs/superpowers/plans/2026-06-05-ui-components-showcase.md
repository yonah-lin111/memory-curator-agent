# UI Components Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "UI Components Showcase" page to memory-curator-agent that elegant demonstrates and allows interaction with all our public atomic UI components.

**Architecture:** Create a new page `ShowcasePage` at `src/renderer/src/pages/showcase/ShowcasePage.tsx`. Integrate it into the `Sidebar` navigation, register it in `App.tsx` routes, and provide custom interaction playgrounds for each component.

**Tech Stack:** React, Tailwind CSS, Lucide React Icons.

---

### Task 1: Create the ShowcasePage Component

**Files:**
- Create: `src/renderer/src/pages/showcase/ShowcasePage.tsx`

- [ ] **Step 1: Write the ShowcasePage component**
  Write a high-quality React page displaying our atomic UI components. Ensure all components are fully imported, and state hooks are set up to handle the live interactive playgrounds for each of them (e.g. testing different Tag sizes, clicking tags, Select options, PageDateNavigator calendar dropdowns, and triggering global Toast notifications).

  ```tsx
  import type React from "react";
  import { useState } from "react";
  import {
    LayoutGrid,
    MessageSquare,
    Tag as TagIcon,
    Calendar,
    ChevronDown,
    Edit3,
    FileQuestion,
    Sparkles,
    Star,
    Settings,
  } from "lucide-react";
  import { Tag } from "@renderer/components/ui/Tag";
  import { useToast } from "@renderer/components/ui/Toast";
  import { IconButton } from "@renderer/components/ui/IconButton";
  import { Select, type SelectOption, type SelectGroup } from "@renderer/components/ui/Select";
  import { PageDateNavigator } from "@renderer/components/ui/PageDateNavigator";
  import { MarkdownEditor } from "@renderer/components/ui/MarkdownEditor";
  import { EmptyState } from "@renderer/components/ui/EmptyState";

  type ActiveSection = "all" | "toast" | "tag" | "date" | "select" | "editor" | "empty" | "button";

  export const ShowcasePage = (): React.JSX.Element => {
    const toast = useToast();
    const [activeSection, setActiveSection] = useState<ActiveSection>("all");

    // Tag State
    const [isTag1Highlighted, setIsTag1Highlighted] = useState(false);
    const [isTag2Highlighted, setIsTag2Highlighted] = useState(true);
    const [dynamicTags, setDynamicTags] = useState<string[]>(["Core", "Design", "Refactor"]);

    // Date State
    const [entryDate, setEntryDate] = useState("2026-06-05");
    const [visibleMonth, setVisibleMonth] = useState("2026-06");
    const entryCountMap: Record<string, number> = {
      "2026-06-05": 3,
      "2026-06-12": 1,
      "2026-06-20": 5,
    };

    // Select State
    const [selectedValue, setSelectedValue] = useState("option-1");
    const selectOptions: SelectOption<string>[] = [
      { value: "option-1", label: "Option One (极简风格)" },
      { value: "option-2", label: "Option Two (拟物风)" },
      { value: "option-3", label: "Option Three (高对比度)" },
    ];

    const [groupedValue, setGroupedValue] = useState("java");
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

    // Markdown State
    const [markdownText, setMarkdownText] = useState("### Hello Memory Curator\nThis is a live **MarkdownEditor** preview.");

    const sections = [
      { id: "all", label: "全部组件", desc: "All Components" },
      { id: "toast", label: "Toast & Notice", desc: "消息通知与提示" },
      { id: "tag", label: "Tag 标签", desc: "高复用标签体系" },
      { id: "date", label: "Date Navigator", desc: "日期选择与月历" },
      { id: "select", label: "Select 下拉框", desc: "自定义单选与分组" },
      { id: "editor", label: "Markdown Editor", desc: "统一Markdown编辑器" },
      { id: "empty", label: "EmptyState", desc: "通用空状态卡片" },
      { id: "button", label: "IconButton", desc: "极简圆角图标按钮" },
    ] as const;

    const isVisible = (sec: ActiveSection) => activeSection === "all" || activeSection === sec;

    return (
      <div className="flex h-full min-h-0 w-full gap-4 text-white">
        {/* 左侧 Mini 导航栏 */}
        <aside className="w-52 flex-shrink-0 flex flex-col gap-4 bg-[#212121] border border-white/5 rounded-[6px] p-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <LayoutGrid className="h-4 w-4 text-white/70" />
            <span className="text-sm font-bold tracking-wider">UI WORKSHOP</span>
          </div>
          <nav className="flex flex-col gap-1 flex-1 overflow-y-auto custom-scrollbar">
            {sections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`flex flex-col items-start px-3 py-2 rounded-[6px] transition-all duration-150 ${
                  activeSection === sec.id
                    ? "bg-white text-black font-semibold"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="text-xs font-bold">{sec.label}</span>
                <span className={`text-[10px] leading-none mt-0.5 ${activeSection === sec.id ? "text-black/60" : "text-white/30"}`}>
                  {sec.desc}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* 右侧展示内容区 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 pr-1">
          {/* Section: Toast */}
          {isVisible("toast") && (
            <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-white/60" />
                  Toast 消息提示 & useToast
                </h3>
                <span className="text-xs font-mono text-white/30">Toast.tsx</span>
              </div>
              <p className="text-xs text-white/50">全局唯一通知中心。每次触发新提示会直接替换，避免消息堆叠：</p>
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

          {/* Section: Tag */}
          {isVisible("tag") && (
            <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <TagIcon className="h-4 w-4 text-white/60" />
                  Tag 标签
                </h3>
                <span className="text-xs font-mono text-white/30">Tag.tsx</span>
              </div>
              <p className="text-xs text-white/50">支持多种尺寸、高亮/非高亮，以及丰富的交互前缀与关闭事件：</p>
              
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-white/30 w-24">Sizes:</span>
                  <div className="flex items-center gap-2">
                    <Tag size="small">Small Tag</Tag>
                    <Tag size="default">Default Tag</Tag>
                    <Tag size="large">Large Tag</Tag>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-white/30 w-24">Interactive:</span>
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
                  <span className="text-xs font-mono text-white/30 w-24">Closable List:</span>
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
                        onClick={() => setDynamicTags(["Core", "Design", "Refactor"])}
                        className="text-xs text-white/40 hover:text-white hover:underline"
                      >
                        Reset List
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section: PageDateNavigator */}
          {isVisible("date") && (
            <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-white/60" />
                  PageDateNavigator 日期导航与月历
                </h3>
                <span className="text-xs font-mono text-white/30">PageDateNavigator.tsx</span>
              </div>
              <p className="text-xs text-white/50">弹出式极简日历，内置角标聚合显示（右上角角标数支持超过99时显示“99+”）：</p>
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

          {/* Section: Select */}
          {isVisible("select") && (
            <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ChevronDown className="h-4 w-4 text-white/60" />
                  Select 自定义下拉框
                </h3>
                <span className="text-xs font-mono text-white/30">Select.tsx</span>
              </div>
              <p className="text-xs text-white/50">支持标准的平铺选项和分组选项，配有精致的入场动画：</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-mono text-white/30">Standard Select:</span>
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
                  <span className="text-xs font-mono text-white/30">Grouped Select:</span>
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

          {/* Section: MarkdownEditor */}
          {isVisible("editor") && (
            <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-white/60" />
                  MarkdownEditor
                </h3>
                <span className="text-xs font-mono text-white/30">MarkdownEditor.tsx</span>
              </div>
              <p className="text-xs text-white/50">集成了高亮、字数统计等功能的暗色系编辑器（高度自适应）：</p>
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

          {/* Section: EmptyState */}
          {isVisible("empty") && (
            <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <FileQuestion className="h-4 w-4 text-white/60" />
                  EmptyState 通用空状态
                </h3>
                <span className="text-xs font-mono text-white/30">EmptyState.tsx</span>
              </div>
              <p className="text-xs text-white/50">支持设置自定义的操作区域组件：</p>
              
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-mono text-white/30">Without Action Button:</span>
                  <EmptyState
                    title="无任何标签记录"
                    description="请尝试在随笔或笔记中输入 # 进行标签捕获。"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-mono text-white/30">With Action Button:</span>
                  <EmptyState
                    title="未找到匹配的记忆片段"
                    description="该时期内暂时没有记录。现在就创建一个吗？"
                    action={
                      <button
                        type="button"
                        onClick={() => toast.success("触发创建流程！")}
                        className="px-3 py-1 rounded-[6px] bg-white text-black text-xs font-bold hover:bg-white/90 transition-colors"
                      >
                        立即创建
                      </button>
                    }
                  />
                </div>
              </div>
            </section>
          )}

          {/* Section: IconButton */}
          {isVisible("button") && (
            <section className="bg-[#212121] border border-white/5 rounded-[6px] p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Star className="h-4 w-4 text-white/60" />
                  IconButton 图标按钮
                </h3>
                <span className="text-xs font-mono text-white/30">IconButton.tsx</span>
              </div>
              <p className="text-xs text-white/50">微动画悬停效果，支持高亮和禁用属性：</p>
              
              <div className="flex items-center gap-4 mt-2 bg-black/20 rounded-[6px] p-4 border border-white/5">
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-mono text-white/30">Default</span>
                  <IconButton onClick={() => toast.info("点击了默认 IconButton")}>
                    <Settings className="h-4 w-4" />
                  </IconButton>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-mono text-white/30">Highlighted</span>
                  <IconButton highlighted onClick={() => toast.info("点击了高亮 IconButton")}>
                    <Settings className="h-4 w-4" />
                  </IconButton>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-mono text-white/30">Disabled</span>
                  <IconButton disabled onClick={() => {}}>
                    <Settings className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    );
  };
  ```

---

### Task 2: Register showcase in Sidebar

**Files:**
- Modify: `src/renderer/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Expand SidebarPageId and Add NAVIGATION_GROUPS**
  Add `"showcase"` type to `SidebarPageId`. Then import `LayoutGrid` from `lucide-react`. Register the `DEVELOPER` NavigationGroup inside `NAVIGATION_GROUPS`.

  ```tsx
  // ... (Lines 25-34 in Sidebar.tsx)
  export type SidebarPageId =
    | "today"
    | "notes"
    | "journal"
    | "weekly"
    | "themes"
    | "memories"
    | "todo"
    | "snippets"
    | "people"
    | "showcase"; // <--- Add showcase here
  ```

  And add the navigation group:
  ```tsx
  // ... (Lines 104-177 in Sidebar.tsx)
  import { LayoutGrid, ... } from "lucide-react";

  const NAVIGATION_GROUPS: NavigationGroup[] = [
    // ... daily, library, curation groups
    {
      id: "developer",
      label: "DEVELOPER",
      items: [
        {
          id: "showcase",
          label: "UI Showcase",
          description: "公共组件展示与交互",
          icon: LayoutGrid,
        },
      ],
    },
  ];
  ```

---

### Task 3: Map showcase page in App.tsx

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Import ShowcasePage and register page**
  Add `"showcase"` to `VALID_PAGES`, map the category `"DEVELOPER"` inside `getPageCategory`, and render `<ShowcasePage />` under `renderPageById`.

  ```tsx
  import { ShowcasePage } from "@renderer/pages/showcase/ShowcasePage";

  const VALID_PAGES: SidebarPageId[] = [
    "today",
    "notes",
    "journal",
    "weekly",
    "themes",
    "memories",
    "todo",
    "snippets",
    "people",
    "showcase", // <--- Add here
  ];

  const getPageCategory = (pageId: SidebarPageId): string => {
    switch (pageId) {
      case "showcase":
        return "DEVELOPER"; // <--- Add here
      // ...
    }
  };

  const renderPageById = (pageId: SidebarPageId): React.JSX.Element => {
    switch (pageId) {
      case "showcase":
        return <ShowcasePage />; // <--- Add here
      // ...
    }
  };
  ```

---

### Task 4: Verification and Quality Checks

- [ ] **Step 1: Verify using compilation, linting and typecheck**
  Run typescript type checking to make sure everything passes without any import issues.
  Run: `npm run typecheck` or similar workspace compilation/linting scripts.
