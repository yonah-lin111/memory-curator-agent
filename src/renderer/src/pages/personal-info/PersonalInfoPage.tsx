import type React from "react";
import {
  User,
  Calendar,
  Phone,
  Clock,
  Tag as TagIcon,
  Sparkles,
  Info,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tag } from "@/components/ui/Tag";
import { PersonalInfoForm } from "./components/PersonalInfoForm";
import { usePersonalInfo } from "./components/usePersonalInfo";
import { MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";

import { Tooltip } from "@/components/ui/Tooltip";

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
    | "pink"
    | "amber"
    | "blue"
    | "teal"
    | "emerald"
    | "rose"
    | "purple"
    | "indigo"
    | "sky"
    | "orange"
  > = [
    "pink",
    "amber",
    "blue",
    "teal",
    "emerald",
    "rose",
    "purple",
    "indigo",
    "sky",
    "orange",
  ];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export const PersonalInfoPage = (): React.JSX.Element => {
  const {
    mode,
    profile,
    formState,
    setFormState,
    isLoading,
    enterEditMode,
    handleSaveForm,
    handleClearProfile,
    setMode,
  } = usePersonalInfo();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/50 text-sm">
        正在加载个人信息...
      </div>
    );
  }

  return (
    <section
      aria-label="Personal Info Page"
      className="flex h-full min-h-0 flex-col text-white"
    >
      <div className="flex-1 flex flex-col min-h-0 rounded-[6px] border border-white/6 bg-[#212121] overflow-hidden">
        {mode === "view" ? (
          <div className="flex-1 flex flex-col min-h-0">
            {profile ? (
              <>
                <div className="p-6 border-b border-white/5 bg-black/20 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-5">
                    <div className="relative flex-shrink-0">
                      {profile.avatar ? (
                        <img
                          src={profile.avatar}
                          alt={profile.name}
                          className="w-20 h-20 object-cover rounded-[6px] border-2 border-white/10 shadow-lg"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-white/5 border-2 border-white/10 rounded-[6px] flex items-center justify-center text-2xl font-bold text-white/50">
                          {profile.name.substring(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-white leading-none">
                          {profile.name}
                        </h2>
                        <span className="text-xs font-medium text-white/40 bg-white/5 px-2 py-0.5 rounded-[4px] border border-white/10">
                          {profile.gender}
                        </span>
                      </div>
                      <p className="text-xs text-white/70 font-medium leading-relaxed mt-1 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
                        <span>{profile.status || "暂无签名"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                    <IconButton
                      preset="edit"
                      onClick={enterEditMode}
                      title="编辑个人信息"
                    />
                    
                    <Tooltip
                      title="确认要清空个人信息吗？"
                      description={`清空后，所有已填写的个人特征标签、联系方式及详细备注等数据将被永久擦除，此操作无法撤销。`}
                      onConfirm={handleClearProfile}
                      variant="danger"
                    >
                      <IconButton preset="delete" title="清空档案" />
                    </Tooltip>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6">
                  {profile.tags.length > 0 && (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/30 tracking-wider uppercase">
                        <TagIcon className="h-3.5 w-3.5" />
                        <span>Feature Tags / 个人特征标签</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {profile.tags.map((tag) => (
                          <Tag key={tag} size="default" color={getTagColor(tag)}>
                            {tag}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-[6px] border border-white/5 bg-black/20 p-3.5 flex items-center gap-3.5">
                      <div className="p-2.5 rounded-[6px] bg-white/[0.03] text-white/50 border border-white/5 flex-shrink-0">
                        <Calendar className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">
                          Birthday / 生日
                        </span>
                        <span className="text-sm text-white/80 font-bold mt-0.5">
                          {profile.birthday || "未填写"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-[6px] border border-white/5 bg-black/20 p-3.5 flex items-center gap-3.5">
                      <div className="p-2.5 rounded-[6px] bg-white/[0.03] text-white/50 border border-white/5 flex-shrink-0">
                        <Phone className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">
                          Contact / 联系方式
                        </span>
                        <span className="text-sm text-white/80 font-bold mt-0.5">
                          {profile.contact || "未填写"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 border-t border-white/5 pt-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/30 tracking-wider uppercase">
                        <Info className="h-3.5 w-3.5" />
                        <span>Detailed Dossier / 个人详细备注档案</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-white/25">
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          更新: {profile.updatedAt}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-[6px] border border-white/5 bg-black/15 p-5 min-h-[300px]">
                      {profile.details ? (
                        <div className="markdown-preview-container select-text">
                          <MdPreview
                            theme="dark"
                            modelValue={profile.details}
                            previewTheme="default"
                            codeTheme="atom"
                            style={{ backgroundColor: "transparent" }}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <span className="text-xs text-white/30">
                            暂无详细档案，点击编辑补全。
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black/5">
                <User className="h-12 w-12 text-white/20 mb-4" />
                <h3 className="text-base font-bold text-white/80 mb-2">
                  尚未建立个人档案
                </h3>
                <p className="max-w-[400px] text-xs leading-relaxed text-white/40 mb-6">
                  这是你个人的信息中枢。在这里，你可以记录自己的特征标签、重要日子、以及专属的详细备忘录。
                </p>
                <IconButton preset="add" iconOnly={false} className="gap-2 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-[6px]" onClick={enterEditMode} title="创建档案">
                  <span>创建个人信息</span>
                </IconButton>
              </div>
            )}
          </div>
        ) : (
          <PersonalInfoForm
            mode={mode}
            formState={formState}
            setFormState={setFormState}
            onCancel={() => setMode("view")}
            onSave={handleSaveForm}
          />
        )}
      </div>
    </section>
  );
};
