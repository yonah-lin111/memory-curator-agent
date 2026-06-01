import { describe, expect, it } from 'vitest'
import { createDateOffsetTool, createRuntimeInfoTool, createTimeNowTool } from '../../../../src/main/agent/tools/commonInfoTool'

// 固定当前时间，避免测试依赖真实时钟。
const fixedNow = (): Date => new Date('2026-05-30T04:03:04.000Z')

describe('commonInfoTool', () => {
  it('common_time_now 返回当前时间结构化数据', async () => {
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
    expect(result.observation).toContain('当前时间')
    expect(result.observation).toContain('Asia/Shanghai')
  })

  it('common_time_now 拒绝无效时区', async () => {
    const tool = createTimeNowTool(fixedNow)

    await expect(
      tool.execute({
        timeZone: 'Mars/Olympus'
      })
    ).rejects.toThrow('无效的语言区域或时区')
  })

  it('common_date_offset 按天计算日期偏移', async () => {
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
    expect(result.observation).toContain('偏移 -1 天')
  })

  it('common_date_offset 拒绝无效基准日期', async () => {
    const tool = createDateOffsetTool(fixedNow)

    await expect(
      tool.execute({
        baseDate: 'bad-date',
        offsetDays: 1
      })
    ).rejects.toThrow('无效的基准日期')
  })

  it('common_runtime_info 只返回非敏感运行环境信息', async () => {
    const tool = createRuntimeInfoTool()

    const result = await tool.execute({})

    expect(result.data).toMatchObject({
      platform: process.platform,
      nodeVersion: process.versions.node
    })
    expect(JSON.stringify(result.data)).not.toContain('process.env')
    expect(result.observation).toContain('当前运行环境')
  })
})

