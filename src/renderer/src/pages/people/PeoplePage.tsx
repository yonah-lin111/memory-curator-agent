import {
  Calendar,
  ChevronRight,
  Clock,
  Heart,
  Info,
  Phone,
  Search,
  Sparkles,
  Tag as TagIcon,
  User,
  UserCheck,
} from "lucide-react"
import { MdPreview } from "md-editor-rt"
import type React from "react"
import { IconButton } from "@/components/ui/IconButton"
import { Input } from "@/components/ui/Input"
import { Tag } from "@/components/ui/Tag"
import { Tooltip } from "@/components/ui/Tooltip"
import { PeopleProfileForm } from "@/pages/people/components/PeopleProfileForm"
import { type RelationshipFilter } from "@/pages/people/components/peopleShared"
import { usePeopleProfiles } from "@/pages/people/components/usePeopleProfiles"
import "md-editor-rt/lib/preview.css"

/**
 * 根据标签文本内容生成一致的预设颜色
 * @param tag 标签文本
 * @returns 预设颜色类型
 */
const getTagColor = (
  tag: string,
):
  | "pink"
  | "amber"
  | "blue"
  | "teal"
  | "emerald"
  | "rose"
  | "purple"
  | "indigo"
  | "sky"
  | "orange" => {
  const colors: Array<
    "pink" | "amber" | "blue" | "teal" | "emerald" | "rose" | "purple" | "indigo" | "sky" | "orange"
  > = ["pink", "amber", "blue", "teal", "emerald", "rose", "purple", "indigo", "sky", "orange"]
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colors.length
  return colors[index]
}

/**
 * 获取关系类型的预设颜色类型
 * @param relationship 关系文本
 * @returns 预设颜色类型
 */
const getRelationshipTagColor = (
  relationship: string,
): "pink" | "amber" | "blue" | "teal" | "default" => {
  switch (relationship) {
    case "女朋友":
      return "pink"
    case "家人":
      return "amber"
    case "朋友":
      return "blue"
    case "同事":
      return "teal"
    default:
      return "default"
  }
}

/**
 * PeoplePage 组件 - 个人关系链与人际档案管理
 */
export const PeoplePage = (): React.JSX.Element => {
  const {
    selectedId,
    setSelectedId,
    searchQuery,
    setSearchQuery,
    relationFilter,
    setRelationFilter,
    selectedTag,
    setSelectedTag,
    mode,
    setMode,
    formState,
    setFormState,
    currentPerson,
    tagStats,
    filteredPeople,
    enterEditMode,
    enterCreateMode,
    handleSaveForm,
    handleDeletePerson,
  } = usePeopleProfiles()

  return (
    <section aria-label="People Page" className="flex h-full min-h-0 flex-col gap-3 text-white">
      {/* 顶层主网格：双栏布局 */}
      <div
        className={`grid min-h-0 flex-1 gap-3 ${mode === "view" ? "lg:grid-cols-[minmax(0,340px)_1fr]" : "grid-cols-1"}`}
      >
        {/* ==========================================
         * 左侧面板：人物关系检索与切片
         * ========================================== */}
        {mode === "view" && (
          <div className="min-h-0 flex flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
            {/* 1. 顶栏检索与创建入口 */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-white/60" />
                <span className="text-sm font-bold text-white/80">人物档案库</span>
              </div>
              <IconButton aria-label="Add person profile" preset="add" onClick={enterCreateMode} />
            </div>

            {/* 2. 搜索框 */}
            <Input
              type="text"
              size="xs"
              className="flex-shrink-0"
              placeholder="搜索姓名、特征、联系方式..."
              prefix={<Search className="h-3.5 w-3.5 text-white/30" />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* 3. 关系分类滑块切片 */}
            <div className="flex-shrink-0">
              <div className="flex flex-wrap gap-1 bg-black/35 p-1 rounded-[6px] border border-white/5">
                {(["全部", "女朋友", "家人", "朋友", "同事", "其他"] as RelationshipFilter[]).map(
                  (filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={`flex-1 text-center py-1 text-[10px] font-semibold rounded-[4px] transition-all duration-150 ${
                        relationFilter === filter
                          ? "bg-white text-black"
                          : "text-white/40 hover:bg-white/5 hover:text-white/70"
                      }`}
                      onClick={() => {
                        setRelationFilter(filter)
                        setSelectedTag(null) // 切换类型时清除标签筛选，防止复合筛选无数据
                      }}
                    >
                      {filter}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* 4. 标签特征切片 */}
            {tagStats.length > 0 && (
              <div className="flex-shrink-0 border-t border-b border-white/5 py-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/28 block mb-1.5">
                  Feature Tag Map
                </span>
                <div className="flex flex-wrap gap-1 max-h-[76px] overflow-y-auto custom-scrollbar">
                  <Tag
                    size="small"
                    highlighted={selectedTag === null}
                    onClick={() => setSelectedTag(null)}
                  >
                    全部
                  </Tag>
                  {tagStats.map((tag) => (
                    <Tag
                      key={tag.name}
                      size="default"
                      prefix="#"
                      highlighted={selectedTag === tag.name}
                      onClick={() => setSelectedTag(tag.name)}
                    >
                      {tag.name} · {tag.count}
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            {/* 5. 过滤后的人物列表 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5">
              {filteredPeople.length === 0 ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[6px] border border-dashed border-white/5 bg-black/10 p-5 text-center">
                  <User className="h-6 w-6 text-white/20" />
                  <span className="mt-2 text-xs font-semibold text-white/60">暂无匹配的人物</span>
                  <span className="mt-1 text-[11px] text-white/30">
                    调整分类或点击右上角新增档案
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {filteredPeople.map((person) => {
                    const isActive = person.id === selectedId
                    const hasCustomAvatar = Boolean(person.avatar)

                    return (
                      <button
                        key={person.id}
                        type="button"
                        className={`w-full text-left flex items-center gap-3 p-2.5 rounded-[6px] transition-all duration-150 group ${
                          isActive ? "bg-white/5 text-white" : "hover:bg-white/[0.02] text-white/70"
                        }`}
                        onClick={() => {
                          setSelectedId(person.id)
                        }}
                      >
                        {/* 头像 */}
                        <div className="relative flex-shrink-0">
                          {hasCustomAvatar ? (
                            <img
                              src={person.avatar}
                              alt={person.name}
                              className="w-9 h-9 object-cover rounded-[6px] border border-white/10"
                              onError={(e) => {
                                // 头像资源路径失效时的降级占位图
                                ;(e.target as HTMLImageElement).style.display = "none"
                              }}
                            />
                          ) : (
                            <div className="w-9 h-9 bg-white/5 border border-white/10 rounded-[6px] flex items-center justify-center text-xs font-bold text-white/60">
                              {person.name.substring(0, 1).toUpperCase()}
                            </div>
                          )}
                          {person.relationship === "女朋友" && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-pink-500 text-[8px] text-white">
                              ❤️
                            </span>
                          )}
                        </div>

                        {/* 核心描述 */}
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold truncate text-white/90 group-hover:text-white">
                              {person.name}
                            </span>
                            <Tag
                              size="default"
                              color={getRelationshipTagColor(person.relationship)}
                              className="font-bold leading-none scale-[0.9] origin-right"
                            >
                              {person.relationship}
                            </Tag>
                          </div>
                          <span className="text-[11px] text-white/40 truncate group-hover:text-white/65">
                            {person.status || "暂无一句话描述"}
                          </span>
                        </div>

                        {/* 箭头装饰 */}
                        <ChevronRight className="h-3 w-3 text-white/20 group-hover:text-white/55 flex-shrink-0" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
         * 右侧面板：主展示区 / 编辑区
         * ========================================== */}
        <div className="min-h-0 flex flex-col rounded-[6px] border border-white/6 bg-[#212121] overflow-hidden">
          {/* A. 详情展示模式 */}
          {mode === "view" && (
            <div className="flex-1 flex flex-col min-h-0">
              {currentPerson ? (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* 1. 详情顶部 Banner 卡片 */}
                  <div className="p-5 border-b border-white/5 bg-black/20 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-4">
                      {/* 头像 */}
                      <div className="relative flex-shrink-0">
                        {currentPerson.avatar ? (
                          <img
                            src={currentPerson.avatar}
                            alt={currentPerson.name}
                            className="w-16 h-16 object-cover rounded-[6px] border-2 border-white/10 shadow-lg"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-white/5 border-2 border-white/10 rounded-[6px] flex items-center justify-center text-xl font-bold text-white/50">
                            {currentPerson.name.substring(0, 1).toUpperCase()}
                          </div>
                        )}
                        {currentPerson.relationship === "女朋友" && (
                          <div className="absolute -bottom-1 -right-1 rounded-full bg-pink-500 p-1 shadow">
                            <Heart className="h-3 w-3 text-white fill-white" />
                          </div>
                        )}
                      </div>

                      {/* 姓名与状态 */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base font-bold text-white leading-none">
                            {currentPerson.name}
                          </h2>
                          <span className="text-xs text-white/30">({currentPerson.gender})</span>
                          <Tag
                            size="default"
                            color={getRelationshipTagColor(currentPerson.relationship)}
                            className="font-bold"
                          >
                            {currentPerson.relationship}
                          </Tag>
                        </div>
                        <p className="text-xs text-white/60 font-medium leading-relaxed mt-0.5 flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
                          <span>{currentPerson.status || "暂无描述"}</span>
                        </p>
                      </div>
                    </div>

                    {/* 操作按钮组 */}
                    <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                      <IconButton preset="edit" onClick={enterEditMode} title="编辑档案" />

                      <Tooltip
                        title="确认要删除该档案吗？"
                        description={`删除后，将永久擦除 ${currentPerson.name} 的所有特征标签、联系方式及详细备注，此操作无法撤销。`}
                        onConfirm={() => handleDeletePerson(currentPerson.id, currentPerson.name)}
                        variant="danger"
                      >
                        <IconButton preset="delete" title="删除档案" />
                      </Tooltip>
                    </div>
                  </div>

                  {/* 2. 详情主体区域 */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-6">
                    {/* 特征标签 */}
                    {currentPerson.tags.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1 text-[11px] font-mono text-white/28 tracking-wider uppercase">
                          <TagIcon className="h-3 w-3" />
                          <span>Feature Tags / 行为特征与倾向</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {currentPerson.tags.map((tag) => (
                            <Tag key={tag} size="default" color={getTagColor(tag)}>
                              {tag}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 基本信息表格卡片 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="rounded-[6px] border border-white/5 bg-black/20 p-3 flex items-center gap-3">
                        <div className="p-2 rounded-[6px] bg-white/[0.03] text-white/50 border border-white/5 flex-shrink-0">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">
                            Birthday / 纪念生日
                          </span>
                          <span className="text-xs text-white/80 font-bold mt-0.5">
                            {currentPerson.birthday || "未填写"}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-[6px] border border-white/5 bg-black/20 p-3 flex items-center gap-3">
                        <div className="p-2 rounded-[6px] bg-white/[0.03] text-white/50 border border-white/5 flex-shrink-0">
                          <Phone className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">
                            Contact / 联系方式
                          </span>
                          <span className="text-xs text-white/80 font-bold mt-0.5">
                            {currentPerson.contact || "未填写"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 详细备注背景档案（Markdown） */}
                    <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/28 tracking-wider uppercase">
                          <Info className="h-3 w-3" />
                          <span>Detailed Dossier / 详细背景档案与备注</span>
                        </div>
                        <div className="flex items-center gap-3.5 text-[10px] font-mono text-white/25">
                          <span className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            更新: {currentPerson.updatedAt}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-[6px] border border-white/5 bg-black/15 p-4 min-h-[300px]">
                        {currentPerson.details ? (
                          <div className="markdown-preview-container select-text">
                            <MdPreview
                              theme="dark"
                              modelValue={currentPerson.details}
                              previewTheme="default"
                              codeTheme="atom"
                              style={{ backgroundColor: "transparent" }}
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <span className="text-xs text-white/30">
                              暂无详细背景备注资料，点击编辑补全。
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black/5">
                  <User className="h-10 w-10 text-white/20 animate-pulse" />
                  <h3 className="mt-4 text-sm font-bold text-white/80">人际关系策展池</h3>
                  <p className="mt-1.5 max-w-[360px] text-xs leading-relaxed text-white/40">
                    这里存放你最重要的亲友、爱人或合作伙伴档案，你可以点击左上角的加号新增一名重要人物进行深度建档。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* B. 表单编辑模式 */}
          {(mode === "edit" || mode === "create") && (
            <PeopleProfileForm
              mode={mode}
              formState={formState}
              setFormState={setFormState}
              onCancel={() => setMode("view")}
              onSave={handleSaveForm}
            />
          )}
        </div>
      </div>
    </section>
  )
}
