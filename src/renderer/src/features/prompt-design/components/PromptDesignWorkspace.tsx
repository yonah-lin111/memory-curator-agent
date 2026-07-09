import React, { useState, useEffect } from "react";
import { usePromptDesignStore } from "../store/promptDesignStore";
import { PromptAiSidebar } from "./PromptAiSidebar";
import { generateStructuredPrompt, DEFAULT_TEMPLATE } from "../utils/generator";
import { MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";

interface PromptDesignWorkspaceProps {
  isOpen: boolean;
  isPromptAiSidebarOpen?: boolean;
  onClosePromptAiSidebar?: () => void;
}

export const PromptDesignWorkspace = ({
  isOpen,
  isPromptAiSidebarOpen = false,
  onClosePromptAiSidebar
}: PromptDesignWorkspaceProps): React.JSX.Element | null => {
  const activeDesignId = usePromptDesignStore((state) => state.activeDesignId);
  const format = usePromptDesignStore((state) => state.previewFormat);
  const [compiledPrompt, setCompiledPrompt] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !activeDesignId) {
      setCompiledPrompt("");
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

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-full bg-[#000000] text-white overflow-hidden">
      {/* 左侧提示词预览区 */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        {/* 主预览区 */}
        <div className="flex-1 bg-[#212121] rounded-[6px] border border-white/5 p-4 overflow-y-auto select-text scrollbar-thin shadow-inner relative flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-xs text-white/40">加载数据并编译提示词中...</span>
            </div>
          ) : compiledPrompt ? (
            <div className="markdown-preview-container curator-markdown-preview select-text max-w-full">
              <MdPreview
                theme="dark"
                modelValue={compiledPrompt}
                previewTheme="default"
                codeTheme="atom"
                style={{ backgroundColor: "transparent" }}
                showCodeRowNumber={false}
              />
            </div>
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
