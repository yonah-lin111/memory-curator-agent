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

// 把 YYYY-MM-DD 转成页面展示标签。
export const formatEntryDateLabel = (entryDate: string): string => {
  // 切分出的年月日片段。
  const [year, month, date] = entryDate.split("-");

  return `${year}.${month}.${date}`;
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

// 没有 preload bridge 的测试 / 预览环境保护。
export const hasWorkspaceBridge = (): boolean => Boolean(window.api?.workspace);
