// 段落最小比较长度，避免短词误伤正文。
const MIN_REASONING_COMPARE_LENGTH = 12

/**
 * normalizeReasoningText - 归一化文本用于重复判断。
 */
const normalizeReasoningText = (content: string): string => content.replace(/[^\p{L}\p{N}]+/gu, "")

/**
 * splitReasoningParagraphs - 按空行拆分 Markdown 段落。
 */
const splitReasoningParagraphs = (content: string): string[] =>
  content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

/**
 * isDuplicateReasoningParagraph - 判断正文段落是否已在思考内容中出现。
 */
const isDuplicateReasoningParagraph = (
  paragraph: string,
  reasoningParagraphs: string[],
): boolean => {
  const normalizedParagraph = normalizeReasoningText(paragraph)

  if (normalizedParagraph.length < MIN_REASONING_COMPARE_LENGTH) {
    return false
  }

  return reasoningParagraphs.some((reasoningParagraph) => {
    const normalizedReasoning = normalizeReasoningText(reasoningParagraph)

    return (
      normalizedReasoning.length >= MIN_REASONING_COMPARE_LENGTH &&
      (normalizedReasoning.includes(normalizedParagraph) ||
        normalizedParagraph.includes(normalizedReasoning))
    )
  })
}

/**
 * stripReasoningFromTextContent - 从普通正文中剥离已单独展示的思考段落。
 */
export const stripReasoningFromTextContent = (
  content: string,
  reasoningContents: string[],
): string => {
  const reasoningParagraphs = reasoningContents.flatMap(splitReasoningParagraphs)

  if (reasoningParagraphs.length === 0) {
    return content
  }

  return splitReasoningParagraphs(content)
    .filter((paragraph) => !isDuplicateReasoningParagraph(paragraph, reasoningParagraphs))
    .join("\n\n")
    .trim()
}

// 可参与文本去重的消息片段类型。
type DedupableMessagePart =
  // 消息片段类型。
  {
    // 片段类型。
    kind: string
    // 片段正文。
    content?: string
  }

/**
 * isDedupableContentPart - 判断片段是否包含需要参与去重的可渲染内容。
 */
const isDedupableContentPart = (part: DedupableMessagePart): boolean =>
  (part.kind === "reasoning" || part.kind === "text") && typeof part.content === "string"

/**
 * resolveDedupedRenderablePartContents - 按原片段顺序剥离重复的思考与正文段落。
 */
export const resolveDedupedRenderablePartContents = (parts: DedupableMessagePart[]): string[] => {
  const referenceContents: string[] = []

  return parts.map((part) => {
    if (!isDedupableContentPart(part) || typeof part.content !== "string") {
      return ""
    }

    const dedupedContent = stripReasoningFromTextContent(part.content, referenceContents)

    if (dedupedContent) {
      referenceContents.push(dedupedContent)
    }

    return dedupedContent
  })
}

/**
 * resolveDedupedTextPartContents - 剥离当前消息内跨片段重复出现的文本段落。
 */
export const resolveDedupedTextPartContents = (parts: DedupableMessagePart[]): string[] => {
  const referenceContents: string[] = []
  const textPartContents: string[] = []

  for (const part of parts) {
    if (part.kind === "reasoning" && typeof part.content === "string") {
      referenceContents.push(part.content)
      continue
    }

    if (part.kind !== "text" || typeof part.content !== "string") {
      continue
    }

    const dedupedContent = stripReasoningFromTextContent(part.content, referenceContents)

    textPartContents.push(dedupedContent)

    if (dedupedContent) {
      referenceContents.push(dedupedContent)
    }
  }

  return textPartContents
}

/**
 * resolveDedupedTextContents - 提取非空去重正文。
 */
export const resolveDedupedTextContents = (parts: DedupableMessagePart[]): string[] =>
  resolveDedupedTextPartContents(parts).filter(Boolean)
