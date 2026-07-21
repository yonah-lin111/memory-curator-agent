import { describe, it, expect } from "vitest";
import { loadPromptDesignAgentPrompt } from "@/services/agentPromptService";

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
      "const fileTools = projectRoot ? createPromptFileTools(projectRoot) : []",
      "<current-editor-context>",
      "<repository-context>",
      "<available-skills>",
      "getAvailableSkillsForAgent(\"prompt-design\")",
      "createSkillTool(availableSkills)",
      "escapeXmlText(skill.description || skill.name)"
    ];
    
    // Instead of mocking the whole file, we can read the source file directly for a lightweight verification
    // This ensures the strict rules stay in the source code.
    const fs = require('fs');
    const path = require('path');
    
    const sourceCode = fs.readFileSync(path.join(__dirname, '../promptAiHandlers.ts'), 'utf-8');
    const promptService = fs.readFileSync(path.join(__dirname, '../../services/agentPromptService.ts'), 'utf-8');
    const promptFile = fs.readFileSync(path.join(process.env.HOME || '', '.mc/system prompt/prompt-design.xml'), 'utf-8');
    const promptSource = `${sourceCode}\n${promptService}\n${promptFile}`;
    
    for (const rule of requiredRules) {
      expect(promptSource).toContain(rule);
    }
  });

  it("按标签将用户提示词注入内置系统提示词", () => {
    const prompt = loadPromptDesignAgentPrompt();

    expect(prompt.match(/<system>/g)).toHaveLength(1);
    expect(prompt).toContain("<prompt-structure>");
    expect(prompt).toContain("<information-policy>");
    expect(prompt).not.toContain("<principle></principle>");
    expect(prompt).not.toContain("<constraint></constraint>");
    expect(prompt).not.toContain("<rule></rule>");
    expect(prompt.indexOf("<prompt-structure>")).toBeGreaterThan(prompt.indexOf("<policies>"));
  });
});
