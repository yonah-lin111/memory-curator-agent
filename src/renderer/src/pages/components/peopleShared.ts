// 人物关系档案数据接口。
export interface PersonProfile {
  // 唯一标识。
  id: string;
  // 头像地址。
  avatar: string;
  // 姓名。
  name: string;
  // 性别。
  gender: string;
  // 关系分类。
  relationship: "女朋友" | "家人" | "朋友" | "同事" | "其他";
  // 一句话特征描述。
  status: string;
  // 生日。
  birthday: string;
  // 联系方式。
  contact: string;
  // 特征标签。
  tags: string[];
  // Markdown 详细背景档案。
  details: string;
  // 创建时间。
  createdAt: string;
  // 更新时间。
  updatedAt: string;
}

// 人物保存载荷类型。
export type PersonPayload = Omit<PersonProfile, "id" | "createdAt" | "updatedAt">;

// 关系分类筛选类型。
export type RelationshipFilter = "全部" | "女朋友" | "家人" | "朋友" | "同事" | "其他";

// 表单编辑状态。
export interface FormState {
  // 姓名。
  name: string;
  // 性别。
  gender: string;
  // 关系分类。
  relationship: PersonProfile["relationship"];
  // 一句话特征描述。
  status: string;
  // 生日。
  birthday: string;
  // 联系方式。
  contact: string;
  // 特征标签。
  tags: string[];
  // Markdown 详细背景档案。
  details: string;
  // 头像地址。
  avatar: string;
}

// 页面模式类型。
export type PeoplePageMode = "view" | "edit" | "create";

// LocalStorage 存储键名。
export const LOCAL_STORAGE_KEY = "mc_people_profiles";

// tolin 初始档案。
export const TOLIN_PROFILE: PersonProfile = {
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
};

// 初始人物种子。
export const INITIAL_PEOPLE: PersonProfile[] = [TOLIN_PROFILE];

// 关系对应的背景与文本颜色。
export const RELATIONSHIP_COLORS: Record<
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
export const INITIAL_FORM_STATE: FormState = {
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
 * 生成人物保存载荷。
 */
export const createPersonPayload = (person: FormState | PersonProfile): PersonPayload => ({
  name: person.name.trim(),
  gender: person.gender.trim(),
  relationship: person.relationship,
  status: person.status.trim(),
  birthday: person.birthday.trim(),
  contact: person.contact.trim(),
  tags: person.tags,
  details: person.details,
  avatar: person.avatar,
});

/**
 * 生成页面显示时间。
 */
export const createDisplayTime = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

/**
 * 读取唯一允许自动初始化的人物种子。
 */
export const readPeopleSeed = (): PersonProfile[] => {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!saved) {
    return INITIAL_PEOPLE;
  }

  try {
    const parsed = JSON.parse(saved) as PersonProfile[];
    const savedTolin = Array.isArray(parsed)
      ? parsed.find((person) => person.id === "tolin" || person.name === "tolin")
      : null;
    return savedTolin ? [{ ...TOLIN_PROFILE, ...savedTolin, id: "tolin" }] : INITIAL_PEOPLE;
  } catch {
    return INITIAL_PEOPLE;
  }
};

/**
 * 创建新建模式表单初始值。
 */
export const createInitialFormState = (): FormState => ({
  ...INITIAL_FORM_STATE,
  details: `# 详细档案与备注 🤍\n\n### 🌸 个人偏好\n- 喜欢：\n- 讨厌：\n\n### 📝 备忘录\n- `,
});
