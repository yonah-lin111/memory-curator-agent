import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Select, type SelectOption } from "@/components/ui/Select";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useHeaderStore } from "@/lib/headerStore";
import type {
  FormState,
  PeoplePageMode,
  PersonProfile,
} from "@/pages/people/components/peopleShared";

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
  // 拖拽上传头像激活状态。
  const [isDragging, setIsDragging] = useState(false);
  // 文件上传 DOM 引用。
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // 消息提示实例。
  const toast = useToast();
  // 全局头部状态。
  const { setCustomTitle, setExtraActions, setHideChatButton, resetHeader } =
    useHeaderStore();

  // 动态同步面包屑标题与操作按钮至全局 Header 顶栏。
  useEffect(() => {
    const title =
      mode === "create"
        ? "录入新人物关系档案"
        : `编辑 ${formState.name || "人物"} 档案`;
    setCustomTitle(title);
    setHideChatButton(true);

    setExtraActions(
      <div className="flex items-center gap-1.5 animate-card-modal-in">
        <IconButton
          disabled={!formState.name.trim()}
          preset="save"
          onClick={onSave}
          title="保存档案"
          aria-label="Save"
        />
        <IconButton
          preset="close"
          onClick={onCancel}
          title="取消编辑"
          aria-label="Cancel"
        />
      </div>,
    );

    return () => {
      resetHeader();
    };
  }, [
    mode,
    formState.name,
    onCancel,
    onSave,
    setCustomTitle,
    setExtraActions,
    setHideChatButton,
    resetHeader,
  ]);

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
  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
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

  return (
    <div className="flex-1 flex flex-col min-h-0 animate-card-modal-in">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-[100px_1fr] gap-4 items-start">
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">
              Avatar / 头像
            </span>
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
            <Input
              id="form-status"
              type="text"
              size="xs"
              placeholder="例: 温柔可爱，善解人意"
              value={formState.status}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  status: event.target.value,
                }))
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
            <Input
              id="form-contact"
              type="text"
              size="xs"
              placeholder="例: WeChat: tolin_love"
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

        <div className="flex flex-col gap-1.5 border-t border-white/5 pt-4">
          <span className="text-[11px] font-bold text-white/45">
            行为特征与倾向标签 (输入并回车确定)
          </span>
          <Input
            as="tags"
            tags={formState.tags}
            onChangeTags={(tags) => setFormState((prev) => ({ ...prev, tags }))}
            maxTags={8}
            size="xs"
            aria-label="Input new tag"
          />
        </div>

        <div className="flex flex-col gap-1.5 border-t border-white/5 pt-4">
          <span className="text-[11px] font-bold text-white/45">
            Dossier / 详细背景备注档案 (Markdown 编辑器)
          </span>
          <div className="p-1 rounded-[6px] border border-white/8 bg-black/15">
            <MarkdownEditor
              id="people-dossier-editor"
              height={600}
              placeholder="写下详细的性格喜好、关键习惯、约会备忘录、纪念日以及你们重要的共同记忆..."
              value={formState.details}
              onChange={(value) =>
                setFormState((prev) => ({ ...prev, details: value }))
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};
