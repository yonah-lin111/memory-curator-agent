import { describe, expect, it } from 'vitest'
import { createDateOffsetTool, createTimeNowTool } from '../../../../src/main/agent/tools/commonTimeTool'

// 固定当前时间，避免测试依赖真实时钟。
const fixedNow = (): Date => new Date('2026-05-30T04:03:04.000Z')

describe('commonTimeTool', () => {
  it('common_tool.time_now 返回当前时间结构化数据', async () => {
    const tool = createTimeNowTool(fixedNow)

    const result = await tool.execute({
      timeZone: 'Asia/Shanghai',
      locale: 'zh-CN'
    })

    expect(result.data).toMatchObject({
      iso: '2026-05-30T04:03:04.000Z',
      unixMs: fixedNow().getTime(),
      weekday: '星期六',
      timeZone: 'Asia/Shanghai',
      locale: 'zh-CN'
    })
    expect(result.observation).toContain('Current time')
    expect(result.observation).toContain('Asia/Shanghai')
  })

  it('common_tool.time_now 拒绝无效时区', async () => {
    const tool = createTimeNowTool(fixedNow)

    await expect(
      tool.execute({
        timeZone: 'Mars/Olympus'
      })
    ).rejects.toThrow('Invalid locale or time zone')
  })

  it('common_tool.date_offset 按天计算日期偏移', async () => {
    const tool = createDateOffsetTool(fixedNow)

    const result = await tool.execute({
      baseDate: '2026-05-30T04:03:04.000Z',
      offsetDays: -1,
      timeZone: 'Asia/Shanghai',
      locale: 'zh-CN'
    })

    expect(result.data).toMatchObject({
      baseIso: '2026-05-30T04:03:04.000Z',
      iso: '2026-05-29T04:03:04.000Z',
      offsetDays: -1,
      weekday: '星期五',
      timeZone: 'Asia/Shanghai'
    })
    expect(result.observation).toContain('offsetting -1 days')
  })

  it('common_tool.date_offset 拒绝无效基准日期', async () => {
    const tool = createDateOffsetTool(fixedNow)

    await expect(
      tool.execute({
        baseDate: 'bad-date',
        offsetDays: 1
      })
    ).rejects.toThrow('Invalid base date')
  })
})
