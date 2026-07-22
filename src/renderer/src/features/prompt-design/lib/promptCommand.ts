import { usePromptDesignStore } from "@/features/prompt-design/store/promptDesignStore";
import { isFuzzyCommandMatch } from "@/lib/ai-shared/utils";

// Prompt 创建命令的候选项。
export interface PromptCommandOption {
  id: "module" | "design" | "title" | "root";
  name: string;
  description: string;
}

// 命令解析出的创建参数。
type PromptCreation = {
  moduleName?: string;
  designName?: string;
};

// 侧边栏刷新事件名称。
export const PROMPT_DESIGN_CREATED_EVENT = "prompt-design:created";

// 提示词设计标题变更后的侧边栏刷新事件名称。
export const PROMPT_DESIGN_TITLE_UPDATED_EVENT = "prompt-design:title-updated";

// 提示词设计标题生成状态事件名称。
export const PROMPT_DESIGN_TITLE_GENERATING_EVENT = "prompt-design:title-generating";

// /prompt 的首级创建命令。
const PROMPT_CREATE_OPTIONS: PromptCommandOption[] = [
  {
    id: "module",
    name: "module[]",
    description: "在当前项目中创建模块",
  },
  {
    id: "design",
    name: "design[]",
    description: "在当前项目中创建设计",
  },
  {
    id: "title",
    name: "title",
    description: "根据提示词生成简短标题",
  },
];

// /prompt 的执行命令。
const PROMPT_ACTION_OPTIONS: PromptCommandOption[] = [
  {
    id: "root",
    name: "-root",
    description: "在项目根目录创建",
  },
];

/**
 * 获取当前 /prompt 输入阶段对应的命令面板候选项。
 */
export const getPromptCommandOptions = (value: string): PromptCommandOption[] => {
  const normalizedValue = value.trim();
  if (!normalizedValue.startsWith("/prompt")) {
    return [];
  }

  if (/^\/prompt\s*$/.test(normalizedValue)) {
    return PROMPT_CREATE_OPTIONS;
  }

  const lastToken = normalizedValue.split(/\s+/).at(-1) ?? "";
  if (lastToken.startsWith("-")) {
    const actionQuery = lastToken.slice(1).toLowerCase();
    return PROMPT_ACTION_OPTIONS.filter((option) =>
      isFuzzyCommandMatch(actionQuery, option.id),
    );
  }

  return PROMPT_CREATE_OPTIONS.filter((option) =>
    isFuzzyCommandMatch(lastToken.toLowerCase(), option.id),
  );
};

/**
 * 将创建候选项转换为可继续填写的命令模板。
 */
export const getPromptCommandTemplate = (commandId: "module" | "design"): string =>
  commandId === "module" ? "/prompt module[]" : "/prompt design[]";

/**
 * 将当前未完成的操作命令替换为选中的操作。
 */
export const applyPromptAction = (value: string, action: "root"): string =>
  `${value.replace(/-\S*\s*$/, "").trim()} -${action} `;

/**
 * 判断输入是否是可执行的 /prompt 创建命令。
 */
export const isPromptChangeCommand = (value: string): boolean => {
  const { moduleName, designName } = parsePromptCreation(value);
  return (
    /^\/(?:prompt|newDesign)(?:\s+module\[[^\]]*\])?(?:\s+design\[[^\]]*\])?(?:\s+-root)*\s*$/i.test(
      value,
    ) && Boolean(moduleName || designName)
  );
};

/**
 * 从 /prompt 创建命令中读取模块与设计名称。
 */
const parsePromptCreation = (value: string): PromptCreation => {
  const moduleName = value.match(/\bmodule\[([^\]]*)\]/i)?.[1]?.trim();
  const designName = value.match(/\bdesign\[([^\]]*)\]/i)?.[1]?.trim();

  return { moduleName, designName };
};

/**
 * 执行 /prompt 创建命令；创建设计时同时切换到该设计。
 */
export const executePromptChangeCommand = async (
  value: string,
): Promise<{ created: "module" | "design"; opened: boolean }> => {
  const { moduleName, designName } = parsePromptCreation(value);
  const store = usePromptDesignStore.getState();
  const projectId = store.activeProjectId;
  const shouldCreateAtRoot = value.trim().split(/\s+/).includes("-root");
  const shouldOpenDesign = Boolean(designName);

  if (!projectId) {
    throw new Error("请先在侧边栏选择项目");
  }
  if (!moduleName && !designName) {
    throw new Error("请至少填写模块或设计名称");
  }

  let moduleId = shouldCreateAtRoot ? undefined : store.activeModuleId ?? undefined;
  if (moduleName) {
    const module = await (window.api as any).promptDesign.modules.create({
      projectId,
      name: moduleName,
    });
    if (!shouldCreateAtRoot) {
      moduleId = module.id;
    }
  }

  if (moduleName && !designName) {
    if (shouldOpenDesign && !shouldCreateAtRoot) {
      store.setActiveModuleId(moduleId ?? null);
    }
    window.dispatchEvent(new Event(PROMPT_DESIGN_CREATED_EVENT));
    return { created: "module", opened: false };
  }

  const design = await (window.api as any).promptDesign.designs.create({
    projectId,
    moduleId,
    name: designName || "new design",
  });
  const sessions = await (window.api as any).promptAi.listSessions(design.id);
  if (!sessions?.length) {
    await (window.api as any).promptAi.createSession(design.id);
  }

  if (shouldOpenDesign) {
    store.setActiveProjectId(projectId);
    store.setActiveModuleId(moduleId ?? null);
    if (store.setActiveDesignIdSafe) {
      await store.setActiveDesignIdSafe(design.id);
    } else {
      store.setActiveDesignId(design.id);
    }
    store.setItemName(design.name);
  }
  window.dispatchEvent(new Event(PROMPT_DESIGN_CREATED_EVENT));
  return { created: "design", opened: shouldOpenDesign };
};

/**
 * 根据当前设计的提示词正文生成并更新标题。
 */
export const executePromptTitleCommand = async (): Promise<string> => {
  const store = usePromptDesignStore.getState();
  const designId = store.activeDesignId;
  if (!designId) {
    throw new Error("请先选择提示词设计");
  }

  const designs = await window.api.promptDesign?.designs.list();
  const design = designs?.find((item) => item.id === designId);
  const content = typeof design?.designData === "string" ? design.designData.trim() : "";
  if (!content) {
    throw new Error("提示词内容为空，无法生成标题");
  }

  const generateTitle = window.api.promptAi?.generateDesignTitle;
  if (typeof generateTitle !== "function") {
    throw new Error("标题生成服务已更新，请重启应用后重试");
  }

  window.dispatchEvent(new CustomEvent(PROMPT_DESIGN_TITLE_GENERATING_EVENT, {
    detail: { designId, isGenerating: true },
  }));
  try {
    const title = (await generateTitle(content)).trim().slice(0, 12);
    if (!title) {
      throw new Error("未生成有效标题");
    }
    await window.api.promptDesign?.designs.rename(designId, title);
    if (usePromptDesignStore.getState().activeDesignId === designId) {
      usePromptDesignStore.getState().setItemName(title);
    }
    window.dispatchEvent(new Event(PROMPT_DESIGN_TITLE_UPDATED_EVENT));
    return title;
  } finally {
    window.dispatchEvent(new CustomEvent(PROMPT_DESIGN_TITLE_GENERATING_EVENT, {
      detail: { designId, isGenerating: false },
    }));
  }
};
