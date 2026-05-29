import type React from "react";
import { useRef, useState } from "react";
import { Plus, Save, Upload, X } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";
import { Select, type SelectOption } from "@renderer/components/ui/Select";
import { MarkdownEditor } from "@renderer/components/ui/MarkdownEditor";
import { Tag } from "@renderer/components/ui/Tag";
import { useToast } from "@renderer/components/ui/Toast";
import type {
  FormState,
  PeoplePageMode,
  PersonProfile,
} from "@renderer/pages/components/peopleShared";

// 人物表单组件属性。
type PeopleProfileFormProps = {
  // 当前表单模式。
  mode: Exclude<PeoplePageMode, "view">;
  // 表单数据。
  formState: FormState;
  // 设置表单数据。
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
  // 取消编辑。
  onCancel: () => void;
  // 保存表单。
  onSave: () => Promise<void>;
};

// 关系分类下拉选项。
const RELATIONSHIP_OPTIONS: SelectOption<PersonProfile["relationship"]>[] = [
  { value: "女朋友", label: "女朋友 (Girlfriend) ❤️" },
  { value: "家人", label: "家人 (Family)" },
  { value: "朋友", label: "朋友 (Friend)" },
  { value: "同事", label: "同事 (Colleague)" },
  { value: "其他", label: "其他 (Other)" },
];

// 性别下拉选项。
const GENDER_OPTIONS: SelectOption<string>[] = [
  { value: "女", label: "女 (Female)" },
  { value: "男", label: "男 (Male)" },
  { value: "保密", label: "保密 / 其他" },
];

/**
 * People 页面专用人物档案表单。
 */
export const PeopleProfileForm = ({
  mode,
  formState,
  setFormState,
  onCancel,
  onSave,
}: PeopleProfileFormProps): React.JSX.Element => {
  // 特征标签输入暂存。
  const [tagInput, setTagInput] = useState("");
  // 拖拽上传头像激活状态。
  const [isDragging, setIsDragging] = useState(false);
  // 文件上传 DOM 引用。
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // 消息提示实例。
  const toast = useToast();

  /**
   * 处理文件选择与头像二进制落盘逻辑。
   */
  const handleFileProcess = async (file: File): Promise<void> => {
    if (!file.type.startsWith("image/")) {
      toast.error("仅支持图片文件格式");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setFormState((prev) => ({ ...prev, avatar: dataUrl }));
    };
    reader.readAsDataURL(file);

    if (window.api?.files?.savePeopleAvatar) {
      try {
        const buffer = await file.arrayBuffer();
        const result = await window.api.files.savePeopleAvatar({
          name: file.name,
          mimeType: file.type,
          bytes: buffer,
        });
        if (result.url) {
          setFormState((prev) => ({ ...prev, avatar: result.url }));
          toast.success("头像已保存到本地 .mc 存储");
        }
      } catch (err) {
        console.error("保存头像物理文件失败, 降级使用 base64 预览", err);
      }
    }
  };

  /**
   * 点击头像框触发本地上传。
   */
  const triggerFileSelect = (): void => {
    fileInputRef.current?.click();
  };

  /**
   * 文件改变监听。
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      void handleFileProcess(file);
    }
  };

  /**
   * 头像拖拽事件处理。
   */
  const handleDragOver = (event: React.DragEvent): void => {
    event.preventDefault();
    setIsDragging(true);
  };

  /**
   * 头像拖拽离开处理。
   */
  const handleDragLeave = (): void => {
    setIsDragging(false);
  };

  /**
   * 头像拖拽落入处理。
   */
  const handleDrop = (event: React.DragEvent): void => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFileProcess(file);
    }
  };

  /**
   * 移除头像。
   */
  const handleRemoveAvatar = (event: React.MouseEvent): void => {
    event.stopPropagation();
    setFormState((prev) => ({ ...prev, avatar: "" }));
  };

  /**
   * 处理标签输入确认。
   */
  const handleAddTag = (): void => {
    const trimmed = tagInput.trim();
    if (!trimmed) {
      return;
    }

    if (formState.tags.includes(trimmed)) {
      toast.warning("该标签已存在");
      return;
    }

    setFormState((prev) => ({ ...prev, tags: [...prev.tags, trimmed] }));
    setTagInput("");
  };

  /**
   * 删除表单中的某个特征标签。
   */
  const handleRemoveFormTag = (targetTag: string): void => {
    setFormState((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== targetTag),
    }));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 animate-card-modal-in">
      <div className="p-4 border-b border-white/5 bg-black/20 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-white/60" />
          <span className="text-sm font-bold text-white/80">
            {mode === "create"
              ? "录入新人物关系档案"
              : `编辑 ${formState.name || "人物"} 档案`}
          </span>
        </div>
        <IconButton aria-label="取消编辑" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-[100px_1fr] gap-5 items-start">
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">
              Avatar / 头像
            </span>
            <div
              role="button"
              aria-label="点击或拖拽上传新头像"
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
                  <img
                    src={formState.avatar}
                    alt="预览"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] text-white/90">
                    更换头像
                  </div>
                  <button
                    type="button"
                    className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/80 hover:bg-black text-white/60 hover:text-white flex items-center justify-center text-[8px] border border-white/10 outline-none"
                    onClick={handleRemoveAvatar}
                    title="删除头像"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-2">
                  <Upload className="h-4 w-4 text-white/30" />
                  <span className="text-[9px] text-white/30 mt-1 leading-tight">
                    点击/拖拽
                  </span>
                </div>
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
              <label
                htmlFor="form-name"
                className="text-[11px] font-bold text-white/45"
              >
                姓名 *
              </label>
              <input
                id="form-name"
                type="text"
                placeholder="输入姓名..."
                className="w-full rounded-[6px] border border-white/10 bg-black/35 px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 outline-none transition-colors duration-150 focus:border-white/20"
                value={formState.name}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="form-relation"
                className="text-[11px] font-bold text-white/45"
              >
                核心关系 *
              </label>
              <Select
                id="form-relation"
                value={formState.relationship}
                options={RELATIONSHIP_OPTIONS}
                align="left"
                onChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    relationship: value,
                  }))
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="form-gender"
                className="text-[11px] font-bold text-white/45"
              >
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
              <label
                htmlFor="form-birthday"
                className="text-[11px] font-bold text-white/45"
              >
                生日 / 纪念日
              </label>
              <input
                id="form-birthday"
                type="text"
                placeholder="例: 12月14日 或 1998-12-14"
                className="w-full rounded-[6px] border border-white/10 bg-black/35 px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 outline-none transition-colors duration-150 focus:border-white/20"
                value={formState.birthday}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    birthday: event.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="form-status"
              className="text-[11px] font-bold text-white/45"
            >
              一句话特征/描述状态
            </label>
            <input
              id="form-status"
              type="text"
              placeholder="例: 温柔可爱，善解人意"
              className="w-full rounded-[6px] border border-white/10 bg-black/35 px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 outline-none transition-colors duration-150 focus:border-white/20"
              value={formState.status}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, status: event.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="form-contact"
              className="text-[11px] font-bold text-white/45"
            >
              联络机制 (微信/电话/地址)
            </label>
            <input
              id="form-contact"
              type="text"
              placeholder="例: WeChat: tolin_love"
              className="w-full rounded-[6px] border border-white/10 bg-black/35 px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 outline-none transition-colors duration-150 focus:border-white/20"
              value={formState.contact}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, contact: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-white/5 pt-4">
          <span className="text-[11px] font-bold text-white/45">
            行为特征与倾向标签 (输入并回车确定)
          </span>
          <div className="rounded-[6px] border border-white/10 bg-black/40 p-2">
            <div className="mb-1.5 flex flex-wrap gap-1">
              {formState.tags.map((tag) => (
                <Tag key={tag} prefix="#" onClose={() => handleRemoveFormTag(tag)}>
                  {tag}
                </Tag>
              ))}
            </div>
            <input
              type="text"
              className="w-full rounded-[4px] border border-white/5 bg-black px-2 py-1 text-xs text-white placeholder:text-white/25 outline-none transition-colors duration-150 focus:border-white/15"
              placeholder={
                formState.tags.length >= 8
                  ? "已达标签数量限制"
                  : "输入标签后，按回车或点加号进行确认..."
              }
              disabled={formState.tags.length >= 8}
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddTag();
                }
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-white/5 pt-4">
          <span className="text-[11px] font-bold text-white/45">
            Dossier / 详细背景备注档案 (Markdown 编辑器)
          </span>
          <div className="p-1 rounded-[6px] border border-white/8 bg-black/15">
            <MarkdownEditor
              id="people-dossier-editor"
              height={500}
              placeholder="写下详细的性格喜好、关键习惯、约会备忘录、纪念日以及你们重要的共同记忆..."
              value={formState.details}
              onChange={(value) =>
                setFormState((prev) => ({ ...prev, details: value }))
              }
            />
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-white/5 bg-black/30 flex items-center justify-end gap-3.5 flex-shrink-0">
        <button
          type="button"
          className="rounded-[6px] border border-white/10 bg-black px-3.5 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors duration-150 cursor-pointer font-medium"
          onClick={onCancel}
        >
          取消
        </button>
        <IconButton
          iconOnly={false}
          highlighted
          className="px-4 py-1.5 text-xs font-bold gap-1.5"
          disabled={!formState.name.trim()}
          onClick={onSave}
        >
          <Save className="h-3.5 w-3.5" />
          <span>保存档案</span>
        </IconButton>
      </div>
    </div>
  );
};
