import type React from "react";
import { useCallback, useState, useEffect, useRef } from "react";
import { resolveAgentMentionPanelState, getFileMentionDeletionRange } from "@/lib/ai-shared/utils";
import type { AgentMentionPanelState } from "@/lib/ai-shared/types";
import { usePromptDesignStore } from "../store/promptDesignStore";
import { useToast } from "@/components/ui/Toast";

export const useFileMention = (
  inputText: string,
  setInputText: (value: string) => void,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  adjustTextareaHeight: () => void,
) => {
  const [fileMentionPanelState, setFileMentionPanelState] =
    useState<AgentMentionPanelState | null>(null);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [matchedFiles, setMatchedFiles] = useState<string[]>([]);
  // 使用此 ref 追踪选择是否发生在 IME 组合输入期间
  const isComposingRef = useRef(false);
  
  const activeProjectId = usePromptDesignStore((state) => state.activeProjectId);
  const [activeProject, setActiveProject] = useState<any>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const toastStore = useToast();

  useEffect(() => {
    if (activeProjectId) {
      setIsLoadingProject(true);
      let isCurrent = true;
      window.api.promptDesign?.projects.list()
        ?.then((projects: any[]) => {
          if (!isCurrent) return;
          const p = projects.find(p => p.id === activeProjectId);
          setActiveProject(p || null);
          setIsLoadingProject(false);
        })
        .catch((err: unknown) => {
          if (!isCurrent) return;
          console.error("Failed to fetch projects:", err);
          setIsLoadingProject(false);
        });
      return () => {
        isCurrent = false;
      };
    } else {
      setActiveProject(null);
      setIsLoadingProject(false);
    }
    return undefined;
  }, [activeProjectId]);

  const isFilePanelOpen = Boolean(
    fileMentionPanelState && matchedFiles.length > 0,
  );

  const closeFileMentionPanel = useCallback((): void => {
    setFileMentionPanelState(null);
    setActiveFileIndex(0);
    setMatchedFiles([]);
  }, []);

  const syncFileMentionPanel = useCallback((value: string, cursor: number): void => {
    const nextState = resolveAgentMentionPanelState(value, cursor);

    if (!nextState) {
      closeFileMentionPanel();
      return;
    }

    setFileMentionPanelState(nextState);
    setActiveFileIndex(0);
  }, [closeFileMentionPanel]);

  useEffect(() => {
    if (!fileMentionPanelState || isLoadingProject) {
      return;
    }

    if (!activeProject) {
      toastStore.error("未找到当前活动的本地项目");
      closeFileMentionPanel();
    } else if (!activeProject.path) {
      toastStore.error("当前项目不是本地文件系统项目，无法使用文件提及功能");
      closeFileMentionPanel();
    }
  }, [activeProject, isLoadingProject, fileMentionPanelState, closeFileMentionPanel, toastStore]);

  useEffect(() => {
    if (!fileMentionPanelState || !activeProject?.path) {
      setMatchedFiles([]);
      return;
    }

    let isMounted = true;

    window.api.promptDesign?.searchFiles(activeProject.path, fileMentionPanelState.query)
      ?.then((results: string[]) => {
        if (isMounted) {
          setMatchedFiles(results);
          setActiveFileIndex(0);
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to search files:", err);
        if (isMounted) {
          toastStore.error("文件搜索失败，请确保主重启");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [fileMentionPanelState?.query, activeProject?.path, toastStore]);

  const selectFileMention = useCallback((path: string): void => {
    const textarea = textareaRef.current;
    if (!textarea || !fileMentionPanelState) {
      return;
    }

    const cursor = textarea.selectionStart;
    const nextValue = `${inputText.slice(0, fileMentionPanelState.start)}@${path} ${inputText.slice(cursor)}`;
    const nextCursor = fileMentionPanelState.start + path.length + 2;

    setInputText(nextValue);
    closeFileMentionPanel();
    requestAnimationFrame(() => {
      adjustTextareaHeight();
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }, [inputText, fileMentionPanelState, setInputText, closeFileMentionPanel, adjustTextareaHeight, textareaRef]);

  const moveActiveFile = useCallback((direction: 1 | -1): void => {
    setActiveFileIndex((currentIndex) => {
      if (matchedFiles.length === 0) {
        return 0;
      }

      return (
        (currentIndex + direction + matchedFiles.length) %
        matchedFiles.length
      );
    });
  }, [matchedFiles.length]);

  const handleTextareaCursorMove = useCallback((): void => {
    const textarea = textareaRef.current;
    if (!textarea || !fileMentionPanelState) {
      return;
    }

    const nextState = resolveAgentMentionPanelState(
      textarea.value,
      textarea.selectionStart,
    );
    if (!nextState) {
      closeFileMentionPanel();
    }
  }, [fileMentionPanelState, closeFileMentionPanel, textareaRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposingRef.current) return;

    if (isFilePanelOpen) {
      if (e.key === "Enter") {
        e.preventDefault();
        selectFileMention(matchedFiles[activeFileIndex]);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActiveFile(-1);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActiveFile(1);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeFileMentionPanel();
        return;
      }
    }

    if (e.key === "Backspace" && !isFilePanelOpen) {
      const textarea = textareaRef.current;
      if (textarea && textarea.selectionStart === textarea.selectionEnd) {
        const deletionRange = getFileMentionDeletionRange(
          inputText,
          textarea.selectionStart,
        );
        if (deletionRange) {
          e.preventDefault();
          const nextValue = `${inputText.slice(0, deletionRange.start)}${inputText.slice(deletionRange.end)}`;
          setInputText(nextValue);
          closeFileMentionPanel();
          requestAnimationFrame(() => {
            adjustTextareaHeight();
            textarea.focus();
            textarea.setSelectionRange(deletionRange.start, deletionRange.start);
          });
        }
      }
    }
  }, [isFilePanelOpen, activeFileIndex, matchedFiles, selectFileMention, moveActiveFile, closeFileMentionPanel, inputText, setInputText, adjustTextareaHeight, textareaRef]);

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
  }, []);

  return {
    fileMentionPanelState,
    activeFileIndex,
    matchedFiles,
    isFilePanelOpen,
    setActiveFileIndex,
    syncFileMentionPanel,
    closeFileMentionPanel,
    selectFileMention,
    moveActiveFile,
    handleTextareaCursorMove,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
  };
};
