/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CuratorMessageBubble } from "@/features/curator/components/CuratorMessageBubble"
import type { CuratorMessage } from "@/features/curator/types"
import { useAiSettingsStore } from "@/lib/aiSettingsStore"

vi.mock("md-editor-rt", () => ({
  MdPreview: ({ modelValue }: { modelValue: string }) => (
    <div data-testid="md-preview">{modelValue}</div>
  ),
}))

class ResizeObserverMock {
  observe = (): void => undefined
  unobserve = (): void => undefined
  disconnect = (): void => undefined
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock)

/**
 * 测试渲染默认不关心右键菜单打开行为。
 */
const noopContextMenu = (): void => undefined

describe("CuratorMessageBubble", () => {
  afterEach(() => {
    cleanup()
    useAiSettingsStore.setState({ showAgentThinking: false })
  })

  it("工具调用后隐藏回答中泄漏的工具 JSON，只展示工具摘要与最终结论", () => {
    const message: CuratorMessage = {
      id: "a1",
      role: "assistant",
      content: 'Processing: "查一下阿明"',
      time: "10:01",
      toolSteps: [
        {
          id: "tool-1",
          title: "Query local People",
          status: "done",
          tool: "people_tool_query",
          observation: "找到 1 位关联人物：阿明",
        },
      ],
      answer:
        'Tool observation:\n找到 1 位关联人物：阿明\nTool data:\n```json\n{"rows":[{"name":"阿明","details":"完整详情"}]}\n```\n\n阿明是你本地 People 中的朋友。',
    }

    render(<CuratorMessageBubble message={message} onOpenContextMenu={noopContextMenu} />)

    expect(screen.getByText("people_tool_query")).toBeInTheDocument()
    expect(screen.getByText("找到 1 位关联人物：阿明")).toBeInTheDocument()
    expect(screen.getByText("阿明是你本地 People 中的朋友。")).toBeInTheDocument()
    expect(screen.queryByText(/Tool data/)).not.toBeInTheDocument()
    expect(screen.queryByText(/"rows"/)).not.toBeInTheDocument()
    expect(screen.queryByText(/完整详情/)).not.toBeInTheDocument()
  })

  it("工具步骤区域不直接展示 SQL 原始行 JSON", () => {
    const message: CuratorMessage = {
      id: "a2",
      role: "assistant",
      content: 'Processing: "我的女朋友是谁？"',
      time: "14:22",
      toolSteps: [
        {
          id: "tool-1",
          title: "Query local People",
          status: "done",
          tool: "people_tool_query",
          observation:
            'SQL query returned 1 row: [{"id":"tolin","name":"黄酥梨","relationship":"女朋友","details":"喜欢笑，还是个小吃货"}]',
        },
      ],
      answer: "你的女朋友是黄酥梨。",
    }

    render(<CuratorMessageBubble message={message} onOpenContextMenu={noopContextMenu} />)

    expect(screen.getByText("people_tool_query")).toBeInTheDocument()
    expect(
      screen.getByText("SQL query returned 1 row and was normalized as structured results."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/"id"/)).not.toBeInTheDocument()
    expect(screen.queryByText(/黄酥梨.*details/)).not.toBeInTheDocument()
  })

  it("展示英文 SQL 汇总观察文本", () => {
    const message: CuratorMessage = {
      id: "a2-legacy-summary",
      role: "assistant",
      content: 'Processing: "查一下"',
      time: "14:23",
      toolSteps: [
        {
          id: "tool-1",
          title: "Tool result: people_tool_query",
          status: "done",
          tool: "people_tool_query",
          observation: "SQL query returned 1 row.",
        },
      ],
      answer: "Done.",
    }

    render(<CuratorMessageBubble message={message} onOpenContextMenu={noopContextMenu} />)

    expect(screen.getByText("SQL query returned 1 row.")).toBeInTheDocument()
  })

  it("按流式片段顺序交错展示 AI 内容和工具重试", () => {
    const message: CuratorMessage = {
      id: "a3",
      role: "assistant",
      content: 'Processing: "测试工具重试"',
      time: "15:18",
      parts: [
        {
          id: "part-1",
          kind: "text",
          content: "我会先传递错误参数。",
        },
        {
          id: "part-2",
          kind: "tool",
          stepId: "tool-1",
        },
        {
          id: "part-3",
          kind: "text",
          content: "工具报错了，现在修正参数重试。",
        },
        {
          id: "part-4",
          kind: "tool",
          stepId: "tool-2",
        },
        {
          id: "part-5",
          kind: "text",
          content: "测试完成。",
        },
      ],
      toolSteps: [
        {
          id: "tool-1",
          title: "Query local People",
          status: "failed",
          tool: "people_tool_query",
          observation:
            "Tool execution failed: People SQL can only query the associated_people table",
        },
        {
          id: "tool-2",
          title: "Query local People",
          status: "done",
          tool: "people_tool_query",
          observation: "SQL query returned no rows.",
        },
      ],
      answer: "我会先传递错误参数。工具报错了，现在修正参数重试。测试完成。",
    }

    const { container } = render(
      <CuratorMessageBubble message={message} onOpenContextMenu={noopContextMenu} />,
    )
    const renderedText = container.textContent ?? ""

    expect(renderedText.indexOf("我会先传递错误参数。")).toBeLessThan(
      renderedText.indexOf(
        "Tool execution failed: People SQL can only query the associated_people table",
      ),
    )
    expect(
      renderedText.indexOf(
        "Tool execution failed: People SQL can only query the associated_people table",
      ),
    ).toBeLessThan(renderedText.indexOf("工具报错了，现在修正参数重试。"))
    expect(renderedText.indexOf("工具报错了，现在修正参数重试。")).toBeLessThan(
      renderedText.indexOf("SQL query returned no rows."),
    )
    expect(renderedText.indexOf("SQL query returned no rows.")).toBeLessThan(
      renderedText.indexOf("测试完成。"),
    )
  })

  it("用独立思考组件渲染 reasoning 片段并锁定 13px 字号", () => {
    useAiSettingsStore.setState({ showAgentThinking: true })
    const message: CuratorMessage = {
      id: "a-reasoning",
      role: "assistant",
      content: 'Processing: "分析一下"',
      time: "16:00",
      parts: [
        {
          id: "reasoning-1",
          kind: "reasoning",
          content: "# 思考标题\n先拆解问题。",
        },
        {
          id: "answer-1",
          kind: "text",
          content: "最终回答。",
        },
      ],
      answer: "最终回答。",
    }

    render(<CuratorMessageBubble message={message} onOpenContextMenu={noopContextMenu} />)

    // 思考内容默认折叠，点击展开
    const toggleButton = screen.getByText("Thought Process")
    fireEvent.click(toggleButton)

    const thinkingBlock = screen.getByTestId("curator-thinking-block")

    expect(thinkingBlock).toHaveTextContent("# 思考标题")
    expect(thinkingBlock).toHaveTextContent("先拆解问题。")
    expect(thinkingBlock).not.toHaveTextContent("最终回答。")
    expect(screen.getByText("最终回答。")).toBeInTheDocument()
    expect(thinkingBlock).toHaveClass("curator-thinking-block")
    expect(thinkingBlock).toHaveStyle({ fontSize: "13px" })
  })

  it("正文里重复出现的 reasoning 段落只展示一次", () => {
    useAiSettingsStore.setState({ showAgentThinking: true })
    const message: CuratorMessage = {
      id: "a-reasoning-duplicate",
      role: "assistant",
      content: 'Processing: "我的女朋友是谁"',
      time: "16:01",
      parts: [
        {
          id: "reasoning-1",
          kind: "reasoning",
          content:
            "用户问女朋友是谁。根据查询结果，用户的女朋友是黄酥梨（也叫 tolin）。我可以直接用中文回答这个问题。",
        },
        {
          id: "answer-1",
          kind: "text",
          content:
            "问女朋友是谁。根据查询结果，用户的女朋友是黄酥梨（也叫 tolin）。我可以直接用中文回答这个问题。\n\n你的女朋友是黄酥梨。",
        },
      ],
      answer:
        "问女朋友是谁。根据查询结果，用户的女朋友是黄酥梨（也叫 tolin）。我可以直接用中文回答这个问题。\n\n你的女朋友是黄酥梨。",
    }

    const { container } = render(
      <CuratorMessageBubble message={message} onOpenContextMenu={noopContextMenu} />,
    )

    // 思考内容默认折叠，点击展开以包含在 textContent 中
    const toggleButton = screen.getByText("Thought Process")
    fireEvent.click(toggleButton)

    const renderedText = container.textContent ?? ""

    expect(renderedText.match(/根据查询结果，用户的女朋友是黄酥梨/g)).toHaveLength(1)
    expect(screen.getByText("你的女朋友是黄酥梨。")).toBeInTheDocument()
  })

  it("工具前后重复出现的普通文本思考段落只展示一次", () => {
    const repeatedThinking =
      "问女朋友是谁，我从数据库中查到了。让我整理一下信息来回答用户。\n\n从查询结果看，用户的女朋友是：\n\n姓名：黄酥梨（别名 tolin）\n关系：女朋友\n状态：温柔可爱，善解人意\n生日：1月13日\n标签：温柔、可爱、善解人意、小吃货、爱笑、心头肉\n我应该简洁地回答这个问题，可以提及她的名字和基本特征。"
    const message: CuratorMessage = {
      id: "a-text-duplicate",
      role: "assistant",
      content: 'Processing: "我的女朋友是谁"',
      time: "16:02",
      parts: [
        {
          id: "thinking-text-1",
          kind: "text",
          content: repeatedThinking,
        },
        {
          id: "tool-1",
          kind: "tool",
          stepId: "tool-1",
        },
        {
          id: "answer-text-1",
          kind: "text",
          content: `${repeatedThinking}\n\n你的女朋友是黄酥梨。`,
        },
      ],
      toolSteps: [
        {
          id: "tool-1",
          title: "Tool result: people_tool_query",
          status: "done",
          tool: "people_tool_query",
          observation: "SQL query returned 1 row.",
        },
      ],
      answer: `${repeatedThinking}\n\n你的女朋友是黄酥梨。`,
    }

    const { container } = render(
      <CuratorMessageBubble message={message} onOpenContextMenu={noopContextMenu} />,
    )
    const renderedText = container.textContent ?? ""

    expect(renderedText.match(/问女朋友是谁，我从数据库中查到了/g)).toHaveLength(1)
    expect(screen.getByText("你的女朋友是黄酥梨。")).toBeInTheDocument()
    expect(screen.getByText("people_tool_query")).toBeInTheDocument()
  })

  it("工具前后重复出现的 reasoning 片段只展示一次", () => {
    useAiSettingsStore.setState({ showAgentThinking: true })
    const repeatedReasoning =
      "用户问我的女朋友是谁，我通过people_tool_query查询了relationship为女朋友的人员，找到了1条记录。"
    const message: CuratorMessage = {
      id: "a-reasoning-tool-duplicate",
      role: "assistant",
      content: 'Processing: "我的女朋友是谁"',
      time: "16:03",
      parts: [
        {
          id: "reasoning-before-tool",
          kind: "reasoning",
          content: repeatedReasoning,
        },
        {
          id: "tool-1",
          kind: "tool",
          stepId: "tool-1",
        },
        {
          id: "reasoning-after-tool",
          kind: "reasoning",
          content: repeatedReasoning,
        },
        {
          id: "answer-text-1",
          kind: "text",
          content: "你的女朋友是黄酥梨。",
        },
      ],
      toolSteps: [
        {
          id: "tool-1",
          title: "Tool result: people_tool_query",
          status: "done",
          tool: "people_tool_query",
          observation: "SQL query returned 1 row.",
        },
      ],
      answer: "你的女朋友是黄酥梨。",
    }

    render(<CuratorMessageBubble message={message} onOpenContextMenu={noopContextMenu} />)

    expect(screen.getAllByText("Thought Process")).toHaveLength(1)
    expect(screen.getByText("你的女朋友是黄酥梨。")).toBeInTheDocument()
    expect(screen.getByText("people_tool_query")).toBeInTheDocument()
  })

  it("消息仍在生成时已结束的 reasoning 显示完成态", () => {
    useAiSettingsStore.setState({ showAgentThinking: true })
    const message: CuratorMessage = {
      id: "a-reasoning-done-while-generating",
      role: "assistant",
      content: 'Processing: "分析一下"',
      time: "16:04",
      parts: [
        {
          id: "reasoning-1",
          kind: "reasoning",
          content: "先分析问题。",
          status: "done",
        },
        {
          id: "answer-1",
          kind: "text",
          content: "正在输出最终回答。",
        },
      ],
      answer: "正在输出最终回答。",
    }

    const { container } = render(
      <CuratorMessageBubble
        message={message}
        isGenerating={true}
        onOpenContextMenu={noopContextMenu}
      />,
    )

    expect(screen.getByText("Thought Process")).toBeInTheDocument()
    expect(screen.queryByText("Thinking")).not.toBeInTheDocument()
    expect(container.querySelector(".animate-ping")).toBeInTheDocument()
  })

  it("正在生成中时展示 loading 动画/指示器而不是具体的发送时间", () => {
    const message: CuratorMessage = {
      id: "a4",
      role: "assistant",
      content: 'Processing: "正在回复中"',
      time: "18:22",
      answer: "回复内容",
    }

    const { container } = render(
      <CuratorMessageBubble
        message={message}
        isGenerating={true}
        onOpenContextMenu={noopContextMenu}
      />,
    )

    // 不应该展示具体的发送时间
    expect(screen.queryByText("18:22")).not.toBeInTheDocument()

    // 应该包含 animate-ping 动画效果相关的 span
    const pingSpan = container.querySelector(".animate-ping")
    expect(pingSpan).toBeInTheDocument()
  })

  it("用户消息包含图片时，图片应渲染在用户提示词的上方，且具有固定的正方形类名", () => {
    const message: CuratorMessage = {
      id: "u1-images",
      role: "user",
      content: "帮我看看这张图",
      time: "10:15",
      parts: [
        {
          id: "p1",
          kind: "image",
          url: "mc-img://chat/test.png",
        },
      ],
    }

    const { container } = render(
      <CuratorMessageBubble message={message} onOpenContextMenu={noopContextMenu} />,
    )

    // 应该渲染图片组件
    const img = container.querySelector("img")
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute("src", "mc-img://chat/test.png")

    // 图片包裹层应该拥有 w-16 h-16 样式类
    const imgWrapper = img?.closest(".w-16.h-16")
    expect(imgWrapper).toBeInTheDocument()

    // 图片容器应该在文本（帮我看看这张图）的前面（也就是上方）
    const msgBubble = container.querySelector(".group\\/msg-bubble")
    expect(msgBubble).toBeInTheDocument()

    const children = Array.from(msgBubble?.children || [])
    const imgContainerIdx = children.findIndex((child) => child.querySelector("img"))
    const textIdx = children.findIndex((child) => child.textContent?.includes("帮我看看这张图"))

    expect(imgContainerIdx).toBeGreaterThan(-1)
    expect(textIdx).toBeGreaterThan(-1)
    expect(imgContainerIdx).toBeLessThan(textIdx) // 图片在文本的前面，也即上方
  })

  it("助手消息包含模型时，时间右侧应正确显示模型名称", () => {
    const message: CuratorMessage = {
      id: "a1-model",
      role: "assistant",
      content: "你好，我是 AI 助手",
      time: "10:15",
      model: "gpt-4o",
    }

    const { getByText } = render(
      <CuratorMessageBubble message={message} onOpenContextMenu={noopContextMenu} />,
    )

    const modelSpan = getByText("gpt-4o")
    expect(modelSpan).toBeInTheDocument()
  })

  it("用户消息包含提及的 agent 时，展示其为 @agent名称[agent] 格式", () => {
    const message: CuratorMessage = {
      id: "u1-agent",
      role: "user",
      content: "帮我查一下",
      time: "10:15",
      parts: [
        {
          id: "p1",
          kind: "agent",
          agentId: "people",
        },
      ],
    }

    const { getByText } = render(
      <CuratorMessageBubble message={message} onOpenContextMenu={noopContextMenu} />,
    )

    const agentTag = getByText("@people[tool]")
    expect(agentTag).toBeInTheDocument()
  })
})
