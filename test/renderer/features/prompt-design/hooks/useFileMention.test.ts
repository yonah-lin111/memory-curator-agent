import { describe, expect, it } from "vitest"
import { getFileMentionDeletionRange } from "@/lib/ai-shared/utils"

describe("useFileMention - getFileMentionDeletionRange", () => {
  it("光标紧贴任意 @token 末尾时，普通 Backspace 必须返回 null 遵循原生逐字删除", () => {
    const text1 = "hello @historlist1"
    // Cursor is right at the end of "@historlist1" (index 18)
    expect(getFileMentionDeletionRange(text1, 18)).toBeNull()

    const text2 = "@file.txt"
    expect(getFileMentionDeletionRange(text2, 9)).toBeNull()
  })

  it("当光标位于该 @token 后一个或多个连续空白字符之后时，普通 Backspace 一次返回删除整块的范围", () => {
    const text1 = "hello @historlist1 "
    // "@historlist1" is from index 6 to 18. Space is at 18. Cursor is at 19.
    expect(getFileMentionDeletionRange(text1, 19)).toEqual({
      start: 6,
      end: 19,
    })

    const text2 = "@file.txt    "
    // "@file.txt" is from index 0 to 9. 4 spaces follow. Cursor is at 13.
    expect(getFileMentionDeletionRange(text2, 13)).toEqual({
      start: 0,
      end: 13,
    })
  })

  it("仅支持空格、制表符等水平空白，绝不可吞换行（改为明确断言换行后返回 null）", () => {
    const textNewline = "@file.ts\n"
    expect(getFileMentionDeletionRange(textNewline, 9)).toBeNull()

    const textTab = "@file.ts\t\t"
    // Length of "@file.ts\t\t" is 10. Cursor is at index 10 (at the end of the string)
    expect(getFileMentionDeletionRange(textTab, 10)).toEqual({
      start: 0,
      end: 10,
    })
  })

  it("当光标和 @token 之间夹杂了非空白字符时，普通 Backspace 必须返回 null", () => {
    const text = "@file.ts  abc "
    // Cursor is at 14 (end of the string)
    // Between "@file.ts" and cursor we have spaces, "abc", and a space.
    expect(getFileMentionDeletionRange(text, 14)).toBeNull()
  })
})
