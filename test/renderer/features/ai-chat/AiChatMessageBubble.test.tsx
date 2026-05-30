/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiChatMessageBubble } from '@renderer/features/ai-chat/components/AiChatMessageBubble'
import type { AiChatMessage } from '@renderer/features/ai-chat/aiChatMock'

vi.mock('md-editor-rt', () => ({
  MdPreview: ({ modelValue }: { modelValue: string }) => <div>{modelValue}</div>
}))

describe('AiChatMessageBubble', () => {
  afterEach(() => {
    cleanup()
  })

  it('工具调用后隐藏回答中泄漏的工具 JSON，只展示工具摘要与最终结论', () => {
    const message: AiChatMessage = {
      id: 'a1',
      role: 'assistant',
      content: '正在处理：“查一下阿明”',
      time: '10:01',
      toolSteps: [
        {
          id: 'tool-1',
          title: '查询本地 People',
          status: 'done',
          tool: 'people_query',
          observation: '找到 1 位关联人物：阿明'
        }
      ],
      answer:
        '工具观察：\n找到 1 位关联人物：阿明\n工具数据：\n```json\n{"rows":[{"name":"阿明","details":"完整详情"}]}\n```\n\n阿明是你本地 People 中的朋友。'
    }

    render(<AiChatMessageBubble message={message} />)

    expect(screen.getByText('people_query')).toBeInTheDocument()
    expect(screen.getByText('找到 1 位关联人物：阿明')).toBeInTheDocument()
    expect(screen.getByText('阿明是你本地 People 中的朋友。')).toBeInTheDocument()
    expect(screen.queryByText(/工具数据/)).not.toBeInTheDocument()
    expect(screen.queryByText(/"rows"/)).not.toBeInTheDocument()
    expect(screen.queryByText(/完整详情/)).not.toBeInTheDocument()
  })

  it('工具步骤区域不直接展示 SQL 原始行 JSON', () => {
    const message: AiChatMessage = {
      id: 'a2',
      role: 'assistant',
      content: '正在处理：“我的女朋友是谁？”',
      time: '14:22',
      toolSteps: [
        {
          id: 'tool-1',
          title: '查询本地 People',
          status: 'done',
          tool: 'people_query',
          observation:
            'SQL 查询返回 1 行：[{"id":"tolin","name":"黄酥梨","relationship":"女朋友","details":"喜欢笑，还是个小吃货"}]'
        }
      ],
      answer: '你的女朋友是黄酥梨。'
    }

    render(<AiChatMessageBubble message={message} />)

    expect(screen.getByText('people_query')).toBeInTheDocument()
    expect(screen.getByText('SQL 查询返回 1 行，已整理为结构化结果。')).toBeInTheDocument()
    expect(screen.queryByText(/"id"/)).not.toBeInTheDocument()
    expect(screen.queryByText(/黄酥梨.*details/)).not.toBeInTheDocument()
  })

  it('按流式片段顺序交错展示 AI 内容和工具重试', () => {
    const message: AiChatMessage = {
      id: 'a3',
      role: 'assistant',
      content: '正在处理：“测试工具重试”',
      time: '15:18',
      parts: [
        {
          id: 'part-1',
          kind: 'text',
          content: '我会先传递错误参数。'
        },
        {
          id: 'part-2',
          kind: 'tool',
          stepId: 'tool-1'
        },
        {
          id: 'part-3',
          kind: 'text',
          content: '工具报错了，现在修正参数重试。'
        },
        {
          id: 'part-4',
          kind: 'tool',
          stepId: 'tool-2'
        },
        {
          id: 'part-5',
          kind: 'text',
          content: '测试完成。'
        }
      ],
      toolSteps: [
        {
          id: 'tool-1',
          title: '查询本地 People',
          status: 'failed',
          tool: 'people_query',
          observation: '工具执行失败：People SQL 只能查询 associated_people 表'
        },
        {
          id: 'tool-2',
          title: '查询本地 People',
          status: 'done',
          tool: 'people_query',
          observation: 'SQL 查询没有返回数据。'
        }
      ],
      answer: '我会先传递错误参数。工具报错了，现在修正参数重试。测试完成。'
    }

    const { container } = render(<AiChatMessageBubble message={message} />)
    const renderedText = container.textContent ?? ''

    expect(renderedText.indexOf('我会先传递错误参数。')).toBeLessThan(
      renderedText.indexOf('工具执行失败：People SQL 只能查询 associated_people 表')
    )
    expect(renderedText.indexOf('工具执行失败：People SQL 只能查询 associated_people 表')).toBeLessThan(
      renderedText.indexOf('工具报错了，现在修正参数重试。')
    )
    expect(renderedText.indexOf('工具报错了，现在修正参数重试。')).toBeLessThan(
      renderedText.indexOf('SQL 查询没有返回数据。')
    )
    expect(renderedText.indexOf('SQL 查询没有返回数据。')).toBeLessThan(
      renderedText.indexOf('测试完成。')
    )
  })
})
