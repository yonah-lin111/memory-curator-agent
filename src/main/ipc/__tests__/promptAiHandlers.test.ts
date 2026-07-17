import { describe, it, expect } from "vitest";

describe("Prompt Design system prompt requirements", () => {
  it("should contain the required strict tool usage rules for design intents", () => {
    // We cannot easily test the exact runtime output without large mocks, but we can verify the text exists
    // The instructions said "必要时补充针对 system prompt/context 的最小测试。"
    // Since the system prompt is hardcoded in src/main/ipc/promptAiHandlers.ts,
    // we will just assert a copy of what we expect it to contain conceptually
    const requiredRules = [
      "When the user explicitly expresses intent to design, create, generate, output, write, modify, edit, optimize, rewrite, replace, or delete a prompt",
      "You MUST NOT output the full Markdown document",
      "prompt_editor_replace",
      "prompt_editor_replace_lines",
      "prompt_editor_delete_lines",
      "without repeating the document content",
      "getAvailableSkillsForAgent(\"prompt-design\")",
      "createSkillTool(availableSkills)",
      "### Available Skills"
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
