import { describe, it, expect } from "vitest";

describe("Prompt Design system prompt requirements", () => {
  it("should contain the required strict tool usage rules for design intents", () => {
    // We cannot easily test the exact runtime output without large mocks, but we can verify the text exists
    // The instructions said "必要时补充针对 system prompt/context 的最小测试。"
    // Since the system prompt is hardcoded in src/main/ipc/promptAiHandlers.ts,
    // we will just assert a copy of what we expect it to contain conceptually
    const requiredRules = [
      "<system>",
      "<role>",
      "<principles>",
      "<constraints>",
      "<policies>",
      "<rules>",
      "<output-format>",
      "RTCF Markdown 结构",
      "Role、Task、Context、Format",
      "不得将产出提示词改为 XML",
      "grill-me",
      "hasCodeGraph",
      "hasCodebaseMemory",
      "const fileTools = projectRoot ? createPromptFileTools(projectRoot) : []",
      "<code-research-policy>",
      "<current-editor-context>",
      "<repository-context>",
      "<available-skills>",
      "不得在聊天回复中输出完整文档",
      "prompt_editor_replace",
      "prompt_editor_replace_lines",
      "prompt_editor_delete_lines",
      "只简短确认结果，不重复文档内容",
      "getAvailableSkillsForAgent(\"prompt-design\")",
      "createSkillTool(availableSkills)",
      "escapeXmlText(skill.description || skill.name)"
    ];
    
    // Instead of mocking the whole file, we can read the source file directly for a lightweight verification
    // This ensures the strict rules stay in the source code.
    const fs = require('fs');
    const path = require('path');
    
    const sourceCode = fs.readFileSync(path.join(__dirname, '../promptAiHandlers.ts'), 'utf-8');
    
    for (const rule of requiredRules) {
      expect(sourceCode).toContain(rule);
    }
  });
});
