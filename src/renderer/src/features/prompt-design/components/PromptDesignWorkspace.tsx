import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { StateEffect } from "@codemirror/state";
import { Bot } from "lucide-react";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import type { MarkdownEditorChangeBlock } from "@/components/ui/MarkdownEditor";
import { useToast } from "@/components/ui/Toast";
import { PromptAiSidebar } from "@/features/prompt-design/components/PromptAiSidebar";
import { PromptAiInlineInput } from "@/features/prompt-design/components/PromptAiInlineInput";
import { usePromptDesignStore } from "@/features/prompt-design/store/promptDesignStore";
import { usePromptAiChatController } from "@/features/prompt-design/components/usePromptAiChatController";

interface PromptDesignWorkspaceProps {
  isOpen: boolean;
  isPromptAiSidebarOpen?: boolean;
  onClosePromptAiSidebar?: () => void;
}

// 最长公共子序列中的匹配行。
type MatchedLine = {
  originalIndex: number;
  candidateIndex: number;
};

/**
 * 将空文本表示为空行数组，避免插入时引入虚假空行。
 */
const toLines = (content: string): string[] =>
  content === "" ? [] : content.split("\n");

/**
 * 找出两个文本版本中每个连续且不相交的变更块。
 */
const getChangeBlocks = (
  originalContent: string,
  candidateContent: string,
): Omit<MarkdownEditorChangeBlock, "id">[] => {
  const originalLines = toLines(originalContent);
  const candidateLines = toLines(candidateContent);
  const table = Array.from({ length: originalLines.length + 1 }, () =>
    Array<number>(candidateLines.length + 1).fill(0),
  );

  for (
    let originalIndex = originalLines.length - 1;
    originalIndex >= 0;
    originalIndex -= 1
  ) {
    for (
      let candidateIndex = candidateLines.length - 1;
      candidateIndex >= 0;
      candidateIndex -= 1
    ) {
      table[originalIndex][candidateIndex] =
        originalLines[originalIndex] === candidateLines[candidateIndex]
          ? table[originalIndex + 1][candidateIndex + 1] + 1
          : Math.max(
              table[originalIndex + 1][candidateIndex],
              table[originalIndex][candidateIndex + 1],
            );
    }
  }

  const matches: MatchedLine[] = [];
  let originalIndex = 0;
  let candidateIndex = 0;
  while (
    originalIndex < originalLines.length &&
    candidateIndex < candidateLines.length
  ) {
    if (originalLines[originalIndex] === candidateLines[candidateIndex]) {
      matches.push({ originalIndex, candidateIndex });
      originalIndex += 1;
      candidateIndex += 1;
    } else if (
      table[originalIndex + 1][candidateIndex] >=
      table[originalIndex][candidateIndex + 1]
    ) {
      originalIndex += 1;
    } else {
      candidateIndex += 1;
    }
  }

  const boundaries = [
    { originalIndex: -1, candidateIndex: -1 },
    ...matches,
    {
      originalIndex: originalLines.length,
      candidateIndex: candidateLines.length,
    },
  ];

  return boundaries.flatMap((boundary, index) => {
    const next = boundaries[index + 1];
    if (!next) return [];
    const changedOriginalLines = originalLines.slice(
      boundary.originalIndex + 1,
      next.originalIndex,
    );
    const changedCandidateLines = candidateLines.slice(
      boundary.candidateIndex + 1,
      next.candidateIndex,
    );
    if (changedOriginalLines.length === 0 && changedCandidateLines.length === 0)
      return [];

    return [
      {
        originalLines: changedOriginalLines,
        candidateLines: changedCandidateLines,
        beforeLine:
          boundary.originalIndex >= 0
            ? originalLines[boundary.originalIndex]
            : undefined,
        afterLine:
          next.originalIndex < originalLines.length
            ? originalLines[next.originalIndex]
            : undefined,
      },
    ];
  });
};

/**
 * 在当前正文中定位变更块，避免将过期建议写入用户手动修改后的内容。
 */
const applyChangeBlock = (
  content: string,
  block: MarkdownEditorChangeBlock,
): string | null => {
  const lines = toLines(content);
  const originalLength = block.originalLines.length;

  // 优先匹配包含上下文锚点的块
  for (let index = 0; index <= lines.length - originalLength; index += 1) {
    const isOriginalMatch = block.originalLines.every(
      (line, offset) => lines[index + offset] === line,
    );
    const hasBeforeAnchor =
      block.beforeLine === undefined || lines[index - 1] === block.beforeLine;
    const hasAfterAnchor =
      block.afterLine === undefined ||
      lines[index + originalLength] === block.afterLine;
    if (isOriginalMatch && hasBeforeAnchor && hasAfterAnchor) {
      return [
        ...lines.slice(0, index),
        ...block.candidateLines,
        ...lines.slice(index + originalLength),
      ].join("\n");
    }
  }

  // 退避方案：如果原始行不为空且在文档中唯一，允许无锚点匹配
  if (originalLength > 0) {
    let matchIndex = -1;
    let matchCount = 0;
    for (let index = 0; index <= lines.length - originalLength; index += 1) {
      const isOriginalMatch = block.originalLines.every(
        (line, offset) => lines[index + offset] === line,
      );
      if (isOriginalMatch) {
        matchCount += 1;
        matchIndex = index;
      }
    }
    if (matchCount === 1) {
      return [
        ...lines.slice(0, matchIndex),
        ...block.candidateLines,
        ...lines.slice(matchIndex + originalLength),
      ].join("\n");
    }
  }

  return null;
};

/**
 * 提示词设计工作区。
 * 主区域包含 Markdown 编辑器编辑提示词内容，右侧提示词 AI 侧边栏提供辅助能力。
 */
export const PromptDesignWorkspace = ({
  isOpen,
  isPromptAiSidebarOpen = true,
  onClosePromptAiSidebar,
}: PromptDesignWorkspaceProps): React.JSX.Element | null => {
  const toast = useToast();
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [changeBlocks, setChangeBlocks] = useState<MarkdownEditorChangeBlock[]>(
    [],
  );
  const contentRef = useRef(content);
  const nextChangeIdRef = useRef(0);
  const pendingProgrammaticContentsRef = useRef<Set<string>>(new Set());
  const editorViewRef = useRef<EditorView | null>(null);
  const [inlineInputView, setInlineInputView] = useState<EditorView | null>(null);
  const activeDesignId = usePromptDesignStore((state) => state.activeDesignId);

  // 初始化加载标识，防抖相关
  const [isInitializing, setIsInitializing] = useState(true);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 为了保证并发更新安全，维护一个各 design id 独立的保存任务队列
  const updatePromisesRef = useRef<Record<string, Promise<boolean>>>({});

  const enqueueUpdate = useCallback(
    (id: string, designData: string): Promise<boolean> => {
      const prevPromise = updatePromisesRef.current[id] || Promise.resolve(true);
      const nextPromise = prevPromise.then(async () => {
        try {
          await window.api.promptDesign?.designs.update(id, { designData });
          return true;
        } catch (error) {
          console.error(`保存提示词设计失败[${id}]:`, error);
          toast.error("保存提示词设计失败，请稍后重试");
          return false;
        }
      });
      updatePromisesRef.current[id] = nextPromise;
      return nextPromise;
    },
    [toast],
  );

  // 保存最新待保存内容，避免切换设计项时读到旧闭包。
  const pendingSaveRef = useRef<{ id: string; content: string } | null>(null);

  /**
   * 将待保存内容立即加入对应设计项的串行写入队列。
   */
  const flushSave = useCallback((): Promise<void> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (!pending) return Promise.resolve();

    return enqueueUpdate(pending.id, pending.content).then((isSuccessful) => {
      if (isSuccessful && pending.id === activeDesignId) {
        setSavedContent(pending.content);
      }
      setIsSaving(false);
    });
  }, [activeDesignId, enqueueUpdate]);

  /**
   * 合并连续输入，并在停止输入后保存。
   */
  const scheduleSave = useCallback(
    (id: string, nextContent: string): void => {
      pendingSaveRef.current = { id, content: nextContent };
      setIsSaving(true);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void flushSave();
      }, 1000);
    },
    [flushSave],
  );

  /**
   * 在编辑器失焦时立即提交尚未落库的提示词内容。
   */
  const handleEditorBlur = useCallback((): void => {
    void flushSave();
  }, [flushSave]);

  /**
   * 用户直接编辑时废弃基于旧快照的候选变更。
   */
  const handleEditorContentChange = useCallback(
    (nextContent: string): void => {
      contentRef.current = nextContent;
      setContent(nextContent);

      if (pendingProgrammaticContentsRef.current.has(nextContent)) {
        pendingProgrammaticContentsRef.current.delete(nextContent);
      } else {
        setChangeBlocks([]);
        pendingProgrammaticContentsRef.current.clear();
      }

      if (activeDesignId && !isInitializing) {
        scheduleSave(activeDesignId, nextContent);
      }
    },
    [activeDesignId, isInitializing, scheduleSave],
  );

  /**
   * 将 AI 候选文本转换为可独立审阅的连续变更块。
   */
  const handleEditorSuggestion = useCallback(
    (originalContent: string, candidateContent: string): void => {
      const blocks = getChangeBlocks(originalContent, candidateContent).map(
        (block) => ({
          ...block,
          id: `ai-change-${nextChangeIdRef.current++}`,
        }),
      );
      setChangeBlocks((previous) => [...previous, ...blocks]);
    },
    [],
  );

  const controller = usePromptAiChatController(activeDesignId || "default-design-item-id", content, handleEditorSuggestion);

  // 初始化加载当前 activeDesignId 的数据
  useEffect(() => {
    let isMounted = true;
    if (!activeDesignId) {
      setSavedContent("");
      setIsSaving(false);
      setIsInitializing(false);
      return;
    }

    setIsInitializing(true);
    void window.api.promptDesign?.designs.list().then((designs) => {
      if (!isMounted) return;
      const design = designs.find((d) => d.id === activeDesignId);
      if (design) {
        const loadedContent = design.designData || "";
        pendingProgrammaticContentsRef.current.add(loadedContent);
        contentRef.current = loadedContent;
        setContent(loadedContent);
        setSavedContent(loadedContent);
        setChangeBlocks([]);
      } else {
        // Fallback for not found active design
        contentRef.current = "";
        setContent("");
        setSavedContent("");
        setChangeBlocks([]);
      }
      setIsSaving(false);
      setIsInitializing(false);
    }).catch((error) => {
      if (!isMounted) return;
      console.error(`加载提示词设计失败[${activeDesignId}]:`, error);
      toast.error("加载提示词设计失败");
      setIsInitializing(false);
    });

    return () => {
      isMounted = false;
      flushSave(); // <-- 改在这里，卸载前冲刷（顺便在 flushSave 内部会清空 timer）
    };
  }, [activeDesignId, flushSave, toast]);

  // 使用 setBeforeDesignSwitch 在切换设计时冲刷当前设计
  useEffect(() => {
    const unsubscribe = usePromptDesignStore.getState().setBeforeDesignSwitch(async () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      flushSave();
      return true;
    });
    return unsubscribe;
  }, [flushSave]);

  const handleEditorViewReady = useCallback((view: EditorView): void => {
    if (editorViewRef.current === view) return;
    editorViewRef.current = view;
    view.dispatch({
      effects: StateEffect.appendConfig.of(
        EditorView.domEventHandlers({
          keydown: (event, editorView) => {
            if (event.key !== "Shift" || event.repeat) return false;
            const now = Date.now();
            const previous = editorView.dom.dataset.promptShiftTime;
            editorView.dom.dataset.promptShiftTime = String(now);
            if (!previous || now - Number(previous) > 500) return false;
            setInlineInputView(editorView);
            return true;
          },
        }),
      ),
    });
  }, []);

  /**
   * 仅在变更块仍可定位到原文时应用，防止静默覆盖。
   */
  const handleAcceptChange = useCallback(
    (id: string): void => {
      const block = changeBlocks.find((item) => item.id === id);
      if (!block) return;

      const nextContent = applyChangeBlock(contentRef.current, block);
      if (nextContent !== null) {
        pendingProgrammaticContentsRef.current.add(nextContent);
        contentRef.current = nextContent;
        setContent(nextContent);

        if (activeDesignId) {
          scheduleSave(activeDesignId, nextContent);
        }

        setChangeBlocks((previous) =>
          previous
            .filter((item) => item.id !== id)
            .map((item) => {
              let beforeLine = item.beforeLine;
              let afterLine = item.afterLine;

              if (block.originalLines.length > 0) {
                const lastOrig =
                  block.originalLines[block.originalLines.length - 1];
                if (beforeLine === lastOrig) {
                  beforeLine =
                    block.candidateLines.length > 0
                      ? block.candidateLines[block.candidateLines.length - 1]
                      : block.beforeLine;
                }

                const firstOrig = block.originalLines[0];
                if (afterLine === firstOrig) {
                  afterLine =
                    block.candidateLines.length > 0
                      ? block.candidateLines[0]
                      : block.afterLine;
                }
              }

              return {
                ...item,
                beforeLine,
                afterLine,
              };
            }),
        );
        return;
      }
      setChangeBlocks((previous) =>
        previous.map((item) =>
          item.id === id ? { ...item, status: "conflict" } : item,
        ),
      );
    },
    [changeBlocks],
  );

  const handleRejectChange = useCallback((id: string): void => {
    setChangeBlocks((previous) => previous.filter((item) => item.id !== id));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#000000]">
      <div className="flex min-w-0 flex-1 flex-col rounded-[6px] border border-white/5 bg-[#212121] shadow-inner overflow-hidden">
        <div className="min-h-0 flex-1 relative flex flex-col">
          {activeDesignId && !isInitializing ? (
            <>
              <MarkdownEditor
                aiChangeBlocks={changeBlocks}
                id="prompt-design-editor"
                showSaveStatus
                isSaved={!isInitializing && !isSaving && content === savedContent}
                onAcceptAiChange={handleAcceptChange}
                onBlur={handleEditorBlur}
                onChange={handleEditorContentChange}
                onRejectAiChange={handleRejectChange}
                placeholder="在此编辑提示词内容..."
                height="100%"
                defaultMode="edit"
                value={content}
                onEditorViewReady={handleEditorViewReady}
              />
              {inlineInputView && (
                <PromptAiInlineInput
                  view={inlineInputView}
                  controller={controller}
                  onClose={() => setInlineInputView(null)}
                />
              )}
            </>
          ) : !activeDesignId ? (
            <div className="flex h-full w-full flex-col items-center justify-center px-6 py-12 text-center animate-fade-in select-text">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[6px] border border-white/5 bg-white/5 text-white/30 animate-pulse">
                <Bot className="h-6 w-6" />
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-white/80 font-mono">
                // 提示词设计
              </h3>
              <p className="max-w-[240px] text-xs leading-relaxed text-white/40">
                选择或新建提示词设计项以开始编辑。
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <PromptAiSidebar
        isOpen={isPromptAiSidebarOpen}
        onClose={onClosePromptAiSidebar}
        controller={controller}
      />
    </div>
  );
};
