import { FileText } from "lucide-react";
import { CommandPanel } from "@/components/ai-shared/CommandPanel";

// 提示词 AI 斜杠命令的公共形状。
export interface PromptAiInputCommand {
  id: string;
  name: string;
  description: string;
}

// 文件提及候选项。
type FileMentionItem = {
  id: string;
  path: string;
};

// 斜杠命令面板属性。
type PromptAiSlashCommandPanelProps = {
  isOpen: boolean;
  commands: PromptAiInputCommand[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onCommandSelect: (command: PromptAiInputCommand) => void;
  idPrefix: string;
  style?: React.CSSProperties;
  className?: string;
};

/**
 * 统一渲染提示词 AI 输入框的斜杠命令候选面板。
 */
export const PromptAiSlashCommandPanel = ({
  isOpen,
  commands,
  activeIndex,
  onActiveIndexChange,
  onCommandSelect,
  idPrefix,
  style,
  className,
}: PromptAiSlashCommandPanelProps): React.JSX.Element | null => (
  <CommandPanel
    isOpen={isOpen}
    ariaLabel="斜杠命令"
    items={commands}
    activeIndex={activeIndex}
    onActiveIndexChange={onActiveIndexChange}
    onItemSelect={onCommandSelect}
    renderItem={(command) => (
      <div className="flex w-full items-center gap-3">
        <span className="shrink-0 text-sm font-medium">{command.name}</span>
        <span className="flex-1 truncate text-left text-xs text-white/50">
          {command.description}
        </span>
      </div>
    )}
    idPrefix={idPrefix}
    style={style}
    className={className}
  />
);

// 文件提及面板属性。
type PromptAiFileMentionPanelProps = {
  isOpen: boolean;
  paths: string[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onPathSelect: (path: string) => void;
  idPrefix: string;
  style?: React.CSSProperties;
};

/**
 * 统一渲染提示词 AI 输入框的文件提及候选面板。
 */
export const PromptAiFileMentionPanel = ({
  isOpen,
  paths,
  activeIndex,
  onActiveIndexChange,
  onPathSelect,
  idPrefix,
  style,
}: PromptAiFileMentionPanelProps): React.JSX.Element | null => (
  <CommandPanel<FileMentionItem>
    isOpen={isOpen}
    ariaLabel="文件提及"
    items={paths.map((path) => ({ id: path, path }))}
    activeIndex={activeIndex}
    onActiveIndexChange={onActiveIndexChange}
    onItemSelect={(item) => onPathSelect(item.path)}
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
    idPrefix={idPrefix}
    style={style}
  />
);
