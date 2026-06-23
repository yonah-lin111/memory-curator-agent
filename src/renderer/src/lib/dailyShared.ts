// 页面日期工具函数，供三页复用。
export const createTodayEntryDate = (): string => {
  // 当前本地时间。
  const now = new Date();
  // 当前年份。
  const year = now.getFullYear();
  // 当前月份。
  const month = String(now.getMonth() + 1).padStart(2, "0");
  // 当前日期。
  const date = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${date}`;
};

/**
 * 把 Date 对象格式化为 entryDate。
 */
export const formatDateAsEntryDate = (value: Date): string => {
  // 日期对象对应的年份。
  const year = value.getFullYear();
  // 日期对象对应的月份。
  const month = String(value.getMonth() + 1).padStart(2, "0");
  // 日期对象对应的日期。
  const date = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${date}`;
};

// 把 YYYY-MM-DD 转成页面展示标签。
export const formatEntryDateLabel = (entryDate: string): string => {
  // 切分出的年月日片段。
  const [year, month, date] = entryDate.split("-");

  return `${year}.${month}.${date}`;
};

/**
 * 获取日期所在的周一的日期。
 */
export const getMonday = (dateStr: string): string => {
  const date = new Date(`${dateStr}T00:00:00`);
  const day = (date.getDay() + 6) % 7; // 0 for Monday, ..., 6 for Sunday
  date.setDate(date.getDate() - day);
  return formatDateAsEntryDate(date);
};

/**
 * 计算指定日期在当年属于第几周。
 */
export const getWeekNumber = (entryDate: string): number => {
  const d = new Date(`${entryDate}T00:00:00`);
  d.setHours(0, 0, 0, 0);
  // 设置为最近的周四：当前日期 + 4 - 当前星期数（0 转换为 7）
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

/**
 * 格式化周标签（2026.06.22 - 2026.06.28）。
 */
export const formatWeekLabel = (dateStr: string): string => {
  const monday = getMonday(dateStr);
  const sunday = shiftEntryDate(monday, 6);
  return `${formatEntryDateLabel(monday)} - ${formatEntryDateLabel(sunday)}`;
};

/**
 * 从日期提取所属月份键。
 */
export const getEntryMonth = (entryDate: string): string => entryDate.slice(0, 7);

/**
 * 把 YYYY-MM 转成页面展示标签。
 */
export const formatEntryMonthLabel = (entryMonth: string): string => {
  // 切分出的年月片段。
  const [year, month] = entryMonth.split("-");

  return `${year}.${month}`;
};

// 计算前后一天的 entryDate。
export const shiftEntryDate = (
  entryDate: string,
  offsetDays: number,
): string => {
  // 以本地零点构造基础日期，避免时分秒污染。
  const baseDate = new Date(`${entryDate}T00:00:00`);
  baseDate.setDate(baseDate.getDate() + offsetDays);

  // 偏移后的年份。
  const year = baseDate.getFullYear();
  // 偏移后的月份。
  const month = String(baseDate.getMonth() + 1).padStart(2, "0");
  // 偏移后的日期。
  const date = String(baseDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${date}`;
};

/**
 * 计算前后月份。
 */
export const shiftEntryMonth = (
  entryMonth: string,
  offsetMonths: number,
): string => {
  // 月份对应的基准日期。
  const baseDate = new Date(`${entryMonth}-01T00:00:00`);
  baseDate.setMonth(baseDate.getMonth() + offsetMonths);

  return formatDateAsEntryDate(baseDate).slice(0, 7);
};

// 日历单元格类型。
export type CalendarDayCell = {
  // 单元格对应日期。
  entryDate: string;
  // 单元格展示数字。
  dayNumber: number;
  // 是否属于当前可见月份。
  isCurrentMonth: boolean;
};

/**
 * 生成整月日历网格，补齐前后月份日期，保证布局稳定。
 */
export const createMonthCalendarDays = (
  entryMonth: string,
): CalendarDayCell[] => {
  // 当前月份第一天。
  const firstDay = new Date(`${entryMonth}-01T00:00:00`);
  // 当前月份开始时应从周几回退。
  const weekOffset = (firstDay.getDay() + 6) % 7;
  // 网格起点日期。
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - weekOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const currentDate = new Date(gridStart);
    currentDate.setDate(gridStart.getDate() + index);
    const currentEntryDate = formatDateAsEntryDate(currentDate);

    return {
      entryDate: currentEntryDate,
      dayNumber: currentDate.getDate(),
      isCurrentMonth: getEntryMonth(currentEntryDate) === entryMonth,
    };
  });
};

// 日历周标题。
export const CALENDAR_WEEKDAY_LABELS = [
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "日",
] as const;

// 没有 preload bridge 的测试 / 预览环境保护。
export const hasDailyBridge = (): boolean => Boolean(window.api?.daily);
