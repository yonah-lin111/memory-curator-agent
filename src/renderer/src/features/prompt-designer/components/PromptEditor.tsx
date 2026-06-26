import type React from "react";
import { useState, useEffect } from "react";
import { Play, Sparkles, Save, History, PanelRightOpen, Cpu } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { usePromptDesignerStore } from "../usePromptDesignerStore";

interface PromptEditorProps {
  onToggleAi: () => void;
  isAiOpen: boolean;
}

export const PromptEditor = ({ onToggleAi, isAiOpen }: PromptEditorProps): React.JSX.Element => {
  const { prompts, activePromptId, updatePromptContent, saveNewVersion } = usePromptDesignerStore();
  
  const activePrompt = prompts.find(p => p.id === activePromptId);
  const [localContent, setLocalContent] = useState("");
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (activePrompt) {
      setLocalContent(activePrompt.content);
      // Flash effect when switching prompts
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 200);
      return () => clearTimeout(timer);
    }
  }, [activePrompt?.id, activePrompt?.currentVersionNumber]); // Removed activePrompt?.content from dependencies to allow local editing

  if (!activePrompt) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
        请在左侧选择或创建一个提示词
      </div>
    );
  }

  const isDirty = localContent !== activePrompt.content;

  const handleSave = () => {
    if (isDirty) {
      updatePromptContent(activePrompt.id, localContent);
      saveNewVersion(activePrompt.id, "手动保存");
    }
  };

  // Highlighting variables like {{variable}}
  const renderHighlightedText = () => {
    if (!localContent) return null;
    const parts = localContent.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, index) => {
      if (part.startsWith("{{") && part.endsWith("}}")) {
        return (
          <span key={index} className="bg-amber-500/20 text-amber-300 px-1 rounded mx-0.5 font-mono text-xs cursor-pointer hover:bg-amber-500/30">
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#141414] relative">
      {/* Tool bar */}
      <div className="h-12 border-b border-white/5 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-medium text-white/90">{activePrompt.name}</h1>
          {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
        </div>
        
        <div className="flex items-center gap-2">
          <Select
            value={activePrompt.currentVersionNumber.toString()}
            onChange={(v) => console.log('switch version to', v)}
            options={activePrompt.versions.map(v => ({
              value: v.versionNumber.toString(),
              label: `v${v.versionNumber} ${v.notes ? `(${v.notes})` : ""}`
            }))}
            className="w-32"
          />
          
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          
          <IconButton 
            size="small" 
            title="测试提示词"
            className="text-white/60 hover:text-emerald-400 hover:bg-emerald-400/10"
          >
            <Play className="w-3.5 h-3.5" />
          </IconButton>
          
          <IconButton 
            size="small" 
            title="AI 优化"
            className="text-white/60 hover:text-amber-400 hover:bg-amber-400/10"
            onClick={() => !isAiOpen && onToggleAi()}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </IconButton>
          
          <IconButton 
            size="small" 
            title="保存 (Cmd+S)"
            disabled={!isDirty}
            onClick={handleSave}
            className={isDirty ? "text-amber-400" : ""}
          >
            <Save className="w-3.5 h-3.5" />
          </IconButton>

          {!isAiOpen && (
            <>
              <div className="w-px h-4 bg-white/10 mx-1"></div>
              <IconButton size="small" onClick={onToggleAi} title="打开 AI 助手 (Cmd+J)">
                <PanelRightOpen className="w-3.5 h-3.5" />
              </IconButton>
            </>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className={`flex-1 relative transition-colors duration-200 ${isFlashing ? "bg-white/5" : ""}`}>
        {/* Transparent textarea for input, layered over highlighted text */}
        <textarea
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          className="absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-white resize-none outline-none font-mono text-[13px] leading-relaxed z-10 whitespace-pre-wrap"
          spellCheck={false}
          placeholder="在此输入提示词内容... 使用 {{变量名}} 添加插值变量"
        />
        {/* Rendered text for highlighting */}
        <div className="absolute inset-0 w-full h-full p-4 pointer-events-none font-mono text-[13px] leading-relaxed text-white/80 whitespace-pre-wrap break-words overflow-hidden">
          {localContent ? renderHighlightedText() : (
             <span className="text-white/20">在此输入提示词内容... 使用 {'{{变量名}}'} 添加插值变量</span>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-7 border-t border-white/5 bg-[#1A1A1A] px-4 flex items-center justify-between text-[11px] text-white/40 font-mono">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5" title="预估 Token 数 (1 Token ≈ 0.75 中文)">
            <Cpu className="w-3 h-3" />
            <span>~{Math.round(localContent.length * 1.3)} Tokens</span>
          </div>
          <span>{localContent.length} 字符</span>
        </div>
        <div>
          最后更新: {new Date(activePrompt.updatedAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};
