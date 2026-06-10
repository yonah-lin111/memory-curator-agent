import type { AgentTool, AgentToolResult } from '@/agent/types'

// 当前时间工具入参。
type TimeNowToolInput = {
  // IANA 时区名称。
  timeZone?: string
  // BCP 47 语言区域。
  locale?: string
}

// 日期偏移工具入参。
type DateOffsetToolInput = {
  // 基准日期或时间。
  baseDate?: string
  // 偏移天数。
  offsetDays?: number
  // IANA 时区名称。
  timeZone?: string
  // BCP 47 语言区域。
  locale?: string
}

// 当前时间工具结构化数据。
type TimeNowToolData = {
  // UTC ISO 时间。
  iso: string
  // Unix 毫秒时间戳。
  unixMs: number
  // 本地化日期时间。
  local: string
  // 星期名称。
  weekday: string
  // IANA 时区名称。
  timeZone: string
  // GMT 偏移。
  offsetName: string
  // BCP 47 语言区域。
  locale: string
}

// 日期偏移工具结构化数据。
type DateOffsetToolData = TimeNowToolData & {
  // 基准 UTC ISO 时间。
  baseIso: string
  // 偏移天数。
  offsetDays: number
}

// 当前时间工具结果。
type TimeNowToolResult = AgentToolResult & TimeNowToolData

// 日期偏移工具结果。
type DateOffsetToolResult = AgentToolResult & DateOffsetToolData

// 默认语言区域。
const DEFAULT_LOCALE = 'zh-CN'

// 一天的毫秒数。
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * 解析字符串参数。
 */
const parseString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

/**
 * 解析数字参数。
 */
const parseNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

/**
 * 获取运行时默认时区。
 */
const getDefaultTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

/**
 * 归一化时区。
 */
const normalizeTimeZone = (timeZone: string | undefined): string => timeZone?.trim() || getDefaultTimeZone()

/**
 * 归一化语言区域。
 */
const normalizeLocale = (locale: string | undefined): string => locale?.trim() || DEFAULT_LOCALE

/**
 * 确认 Intl 支持指定时区和语言区域。
 */
const assertValidDateTimeOptions = (locale: string, timeZone: string): void => {
  try {
    new Intl.DateTimeFormat(locale, { timeZone }).format(new Date())
  } catch {
    throw new Error(`Invalid locale or time zone: ${locale} / ${timeZone}`)
  }
}

/**
 * 渲染本地化日期时间。
 */
const formatLocalDateTime = (date: Date, locale: string, timeZone: string): string =>
  new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)

/**
 * 渲染星期名称。
 */
const formatWeekday = (date: Date, locale: string, timeZone: string): string =>
  new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long'
  }).format(date)

/**
 * 渲染 GMT 偏移。
 */
const formatOffsetName = (date: Date, locale: string, timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: 'longOffset'
  })
  const offsetName = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value

  return offsetName ?? timeZone
}

/**
 * 汇总时间结构化数据。
 */
const buildTimeData = (date: Date, locale: string, timeZone: string): TimeNowToolData => ({
  iso: date.toISOString(),
  unixMs: date.getTime(),
  local: formatLocalDateTime(date, locale, timeZone),
  weekday: formatWeekday(date, locale, timeZone),
  timeZone,
  offsetName: formatOffsetName(date, locale, timeZone),
  locale
})

/**
 * 解析当前时间工具入参。
 */
const parseTimeNowInput = (input: unknown): TimeNowToolInput => {
  if (!isRecord(input)) {
    return {}
  }

  return {
    timeZone: parseString(input.timeZone),
    locale: parseString(input.locale)
  }
}

/**
 * 解析日期偏移工具入参。
 */
const parseDateOffsetInput = (input: unknown): DateOffsetToolInput => {
  if (!isRecord(input)) {
    return {}
  }

  return {
    baseDate: parseString(input.baseDate),
    offsetDays: parseNumber(input.offsetDays),
    timeZone: parseString(input.timeZone),
    locale: parseString(input.locale)
  }
}

/**
 * 解析基准日期。
 */
const parseBaseDate = (baseDate: string | undefined, now: Date): Date => {
  const normalized = baseDate?.trim()
  if (!normalized) {
    return now
  }

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid base date: ${normalized}`)
  }

  return date
}

/**
 * 创建当前时间查询工具。
 */
export const createTimeNowTool = (nowProvider: () => Date = () => new Date()): AgentTool => ({
  name: 'common_tool_time_now',
  description: 'Get the current date, time, weekday, time zone, and Unix timestamp. Read-only; no network access.',
  prompt: {
    summary: 'Get the current date, time, weekday, time zone, and Unix timestamp. Read-only; no network access.',
    intentKeywords: ['时间', '几点', '现在', '今天是', '今天几号', '几号', '日期', '时区', 'timestamp', 'time', 'date', 'now'],
    whenToUse: [
      'Use when the user asks for the current time, date, weekday, time zone, or timestamp.',
      'Use for questions such as today\'s date, the current time, or the current Unix timestamp that require real-time information.'
    ],
    whenNotToUse: ['Do not use when the user is only discussing time concepts, writing, or translating.'],
    safety: ['Only read the local current time. Do not access the network or user files.'],
    output: 'Return the requested time information directly, including the time zone when useful.',
    examples: ['{}', '{"timeZone":"Asia/Shanghai","locale":"zh-CN"}']
  },
  parameters: {
    type: 'object',
    properties: {
      timeZone: {
        type: 'string',
        description: 'IANA time zone name, for example Asia/Shanghai or America/Los_Angeles. Defaults to the system time zone.'
      },
      locale: {
        type: 'string',
        description: 'BCP 47 locale, for example zh-CN or en-US. Defaults to zh-CN.'
      }
    }
  },
  execute: async (input): Promise<TimeNowToolResult> => {
    const parsed = parseTimeNowInput(input)
    const timeZone = normalizeTimeZone(parsed.timeZone)
    const locale = normalizeLocale(parsed.locale)

    assertValidDateTimeOptions(locale, timeZone)

    const data = buildTimeData(nowProvider(), locale, timeZone)

    return {
      observation: `Current time: ${data.local} (${data.weekday}, ${data.timeZone}, ${data.offsetName}).`,
      data,
      ...data
    }
  }
})

/**
 * 创建日期偏移计算工具。
 */
export const createDateOffsetTool = (nowProvider: () => Date = () => new Date()): AgentTool => ({
  name: 'common_tool_date_offset',
  description: 'Calculate date offsets by day, such as yesterday, tomorrow, N days later, or N days earlier. Read-only; no network access.',
  prompt: {
    summary: 'Calculate date offsets by day, such as yesterday, tomorrow, N days later, or N days earlier. Read-only; no network access.',
    intentKeywords: [
      '昨天',
      '明天',
      '后天',
      '前天',
      '几天后',
      '几天前',
      '日期计算',
      '倒推',
      'deadline',
      'date offset'
    ],
    whenToUse: [
      'Use when the user asks for yesterday, tomorrow, the day after tomorrow, N days earlier, or N days later.',
      'Use when the user needs a date offset from a given base date.'
    ],
    whenNotToUse: ['Prefer common_tool_time_now when the user only asks for the current date or current time.'],
    safety: ['Only perform local date calculations. Do not access the network or user files.'],
    output: 'Return the calculated date, weekday, and time zone.',
    examples: ['{"offsetDays":1}', '{"baseDate":"2026-05-30T10:00:00+08:00","offsetDays":-7,"timeZone":"Asia/Shanghai"}']
  },
  parameters: {
    type: 'object',
    required: ['offsetDays'],
    properties: {
      baseDate: {
        type: 'string',
        description: 'Base date or time. Supports Date-parseable ISO strings. Defaults to the current time.'
      },
      offsetDays: {
        type: 'number',
        description: 'Day offset. Tomorrow is 1; yesterday is -1.'
      },
      timeZone: {
        type: 'string',
        description: 'IANA time zone name. Defaults to the system time zone.'
      },
      locale: {
        type: 'string',
        description: 'BCP 47 locale. Defaults to zh-CN.'
      }
    }
  },
  execute: async (input): Promise<DateOffsetToolResult> => {
    const parsed = parseDateOffsetInput(input)
    const timeZone = normalizeTimeZone(parsed.timeZone)
    const locale = normalizeLocale(parsed.locale)

    assertValidDateTimeOptions(locale, timeZone)

    const offsetDays = parsed.offsetDays ?? 0
    const baseDate = parseBaseDate(parsed.baseDate, nowProvider())
    const targetDate = new Date(baseDate.getTime() + offsetDays * DAY_MS)
    const timeData = buildTimeData(targetDate, locale, timeZone)
    const data = {
      ...timeData,
      baseIso: baseDate.toISOString(),
      offsetDays
    }

    return {
      observation: `Date/time after offsetting ${offsetDays} days: ${data.local} (${data.weekday}, ${data.timeZone}, ${data.offsetName}).`,
      data,
      ...data
    }
  }
})
