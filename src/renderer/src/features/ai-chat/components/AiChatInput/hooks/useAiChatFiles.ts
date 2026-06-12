import type React from "react";
import { useRef, useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import type { SelectedTextFile } from "@/features/ai-chat/components/AiChatInput/types";
import { MAX_TEXT_FILES } from "@/features/ai-chat/components/AiChatInput/constants";
import { isTextFile } from "@/features/ai-chat/components/AiChatInput/utils";

/**
 * useAiChatFiles - 专门管理 AI 输入框关联图片及文本文件选择、上传、拖拽和粘贴行为的微 Hook。
 *
 * @param isImageSupported 当前 AI 模型是否支持图片上传
 */
export const useAiChatFiles = (isImageSupported: boolean) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedTextFiles, setSelectedTextFiles] = useState<SelectedTextFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  /**
   * 异步处理文件并上传、存储图片文件。
   */
  const handleUploadFiles = async (files: FileList | File[]): Promise<void> => {
    if (!isImageSupported) {
      toast.error("当前选择的模型不支持图片输入。");
      return;
    }

    if (!window.api?.files?.saveAiChatImage) {
      toast.error("当前环境不支持保存图片，无法上传。");
      return;
    }

    const currentCount = selectedImages.length;
    if (currentCount >= 6) {
      toast.warning("最多只能上传 6 张图片");
      return;
    }

    const remainingSlots = 6 - currentCount;
    const fileArray = Array.from(files);

    const imageFiles = fileArray.filter((file) =>
      file.type.startsWith("image/"),
    );
    if (imageFiles.length === 0 && fileArray.length > 0) {
      toast.warning("仅支持上传图片文件");
      return;
    }

    if (imageFiles.length > remainingSlots) {
      toast.warning(`最多只能上传 6 张图片，已自动截取前 ${remainingSlots} 张`);
    }

    const allowedFiles = imageFiles.slice(0, remainingSlots);

    const uploaded: string[] = [];
    for (const file of allowedFiles) {
      if (file.size > 10 * 1024 * 1024) {
        toast.warning(`图片 ${file.name} 超过 10MB 限制`);
        continue;
      }

      try {
        const buffer = await file.arrayBuffer();
        const result = await window.api.files.saveAiChatImage({
          name: file.name,
          mimeType: file.type,
          bytes: buffer,
        });
        uploaded.push(result.url);
      } catch (err) {
        toast.error(`图片 ${file.name} 上传失败`);
      }
    }

    if (uploaded.length > 0) {
      setSelectedImages((prev) => [...prev, ...uploaded]);
    }
  };

  /**
   * 异步上传并存储文本文件。
   */
  const handleUploadTextFiles = async (
    files: FileList | File[],
  ): Promise<void> => {
    if (!window.api?.files?.saveAiChatTextFile) {
      toast.error("当前环境不支持保存文本文件，无法上传。");
      return;
    }

    const currentCount = selectedTextFiles.length;

    if (currentCount >= MAX_TEXT_FILES) {
      toast.warning(`最多只能上传 ${MAX_TEXT_FILES} 个文本文件`);
      return;
    }

    const remainingSlots = MAX_TEXT_FILES - currentCount;
    const fileArray = Array.from(files);
    const textFiles = fileArray.filter((file) => isTextFile(file));

    if (textFiles.length === 0 && fileArray.length > 0) {
      toast.warning("仅支持上传常见文本/代码文件");
      return;
    }

    if (textFiles.length > remainingSlots) {
      toast.warning(
        `最多只能上传 ${MAX_TEXT_FILES} 个文本文件，已自动截取前 ${remainingSlots} 个`,
      );
    }

    const allowedFiles = textFiles.slice(0, remainingSlots);
    const uploaded: SelectedTextFile[] = [];

    for (const file of allowedFiles) {
      if (file.size > 5 * 1024 * 1024) {
        toast.warning(`文件 ${file.name} 超过 5MB 限制`);
        continue;
      }

      try {
        const buffer = await file.arrayBuffer();
        const result = await window.api.files.saveAiChatTextFile({
          name: file.name,
          mimeType: file.type,
          bytes: buffer,
        });

        uploaded.push({
          fileName: result.fileName,
          url: result.url,
          originalName: result.originalName,
          sizeBytes: result.sizeBytes,
        });
      } catch (err) {
        toast.error(`文件 ${file.name} 上传失败`);
      }
    }

    if (uploaded.length > 0) {
      setSelectedTextFiles((prev) => [...prev, ...uploaded]);
    }
  };

  /**
   * 拖拽进入区域事件。
   */
  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    setIsDragging(true);
  };

  /**
   * 拖拽离开区域事件。
   */
  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault();
    setIsDragging(false);
  };

  /**
   * 拖拽松手上传事件。
   */
  const handleDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;

    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      const imageFiles = fileArray.filter((f) => f.type.startsWith("image/"));
      const textFiles = fileArray.filter(
        (f) => !f.type.startsWith("image/") && isTextFile(f),
      );

      if (isImageSupported && imageFiles.length > 0) {
        await handleUploadFiles(imageFiles);
      }

      if (textFiles.length > 0) {
        await handleUploadTextFiles(textFiles);
      }
    }
  };

  /**
   * 粘贴图片与文本文件事件。
   */
  const handlePaste = async (
    e: React.ClipboardEvent<HTMLTextAreaElement>,
  ): Promise<void> => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    const textFileList: File[] = [];

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      } else {
        const file = item.getAsFile();
        if (file && isTextFile(file)) textFileList.push(file);
      }
    }

    if (imageFiles.length > 0 || textFileList.length > 0) {
      e.preventDefault();
      if (isImageSupported && imageFiles.length > 0) {
        await handleUploadFiles(imageFiles);
      }
      if (textFileList.length > 0) {
        await handleUploadTextFiles(textFileList);
      }
    }
  };

  /**
   * 点击附件按钮拉起文件选择。
   */
  const handleAttachmentClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  /**
   * 文件改变选择代理句柄。
   */
  const handleUploadFilesProxy = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      const imageFiles = fileArray.filter((f) => f.type.startsWith("image/"));
      const textFiles = fileArray.filter(
        (f) => !f.type.startsWith("image/") && isTextFile(f),
      );

      if (isImageSupported && imageFiles.length > 0) {
        void handleUploadFiles(imageFiles);
      }
      if (textFiles.length > 0) {
        void handleUploadTextFiles(textFiles);
      }
    }
    e.target.value = "";
  };

  /**
   * 清空当前所有选中文件。
   */
  const clearFiles = useCallback(() => {
    setSelectedImages([]);
    setSelectedTextFiles([]);
  }, []);

  return {
    fileInputRef,
    selectedImages,
    selectedTextFiles,
    isDragging,
    setSelectedImages,
    setSelectedTextFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
    handleAttachmentClick,
    handleUploadFilesProxy,
    clearFiles,
  };
};
