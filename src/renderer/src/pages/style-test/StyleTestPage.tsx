import type React from "react";
import { useState } from "react";

/** StyleTestPage 组件 - 用于测试前端样式的空白页 */
export const StyleTestPage = (): React.JSX.Element => {
  const [selectedId, setSelectedId] = useState<string>("test-prompt-canvas");

  const testItems = [{ id: "temp", name: "temp", status: "temp" }];

  return (
    <section
      aria-label="Style Test Page"
      className="flex h-full min-h-0 flex-col gap-3 text-white"
    >
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,280px)_1fr]">
        {/* 左侧面板：测试列表 */}
        <div className="min-h-0 flex flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4 z-10 relative">
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5 flex-shrink-0">
            <span className="text-sm font-bold text-white/80">
              样式测试列表
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5">
            <div className="flex flex-col gap-1.5">
              {testItems.map((item) => {
                const isActive = item.id === selectedId;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full text-left flex items-center gap-3 p-2.5 rounded-[6px] transition-all duration-150 group ${
                      isActive
                        ? "bg-white/5 text-white"
                        : "hover:bg-white/[0.02] text-white/70"
                    }`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    {/* 头像占位 */}
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 bg-white/5 border border-white/10 rounded-[6px] flex items-center justify-center text-xs font-bold text-white/60">
                        {item.name.substring(0, 1).toUpperCase()}
                      </div>
                    </div>

                    {/* 核心描述 */}
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-xs font-bold truncate text-white/90 group-hover:text-white">
                        {item.name}
                      </span>
                      <span className="text-xs text-white/40 truncate group-hover:text-white/65">
                        {item.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右侧面板：主内容区 */}
        <div className="min-h-0 flex flex-col rounded-[6px] border border-white/6 bg-[#212121] p-5 relative overflow-hidden">
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 rounded-[6px] border border-dashed border-white/10 overflow-hidden">
            <span className="text-sm font-bold text-white/80">
              右侧内容展示区
            </span>
            <span className="mt-2 text-xs text-white/50">
              当前选中的测试项目 ID: {selectedId}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
