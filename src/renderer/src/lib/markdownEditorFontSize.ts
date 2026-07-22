// Markdown 编辑器默认字号。
export const DEFAULT_MARKDOWN_EDITOR_FONT_SIZE = 14;
// Markdown 编辑器允许的最小字号。
export const MIN_MARKDOWN_EDITOR_FONT_SIZE = 12;
// Markdown 编辑器允许的最大字号。
export const MAX_MARKDOWN_EDITOR_FONT_SIZE = 24;

const MARKDOWN_EDITOR_FONT_SIZE_STORAGE_PREFIX = "memory-curator.markdown-editor-font-size";

/**
 * 将字号限制在编辑器支持的范围内。
 */
const normalizeFontSize = (fontSize: number): number =>
  Math.min(MAX_MARKDOWN_EDITOR_FONT_SIZE, Math.max(MIN_MARKDOWN_EDITOR_FONT_SIZE, fontSize));

/**
 * 获取指定编辑器的字号存储键，未配置持久化键时返回 null。
 */
const getStorageKey = (fontSizeStorageKey?: string): string | null => {
  const normalizedKey = fontSizeStorageKey?.trim();
  return normalizedKey ? `${MARKDOWN_EDITOR_FONT_SIZE_STORAGE_PREFIX}.${normalizedKey}` : null;
};

/**
 * 读取指定编辑器的持久化字号，未配置或无效时回退为默认字号。
 */
export const getMarkdownEditorFontSize = (fontSizeStorageKey?: string): number => {
  const storageKey = getStorageKey(fontSizeStorageKey);
  if (!storageKey) return DEFAULT_MARKDOWN_EDITOR_FONT_SIZE;

  try {
    const storedValue = localStorage.getItem(storageKey);
    if (storedValue === null) return DEFAULT_MARKDOWN_EDITOR_FONT_SIZE;

    const storedFontSize = Number(storedValue);
    return Number.isInteger(storedFontSize)
      ? normalizeFontSize(storedFontSize)
      : DEFAULT_MARKDOWN_EDITOR_FONT_SIZE;
  } catch {
    return DEFAULT_MARKDOWN_EDITOR_FONT_SIZE;
  }
};

/**
 * 保存指定编辑器的字号，未配置持久化键时仅返回规范化后的字号。
 */
export const saveMarkdownEditorFontSize = (fontSize: number, fontSizeStorageKey?: string): number => {
  const normalizedFontSize = normalizeFontSize(fontSize);
  const storageKey = getStorageKey(fontSizeStorageKey);
  if (!storageKey) return normalizedFontSize;

  try {
    localStorage.setItem(storageKey, String(normalizedFontSize));
  } catch {
    // 存储不可用时仍允许更新当前编辑器实例。
  }

  return normalizedFontSize;
};
