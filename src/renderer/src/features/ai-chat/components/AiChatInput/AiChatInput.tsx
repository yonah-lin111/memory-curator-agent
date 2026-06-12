import type React from "react";
import { Paperclip, RotateCcw, SendHorizontal, SlidersHorizontal } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import type { AiChatInputProps } from "@/features/ai-chat/components/AiChatInput/types";
import { useAiChatInput } from "@/features/ai-chat/components/AiChatInput/hooks/useAiChatInput";
import { AttachmentPreview } from "@/features/ai-chat/components/AiChatInput/AttachmentPreview";
import { ContextUsageCircle } from "@/features/ai-chat/components/AiChatInput/components/ContextUsageCircle";
import { MentionCommandPanels } from "@/features/ai-chat/components/AiChatInput/components/MentionCommandPanels";
import { TEXTAREA_MIN_ROWS } from "@/features/ai-chat/components/AiChatInput/constants";

/**
 * AiChatInput - AI 对话底部输入区域组件，包含模型切换、文本输入与辅助功能。
 *
 * 通过使用 `useAiChatInput` 钩子，将业务状态与键盘、拖拽交互完全分离。
 */
export const AiChatInput = (props: AiChatInputProps): React.JSX.Element => {
  const {
    textareaRef,
    fileInputRef,
    inputText,
    selectedImages,
    selectedTextFiles,
    isCommandPanelOpen,
    isDragging,
    activeCommandIndex,
    activeModelIndex,
    activeAgentIndex,
    promptHistory,
    isBrowsingHistory,
    historyCursorRef,

    // 计算属性
    selectedModelValue,
    isImageSupported,
    matchedCommands,
    isModelMode,
    matchedModels,
    matchedAgentMentions,
    isAgentPanelOpen,
    canSend,
    hasModelOptions,
    selectOptions,

    // 修改方法
    setSelectedImages,
    setSelectedTextFiles,
    setActiveCommandIndex,
    setActiveModelIndex,
    setActiveAgentIndex,

    // 回调
    handleInputChange,
    handleKeyDown,
    handleTextareaCursorMove,
    handlePaste,
    handleContainerClick,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleAttachmentClick,
    handleClearInput,
    handleSend,
    executeCommand,
    selectModel,
    selectAgentMention,
    handleCommandPanelKeyDown,
    handleModelPanelKeyDown,
    handleModelChange,
    handleUploadFilesProxy,
  } = useAiChatInput(props);

  return (
    <div className="flex-shrink-0 p-3 bg-black/5">
      <div
        data-testid="ai-chat-input-container"
        onClick={handleContainerClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative rounded-[6px] border border-white/5 bg-white/[0.01] p-2 flex flex-col gap-2"
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept={
            isImageSupported
              ? "image/*,.txt,.md,.json,.csv,.log,.xml,.yaml,.yml,.toml,.ini,.cfg,.conf,.env,.sh,.bash,.zsh,.py,.js,.ts,.jsx,.tsx,.html,.css,.scss,.less,.sql,.java,.c,.cpp,.h,.hpp,.rs,.go,.rb,.php,.swift,.kt,.scala,.r,.lua,.pl,.pm,.bat,.ps1"
              : ".txt,.md,.json,.csv,.log,.xml,.yaml,.yml,.toml,.ini,.cfg,.conf,.env,.sh,.bash,.zsh,.py,.js,.ts,.jsx,.tsx,.html,.css,.scss,.less,.sql,.java,.c,.cpp,.h,.hpp,.rs,.go,.rb,.php,.swift,.kt,.scala,.r,.lua,.pl,.pm,.bat,.ps1"
          }
          className="hidden"
          onChange={handleUploadFilesProxy}
        />

        {isDragging && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[6px] border-2 border-dashed border-white/20 bg-black/90 backdrop-blur-xs text-white/90 pointer-events-none">
            <Paperclip className="h-6 w-6 mb-2 animate-bounce" />
            <span className="text-xs font-medium">
              松手即可上传图片或文本文件
            </span>
          </div>
        )}

        {/* 整合的命令提示面板 */}
        <MentionCommandPanels
          isCommandPanelOpen={isCommandPanelOpen}
          matchedCommands={matchedCommands}
          activeCommandIndex={activeCommandIndex}
          onActiveCommandIndexChange={setActiveCommandIndex}
          onCommandSelect={executeCommand}
          onCommandPanelKeyDown={handleCommandPanelKeyDown}

          isModelMode={isModelMode}
          matchedModels={matchedModels}
          activeModelIndex={activeModelIndex}
          onActiveModelIndexChange={setActiveModelIndex}
          onModelSelect={selectModel}
          onModelPanelKeyDown={handleModelPanelKeyDown}

          isAgentPanelOpen={isAgentPanelOpen}
          matchedAgentMentions={matchedAgentMentions}
          activeAgentIndex={activeAgentIndex}
          onActiveAgentIndexChange={setActiveAgentIndex}
          onAgentSelect={selectAgentMention}
        />

        {/* 使用提取出来的附件预览子组件 */}
        <AttachmentPreview
          selectedImages={selectedImages}
          selectedTextFiles={selectedTextFiles}
          onRemoveImage={(idx) =>
            setSelectedImages((prev) => prev.filter((_, i) => i !== idx))
          }
          onRemoveTextFile={(idx) =>
            setSelectedTextFiles((prev) => prev.filter((_, i) => i !== idx))
          }
        />

        {/* 输入框 */}
        <textarea
          ref={textareaRef}
          rows={TEXTAREA_MIN_ROWS}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={handleTextareaCursorMove}
          onKeyUp={handleTextareaCursorMove}
          onPaste={handlePaste}
          placeholder="输入您的问题..."
          aria-label="AI Chat Input Area"
          className="w-full bg-transparent text-sm text-white placeholder:text-white/20 outline-none resize-none leading-relaxed px-1 transition-[height] duration-200 ease-out"
        />

        {/* 工具栏与发送按钮 */}
        <div className="flex items-center justify-between">
          {/* 左侧附加操作 */}
          <div className="flex min-w-0 items-center gap-2">
            <Select
              value={selectedModelValue}
              onChange={handleModelChange}
              options={selectOptions}
              position="up"
              bgClass="bg-[#303030]"
              disabled={!hasModelOptions}
              className="!w-fit max-w-[220px]"
            />
            {/* 上下文环形进度进度 */}
            <ContextUsageCircle
              contextUsagePercent={props.contextUsagePercent}
              contextTokens={props.contextTokens}
              contextLimit={props.contextLimit}
            />
            <IconButton
              aria-label="Add attachment"
              onClick={handleAttachmentClick}
              className={
                isImageSupported
                  ? "text-white/80 hover:text-white"
                  : "text-white/30 hover:text-white/50"
              }
            >
              <Paperclip className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              aria-label="Set tool mode"
              disabled
              className="text-white/30 cursor-not-allowed"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </IconButton>
          </div>

          {/* 右侧发送与清空按钮 */}
          <div className="flex items-center gap-1.5">
            {isBrowsingHistory && (
              <span className="text-xs text-white/45 select-none mr-0.5">
                {`History: ${historyCursorRef.current! + 1}/${promptHistory.length}`}
              </span>
            )}
            <button
              type="button"
              aria-label="Clear input"
              onClick={handleClearInput}
              disabled={!inputText}
              className={`h-6 w-6 rounded-full flex items-center justify-center bg-transparent transition-colors ${
                inputText
                  ? "text-white/45 hover:text-white"
                  : "text-white/10 cursor-not-allowed"
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <IconButton
              aria-label="Send message"
              onClick={handleSend}
              disabled={!canSend}
              highlighted={canSend}
              className={`rounded-full flex items-center justify-center transition-all ${
                canSend
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              <SendHorizontal className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
};
