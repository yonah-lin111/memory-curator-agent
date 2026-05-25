import type React from "react";
import { useEffect, useRef, useState } from "react";
import { CheckSquare, Clock, FileText, Plus, Trash2, X } from "lucide-react";

// 添加弹窗类型，用于区分待办与随记表单内容。
export type AddEntryModalKind = "todo" | "note";

// 添加弹窗组件属性。
type AddEntryModalProps = {
  // 当前弹窗业务类型。
  kind: AddEntryModalKind;
  // 关闭弹窗回调。
  onClose: () => void;
};

// 添加弹窗视图配置。
type AddEntryModalConfig = {
  // 弹窗标题。
  title: string;
  // 弹窗描述。
  description: string;
  // 标题区域图标。
  icon: React.ComponentType<{ className?: string }>;
  // 确认按钮文案。
  submitLabel: string;
};

// 待办草稿项，用于一次性录入多条待办。
type TodoDraft = {
  // 草稿唯一标识。
  id: string;
  // 待办内容。
  text: string;
  // 当前待办优先级。
  priority: string;
  // 当前待办计划时间。
  time: string;
};

// 不同添加类型对应的静态视图配置。
const ADD_ENTRY_MODAL_CONFIG: Record<AddEntryModalKind, AddEntryModalConfig> = {
  todo: {
    title: "新建每日待办计划",
    description: "记录一个明确行动，后续可接入本地持久化与智能排序。",
    icon: CheckSquare,
    submitLabel: "加入今日计划",
  },
  note: {
    title: "新建自由随记卡片",
    description: "捕获一段未整理的想法，先保留原始质感，再交给 Agent 策展。",
    icon: FileText,
    submitLabel: "保存随记卡片",
  },
};

// 待办优先级选项。
const TODO_PRIORITY_OPTIONS = ["高", "中", "低"];

// 随记推荐标签选项。
const NOTE_TAG_OPTIONS = ["UX", "AI-Agent", "架构", "产品思考"];

/**
 * 创建待办草稿。
 */
const createTodoDraft = (index: number): TodoDraft => ({
  id: `todo-draft-${index}`,
  text: "",
  priority: "中",
  time: "16:30",
});

/**
 * 通用添加弹窗。
 * 只负责展示与关闭交互，避免在静态工作台里伪造持久化行为。
 */
export const AddEntryModal = ({ kind, onClose }: AddEntryModalProps): React.JSX.Element => {
  const config = ADD_ENTRY_MODAL_CONFIG[kind];
  const Icon = config.icon;
  // 最新待办草稿锚点，用于新增后滚动到底部。
  const latestTodoDraftRef = useRef<HTMLDivElement | null>(null);
  // 是否需要在下一次渲染后滚动到最新待办。
  const shouldScrollToLatestTodoDraftRef = useRef(false);
  // 待办草稿列表，每条保留独立优先级和时间。
  const [todoDrafts, setTodoDrafts] = useState<TodoDraft[]>([createTodoDraft(1)]);
  // 下一条待办草稿序号，避免删除后再添加产生重复 key。
  const [nextTodoDraftIndex, setNextTodoDraftIndex] = useState(2);
  // 当前已选中的随记标签。
  const [selectedTags, setSelectedTags] = useState<string[]>(["UX"]);

  /**
   * 追加一条新的待办草稿。
   */
  const handleAddTodoDraft = (): void => {
    shouldScrollToLatestTodoDraftRef.current = true;
    setTodoDrafts((currentDrafts) => [...currentDrafts, createTodoDraft(nextTodoDraftIndex)]);
    setNextTodoDraftIndex((currentIndex) => currentIndex + 1);
  };

  /**
   * 删除指定待办草稿。
   */
  const handleDeleteTodoDraft = (id: string): void => {
    setTodoDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== id));
  };

  /**
   * 更新指定待办草稿的局部字段。
   */
  const handleTodoDraftChange = (id: string, patch: Partial<Omit<TodoDraft, "id">>): void => {
    setTodoDrafts((currentDrafts) =>
      currentDrafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
    );
  };

  /**
   * 打开原生时间选择器。
   */
  const handleOpenTodoTimePicker = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const input = event.currentTarget.previousElementSibling;

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    input.focus();
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.click();
  };

  useEffect(() => {
    /**
     * 处理 Escape 快捷关闭。
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!shouldScrollToLatestTodoDraftRef.current) {
      return;
    }

    shouldScrollToLatestTodoDraftRef.current = false;
    if (typeof latestTodoDraftRef.current?.scrollIntoView === "function") {
      latestTodoDraftRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
    }
  }, [todoDrafts.length]);

  return (
    <div
      data-testid="add-entry-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] animate-modal-backdrop-in sm:p-6"
      onClick={onClose}
    >
      <section
        aria-labelledby="add-entry-modal-title"
        className="w-full max-w-[520px] rounded-[6px] border border-white/15 bg-[#212121] shadow-[0_28px_90px_rgba(0,0,0,0.76)] animate-card-modal-in"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] border border-white/10 bg-black text-white/70">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 id="add-entry-modal-title" className="text-sm font-bold text-white">
                {config.title}
              </h2>
              <p className="text-[11px] leading-relaxed text-white/45">{config.description}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭添加弹窗"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[6px] text-white/45 transition-colors duration-150 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {kind === "todo" ? (
            <>
              <div className="flex items-center justify-between rounded-[6px] border border-white/10 bg-black/40 p-2.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold tracking-wide text-white/65">
                    批量待办录入
                  </span>
                  <span className="font-mono text-[10px] text-white/30">
                    {todoDrafts.length} ITEMS / EACH HAS PRIORITY + TIME
                  </span>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-[6px] border border-white/10 bg-[#212121] px-2.5 py-1.5 text-[11px] font-bold text-white/70 transition-all duration-150 hover:border-white/25 hover:text-white"
                  onClick={handleAddTodoDraft}
                >
                  <Plus className="h-3 w-3" />
                  添加一条待办
                </button>
              </div>
              <div className="flex max-h-[390px] flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
                {todoDrafts.map((draft, index) => {
                  const itemNumber = index + 1;
                  return (
                    <div
                      key={draft.id}
                      ref={index === todoDrafts.length - 1 ? latestTodoDraftRef : undefined}
                      className="rounded-[6px] border border-white/10 bg-black/30 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-mono text-[10px] text-white/35">
                          TODO #{String(itemNumber).padStart(2, "0")}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-[6px] bg-white/5 px-2 py-0.5 text-[10px] text-white/35">
                            {draft.priority} / {draft.time}
                          </span>
                          <button
                            type="button"
                            aria-label={`删除第 ${itemNumber} 条待办`}
                            className="flex h-6 w-6 items-center justify-center rounded-[6px] text-white/35 transition-colors duration-150 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
                            onClick={() => handleDeleteTodoDraft(draft.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <label className="flex flex-col gap-1.5 text-[11px] font-semibold tracking-wide text-white/55">
                        第 {itemNumber} 条待办内容
                        <textarea
                          aria-label={`第 ${itemNumber} 条待办内容`}
                          className="min-h-16 resize-none rounded-[6px] border border-white/10 bg-black p-3 text-xs font-normal leading-relaxed text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25"
                          placeholder="写下一个明确行动..."
                          value={draft.text}
                          onChange={(event) =>
                            handleTodoDraftChange(draft.id, { text: event.target.value })
                          }
                        />
                      </label>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_112px]">
                        <div className="flex flex-col gap-1.5 text-[11px] font-semibold tracking-wide text-white/55">
                          优先级
                          <div className="grid grid-cols-3 gap-1.5">
                            {TODO_PRIORITY_OPTIONS.map((priority) => (
                              <button
                                key={priority}
                                type="button"
                                aria-label={`第 ${itemNumber} 条待办选择优先级${priority}`}
                                className={`rounded-[6px] border px-2 py-1.5 text-[11px] font-bold transition-all duration-150 ${
                                  draft.priority === priority
                                    ? "border-white bg-white text-black"
                                    : "border-white/10 bg-[#212121] text-white/45 hover:border-white/25 hover:text-white/80"
                                }`}
                                onClick={() => handleTodoDraftChange(draft.id, { priority })}
                              >
                                {priority}
                              </button>
                            ))}
                          </div>
                        </div>
                        <label className="flex flex-col gap-1.5 text-[11px] font-semibold tracking-wide text-white/55">
                          时间
                          <div className="relative">
                            <input
                              type="time"
                              aria-label={`第 ${itemNumber} 条待办时间`}
                              className="todo-time-picker w-full rounded-[6px] border border-white/10 bg-black px-2 py-1.5 pr-7 text-xs font-normal text-white/80 outline-none transition-colors duration-150 focus:border-white/25"
                              value={draft.time}
                              onChange={(event) =>
                                handleTodoDraftChange(draft.id, { time: event.target.value })
                              }
                            />
                            <button
                              type="button"
                              aria-label={`打开第 ${itemNumber} 条待办时间选择器`}
                              className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[6px] text-white/70 transition-colors duration-150 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
                              onClick={handleOpenTodoTimePicker}
                            >
                              <Clock
                                aria-hidden="true"
                                data-testid={`todo-time-picker-icon-${itemNumber}`}
                                className="h-3.5 w-3.5"
                              />
                            </button>
                          </div>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 text-[11px] font-semibold tracking-wide text-white/55">
                随记标题
                <input
                  aria-label="随记标题"
                  className="rounded-[6px] border border-white/10 bg-black px-3 py-2 text-xs font-normal text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25"
                  placeholder="给这段想法一个临时标题"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-semibold tracking-wide text-white/55">
                随记内容
                <textarea
                  aria-label="随记内容"
                  className="min-h-28 resize-none rounded-[6px] border border-white/10 bg-black p-3 text-xs font-normal leading-relaxed text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25"
                  placeholder="保留原始表达，不急着归类..."
                />
              </label>
              <div className="rounded-[6px] border border-white/10 bg-black/40 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-wide text-white/55">
                    灵感标签
                  </span>
                  <span className="font-mono text-[10px] text-white/30">CAPTURE MODE</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {NOTE_TAG_OPTIONS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-label={`添加随记标签 ${tag}`}
                        className={`rounded-[6px] border px-2 py-1.5 text-[11px] font-semibold transition-all duration-150 ${
                          isSelected
                            ? "border-white bg-white text-black"
                            : "border-white/10 bg-[#212121] text-white/45 hover:border-white/25 hover:text-white/80"
                        }`}
                        onClick={() => {
                          setSelectedTags((currentTags) =>
                            currentTags.includes(tag)
                              ? currentTags.filter((currentTag) => currentTag !== tag)
                              : [...currentTags, tag],
                          );
                        }}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex flex-col gap-1.5 text-[11px] font-semibold tracking-wide text-white/55">
                额外标签
                <input
                  aria-label="随记标签"
                  className="rounded-[6px] border border-white/10 bg-black px-3 py-2 text-xs font-normal text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25"
                  placeholder="补充新的标签，按逗号分隔"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/5 p-4">
          <span className="font-mono text-[10px] text-white/30">ESC 关闭 / 本地草稿待接入</span>
          <button
            type="button"
            className="group flex items-center gap-1.5 rounded-[6px] bg-white px-3 py-2 text-xs font-bold text-black transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
          >
            <Plus className="h-3.5 w-3.5 transition-transform duration-150 group-hover:rotate-90" />
            {config.submitLabel}
          </button>
        </div>
      </section>
    </div>
  );
};
