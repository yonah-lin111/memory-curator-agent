import { createHash } from "node:crypto"

import type { AgentTool, AgentToolResult } from "@/agent/types"

export type PromptEditorDocument = { content: string; version: number }

type PromptEditorOperation = "read" | "replace" | "insert_lines" | "replace_lines" | "delete_lines"

// 编辑器正文的带行号表示，供 Agent 精确构造行级写入参数。
type PromptEditorLine = { number: number; content: string }

type PromptEditorResult = AgentToolResult & {
  data: {
    content: string
    documentHash: string
    lines?: PromptEditorLine[]
    operation: PromptEditorOperation
    baseVersion: number
    nextVersion: number
    applied: boolean
  }
}

type PromptEditorToolsOptions = {
  readDocument: () => Promise<PromptEditorDocument>
  applyDocument: (
    document: PromptEditorDocument,
    operation: Exclude<PromptEditorOperation, "read">,
  ) => Promise<PromptEditorDocument>
}

const MAX_WRITES_PER_RUN = 3

/**
 * 创建按需读取且由渲染端确认写入的提示词编辑器工具集。
 */
export const createPromptEditorTools = ({
  readDocument,
  applyDocument,
}: PromptEditorToolsOptions): AgentTool[] => {
  let lastRead: PromptEditorDocument | null = null
  let writeCount = 0

  const fail = (operation: PromptEditorOperation, reason: string): PromptEditorResult => ({
    observation: `Editor update was not applied: ${reason}`,
    data: {
      content: lastRead?.content ?? "",
      documentHash: getDocumentHash(lastRead?.content ?? ""),
      operation,
      baseVersion: lastRead?.version ?? -1,
      nextVersion: lastRead?.version ?? -1,
      applied: false,
    },
    terminal: true,
  })

  const read = async (): Promise<PromptEditorResult> => {
    try {
      lastRead = await readDocument()
      return {
        observation: `Read editor document at version ${lastRead.version}. Use data.lines for 1-based line numbers and copy data.documentHash for every replacement or deletion write.`,
        data: {
          content: lastRead.content,
          documentHash: getDocumentHash(lastRead.content),
          lines: toNumberedLines(lastRead.content),
          operation: "read",
          baseVersion: lastRead.version,
          nextVersion: lastRead.version,
          applied: true,
        },
      }
    } catch (error) {
      return fail("read", getErrorMessage(error))
    }
  }

  /**
   * 仅在最新读取快照的预条件成立时生成候选正文，并等待渲染端确认。
   */
  const write = async (
    input: unknown,
    operation: Exclude<PromptEditorOperation, "read">,
  ): Promise<PromptEditorResult> => {
    if (!lastRead) return fail(operation, "call prompt_editor_read before editing")
    if (writeCount >= MAX_WRITES_PER_RUN)
      return fail(operation, `maximum of ${MAX_WRITES_PER_RUN} editor writes reached`)
    if (!isRecord(input) || input.documentVersion !== lastRead.version)
      return fail(operation, "documentVersion does not match the latest read")

    let content: string
    try {
      content = getNextContent(lastRead.content, input, operation)
    } catch (error) {
      return fail(operation, getErrorMessage(error))
    }

    try {
      const appliedDocument = await applyDocument({ content, version: lastRead.version }, operation)
      if (appliedDocument.content !== content || appliedDocument.version !== lastRead.version + 1) {
        return fail(
          operation,
          "renderer acknowledgement did not match the requested document version",
        )
      }
      writeCount += 1
      // 强制下一次写入先读取渲染端确认后的最新候选正文。
      lastRead = null
      return {
        observation: `Editor ${operation} applied at version ${appliedDocument.version}. Read the editor again before another edit.`,
        data: {
          content: appliedDocument.content,
          documentHash: getDocumentHash(appliedDocument.content),
          operation,
          baseVersion: appliedDocument.version - 1,
          nextVersion: appliedDocument.version,
          applied: true,
        },
      }
    } catch (error) {
      return fail(operation, getErrorMessage(error))
    }
  }

  return [
    {
      name: "prompt_editor_read",
      description:
        "Read the latest Prompt Design Markdown working document, including all pending diff changes, 1-based lines, and its SHA-256 documentHash. Always call this before an editor write and after each write before another edit.",
      prompt: {
        summary: "Read the latest editor working document.",
        alwaysAvailable: true,
        whenToUse: ["Use before every editor modification."],
        safety: [
          "Use returned version as documentVersion for one subsequent write.",
          "For every replacement or deletion, copy data.documentHash exactly into expectedDocumentHash.",
        ],
        output: "Returns Markdown content, numbered lines, version, and SHA-256 documentHash.",
      },
      parameters: { type: "object", properties: {} },
      execute: async () => read(),
    },
    createWriteTool("prompt_editor_replace", "replace", write),
    createWriteTool("prompt_editor_insert_lines", "insert_lines", write),
    createWriteTool("prompt_editor_replace_lines", "replace_lines", write),
    createWriteTool("prompt_editor_delete_lines", "delete_lines", write),
  ]
}

/**
 * 基于经校验的参数构造候选正文；所有行号均为 1 开始的包含区间。
 */
const getNextContent = (
  currentContent: string,
  input: Record<string, unknown>,
  operation: Exclude<PromptEditorOperation, "read">,
): string => {
  if (operation === "replace") {
    if (input.allowFullRewrite !== true)
      throw new Error("full replacement requires allowFullRewrite=true")
    if (typeof input.content !== "string") throw new Error("replacement requires content string")
    if (
      typeof input.expectedDocumentHash !== "string" ||
      input.expectedDocumentHash !== getDocumentHash(currentContent)
    ) {
      throw new Error("expectedDocumentHash does not match the latest read")
    }
    return input.content
  }

  const lines = toLines(currentContent)
  if (operation === "insert_lines") {
    if (!isNonNegativeInteger(input.afterLine) || input.afterLine > lines.length)
      throw new Error(`afterLine must be within 0-${lines.length}`)
    if (typeof input.content !== "string") throw new Error("line insertion requires content string")
    const index = findInsertAnchorIndex(
      lines,
      input.afterLine,
      input.expectedBeforeLine,
      input.expectedAfterLine,
    )
    const insertedLines = toLines(input.content)
    return [...lines.slice(0, index), ...insertedLines, ...lines.slice(index)].join("\n")
  }

  if (!isPositiveInteger(input.startLine)) throw new Error("startLine must be a positive integer")
  const endLine = input.endLine === undefined ? input.startLine : input.endLine
  if (!isPositiveInteger(endLine) || endLine < input.startLine)
    throw new Error("endLine must be greater than or equal to startLine")
  if (input.startLine > lines.length || endLine > lines.length)
    throw new Error(`line range must be within 1-${lines.length}`)
  if (
    operation === "replace_lines" &&
    lines.length > 0 &&
    input.startLine === 1 &&
    endLine === lines.length
  ) {
    throw new Error(
      "replace_lines cannot replace the entire non-empty document; use prompt_editor_replace instead",
    )
  }
  if (
    typeof input.expectedDocumentHash !== "string" ||
    input.expectedDocumentHash !== getDocumentHash(currentContent)
  ) {
    throw new Error("expectedDocumentHash does not match the latest read")
  }
  const replacementLines = operation === "replace_lines" ? getReplacementLines(input.content) : []
  return [
    ...lines.slice(0, input.startLine - 1),
    ...replacementLines,
    ...lines.slice(endLine),
  ].join("\n")
}

/**
 * 通过相邻锚点定位唯一插入边界；afterLine 仅用于范围校验和诊断，避免行号偏移导致误插入。
 */
const findInsertAnchorIndex = (
  lines: string[],
  afterLine: number,
  before: unknown,
  after: unknown,
): number => {
  if (typeof before !== "string" || typeof after !== "string") {
    throw new Error(
      `insert anchors must be strings for requested afterLine ${afterLine}; call prompt_editor_read and copy exact adjacent line text`,
    )
  }

  const matches = Array.from({ length: lines.length + 1 }, (_, index) => index).filter((index) => {
    const actualBefore = index === 0 ? "" : lines[index - 1]
    const actualAfter = index === lines.length ? "" : lines[index]
    return before === actualBefore && after === actualAfter
  })
  if (matches.length === 1) return matches[0]

  const reason =
    matches.length === 0
      ? "no adjacent anchor match was found"
      : `the anchors match ${matches.length} insertion boundaries`
  throw new Error(
    `insert anchors could not identify a unique position for requested afterLine ${afterLine}: ${reason}. Call prompt_editor_read and provide a unique exact adjacent anchor pair; use a line replacement when the target cannot be uniquely anchored.`,
  )
}

/**
 * 校验替换内容并按编辑器的行模型拆分。
 */
const getReplacementLines = (content: unknown): string[] => {
  if (typeof content !== "string") throw new Error("line replacement requires content string")
  return toLines(content)
}

/**
 * 将空文档表示为空行列表，避免插入时引入虚假空行。
 */
const toLines = (content: string): string[] => (content === "" ? [] : content.split("\n"))

/**
 * 为读取结果生成 1 开始的行号，避免 Agent 手工计数造成范围漂移。
 */
const toNumberedLines = (content: string): PromptEditorLine[] =>
  toLines(content).map((line, index) => ({ number: index + 1, content: line }))

/**
 * 返回供全文替换预条件使用的稳定 SHA-256 摘要。
 */
const getDocumentHash = (content: string): string =>
  createHash("sha256").update(content).digest("hex")

const createWriteTool = (
  name: string,
  operation: Exclude<PromptEditorOperation, "read">,
  write: (
    input: unknown,
    operation: Exclude<PromptEditorOperation, "read">,
  ) => Promise<PromptEditorResult>,
): AgentTool => ({
  name,
  description: getDescription(operation),
  prompt: {
    summary: "Modify the editor working document from the latest read snapshot.",
    alwaysAvailable: true,
    whenToUse: ["Use after prompt_editor_read."],
    safety: [
      "Pass the exact documentVersion and required content preconditions from the latest read.",
      "Read again before each additional edit.",
    ],
    output: "Returns the renderer-confirmed candidate document and next version.",
  },
  parameters: getParameters(operation),
  execute: async (input) => write(input, operation),
})

const getDescription = (operation: Exclude<PromptEditorOperation, "read">): string => {
  if (operation === "replace")
    return "Replace the complete editor document. Use only for an explicit full rewrite or an empty document, with the exact SHA-256 hash from the latest read."
  if (operation === "insert_lines")
    return "Insert Markdown lines at the unique boundary identified by exact surrounding line anchors. afterLine is range-validated and used for diagnostics; a unique anchor match is authoritative."
  return `${operation === "replace_lines" ? "Replace" : "Delete"} an inclusive 1-based editor line range after exact expectedDocumentHash validation. replace_lines cannot cover the entire non-empty document.`
}

const getParameters = (
  operation: Exclude<PromptEditorOperation, "read">,
): AgentTool["parameters"] => {
  const common = {
    documentVersion: {
      type: "number",
      description:
        "The exact version returned by the latest prompt_editor_read. It is valid for one editor write only.",
    },
  }
  if (operation === "replace") {
    return {
      type: "object",
      required: ["documentVersion", "content", "expectedDocumentHash", "allowFullRewrite"],
      properties: {
        ...common,
        content: { type: "string", description: "The complete replacement Markdown document." },
        expectedDocumentHash: {
          type: "string",
          description:
            "Copy data.documentHash exactly from the latest prompt_editor_read. It is the SHA-256 hash of the complete current content.",
        },
        allowFullRewrite: {
          type: "boolean",
          description:
            "Must be true. Use only for an explicitly requested full rewrite or an empty document.",
        },
      },
    }
  }
  if (operation === "insert_lines") {
    return {
      type: "object",
      required: [
        "documentVersion",
        "afterLine",
        "content",
        "expectedBeforeLine",
        "expectedAfterLine",
      ],
      properties: {
        ...common,
        afterLine: {
          type: "number",
          description:
            "0-based requested insertion boundary: 0 is before line 1 and N is after line N. It must be in range, but the unique adjacent anchors determine the actual boundary.",
        },
        content: { type: "string", description: "The Markdown lines to insert." },
        expectedBeforeLine: {
          type: "string",
          description:
            "Exact text of the line before the insertion boundary from the latest read; use an empty string at the document start.",
        },
        expectedAfterLine: {
          type: "string",
          description:
            "Exact text of the line after the insertion boundary from the latest read; use an empty string at the document end.",
        },
      },
    }
  }
  return {
    type: "object",
    required:
      operation === "replace_lines"
        ? ["documentVersion", "startLine", "content", "expectedDocumentHash"]
        : ["documentVersion", "startLine", "expectedDocumentHash"],
    properties: {
      ...common,
      startLine: {
        type: "number",
        description:
          "First target line number, 1-based and inclusive. Read data.lines to obtain it.",
      },
      endLine: {
        type: "number",
        description: "Last target line number, 1-based and inclusive. Omit to edit only startLine.",
      },
      content: {
        type: "string",
        description:
          "Replacement Markdown for the inclusive target range. Required only by prompt_editor_replace_lines.",
      },
      expectedDocumentHash: {
        type: "string",
        description:
          "Copy data.documentHash exactly from the latest prompt_editor_read. It validates the complete current document before this line edit.",
      },
    },
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1
const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0
const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
