import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { Prec, StateEffect } from "@codemirror/state";
import { Bot } from "lucide-react";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import type { MarkdownEditorChangeBlock } from "@/components/ui/MarkdownEditor";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useToast } from "@/components/ui/Toast";
import { PromptAiSidebar } from "@/features/prompt-design/components/PromptAiSidebar";
import { PromptAiInlineInput } from "@/features/prompt-design/components/PromptAiInlineInput";
import {
  PromptAiSlashCommandPanel,
  type PromptAiInputCommand,
} from "@/features/prompt-design/components/PromptAiInputPanels";
import { usePromptDesignStore } from "@/features/prompt-design/store/promptDesignStore";
import { usePromptAiChatController } from "@/features/prompt-design/components/usePromptAiChatController";
import { PromptDesignContextMenu } from "@/features/prompt-design/components/PromptDesignContextMenu";
import type { PromptDesignReference } from "@/features/prompt-design/types";
import { isFuzzyCommandMatch } from "@/lib/ai-shared/utils";
import {
  applyPromptAction,
  executePromptChangeCommand,
  isPromptChangeCommand,
  PROMPT_DESIGN_TITLE_GENERATING_EVENT,
  PROMPT_DESIGN_TITLE_UPDATED_EVENT,
} from "@/features/prompt-design/lib/promptCommand";

// 设计项切换 loading 最短展示时长（ms），与 AI 侧栏保持一致。
const MIN_SWITCH_LOADING_MS = 500;

interface PromptDesignWorkspaceProps {
  isOpen: boolean;
  mcpStatus?: {
    total: number;
    connected: number;
    failed: number;
    names: string[];
    failedNames: string[];
  };
  isPromptAiSidebarOpen?: boolean;
  onClosePromptAiSidebar?: () => void;
}

// 最长公共子序列中的匹配行。
type MatchedLine = {
  originalIndex: number;
  candidateIndex: number;
};

// Markdown 编辑器中的斜杠命令候选项。
type MarkdownSlashCommand = PromptAiInputCommand & {
  id: "newDesign" | "title" | "root" | "change";
};

// 命令面板在视口中的位置。
type MarkdownSlashCommandPosition = {
  left: number;
  top: number | "auto";
  bottom: number | "auto";
};

const NEW_DESIGN_COMMAND: MarkdownSlashCommand = {
  id: "newDesign",
  name: "/newDesign",
  description: "新建提示词设计",
};

const TITLE_COMMAND: MarkdownSlashCommand = {
  id: "title",
  name: "/title",
  description: "根据提示词生成简短标题",
};

const NEW_DESIGN_ACTIONS: MarkdownSlashCommand[] = [
  { id: "root", name: "-root", description: "在项目根目录创建" },
  { id: "change", name: "-change", description: "创建并打开设计" },
];

/**
 * 取得光标所在行的斜杠命令文本及其文档范围。
 */
const getSlashCommandLine = (
  view: EditorView,
): { from: number; to: number; value: string } | null => {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const value = line.text.trimStart();
  if (!value.startsWith("/")) return null;
  return { from: line.from, to: line.to, value };
};

/**
 * 根据当前命令行文本返回可显示的候选项。
 */
const getMarkdownSlashCommandOptions = (value: string): MarkdownSlashCommand[] => {
  if (isPromptChangeCommand(value)) return [];
  if (/\s$/.test(value)) return [];
  const [command, ...argumentsList] = value.trim().split(/\s+/);
  const commandQuery = command.slice(1).toLowerCase();
  const commands = [NEW_DESIGN_COMMAND, TITLE_COMMAND].filter((item) =>
    isFuzzyCommandMatch(commandQuery, item.name.slice(1).toLowerCase()),
  );
  if (argumentsList.length === 0) return commands;
  if (command.toLowerCase() !== NEW_DESIGN_COMMAND.name.toLowerCase()) return [];

  const lastToken = value.split(/\s+/).at(-1) ?? "";
  if (!lastToken.startsWith("-")) return [];

  return value.split(/\s+/).includes("-root")
    ? NEW_DESIGN_ACTIONS.filter((command) => command.id === "change")
    : NEW_DESIGN_ACTIONS;
};

// Diff 定位使用的前后上下文行数。
const DIFF_CONTEXT_LINE_COUNT = 3;

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
        beforeContext: originalLines.slice(
          Math.max(0, boundary.originalIndex - DIFF_CONTEXT_LINE_COUNT + 1),
          boundary.originalIndex + 1,
        ),
        afterContext: originalLines.slice(
          next.originalIndex,
          next.originalIndex + DIFF_CONTEXT_LINE_COUNT,
        ),
      },
    ];
  });
};

/**
 * 使用变更范围与多行上下文唯一定位变更块，拒绝任何可能误命中的操作。
 */
const applyChangeBlock = (
  content: string,
  block: MarkdownEditorChangeBlock,
): string | null => {
  const lines = toLines(content);
  const originalLength = block.originalLines.length;

  const beforeContext = block.beforeContext ?? (block.beforeLine === undefined ? [] : [block.beforeLine]);
  const afterContext = block.afterContext ?? (block.afterLine === undefined ? [] : [block.afterLine]);
  const matchedIndexes: number[] = [];
  for (let index = 0; index <= lines.length - originalLength; index += 1) {
    const isOriginalMatch = block.originalLines.every(
      (line, offset) => lines[index + offset] === line,
    );
    const hasBeforeContext = beforeContext.every(
      (line, offset) => lines[index - beforeContext.length + offset] === line,
    );
    const hasAfterContext = afterContext.every(
      (line, offset) => lines[index + originalLength + offset] === line,
    );
    if (isOriginalMatch && hasBeforeContext && hasAfterContext) matchedIndexes.push(index);
  }
  if (matchedIndexes.length !== 1) return null;
  const index = matchedIndexes[0];
  return [
    ...lines.slice(0, index),
    ...block.candidateLines,
    ...lines.slice(index + originalLength),
  ].join("\n");
};

/**
 * 提示词设计工作区。
 * 主区域包含 Markdown 编辑器编辑提示词内容，右侧提示词 AI 侧边栏提供辅助能力。
 */
export const PromptDesignWorkspace = ({
  isOpen,
  mcpStatus,
  isPromptAiSidebarOpen = true,
  onClosePromptAiSidebar,
}: PromptDesignWorkspaceProps): React.JSX.Element | null => {
  const toast = useToast();
  // 保持最新通知方法，避免通知状态变化触发编辑器初始化流程。
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  // 设计项内容加载完成后递增，用于清空编辑器历史。
  const [historyResetVersion, setHistoryResetVersion] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [changeBlocks, setChangeBlocks] = useState<MarkdownEditorChangeBlock[]>(
    [],
  );
  // Agent 未确认修改的最新完整候选正文，作为下一轮 Agent 的工作副本。
  const [pendingCandidateContent, setPendingCandidateContent] = useState<string | null>(null);
  const contentRef = useRef(content);
  const pendingCandidateContentRef = useRef<string | null>(null);
  const nextChangeIdRef = useRef(0);
  const pendingProgrammaticContentsRef = useRef<Set<string>>(new Set());
  const controllerRef = useRef<ReturnType<typeof usePromptAiChatController> | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const [inlineInputView, setInlineInputView] = useState<EditorView | null>(null);
  // Markdown 编辑器斜杠命令面板状态。
  const [markdownCommandLine, setMarkdownCommandLine] = useState<{
    from: number;
    to: number;
    value: string;
  } | null>(null);
  const [markdownCommandPosition, setMarkdownCommandPosition] =
    useState<MarkdownSlashCommandPosition | null>(null);
  const [activeMarkdownCommandIndex, setActiveMarkdownCommandIndex] = useState(0);
  const activeMarkdownCommandIndexRef = useRef(0);
  activeMarkdownCommandIndexRef.current = activeMarkdownCommandIndex;
  // 用于通知侧栏聊天输入框主动获取焦点。
  const [chatInputFocusVersion, setChatInputFocusVersion] = useState(0);
  const lastShiftTimeRef = useRef(0);
  const [editorMode, setEditorMode] = useState<"edit" | "preview" | "split">("edit");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; view: EditorView; mode: "edit" | "preview" | "split" } | null>(null);
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
          toastRef.current.error("保存提示词设计失败，请稍后重试");
          return false;
        }
      });
      updatePromisesRef.current[id] = nextPromise;
      return nextPromise;
    },
    [],
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
   * 用户直接编辑非 Diff 区域时，将同一补丁同步到候选正文后重新派生 Diff。
   */
  const handleEditorContentChange = useCallback(
    (nextContent: string): void => {
      const previousContent = contentRef.current;
      contentRef.current = nextContent;
      setContent(nextContent);

      if (pendingProgrammaticContentsRef.current.has(nextContent)) {
        pendingProgrammaticContentsRef.current.delete(nextContent);
      } else {
        const previousLines = toLines(previousContent);
        const nextLines = toLines(nextContent);
        controllerRef.current?.setReferences((previous) => {
          const nextReferences = previous.filter((reference) =>
            previousLines.slice(reference.startLine - 1, reference.endLine).join("\n") ===
              nextLines.slice(reference.startLine - 1, reference.endLine).join("\n") &&
            previousLines.slice(0, reference.startLine - 1).join("\n") ===
              nextLines.slice(0, reference.startLine - 1).join("\n"),
          );
          const removedCount = previous.length - nextReferences.length;
          if (removedCount > 0) {
            toastRef.current.warning(`文档内容已改变，已移除 ${removedCount} 个失效引用`);
          }
          return nextReferences;
        });
        const currentWorkingContent = pendingCandidateContentRef.current ?? previousContent;
        let nextWorkingContent = currentWorkingContent;
        let hasSyncConflict = false;
        for (const userBlock of getChangeBlocks(previousContent, nextContent)) {
          const patchedContent = applyChangeBlock(nextWorkingContent, {
            ...userBlock,
            id: "user-change",
          });
          if (patchedContent === null) {
            hasSyncConflict = true;
            break;
          }
          nextWorkingContent = patchedContent;
        }

        if (hasSyncConflict) {
          // 不猜测重复文本的目标位置，保留候选分支并标记冲突供用户处理。
          setChangeBlocks((previous) => previous.map((block) => ({ ...block, status: "conflict" })));
        } else {
          const nextBlocks = getChangeBlocks(nextContent, nextWorkingContent).map(
            (block) => ({ ...block, id: `ai-change-${nextChangeIdRef.current++}` }),
          );
          setChangeBlocks(nextBlocks);
          const nextCandidate = nextBlocks.length > 0 ? nextWorkingContent : null;
          setPendingCandidateContent(nextCandidate);
          pendingCandidateContentRef.current = nextCandidate;
        }
        pendingProgrammaticContentsRef.current.clear();
      }

      if (activeDesignId && !isInitializing) {
        scheduleSave(activeDesignId, nextContent);
      }
    },
    [activeDesignId, isInitializing, scheduleSave],
  );

  /**
   * 将 AI 最新候选文本与已确认正文比较，重建唯一的一组待审变更。
   */
  const handleEditorSuggestion = useCallback(
    (workingContent: string, candidateContent: string): boolean => {
      const expectedWorkingContent = pendingCandidateContentRef.current ?? contentRef.current;
      // 忽略基于过期正文生成的异步工具结果，避免覆盖最新待审候选。
      if (workingContent !== expectedWorkingContent) return false;
      const blocks = getChangeBlocks(contentRef.current, candidateContent).map(
        (block) => ({
          ...block,
          id: `ai-change-${nextChangeIdRef.current++}`,
        }),
      );
      setChangeBlocks(blocks);
      setPendingCandidateContent(candidateContent);
      pendingCandidateContentRef.current = candidateContent;
      return true;
    },
    [],
  );

  const controller = usePromptAiChatController(
    activeDesignId || "default-design-item-id",
    pendingCandidateContent ?? content,
    handleEditorSuggestion,
    isOpen && isPromptAiSidebarOpen,
  );
  controllerRef.current = controller;

  const getReferenceRange = useCallback((view: EditorView): PromptDesignReference | null => {
    const selection = view.state.selection.main;
    const from = Math.min(selection.from, selection.to);
    const to = Math.max(selection.from, selection.to);
    const start = view.state.doc.lineAt(from);
    const end = view.state.doc.lineAt(to);
    const startLine = start.number;
    const endLine = end.number;
    if (endLine - startLine + 1 > 200) return null;
    return { id: `reference-${Date.now()}`, startLine, endLine, content: view.state.doc.sliceString(start.from, end.to) };
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>, view: EditorView): void => {
    event.preventDefault();
    const selection = view.state.selection.main;
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos !== null && !(pos >= selection.from && pos <= selection.to && selection.from !== selection.to)) {
      view.dispatch({ selection: { anchor: pos, head: pos } });
    }
    setContextMenu({ x: event.clientX, y: event.clientY, view, mode: editorMode });
  }, []);

  const copySelection = useCallback(async (view: EditorView, cut = false): Promise<void> => {
    const selection = view.state.selection.main;
    const text = view.state.sliceDoc(selection.from, selection.to);
    try {
      await navigator.clipboard.writeText(text);
      if (cut && selection.from !== selection.to) view.dispatch({ changes: { from: selection.from, to: selection.to, insert: "" } });
    } catch { toast.error("剪贴板操作失败"); }
    setContextMenu(null);
  }, [toast]);

  /**
   * 将编辑器选区加入当前 AI 对话引用，并合并相邻区间。
   */
  const addSelectionReference = useCallback((view: EditorView): boolean => {
    const selection = view.state.selection.main;
    if (selection.from === selection.to) return false;

    const reference = getReferenceRange(view);
    if (!reference) {
      toast.warning("引用最多支持200行");
      return false;
    }

    controllerRef.current?.setReferences((previous) => {
      const merged = [...previous, reference].sort((a, b) => a.startLine - b.startLine);
      const result: PromptDesignReference[] = [];
      for (const item of merged) {
        const last = result.at(-1);
        if (last && item.startLine <= last.endLine + 1) {
          last.endLine = Math.max(last.endLine, item.endLine);
          last.content = view.state.doc.line(last.startLine).from <= view.state.doc.length ? view.state.doc.sliceString(view.state.doc.line(last.startLine).from, view.state.doc.line(last.endLine).to) : last.content;
        } else result.push({ ...item });
      }
      return result.slice(0, 10);
    });
    return true;
  }, [getReferenceRange, toast]);

  /**
   * 通过右键菜单添加引用后，将焦点转交给侧栏聊天输入框。
   */
  const handleQuote = useCallback((): void => {
    if (!contextMenu) return;
    if (addSelectionReference(contextMenu.view)) {
      setChatInputFocusVersion((version) => version + 1);
    }
    setContextMenu(null);
  }, [addSelectionReference, contextMenu]);

  /**
   * 定位引用对应的编辑器内容，并在原文未变更时选中该范围。
   */
  const handleReferenceSelect = useCallback((reference: PromptDesignReference): void => {
    const view = editorViewRef.current;
    if (!view || reference.startLine < 1 || reference.endLine > view.state.doc.lines) {
      toast.warning("引用内容已改变，无法定位");
      return;
    }

    const from = view.state.doc.line(reference.startLine).from;
    const to = view.state.doc.line(reference.endLine).to;
    if (view.state.doc.sliceString(from, to) !== reference.content) {
      toast.warning("引用内容已改变，无法定位");
      return;
    }

    view.dispatch({
      selection: { anchor: from, head: to },
      effects: EditorView.scrollIntoView(from, { y: "center" }),
    });
    view.focus();
  }, [toast]);

  // 初始化加载当前 activeDesignId 的数据
  useEffect(() => {
    let isMounted = true;
    let loadingTimer: ReturnType<typeof setTimeout> | null = null;
    if (!isOpen) return;

    if (!activeDesignId) {
      setSavedContent("");
      setIsSaving(false);
      setIsInitializing(false);
      return;
    }

    setIsInitializing(true);
    const loadingStartTime = Date.now();
    const finishInitializing = (): void => {
      const remaining = Math.max(
        0,
        MIN_SWITCH_LOADING_MS - (Date.now() - loadingStartTime),
      );
      loadingTimer = setTimeout(() => {
        if (isMounted) setIsInitializing(false);
      }, remaining);
    };

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
        setPendingCandidateContent(null);
        pendingCandidateContentRef.current = null;
        setHistoryResetVersion((version) => version + 1);
      } else {
        // Fallback for not found active design
        contentRef.current = "";
        setContent("");
        setSavedContent("");
        setChangeBlocks([]);
        setPendingCandidateContent(null);
        pendingCandidateContentRef.current = null;
        setHistoryResetVersion((version) => version + 1);
      }
      setIsSaving(false);
      finishInitializing();
    }).catch((error) => {
      if (!isMounted) return;
      console.error(`加载提示词设计失败[${activeDesignId}]:`, error);
      toastRef.current.error("加载提示词设计失败");
      finishInitializing();
    });

    return () => {
      isMounted = false;
      if (loadingTimer) clearTimeout(loadingTimer);
      flushSave(); // <-- 改在这里，卸载前冲刷（顺便在 flushSave 内部会清空 timer）
    };
  }, [activeDesignId, flushSave, isOpen]);

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

  useEffect(() => {
    if (!inlineInputView) return;

    lastShiftTimeRef.current = 0;
    const handleInlineInputKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Shift" || event.repeat) return;

      const now = Date.now();
      if (!lastShiftTimeRef.current || now - lastShiftTimeRef.current > 500) {
        lastShiftTimeRef.current = now;
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      lastShiftTimeRef.current = 0;
      setInlineInputView(null);
      requestAnimationFrame(() => inlineInputView.focus());
    };

    document.addEventListener("keydown", handleInlineInputKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleInlineInputKeyDown, true);
    };
  }, [inlineInputView]);

  /**
   * 执行完整的新建设计命令，并从正文中移除该命令行。
   */
  const executeNewDesignCommand = useCallback((view: EditorView): void => {
    const commandLine = getSlashCommandLine(view);
    if (!commandLine || !isPromptChangeCommand(commandLine.value)) return;

    view.dispatch({
      changes: { from: commandLine.from, to: commandLine.to, insert: "" },
      selection: { anchor: commandLine.from },
    });
    setMarkdownCommandLine(null);
    setMarkdownCommandPosition(null);
    toast.info("正在创建提示词设计...");
    void executePromptChangeCommand(commandLine.value)
      .then(() => toast.success("提示词设计创建成功"))
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "创建提示词设计失败"),
      );
  }, [toast]);

  /**
   * 根据当前正文更新设计标题，并移除标题命令行。
   */
  const executeTitleCommand = useCallback((view: EditorView): void => {
    const commandLine = getSlashCommandLine(view);
    if (!commandLine || commandLine.value.trim().toLowerCase() !== "/title") return;
    const document = view.state.doc.toString();
    const contentWithoutCommand =
      `${document.slice(0, commandLine.from)}${document.slice(commandLine.to)}`.trim();
    const currentDesignId = usePromptDesignStore.getState().activeDesignId;
    if (editorViewRef.current !== view || !currentDesignId || !contentWithoutCommand) {
      toast.warning("提示词内容为空，无法生成标题");
      return;
    }
    view.dispatch({
      changes: { from: commandLine.from, to: commandLine.to, insert: "" },
      selection: { anchor: commandLine.from },
    });
    setMarkdownCommandLine(null);
    setMarkdownCommandPosition(null);
    const generateTitle = window.api.promptAi?.generateDesignTitle;
    if (typeof generateTitle !== "function") {
      toast.error("标题生成服务已更新，请重启应用后重试");
      return;
    }

    window.dispatchEvent(new CustomEvent(PROMPT_DESIGN_TITLE_GENERATING_EVENT, {
      detail: { designId: currentDesignId, isGenerating: true },
    }));
    toast.info("正在总结设计标题...");
    void generateTitle(contentWithoutCommand)
      .then(async (title) => {
        const normalizedTitle = title.trim().slice(0, 12);
        if (!normalizedTitle) throw new Error("未生成有效标题");
        await window.api.promptDesign?.designs.rename(currentDesignId, normalizedTitle);
        return normalizedTitle;
      })
      .then((title) => {
        if (usePromptDesignStore.getState().activeDesignId === currentDesignId) {
          usePromptDesignStore.getState().setItemName(title);
        }
        window.dispatchEvent(new Event(PROMPT_DESIGN_TITLE_UPDATED_EVENT));
        toast.success("设计标题已更新");
      })
      .catch(() => toast.error("更新设计标题失败"))
      .finally(() => {
        window.dispatchEvent(new CustomEvent(PROMPT_DESIGN_TITLE_GENERATING_EVENT, {
          detail: { designId: currentDesignId, isGenerating: false },
        }));
      });
  }, [toast]);

  /**
   * 同步 Markdown 光标处的斜杠命令面板位置与候选项。
   */
  const syncMarkdownCommandPanel = useCallback((view: EditorView): void => {
    const commandLine = getSlashCommandLine(view);
    const commands = commandLine
      ? getMarkdownSlashCommandOptions(commandLine.value)
      : [];
    const coords = view.coordsAtPos(view.state.selection.main.head);
    if (!commandLine || commands.length === 0 || !coords) {
      setMarkdownCommandLine(null);
      setMarkdownCommandPosition(null);
      return;
    }

    const panelWidth = 360;
    const offset = 6;
    const left = Math.min(
      Math.max(coords.left, 8),
      Math.max(window.innerWidth - panelWidth - 8, 8),
    );
    setMarkdownCommandLine(commandLine);
    setMarkdownCommandPosition(
      window.innerHeight - coords.bottom < window.innerHeight * 0.3
        ? { left, top: "auto", bottom: window.innerHeight - coords.top + offset }
        : { left, top: coords.bottom + offset, bottom: "auto" },
    );
  }, []);

  const handleEditorViewReady = useCallback((view: EditorView): void => {
    if (editorViewRef.current === view) return;
    editorViewRef.current = view;
    view.dispatch({
      effects: StateEffect.appendConfig.of([
        Prec.high(
          EditorView.domEventHandlers({
          keydown: (event, editorView) => {
            const commandLine = getSlashCommandLine(editorView);
            const commands = commandLine
              ? getMarkdownSlashCommandOptions(commandLine.value)
              : [];
            if (
              event.key === "Enter" &&
              !event.isComposing &&
              commandLine &&
              isPromptChangeCommand(commandLine.value)
            ) {
              event.preventDefault();
              executeNewDesignCommand(editorView);
              return true;
            }
            if (
              event.key === "Enter" &&
              !event.isComposing &&
              commandLine?.value.trim().toLowerCase() === "/title"
            ) {
              event.preventDefault();
              executeTitleCommand(editorView);
              return true;
            }
            if (commandLine && commands.length > 0) {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const direction = event.key === "ArrowDown" ? 1 : -1;
                setActiveMarkdownCommandIndex(
                  (index) => (index + direction + commands.length) % commands.length,
                );
                return true;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setMarkdownCommandLine(null);
                setMarkdownCommandPosition(null);
                return true;
              }
              if (event.key === "Enter" && !event.isComposing) {
                const command =
                  commands[activeMarkdownCommandIndexRef.current] ?? commands[0];
                if (command) {
                  event.preventDefault();
                  if (command.id === "newDesign") {
                    const insert = "/newDesign design[]";
                    const cursor = commandLine.from + insert.length - 1;
                    editorView.dispatch({
                      changes: { from: commandLine.from, to: commandLine.to, insert },
                      selection: { anchor: cursor },
                    });
                  } else if (command.id === "title") {
                    const insert = "/title ";
                    editorView.dispatch({
                      changes: { from: commandLine.from, to: commandLine.to, insert },
                      selection: { anchor: commandLine.from + insert.length },
                    });
                  } else {
                    const insert = applyPromptAction(commandLine.value, command.id);
                    editorView.dispatch({
                      changes: { from: commandLine.from, to: commandLine.to, insert },
                      selection: { anchor: commandLine.from + insert.length },
                    });
                  }
                  return true;
                }
              }
            }

            if (event.key !== "Shift" || event.repeat) return false;
            const now = Date.now();
            const previous = editorView.dom.dataset.promptShiftTime;
            editorView.dom.dataset.promptShiftTime = String(now);
            if (!previous || now - Number(previous) > 500) return false;
            addSelectionReference(editorView);
            setInlineInputView(editorView);
            return true;
          },
          }),
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged || update.selectionSet) {
            syncMarkdownCommandPanel(update.view);
          }
        }),
      ]),
    });
    syncMarkdownCommandPanel(view);
  }, [
    addSelectionReference,
    executeNewDesignCommand,
    executeTitleCommand,
    syncMarkdownCommandPanel,
  ]);

  /**
   * 通过 CodeMirror 事务应用 Agent 已确认的正文，保留选区与滚动位置。
   * 避免 md-editor-rt 受控 value 的全量回写将选区映射到文末，污染后续撤回与重做的视图位置。
   */
  const applyAcceptedContent = useCallback((nextContent: string): void => {
    const view = editorViewRef.current;
    if (!view) {
      pendingProgrammaticContentsRef.current.add(nextContent);
      contentRef.current = nextContent;
      setContent(nextContent);
      return;
    }

    const { anchor, head } = view.state.selection.main;
    const scrollTop = view.scrollDOM.scrollTop;
    pendingProgrammaticContentsRef.current.add(nextContent);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: nextContent },
      selection: {
        anchor: Math.min(anchor, nextContent.length),
        head: Math.min(head, nextContent.length),
      },
    });

    requestAnimationFrame(() => {
      const maxScrollTop = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight;
      view.scrollDOM.scrollTop = Math.min(scrollTop, Math.max(0, maxScrollTop));
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
        applyAcceptedContent(nextContent);

        if (activeDesignId) {
          scheduleSave(activeDesignId, nextContent);
        }

        const candidateContent = pendingCandidateContentRef.current ?? nextContent;
        const remainingBlocks = getChangeBlocks(nextContent, candidateContent).map(
          (item) => ({ ...item, id: `ai-change-${nextChangeIdRef.current++}` }),
        );
        setChangeBlocks(remainingBlocks);
        setPendingCandidateContent(
          remainingBlocks.length > 0 ? candidateContent : null,
        );
        pendingCandidateContentRef.current = remainingBlocks.length > 0 ? candidateContent : null;
        return;
      }
      setChangeBlocks((previous) =>
        previous.map((item) =>
          item.id === id ? { ...item, status: "conflict" } : item,
        ),
      );
    },
    [applyAcceptedContent, changeBlocks, scheduleSave, activeDesignId],
  );

  const handleRejectChange = useCallback((id: string): void => {
    const block = changeBlocks.find((item) => item.id === id);
    const candidateContent = pendingCandidateContentRef.current;
    if (!block || !candidateContent) return;
    const nextCandidateContent = applyChangeBlock(candidateContent, {
      ...block,
      originalLines: block.candidateLines,
      candidateLines: block.originalLines,
    });
    if (nextCandidateContent === null) return;
    const nextBlocks = getChangeBlocks(contentRef.current, nextCandidateContent).map(
      (item) => ({ ...item, id: `ai-change-${nextChangeIdRef.current++}` }),
    );
    setChangeBlocks(nextBlocks);
    setPendingCandidateContent(nextBlocks.length > 0 ? nextCandidateContent : null);
    pendingCandidateContentRef.current = nextBlocks.length > 0 ? nextCandidateContent : null;
  }, [changeBlocks]);

  /**
   * 接受当前候选正文中的全部变更，并将结果加入保存队列。
   */
  const handleAcceptAllChanges = useCallback((): void => {
    const candidateContent = pendingCandidateContentRef.current;
    if (candidateContent === null || changeBlocks.length === 0) return;

    applyAcceptedContent(candidateContent);
    setChangeBlocks([]);
    setPendingCandidateContent(null);
    pendingCandidateContentRef.current = null;
    if (activeDesignId) scheduleSave(activeDesignId, candidateContent);
  }, [activeDesignId, applyAcceptedContent, changeBlocks.length, scheduleSave]);

  /**
   * 丢弃当前候选正文中的全部变更。
   */
  const handleRejectAllChanges = useCallback((): void => {
    if (changeBlocks.length === 0) return;
    setChangeBlocks([]);
    setPendingCandidateContent(null);
    pendingCandidateContentRef.current = null;
  }, [changeBlocks.length]);

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#000000]">
      <div className="flex min-w-0 flex-1 flex-col rounded-[6px] border border-white/5 bg-[#212121] shadow-inner overflow-hidden">
        <div className="min-h-0 flex-1 relative flex flex-col">
          {activeDesignId ? (
            <>
              <LoadingOverlay isLoading={isInitializing} text="Loading prompt..." />
              <MarkdownEditor
                aiChangeBlocks={changeBlocks}
                id="prompt-design-editor"
                showSaveStatus
                isSaved={!isInitializing && !isSaving && content === savedContent}
                onAcceptAiChange={handleAcceptChange}
                onAcceptAllAiChanges={handleAcceptAllChanges}
                onBlur={handleEditorBlur}
                onChange={handleEditorContentChange}
                onRejectAiChange={handleRejectChange}
                onRejectAllAiChanges={handleRejectAllChanges}
                placeholder="在此编辑提示词内容..."
                height="100%"
                defaultMode="edit"
                value={content}
                historyResetVersion={historyResetVersion}
                onEditorViewReady={handleEditorViewReady}
                onContextMenu={handleContextMenu}
                onModeChange={setEditorMode}
              />
              <PromptAiSlashCommandPanel
                isOpen={Boolean(markdownCommandLine && markdownCommandPosition)}
                commands={markdownCommandLine
                  ? getMarkdownSlashCommandOptions(markdownCommandLine.value)
                  : []}
                activeIndex={activeMarkdownCommandIndex}
                onActiveIndexChange={setActiveMarkdownCommandIndex}
                onCommandSelect={(command) => {
                  const view = editorViewRef.current;
                  const commandLine = view ? getSlashCommandLine(view) : null;
                  if (!view || !commandLine) return;
                  if (command.id === "newDesign") {
                    const insert = "/newDesign design[]";
                    view.dispatch({
                      changes: { from: commandLine.from, to: commandLine.to, insert },
                      selection: { anchor: commandLine.from + insert.length - 1 },
                    });
                    return;
                  }
                  if (command.id === "title") {
                    const insert = "/title ";
                    view.dispatch({
                      changes: { from: commandLine.from, to: commandLine.to, insert },
                      selection: { anchor: commandLine.from + insert.length },
                    });
                    return;
                  }
                  if (command.id !== "root" && command.id !== "change") return;
                  const insert = applyPromptAction(commandLine.value, command.id);
                  view.dispatch({
                    changes: { from: commandLine.from, to: commandLine.to, insert },
                    selection: { anchor: commandLine.from + insert.length },
                  });
                }}
                idPrefix="prompt-markdown-slash-command"
                className="fixed z-[100] w-[360px]"
                style={markdownCommandPosition ?? undefined}
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
      {contextMenu && <PromptDesignContextMenu x={contextMenu.x} y={contextMenu.y} isEditMode={contextMenu.mode !== "preview"} canPaste={contextMenu.mode !== "preview"} canQuote={contextMenu.mode !== "preview" && contextMenu.view.state.selection.main.from !== contextMenu.view.state.selection.main.to} onCopy={() => void copySelection(contextMenu.view)} onPaste={() => { void navigator.clipboard.readText().then((text) => contextMenu.view.dispatch(contextMenu.view.state.replaceSelection(text))).catch(() => toast.error("剪贴板操作失败")); setContextMenu(null); }} onCut={() => void copySelection(contextMenu.view, true)} onQuote={handleQuote} onClose={() => setContextMenu(null)} />}
      <PromptAiSidebar
        isOpen={isPromptAiSidebarOpen}
        mcpStatus={mcpStatus}
        onClose={onClosePromptAiSidebar}
        controller={controller}
        onReferenceSelect={handleReferenceSelect}
        chatInputFocusVersion={chatInputFocusVersion}
      />
    </div>
  );
};
