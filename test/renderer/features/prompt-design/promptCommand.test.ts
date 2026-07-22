import { describe, expect, it } from "vitest";
import {
  getPromptCommandOptions,
  isPromptChangeCommand,
} from "@/features/prompt-design/lib/promptCommand";

describe("promptCommand", () => {
  it("支持模糊匹配二级创建命令", () => {
    expect(getPromptCommandOptions("/prompt dgn").map((option) => option.id)).toEqual([
      "design",
    ]);
  });

  it("支持模糊匹配操作参数", () => {
    expect(getPromptCommandOptions("/prompt design[首页] -rt").map((option) => option.id)).toEqual([
      "root",
    ]);
  });

  it("design[] 默认可执行且不再接受 -change", () => {
    expect(isPromptChangeCommand("/prompt design[首页]")).toBe(true);
    expect(isPromptChangeCommand("/prompt design[首页] -change")).toBe(false);
  });
});
