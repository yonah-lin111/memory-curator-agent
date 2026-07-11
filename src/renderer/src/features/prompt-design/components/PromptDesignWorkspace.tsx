import type React from "react";
import { useCallback, useRef, useState } from "react";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import type { MarkdownEditorChangeBlock } from "@/components/ui/MarkdownEditor";
import { PromptAiSidebar } from "@/features/prompt-design/components/PromptAiSidebar";

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
const toLines = (content: string): string[] => content === "" ? [] : content.split("\n");

/**
 * 找出两个文本版本中每个连续且不相交的变更块。
 */
const getChangeBlocks = (originalContent: string, candidateContent: string): Omit<MarkdownEditorChangeBlock, "id">[] => {
  const originalLines = toLines(originalContent);
  const candidateLines = toLines(candidateContent);
  const table = Array.from({ length: originalLines.length + 1 }, () => Array<number>(candidateLines.length + 1).fill(0));

  for (let originalIndex = originalLines.length - 1; originalIndex >= 0; originalIndex -= 1) {
    for (let candidateIndex = candidateLines.length - 1; candidateIndex >= 0; candidateIndex -= 1) {
      table[originalIndex][candidateIndex] = originalLines[originalIndex] === candidateLines[candidateIndex]
        ? table[originalIndex + 1][candidateIndex + 1] + 1
        : Math.max(table[originalIndex + 1][candidateIndex], table[originalIndex][candidateIndex + 1]);
    }
  }

  const matches: MatchedLine[] = [];
  let originalIndex = 0;
  let candidateIndex = 0;
  while (originalIndex < originalLines.length && candidateIndex < candidateLines.length) {
    if (originalLines[originalIndex] === candidateLines[candidateIndex]) {
      matches.push({ originalIndex, candidateIndex });
      originalIndex += 1;
      candidateIndex += 1;
    } else if (table[originalIndex + 1][candidateIndex] >= table[originalIndex][candidateIndex + 1]) {
      originalIndex += 1;
    } else {
      candidateIndex += 1;
    }
  }

  const boundaries = [
    { originalIndex: -1, candidateIndex: -1 },
    ...matches,
    { originalIndex: originalLines.length, candidateIndex: candidateLines.length },
  ];

  return boundaries.flatMap((boundary, index) => {
    const next = boundaries[index + 1];
    if (!next) return [];
    const changedOriginalLines = originalLines.slice(boundary.originalIndex + 1, next.originalIndex);
    const changedCandidateLines = candidateLines.slice(boundary.candidateIndex + 1, next.candidateIndex);
    if (changedOriginalLines.length === 0 && changedCandidateLines.length === 0) return [];

    return [{
      originalLines: changedOriginalLines,
      candidateLines: changedCandidateLines,
      beforeLine: boundary.originalIndex >= 0 ? originalLines[boundary.originalIndex] : undefined,
      afterLine: next.originalIndex < originalLines.length ? originalLines[next.originalIndex] : undefined,
    }];
  });
};

/**
 * 在当前正文中定位变更块，避免将过期建议写入用户手动修改后的内容。
 */
const applyChangeBlock = (content: string, block: MarkdownEditorChangeBlock): string | null => {
  const lines = toLines(content);
  const originalLength = block.originalLines.length;

  // 优先匹配包含上下文锚点的块
  for (let index = 0; index <= lines.length - originalLength; index += 1) {
    const isOriginalMatch = block.originalLines.every((line, offset) => lines[index + offset] === line);
    const hasBeforeAnchor = block.beforeLine === undefined || lines[index - 1] === block.beforeLine;
    const hasAfterAnchor = block.afterLine === undefined || lines[index + originalLength] === block.afterLine;
    if (isOriginalMatch && hasBeforeAnchor && hasAfterAnchor) {
      return [...lines.slice(0, index), ...block.candidateLines, ...lines.slice(index + originalLength)].join("\n");
    }
  }

  // 退避方案：如果原始行不为空且在文档中唯一，允许无锚点匹配
  if (originalLength > 0) {
    let matchIndex = -1;
    let matchCount = 0;
    for (let index = 0; index <= lines.length - originalLength; index += 1) {
      const isOriginalMatch = block.originalLines.every((line, offset) => lines[index + offset] === line);
      if (isOriginalMatch) {
        matchCount += 1;
        matchIndex = index;
      }
    }
    if (matchCount === 1) {
      return [...lines.slice(0, matchIndex), ...block.candidateLines, ...lines.slice(matchIndex + originalLength)].join("\n");
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
  const [changeBlocks, setChangeBlocks] = useState<MarkdownEditorChangeBlock[]>([]);
  const contentRef = useRef(content);
  const nextChangeIdRef = useRef(0);
  const pendingProgrammaticContentsRef = useRef<Set<string>>(new Set());

  /**
   * 用户直接编辑时废弃基于旧快照的候选变更。
   */
  const handleEditorContentChange = useCallback((nextContent: string): void => {
    contentRef.current = nextContent;
    setContent(nextContent);

    if (pendingProgrammaticContentsRef.current.has(nextContent)) {
      pendingProgrammaticContentsRef.current.delete(nextContent);
    } else {
      setChangeBlocks([]);
      pendingProgrammaticContentsRef.current.clear();
    }
  }, []);

  /**
   * 将 AI 候选文本转换为可独立审阅的连续变更块。
   */
  const handleEditorSuggestion = useCallback((originalContent: string, candidateContent: string): void => {
    const blocks = getChangeBlocks(originalContent, candidateContent).map((block) => ({
      ...block,
      id: `ai-change-${nextChangeIdRef.current++}`,
    }));
    setChangeBlocks((previous) => [...previous, ...blocks]);
  }, []);

  /**
   * 仅在变更块仍可定位到原文时应用，防止静默覆盖。
   */
  const handleAcceptChange = useCallback((id: string): void => {
    const block = changeBlocks.find((item) => item.id === id);
    if (!block) return;

    const nextContent = applyChangeBlock(contentRef.current, block);
    if (nextContent !== null) {
      pendingProgrammaticContentsRef.current.add(nextContent);
      contentRef.current = nextContent;
      setContent(nextContent);

      setChangeBlocks((previous) => previous
        .filter((item) => item.id !== id)
        .map((item) => {
          let beforeLine = item.beforeLine;
          let afterLine = item.afterLine;

          if (block.originalLines.length > 0) {
            const lastOrig = block.originalLines[block.originalLines.length - 1];
            if (beforeLine === lastOrig) {
              beforeLine = block.candidateLines.length > 0
                ? block.candidateLines[block.candidateLines.length - 1]
                : block.beforeLine;
            }

            const firstOrig = block.originalLines[0];
            if (afterLine === firstOrig) {
              afterLine = block.candidateLines.length > 0
                ? block.candidateLines[0]
                : block.afterLine;
            }
          }

          return {
            ...item,
            beforeLine,
            afterLine,
          };
        })
      );
      return;
    }
    setChangeBlocks((previous) => previous.map((item) => (
      item.id === id ? { ...item, status: "conflict" } : item
    )));
  }, [changeBlocks]);

  const handleRejectChange = useCallback((id: string): void => {
    setChangeBlocks((previous) => previous.filter((item) => item.id !== id));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#000000]">
      <div className="flex min-w-0 flex-1 flex-col rounded-[6px] border border-white/5 bg-[#212121] shadow-inner overflow-hidden">
        <div className="min-h-0 flex-1">
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
          />
        </div>
      </div>
      <PromptAiSidebar
        isOpen={isPromptAiSidebarOpen}
        editorContent={content}
        onEditorSuggestion={handleEditorSuggestion}
        onClose={onClosePromptAiSidebar}
      />
    </div>
  );
};
