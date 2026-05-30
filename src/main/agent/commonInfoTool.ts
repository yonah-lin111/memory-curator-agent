import { arch, platform, release, type } from 'node:os'
import type { AgentTool, AgentToolResult } from './types'

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

// 运行环境工具结构化数据。
type RuntimeInfoToolData = {
  // Node.js 平台标识。
  platform: NodeJS.Platform
  // CPU 架构。
  arch: string
  // 操作系统类型。
  osType: string
  // 操作系统版本。
  osRelease: string
  // Node.js 版本。
  nodeVersion: string
  // Electron 版本。
  electronVersion?: string
  // 默认时区。
  timeZone: string
  // 默认语言区域。
  locale: string
}

// 当前时间工具结果。
type TimeNowToolResult = AgentToolResult & TimeNowToolData

// 日期偏移工具结果。
type DateOffsetToolResult = AgentToolResult & DateOffsetToolData

// 运行环境工具结果。
type RuntimeInfoToolResult = AgentToolResult & RuntimeInfoToolData

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
 * 获取运行时默认语言区域。
 */
const getDefaultLocale = (): string => Intl.DateTimeFormat().resolvedOptions().locale || DEFAULT_LOCALE

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
    throw new Error(`无效的语言区域或时区：${locale} / ${timeZone}`)
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
    throw new Error(`无效的基准日期：${normalized}`)
  }

  return date
}

/**
 * 创建当前时间查询工具。
 */
export const createTimeNowTool = (nowProvider: () => Date = () => new Date()): AgentTool => ({
  name: 'common_time_now',
  description: '获取当前日期、时间、星期、时区和 Unix 时间戳，只读，不访问网络。',
  prompt: {
    summary: '获取当前日期、时间、星期、时区和 Unix 时间戳，只读，不访问网络。',
    intentKeywords: ['时间', '几点', '现在', '今天是', '今天几号', '几号', '日期', '时区', 'timestamp', 'time', 'date', 'now'],
    whenToUse: [
      '用户询问当前时间、日期、星期、时区或时间戳时使用。',
      '回答“今天是几号”“现在几点”“当前 Unix 时间戳”等需要实时信息的问题时使用。'
    ],
    whenNotToUse: ['用户只是泛泛讨论时间概念、写作或翻译时不要使用。'],
    safety: ['只读取本机当前时间，不访问网络，不读取用户文件。'],
    output: '直接给出用户需要的时间信息，必要时说明时区。',
    examples: ['{}', '{"timeZone":"Asia/Shanghai","locale":"zh-CN"}']
  },
  parameters: {
    type: 'object',
    properties: {
      timeZone: {
        type: 'string',
        description: 'IANA 时区名称，例如 Asia/Shanghai、America/Los_Angeles；不传使用系统默认时区。'
      },
      locale: {
        type: 'string',
        description: 'BCP 47 语言区域，例如 zh-CN、en-US；不传默认 zh-CN。'
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
      observation: `当前时间：${data.local}（${data.weekday}，${data.timeZone}，${data.offsetName}）。`,
      data,
      ...data
    }
  }
})

/**
 * 创建日期偏移计算工具。
 */
export const createDateOffsetTool = (nowProvider: () => Date = () => new Date()): AgentTool => ({
  name: 'common_date_offset',
  description: '按天计算日期偏移，例如昨天、明天、N 天后或 N 天前，只读，不访问网络。',
  prompt: {
    summary: '按天计算日期偏移，例如昨天、明天、N 天后或 N 天前，只读，不访问网络。',
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
      '用户询问昨天、明天、后天、N 天前或 N 天后的日期时使用。',
      '用户需要基于一个给定日期计算偏移日期时使用。'
    ],
    whenNotToUse: ['用户只询问当前日期或当前时间时优先使用 common_time_now。'],
    safety: ['只做本地日期计算，不访问网络，不读取用户文件。'],
    output: '给出计算后的日期、星期和时区。',
    examples: ['{"offsetDays":1}', '{"baseDate":"2026-05-30T10:00:00+08:00","offsetDays":-7,"timeZone":"Asia/Shanghai"}']
  },
  parameters: {
    type: 'object',
    required: ['offsetDays'],
    properties: {
      baseDate: {
        type: 'string',
        description: '基准日期或时间；支持 Date 可解析的 ISO 字符串；不传使用当前时间。'
      },
      offsetDays: {
        type: 'number',
        description: '偏移天数；明天为 1，昨天为 -1。'
      },
      timeZone: {
        type: 'string',
        description: 'IANA 时区名称；不传使用系统默认时区。'
      },
      locale: {
        type: 'string',
        description: 'BCP 47 语言区域；不传默认 zh-CN。'
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
      observation: `偏移 ${offsetDays} 天后的日期时间：${data.local}（${data.weekday}，${data.timeZone}，${data.offsetName}）。`,
      data,
      ...data
    }
  }
})

/**
 * 创建运行环境信息工具。
 */
export const createRuntimeInfoTool = (): AgentTool => ({
  name: 'common_runtime_info',
  description: '获取当前应用运行环境的非敏感基础信息，只读，不返回环境变量或密钥。',
  prompt: {
    summary: '获取当前应用运行环境的非敏感基础信息，只读，不返回环境变量或密钥。',
    intentKeywords: ['运行环境', '系统信息', '平台', '操作系统', 'node', 'electron', 'runtime', 'platform', 'os'],
    whenToUse: [
      '用户询问当前应用运行在哪个平台、Node/Electron 版本、系统架构或默认时区时使用。',
      '排查环境差异但不需要读取文件或环境变量时使用。'
    ],
    whenNotToUse: ['用户询问业务数据、本地记忆或人物档案时不要使用。'],
    safety: ['不返回环境变量、密钥、文件内容或用户目录。'],
    output: '只返回必要的运行环境字段。',
    examples: ['{}']
  },
  parameters: {
    type: 'object',
    properties: {}
  },
  execute: async (): Promise<RuntimeInfoToolResult> => {
    const data: RuntimeInfoToolData = {
      platform: platform(),
      arch: arch(),
      osType: type(),
      osRelease: release(),
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      timeZone: getDefaultTimeZone(),
      locale: getDefaultLocale()
    }

    return {
      observation: `当前运行环境：${data.osType} ${data.osRelease}（${data.platform}/${data.arch}），Node ${data.nodeVersion}。`,
      data,
      ...data
    }
  }
})
