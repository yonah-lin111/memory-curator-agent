import { Upload, X } from "lucide-react"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { IconButton } from "@/components/ui/IconButton"
import { Input } from "@/components/ui/Input"
import { MarkdownEditor } from "@/components/ui/MarkdownEditor"
import { Select, type SelectOption } from "@/components/ui/Select"
import { useToast } from "@/components/ui/Toast"
import { useHeaderStore } from "@/lib/headerStore"
import type { FormState, PersonalInfoPageMode } from "./personalInfoShared"

type PersonalInfoFormProps = {
  mode: Exclude<PersonalInfoPageMode, "view">
  formState: FormState
  setFormState: React.Dispatch<React.SetStateAction<FormState>>
  onCancel: () => void
  onSave: (override?: Partial<FormState>) => Promise<void>
}

const GENDER_OPTIONS: SelectOption<string>[] = [
  { value: "女", label: "女 (Female)" },
  { value: "男", label: "男 (Male)" },
  { value: "保密", label: "保密 / 其他" },
]

export const PersonalInfoForm = ({
  mode,
  formState,
  setFormState,
  onCancel,
  onSave,
}: PersonalInfoFormProps): React.JSX.Element => {
  const [isDragging, setIsDragging] = useState(false)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const toast = useToast()
  const { setCustomTitle, setExtraActions, setHideChatButton, resetHeader } = useHeaderStore()

  const handleSaveWrapper = async () => {
    let override: Partial<FormState> = {}
    if (pendingAvatarFile && window.api?.files?.savePersonalAvatar) {
      try {
        const buffer = await pendingAvatarFile.arrayBuffer()
        const result = await window.api.files.savePersonalAvatar({
          name: pendingAvatarFile.name,
          mimeType: pendingAvatarFile.type,
          bytes: buffer,
        })
        if (result.url) {
          override.avatar = result.url
          toast.success("头像已保存")
        }
      } catch (err) {
        console.error("保存头像物理文件失败", err)
        toast.error("保存头像物理文件失败")
      }
    }
    await onSave(override)
  }

  useEffect(() => {
    setCustomTitle("编辑个人信息")
    setHideChatButton(true)

    setExtraActions(
      <>
        <IconButton
          disabled={!formState.name.trim()}
          preset="save"
          onClick={handleSaveWrapper}
          title="保存信息"
          aria-label="Save"
        />
        <IconButton preset="close" onClick={onCancel} title="取消编辑" aria-label="Cancel" />
      </>,
    )

    return () => {
      resetHeader()
    }
  }, [
    mode,
    formState.name,
    onCancel,
    onSave,
    setCustomTitle,
    setExtraActions,
    setHideChatButton,
    resetHeader,
    pendingAvatarFile,
  ])

  const handleFileProcess = (file: File): void => {
    if (!file.type.startsWith("image/")) {
      toast.error("仅支持图片文件格式")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setFormState((prev) => ({ ...prev, avatar: dataUrl }))
      setPendingAvatarFile(file)
    }
    reader.readAsDataURL(file)
  }

  const triggerFileSelect = (): void => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (file) {
      void handleFileProcess(file)
    }
  }

  const handleDragOver = (event: React.DragEvent): void => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (): void => {
    setIsDragging(false)
  }

  const handleDrop = (event: React.DragEvent): void => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      void handleFileProcess(file)
    }
  }

  const handleRemoveAvatar = (event: React.MouseEvent): void => {
    event.stopPropagation()
    setFormState((prev) => ({ ...prev, avatar: "" }))
    setPendingAvatarFile(null)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 animate-card-modal-in">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-[100px_1fr] gap-4 items-start">
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">
              Avatar / 头像
            </span>
            <div className="relative group/avatar">
              <div
                role="button"
                aria-label="Click or drag and drop to upload new avatar"
                className={`relative w-20 h-20 rounded-[6px] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${
                  isDragging
                    ? "border-pink-500 bg-pink-500/5"
                    : "border-white/10 hover:border-white/20 bg-black/40"
                }`}
                onClick={triggerFileSelect}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {formState.avatar ? (
                  <>
                    <img src={formState.avatar} alt="预览" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] text-white/90">
                      更换头像
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-2">
                    <Upload className="h-4 w-4 text-white/30" />
                    <span className="text-[9px] text-white/30 mt-1 leading-tight">点击/拖拽</span>
                  </div>
                )}
              </div>
              {formState.avatar && (
                <button
                  type="button"
                  aria-label="Delete avatar"
                  className="absolute -top-1.5 -right-1.5 z-10 hidden group-hover/avatar:flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#1C1C1C] shadow-md hover:bg-gray-200 transition-colors"
                  onClick={handleRemoveAvatar}
                  title="删除头像"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1 w-full">
            <div className="flex flex-col gap-1">
              <label htmlFor="form-name" className="text-[11px] font-bold text-white/45">
                姓名 *
              </label>
              <Input
                id="form-name"
                type="text"
                size="xs"
                placeholder="输入姓名..."
                value={formState.name}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="form-gender" className="text-[11px] font-bold text-white/45">
                性别
              </label>
              <Select
                id="form-gender"
                value={formState.gender}
                options={GENDER_OPTIONS}
                align="left"
                onChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    gender: value,
                  }))
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="form-birthday" className="text-[11px] font-bold text-white/45">
                生日 / 纪念日
              </label>
              <Input
                id="form-birthday"
                type="text"
                size="xs"
                placeholder="例: 12月14日 或 1998-12-14"
                value={formState.birthday}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    birthday: event.target.value,
                  }))
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="form-contact" className="text-[11px] font-bold text-white/45">
                联系方式
              </label>
              <Input
                id="form-contact"
                type="text"
                size="xs"
                placeholder="电话、邮箱等"
                value={formState.contact}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    contact: event.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5">
          <div className="flex flex-col gap-1">
            <label htmlFor="form-status" className="text-[11px] font-bold text-white/45">
              一句话签名/状态
            </label>
            <Input
              id="form-status"
              type="text"
              size="xs"
              placeholder="在这里输入一句话描述"
              value={formState.status}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  status: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-white/5 pt-4">
          <span className="text-[11px] font-bold text-white/45">特征标签 (输入并回车确定)</span>
          <Input
            as="tags"
            tags={formState.tags}
            onChangeTags={(tags) => setFormState((prev) => ({ ...prev, tags }))}
            maxTags={10}
            size="xs"
            aria-label="Input new tag"
          />
        </div>

        <div className="flex flex-col gap-1.5 border-t border-white/5 pt-4">
          <span className="text-[11px] font-bold text-white/45">详细档案 / 备注 (Markdown)</span>
          <div className="p-1 rounded-[6px] border border-white/8 bg-black/15">
            <MarkdownEditor
              id="personal-info-editor"
              height={400}
              placeholder="写下关于自己的详细记录..."
              value={formState.details}
              onChange={(value) => setFormState((prev) => ({ ...prev, details: value }))}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
