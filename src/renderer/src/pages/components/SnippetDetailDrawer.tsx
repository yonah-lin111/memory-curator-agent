import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";

// 工作台片段记录类型，直接从 bridge 签名反推。
type WorkspaceSnippetRecord =
  Awaited<ReturnType<Window["api"]["workspace"]["listDay"]>>["snippets"][number];

// 片段详情抽屉属性。
interface SnippetDetailDrawerProps {
  // 当前选中的片段。
  selectedSnippet: WorkspaceSnippetRecord | null;
  // 新建回调。
  onCreate: (draft: {
    title: string;
    content: string;
    tags: string[];
  }) => Promise<void>;
  // 保存回调。
  onSave: (
    id: number,
    draft: {
      title: string;
      content: string;
      tags: string[];
    },
  ) => Promise<void>;
  // 删除回调。
  onDelete: (id: number) => Promise<void>;
}

// 解析标签输入为稳定列表。
const parseTags = (rawValue: string): string[] =>
  rawValue
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

/**
 * SnippetDetailDrawer - 片段详情抽屉。
 */
export const SnippetDetailDrawer = ({
  selectedSnippet,
  onCreate,
  onSave,
  onDelete,
}: SnippetDetailDrawerProps): React.JSX.Element => {
  // 当前标题草稿。
  const [title, setTitle] = useState<string>(selectedSnippet?.title ?? "");
  // 当前正文草稿。
  const [content, setContent] = useState<string>(selectedSnippet?.content ?? "");
  // 当前标签输入串。
  const [tagsText, setTagsText] = useState<string>(
    (selectedSnippet?.tags ?? []).join(", "),
  );

  useEffect(() => {
    setTitle(selectedSnippet?.title ?? "");
    setContent(selectedSnippet?.content ?? "");
    setTagsText((selectedSnippet?.tags ?? []).join(", "));
  }, [selectedSnippet]);

  // 是否处于编辑模式。
  const isEditing = Boolean(selectedSnippet);
  // 当前解析出的标签列表。
  const currentTags = useMemo(() => parseTags(tagsText), [tagsText]);

  return (
    <aside className="flex min-h-0 flex-col rounded-[6px] border border-white/6 bg-[#212121] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/28">
            Detail Drawer
          </p>
          <p className="mt-1 text-sm text-white/82">
            {isEditing ? "编辑当前片段" : "创建一条新的片段记录"}
          </p>
        </div>
        {selectedSnippet ? (
          <IconButton
            aria-label={`删除片段 ${selectedSnippet.title}`}
            className="h-8 w-8 bg-white/5 text-white/60 hover:bg-white/10 hover:text-rose-300"
            onClick={() => void onDelete(selectedSnippet.id)}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        ) : null}
      </div>

      <label className="text-xs text-white/40" htmlFor="snippet-title">
        片段标题
      </label>
      <input
        aria-label="片段标题"
        className="mt-1 rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
        id="snippet-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <label className="mt-3 text-xs text-white/40" htmlFor="snippet-content">
        片段正文
      </label>
      <textarea
        aria-label="片段正文"
        className="mt-1 min-h-[220px] rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
        id="snippet-content"
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />

      <label className="mt-3 text-xs text-white/40" htmlFor="snippet-tags">
        片段标签
      </label>
      <input
        aria-label="片段标签"
        className="mt-1 rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
        id="snippet-tags"
        value={tagsText}
        onChange={(event) => setTagsText(event.target.value)}
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {currentTags.map((tag) => (
          <span
            key={tag}
            className="rounded-[6px] border border-white/8 bg-black/25 px-2 py-1 text-[11px] text-white/62"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4">
        <IconButton
          aria-label={isEditing ? "保存片段" : "创建片段"}
          className="h-9 w-full justify-center bg-white text-black hover:bg-white/90"
          iconOnly={false}
          onClick={() => {
            // 写入前统一裁剪输入，避免空白噪音进入库层。
            const payload = {
              title: title.trim(),
              content: content.trim(),
              tags: currentTags,
            };

            if (selectedSnippet) {
              void onSave(selectedSnippet.id, payload);
              return;
            }

            void onCreate(payload);
          }}
        >
          {isEditing ? "保存片段" : "创建片段"}
        </IconButton>
      </div>
    </aside>
  );
};
