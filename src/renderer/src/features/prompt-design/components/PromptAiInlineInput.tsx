import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { RotateCcw, SendHorizontal, FileText } from "lucide-react";
import { CommandPanel } from "@/components/ai-shared/CommandPanel";
import { IconButton } from "@/components/ui/IconButton";
import { Tag } from "@/components/ui/Tag";

import { useFileMention } from "@/features/prompt-design/hooks/useFileMention";
import type { usePromptAiChatController } from "@/features/prompt-design/components/usePromptAiChatController";

type InlineInputPosition = { left: number; top: number | "auto"; bottom: number | "auto" };
type PanelDirection = "up" | "down";
type PromptAiInlineInputProps = {
  view: EditorView | null;
  controller: ReturnType<typeof usePromptAiChatController>;
  onClose: () => void;
};

/**
 * 在编辑器光标附近提供轻量提示词 AI 输入，发送复用当前会话控制器。
 */
export const PromptAiInlineInput = ({
  view,
  controller,
  onClose,
}: PromptAiInlineInputProps): React.JSX.Element | null => {
  const [inputText, setInputText] = useState("");
  const [position, setPosition] = useState<InlineInputPosition | null>(null);
  const [panelDirection, setPanelDirection] = useState<PanelDirection>("down");
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mention = useFileMention(inputText, setInputText, textareaRef, () => undefined);

  const restoreEditorFocus = useCallback((): void => {
    onClose();
    requestAnimationFrame(() => {
      view?.focus();
    });
  }, [onClose, view]);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent): void => {
      // 命令面板位于浮层内部，点击候选项不应触发关闭。
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        restoreEditorFocus();
      }
    };
    document.addEventListener("pointerdown", handleClickOutside, true);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside, true);
    };
  }, [restoreEditorFocus]);

  const handleSend = useCallback((): void => {
    const text = inputText.trim();
    if (!text || controller.isGenerating) return;
    void controller.sendMessage(text, undefined, { references: controller.references });
    setInputText("");
    mention.closeFileMentionPanel();
    restoreEditorFocus();
  }, [controller, inputText, mention, restoreEditorFocus]);

  useLayoutEffect(() => {
    if (!view) return;
    const coords = view.coordsAtPos(view.state.selection.main.head);
    if (!coords) return;
    const width = Math.min(360, window.innerWidth - 16);
    const left = Math.min(Math.max(coords.left, 8), window.innerWidth - width - 8);

    // 输入框本身大致高度
    const inputHeight = 96;
    // 命令面板最大高度大约 30vh（使用像素估计，比如窗口高度的 30% 或者保守估算为 250px）
    const panelMaxHeight = Math.min(250, window.innerHeight * 0.3);

    const spaceBelow = window.innerHeight - coords.bottom;

    // 判断输入框上下方空间，并记录最终决定的悬浮位置（相对视口）
    let renderTop: number | "auto" = "auto";
    let renderBottom: number | "auto" = "auto";

    // 如果下方空间足够放下输入框，优先放下方
    if (spaceBelow >= inputHeight + 8) {
      renderTop = coords.bottom + 8;
      renderBottom = "auto";
    } else {
      // 否则放上方
      renderTop = "auto";
      renderBottom = window.innerHeight - coords.top + 8;
    }
    setPosition({ left, top: renderTop, bottom: renderBottom });

    // 计算面板应该向上还是向下展开
    // 计算输入框渲染后的实际上下可用空间
    const inputActualTop = renderTop !== "auto" ? renderTop : window.innerHeight - (renderBottom as number) - inputHeight;
    const inputActualBottom = renderTop !== "auto" ? renderTop + inputHeight : window.innerHeight - (renderBottom as number);

    const actualSpaceBelow = window.innerHeight - inputActualBottom;
    const actualSpaceAbove = inputActualTop;

    // 优先展示在能容纳面板的一侧；若下方空间足够容纳面板，则向下展开；若下方不足但上方充足，则向上展开；否则选空间更大的一侧。
    if (actualSpaceBelow >= panelMaxHeight + 8) {
      setPanelDirection("down");
    } else if (actualSpaceAbove >= panelMaxHeight + 8) {
      setPanelDirection("up");
    } else {
      setPanelDirection(actualSpaceBelow >= actualSpaceAbove ? "down" : "up");
    }

    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [view]);

  if (!position) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-[110] flex w-[min(360px,calc(100vw-16px))] flex-col gap-2 rounded-[6px] border border-white/10 bg-[#212121] p-2 shadow-2xl"
      style={position}
    >
      <CommandPanel
        isOpen={mention.isFilePanelOpen}
        ariaLabel="文件提及"
        items={mention.matchedFiles.map((path) => ({ id: path, path }))}
        activeIndex={mention.activeFileIndex}
        onActiveIndexChange={mention.setActiveFileIndex}
        onItemSelect={(item) => mention.selectFileMention(item.path)}
        renderItem={(item) => {
          const slashIndex = item.path.lastIndexOf("/");
          const name = slashIndex < 0 ? item.path : item.path.slice(slashIndex + 1);
          const directory = slashIndex < 0 ? "" : item.path.slice(0, slashIndex);
          return (
            <div className="flex w-full items-center gap-2 overflow-hidden py-0.5">
              <FileText className="h-4 w-4 shrink-0 opacity-50" />
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-white">{name}</div>
                {directory && <div className="truncate text-xs text-white/35">{directory}</div>}
              </div>
            </div>
          );
        }}
        idPrefix="prompt-inline-file-mention"
        style={panelDirection === "down" ? { top: "calc(100% + 8px)", bottom: "auto" } : { bottom: "calc(100% + 8px)", top: "auto" }}
      />
      {controller.references.length > 0 && <div className="flex flex-wrap gap-1 px-1">{controller.references.map((reference) => <Tag key={reference.id} size="small" onClose={() => controller.setReferences((items) => items.filter((item) => item.id !== reference.id))}>第{reference.startLine}–{reference.endLine}行</Tag>)}</div>}
      <textarea
        ref={textareaRef}
        rows={2}
        value={inputText}
        onChange={(event) => {
          const next = event.target.value;
          setInputText(next);
          mention.syncFileMentionPanel(next, event.target.selectionStart);
        }}
        onKeyDown={(event) => {
          mention.handleKeyDown(event);
          if (event.defaultPrevented) return;
          if (event.key === "Escape") {
            event.preventDefault();
            restoreEditorFocus();
          } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            handleSend();
          }
        }}
        onCompositionStart={mention.handleCompositionStart}
        onCompositionEnd={mention.handleCompositionEnd}
        placeholder="输入要调整提示词的内容..."
        className="w-full resize-none bg-transparent px-1 text-sm leading-relaxed text-white outline-none placeholder:text-white/20"
      />
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          aria-label="清空输入"
          disabled={!inputText}
          onClick={() => { setInputText(""); mention.closeFileMentionPanel(); }}
          className={`flex h-6 w-6 items-center justify-center rounded-full bg-transparent transition-colors ${inputText ? "text-white/45 hover:text-white" : "cursor-not-allowed text-white/10"}`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <IconButton
          aria-label="发送消息"
          disabled={!inputText.trim() || controller.isGenerating}
          highlighted={Boolean(inputText.trim())}
          onClick={handleSend}
          className={`flex items-center justify-center rounded-full transition-all ${inputText.trim() ? "bg-white text-black hover:bg-white/90" : "cursor-not-allowed bg-white/10 text-white/30"}`}
        >
          <SendHorizontal className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  );
};
