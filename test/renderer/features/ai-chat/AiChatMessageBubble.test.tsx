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

    expect(screen.getByText('查询本地 People')).toBeInTheDocument()
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

    expect(screen.getByText('查询本地 People')).toBeInTheDocument()
    expect(screen.getByText('people_query')).toBeInTheDocument()
    expect(screen.getByText('SQL 查询返回 1 行，已整理为结构化结果。')).toBeInTheDocument()
    expect(screen.queryByText(/"id"/)).not.toBeInTheDocument()
    expect(screen.queryByText(/黄酥梨.*details/)).not.toBeInTheDocument()
  })
})
