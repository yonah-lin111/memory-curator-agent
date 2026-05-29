import type React from "react";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  Heart,
  User,
  Search,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Calendar,
  Phone,
  Clock,
  Tag as TagIcon,
  Upload,
  UserCheck,
  ChevronRight,
  Sparkles,
  Info,
} from "lucide-react";
import { useToast } from "@renderer/components/ui/Toast";
import { IconButton } from "@renderer/components/ui/IconButton";
import { Tag } from "@renderer/components/ui/Tag";
import { MarkdownEditor } from "@renderer/components/ui/MarkdownEditor";
import { MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";

/* ==========================================
 * TS 类型定义
 * ========================================== */

// 人物关系档案数据接口
export interface PersonProfile {
  // 唯一标识。
  id: string;
  // 头像（Base64 DataURL 或本地路径）
  avatar: string;
  // 姓名。
  name: string;
  // 性别（男、女、非公开等）
  gender: string;
  // 关系分类（女朋友、家人、朋友、同事、其他）
  relationship: "女朋友" | "家人" | "朋友" | "同事" | "其他";
  // 一句话特征描述/状态
  status: string;
  // 生日。
  birthday: string;
  // 联系方式。
  contact: string;
  // 特征标签。
  tags: string[];
  // 详细背景档案（使用 Markdown 撰写）
  details: string;
  // 创建时间。
  createdAt: string;
  // 更新时间。
  updatedAt: string;
}

// 关系分类筛选类型。
type RelationshipFilter = "全部" | "女朋友" | "家人" | "朋友" | "同事" | "其他";

// 表单编辑状态。
interface FormState {
  name: string;
  gender: string;
  relationship: PersonProfile["relationship"];
  status: string;
  birthday: string;
  contact: string;
  tags: string[];
  details: string;
  avatar: string;
}

/* ==========================================
 * 常量定义
 * ========================================== */

// LocalStorage 存储键名。
const LOCAL_STORAGE_KEY = "mc_people_profiles";

// 初始 mock 数据。
const INITIAL_PEOPLE: PersonProfile[] = [
  {
    id: "tolin",
    avatar: "",
    name: "tolin",
    gender: "女",
    relationship: "女朋友",
    status: "温柔可爱，善解人意",
    birthday: "12月14日",
    contact: "WeChat: tolin_love",
    tags: ["温柔", "可爱", "善解人意", "小吃货", "爱笑", "心头肉"],
    details: `# tolin 的个人档案 🤍\n\n> 她是世界上最温柔可爱、最善解人意的女孩子。\n\n### 🌸 基本特征\n- **性格**：超级爱笑，性格温和，极其善解人意。生气的时候也软软的，很好哄。\n- **喜好**：喜欢吃甜品、抹茶冰淇淋，喜欢猫咪和各种毛茸茸的动物。\n- **小习惯**：说话喜欢带轻微的尾音，开心的时候会小碎步地走路。\n\n### 📝 备忘录 / 偏好\n- 不喜欢吃香菜，火锅最爱番茄底和清油辣。\n- 换季时容易有些敏感，需要备好温和的面霜。\n- 收到小礼物（哪怕是一朵花或好看的卡片）会开心很久。`,
    createdAt: "2026-05-29 10:00",
    updatedAt: "2026-05-29 10:00",
  },
  {
    id: "father",
    avatar: "",
    name: "老爸",
    gender: "男",
    relationship: "家人",
    status: "坚实后盾，偶尔幽默",
    birthday: "06月20日",
    contact: "138-xxxx-xxxx",
    tags: ["稳重", "话少", "爱喝茶", "厨艺好"],
    details: `# 父亲的档案 🍵\n\n### 👨‍💼 个人特质\n- 喜欢研究茶道，尤其是普洱和白茶。\n- 每天傍晚喜欢去公园散步。\n- 表面严肃，但其实心里很关心家人。\n\n### 💡 喜好与习惯\n- 喜欢清淡的粤菜或苏帮菜。\n- 电子产品遇到问题会来问我，内心细腻。`,
    createdAt: "2026-05-29 10:05",
    updatedAt: "2026-05-29 10:05",
  },
  {
    id: "aming",
    avatar: "",
    name: "阿明",
    gender: "男",
    relationship: "朋友",
    status: "技术狂热者，深夜写 Bug",
    birthday: "09月11日",
    contact: "GitHub: aming-coder",
    tags: ["极客", "开朗", "爱打游戏", "夜猫子"],
    details: `# 阿明 💻\n\n### 🚀 极客特征\n- 大学死党，资深前端架构师。\n- 喜欢研究各种开源 Agent 框架。\n- 喜欢玩黑神话和各种 3A 大作。\n\n### 📦 协作记录\n- 正在一起谋划独立开发一个小项目。\n- 约好了下个月一起去吃日料。`,
    createdAt: "2026-05-29 10:10",
    updatedAt: "2026-05-29 10:10",
  },
];

// 关系对应的背景与文本颜色。
const RELATIONSHIP_COLORS: Record<
  PersonProfile["relationship"],
  { bg: string; text: string; dot: string }
> = {
  女朋友: {
    bg: "bg-pink-500/10 border-pink-500/15",
    text: "text-pink-400",
    dot: "bg-pink-400",
  },
  家人: {
    bg: "bg-amber-500/10 border-amber-500/15",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  朋友: {
    bg: "bg-blue-500/10 border-blue-500/15",
    text: "text-blue-400",
    dot: "bg-blue-400",
  },
  同事: {
    bg: "bg-teal-500/10 border-teal-500/15",
    text: "text-teal-400",
    dot: "bg-teal-400",
  },
  其他: {
    bg: "bg-white/5 border-white/10",
    text: "text-white/60",
    dot: "bg-white/40",
  },
};

// 默认表单初始化模板。
const INITIAL_FORM_STATE: FormState = {
  name: "",
  gender: "女",
  relationship: "其他",
  status: "",
  birthday: "",
  contact: "",
  tags: [],
  details: `# 个人详细档案与备注\n\n### 🌸 个人偏好\n- 喜好：\n- 禁忌：\n\n### 📝 备忘备录\n- `,
  avatar: "",
};

/**
 * PeoplePage 组件 - 个人关系链与人际档案管理
 */
export const PeoplePage = (): React.JSX.Element => {
  // 人物列表数据。
  const [people, setPeople] = useState<PersonProfile[]>([]);
  // 当前选中的人物 ID。
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 搜索关键字。
  const [searchQuery, setSearchQuery] = useState("");
  // 当前选中的关系过滤器。
  const [relationFilter, setRelationFilter] =
    useState<RelationshipFilter>("全部");
  // 当前选中的标签切片过滤器。
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // 页面模式："view" | "edit" | "create"
  const [mode, setMode] = useState<"view" | "edit" | "create">("view");
  // 编辑或创建表单数据。
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
  // 特征标签输入暂存。
  const [tagInput, setTagInput] = useState("");
  // 拖拽上传头像激活状态。
  const [isDragging, setIsDragging] = useState(false);

  // 文件上传 DOM 引用。
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // 消息提示实例。
  const toast = useToast();

  /**
   * 初始化：从 LocalStorage 读取数据。
   */
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as PersonProfile[];
        setPeople(parsed);
        if (parsed.length > 0) {
          setSelectedId(parsed[0].id);
        }
      } catch {
        setPeople(INITIAL_PEOPLE);
        setSelectedId(INITIAL_PEOPLE[0].id);
      }
    } else {
      setPeople(INITIAL_PEOPLE);
      setSelectedId(INITIAL_PEOPLE[0].id);
    }
  }, []);

  // 获得当前选中的人档案。
  const currentPerson = useMemo(() => {
    return people.find((p) => p.id === selectedId) || null;
  }, [people, selectedId]);

  // 获得所有标签及其对应的频数。
  const tagStats = useMemo(() => {
    const stats = new Map<string, number>();
    people.forEach((p) => {
      p.tags.forEach((tag) => {
        const cleaned = tag.trim();
        if (cleaned) {
          stats.set(cleaned, (stats.get(cleaned) || 0) + 1);
        }
      });
    });
    return Array.from(stats.entries()).map(([name, count]) => ({
      name,
      count,
    }));
  }, [people]);

  // 过滤后的列表。
  const filteredPeople = useMemo(() => {
    return people.filter((p) => {
      // 1. 关系过滤器过滤。
      if (relationFilter !== "全部" && p.relationship !== relationFilter) {
        return false;
      }
      // 2. 标签切片过滤器过滤。
      if (selectedTag && !p.tags.includes(selectedTag)) {
        return false;
      }
      // 3. 搜索关键词过滤。
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesStatus = p.status.toLowerCase().includes(query);
        const matchesContact = p.contact.toLowerCase().includes(query);
        const matchesTags = p.tags.some((t) => t.toLowerCase().includes(query));
        return matchesName || matchesStatus || matchesContact || matchesTags;
      }
      return true;
    });
  }, [people, relationFilter, selectedTag, searchQuery]);

  /**
   * 触发进入“编辑”模式。
   */
  const enterEditMode = (): void => {
    if (!currentPerson) return;
    setFormState({
      name: currentPerson.name,
      gender: currentPerson.gender,
      relationship: currentPerson.relationship,
      status: currentPerson.status,
      birthday: currentPerson.birthday,
      contact: currentPerson.contact,
      tags: [...currentPerson.tags],
      details: currentPerson.details,
      avatar: currentPerson.avatar,
    });
    setMode("edit");
  };

  /**
   * 触发进入“新建”模式。
   */
  const enterCreateMode = (): void => {
    setFormState({
      ...INITIAL_FORM_STATE,
      // 默认提供一个好听的、适合录入新资料的 Markdown 初始格式
      details: `# 详细档案与备注 🤍\n\n### 🌸 个人偏好\n- 喜欢：\n- 讨厌：\n\n### 📝 备忘录\n- `,
    });
    setMode("create");
  };

  /**
   * 保存当前表单（包含新建与更新）。
   */
  const handleSaveForm = (): void => {
    if (!formState.name.trim()) {
      toast.error("姓名不能为空");
      return;
    }

    const now = new Date();
    const formattedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    if (mode === "create") {
      const newPerson: PersonProfile = {
        id: Math.random().toString(36).substring(2, 9),
        name: formState.name.trim(),
        gender: formState.gender,
        relationship: formState.relationship,
        status: formState.status.trim(),
        birthday: formState.birthday.trim(),
        contact: formState.contact.trim(),
        tags: formState.tags,
        details: formState.details,
        avatar: formState.avatar,
        createdAt: formattedTime,
        updatedAt: formattedTime,
      };

      const updatedPeople = [newPerson, ...people];
      setPeople(updatedPeople);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedPeople));
      setSelectedId(newPerson.id);
      toast.success(`成功创建 ${newPerson.name} 的人物档案`);
    } else if (mode === "edit" && currentPerson) {
      const updatedPerson: PersonProfile = {
        ...currentPerson,
        name: formState.name.trim(),
        gender: formState.gender,
        relationship: formState.relationship,
        status: formState.status.trim(),
        birthday: formState.birthday.trim(),
        contact: formState.contact.trim(),
        tags: formState.tags,
        details: formState.details,
        avatar: formState.avatar,
        updatedAt: formattedTime,
      };

      const updatedPeople = people.map((p) =>
        p.id === currentPerson.id ? updatedPerson : p,
      );
      setPeople(updatedPeople);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedPeople));
      toast.success("档案保存成功");
    }

    setMode("view");
  };

  /**
   * 删除当前档案。
   */
  const handleDeletePerson = (id: string, name: string): void => {
    if (window.confirm(`确定要彻底删除 ${name} 的人物档案吗？此操作不可逆。`)) {
      const updated = people.filter((p) => p.id !== id);
      setPeople(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      toast.success(`${name} 的档案已删除`);

      if (selectedId === id) {
        setSelectedId(updated.length > 0 ? updated[0].id : null);
      }
    }
  };

  /**
   * 处理文件选择与头像二进制落盘逻辑。
   */
  const handleFileProcess = async (file: File): Promise<void> => {
    if (!file.type.startsWith("image/")) {
      toast.error("仅支持图片文件格式");
      return;
    }

    // 1. 读取为 Base64 DataURL (用于静态降级展示或首屏即时预览)
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setFormState((prev) => ({ ...prev, avatar: dataUrl }));
    };
    reader.readAsDataURL(file);

    // 2. 尝试利用 Electron IPC API 进行物理落盘到 .mc/img/people 中
    if (window.api && window.api.files && window.api.files.savePeopleAvatar) {
      try {
        const buffer = await file.arrayBuffer();
        const result = await window.api.files.savePeopleAvatar({
          name: file.name,
          mimeType: file.type,
          bytes: buffer,
        });
        if (result && result.url) {
          setFormState((prev) => ({ ...prev, avatar: result.url }));
          toast.success("头像已保存到本地 .mc 存储");
        }
      } catch (err) {
        console.error("保存头像物理文件失败, 降级使用 base64 预览", err);
      }
    }
  };

  /**
   * 点击头像框触发本地上传。
   */
  const triggerFileSelect = (): void => {
    fileInputRef.current?.click();
  };

  /**
   * 文件改变监听。
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileProcess(file);
    }
  };

  /**
   * 头像拖拽事件处理。
   */
  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (): void => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileProcess(file);
    }
  };

  /**
   * 移除头像。
   */
  const handleRemoveAvatar = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setFormState((prev) => ({ ...prev, avatar: "" }));
  };

  /**
   * 添加特征标签。
   */
  const handleAddTag = (): void => {
    const trimmed = tagInput.trim();
    if (trimmed) {
      if (formState.tags.includes(trimmed)) {
        toast.warning("该标签已存在");
        return;
      }
      setFormState((prev) => ({ ...prev, tags: [...prev.tags, trimmed] }));
      setTagInput("");
    }
  };

  /**
   * 删除表单中的某个特征标签。
   */
  const handleRemoveFormTag = (targetTag: string): void => {
    setFormState((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== targetTag),
    }));
  };

  return (
    <section
      aria-label="People 页面"
      className="flex h-full min-h-0 flex-col gap-3 text-white"
    >
      {/* 顶层主网格：双栏布局 */}
      <div
        className={`grid min-h-0 flex-1 gap-3 ${mode === "view" ? "lg:grid-cols-[minmax(0,340px)_1fr]" : "grid-cols-1"}`}
      >
        {/* ==========================================
         * 左侧面板：人物关系检索与切片
         * ========================================== */}
        {mode === "view" && (
          <div className="min-h-0 flex flex-col gap-3 rounded-[6px] border border-white/6 bg-[#212121] p-4">
            {/* 1. 顶栏检索与创建入口 */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-white/60" />
                <span className="text-sm font-bold text-white/80">
                  人物档案库
                </span>
              </div>
              <IconButton
                aria-label="新增人物档案"
                className="bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                onClick={enterCreateMode}
              >
                <Plus className="h-3.5 w-3.5" />
              </IconButton>
            </div>

            {/* 2. 搜索框 */}
            <div className="relative flex-shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <input
                type="text"
                placeholder="搜索姓名、特征、联系方式..."
                className="w-full rounded-[6px] border border-white/8 bg-black/40 pl-8.5 pr-3 py-1.5 text-xs text-white placeholder:text-white/25 outline-none transition-colors duration-150 focus:border-white/18"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* 3. 关系分类滑块切片 */}
            <div className="flex-shrink-0">
              <div className="flex flex-wrap gap-1 bg-black/35 p-1 rounded-[6px] border border-white/5">
                {(
                  [
                    "全部",
                    "女朋友",
                    "家人",
                    "朋友",
                    "同事",
                    "其他",
                  ] as RelationshipFilter[]
                ).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`flex-1 text-center py-1 text-[10px] font-semibold rounded-[4px] transition-all duration-150 ${
                      relationFilter === filter
                        ? "bg-white text-black"
                        : "text-white/40 hover:bg-white/5 hover:text-white/70"
                    }`}
                    onClick={() => {
                      setRelationFilter(filter);
                      setSelectedTag(null); // 切换类型时清除标签筛选，防止复合筛选无数据
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. 标签特征切片 */}
            {tagStats.length > 0 && (
              <div className="flex-shrink-0 border-t border-b border-white/5 py-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/28 block mb-1.5">
                  Feature Tag Map
                </span>
                <div className="flex flex-wrap gap-1 max-h-[76px] overflow-y-auto custom-scrollbar">
                  <button
                    type="button"
                    className={`rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                      selectedTag === null
                        ? "border-white/18 bg-white/10 text-white"
                        : "border-white/5 bg-black/25 text-white/50 hover:border-white/12 hover:text-white"
                    }`}
                    onClick={() => setSelectedTag(null)}
                  >
                    全部
                  </button>
                  {tagStats.map((tag) => (
                    <button
                      key={tag.name}
                      type="button"
                      className={`rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                        selectedTag === tag.name
                          ? "border-white/18 bg-white/10 text-white"
                          : "border-white/5 bg-black/25 text-white/50 hover:border-white/12 hover:text-white"
                      }`}
                      onClick={() => setSelectedTag(tag.name)}
                    >
                      #{tag.name} · {tag.count}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 5. 过滤后的人物列表 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5">
              {filteredPeople.length === 0 ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[6px] border border-dashed border-white/5 bg-black/10 p-5 text-center">
                  <User className="h-6 w-6 text-white/20" />
                  <span className="mt-2 text-xs font-semibold text-white/60">
                    暂无匹配的人物
                  </span>
                  <span className="mt-1 text-[11px] text-white/30">
                    调整分类或点击右上角新增档案
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {filteredPeople.map((person) => {
                    const isActive = person.id === selectedId;
                    const colors = RELATIONSHIP_COLORS[person.relationship];
                    const hasCustomAvatar = Boolean(person.avatar);

                    return (
                      <button
                        key={person.id}
                        type="button"
                        className={`w-full text-left flex items-center gap-3 p-2.5 rounded-[6px] border transition-all duration-150 group ${
                          isActive
                            ? "border-white/15 bg-white/5 text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                            : "border-transparent hover:border-white/8 hover:bg-white/[0.02] text-white/70"
                        }`}
                        onClick={() => {
                          setSelectedId(person.id);
                        }}
                      >
                        {/* 头像 */}
                        <div className="relative flex-shrink-0">
                          {hasCustomAvatar ? (
                            <img
                              src={person.avatar}
                              alt={person.name}
                              className="w-9 h-9 object-cover rounded-[6px] border border-white/10"
                              onError={(e) => {
                                // 头像资源路径失效时的降级占位图
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <div className="w-9 h-9 bg-white/5 border border-white/10 rounded-[6px] flex items-center justify-center text-xs font-bold text-white/60">
                              {person.name.substring(0, 1).toUpperCase()}
                            </div>
                          )}
                          {person.relationship === "女朋友" && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-pink-500 text-[8px] text-white">
                              ❤️
                            </span>
                          )}
                        </div>

                        {/* 核心描述 */}
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold truncate text-white/90 group-hover:text-white">
                              {person.name}
                            </span>
                            <span
                              className={`rounded-[4px] px-1 py-0.2 text-[9px] font-bold border leading-none ${colors.bg} ${colors.text}`}
                            >
                              {person.relationship}
                            </span>
                          </div>
                          <span className="text-[11px] text-white/40 truncate group-hover:text-white/65">
                            {person.status || "暂无一句话描述"}
                          </span>
                        </div>

                        {/* 箭头装饰 */}
                        <ChevronRight className="h-3 w-3 text-white/20 group-hover:text-white/55 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
         * 右侧面板：主展示区 / 编辑区
         * ========================================== */}
        <div className="min-h-0 flex flex-col rounded-[6px] border border-white/6 bg-[#212121] overflow-hidden">
          {/* A. 详情展示模式 (View Mode) */}
          {mode === "view" && (
            <div className="flex-1 flex flex-col min-h-0">
              {currentPerson ? (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* 1. 详情顶部 Banner 卡片 */}
                  <div className="p-5 border-b border-white/5 bg-black/20 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-4">
                      {/* 头像 */}
                      <div className="relative flex-shrink-0">
                        {currentPerson.avatar ? (
                          <img
                            src={currentPerson.avatar}
                            alt={currentPerson.name}
                            className="w-16 h-16 object-cover rounded-[6px] border-2 border-white/10 shadow-lg"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-white/5 border-2 border-white/10 rounded-[6px] flex items-center justify-center text-xl font-bold text-white/50">
                            {currentPerson.name.substring(0, 1).toUpperCase()}
                          </div>
                        )}
                        {currentPerson.relationship === "女朋友" && (
                          <div className="absolute -bottom-1 -right-1 rounded-full bg-pink-500 p-1 shadow">
                            <Heart className="h-3 w-3 text-white fill-white" />
                          </div>
                        )}
                      </div>

                      {/* 姓名与状态 */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base font-bold text-white leading-none">
                            {currentPerson.name}
                          </h2>
                          <span className="text-xs text-white/30">
                            ({currentPerson.gender})
                          </span>
                          <span
                            className={`rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold border leading-none ${
                              RELATIONSHIP_COLORS[currentPerson.relationship].bg
                            } ${RELATIONSHIP_COLORS[currentPerson.relationship].text}`}
                          >
                            {currentPerson.relationship}
                          </span>
                        </div>
                        <p className="text-xs text-white/60 font-medium leading-relaxed mt-0.5 flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
                          <span>{currentPerson.status || "暂无描述"}</span>
                        </p>
                      </div>
                    </div>

                    {/* 操作按钮组 */}
                    <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                      <IconButton
                        iconOnly={false}
                        className="h-7 px-2.5 rounded-[6px] bg-white/5 border border-white/8 hover:bg-white/10 text-xs text-white/70 hover:text-white flex items-center gap-1 font-semibold"
                        onClick={enterEditMode}
                        title="编辑档案"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>编辑档案</span>
                      </IconButton>
                      <IconButton
                        iconOnly={false}
                        className="h-7 px-2.5 rounded-[6px] border border-transparent hover:border-red-500/10 hover:bg-red-500/5 text-xs text-white/30 hover:text-red-400 flex items-center gap-1 font-semibold"
                        onClick={() =>
                          handleDeletePerson(
                            currentPerson.id,
                            currentPerson.name,
                          )
                        }
                        title="删除档案"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>删除</span>
                      </IconButton>
                    </div>
                  </div>

                  {/* 2. 详情主体区域 */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-6">
                    {/* 特征标签 */}
                    {currentPerson.tags.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1 text-[11px] font-mono text-white/28 tracking-wider uppercase">
                          <TagIcon className="h-3 w-3" />
                          <span>Feature Tags / 行为特征与倾向</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {currentPerson.tags.map((tag) => (
                            <Tag
                              key={tag}
                              size="default"
                              bgClass="border-white/5 bg-white/[0.02] text-white/50"
                            >
                              {tag}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 基本信息表格卡片 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="rounded-[6px] border border-white/5 bg-black/20 p-3 flex items-center gap-3">
                        <div className="p-2 rounded-[6px] bg-white/[0.03] text-white/50 border border-white/5 flex-shrink-0">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">
                            Birthday / 纪念生日
                          </span>
                          <span className="text-xs text-white/80 font-bold mt-0.5">
                            {currentPerson.birthday || "未填写"}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-[6px] border border-white/5 bg-black/20 p-3 flex items-center gap-3">
                        <div className="p-2 rounded-[6px] bg-white/[0.03] text-white/50 border border-white/5 flex-shrink-0">
                          <Phone className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">
                            Contact / 联系方式
                          </span>
                          <span className="text-xs text-white/80 font-bold mt-0.5">
                            {currentPerson.contact || "未填写"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 详细备注背景档案（Markdown） */}
                    <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/28 tracking-wider uppercase">
                          <Info className="h-3 w-3" />
                          <span>Detailed Dossier / 详细背景档案与备注</span>
                        </div>
                        <div className="flex items-center gap-3.5 text-[10px] font-mono text-white/25">
                          <span className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            更新: {currentPerson.updatedAt}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-[6px] border border-white/5 bg-black/15 p-4 min-h-[300px]">
                        {currentPerson.details ? (
                          <div className="markdown-preview-container select-text">
                            <MdPreview
                              theme="dark"
                              modelValue={currentPerson.details}
                              previewTheme="default"
                              codeTheme="atom"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <span className="text-xs text-white/30">
                              暂无详细背景备注资料，点击编辑补全。
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black/5">
                  <User className="h-10 w-10 text-white/20 animate-pulse" />
                  <h3 className="mt-4 text-sm font-bold text-white/80">
                    人际关系策展池
                  </h3>
                  <p className="mt-1.5 max-w-[360px] text-xs leading-relaxed text-white/40">
                    这里存放你最重要的亲友、爱人或合作伙伴档案，你可以点击左上角的加号新增一名重要人物进行深度建档。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* B. 表单编辑模式 (Edit or Create Mode) */}
          {(mode === "edit" || mode === "create") && (
            <div className="flex-1 flex flex-col min-h-0 animate-card-modal-in">
              {/* 1. 表单头部 */}
              <div className="p-4 border-b border-white/5 bg-black/20 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-white/60" />
                  <span className="text-sm font-bold text-white/80">
                    {mode === "create"
                      ? "录入新人物关系档案"
                      : `编辑 ${formState.name || "人物"} 档案`}
                  </span>
                </div>
                <IconButton
                  aria-label="取消编辑"
                  onClick={() => setMode("view")}
                >
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              </div>

              {/* 2. 表单主体 (滚动区) */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-5">
                {/* 核心段落：头像 + 姓名关系 */}
                <div className="grid grid-cols-1 md:grid-cols-[100px_1fr] gap-5 items-start">
                  {/* 头像录入区 */}
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">
                      Avatar / 头像
                    </span>
                    <div
                      role="button"
                      aria-label="点击或拖拽上传新头像"
                      className={`relative w-20 h-20 rounded-[6px] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${
                        isDragging
                          ? "border-pink-500 bg-pink-500/5"
                          : "border-white/10 hover:border-white/20 bg-black/40"
                      }`}
                      onClick={triggerFileSelect}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      {formState.avatar ? (
                        <>
                          <img
                            src={formState.avatar}
                            alt="预览"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] text-white/90">
                            更换头像
                          </div>
                          {/* 移除头像按钮 */}
                          <button
                            type="button"
                            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/80 hover:bg-black text-white/60 hover:text-white flex items-center justify-center text-[8px] border border-white/10 outline-none"
                            onClick={handleRemoveAvatar}
                            title="删除头像"
                          >
                            <X className="h-2 w-2" />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-2">
                          <Upload className="h-4 w-4 text-white/30" />
                          <span className="text-[9px] text-white/30 mt-1 leading-tight">
                            点击/拖拽
                          </span>
                        </div>
                      )}
                    </div>
                    {/* 隐藏的 File Input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>

                  {/* 信息输入行 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1 w-full">
                    {/* 姓名 */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="form-name"
                        className="text-[11px] font-bold text-white/45"
                      >
                        姓名 *
                      </label>
                      <input
                        id="form-name"
                        type="text"
                        placeholder="输入姓名..."
                        className="w-full rounded-[6px] border border-white/10 bg-black/35 px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 outline-none transition-colors duration-150 focus:border-white/20"
                        value={formState.name}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, name: e.target.value }))
                        }
                      />
                    </div>

                    {/* 关系 */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="form-relation"
                        className="text-[11px] font-bold text-white/45"
                      >
                        核心关系 *
                      </label>
                      <select
                        id="form-relation"
                        className="w-full rounded-[6px] border border-white/10 bg-black/35 px-2 py-1.5 text-xs text-white/80 outline-none transition-colors duration-150 focus:border-white/20 cursor-pointer"
                        value={formState.relationship}
                        onChange={(e) =>
                          setFormState((p) => ({
                            ...p,
                            relationship: e.target
                              .value as PersonProfile["relationship"],
                          }))
                        }
                      >
                        <option value="女朋友">女朋友 (Girlfriend) ❤️</option>
                        <option value="家人">家人 (Family)</option>
                        <option value="朋友">朋友 (Friend)</option>
                        <option value="同事">同事 (Colleague)</option>
                        <option value="其他">其他 (Other)</option>
                      </select>
                    </div>

                    {/* 性别 */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="form-gender"
                        className="text-[11px] font-bold text-white/45"
                      >
                        性别
                      </label>
                      <select
                        id="form-gender"
                        className="w-full rounded-[6px] border border-white/10 bg-black/35 px-2 py-1.5 text-xs text-white/80 outline-none transition-colors duration-150 focus:border-white/20 cursor-pointer"
                        value={formState.gender}
                        onChange={(e) =>
                          setFormState((p) => ({
                            ...p,
                            gender: e.target.value,
                          }))
                        }
                      >
                        <option value="女">女 (Female)</option>
                        <option value="男">男 (Male)</option>
                        <option value="保密">保密 / 其他</option>
                      </select>
                    </div>

                    {/* 生日 */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="form-birthday"
                        className="text-[11px] font-bold text-white/45"
                      >
                        生日 / 纪念日
                      </label>
                      <input
                        id="form-birthday"
                        type="text"
                        placeholder="例: 12月14日 或 1998-12-14"
                        className="w-full rounded-[6px] border border-white/10 bg-black/35 px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 outline-none transition-colors duration-150 focus:border-white/20"
                        value={formState.birthday}
                        onChange={(e) =>
                          setFormState((p) => ({
                            ...p,
                            birthday: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* 状态描述与联系方式 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="form-status"
                      className="text-[11px] font-bold text-white/45"
                    >
                      一句话特征/描述状态
                    </label>
                    <input
                      id="form-status"
                      type="text"
                      placeholder="例: 温柔可爱，善解人意"
                      className="w-full rounded-[6px] border border-white/10 bg-black/35 px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 outline-none transition-colors duration-150 focus:border-white/20"
                      value={formState.status}
                      onChange={(e) =>
                        setFormState((p) => ({ ...p, status: e.target.value }))
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="form-contact"
                      className="text-[11px] font-bold text-white/45"
                    >
                      联络机制 (微信/电话/地址)
                    </label>
                    <input
                      id="form-contact"
                      type="text"
                      placeholder="例: WeChat: tolin_love"
                      className="w-full rounded-[6px] border border-white/10 bg-black/35 px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 outline-none transition-colors duration-150 focus:border-white/20"
                      value={formState.contact}
                      onChange={(e) =>
                        setFormState((p) => ({ ...p, contact: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* 标签录入行 */}
                <div className="flex flex-col gap-1.5 border-t border-white/5 pt-4">
                  <span className="text-[11px] font-bold text-white/45">
                    行为特征与倾向标签 (输入并回车确定)
                  </span>
                  <div className="rounded-[6px] border border-white/10 bg-black/40 p-2">
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {formState.tags.map((tag) => (
                        <Tag
                          key={tag}
                          prefix="#"
                          onClose={() => handleRemoveFormTag(tag)}
                        >
                          {tag}
                        </Tag>
                      ))}
                    </div>
                    <input
                      type="text"
                      className="w-full rounded-[4px] border border-white/5 bg-black px-2 py-1 text-xs text-white placeholder:text-white/25 outline-none transition-colors duration-150 focus:border-white/15"
                      placeholder={
                        formState.tags.length >= 8
                          ? "已达标签数量限制"
                          : "输入标签后，按回车或点加号进行确认..."
                      }
                      disabled={formState.tags.length >= 8}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                  </div>
                </div>

                {/* 详细备注档案 Markdown 编辑器 */}
                <div className="flex flex-col gap-1.5 border-t border-white/5 pt-4">
                  <span className="text-[11px] font-bold text-white/45">
                    Dossier / 详细背景备注档案 (Markdown 编辑器)
                  </span>
                  <div className="p-1 rounded-[6px] border border-white/8 bg-black/15">
                    <MarkdownEditor
                      id="people-dossier-editor"
                      height={500}
                      placeholder="写下详细的性格喜好、关键习惯、约会备忘录、纪念日以及你们重要的共同记忆..."
                      value={formState.details}
                      onChange={(value) =>
                        setFormState((p) => ({ ...p, details: value }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* 3. 底部吸底控制栏 */}
              <div className="p-4 border-t border-white/5 bg-black/30 flex items-center justify-end gap-3.5 flex-shrink-0">
                <button
                  type="button"
                  className="rounded-[6px] border border-white/10 bg-black px-3.5 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors duration-150 cursor-pointer font-medium"
                  onClick={() => setMode("view")}
                >
                  取消
                </button>
                <IconButton
                  iconOnly={false}
                  highlighted
                  className="px-4 py-1.5 text-xs font-bold gap-1.5"
                  disabled={!formState.name.trim()}
                  onClick={handleSaveForm}
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>保存档案</span>
                </IconButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
