import { usePromptDesignStore } from "@/features/prompt-design/store/promptDesignStore";

// Prompt 创建命令的候选项。
export interface PromptCommandOption {
  id: "module" | "design" | "root" | "change";
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
];

// /prompt 的执行命令。
const PROMPT_ACTION_OPTIONS: PromptCommandOption[] = [
  {
    id: "root",
    name: "-root",
    description: "在项目根目录创建",
  },
  {
    id: "change",
    name: "-change",
    description: "创建并打开设计",
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
  if (!lastToken.startsWith("-")) {
    return [];
  }

  return normalizedValue.split(/\s+/).includes("-root")
    ? PROMPT_ACTION_OPTIONS.filter((option) => option.id === "change")
    : PROMPT_ACTION_OPTIONS;
};

/**
 * 将创建候选项转换为可继续填写的命令模板。
 */
export const getPromptCommandTemplate = (commandId: "module" | "design"): string =>
  commandId === "module" ? "/prompt module[]" : "/prompt design[]";

/**
 * 将当前未完成的操作命令替换为选中的操作。
 */
export const applyPromptAction = (value: string, action: "root" | "change"): string =>
  `${value.replace(/-\S*\s*$/, "").trim()} -${action} `;

/**
 * 判断输入是否是可执行的 /prompt 创建命令。
 */
export const isPromptChangeCommand = (value: string): boolean =>
  /^\/(?:prompt|newDesign)(?:\s+module\[[^\]]*\])?(?:\s+design\[[^\]]*\])?(?:\s+-(?:root|change))+\s*$/i.test(
    value,
  ) && value.trim().split(/\s+/).includes("-change");

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
export const executePromptChangeCommand = async (value: string): Promise<boolean> => {
  const { moduleName, designName } = parsePromptCreation(value);
  const store = usePromptDesignStore.getState();
  const projectId = store.activeProjectId;
  const shouldCreateAtRoot = value.trim().split(/\s+/).includes("-root");

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

  if (!designName) {
    if (moduleName && !shouldCreateAtRoot) {
      store.setActiveModuleId(moduleId ?? null);
    }
    window.dispatchEvent(new Event(PROMPT_DESIGN_CREATED_EVENT));
    return false;
  }

  const design = await (window.api as any).promptDesign.designs.create({
    projectId,
    moduleId,
    name: designName,
  });
  const sessions = await (window.api as any).promptAi.listSessions(design.id);
  if (!sessions?.length) {
    await (window.api as any).promptAi.createSession(design.id);
  }

  store.setActiveProjectId(projectId);
  store.setActiveModuleId(moduleId ?? null);
  if (store.setActiveDesignIdSafe) {
    await store.setActiveDesignIdSafe(design.id);
  } else {
    store.setActiveDesignId(design.id);
  }
  store.setItemName(design.name);
  window.dispatchEvent(new Event(PROMPT_DESIGN_CREATED_EVENT));
  return true;
};
