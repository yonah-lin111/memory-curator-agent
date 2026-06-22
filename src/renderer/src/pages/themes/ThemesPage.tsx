import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Layers,
  Archive,
  RotateCcw,
  FileText,
  Clock,
  Download
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { IconButton } from '@/components/ui/IconButton'
import { Tag } from '@/components/ui/Tag'

/** 主题项类型（与 preload 对齐） */
type ThemeItem = {
  id: number
  externalId: string
  name: string
  description: string
  color: string | null
  status: string
  createdAt: string
  updatedAt: string
  itemCount?: number
}

/** 主题关联素材类型 */
type ThemeItemsItem = {
  id: number
  externalId: string
  themeExternalId: string
  sourceType: string
  sourceId: string
  relevanceNote: string
  aiExtracted: number
  createdAt: string
  sourceTitle?: string
  sourceContent?: string
  sourceEntryDate?: string
}

/** 主题时间线节点 */
type ThemeTimelineItem = {
  weekStartDate: string
  itemCount: number
  mentionedInSummary: boolean
}

/** 素材类型中文映射 */
const SOURCE_LABELS: Record<string, string> = {
  note: '笔记',
  journal: '日记',
  snippet: '片段',
  weekly_summary: '周度总结'
}

/**
 * ThemesPage - 长期主题追踪页面。
 * 左侧主题列表 + 右侧详情面板，支持新建/编辑/删除/归档/从标签导入。
 */
export const ThemesPage = (): React.JSX.Element => {
  const toast = useToast()

  const [themes, setThemes] = useState<ThemeItem[]>([])
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [items, setItems] = useState<ThemeItemsItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)

  const [timeline, setTimeline] = useState<ThemeTimelineItem[]>([])

  // 创建/编辑弹窗状态
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ThemeItem | null>(null)
  const [editorName, setEditorName] = useState('')
  const [editorDesc, setEditorDesc] = useState('')
  const [editorSaving, setEditorSaving] = useState(false)

  // 标签导入弹窗状态
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importTagsText, setImportTagsText] = useState('')
  const [importLoading, setImportLoading] = useState(false)

  /** 加载主题列表 */
  const loadThemes = async (): Promise<void> => {
    setIsLoading(true)
    try {
      if (!window.api?.themes) {
        console.error('[ThemesPage] window.api.themes 不可用，请检查 preload 是否加载了 themes API')
        return
      }
      const list = await window.api.themes.list()
      console.log(`[ThemesPage] 加载到 ${list.length} 个主题`, list.map((t) => t.name))
      setThemes(list)
    } catch (err) {
      console.error('[ThemesPage] 加载主题失败:', err)
      toast.error('加载主题列表失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadThemes()
  }, [])

  /** 加载选中主题的关联素材 */
  useEffect(() => {
    if (!selectedThemeId || !window.api?.themes) return
    setItemsLoading(true)
    Promise.all([
      window.api.themes.listItems(selectedThemeId),
      window.api.themes.timeline(selectedThemeId)
    ])
      .then(([itemsResult, timelineResult]) => {
        setItems(itemsResult)
        setTimeline(timelineResult)
      })
      .catch(() => toast.error('加载主题详情失败'))
      .finally(() => setItemsLoading(false))
  }, [selectedThemeId])

  const selectedTheme = useMemo(
    () => themes.find((t) => t.externalId === selectedThemeId) ?? null,
    [themes, selectedThemeId]
  )

  const activeThemes = useMemo(() => themes.filter((t) => t.status === 'active'), [themes])
  const archivedThemes = useMemo(
    () => themes.filter((t) => t.status === 'archived'),
    [themes]
  )

  /** 新建主题 */
  const openCreateEditor = (): void => {
    setEditTarget(null)
    setEditorName('')
    setEditorDesc('')
    setIsEditorOpen(true)
  }

  /** 编辑主题 */
  const openEditEditor = (theme: ThemeItem): void => {
    setEditTarget(theme)
    setEditorName(theme.name)
    setEditorDesc(theme.description)
    setIsEditorOpen(true)
  }

  /** 保存主题（创建/更新） */
  const handleSaveTheme = async (): Promise<void> => {
    if (!editorName.trim()) {
      toast.error('主题名称不能为空')
      return
    }
    setEditorSaving(true)
    try {
      if (!window.api?.themes) return
      if (editTarget) {
        await window.api.themes.update(editTarget.externalId, {
          name: editorName.trim(),
          description: editorDesc.trim()
        })
        toast.success('主题已更新')
      } else {
        await window.api.themes.create({
          name: editorName.trim(),
          description: editorDesc.trim()
        })
        toast.success('主题已创建')
      }
      setIsEditorOpen(false)
      await loadThemes()
    } catch {
      toast.error('保存主题失败')
    } finally {
      setEditorSaving(false)
    }
  }

  /** 删除主题 */
  const handleDeleteTheme = async (theme: ThemeItem): Promise<void> => {
    if (!confirm(`确定删除主题「${theme.name}」及其所有关联？`)) return
    try {
      if (!window.api?.themes) return
      await window.api.themes.delete(theme.externalId)
      if (selectedThemeId === theme.externalId) setSelectedThemeId(null)
      toast.success(`已删除「${theme.name}」`)
      await loadThemes()
    } catch {
      toast.error('删除主题失败')
    }
  }

  /** 归档/恢复主题 */
  const handleToggleArchive = async (theme: ThemeItem): Promise<void> => {
    const newStatus = theme.status === 'active' ? 'archived' : 'active'
    try {
      if (!window.api?.themes) return
      await window.api.themes.update(theme.externalId, { status: newStatus })
      await loadThemes()
      toast.success(newStatus === 'archived' ? '已归档' : '已恢复')
    } catch {
      toast.error('操作失败')
    }
  }

  /** 从标签导入主题种子 */
  const openImportDialog = (): void => {
    setImportTagsText('')
    setIsImportOpen(true)
  }

  /** 执行标签导入 */
  const handleImportFromTags = async (): Promise<void> => {
    const existingNames = new Set(themes.map((t) => t.name))
    const tags = importTagsText
      .split(',')
      .map((s) => s.trim().replace(/^#/, ''))
      .filter(Boolean)
    const newTags = tags.filter((t) => !existingNames.has(t))
    if (!newTags.length) {
      toast.error('所有标签已作为主题存在')
      return
    }
    setImportLoading(true)
    try {
      if (!window.api?.themes) return
      const created = await window.api.themes.importFromTags(newTags)
      toast.success(`已导入 ${created.length} 个标签为主题`)
      setIsImportOpen(false)
      await loadThemes()
    } catch {
      toast.error('导入失败')
    } finally {
      setImportLoading(false)
    }
  }

  /** 解除关联 */
  const handleRemoveItem = async (item: ThemeItemsItem): Promise<void> => {
    if (!selectedThemeId || !window.api?.themes) return
    try {
      await window.api.themes.removeItem(selectedThemeId, item.sourceType, item.sourceId)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      toast.success('已解除关联')
      void window.api.themes.updateDescription(selectedThemeId)
    } catch {
      toast.error('操作失败')
    }
  }

  return (
    <div
      aria-label="Themes Page"
      className="w-full h-full bg-[#000000] overflow-y-auto custom-scrollbar py-4 px-1 lg:px-2 [scrollbar-gutter:stable] flex flex-col text-sm"
    >
      {/* 页面标题 */}
      <div className="flex-shrink-0 mb-4 flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-white/60" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
            主题策展
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            preset="add"
            iconOnly={false}
            size="small"
            onClick={openCreateEditor}
            className="text-white/45 hover:bg-white/[0.04] hover:text-white"
          >
            <span className="text-xs">新建主题</span>
          </IconButton>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* 左侧：主题列表 */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1">
          {isLoading ? (
            <div className="text-xs text-white/30 font-mono py-8 text-center">加载中...</div>
          ) : themes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Layers className="h-8 w-8 text-white/10" />
              <p className="text-xs text-white/30 font-mono">暂无主题</p>
              <p className="text-[11px] text-white/20 text-center max-w-[200px] leading-relaxed">
                创建你的第一个长期主题，或在 AI 对话中说「@curation 帮我分析主题」
              </p>
              <button
                className="mt-1 rounded-[6px] border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white hover:border-white/20 transition-colors"
                onClick={openImportDialog}
              >
                <Download className="h-3 w-3 inline mr-1" />
                从标签导入
              </button>
            </div>
          ) : (
            <>
              {/* 活跃主题 */}
              {activeThemes.map((theme) => (
                <button
                  key={theme.externalId}
                  onClick={() => setSelectedThemeId(theme.externalId)}
                  className={`text-left rounded-[6px] border p-3 transition-all duration-200 group ${
                    selectedThemeId === theme.externalId
                      ? 'border-white/15 bg-[#1a1a1a]'
                      : 'border-white/5 bg-[#212121] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white/85 truncate">
                      {theme.name}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconButton
                        preset="edit"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditEditor(theme)
                        }}
                      />
                      <IconButton
                        preset="delete"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteTheme(theme)
                        }}
                      />
                    </div>
                  </div>
                  {theme.description && (
                    <p className="text-xs text-white/40 mt-1 line-clamp-2">
                      {theme.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-white/25 font-mono">
                      {(theme.itemCount ?? 0)}项关联
                    </span>
                    <Tag size="small" color="default">
                      {theme.status}
                    </Tag>
                  </div>
                </button>
              ))}

              {/* 已归档主题 */}
              {archivedThemes.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Archive className="h-3 w-3 text-white/20" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white/20">
                      已归档
                    </span>
                  </div>
                  {archivedThemes.map((theme) => (
                    <button
                      key={theme.externalId}
                      onClick={() => setSelectedThemeId(theme.externalId)}
                      className={`w-full text-left rounded-[6px] border p-2.5 mb-1.5 transition-all ${
                        selectedThemeId === theme.externalId
                          ? 'border-white/10 bg-[#1a1a1a]'
                          : 'border-white/[0.03] bg-black/30 hover:border-white/8'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/50 truncate">{theme.name}</span>
                        <IconButton
                          preset="default"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleArchive(theme)
                          }}
                          title="恢复"
                        >
                          <RotateCcw className="h-2.5 w-2.5" />
                        </IconButton>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* 右侧：主题详情 */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {!selectedTheme ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Layers className="h-10 w-10 text-white/8 mx-auto" />
                <p className="mt-3 text-xs text-white/25 font-mono">
                  选择一个主题查看详情
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 基本信息卡片 */}
              <div className="bg-[#212121] rounded-[6px] border border-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white/90">
                      {selectedTheme.name}
                    </h2>
                    {selectedTheme.description && (
                      <p className="text-xs text-white/45 mt-1">
                        {selectedTheme.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      preset="edit"
                      size="small"
                      onClick={() => openEditEditor(selectedTheme)}
                    />
                    <IconButton
                      preset="default"
                      size="small"
                      onClick={() => handleToggleArchive(selectedTheme)}
                      title={selectedTheme.status === 'active' ? '归档' : '恢复'}
                    >
                      {selectedTheme.status === 'active' ? (
                        <Archive className="h-3.5 w-3.5" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                    </IconButton>
                    <IconButton
                      preset="delete"
                      size="small"
                      onClick={() => handleDeleteTheme(selectedTheme)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 text-[10px] text-white/25 font-mono">
                  <span>创建: {selectedTheme.createdAt}</span>
                  <span>更新: {selectedTheme.updatedAt}</span>
                  <span>{(selectedTheme.itemCount ?? 0)}项关联</span>
                </div>
              </div>

              {/* 关联素材列表 */}
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center gap-1.5 mb-3">
                  <FileText className="h-3.5 w-3.5 text-white/40" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
                    关联素材
                  </span>
                </div>

                {itemsLoading ? (
                  <div className="text-xs text-white/30 font-mono py-8 text-center">
                    加载中...
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-xs text-white/20 font-mono py-8 text-center bg-[#212121] rounded-[6px] border border-white/5">
                    尚未关联任何素材
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1">
                    {items.map((item) => (
                      <div
                        key={item.externalId}
                        className="bg-[#212121] rounded-[6px] border border-white/5 p-3 flex flex-col gap-1.5 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Tag size="small" color="default">
                              {SOURCE_LABELS[item.sourceType] ?? item.sourceType}
                            </Tag>
                            <span className="text-xs text-white/70 font-semibold truncate max-w-[400px]">
                              {item.sourceTitle ?? `${item.sourceType} #${item.sourceId}`}
                            </span>
                            {item.aiExtracted === 1 && (
                              <span className="text-[9px] text-white/20 font-mono bg-white/[0.03] px-1 py-0.5 rounded">
                                AI
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {item.sourceEntryDate && (
                              <span className="text-[10px] text-white/25 font-mono">
                                {item.sourceEntryDate}
                              </span>
                            )}
                            <IconButton
                              preset="close"
                              size="small"
                              onClick={() => handleRemoveItem(item)}
                              title="解除关联"
                            />
                          </div>
                        </div>
                        {item.relevanceNote && (
                          <p className="text-[11px] text-white/35 leading-relaxed">
                            {item.relevanceNote}
                          </p>
                        )}
                        {item.sourceContent && (
                          <p className="text-[11px] text-white/25 line-clamp-2 leading-relaxed bg-black/30 p-2 rounded-[4px]">
                            {item.sourceContent.slice(0, 200)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 时间线（简化版） */}
              {timeline.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="h-3.5 w-3.5 text-white/40" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-white/40">
                      时间线
                    </span>
                  </div>
                  <div className="flex items-end gap-1 h-16 bg-[#212121] rounded-[6px] border border-white/5 p-2">
                    {timeline.map((point) => (
                      <div
                        key={point.weekStartDate}
                        className="flex-1 flex flex-col items-center justify-end gap-1"
                        title={`${point.weekStartDate}: ${point.itemCount}项${point.mentionedInSummary ? ' (总结提及)' : ''}`}
                      >
                        <div
                          className="w-full rounded-t-[2px] transition-all"
                          style={{
                            height: `${Math.min(point.itemCount * 8, 40)}px`,
                            backgroundColor: point.mentionedInSummary
                              ? 'rgba(255,255,255,0.35)'
                              : 'rgba(255,255,255,0.08)'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 创建/编辑主题弹窗 */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#212121] rounded-[6px] border border-white/10 p-5 w-[400px] max-w-[90vw] shadow-2xl">
            <h3 className="text-sm font-bold text-white/90 mb-4">
              {editTarget ? '编辑主题' : '新建主题'}
            </h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/30 mb-1 block">
                  名称
                </label>
                <input
                  className="w-full bg-black/40 border border-white/10 rounded-[6px] px-3 py-2 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-white/20"
                  placeholder="如：职业转型、亲密关系"
                  value={editorName}
                  onChange={(e) => setEditorName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/30 mb-1 block">
                  描述
                </label>
                <textarea
                  className="w-full bg-black/40 border border-white/10 rounded-[6px] px-3 py-2 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-white/20 resize-none h-20"
                  placeholder="为什么追踪这个主题？"
                  value={editorDesc}
                  onChange={(e) => setEditorDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="rounded-[6px] border border-white/10 px-4 py-1.5 text-xs text-white/50 hover:text-white hover:border-white/20 transition-colors"
                onClick={() => setIsEditorOpen(false)}
              >
                取消
              </button>
              <button
                className="rounded-[6px] bg-white text-black px-4 py-1.5 text-xs font-semibold hover:bg-white/90 transition-colors disabled:opacity-40"
                onClick={handleSaveTheme}
                disabled={editorSaving || !editorName.trim()}
              >
                {editorSaving ? '保存中...' : editTarget ? '更新' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 从标签导入弹窗 */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#212121] rounded-[6px] border border-white/10 p-5 w-[400px] max-w-[90vw] shadow-2xl">
            <h3 className="text-sm font-bold text-white/90 mb-4">从标签导入主题</h3>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-white/30 mb-1 block">
                标签（逗号分隔）
              </label>
              <input
                className="w-full bg-black/40 border border-white/10 rounded-[6px] px-3 py-2 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-white/20"
                placeholder="如：职业转型, 亲密关系, 健康"
                value={importTagsText}
                onChange={(e) => setImportTagsText(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleImportFromTags()
                }}
              />
              <p className="text-[10px] text-white/20 mt-1.5 leading-relaxed">
                输入以逗号分隔的标签名，已存在的主题将被跳过。
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="rounded-[6px] border border-white/10 px-4 py-1.5 text-xs text-white/50 hover:text-white hover:border-white/20 transition-colors"
                onClick={() => setIsImportOpen(false)}
              >
                取消
              </button>
              <button
                className="rounded-[6px] bg-white text-black px-4 py-1.5 text-xs font-semibold hover:bg-white/90 transition-colors disabled:opacity-40"
                onClick={handleImportFromTags}
                disabled={importLoading || !importTagsText.trim()}
              >
                {importLoading ? '导入中...' : '导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
