import type React from "react";
import { useEffect, useState } from "react";
import { Cpu, RefreshCcw, FileText, Info } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface AiAgentSkill {
  id: string;
  name: string;
  description: string;
  supportedAgents?: string[];
  content: string;
  location: string;
}

/**
 * SkillsSection - 智能体技能展示、热重载管理设置板块。
 */
export const SkillsSection = (): React.JSX.Element => {
  const toast = useToast();
  const [skills, setSkills] = useState<AiAgentSkill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<AiAgentSkill | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 拉取本地所有已解析的 Markdown 技能文件列表。
  const fetchSkills = async (forceRefresh = false): Promise<void> => {
    if (!window.api?.skills) return;
    try {
      setIsLoading(true);
      const list = await window.api.skills.list(forceRefresh);
      setSkills(list || []);
      if (list && list.length > 0) {
        // 默认选中第一个
        setSelectedSkill(list[0]);
      } else {
        setSelectedSkill(null);
      }
    } catch (error) {
      console.error("Failed to load skills in SettingsPage:", error);
      toast.error("加载本地智能体技能失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills(false);
  }, []);

  // 执行热刷新：清除主进程缓存并重新扫描目录。
  const handleReload = async (): Promise<void> => {
    if (!window.api?.skills) return;
    try {
      setIsLoading(true);
      await window.api.skills.clearCache();
      await fetchSkills(true);
      toast.success("技能已热刷新！支持在磁盘修改后即时热加载。");
    } catch {
      toast.error("刷新失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Cpu className="h-5 w-5 text-white/80" />
            Agent 智能体技能
          </h2>
          <p className="mt-1 text-xs text-white/40">
            自定义系统指令级技能。加载于 ~/.mc/skills/{'<'}<span className="text-white/60">技能名</span>{'>'}/skill.md 路径下。
          </p>
        </div>
        <button
          type="button"
          onClick={handleReload}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-[6px] border border-white/10 bg-[#303030] px-3 py-1.5 text-xs text-white/80 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-40"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          热刷新技能
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* 左侧：技能列表 */}
        <div className="flex flex-col gap-1.5 rounded-[6px] border border-white/8 bg-black/10 p-2 overflow-y-auto max-h-[60vh] lg:max-h-none">
          {skills.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-4 py-8 select-none">
              <Info className="h-5 w-5 text-white/20 mb-1.5" />
              <p className="text-xs text-white/30">暂无本地技能</p>
            </div>
          ) : (
            skills.map((skill) => {
              const isSelected = selectedSkill?.id === skill.id;
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => setSelectedSkill(skill)}
                  className={`flex flex-col gap-1 rounded-[6px] px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? "bg-white text-black"
                      : "hover:bg-white/5 text-white/85"
                  }`}
                >
                  <span className="block text-xs font-semibold truncate w-full">
                    {skill.name}
                  </span>
                  <span
                    className={`block text-[11px] truncate w-full ${
                      isSelected ? "text-black/60" : "text-white/35"
                    }`}
                  >
                    {skill.description || "暂无描述"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* 右侧：所选技能详情展示及说明 */}
        <div className="flex min-h-0 flex-col gap-3 rounded-[6px] border border-white/8 bg-black/10 p-3 overflow-y-auto">
          {selectedSkill ? (
            <div className="flex flex-col gap-3 flex-1">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedSkill.name}</h3>
                <p className="mt-1 text-xs text-white/50">{selectedSkill.description}</p>
              </div>

              {/* 属性表格 */}
              <div className="rounded-[6px] border border-white/5 bg-[#1a1a1a] p-2.5 text-xs text-white/70 flex flex-col gap-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-white/40">标识 (Token):</span>
                  <span className="text-white/80">/skill-{selectedSkill.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">文件位置:</span>
                  <span className="text-white/80 truncate max-w-[280px]" title={selectedSkill.location}>
                    {selectedSkill.location.replace(/^\/Users\/[^/]+/, "~")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">适用 Agent:</span>
                  <span className="text-white/80">
                    {selectedSkill.supportedAgents && selectedSkill.supportedAgents.length > 0
                      ? selectedSkill.supportedAgents.join(", ")
                      : "全局通用"}
                  </span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-1.5 mt-1">
                  <span className="text-white/40">正文字符数:</span>
                  <span className="text-white/80">{selectedSkill.content.length} 字符</span>
                </div>
              </div>

              {/* 技能提示词正文查看 */}
              <div className="flex flex-col flex-1 gap-1.5">
                <label className="text-xs font-bold text-white/50 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  系统级提示词内容 (Content):
                </label>
                <div className="flex-1 rounded-[6px] border border-white/5 bg-black/35 p-3 font-mono text-xs text-white/85 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar">
                  {selectedSkill.content || <span className="text-white/20 italic">正文内容为空</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-8 select-none">
              <Cpu className="h-8 w-8 text-white/10 mb-2.5" />
              <h3 className="text-sm font-bold text-white/70">添加你的自定义技能</h3>
              <p className="mt-2 max-w-xs text-xs text-white/40 leading-relaxed">
                在 macOS 上，你可以在 <code className="rounded bg-black/30 px-1 py-0.5 text-[11px] font-mono">~/.mc/skills</code> 下创建 <code className="rounded bg-black/30 px-1 py-0.5 text-[11px] font-mono">技能名/skill.md</code> 格式的技能文件。
              </p>
              <div className="mt-4 rounded-[6px] border border-white/5 bg-black/30 p-2.5 text-left text-[11px] leading-relaxed text-white/50 font-mono">
                示例前置元数据 (Frontmatter)：
                <pre className="mt-1.5 text-white/30 text-[10px]">
                  {`---
name: 翻译专家
description: 学术级中英双向翻译
supportedAgents:
  - common
---
[技能实际系统角色提示词]`
                  }
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
