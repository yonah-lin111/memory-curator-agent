import type React from "react";
import { X } from "lucide-react";
import { Image } from "@/components/ui/Image";
import { TextFile } from "@/components/ui/TextFile";
import type { SelectedTextFile } from "@/features/ai-chat/components/AiChatInput/types";

// 附件预览子组件属性类型。
export interface AttachmentPreviewProps {
  // 已选图片 URL 列表。
  selectedImages: string[];
  // 已选文本文件列表。
  selectedTextFiles: SelectedTextFile[];
  // 移除图片回调。
  onRemoveImage: (index: number) => void;
  // 移除文本文件回调。
  onRemoveTextFile: (index: number) => void;
}

/**
 * AttachmentPreview - 上传图片及文本文件的缩略图预览横轴。
 */
export const AttachmentPreview = ({
  selectedImages,
  selectedTextFiles,
  onRemoveImage,
  onRemoveTextFile,
}: AttachmentPreviewProps): React.JSX.Element | null => {
  if (selectedImages.length === 0 && selectedTextFiles.length === 0) {
    return null;
  }

  return (
    <>
      {/* 上传文本文件微缩预览横轴 */}
      {selectedTextFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1.5 py-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
          {selectedTextFiles.map((file, idx) => (
            <div key={idx} className="relative group/preview-txt">
              <TextFile
                url={file.url}
                fileName={file.originalName}
                sizeBytes={file.sizeBytes}
                preview={true}
              />
              <button
                type="button"
                aria-label="Remove text file"
                onClick={() => onRemoveTextFile(idx)}
                className="absolute -top-1.5 -right-1.5 z-10 hidden group-hover/preview-txt:flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-500 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 上传图片微缩预览横轴 */}
      {selectedImages.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1.5 py-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
          {selectedImages.map((url, idx) => (
            <div
              key={idx}
              className="relative group/preview-img w-14 h-14 shrink-0 rounded-[6px] border border-white/10 bg-white/[0.02]"
            >
              <Image
                src={url}
                preview={false}
                aspectRatio="square"
                className="w-full h-full rounded-[6px] object-cover"
              />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => onRemoveImage(idx)}
                className="absolute -top-1.5 -right-1.5 z-10 hidden group-hover/preview-img:flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-500 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
