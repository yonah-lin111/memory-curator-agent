import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot } from "lucide-react";
import { EditorView } from "@codemirror/view";
import { StateEffect } from "@codemirror/state";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import type { MarkdownEditorChangeBlock } from "@/components/ui/MarkdownEditor";
import { PromptAiSidebar } from "@/features/prompt-design/components/PromptAiSidebar";
import { PromptAiInlineInput } from "@/features/prompt-design/components/PromptAiInlineInput";
import { usePromptDesignStore } from "@/features/prompt-design/store/promptDesignStore";
import { usePromptAiChatController } from "@/features/prompt-design/components/usePromptAiChatController";
import { useToast } from "@/components/ui/Toast";

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

type PromptDesignChangeBlock = MarkdownEditorChangeBlock & { runId: string };

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
  const [content, setContent] = useState("");
  const [changeBlocks, setChangeBlocks] = useState<PromptDesignChangeBlock[]>(
    [],
  );
  const toast = useToast();
  const activeDesignId = usePromptDesignStore((state) => state.activeDesignId);
  const contentRef = useRef(content);
  const activeDesignIdRef = useRef(activeDesignId);
  const savedSnapshotRef = useRef({ designId: null as string | null, content: "" });
  const loadedDesignIdRef = useRef<string | null>(null);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const loadRequestRef = useRef(0);
  const setBeforeDesignSwitch = usePromptDesignStore(
    (state) => state.setBeforeDesignSwitch,
  );
  const nextChangeIdRef = useRef(0);
  const runOriginalContentRef = useRef(new Map<string, string>());
  const pendingProgrammaticContentsRef = useRef<Set<string>>(new Set());
  const editorViewRef = useRef<EditorView | null>(null);
  const [inlineInputView, setInlineInputView] = useState<EditorView | null>(null);
  const [editorReadyVersion, setEditorReadyVersion] = useState(0);

  /**
   * 将当前正文写入设计项，并保留失败快照以阻止切换丢失内容。
   */
  const saveContent = useCallback(async (): Promise<boolean> => {
    const designId = activeDesignIdRef.current;
    if (!designId) return true;
    if (loadedDesignIdRef.current !== designId) return false;
    if (savePromiseRef.current) return savePromiseRef.current;

    const snapshot = contentRef.current;
    if (
      savedSnapshotRef.current.designId === designId &&
      savedSnapshotRef.current.content === snapshot
    ) {
      return true;
    }

    const savePromise = (async (): Promise<boolean> => {
      try {
        await window.api.promptDesign?.designs.update(designId, {
          designData: { promptContent: snapshot },
        });
        savedSnapshotRef.current = { designId, content: snapshot };
        return true;
      } catch (error) {
        console.error("保存提示词内容失败", error);
        toast.error("提示词保存失败，未切换设计项");
        return false;
      } finally {
        savePromiseRef.current = null;
      }
    })();
    savePromiseRef.current = savePromise;
    return savePromise;
  }, [toast]);

  useEffect(() => {
    activeDesignIdRef.current = activeDesignId;
    const requestId = ++loadRequestRef.current;
    if (!activeDesignId) {
      contentRef.current = "";
      setContent("");
      savedSnapshotRef.current = { designId: null, content: "" };
      loadedDesignIdRef.current = null;
      return;
    }

    let disposed = false;
    void window.api.promptDesign?.designs.list().then((designs) => {
      if (disposed || requestId !== loadRequestRef.current) return;
      const design = designs.find((item: { id: string }) => item.id === activeDesignId);
      const nextContent = design?.designData?.promptContent ?? "";
      contentRef.current = nextContent;
      setContent(nextContent);
      savedSnapshotRef.current = { designId: activeDesignId, content: nextContent };
      loadedDesignIdRef.current = activeDesignId;
      setChangeBlocks([]);
      runOriginalContentRef.current.clear();
    }).catch((error) => {
      if (disposed || requestId !== loadRequestRef.current) return;
      console.error("加载提示词内容失败", error);
      toast.error("提示词加载失败");
    });
    return () => {
      disposed = true;
    };
  }, [activeDesignId, toast]);

  useEffect(() => {
    if (!activeDesignId) return;
    const timer = window.setTimeout(() => void saveContent(), 1000);
    return () => window.clearTimeout(timer);
  }, [activeDesignId, content, saveContent]);

  useEffect(() => {
    if (!isOpen) void saveContent();
  }, [isOpen, saveContent]);

  useEffect(() => {
    const unregister = setBeforeDesignSwitch(saveContent);
    return () => unregister();
  }, [saveContent, setBeforeDesignSwitch]);

  useEffect(() => {
    const handleBlur = (): void => {
      void saveContent();
    };
    const editor = editorViewRef.current?.dom;
    editor?.addEventListener("blur", handleBlur);
    return () => editor?.removeEventListener("blur", handleBlur);
  }, [saveContent, editorReadyVersion]);

  useEffect(() => () => {
    void saveContent();
  }, [saveContent]);

  const handleEditorContentChange = useCallback((nextContent: string): void => {
    contentRef.current = nextContent;
    setContent(nextContent);

    if (pendingProgrammaticContentsRef.current.has(nextContent)) {
      pendingProgrammaticContentsRef.current.delete(nextContent);
    } else {
      setChangeBlocks([]);
      runOriginalContentRef.current.clear();
      pendingProgrammaticContentsRef.current.clear();
    }
  }, []);

  /**
   * 将 AI 候选文本转换为可独立审阅的连续变更块。
   */
  const handleEditorSuggestion = useCallback(
    (runId: string, originalContent: string, candidateContent: string): void => {
      const runOriginalContent = runOriginalContentRef.current.get(runId) ?? originalContent;
      runOriginalContentRef.current.set(runId, runOriginalContent);
      const blocks = getChangeBlocks(runOriginalContent, candidateContent).map(
        (block) => ({
          ...block,
          id: `ai-change-${nextChangeIdRef.current++}`,
          runId,
        }),
      );
      setChangeBlocks((previous) => [
        ...previous.filter((item) => item.runId !== runId),
        ...blocks,
      ]);
    },
    [],
  );

  const controller = usePromptAiChatController(activeDesignId || "default-design-item-id", content, handleEditorSuggestion);

  const handleEditorViewReady = useCallback((view: EditorView): void => {
    if (editorViewRef.current === view) return;
    editorViewRef.current = view;
    setEditorReadyVersion((version) => version + 1);
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
        if (!changeBlocks.some((item) => item.runId === block.runId && item.id !== id)) {
          runOriginalContentRef.current.delete(block.runId);
        }
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
    const block = changeBlocks.find((item) => item.id === id);
    if (!block) return;
    setChangeBlocks((previous) => previous.filter((item) => item.id !== id));
    if (!changeBlocks.some((item) => item.runId === block.runId && item.id !== id)) {
      runOriginalContentRef.current.delete(block.runId);
    }
  }, [changeBlocks]);

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#000000]">
      <div className="flex min-w-0 flex-1 flex-col rounded-[6px] border border-white/5 bg-[#212121] shadow-inner overflow-hidden">
        <div className="min-h-0 flex-1">
          {activeDesignId ? (
            <MarkdownEditor
              aiChangeBlocks={changeBlocks}
              id="prompt-design-editor"
              onAcceptAiChange={handleAcceptChange}
              onChange={handleEditorContentChange}
              onRejectAiChange={handleRejectChange}
              placeholder="在此编辑提示词内容..."
              height="100%"
              defaultMode="edit"
              value={content}
              onEditorViewReady={handleEditorViewReady}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center animate-fade-in select-text">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[6px] border border-white/5 bg-white/5 text-white/30 animate-pulse">
                <Bot className="h-6 w-6" />
              </div>
              <h3 className="mb-1.5 font-mono text-sm font-bold text-white/80">// 提示词设计</h3>
              <p className="max-w-[240px] text-xs leading-relaxed text-white/40">
                请先在左侧选择一个提示词设计项，以开始编辑提示词内容。
              </p>
            </div>
          )}
          {inlineInputView && (
            <PromptAiInlineInput
              view={inlineInputView}
              controller={controller}
              onClose={() => setInlineInputView(null)}
            />
          )}
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
