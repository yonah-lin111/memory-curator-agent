import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { usePromptDesignStore } from "@/features/prompt-design/store/promptDesignStore";
import { PromptAiSidebar } from "@/features/prompt-design/components/PromptAiSidebar";
import { PromptEditorContextMenu } from "@/features/prompt-design/components/PromptEditorContextMenu";
import { generateStructuredPrompt, DEFAULT_TEMPLATE } from "@/features/prompt-design/utils/generator";
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  linkPlugin,
  linkDialogPlugin,
  codeBlockPlugin,
  markdownShortcutPlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  diffSourcePlugin,
  type MDXEditorMethods,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

/** 暗黑主题下 Lexical 编辑器节点样式映射 */
const DARK_LEXICAL_THEME = {
  paragraph: "mx-0 my-1 text-[13px] text-white/80",
  heading: {
    h1: "text-2xl font-semibold text-white/90 mb-3 mt-5",
    h2: "text-xl font-semibold text-white/90 mb-2.5 mt-4",
    h3: "text-lg font-medium text-white/85 mb-2 mt-3.5",
    h4: "text-base font-medium text-white/85 mb-1.5 mt-3",
    h5: "text-sm font-medium text-white/80 mb-1 mt-2.5",
    h6: "text-xs font-medium text-white/75 mb-0.5 mt-2",
  },
  quote: "border-l-2 border-white/20 pl-3 italic text-white/55 my-3",
  list: {
    ul: "list-disc pl-5 my-1.5",
    ol: "list-decimal pl-5 my-1.5",
    listitem: "text-[13px] text-white/80 my-0.5",
    nested: {
      listitem: "text-[13px] text-white/80 my-0.5",
    },
  },
  text: {
    bold: "font-semibold text-white/90",
    italic: "italic text-white/85",
    underline: "underline text-white/85",
    strikethrough: "line-through text-white/60",
    code: "bg-white/10 rounded-[4px] px-1 py-0.5 font-mono text-[12px] text-white/85",
  },
  link: "text-blue-400 underline underline-offset-2",
  code: "bg-[#1a1a1a] rounded-[6px] px-3 py-2.5 my-2 font-mono text-[12px] text-white/80",
  table: "w-full border-collapse my-3",
  tableCell: "border border-white/10 px-3 py-1.5 text-[13px] text-white/80",
  tableCellHeader: "bg-white/5 text-white/85 font-medium",
  hr: "border-white/10 my-4",
};

/** 右键菜单状态 */
interface ContextMenuState {
  x: number;
  y: number;
}

interface PromptDesignWorkspaceProps {
  isOpen: boolean;
  isPromptAiSidebarOpen?: boolean;
  onClosePromptAiSidebar?: () => void;
}

/**
 * PromptDesignWorkspace - 提示词设计工作区组件。
 * 提供 MDXEditor 的双向绑定 Markdown 编辑/预览区域，并挂载定制化 Lexical 插件。
 */
export const PromptDesignWorkspace = ({
  isOpen,
  isPromptAiSidebarOpen = false,
  onClosePromptAiSidebar
}: PromptDesignWorkspaceProps): React.JSX.Element | null => {
  const activeDesignId = usePromptDesignStore((state) => state.activeDesignId);
  const format = usePromptDesignStore((state) => state.previewFormat);
  const [compiledPrompt, setCompiledPrompt] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 编辑器实例引用，用于在切换设计时动态更新内容
  const editorRef = useRef<MDXEditorMethods>(null);

  // 防止 onChange -> setCompiledPrompt -> useEffect -> setMarkdown 的无限循环
  const skipSetMarkdownRef = useRef(false);

  // 右键菜单状态
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);

  /**
   * 处理编辑器内容变更
   */
  const handleMarkdownChange = useCallback((markdown: string) => {
    skipSetMarkdownRef.current = true;
    setCompiledPrompt(markdown);
  }, []);

  /**
   * 当编译后的提示词因设计切换或格式变更而更新时，同步到编辑器
   */
  useEffect(() => {
    if (skipSetMarkdownRef.current) {
      skipSetMarkdownRef.current = false;
      return;
    }
    if (editorRef.current && compiledPrompt) {
      editorRef.current.setMarkdown(compiledPrompt);
    }
  }, [compiledPrompt]);

  /**
   * 加载设计数据并编译提示词
   */
  useEffect(() => {
    if (!isOpen || !activeDesignId) {
      setCompiledPrompt("");
      setIsLoading(false);
      return;
    }

    const fetchDesignData = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const list = await (window.api as any).promptDesign.designs.list();
        const currentDesign = list.find((d: any) => d.id === activeDesignId);

        let nodes = DEFAULT_TEMPLATE.nodes;
        let edges = DEFAULT_TEMPLATE.edges;

        if (currentDesign && currentDesign.designData) {
          nodes = currentDesign.designData.nodes || [];
          edges = currentDesign.designData.edges || [];
        }

        const prompt = generateStructuredPrompt(nodes, edges, format);
        setCompiledPrompt(prompt);
      } catch (err) {
        console.error("加载设计提示词数据失败:", err);
        setCompiledPrompt("## 错误\n\n未能成功加载该设计的结构化提示词数据。");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDesignData();
  }, [activeDesignId, isOpen, format]);

  /**
   * 处理编辑器区域右键菜单
   */
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuState({ x: e.clientX, y: e.clientY });
  }, []);

  /**
   * 关闭右键菜单
   */
  const handleCloseContextMenu = useCallback(() => {
    setContextMenuState(null);
  }, []);

  // 编辑器插件集 - 不包含可见工具栏，仅保留核心编辑插件及自定义斜杠菜单
  const editorPlugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      codeBlockPlugin(),
      markdownShortcutPlugin(),
      thematicBreakPlugin(),
      diffSourcePlugin(),
      // 保留 toolbarPlugin 作为 Realm 内渲染右键菜单的容器（工具栏视觉上隐藏）
      toolbarPlugin({
        toolbarContents: () => (
          <>
            {contextMenuState && (
              <PromptEditorContextMenu
                x={contextMenuState.x}
                y={contextMenuState.y}
                onClose={handleCloseContextMenu}
              />
            )}
          </>
        ),
      }),
    ],
    [contextMenuState, handleCloseContextMenu]
  );

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-full bg-[#000000] text-white overflow-hidden">
      {/* 左侧提示词预览/编辑区 */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        {/* 主编辑区 */}
        <div
          className="flex-1 bg-[#212121] rounded-[6px] border border-white/5 p-4 overflow-hidden shadow-inner relative flex flex-col dark-theme mdxeditor-dark-container"
          onContextMenu={handleContextMenu}
        >
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-xs text-white/40">加载数据并编译提示词中...</span>
            </div>
          ) : compiledPrompt ? (
            <MDXEditor
              ref={editorRef}
              markdown={compiledPrompt}
              onChange={handleMarkdownChange}
              plugins={editorPlugins}
              contentEditableClassName="mdxeditor-content-area"
              className="mdxeditor-root flex-1 flex flex-col min-h-0 custom-scrollbar overflow-y-auto"
              lexicalTheme={DARK_LEXICAL_THEME}
              spellCheck={false}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-white/30 space-y-1">
              <span className="text-sm font-medium">未选中任何设计</span>
              <span className="text-xs text-white/20">请在左侧面板中选择一个设计开始预览</span>
            </div>
          )}
        </div>
      </div>

      {/* 右侧 AI 侧边栏 */}
      <PromptAiSidebar isOpen={isPromptAiSidebarOpen} onClose={onClosePromptAiSidebar} />
    </div>
  );
};
