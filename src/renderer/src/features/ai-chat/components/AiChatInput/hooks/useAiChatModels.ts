import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { AiModelProviderOption, AiModelSelection } from "@/features/ai-chat/types";

/**
 * useAiChatModels - 专门管理 AI 模型切换选项构造、快速匹配 `/model <查询>` 过滤以及切换 AI 模型的微 Hook。
 *
 * @param inputText 输入文本状态值
 * @param setInputText 改变输入文本状态回调
 * @param modelOptions 所有的 AI provider 及其模型配置选项
 * @param textareaRef 文本框 DOM 引用
 * @param resetHistoryCursor 重置历史提示词游标回调
 * @param onModelChange 外部切换模型通知回调
 */
export const useAiChatModels = (
  inputText: string,
  setInputText: (value: string) => void,
  modelOptions: AiModelProviderOption[],
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  resetHistoryCursor: () => void,
  onModelChange: (selection: AiModelSelection) => void,
) => {
  const toast = useToast();
  const [activeModelIndex, setActiveModelIndex] = useState(0);

  const isModelMode = inputText === "/model" || inputText.startsWith("/model ");
  const modelQuery = inputText.startsWith("/model ") ? inputText.slice(7).trim() : "";

  // 整理出扁平的模型结构列表，用于快速匹配
  const allModels = useMemo(() => {
    const list: Array<{
      id: string; // providerId::modelId
      providerId: string;
      providerName: string;
      modelId: string;
      modelName: string;
    }> = [];
    modelOptions.forEach((provider) => {
      provider.models.forEach((model) => {
        list.push({
          id: `${provider.id}::${model.id}`,
          providerId: provider.id,
          providerName: provider.name,
          modelId: model.id,
          modelName: model.name || model.id,
        });
      });
    });
    return list;
  }, [modelOptions]);

  // 根据用户的输入过滤匹配的模型列表
  const matchedModels = useMemo(() => {
    if (!isModelMode) return [];
    if (!modelQuery) return allModels;
    const query = modelQuery.toLowerCase();
    return allModels.filter(
      (model) =>
        model.modelName.toLowerCase().includes(query) ||
        model.providerName.toLowerCase().includes(query) ||
        model.modelId.toLowerCase().includes(query),
    );
  }, [allModels, isModelMode, modelQuery]);

  useEffect(() => {
    setActiveModelIndex(0);
  }, [matchedModels.length]);

  /**
   * 选择指定的 AI 模型并恢复输入状态。
   */
  const selectModel = useCallback((model: {
    id: string;
    providerId: string;
    providerName: string;
    modelId: string;
    modelName: string;
  }): void => {
    onModelChange({ provider: model.providerId, model: model.modelId });
    toast.success(`已切换模型为: ${model.modelName}`);
    setInputText("");
    resetHistoryCursor();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [onModelChange, toast, setInputText, resetHistoryCursor, textareaRef]);

  /**
   * 循环切换模型选择面板选中项。
   */
  const moveActiveModel = useCallback((direction: 1 | -1): void => {
    setActiveModelIndex((currentIndex) => {
      if (matchedModels.length === 0) {
        return 0;
      }
      return (
        (currentIndex + direction + matchedModels.length) %
        matchedModels.length
      );
    });
  }, [matchedModels.length]);

  /**
   * 处理 AI 模型切换，value 使用 provider/model 组合避免跨 provider 模型重名。
   */
  const handleModelChange = useCallback((value: string): void => {
    const [provider, model] = value.split("::");
    if (!provider || !model) return;
    onModelChange({ provider, model });
  }, [onModelChange]);

  return {
    activeModelIndex,
    allModels,
    matchedModels,
    isModelMode,
    modelQuery,
    setActiveModelIndex,
    selectModel,
    moveActiveModel,
    handleModelChange,
  };
};
