import type React from "react"
import { useEffect, useState } from "react"

interface OverlayWorkspaceProps {
  /** 当前激活的 overlay，null 表示关闭 */
  activeOverlay: "chat" | "prompts" | null
  /** 聊天区渲染内容 */
  chatContent: React.ReactNode
  /** 提示词设计区渲染内容 */
  promptsContent: React.ReactNode
}

/**
 * 通用的覆盖层工作区容器
 * 采用统一的过渡动画展示上层应用（如 AI 聊天、提示词设计），覆盖主页面
 */
export const OverlayWorkspace = ({
  activeOverlay,
  chatContent,
  promptsContent,
}: OverlayWorkspaceProps): React.JSX.Element => {
  const [renderChat, setRenderChat] = useState(activeOverlay === "chat")
  const [renderPrompts, setRenderPrompts] = useState(activeOverlay === "prompts")

  // 延迟卸载未激活的内容以保留退出动画
  useEffect(() => {
    if (activeOverlay === "chat") setRenderChat(true)
    if (activeOverlay === "prompts") setRenderPrompts(true)

    let timeout: ReturnType<typeof setTimeout>
    if (activeOverlay !== "chat") {
      timeout = setTimeout(() => setRenderChat(false), 300)
    }
    return () => clearTimeout(timeout)
  }, [activeOverlay])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    if (activeOverlay !== "prompts") {
      timeout = setTimeout(() => setRenderPrompts(false), 300)
    }
    return () => clearTimeout(timeout)
  }, [activeOverlay])

  return (
    <>
      {/* 聊天覆盖层 */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ease-out z-10 ${
          activeOverlay === "chat"
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        aria-hidden={activeOverlay !== "chat"}
      >
        {renderChat && chatContent}
      </div>

      {/* 提示词设计覆盖层 */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ease-out z-10 ${
          activeOverlay === "prompts"
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        aria-hidden={activeOverlay !== "prompts"}
      >
        {renderPrompts && promptsContent}
      </div>
    </>
  )
}
