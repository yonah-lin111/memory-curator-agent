import { useCallback, useEffect, useRef, useState } from "react";
import { Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { StateEffect, StateField, Prec } from "@codemirror/state";
import { FileText } from "lucide-react";
import { CommandPanel } from "@/components/ai-shared/CommandPanel";
import { usePromptDesignStore } from "@/features/prompt-design/store/promptDesignStore";
import type { AgentMentionPanelState } from "@/lib/ai-shared/types";
import { resolveAgentMentionPanelState, getFileMentionDeletionRange } from "@/lib/ai-shared/utils";

type ActiveProject = { id: string; path?: string };
type MentionPanelPosition = { left: number; top: number | "auto"; bottom: number | "auto"; maxHeight?: string };
type FileMentionRange = { from: number; to: number };

const addFileMentionEffect = StateEffect.define<FileMentionRange>();
const fileMentionDecoration = Decoration.mark({ class: "cm-file-mention" });

/**
 * 维护由文件提及面板插入的精确范围，避免手输 @token 被误标。
 */
const fileMentionField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (decorations, transaction) => {
    const mappedDecorations = decorations.map(transaction.changes);
    const effects = transaction.effects.filter((effect) => effect.is(addFileMentionEffect));
    return effects.reduce(
      (nextDecorations, effect) => nextDecorations.update({ add: [fileMentionDecoration.range(effect.value.from, effect.value.to)] }),
      mappedDecorations,
    );
  },
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * 为 CodeMirror 编辑器提供当前项目文件 @ 提及能力。
 */
export const useMarkdownFileMention = (enabled: boolean) => {
  const activeProjectId = usePromptDesignStore((state) => state.activeProjectId);
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(null);
  const [panelState, setPanelState] = useState<AgentMentionPanelState | null>(null);
  const [matchedFiles, setMatchedFiles] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelPosition, setPanelPosition] = useState<MentionPanelPosition | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isComposingRef = useRef(false);
  const panelStateRef = useRef<AgentMentionPanelState | null>(null);
  const matchedFilesRef = useRef<string[]>([]);
  const activeIndexRef = useRef(0);

  useEffect(() => {
    if (!enabled || !activeProjectId) {
      setActiveProject(null);
      return undefined;
    }

    let isCurrent = true;
    window.api.promptDesign?.projects.list()
      ?.then((projects: ActiveProject[]) => {
        if (isCurrent) setActiveProject(projects.find((project) => project.id === activeProjectId) ?? null);
      })
      .catch((error: unknown) => console.error("获取当前项目失败:", error));

    return () => {
      isCurrent = false;
    };
  }, [activeProjectId, enabled]);

  useEffect(() => {
    if (!panelState || !activeProject?.path) {
      setMatchedFiles([]);
      return undefined;
    }

    let isCurrent = true;
    window.api.promptDesign?.searchFiles(activeProject.path, panelState.query)
      ?.then((files) => {
        if (isCurrent) {
          setMatchedFiles(files);
          setActiveIndex(0);
        }
      })
      .catch((error: unknown) => console.error("搜索项目文件失败:", error));

    return () => {
      isCurrent = false;
    };
  }, [activeProject?.path, panelState?.query]);

  useEffect(() => {
    panelStateRef.current = panelState;
  }, [panelState]);

  useEffect(() => {
    matchedFilesRef.current = matchedFiles;
  }, [matchedFiles]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const closePanel = useCallback((): void => {
    setPanelState(null);
    setMatchedFiles([]);
    setActiveIndex(0);
    setPanelPosition(null);
  }, []);

  const syncPanel = useCallback((view: EditorView): void => {
    if (isComposingRef.current) return;

    const cursor = view.state.selection.main.head;
    const nextState = resolveAgentMentionPanelState(view.state.doc.toString(), cursor);
    if (!nextState || !activeProject?.path) {
      closePanel();
      return;
    }

    const coords = view.coordsAtPos(cursor);
    if (!coords) {
      closePanel();
      return;
    }

    setPanelState(nextState);
    setActiveIndex(0);

    // 测算剩余视口空间以决定面板展示在光标上方还是下方
    const spaceBelow = window.innerHeight - coords.bottom;
    const panelHeight = window.innerHeight * 0.3; // 固定的面板参考高度为可用视口的 30%
    const offset = 6;

    if (spaceBelow < panelHeight) {
      // 只要下方空间不足，一律置顶，并通过计算可用空间设置最大高度以避免溢出
      const maxAvailableHeight = Math.min(panelHeight, Math.max(0, coords.top - offset - 16)); // 留出顶部安全边距，且不超过 30vh (panelHeight) 及真实可用高度
      setPanelPosition({
        left: Math.min(Math.max(coords.left, 8), Math.max(window.innerWidth - 368, 8)),
        top: "auto",
        bottom: window.innerHeight - coords.top + offset,
        maxHeight: `${maxAvailableHeight}px`,
      });
    } else {
      // 否则定位在光标下方，并通过计算可用空间设置最大高度以避免溢出
      const maxAvailableHeight = Math.min(panelHeight, Math.max(0, spaceBelow - offset - 16)); // 限制在 30vh 且绝不超出真实可用高度
      setPanelPosition({
        left: Math.min(Math.max(coords.left, 8), Math.max(window.innerWidth - 368, 8)),
        top: coords.bottom + offset,
        bottom: "auto",
        maxHeight: `${maxAvailableHeight}px`,
      });
    }
  }, [activeProject?.path, closePanel]);
  const syncPanelRef = useRef(syncPanel);
  syncPanelRef.current = syncPanel;

  const selectFile = useCallback((path: string): void => {
    const view = viewRef.current;
    const state = panelStateRef.current;
    if (!view || !state) return;

    const cursor = view.state.selection.main.head;
    const insert = `@${path} `;
    const nextCursor = state.start + insert.length;
    view.dispatch({
      changes: { from: state.start, to: cursor, insert },
      selection: { anchor: nextCursor },
      effects: addFileMentionEffect.of({ from: state.start, to: state.start + insert.length - 1 }),
      userEvent: "input.complete",
    });
    view.focus();
    closePanel();
  }, [closePanel]);
  const selectFileRef = useRef(selectFile);
  selectFileRef.current = selectFile;

  const handleEditorViewReady = useCallback((view: EditorView): void => {
    if (viewRef.current === view) return;
    viewRef.current = view;

    view.dispatch({
      effects: StateEffect.appendConfig.of([
        fileMentionField,
        EditorView.updateListener.of((update) => {
          if (update.docChanged || update.selectionSet) syncPanelRef.current(update.view);
        }),
        Prec.high(
          EditorView.domEventHandlers({
            compositionstart: () => {
              isComposingRef.current = true;
              return false;
            },
            compositionend: (_event, editorView) => {
              isComposingRef.current = false;
              syncPanelRef.current(editorView);
              return false;
            },
            keydown: (event, view) => {
              if (isComposingRef.current || event.isComposing) return false;

              const hasMatchedFiles = matchedFilesRef.current.length > 0;
              const isPanelOpen = Boolean(panelStateRef.current && hasMatchedFiles);

              if (isPanelOpen) {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const direction = event.key === "ArrowDown" ? 1 : -1;
                  setActiveIndex((index) => (index + direction + matchedFilesRef.current.length) % matchedFilesRef.current.length);
                  return true;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  closePanel();
                  return true;
                }
                if (event.key === "Enter" && panelStateRef.current) {
                  event.preventDefault();
                  selectFileRef.current(matchedFilesRef.current[activeIndexRef.current] ?? matchedFilesRef.current[0]);
                  return true;
                }
              }

              if (event.key === "Backspace" && !isPanelOpen) {
                const { selection } = view.state;
                if (selection.main.empty) {
                  const cursor = selection.main.head;
                  const docText = view.state.doc.toString();
                  const deletionRange = getFileMentionDeletionRange(docText, cursor);
                  if (deletionRange) {
                    event.preventDefault();
                    view.dispatch({
                      changes: { from: deletionRange.start, to: deletionRange.end, insert: "" },
                      selection: { anchor: deletionRange.start },
                      userEvent: "delete.backward",
                    });
                    closePanel();
                    return true;
                  }
                }
              }
              return false;
            },
          })
        ),
      ]),
    });
    syncPanelRef.current(view);
  }, [closePanel]);

  const isOpen = Boolean(panelState && panelPosition && matchedFiles.length > 0);

  const mentionPanel = (
    <CommandPanel
      isOpen={isOpen}
      ariaLabel="项目文件提及"
      items={matchedFiles.map((path) => ({ id: path, path }))}
      activeIndex={activeIndex}
      onActiveIndexChange={setActiveIndex}
      onItemSelect={(item) => selectFile(item.path)}
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
      idPrefix="prompt-markdown-file-mention"
      className="fixed z-[100] w-[360px]"
      style={panelPosition ? {
        left: panelPosition.left,
        top: panelPosition.top,
        right: "auto",
        bottom: panelPosition.bottom,
        maxHeight: panelPosition.maxHeight,
      } : undefined}
    />
  );

  return { handleEditorViewReady, mentionPanel };
};
