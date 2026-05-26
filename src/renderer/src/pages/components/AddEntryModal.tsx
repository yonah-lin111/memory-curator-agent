import type React from "react";
import { useEffect, useRef, useState } from "react";
import { CheckSquare, FileText, Plus, Trash2, X } from "lucide-react";
import { IconButton } from "@renderer/components/ui/IconButton";
import type { TodoItem } from "@renderer/pages/TodayWorkspace";

// 添加弹窗类型，用于区分待办与随记表单内容。
export type AddEntryModalKind = "todo" | "note";

// 添加弹窗组件属性。
type AddEntryModalProps = {
  // 当前弹窗业务类型。
  kind: AddEntryModalKind;
  // 关闭弹窗回调。
  onClose: () => void;
  // 初始待办项数据（用于编辑回显）
  initialTodos?: TodoItem[];
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
const TODO_PRIORITY_OPTIONS = ["P0", "P1", "P2", "P3"];

// 优先级颜色配置。
const PRIORITY_COLOR_MAP: Record<string, { selected: string; unselected: string }> = {
  P0: {
    selected: "border-rose-500 bg-rose-500/10 text-rose-400",
    unselected: "border-white/10 bg-[#212121] text-rose-400/60 hover:border-rose-500/30 hover:text-rose-400",
  },
  P1: {
    selected: "border-amber-500 bg-amber-500/10 text-amber-400",
    unselected: "border-white/10 bg-[#212121] text-amber-400/60 hover:border-amber-500/30 hover:text-amber-400",
  },
  P2: {
    selected: "border-sky-500 bg-sky-500/10 text-sky-400",
    unselected: "border-white/10 bg-[#212121] text-sky-400/60 hover:border-sky-500/30 hover:text-sky-400",
  },
  P3: {
    selected: "border-neutral-500 bg-neutral-500/10 text-neutral-400",
    unselected: "border-white/10 bg-[#212121] text-neutral-400/60 hover:border-neutral-500/30 hover:text-neutral-400",
  },
};

// 随记推荐标签选项。
const NOTE_TAG_OPTIONS = ["UX", "AI-Agent", "架构", "产品思考"];

/**
 * 创建待办草稿。
 */
const createTodoDraft = (index: number): TodoDraft => ({
  id: `todo-draft-${index}`,
  text: "",
  priority: "P2",
});

/**
 * 通用添加弹窗。
 * 只负责展示与关闭交互，避免在静态工作台里伪造持久化行为。
 */
export const AddEntryModal = ({
  kind,
  onClose,
  initialTodos,
}: AddEntryModalProps): React.JSX.Element => {
  const config = ADD_ENTRY_MODAL_CONFIG[kind];
  const Icon = config.icon;
  // 最新待办草稿锚点，用于新增后滚动到底部。
  const latestTodoDraftRef = useRef<HTMLDivElement | null>(null);
  // 是否需要在下一次渲染后滚动到最新待办。
  const shouldScrollToLatestTodoDraftRef = useRef(false);
  // 待办草稿输入框的 ref 集合，用于新增后自动聚焦。
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  // 当前需要聚焦的草稿唯一标识。
  const [focusId, setFocusId] = useState<string | null>(() => {
    if (kind === "todo" && initialTodos && initialTodos.length > 0) {
      return initialTodos[0].id;
    }
    return "todo-draft-1";
  });
  // 待办草稿列表，每条保留独立优先级。
  const [todoDrafts, setTodoDrafts] = useState<TodoDraft[]>(() => {
    if (kind === "todo" && initialTodos && initialTodos.length > 0) {
      return initialTodos.map((todo) => ({
        id: todo.id,
        text: todo.text,
        priority: todo.priority,
      }));
    }
    return [createTodoDraft(1)];
  });
  // 下一条待办草稿序号，避免删除后再添加产生重复 key。
  const [nextTodoDraftIndex, setNextTodoDraftIndex] = useState(() => {
    if (kind === "todo" && initialTodos && initialTodos.length > 0) {
      return initialTodos.length + 1;
    }
    return 2;
  });
  // 当前已选中的随记标签。
  const [selectedTags, setSelectedTags] = useState<string[]>(["UX"]);

  /**
   * 追加一条新的待办草稿。
   */
  const handleAddTodoDraft = (): void => {
    shouldScrollToLatestTodoDraftRef.current = true;
    const newIndex = nextTodoDraftIndex;
    const newDraft = createTodoDraft(newIndex);
    setTodoDrafts((currentDrafts) => [
      ...currentDrafts,
      newDraft,
    ]);
    setNextTodoDraftIndex((currentIndex) => currentIndex + 1);
    setFocusId(newDraft.id);
  };

  /**
   * 删除指定待办草稿。
   */
  const handleDeleteTodoDraft = (id: string): void => {
    setTodoDrafts((currentDrafts) =>
      currentDrafts.filter((draft) => draft.id !== id),
    );
  };

  /**
   * 更新指定待办草稿的局部字段。
   */
  const handleTodoDraftChange = (
    id: string,
    patch: Partial<Omit<TodoDraft, "id">>,
  ): void => {
    setTodoDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === id ? { ...draft, ...patch } : draft,
      ),
    );
  };

  useEffect(() => {
    if (focusId && textareaRefs.current[focusId]) {
      textareaRefs.current[focusId]?.focus();
      setFocusId(null);
    }
  }, [focusId, todoDrafts]);



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
      latestTodoDraftRef.current.scrollIntoView({
        block: "end",
        behavior: "smooth",
      });
    }
  }, [todoDrafts.length]);

  return (
    <div
      data-testid="add-entry-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] animate-modal-backdrop-in sm:p-6"
    >
      <section
        aria-labelledby="add-entry-modal-title"
        className="w-full max-w-[520px] rounded-[6px] border border-white/15 bg-[#212121] shadow-[0_28px_90px_rgba(0,0,0,0.76)] animate-card-modal-in"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2.5 px-4">
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-white/60" />
            <h2
              id="add-entry-modal-title"
              className="text-sm font-bold text-white"
            >
              {config.title}
            </h2>
          </div>
          <IconButton
            aria-label="关闭添加弹窗"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </div>

        <div className="flex flex-col gap-2.5 p-3.5">
          {kind === "todo" ? (
            <>
              <div className="flex items-center justify-between rounded-[6px] border border-white/10 bg-black/40 p-2.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold tracking-wide text-white/65">
                    批量待办录入
                  </span>
                  <span className="font-mono text-xs text-white/30">
                    {todoDrafts.length} ITEMS / EACH HAS PRIORITY
                  </span>
                </div>
                <IconButton
                  iconOnly={false}
                  className="border border-white/10 bg-[#212121] px-2.5 py-1.5 text-xs font-bold text-white/70 hover:border-white/25 hover:text-white gap-1.5"
                  onClick={handleAddTodoDraft}
                >
                  <Plus className="h-3 w-3" />
                  添加一条待办
                </IconButton>
              </div>
              <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
                {todoDrafts.map((draft, index) => {
                  const itemNumber = index + 1;
                  return (
                    <div
                      key={draft.id}
                      ref={
                        index === todoDrafts.length - 1
                          ? latestTodoDraftRef
                          : undefined
                      }
                      className="rounded-[6px] border border-white/10 bg-black/30 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-mono text-xs text-white/35">
                          TODO #{String(itemNumber).padStart(2, "0")}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`rounded-[6px] border px-1.5 py-0.5 text-xs font-bold ${
                            draft.priority === "P0" ? "text-rose-400 border-rose-500/20 bg-rose-500/5" :
                            draft.priority === "P1" ? "text-amber-400 border-amber-500/20 bg-amber-500/5" :
                            draft.priority === "P2" ? "text-sky-400 border-sky-500/20 bg-sky-500/5" :
                            "text-neutral-400 border-neutral-500/20 bg-neutral-500/5"
                          }`}>
                            {draft.priority}
                          </span>
                          <IconButton
                            aria-label={`删除第 ${itemNumber} 条待办`}
                            className="text-white/35"
                            onClick={() => handleDeleteTodoDraft(draft.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>
                        </div>
                      </div>
                      <label className="flex flex-col gap-1.5 text-sm font-semibold tracking-wide text-white/55">
                        第 {itemNumber} 条待办内容
                        <textarea
                          ref={(el) => {
                            textareaRefs.current[draft.id] = el;
                          }}
                          aria-label={`第 ${itemNumber} 条待办内容`}
                          className="min-h-16 resize-none rounded-[6px] border border-white/10 bg-black p-3 text-sm font-normal leading-relaxed text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25"
                          placeholder="写下一个明确行动..."
                          value={draft.text}
                          onChange={(event) =>
                            handleTodoDraftChange(draft.id, {
                              text: event.target.value,
                            })
                          }
                        />
                      </label>
                      <div className="mt-2">
                        <div className="grid grid-cols-4 gap-1.5">
                           {TODO_PRIORITY_OPTIONS.map((priority) => {
                             const isSelected = draft.priority === priority;
                             return (
                               <IconButton
                                 key={priority}
                                 aria-label={`第 ${itemNumber} 条待办选择优先级${priority}`}
                                 iconOnly={false}
                                 highlighted={false}
                                 hoverBgClass=""
                                 hoverTextClass=""
                                 className={`border px-2 py-1.5 text-xs font-bold ${
                                   isSelected
                                     ? PRIORITY_COLOR_MAP[priority].selected
                                     : PRIORITY_COLOR_MAP[priority].unselected
                                  }`}
                                 onClick={() =>
                                   handleTodoDraftChange(draft.id, { priority })
                                 }
                               >
                                 {priority}
                               </IconButton>
                             );
                           })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-sm font-semibold tracking-wide text-white/55">
                随记标题
                <input
                  aria-label="随记标题"
                  className="rounded-[6px] border border-white/10 bg-black px-3 py-1.5 text-sm font-normal text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25"
                  placeholder="给这段想法一个临时标题"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold tracking-wide text-white/55">
                随记内容
                <textarea
                  aria-label="随记内容"
                  className="min-h-24 resize-none rounded-[6px] border border-white/10 bg-black p-2.5 text-sm font-normal leading-relaxed text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25"
                  placeholder="保留原始表达，不急着归类..."
                />
              </label>
              <div className="rounded-[6px] border border-white/10 bg-black/40 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold tracking-wide text-white/55">
                    灵感标签
                  </span>
                  <span className="font-mono text-xs text-white/30">
                    CAPTURE MODE
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {NOTE_TAG_OPTIONS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <IconButton
                        key={tag}
                        aria-label={`添加随记标签 ${tag}`}
                        iconOnly={false}
                        highlighted={isSelected}
                        className={`border px-2 py-1 text-xs font-semibold ${
                          isSelected
                            ? "border-white"
                            : "border-white/10 bg-[#212121] text-white/45 hover:border-white/25 hover:text-white/80"
                        }`}
                        onClick={() => {
                          setSelectedTags((currentTags) =>
                            currentTags.includes(tag)
                              ? currentTags.filter(
                                  (currentTag) => currentTag !== tag,
                                )
                              : [...currentTags, tag],
                          );
                        }}
                      >
                        #{tag}
                      </IconButton>
                    );
                  })}
                </div>
              </div>
              <label className="flex flex-col gap-1 text-sm font-semibold tracking-wide text-white/55">
                额外标签
                <input
                  aria-label="随记标签"
                  className="rounded-[6px] border border-white/10 bg-black px-3 py-1.5 text-sm font-normal text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-white/25"
                  placeholder="补充新的标签，按逗号分隔"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/5 py-2.5 px-4">
          <span className="font-mono text-xs text-white/30">
            ESC 关闭 / 本地草稿待接入
          </span>
          <IconButton
            iconOnly={false}
            highlighted
            className="px-3 py-1.5 text-xs font-bold gap-1.5"
          >
            <Plus className="h-3 w-3" />
            {config.submitLabel}
          </IconButton>
        </div>
      </section>
    </div>
  );
};
