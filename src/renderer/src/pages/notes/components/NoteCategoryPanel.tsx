import { useState, useRef } from "react"
import { Folder, Edit3, X } from "lucide-react"
import { Tag } from "@/components/ui/Tag"
import { IconButton } from "@/components/ui/IconButton"
import { Tooltip } from "@/components/ui/Tooltip"
import { Input } from "@/components/ui/Input"

/** 分类项类型。 */
export interface NoteCategory {
  id: number
  name: string
  sortOrder: number
}

/** 分类面板 props。 */
interface NoteCategoryPanelProps {
  categories: NoteCategory[]
  activeCategoryId: number | null
  onSelectCategory: (id: number | null) => void
  onCreate: (name: string) => Promise<void>
  onUpdate: (id: number, name: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

export const NoteCategoryPanel = ({
  categories,
  activeCategoryId,
  onSelectCategory,
  onCreate,
  onUpdate,
  onDelete
}: NoteCategoryPanelProps): React.JSX.Element => {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const [newCategoryName, setNewCategoryName] = useState("")
  const newInputRef = useRef<HTMLInputElement>(null)

  const handleCreateConfirm = async () => {
    const trimmed = newCategoryName.trim()
    if (!trimmed) return

    await onCreate(trimmed)
    setNewCategoryName("")
  }

  const handleCreateCancel = () => {
    setNewCategoryName("")
  }

  return (
    <aside className="flex min-h-0 w-[30vw] flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white/80">分类管理</p>
        <Tooltip
          trigger="click"
          placement="bottom"
          title="新建分类"
          form={
            <div className="flex flex-col gap-2">
              <Input
                ref={newInputRef as React.Ref<HTMLInputElement>}
                size="xs"
                bgClass="bg-black/30"
                placeholder="输入分类名称"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                autoFocus
                className="placeholder:text-white/30"
              />
            </div>
          }
          onConfirm={handleCreateConfirm}
          onCancel={handleCreateCancel}
        >
          <IconButton preset="add" title="新建分类" size="small" />
        </Tooltip>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Tag
          size="default"
          prefix={<Folder className="h-3 w-3" />}
          highlighted={activeCategoryId === null}
          onClick={() => onSelectCategory(null)}
          className="font-medium cursor-pointer"
        >
          全部笔记
        </Tag>
        {categories.map((cat) => (
          <Tag
            key={cat.id}
            size="default"
            prefix={<Folder className="h-3 w-3" />}
            highlighted={activeCategoryId === cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className="font-medium cursor-pointer"
          >
            {cat.name}
            <span className="ml-2 inline-flex items-center justify-center gap-1">
              <Tooltip
                trigger="click"
                placement="bottom"
                title="编辑分类"
                form={
                  <div className="flex flex-col gap-2">
                    <Input
                      size="xs"
                      bgClass="bg-black/30"
                      placeholder="输入分类名称"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                      className="placeholder:text-white/30"
                    />
                  </div>
                }
                onConfirm={() => {
                  const trimmed = editValue.trim()
                  if (trimmed && editingId !== null) {
                    void onUpdate(editingId, trimmed)
                    setEditingId(null)
                    setEditValue("")
                  }
                }}
                onCancel={() => {
                  setEditingId(null)
                  setEditValue("")
                }}
              >
                <span
                  role="button"
                  aria-label="编辑分类"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingId(cat.id)
                    setEditValue(cat.name)
                  }}
                  className="opacity-60 hover:opacity-100 cursor-pointer text-current hover:text-amber-300 transition-all flex items-center justify-center p-0.5"
                >
                  <Edit3 className="h-2.5 w-2.5" />
                </span>
              </Tooltip>

              <Tooltip
                title="确认删除该分类？"
                description="删除后，关联笔记的分类将被清空。"
                onConfirm={() => void onDelete(cat.id)}
                variant="danger"
              >
                <span
                  role="button"
                  aria-label="删除分类"
                  className="opacity-60 hover:opacity-100 cursor-pointer text-current hover:text-rose-400 transition-all flex items-center justify-center p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </span>
              </Tooltip>
            </span>
          </Tag>
        ))}
      </div>
    </aside>
  )
}
