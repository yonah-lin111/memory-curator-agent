import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageDateNavigator } from "@renderer/components/ui/PageDateNavigator";
import { useToast } from "@renderer/components/ui/Toast";
import { JournalDateRail } from "@renderer/pages/journal/components/JournalDateRail";
import { JournalEditorSurface } from "@renderer/pages/journal/components/JournalEditorSurface";
import {
  createTodayEntryDate,
  getEntryMonth,
  hasDailyBridge,
} from "@renderer/lib/dailyShared";

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
  // 当前月历可见月份。
  const [visibleMonth, setVisibleMonth] = useState<string>(() =>
    getEntryMonth(createTodayEntryDate()),
  );
  // 当前可见月份的日记角标映射。
  const [monthEntryCounts, setMonthEntryCounts] = useState<Record<string, number>>(
    {},
  );
  // 编辑器中的正文。
  const [journalContent, setJournalContent] = useState<string>("");
  // 最近一次成功保存的正文。
  const [savedJournalContent, setSavedJournalContent] = useState<string>("");
  // 页面是否正在加载。
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // 最近保存时间。
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  // 月历标记是否正在加载。
  const [isMonthOverviewLoading, setIsMonthOverviewLoading] =
    useState<boolean>(true);
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
      setVisibleMonth(getEntryMonth(nextDate));
      setEntryDate(nextDate);
    })();
  };

  useEffect(() => {
    /**
     * 读取当前可见月份的日记角标概览。
     */
    const loadMonthOverview = async (): Promise<void> => {
      setIsMonthOverviewLoading(true);

      try {
        if (!hasDailyBridge()) {
          setMonthEntryCounts({});
          return;
        }

        const overview = await window.api.daily.listMonthOverview(visibleMonth);
        setMonthEntryCounts(
          Object.fromEntries(
            overview.entries
              .filter((item) => item.journalCount > 0)
              .map((item) => [item.entryDate, item.journalCount]),
          ),
        );
      } catch {
        toast.error("读取月历标记失败");
      } finally {
        setIsMonthOverviewLoading(false);
      }
    };

    void loadMonthOverview();
  }, [toast, visibleMonth]);

  useEffect(() => {
    /**
     * 读取当前日期的日记内容。
     */
    const loadJournal = async (): Promise<void> => {
      setIsLoading(true);

      try {
        if (!hasDailyBridge()) {
          setJournalContent("");
          setSavedJournalContent("");
          setLastSavedAt(null);
          return;
        }

        const todayData = await window.api.daily.listDay(entryDate);
        const nextValue = todayData.journal?.content ?? "";
        setJournalContent(nextValue);
        setSavedJournalContent(nextValue);
        setLastSavedAt(todayData.journal?.updatedAt ?? null);
      } catch {
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

    try {
      if (!hasDailyBridge()) {
        setSavedJournalContent(normalizedValue);
        setLastSavedAt(normalizedValue ? createCurrentTimestamp(entryDate) : null);
        setMonthEntryCounts((currentCounts) => {
          if (normalizedValue) {
            return { ...currentCounts, [entryDate]: 1 };
          }

          const nextCounts = { ...currentCounts };
          delete nextCounts[entryDate];
          return nextCounts;
        });
        return;
      }

      if (!normalizedValue) {
        await window.api.daily.deleteJournal(entryDate);
        setSavedJournalContent("");
        setLastSavedAt(null);
        setMonthEntryCounts((currentCounts) => {
          const nextCounts = { ...currentCounts };
          delete nextCounts[entryDate];
          return nextCounts;
        });
        return;
      }

      const saved = await window.api.daily.saveJournal({
        entryDate,
        content: normalizedValue,
      });
      setSavedJournalContent(saved.content);
      setLastSavedAt(saved.updatedAt);
      setMonthEntryCounts((currentCounts) => ({ ...currentCounts, [entryDate]: 1 }));
    } catch {
      toast.error("自动保存失败");
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
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <JournalEditorSurface
          value={journalContent}
          headerLeft={
            <PageDateNavigator
              entryCountMap={monthEntryCounts}
              entryDate={entryDate}
              isMonthOverviewLoading={isMonthOverviewLoading}
              visibleMonth={visibleMonth}
              onChange={handleEntryDateChange}
              onVisibleMonthChange={setVisibleMonth}
            />
          }
          onBlur={() => {
            void persistRef.current(journalContent);
          }}
          onChange={setJournalContent}
        />
        <JournalDateRail
          isDirty={journalContent.trim() !== savedJournalContent.trim()}
          lastSavedAt={lastSavedAt}
          moodLabel={moodLabel}
          wordCount={journalContent.length}
        />
      </div>
    </section>
  );
};
