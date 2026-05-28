import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageDateNavigator } from "@renderer/components/ui/PageDateNavigator";
import { useToast } from "@renderer/components/ui/Toast";
import { JournalDateRail } from "@renderer/pages/components/JournalDateRail";
import { JournalEditorSurface } from "@renderer/pages/components/JournalEditorSurface";
import {
  createTodayEntryDate,
  hasWorkspaceBridge,
} from "@renderer/pages/components/workspacePageShared";

// 生成当前时间戳，供无 bridge 环境回退使用。
const createCurrentTimestamp = (entryDate: string): string => {
  // 当前本地时间。
  const now = new Date();
  // 当前小时。
  const hours = String(now.getHours()).padStart(2, "0");
  // 当前分钟。
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${entryDate} ${hours}:${minutes}`;
};

/**
 * JournalPage 组件 - 单日日记的沉浸书写与回看。
 */
export const JournalPage = (): React.JSX.Element => {
  // 全局提示实例。
  const toast = useToast();
  // 当前页面日期。
  const [entryDate, setEntryDate] = useState<string>(() => createTodayEntryDate());
  // 编辑器中的正文。
  const [journalContent, setJournalContent] = useState<string>("");
  // 最近一次成功保存的正文。
  const [savedJournalContent, setSavedJournalContent] = useState<string>("");
  // 页面是否正在加载。
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // 页面是否正在保存。
  const [isSaving, setIsSaving] = useState<boolean>(false);
  // 错误文案。
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 最近保存时间。
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  // 持久化函数引用，避免 effect 反复重建。
  const persistRef = useRef<(rawValue: string) => Promise<void>>(async () => undefined);

  /**
   * 切换日期前先冲刷当前草稿，避免旧内容串写到新日期。
   */
  const handleEntryDateChange = (nextDate: string): void => {
    if (nextDate === entryDate) {
      return;
    }

    void (async () => {
      if (journalContent.trim() !== savedJournalContent.trim()) {
        await persistRef.current(journalContent);
      }
      setEntryDate(nextDate);
    })();
  };

  useEffect(() => {
    /**
     * 读取当前日期的日记内容。
     */
    const loadJournal = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        if (!hasWorkspaceBridge()) {
          setJournalContent("");
          setSavedJournalContent("");
          setLastSavedAt(null);
          return;
        }

        const workspace = await window.api.workspace.listDay(entryDate);
        const nextValue = workspace.journal?.content ?? "";
        setJournalContent(nextValue);
        setSavedJournalContent(nextValue);
        setLastSavedAt(workspace.journal?.updatedAt ?? null);
      } catch {
        setErrorMessage("读取日记失败，请稍后再试。");
        toast.error("读取日记失败");
      } finally {
        setIsLoading(false);
      }
    };

    void loadJournal();
  }, [entryDate, toast]);

  persistRef.current = async (rawValue: string): Promise<void> => {
    // 持久化前先做裁剪，避免纯空格噪音写入。
    const normalizedValue = rawValue.trim();

    if (normalizedValue === savedJournalContent.trim()) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (!hasWorkspaceBridge()) {
        setSavedJournalContent(normalizedValue);
        setLastSavedAt(normalizedValue ? createCurrentTimestamp(entryDate) : null);
        return;
      }

      if (!normalizedValue) {
        await window.api.workspace.deleteJournal(entryDate);
        setSavedJournalContent("");
        setLastSavedAt(null);
        return;
      }

      const saved = await window.api.workspace.saveJournal({
        entryDate,
        content: normalizedValue,
      });
      setSavedJournalContent(saved.content);
      setLastSavedAt(saved.updatedAt);
    } catch {
      setErrorMessage("自动保存失败，内容已保留在当前页面。");
      toast.error("自动保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistRef.current(journalContent);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [entryDate, isLoading, journalContent]);

  // 根据关键词给出克制的情绪线索。
  const moodLabel = useMemo(() => {
    if (journalContent.includes("焦虑")) {
      return "紧绷";
    }
    if (journalContent.includes("推进")) {
      return "专注";
    }
    if (journalContent.includes("开心") || journalContent.includes("完成")) {
      return "提振";
    }
    return "平稳";
  }, [journalContent]);

  return (
    <section aria-label="Journal 页面" className="flex h-full min-h-0 flex-col gap-3 text-white">
      <PageDateNavigator entryDate={entryDate} label="Journal" onChange={handleEntryDateChange} />
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <JournalDateRail
          entryDate={entryDate}
          isDirty={journalContent.trim() !== savedJournalContent.trim()}
          lastSavedAt={lastSavedAt}
          moodLabel={moodLabel}
          wordCount={journalContent.length}
          onClear={() => setJournalContent("")}
          onFocusEditor={() => {
            const element = document.querySelector<HTMLTextAreaElement>(
              '[aria-label="日记正文"]',
            );
            element?.focus();
          }}
        />
        <JournalEditorSurface
          errorMessage={errorMessage}
          statusText={
            isLoading ? "正在读取日记..." : isSaving ? "正在自动保存..." : "自动保存已开启"
          }
          value={journalContent}
          onBlur={() => {
            void persistRef.current(journalContent);
          }}
          onChange={setJournalContent}
        />
      </div>
    </section>
  );
};
