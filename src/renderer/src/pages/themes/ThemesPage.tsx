import type React from "react";
import { useEffect, useMemo, useState, useRef } from "react";
import * as echarts from "echarts";
import {
  Layers,
  Archive,
  RotateCcw,
  FileText,
  Download,
  Sparkles,
  Activity,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { Tag } from "@/components/ui/Tag";

/** 主题项类型（与 preload 对齐） */
type ThemeItem = {
  id: number;
  externalId: string;
  name: string;
  description: string;
  color: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
};

/** 主题关联素材类型 */
type ThemeItemsItem = {
  id: number;
  externalId: string;
  themeExternalId: string;
  sourceType: string;
  sourceId: string;
  relevanceNote: string;
  aiExtracted: number;
  createdAt: string;
  sourceTitle?: string;
  sourceContent?: string;
  sourceEntryDate?: string;
};

/** 主题时间线节点 */
type ThemeTimelineItem = {
  date: string;
  itemCount: number;
  mentionedInSummary: boolean;
};

/** 素材类型中文映射 */
const SOURCE_LABELS: Record<string, string> = {
  note: "笔记",
  journal: "日记",
  snippet: "片段",
  weekly_summary: "周度总结",
};

/**
 * ThemesPage - 长期主题追踪页面。
 * 运用 Origami 律动网格 (Bento Grid) 进行主题策展。
 */
export const ThemesPage = (): React.JSX.Element => {
  const toast = useToast();

  const [themes, setThemes] = useState<ThemeItem[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [items, setItems] = useState<ThemeItemsItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [timeline, setTimeline] = useState<ThemeTimelineItem[]>([]);

  // 创建/编辑弹窗状态
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ThemeItem | null>(null);
  const [editorName, setEditorName] = useState("");
  const [editorDesc, setEditorDesc] = useState("");
  const [editorSaving, setEditorSaving] = useState(false);

  // Tooltip 内联编辑状态
  const [editTooltipTheme, setEditTooltipTheme] = useState<ThemeItem | null>(
    null,
  );
  const [editTooltipName, setEditTooltipName] = useState("");
  const [editTooltipDesc, setEditTooltipDesc] = useState("");

  // 标签导入弹窗状态
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importTagsText, setImportTagsText] = useState("");
  const [importLoading, setImportLoading] = useState(false);

  // ECharts DOM 引用与实例
  const timelineChartRef = useRef<HTMLDivElement | null>(null);
  const timelineInstance = useRef<echarts.ECharts | null>(null);

  /** 加载主题列表 */
  const loadThemes = async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (!window.api?.themes) {
        console.error(
          "[ThemesPage] window.api.themes 不可用，请检查 preload 是否加载了 themes API",
        );
        return;
      }
      const list = await window.api.themes.list();
      setThemes(list);
    } catch (err) {
      console.error("[ThemesPage] 加载主题失败:", err);
      toast.error("加载主题列表失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadThemes();
  }, []);

  /** 加载选中主题的关联素材 */
  useEffect(() => {
    if (!selectedThemeId || !window.api?.themes) return;
    setItemsLoading(true);
    window.api.themes.listItems(selectedThemeId)
      .then((itemsResult) => {
        setItems(itemsResult);
        
        // 基于素材的实际日期生成 Daily Timeline 并自动补全空白日期
        const grouped = new Map<string, { count: number; summary: boolean }>();
        itemsResult.forEach((item) => {
          const dateStr = (item.sourceEntryDate || item.createdAt).substring(0, 10).replace(/\//g, "-");
          if (!grouped.has(dateStr)) {
            grouped.set(dateStr, { count: 0, summary: false });
          }
          const g = grouped.get(dateStr)!;
          g.count += 1;
          if (item.sourceType === "weekly_summary") {
            g.summary = true;
          }
        });

        const dates = Array.from(grouped.keys()).sort();
        if (dates.length === 0) {
          setTimeline([]);
          return;
        }

        const minDate = new Date(dates[0]);
        const maxDate = new Date(dates[dates.length - 1]);
        const today = new Date();
        const end = maxDate > today ? maxDate : today;
        let start = minDate;
        
        // 确保至少显示最近 7 天的脉络
        const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
        if (diffDays < 6) {
          start = new Date(end.getTime() - 6 * 24 * 3600 * 1000);
        }

        const newTimeline: ThemeTimelineItem[] = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          // 本地时区格式化 YYYY-MM-DD
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const ds = `${y}-${m}-${day}`;
          
          const g = grouped.get(ds);
          newTimeline.push({
            date: ds,
            itemCount: g ? g.count : 0,
            mentionedInSummary: g ? g.summary : false,
          });
        }
        
        setTimeline(newTimeline);
      })
      .catch(() => toast.error("加载主题详情失败"))
      .finally(() => setItemsLoading(false));
  }, [selectedThemeId]);

  const selectedTheme = useMemo(
    () => themes.find((t) => t.externalId === selectedThemeId) ?? null,
    [themes, selectedThemeId],
  );

  const activeThemes = useMemo(
    () => themes.filter((t) => t.status === "active"),
    [themes],
  );
  const archivedThemes = useMemo(
    () => themes.filter((t) => t.status === "archived"),
    [themes],
  );

  /** 保存主题（创建/更新） */
  const handleSaveTheme = async (): Promise<void> => {
    if (!editorName.trim()) {
      toast.error("主题名称不能为空");
      return;
    }
    setEditorSaving(true);
    try {
      if (!window.api?.themes) return;
      if (editTarget) {
        await window.api.themes.update(editTarget.externalId, {
          name: editorName.trim(),
          description: editorDesc.trim(),
        });
        toast.success("主题已更新");
      } else {
        await window.api.themes.create({
          name: editorName.trim(),
          description: editorDesc.trim(),
        });
        toast.success("主题已创建");
      }
      await loadThemes();
    } catch {
      toast.error("保存主题失败");
    } finally {
      setEditorSaving(false);
    }
  };

  /** 工具提示内联保存 */
  const handleTooltipSave = async (): Promise<void> => {
    if (!editTooltipTheme || !editTooltipName.trim() || !window.api?.themes)
      return;
    try {
      await window.api.themes.update(editTooltipTheme.externalId, {
        name: editTooltipName.trim(),
        description: editTooltipDesc.trim(),
      });
      toast.success("主题已更新");
      setEditTooltipTheme(null);
      await loadThemes();
    } catch {
      toast.error("保存失败");
    }
  };

  /** 打开工具提示编辑 */
  const openTooltipEdit = (theme: ThemeItem): void => {
    setEditTooltipTheme(theme);
    setEditTooltipName(theme.name);
    setEditTooltipDesc(theme.description);
  };

  /** 删除主题 */
  const handleDeleteTheme = async (theme: ThemeItem): Promise<void> => {
    try {
      if (!window.api?.themes) return;
      await window.api.themes.delete(theme.externalId);
      if (selectedThemeId === theme.externalId) setSelectedThemeId(null);
      toast.success(`已删除「${theme.name}」`);
      await loadThemes();
    } catch {
      toast.error("删除主题失败");
    }
  };

  /** 归档/恢复主题 */
  const handleToggleArchive = async (theme: ThemeItem): Promise<void> => {
    const newStatus = theme.status === "active" ? "archived" : "active";
    try {
      if (!window.api?.themes) return;
      await window.api.themes.update(theme.externalId, { status: newStatus });
      await loadThemes();
      toast.success(newStatus === "archived" ? "已归档" : "已恢复");
    } catch {
      toast.error("操作失败");
    }
  };

  /** 执行标签导入 */
  const handleImportFromTags = async (): Promise<void> => {
    const existingNames = new Set(themes.map((t) => t.name));
    const tags = importTagsText
      .split(",")
      .map((s) => s.trim().replace(/^#/, ""))
      .filter(Boolean);
    const newTags = tags.filter((t) => !existingNames.has(t));
    if (!newTags.length) {
      toast.error("所有标签已作为主题存在");
      return;
    }
    setImportLoading(true);
    try {
      if (!window.api?.themes) return;
      const created = await window.api.themes.importFromTags(newTags);
      toast.success(`已导入 ${created.length} 个标签为主题`);
      await loadThemes();
    } catch {
      toast.error("导入失败");
    } finally {
      setImportLoading(false);
    }
  };

  /** 解除关联 */
  const handleRemoveItem = async (item: ThemeItemsItem): Promise<void> => {
    if (!selectedThemeId || !window.api?.themes) return;
    try {
      await window.api.themes.removeItem(
        selectedThemeId,
        item.sourceType,
        item.sourceId,
      );
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("已解除关联");
      void window.api.themes.updateDescription(selectedThemeId);
    } catch {
      toast.error("操作失败");
    }
  };

  /** ECharts 脉搏律动渲染 */
  useEffect(() => {
    if (!timelineChartRef.current) return;
    if (!selectedTheme || timeline.length === 0) {
      // 当没有数据时，清空图表
      if (timelineInstance.current) {
        timelineInstance.current.clear();
      }
      return;
    }

    // 单元测试环境拦截
    const isTestEnv =
      (typeof process !== "undefined" &&
        (process.env?.NODE_ENV === "test" || Boolean(process.env?.VITEST))) ||
      (typeof window !== "undefined" &&
        Boolean((window as any).vi || (window as any).__vitest_worker__));
    if (isTestEnv) return;

    if (!timelineInstance.current) {
      timelineInstance.current = echarts.init(timelineChartRef.current);
    }

    const xAxisData = timeline.map((t) => t.date.substring(5));
    const seriesData = timeline.map((t) => ({
      value: t.itemCount,
      itemStyle: {
        color: t.mentionedInSummary
          ? "rgba(74, 222, 128, 1)"
          : "rgba(255, 255, 255, 0.8)",
      },
    }));

    timelineInstance.current.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(33, 33, 33, 0.95)",
        borderColor: "rgba(255,255,255,0.05)",
        textStyle: { color: "#ffffff", fontSize: 12, fontFamily: "monospace" },
        axisPointer: { type: "line" },
      },
      grid: {
        top: 20,
        right: 10,
        bottom: 25,
        left: 25,
      },
      xAxis: {
        type: "category",
        data: xAxisData,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "rgba(255,255,255,0.3)",
          fontSize: 10,
          fontFamily: "monospace",
          margin: 10,
        },
      },
      yAxis: {
        type: "value",
        splitLine: {
          show: true,
          lineStyle: { color: "rgba(255,255,255,0.04)", type: "dashed" },
        },
        axisLabel: {
          color: "rgba(255,255,255,0.3)",
          fontSize: 10,
          fontFamily: "monospace",
        },
      },
      series: [
        {
          name: "关联数量",
          type: "line",
          smooth: true,
          showSymbol: true,
          symbolSize: 6,
          data: seriesData,
          lineStyle: {
            color: "rgba(255, 255, 255, 0.2)",
            width: 2,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(255, 255, 255, 0.1)" },
              { offset: 1, color: "rgba(255, 255, 255, 0)" },
            ]),
          },
        },
      ],
    });

    const handleResize = () => timelineInstance.current?.resize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [timeline, selectedTheme]);

  /** 卸载清理图表 */
  useEffect(() => {
    return () => {
      timelineInstance.current?.dispose();
      timelineInstance.current = null;
    };
  }, []);

  return (
    <section
      aria-label="Themes Page"
      className="flex h-full min-h-0 flex-col gap-3 text-white text-sm"
    >
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* 左侧：精美的 Origami 风格列表 */}
        <div className="min-h-0 flex flex-col gap-3 rounded-[6px] border border-white/5 bg-[#212121] p-4 flex-shrink-0">
          <div className="flex items-center justify-between border-b border-white/5 pb-2 flex-shrink-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 mr-1">
                <span className="text-sm font-bold text-white/80">
                  主题列表
                </span>
                <span className="text-xs text-white/30">({themes.length})</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip
                placement="bottom"
                trigger="click"
                contentClassName="!w-[320px] !p-4 !whitespace-normal flex flex-col"
                onConfirm={handleImportFromTags}
                onCancel={() => setImportTagsText("")}
                form={
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-white/40">
                      标签 (逗号分隔)
                    </span>
                    <input
                      className="w-full bg-[#212121] border border-white/10 rounded-[6px] px-3 py-2 text-xs text-white/90 placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
                      placeholder="如：前端架构, 效率工具, 健身"
                      value={importTagsText}
                      onChange={(e) => setImportTagsText(e.target.value)}
                      autoFocus
                    />
                    <p className="text-xs text-white/30 leading-relaxed">
                      输入需转化为独立主题的标签。已存在同名主题将自动跳过防重。
                    </p>
                  </div>
                }
              >
                <IconButton preset="default" size="small" title="从标签导入">
                  <Download className="h-3.5 w-3.5" />
                </IconButton>
              </Tooltip>
              <Tooltip
                placement="bottom"
                trigger="click"
                contentClassName="!w-[320px] !p-4 !whitespace-normal flex flex-col"
                onConfirm={handleSaveTheme}
                onCancel={() => {
                  setEditorName("");
                  setEditorDesc("");
                }}
                form={
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-white/40">
                        主题名称
                      </span>
                      <input
                        className="w-full bg-[#212121] border border-white/10 rounded-[6px] px-3 py-2 text-xs text-white/90 placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
                        placeholder="如：职业转型、心智成长"
                        value={editorName}
                        onChange={(e) => setEditorName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-white/40">
                        描述
                      </span>
                      <textarea
                        className="w-full bg-[#212121] border border-white/10 rounded-[6px] px-3 py-2 text-xs text-white/90 placeholder:text-white/20 outline-none focus:border-white/30 transition-colors resize-none h-16 leading-relaxed"
                        placeholder="为何确立此主题？期待怎样的沉淀？"
                        value={editorDesc}
                        onChange={(e) => setEditorDesc(e.target.value)}
                      />
                    </div>
                  </div>
                }
              >
                <IconButton
                  preset="add"
                  size="small"
                  onClick={() => {
                    setEditTarget(null);
                    setEditorName("");
                    setEditorDesc("");
                  }}
                  title="新建主题"
                />
              </Tooltip>
            </div>
          </div>

          <div className="flex-1 overflow-y-scroll custom-scrollbar pr-0.5 flex flex-col gap-2.5">
            {isLoading ? (
              <div className="text-xs text-white/30 font-mono py-8 text-center">
                加载脉络中...
              </div>
            ) : themes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 bg-[#1a1a1a] rounded-[6px] border border-white/5 mt-1">
                <Layers className="h-8 w-8 text-white/10" />
                <p className="text-xs text-white/30 font-mono">暂无长期主题</p>
                <Tooltip
                  placement="bottom"
                  trigger="click"
                  contentClassName="!w-[320px] !p-4 !whitespace-normal flex flex-col"
                  onConfirm={handleImportFromTags}
                  onCancel={() => setImportTagsText("")}
                  form={
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-white/40">
                        标签 (逗号分隔)
                      </span>
                      <input
                        className="w-full bg-[#212121] border border-white/10 rounded-[6px] px-3 py-2 text-xs text-white/90 placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
                        placeholder="如：前端架构, 效率工具, 健身"
                        value={importTagsText}
                        onChange={(e) => setImportTagsText(e.target.value)}
                        autoFocus
                      />
                      <p className="text-xs text-white/30 leading-relaxed">
                        输入需转化为独立主题的标签。已存在同名主题将自动跳过防重。
                      </p>
                    </div>
                  }
                >
                  <button className="mt-3 rounded-[6px] border border-white/10 px-4 py-2 text-xs text-white/60 hover:text-white hover:border-white/20 transition-all bg-black/20 hover:bg-black/40">
                    <Download className="h-3 w-3 inline mr-1" />
                    从标签快速导入
                  </button>
                </Tooltip>
              </div>
            ) : (
              <>
                {activeThemes.map((theme) => (
                  <button
                    key={theme.externalId}
                    onClick={() => setSelectedThemeId(theme.externalId)}
                    className={`w-full text-left flex flex-col gap-1 p-2.5 rounded-[6px] transition-all duration-150 group ${
                      selectedThemeId === theme.externalId
                        ? "bg-white/5 text-white"
                        : "hover:bg-white/[0.02] text-white/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white/90 truncate mr-2">
                        {theme.name}
                      </span>
                      {/* 悬停操作 */}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                        <Tooltip
                          placement="bottom"
                          trigger="click"
                          contentClassName="!w-[320px] !p-4 !whitespace-normal flex flex-col"
                          form={
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-white/40">
                                  主题名称
                                </span>
                                <input
                                  className="w-full bg-[#212121] border border-white/10 rounded-[6px] px-3 py-2 text-xs text-white/90 placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
                                  value={editTooltipName}
                                  onChange={(e) =>
                                    setEditTooltipName(e.target.value)
                                  }
                                  placeholder="主题名称"
                                  autoFocus
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-white/40">
                                  描述
                                </span>
                                <textarea
                                  className="w-full bg-[#212121] border border-white/10 rounded-[6px] px-3 py-2 text-xs text-white/90 placeholder:text-white/20 outline-none focus:border-white/30 transition-colors resize-none h-24 leading-relaxed"
                                  value={editTooltipDesc}
                                  onChange={(e) =>
                                    setEditTooltipDesc(e.target.value)
                                  }
                                  placeholder="意图描述"
                                />
                              </div>
                            </div>
                          }
                          onConfirm={handleTooltipSave}
                        >
                          <IconButton
                            preset="edit"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTooltipEdit(theme);
                            }}
                          />
                        </Tooltip>
                        <Tooltip
                          title="确认删除"
                          description={`确定删除主题「${theme.name}」及其所有关联？此操作无法撤销。`}
                          variant="danger"
                          onConfirm={() => handleDeleteTheme(theme)}
                        >
                          <IconButton preset="delete" size="small" />
                        </Tooltip>
                      </div>
                    </div>
                    {theme.description && (
                      <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">
                        {theme.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs text-white/30 font-mono flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {theme.itemCount ?? 0} 项
                      </span>
                    </div>
                  </button>
                ))}

                {archivedThemes.length > 0 && (
                  <div className="mt-4 border-t border-white/5 pt-4">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <Archive className="h-3.5 w-3.5 text-white/20" />
                      <span className="text-xs font-mono uppercase tracking-wider text-white/20">
                        归档休眠
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {archivedThemes.map((theme) => (
                        <button
                          key={theme.externalId}
                          onClick={() => setSelectedThemeId(theme.externalId)}
                          className={`w-full text-left rounded-[6px] p-2.5 transition-all group ${
                            selectedThemeId === theme.externalId
                              ? "bg-white/5 text-white"
                              : "hover:bg-white/[0.02] text-white/70"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-white/40 truncate">
                              {theme.name}
                            </span>
                            <IconButton
                              preset="default"
                              size="small"
                              className="opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleArchive(theme);
                              }}
                              title="唤醒恢复"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </IconButton>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 右侧：Bento Grid 数据透视面板 */}
        <div className="min-h-0 flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar rounded-[6px] border border-white/5 bg-[#212121] p-5">
          {!selectedTheme ? (
            <div className="flex-1 flex items-center justify-center border border-white/5 bg-[#1a1a1a]/50 rounded-[6px]">
              <div className="text-center opacity-60">
                <Sparkles className="h-10 w-10 text-white/10 mx-auto mb-4" />
                <p className="text-xs text-white/40 font-mono tracking-widest uppercase">
                  选择主题 探索脉络
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Bento Grid 上半部分: 主题档案与脉搏 */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-h-[220px] flex-shrink-0">
                {/* 主题档案（跨 2 列） */}
                <div className="xl:col-span-2 bg-[#1a1a1a] rounded-[6px] border border-white/5 p-6 flex flex-col justify-between relative group overflow-hidden">
                  {/* 微妙背景强调 */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 blur-3xl rounded-full pointer-events-none" />

                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10 bg-[#1a1a1a]/80 backdrop-blur-sm rounded-[6px] p-1 border border-white/5">
                    <Tooltip
                      placement="bottom"
                      trigger="click"
                      contentClassName="!w-[320px] !p-4 !whitespace-normal flex flex-col"
                      form={
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-white/40">
                              主题名称
                            </span>
                            <input
                              className="w-full bg-[#212121] border border-white/10 rounded-[6px] px-3 py-2 text-xs text-white/90 placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
                              value={editTooltipName}
                              onChange={(e) =>
                                setEditTooltipName(e.target.value)
                              }
                              placeholder="主题名称"
                              autoFocus
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-white/40">
                              描述
                            </span>
                            <textarea
                              className="w-full bg-[#212121] border border-white/10 rounded-[6px] px-3 py-2 text-xs text-white/90 placeholder:text-white/20 outline-none focus:border-white/30 transition-colors resize-none h-24 leading-relaxed"
                              value={editTooltipDesc}
                              onChange={(e) =>
                                setEditTooltipDesc(e.target.value)
                              }
                              placeholder="意图描述"
                            />
                          </div>
                        </div>
                      }
                      onConfirm={handleTooltipSave}
                    >
                      <IconButton
                        preset="edit"
                        size="small"
                        onClick={() => openTooltipEdit(selectedTheme)}
                      />
                    </Tooltip>
                    <IconButton
                      preset="default"
                      size="small"
                      onClick={() => handleToggleArchive(selectedTheme)}
                      title={
                        selectedTheme.status === "active" ? "休眠" : "唤醒"
                      }
                    >
                      {selectedTheme.status === "active" ? (
                        <Archive className="h-3.5 w-3.5" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                    </IconButton>
                    <Tooltip
                      title="确认删除"
                      description={`确定删除主题「${selectedTheme.name}」及其所有关联？此操作无法撤销。`}
                      variant="danger"
                      onConfirm={() => handleDeleteTheme(selectedTheme)}
                    >
                      <IconButton preset="delete" size="small" />
                    </Tooltip>
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <Layers className="w-3.5 h-3.5 text-white/30" />
                      <span className="font-mono text-xs font-bold uppercase tracking-widest text-white/30">
                        Theme Profile
                      </span>
                      <Tag
                        size="small"
                        color={
                          selectedTheme.status === "active"
                            ? "emerald"
                            : "default"
                        }
                        className="ml-2 scale-90"
                      >
                        {selectedTheme.status === "active" ? "活跃" : "休眠"}
                      </Tag>
                    </div>
                    <h2 className="text-xl font-bold text-white/95 tracking-wide mb-2">
                      {selectedTheme.name}
                    </h2>
                    {selectedTheme.description && (
                      <p className="text-sm text-white/50 leading-relaxed max-w-2xl">
                        {selectedTheme.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-5 mt-6 border-t border-white/5 pt-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-mono text-white/30 mb-1">
                        RECORDED ITEMS
                      </span>
                      <span className="text-sm font-bold text-white/80">
                        {selectedTheme.itemCount ?? 0}
                      </span>
                    </div>
                    <div className="w-px h-6 bg-white/5" />
                    <div className="flex flex-col">
                      <span className="text-xs font-mono text-white/30 mb-1">
                        CREATED AT
                      </span>
                      <span className="text-xs text-white/60 font-mono mt-0.5">
                        {selectedTheme.createdAt.split("T")[0]}
                      </span>
                    </div>
                    <div className="w-px h-6 bg-white/5" />
                    <div className="flex flex-col">
                      <span className="text-xs font-mono text-white/30 mb-1">
                        LAST UPDATE
                      </span>
                      <span className="text-xs text-white/60 font-mono mt-0.5">
                        {selectedTheme.updatedAt.split("T")[0]}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 时间线脉冲（跨 1 列） */}
                <div className="xl:col-span-1 bg-[#1a1a1a] rounded-[6px] border border-white/5 p-5 flex flex-col relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-2 z-10">
                    <Activity className="w-3.5 h-3.5 text-white/30" />
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-white/30">
                      Rhythm Pulse
                    </span>
                  </div>
                  <div
                    className="flex-1 w-full relative min-h-[200px] z-10"
                    ref={timelineChartRef}
                  >
                    {timeline.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-white/20 font-mono">
                          暂无脉搏数据
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bento Grid 下半部分: 关联素材墙 (Masonry 风格) */}
              <div className="bg-[#1a1a1a] rounded-[6px] border border-white/5 p-6 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-5">
                  <FileText className="w-4 h-4 text-white/40" />
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-white/40">
                    关联记录碎片
                  </span>
                </div>

                {itemsLoading ? (
                  <div className="text-xs text-white/30 font-mono py-12 text-center flex-1 flex items-center justify-center">
                    读取碎片中...
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center border border-white/5 border-dashed rounded-[6px] bg-black/20 m-2 min-h-[160px]">
                    <Sparkles className="w-6 h-6 text-white/10 mb-2" />
                    <span className="text-xs text-white/30 font-mono">
                      该主题下尚无碎片记录
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 content-start">
                    {items.map((item) => (
                      <div
                        key={item.externalId}
                        className="bg-[#212121] rounded-[6px] border border-white/5 p-4 flex flex-col gap-2 group transition-all hover:border-white/15"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <Tag color="default" className="opacity-80">
                              {SOURCE_LABELS[item.sourceType] ??
                                item.sourceType}
                            </Tag>
                            <span
                              className="text-xs text-white/80 font-bold max-w-[200px] truncate"
                              title={item.sourceTitle}
                            >
                              {item.sourceTitle ?? `#${item.sourceId}`}
                            </span>
                            {item.aiExtracted === 1 && (
                              <span className="text-xs text-white/30 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded-[3px] border border-white/[0.05]">
                                AI
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {item.sourceEntryDate && (
                              <span className="text-xs text-white/20 font-mono mt-0.5">
                                {item.sourceEntryDate}
                              </span>
                            )}
                            <IconButton
                              preset="close"
                              size="small"
                              className="opacity-0 group-hover:opacity-100 -mr-1"
                              onClick={() => handleRemoveItem(item)}
                              title="解绑碎片"
                            />
                          </div>
                        </div>

                        {item.relevanceNote && (
                          <div className="mt-1 pl-2.5">
                            <p className="text-xs text-white/40 leading-relaxed italic">
                              "{item.relevanceNote}"
                            </p>
                          </div>
                        )}

                        {item.sourceContent && (
                          <div className="mt-2 bg-black/40 rounded-[4px] p-2.5 border border-white/5">
                            <p className="text-xs text-white/30 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                              {item.sourceContent.slice(0, 300)}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 创建/编辑主题弹窗 */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] rounded-[6px] border border-white/10 p-6 w-[420px] max-w-[90vw] shadow-2xl">
            <h3 className="text-sm font-bold text-white/90 mb-5 tracking-wide">
              {editTarget ? "编辑长期主题" : "构筑新主题"}
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-white/40 mb-1.5 block">
                  主题核心 (Name)
                </label>
                <input
                  className="w-full bg-[#212121] border border-white/10 rounded-[6px] px-3.5 py-2.5 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
                  placeholder="如：职业转型、心智成长"
                  value={editorName}
                  onChange={(e) => setEditorName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-white/40 mb-1.5 block">
                  意图描述 (Description)
                </label>
                <textarea
                  className="w-full bg-[#212121] border border-white/10 rounded-[6px] px-3.5 py-2.5 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-white/30 transition-colors resize-none h-24 leading-relaxed"
                  placeholder="为何确立此主题？期待怎样的沉淀？"
                  value={editorDesc}
                  onChange={(e) => setEditorDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2.5 mt-6">
              <button
                className="rounded-[6px] border border-transparent px-4 py-2 text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                onClick={() => setIsEditorOpen(false)}
              >
                取消
              </button>
              <button
                className="rounded-[6px] bg-white text-black px-5 py-2 text-xs font-bold hover:bg-white/90 transition-colors disabled:opacity-40"
                onClick={handleSaveTheme}
                disabled={editorSaving || !editorName.trim()}
              >
                {editorSaving
                  ? "保存中..."
                  : editTarget
                    ? "确认更新"
                    : "确立主题"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 从标签导入弹窗 */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] rounded-[6px] border border-white/10 p-6 w-[420px] max-w-[90vw] shadow-2xl">
            <h3 className="text-sm font-bold text-white/90 mb-5 tracking-wide">
              从高频标签提取主题
            </h3>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-white/40 mb-1.5 block">
                Tags (逗号分隔)
              </label>
              <input
                className="w-full bg-[#212121] border border-white/10 rounded-[6px] px-3.5 py-2.5 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
                placeholder="如：前端架构, 效率工具, 健身"
                value={importTagsText}
                onChange={(e) => setImportTagsText(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleImportFromTags();
                }}
              />
              <p className="text-xs text-white/30 mt-2.5 leading-relaxed bg-white/5 p-2.5 rounded-[4px]">
                输入需转化为独立主题的标签。已存在同名主题将自动跳过防重。
              </p>
            </div>
            <div className="flex justify-end gap-2.5 mt-6">
              <button
                className="rounded-[6px] border border-transparent px-4 py-2 text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                onClick={() => setIsImportOpen(false)}
              >
                取消
              </button>
              <button
                className="rounded-[6px] bg-white text-black px-5 py-2 text-xs font-bold hover:bg-white/90 transition-colors disabled:opacity-40"
                onClick={handleImportFromTags}
                disabled={importLoading || !importTagsText.trim()}
              >
                {importLoading ? "提取中..." : "确认提取"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
