import type React from "react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type {
  CuratorAskAnswerSubmitPayload,
  CuratorToolConfirmationAnswerSubmitPayload,
} from "@/components/ai-shared/AskRequestPanel"
import { LoadingOverlay } from "@/components/ui/LoadingOverlay"
import { useToast } from "@/components/ui/Toast"
import {
  CuratorInput,
  type CuratorInputCommandId,
} from "@/features/curator/components/CuratorInput"
import {
  CuratorMessageBubble,
  type CuratorMessageContextMenuRequest,
} from "@/features/curator/components/CuratorMessageBubble"
import { CuratorMessageContextMenu } from "@/features/curator/components/CuratorMessageContextMenu"
import { isEmptyCuratorDraftSession } from "@/features/curator/core/curatorSessionReducer"
import type { CuratorSendPayload } from "@/features/curator/curatorAgentMentions"
import {
  buildMessageContextItems,
  type CuratorContextItem,
  getCuratorContextBudget,
} from "@/features/curator/curatorContextBuilder"
import { useCuratorContextStore } from "@/features/curator/curatorContextStore"
import type {
  CuratorModelProviderOption,
  CuratorModelSelection,
  CuratorSession,
} from "@/features/curator/types"

// 空上下文数组，避免 Zustand selector 在空态返回新引用。
const EMPTY_CONTEXT_ITEMS: CuratorContextItem[] = []

// 最新 AI 回答贴近视口顶部时保留的视觉间距。
const LATEST_ASSISTANT_TOP_OFFSET = 4

// 加速滚动动画时长，放慢末段滚动避免突兀冲刺。
const ACCELERATED_SCROLL_DURATION_MS = 250

/**
 * calculateBottomSpacerHeight - 计算置顶问题后需要保留的最小底部空间。
 */
const calculateBottomSpacerHeight = (
  container: HTMLDivElement,
  userMessage: HTMLDivElement,
  currentSpacerHeight: number,
): number => {
  const viewportHeight = container.clientHeight
  const targetScrollTop = Math.max(userMessage.offsetTop - LATEST_ASSISTANT_TOP_OFFSET, 0)

  return Math.round(
    Math.max(0, targetScrollTop + viewportHeight - container.scrollHeight + currentSpacerHeight),
  )
}

/**
 * copyTextToClipboard - 写入系统剪贴板，兼容缺失 Clipboard API 的运行时。
 */
const copyTextToClipboard = async (content: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = content
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  document.body.removeChild(textarea)
}

// AI 对话工作区组件属性类型。
type CuratorWorkspaceProps = {
  // AI 对话模式是否打开。
  isChatOpen?: boolean
  // 当前激活的 AI 会话。
  session: CuratorSession
  // 可切换的 AI provider 与模型列表。
  modelOptions: CuratorModelProviderOption[]
  // 当前选中的 AI provider 与模型。
  selectedModel: CuratorModelSelection | null
  // 发送消息回调。
  onSendMessage: (payload: CuratorSendPayload) => void
  // 提交 Ask 回答回调。
  onSubmitAskAnswer: (payload: CuratorAskAnswerSubmitPayload) => void | Promise<void>
  // 提交工具确认回答回调。
  onSubmitToolConfirmationAnswer?: (
    payload: CuratorToolConfirmationAnswerSubmitPayload,
  ) => void | Promise<void>
  // 重新生成最新 AI 回答回调。
  onRegenerateLatestAnswer: () => void
  // 编辑并重新发送用户消息回调。
  onEditAndResendUserMessage?: (messageId: string, text: string) => void | Promise<void>
  // 删除指定消息所属 QA 回调。
  onDeleteChatTurn: (messageId: string) => void
  // 执行输入框命令回调。
  onCommandExecute: (command: CuratorInputCommandId) => void
  // AI 模型切换回调。
  onModelChange: (selection: CuratorModelSelection) => void
  // 取消当前 AI 生成回调。
  onCancelGeneration?: () => void
  // AI 会话列表。
  chatSessions?: CuratorSession[]
  // AI 激活会话切换回调.
  onActiveSessionChange?: (sessionId: string) => void
  // 是否还有更多会话。
  hasMoreChatSessions?: boolean
  // 是否正在加载更多会话。
  isLoadingMoreChatSessions?: boolean
  // 加载更多历史会话回调。
  onLoadMoreChatSessions?: () => Promise<void>
}

/**
 * CuratorWorkspace - 负责渲染 Header 下方的 AI 对话主体工作区。
 */
export const CuratorWorkspace = ({
  isChatOpen = false,
  session,
  modelOptions,
  selectedModel,
  onSendMessage,
  onSubmitAskAnswer,
  onSubmitToolConfirmationAnswer,
  onRegenerateLatestAnswer,
  onEditAndResendUserMessage,
  onDeleteChatTurn,
  onCommandExecute,
  onModelChange,
  onCancelGeneration,
  chatSessions,
  onActiveSessionChange,
  hasMoreChatSessions,
  isLoadingMoreChatSessions,
  onLoadMoreChatSessions,
}: CuratorWorkspaceProps): React.JSX.Element => {
  // 消息滚动容器引用。
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  // 消息底部哨兵节点引用。
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // 最新用户消息外层节点引用。
  const latestUserMessageRef = useRef<HTMLDivElement>(null)
  // 需要置顶显示的最新用户消息标识。
  const [topPinnedUserId, setTopPinnedUserId] = useState<string | null>(null)
  // 动态底部间距高度，确保最新用户消息置顶时，AI 回答底部刚好贴合视口底部。
  const [bottomSpacerHeight, setBottomSpacerHeight] = useState<number>(0)
  // 当前打开的消息右键菜单；工作区内只允许存在一个菜单实例。
  const [messageContextMenu, setMessageContextMenu] =
    useState<CuratorMessageContextMenuRequest | null>(null)
  // 双击 Esc 取消状态：idle = 初始，pending = 第一次按下等待二次确认。
  const escCancelStateRef = useRef<"idle" | "pending">("idle")
  // 双击 Esc 超时计时器。
  const escCancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toast = useToast()
  const syncMessageItems = useCuratorContextStore((state) => state.syncMessageItems)
  const contextItems = useCuratorContextStore(
    (state) => state.sessionItems[session.id] ?? EMPTY_CONTEXT_ITEMS,
  )
  const messageContextItems = useMemo(
    () => buildMessageContextItems(session.id, session.messages),
    [session.id, session.messages],
  )
  const contextBudget = useMemo(
    () =>
      getCuratorContextBudget({
        items: contextItems,
        modelOptions,
        selectedModel,
      }),
    [contextItems, modelOptions, selectedModel],
  )
  const latestAssistantMessageId = useMemo(() => {
    for (let index = session.messages.length - 1; index >= 0; index -= 1) {
      const message = session.messages[index]
      if (message.role === "assistant") {
        return message.id
      }
    }

    return null
  }, [session.messages])
  // 仅保存当前打开会话中刚完成生成的助手消息标识。
  const [suggestedQuestionMessageId, setSuggestedQuestionMessageId] = useState<string | null>(null)
  // 手动刷新建议问题时递增，用于通知对应消息气泡重新请求。
  const [suggestedQuestionGenerationVersion, setSuggestedQuestionGenerationVersion] = useState(0)
  const previousSuggestedQuestionSessionRef = useRef({
    id: session.id,
    status: session.status,
  })

  useEffect(() => {
    const previous = previousSuggestedQuestionSessionRef.current
    const isSameSession = previous.id === session.id
    const hasJustCompleted =
      isChatOpen && isSameSession && previous.status === "running" && session.status === "completed"

    if (hasJustCompleted) {
      setSuggestedQuestionMessageId(latestAssistantMessageId)
    } else if (!isSameSession || session.status !== "completed" || !isChatOpen) {
      setSuggestedQuestionMessageId(null)
    }

    previousSuggestedQuestionSessionRef.current = {
      id: session.id,
      status: session.status,
    }
  }, [isChatOpen, latestAssistantMessageId, session.id, session.status])
  const latestUserMessageId = useMemo(() => {
    for (let index = session.messages.length - 1; index >= 0; index -= 1) {
      const message = session.messages[index]
      if (message.role === "user") {
        return message.id
      }
    }

    return null
  }, [session.messages])

  // 记录上一次的 session.id 与消息长度。
  const prevSessionIdRef = useRef(session.id)
  const prevMessagesLengthRef = useRef(session.messages.length)
  // 记录上一次最新 AI 消息标识，覆盖重新生成时消息数量不变的场景。
  const prevLatestAssistantMessageIdRef = useRef(latestAssistantMessageId)
  // 当前加速滚动动画帧。
  const acceleratedScrollFrameRef = useRef<number | null>(null)
  // 记录已经成功滚动定位过的最新用户消息 ID。
  const prevScrolledPinnedUserIdRef = useRef<string | null>(null)
  // 标记是否锁住底部动态边距（Spacer）不进行重新计算（如在展开折叠思考内容、编辑用户消息等高度变动期间）。
  const isSpacerLockedRef = useRef(false)

  // 追踪会话切换 loading。
  const [isSwitching, setIsSwitching] = useState<boolean>(false)
  const isSwitchingRef = useRef<boolean>(false)
  const loadingStartTimeRef = useRef<number>(0)
  const switchSessionCounterRef = useRef<number>(0)

  /**
   * 结束会话切换 Loading。
   * 确保 Loading 最少显示 0.5s，并且防止快速连续切换时旧定时器对最新会话加载状态的干扰。
   */
  const finishSessionSwitchScroll = (): void => {
    if (!isSwitchingRef.current) {
      return
    }
    const currentCounter = switchSessionCounterRef.current
    const elapsed = Date.now() - loadingStartTimeRef.current
    const minLoadingTime = 500 // 0.5s
    const remainingTime = Math.max(0, minLoadingTime - elapsed)

    setTimeout(() => {
      if (switchSessionCounterRef.current === currentCounter) {
        setIsSwitching(false)
        isSwitchingRef.current = false
      }
    }, remainingTime)
  }

  // 思考内容展开折叠时屏蔽底部边距重算的回调。
  const handleThinkingBlockToggle = (): void => {
    isSpacerLockedRef.current = true
    setTimeout(() => {
      isSpacerLockedRef.current = false
    }, 350)
  }

  // 用户编辑框状态改变时，动态屏蔽底部边距重算的回调。
  const handleUserEditStateChange = (isEditing: boolean): void => {
    if (isEditing) {
      isSpacerLockedRef.current = true
    } else {
      setTimeout(() => {
        isSpacerLockedRef.current = false
      }, 350)
    }
  }

  /**
   * 获取当前消息列表中最后一条用户消息标识。
   */
  const getLatestUserMessageId = (): string | null => {
    return latestUserMessageId
  }

  /**
   * 取消未完成的加速滚动，避免连续切换会话时动画互相抢滚动条。
   */
  const cancelAcceleratedScroll = (): void => {
    if (acceleratedScrollFrameRef.current === null) {
      return
    }

    cancelAnimationFrame(acceleratedScrollFrameRef.current)
    acceleratedScrollFrameRef.current = null
  }

  /**
   * 用原生瞬时滚动写入指定位置，动画曲线由组件自行控制。
   */
  const setMessagesScrollTop = (container: HTMLDivElement, top: number): void => {
    if (typeof container.scrollTo === "function") {
      container.scrollTo({
        top,
        behavior: "auto",
      })
      return
    }

    container.scrollTop = top
  }

  /**
   * 将消息容器滚到指定位置；smooth 模式使用速度递增的 ease-in 曲线。
   */
  const scrollMessagesToPosition = (
    targetTop: number,
    behavior: ScrollBehavior,
    onComplete?: () => void,
  ): void => {
    const container = messagesContainerRef.current
    if (!container) {
      onComplete?.()
      return
    }

    cancelAcceleratedScroll()

    if (behavior !== "smooth") {
      setMessagesScrollTop(container, targetTop)
      onComplete?.()
      return
    }

    const startTop = container.scrollTop
    const distance = targetTop - startTop

    // 若目标距离接近当前滚动位置，则直接完成。
    if (Math.abs(distance) < 1) {
      setMessagesScrollTop(container, targetTop)
      onComplete?.()
      return
    }

    let startedAt: number | null = null

    /**
     * 每一帧按二次方缓入推进，距离增量会逐帧变大。
     */
    const animate = (timestamp: number): void => {
      if (startedAt === null) {
        startedAt = timestamp
      }

      const elapsed = Math.max(timestamp - startedAt, 0)
      const progress = Math.min(elapsed / ACCELERATED_SCROLL_DURATION_MS, 1)
      const easedProgress = progress ** 2
      const nextTop = startTop + distance * easedProgress
      setMessagesScrollTop(container, nextTop)

      if (progress < 1) {
        acceleratedScrollFrameRef.current = requestAnimationFrame(animate)
        return
      }

      acceleratedScrollFrameRef.current = null
      onComplete?.()
    }

    acceleratedScrollFrameRef.current = requestAnimationFrame(animate)
  }

  /**
   * 将消息容器滚动到底部。
   */
  const scrollMessagesToBottom = (behavior: ScrollBehavior, onComplete?: () => void): void => {
    const container = messagesContainerRef.current
    if (!container) {
      onComplete?.()
      return
    }

    scrollMessagesToPosition(container.scrollHeight, behavior, onComplete)
  }

  /**
   * 将最新用户问题滚动到消息视口顶部。
   */
  const scrollLatestUserToTop = (behavior: ScrollBehavior, onComplete?: () => void): void => {
    const container = messagesContainerRef.current
    const userMessage = latestUserMessageRef.current
    if (!container || !userMessage) {
      console.log("DEBUG scrollLatestUserToTop: NO CONTAINER OR USER_MESSAGE")
      onComplete?.()
      return
    }

    const targetTop = Math.max(userMessage.offsetTop - LATEST_ASSISTANT_TOP_OFFSET, 0)
    console.log("DEBUG scrollLatestUserToTop:", {
      userMessageOffsetTop: userMessage.offsetTop,
      userMessageText: userMessage.textContent,
      targetTop,
    })
    scrollMessagesToPosition(targetTop, behavior, onComplete)
  }

  // 当切换会话（session.id 变化）时，仅更新状态，滚动逻辑交由 session.id useLayoutEffect 统一处理。
  useEffect(() => {
    const latestUserMessageId = getLatestUserMessageId()
    if (latestUserMessageId) {
      setTopPinnedUserId(latestUserMessageId)
    } else {
      setTopPinnedUserId(null)
    }
  }, [session.id])

  // 当用户在当前会话发送新消息时，优先将最新用户问题置顶显示。
  useEffect(() => {
    const prevSessionId = prevSessionIdRef.current
    const prevLength = prevMessagesLengthRef.current
    const prevLatestAssistantMessageId = prevLatestAssistantMessageIdRef.current
    const currentLength = session.messages.length

    // 更新 ref 状态值
    prevSessionIdRef.current = session.id
    prevMessagesLengthRef.current = currentLength
    prevLatestAssistantMessageIdRef.current = latestAssistantMessageId

    // 如果 session.id 发生改变（切换会话），则在此不处理滚动，已由切换会话的 useEffect 处理。
    if (session.id !== prevSessionId) {
      return
    }

    if (currentLength < prevLength) {
      // 删除消息会改变最新 QA 归属，不能把旧问题重新置顶导致滚动跳动。
      setTopPinnedUserId(null)
      cancelAcceleratedScroll()
      return
    }

    // 发送和重新生成都会产生新的 AI 消息 ID；删除 QA 导致数量减少时不触发滚动。
    if (
      latestUserMessageId &&
      latestAssistantMessageId !== prevLatestAssistantMessageId &&
      currentLength >= prevLength
    ) {
      setTopPinnedUserId(latestUserMessageId)
      return
    }

    // 仅在当前会话的新增消息中包含用户消息时，触发对话定位。
    if (currentLength > prevLength) {
      const addedMessages = session.messages.slice(prevLength)
      const hasNewUserMessage = addedMessages.some((msg) => msg.role === "user")
      if (hasNewUserMessage) {
        const latestUserMessageId = getLatestUserMessageId()
        if (latestUserMessageId) {
          setTopPinnedUserId(latestUserMessageId)
          return
        }

        messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" })
      }
    }
  }, [session.messages, session.id])

  // 动态计算并更新底部间距高度。
  useLayoutEffect(() => {
    if (!topPinnedUserId) {
      setBottomSpacerHeight(0)
      return
    }

    const container = messagesContainerRef.current
    const userMessage = latestUserMessageRef.current

    if (container && userMessage) {
      setBottomSpacerHeight((prev) => {
        const requiredSpacer = calculateBottomSpacerHeight(container, userMessage, prev)

        if (Math.abs(prev - requiredSpacer) > 3) {
          return requiredSpacer
        }

        return prev
      })
    }
  }, [topPinnedUserId, session.messages.length])

  // 监听窗口尺寸变化，动态更新底部间距高度。
  useEffect(() => {
    const handleResize = () => {
      if (isSpacerLockedRef.current) {
        return
      }
      const container = messagesContainerRef.current
      const userMessage = latestUserMessageRef.current
      if (container && userMessage && topPinnedUserId) {
        setBottomSpacerHeight((prev) => {
          return calculateBottomSpacerHeight(container, userMessage, prev)
        })
      }
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [topPinnedUserId])

  // AI 回复流式渲染时，内容高度变化需要同步压缩底部 spacer，避免留下可继续滚动的空白。
  useEffect(() => {
    const container = messagesContainerRef.current
    const userMessage = latestUserMessageRef.current
    if (!topPinnedUserId || !container || !userMessage || !window.ResizeObserver) {
      return undefined
    }

    let pendingRafId: number | null = null

    const resizeObserver = new ResizeObserver(() => {
      if (isSpacerLockedRef.current) {
        return
      }

      // 同一帧内多次 resize 仅执行最后一次重算，避免与浏览器 scroll anchoring 余震形成振荡。
      if (pendingRafId !== null) {
        return
      }

      pendingRafId = requestAnimationFrame(() => {
        pendingRafId = null
        setBottomSpacerHeight((prev) => {
          const requiredSpacer = calculateBottomSpacerHeight(container, userMessage, prev)

          if (Math.abs(prev - requiredSpacer) > 3) {
            return requiredSpacer
          }

          return prev
        })
      })
    })

    const wrapper = container.firstElementChild
    const elementsToObserve = wrapper
      ? Array.from(wrapper.children)
      : Array.from(container.children)

    for (const child of elementsToObserve) {
      if (child instanceof HTMLElement && child.dataset.curatorBottomSpacer !== "true") {
        resizeObserver.observe(child)
      }
    }

    return () => {
      resizeObserver.disconnect()
      if (pendingRafId !== null) {
        cancelAnimationFrame(pendingRafId)
        pendingRafId = null
      }
    }
  }, [topPinnedUserId, session.messages.length])

  // 会话切换时统一执行滚动逻辑（useLayoutEffect 确保在浏览器绘制前完成）。
  useLayoutEffect(() => {
    const isEmptyDraft = isEmptyCuratorDraftSession(session)

    if (isEmptyDraft) {
      setIsSwitching(false)
      isSwitchingRef.current = false
      const container = messagesContainerRef.current
      if (container) {
        cancelAcceleratedScroll()
        container.scrollTop = 0
      }
      prevScrolledPinnedUserIdRef.current = null
      return
    }

    // 激活 loading 并重置/递增计数器以抵御竞态条件。
    setIsSwitching(true)
    isSwitchingRef.current = true
    loadingStartTimeRef.current = Date.now()
    switchSessionCounterRef.current += 1

    const container = messagesContainerRef.current
    if (!container) {
      return
    }

    cancelAcceleratedScroll()
    container.scrollTop = 0
    prevScrolledPinnedUserIdRef.current = null // 重置已经成功滚动定位过的用户消息 ID

    const latestUserMessageId = getLatestUserMessageId()
    if (!latestUserMessageId) {
      const animationFrame = requestAnimationFrame(() => {
        scrollMessagesToBottom("smooth", () => {
          finishSessionSwitchScroll()
        })
      })

      return () => {
        cancelAnimationFrame(animationFrame)
        cancelAcceleratedScroll()
      }
    }

    return undefined
  }, [session.id])

  // 监听 chat 打开状态，点击 Header 的聊天 icon 展开时触发 Loading。
  useEffect(() => {
    if (isChatOpen) {
      setIsSwitching(true)
      isSwitchingRef.current = true
      loadingStartTimeRef.current = Date.now()
      switchSessionCounterRef.current += 1

      const latestUserMessageId = getLatestUserMessageId()
      if (!latestUserMessageId) {
        scrollMessagesToBottom("smooth", () => {
          finishSessionSwitchScroll()
        })
      } else {
        scrollLatestUserToTop("smooth", () => {
          finishSessionSwitchScroll()
        })
      }
    } else {
      setIsSwitching(false)
      isSwitchingRef.current = false
    }
  }, [isChatOpen])

  // 补足最新用户问题底部空间后，再将其滚到视口顶部。
  useLayoutEffect(() => {
    const isDeletingMessages =
      session.id === prevSessionIdRef.current &&
      session.messages.length < prevMessagesLengthRef.current

    if (isDeletingMessages) {
      cancelAcceleratedScroll()
      prevScrolledPinnedUserIdRef.current = null
      return
    }

    // 确保置顶消息存在，且属于当前会话，避免切换会话时由于状态滞后对旧消息执行多余定位
    if (!topPinnedUserId || !session.messages.some((m) => m.id === topPinnedUserId)) {
      prevScrolledPinnedUserIdRef.current = null
      return
    }

    // 如果当前需要定位的置顶消息已经滚动定位过了，就不再重复滚动。
    if (prevScrolledPinnedUserIdRef.current === topPinnedUserId) {
      return
    }

    cancelAcceleratedScroll()

    const animationFrame = requestAnimationFrame(() => {
      scrollLatestUserToTop("smooth", () => {
        finishSessionSwitchScroll()
      })
    })

    prevScrolledPinnedUserIdRef.current = topPinnedUserId

    return () => {
      cancelAnimationFrame(animationFrame)
      cancelAcceleratedScroll()
    }
  }, [topPinnedUserId, session.messages.length])

  // 将当前消息列表同步为全局上下文中的 message 来源。
  useEffect(() => {
    syncMessageItems(session.id, messageContextItems)
  }, [messageContextItems, session.id, syncMessageItems])

  useEffect(() => {
    if (!messageContextMenu) {
      return undefined
    }

    /**
     * 关闭当前消息右键菜单。
     */
    const closeContextMenu = (): void => {
      setMessageContextMenu(null)
    }

    /**
     * 按 Escape 关闭当前消息右键菜单。
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        closeContextMenu()
      }
    }

    document.addEventListener("click", closeContextMenu)
    document.addEventListener("scroll", closeContextMenu, true)
    window.addEventListener("resize", closeContextMenu)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("click", closeContextMenu)
      document.removeEventListener("scroll", closeContextMenu, true)
      window.removeEventListener("resize", closeContextMenu)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [messageContextMenu])

  /**
   * 打开消息右键菜单；覆盖旧状态保证工作区内只存在一个菜单。
   */
  const handleOpenMessageContextMenu = (request: CuratorMessageContextMenuRequest): void => {
    setMessageContextMenu(request)
  }

  /**
   * 双击 Esc 取消生成：
   * - 第一次按 Esc 时提示用户，进入 pending 状态（2s 内有效）；
   * - 2s 内再次按 Esc 时执行取消并标记 QA 为已取消。
   */
  const handleCancelEsc = useCallback((): void => {
    if (session.status !== "running" || !onCancelGeneration) {
      return
    }

    if (escCancelStateRef.current === "idle") {
      escCancelStateRef.current = "pending"
      toast.info("再按一次 Esc 取消 AI 回答")

      if (escCancelTimerRef.current) {
        clearTimeout(escCancelTimerRef.current)
      }
      escCancelTimerRef.current = setTimeout(() => {
        escCancelStateRef.current = "idle"
        escCancelTimerRef.current = null
      }, 2000)
    } else {
      // 第二次按下：执行取消
      escCancelStateRef.current = "idle"
      if (escCancelTimerRef.current) {
        clearTimeout(escCancelTimerRef.current)
        escCancelTimerRef.current = null
      }

      onCancelGeneration()
    }
  }, [session.status, onCancelGeneration, toast])

  // 监听全局键盘事件，处理双击 Esc 取消逻辑。
  useEffect(() => {
    if (session.status !== "running") {
      // 会话不在运行中时，重置 Esc 取消状态
      escCancelStateRef.current = "idle"
      if (escCancelTimerRef.current) {
        clearTimeout(escCancelTimerRef.current)
        escCancelTimerRef.current = null
      }
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        handleCancelEsc()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [session.status, handleCancelEsc])

  /**
   * 复制当前菜单指向消息的纯文本内容。
   */
  const handleCopyText = (): void => {
    if (!messageContextMenu) {
      return
    }

    void copyTextToClipboard(messageContextMenu.plainTextContent)
    setMessageContextMenu(null)
  }

  /**
   * 复制当前菜单指向消息的 Markdown 内容。
   */
  const handleCopyMarkdown = (): void => {
    if (!messageContextMenu) {
      return
    }

    void copyTextToClipboard(messageContextMenu.markdownContent)
    setMessageContextMenu(null)
  }

  /**
   * 重新生成当前菜单指向的最新回答。
   */
  const handleRegenerate = (): void => {
    setMessageContextMenu(null)
    onRegenerateLatestAnswer()
  }

  /**
   * 触发编辑当前消息并关闭右键菜单。
   */
  const handleEdit = (): void => {
    if (!messageContextMenu || !messageContextMenu.onEdit) {
      return
    }

    messageContextMenu.onEdit()
    setMessageContextMenu(null)
  }

  /**
   * 删除当前菜单指向消息所属的 QA。
   */
  const handleDeleteQa = (): void => {
    if (!messageContextMenu) {
      return
    }

    const { messageId } = messageContextMenu
    setMessageContextMenu(null)
    onDeleteChatTurn(messageId)
  }

  return (
    <section
      aria-label="AI Chat Workspace"
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[6px] border border-white/5 bg-[#212121]"
    >
      {/* 统一会话切换优雅 Loading */}
      <LoadingOverlay isLoading={isSwitching} text="Loading session..." />

      {/* 消息区域容器：支持左右并排（两个列表）展示 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左侧：消息区域（消息列表 + 输入区域） */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* 消息列表 */}
          <div
            ref={messagesContainerRef}
            style={{
              paddingLeft: "1rem",
              paddingRight: "1rem",
            }}
            className="flex-1 relative overflow-y-auto custom-scrollbar [scrollbar-gutter:stable] [overflow-anchor:none] py-4 flex flex-col min-w-0 transition-all duration-300 ease-in-out"
          >
            <div className="max-w-[860px] mx-auto w-full flex flex-col gap-4 flex-1">
              {session.messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center p-8 select-none">
                  <div className="mb-2 text-base font-medium text-white/95">整理记忆与行动启发</div>
                  <p className="max-w-md text-xs text-white/40 leading-relaxed">
                    在此向 AI 提问。它可以基于你的 Today
                    待办、随记和日记草稿等上下文，为你梳理核心记忆线索并生成具体行动建议。
                  </p>
                </div>
              ) : (
                session.messages.map((message, index) => {
                  const isLast = index === session.messages.length - 1
                  const isGenerating =
                    isLast && session.status === "running" && message.role === "assistant"
                  const previousMessage = session.messages[index - 1]
                  const canRegenerate =
                    message.role === "assistant" &&
                    isLast &&
                    message.id === latestAssistantMessageId &&
                    previousMessage?.role === "user" &&
                    session.status !== "running"
                  const shouldPinToTop = message.id === topPinnedUserId

                  const isLastUser =
                    message.role === "user" && index === session.messages.length - 2

                  return (
                    <div key={message.id} ref={shouldPinToTop ? latestUserMessageRef : null}>
                      <CuratorMessageBubble
                        message={message}
                        isLastUser={isLastUser}
                        isGenerating={isGenerating}
                        canRegenerate={canRegenerate}
                        onSubmitAskAnswer={onSubmitAskAnswer}
                        onSubmitToolConfirmationAnswer={onSubmitToolConfirmationAnswer}
                        onOpenContextMenu={handleOpenMessageContextMenu}
                        onEditAndResendUserMessage={onEditAndResendUserMessage}
                        onThinkingBlockToggle={handleThinkingBlockToggle}
                        onToolConfirmationToggle={handleThinkingBlockToggle}
                        onUserEditStateChange={handleUserEditStateChange}
                        suggestedQuestionContext={
                          message.role === "assistant" &&
                          message.id === suggestedQuestionMessageId &&
                          message.id === latestAssistantMessageId &&
                          message.id === session.messages.at(-1)?.id
                            ? session.messages
                                .filter(
                                  (item): item is typeof item & { role: "user" | "assistant" } =>
                                    item.role === "user" || item.role === "assistant",
                                )
                                .map((item) => ({ role: item.role, content: item.content }))
                            : undefined
                        }
                        suggestedQuestionGenerationVersion={suggestedQuestionGenerationVersion}
                        onSendSuggestedQuestion={(question) =>
                          onSendMessage({ text: question, agents: [] })
                        }
                      />
                    </div>
                  )
                })
              )}
              {bottomSpacerHeight > 0 && (
                <div
                  data-curator-bottom-spacer="true"
                  style={{ height: `${bottomSpacerHeight}px` }}
                  className="flex-shrink-0"
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 输入区域 */}
          <CuratorInput
            sessionId={session.id}
            modelOptions={modelOptions}
            selectedModel={selectedModel}
            contextUsagePercent={contextBudget.usagePercent}
            contextTokens={contextBudget.totalTokens}
            contextLimit={contextBudget.contextLimit}
            isGenerating={session.status === "running"}
            onSendMessage={onSendMessage}
            onCommandExecute={(command) => {
              if (command === "suggest") {
                if (latestAssistantMessageId) {
                  setSuggestedQuestionMessageId(latestAssistantMessageId)
                  setSuggestedQuestionGenerationVersion((version) => version + 1)
                  requestAnimationFrame(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
                  })
                }
                return
              }
              onCommandExecute(command)
            }}
            onModelChange={onModelChange}
            chatSessions={chatSessions}
            onActiveSessionChange={onActiveSessionChange}
            hasMoreChatSessions={hasMoreChatSessions}
            isLoadingMoreChatSessions={isLoadingMoreChatSessions}
            onLoadMoreChatSessions={onLoadMoreChatSessions}
          />
        </div>
      </div>

      {messageContextMenu ? (
        <CuratorMessageContextMenu
          x={messageContextMenu.x}
          y={messageContextMenu.y}
          canRegenerate={messageContextMenu.canRegenerate}
          onCopyText={handleCopyText}
          onCopyMarkdown={handleCopyMarkdown}
          onRegenerate={handleRegenerate}
          onDeleteQa={handleDeleteQa}
          onEdit={messageContextMenu.onEdit ? handleEdit : undefined}
        />
      ) : null}
    </section>
  )
}
