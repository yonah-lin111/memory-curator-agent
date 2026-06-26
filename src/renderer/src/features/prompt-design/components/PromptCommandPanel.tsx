import React, { useEffect, useRef } from "react";
import { FileText, Trash2, Edit2, Download, Search, Layout, FolderSync, XSquare } from "lucide-react";

interface CommandItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  action: string;
}

const COMMANDS: CommandItem[] = [
  { id: "new-card", icon: <FileText className="w-4 h-4" />, label: "/new-card", description: "创建新提示词卡片", action: "new-card" },
  { id: "delete-card", icon: <Trash2 className="w-4 h-4" />, label: "/delete-card", description: "删除当前选中卡片", action: "delete-card" },
  { id: "rename", icon: <Edit2 className="w-4 h-4" />, label: "/rename", description: "重命名当前选中卡片", action: "rename" },
  { id: "export", icon: <Download className="w-4 h-4" />, label: "/export", description: "导出当前流程", action: "export" },
  { id: "read-file", icon: <Search className="w-4 h-4" />, label: "/read-file", description: "读取本地文件内容", action: "read-file" },
  { id: "switch-proj", icon: <FolderSync className="w-4 h-4" />, label: "/switch-proj", description: "切换项目", action: "switch-proj" },
  { id: "layout", icon: <Layout className="w-4 h-4" />, label: "/layout", description: "自动排列画布节点", action: "layout" },
  { id: "clear", icon: <XSquare className="w-4 h-4" />, label: "/clear", description: "清空对话上下文", action: "clear" },
];

interface PromptCommandPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (command: CommandItem) => void;
  filterText?: string;
}

export const PromptCommandPanel: React.FC<PromptCommandPanelProps> = ({
  isOpen,
  onClose,
  onSelect,
  filterText = "",
}) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const filteredCommands = React.useMemo(() => {
    if (!filterText) return COMMANDS;
    const lowerFilter = filterText.toLowerCase();
    return COMMANDS.filter(cmd => 
      cmd.label.toLowerCase().includes(lowerFilter) || 
      cmd.description.toLowerCase().includes(lowerFilter)
    );
  }, [filterText]);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
    }
  }, [isOpen, filterText]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onSelect, onClose]);

  if (!isOpen || filteredCommands.length === 0) return null;

  return (
    <div 
      ref={panelRef}
      className="absolute bottom-full mb-2 left-0 w-full max-h-64 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-y-auto flex flex-col py-1 z-50"
    >
      {filteredCommands.map((cmd, index) => (
        <button
          key={cmd.id}
          className={`flex items-center space-x-3 px-3 py-2 text-left transition-colors ${
            index === selectedIndex ? "bg-white/10" : "hover:bg-white/5"
          }`}
          onClick={() => onSelect(cmd)}
        >
          <div className="flex items-center justify-center w-6 h-6 rounded bg-white/5 text-white/70">
            {cmd.icon}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-white/90">{cmd.label}</span>
            <span className="text-[10px] text-white/40">{cmd.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
};
