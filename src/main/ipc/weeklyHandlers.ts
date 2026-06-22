import { ipcMain } from "electron";
import { getDatabase } from "@/db";
import { createWeeklySummaryService, type DatabaseConnection } from '@/services/weeklySummaryService'
import { createThemesService } from '@/services/themesService'
import { createDailyService } from "@/services/dailyService";
import { createPeopleService } from "@/services/peopleService";
import { loadProviderConfig } from "@/agent/providers/providerConfig";
import { createModelProvider } from "@/agent/providers/providerFactory";
import type { ThemeItem, WeeklySummarySaveInput } from "@/db/schema";
import type {
  AgentMessage,
  ModelProvider,
  ModelStreamEvent,
} from "@/agent/types";

// 周度总结生成载荷。
type WeeklySummaryGeneratePayload = {
  // 周起始日期，格式 'YYYY-MM-DD'（周一）。
  weekStartDate: string;
  // 可选模型标识，不传则使用默认模型。
  model?: string;
  // 可选 provider 标识，不传则使用默认 provider。
  provider?: string;
};

/**
 * 计算从周一起的 7 天日期列表。
 */
const getWeekDates = (weekStartDate: string): string[] => {
  const start = new Date(weekStartDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
};

/**
 * 格式化当前时间为 'YYYY-MM-DD HH:mm'。
 */
const formatNow = (): string => {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

/** 把关检查结果 */
type GatekeeperResult = {
  /** 是否值得生成 */
  shouldGenerate: boolean;
  /** 跳过时使用的默认内容 */
  defaultContent: string;
};

/** AI 提取的主题条目 */
type ThemeExtractionItem = {
  name: string;
  confidence: number;
  evidence: string;
};

/**
 * 调用 AI 做生成前的把关检查，判断是否值得生成完整内容。
 */
const gatekeeperCheck = async (
  provider: ModelProvider,
  model: string,
  systemPrompt: string,
  userData: string,
): Promise<GatekeeperResult> => {
  const messages: AgentMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userData },
  ];

  let fullResponse = "";
  for await (const event of provider.streamTurn({
    model,
    messages,
    tools: [],
  })) {
    if (event.type === "text_delta") {
      fullResponse += event.delta;
    }
  }

  const firstLine = fullResponse.split("\n")[0]?.trim() ?? "";
  const shouldGenerate = firstLine.toUpperCase() === "YES";
  const defaultContent = shouldGenerate
    ? ""
    : fullResponse.substring(firstLine.length).trim() ||
      "本周暂无值得总结的记录。";

  return { shouldGenerate, defaultContent };
};

/**
 * 调用 AI 从已生成的总结中提取长期主题建议。
 * 独立 AI 调用，不依赖总结内联输出，可靠性和可控性更高。
 */
const extractThemesWithAI = async (
  provider: ModelProvider,
  model: string,
  summaryContent: string,
  existingThemes: ThemeItem[],
): Promise<ThemeExtractionItem[]> => {
  const existingThemesText = existingThemes.length > 0
    ? existingThemes.map((theme) => `- ${theme.name}`).join('\n')
    : '（目前无已有主题）';
  const systemPrompt = `你是一位专注于个人成长的主题策展助手。你的任务是从周度总结中识别可长期追踪的主题。
你的首要准则是【语义重用与对齐】。系统里已存在以下主题候选池：
${existingThemesText}

输出要求：
1. 提取 2-5 个主题。如果总结内容不足，输出空数组 []。
2. 每个提取的主题，你必须优先并尽可能在上面的【已有主题候选池】中寻找最契合的一项进行映射对齐复用（即使语义高度吻合而字面上有些微差异，也必须强制选用候选词，不可私自创造表达相似的新词）。
3. 只有当周总结中的行为或关键成长轨迹，确实与所有【已有主题】没有任何语义交集时，才允许定义和返回一个全新的主题名称（3-8个汉字，简洁精准，如「职业转型」「亲密关系」「健康管理」）。
4. 仅输出一个 JSON 数组，每个元素包含三个字段，不要包含任何其他文本或 Markdown 标记：
   - "name": 主题名（已有主题名或全新的具有长期叙事意义的名称）
   - "confidence": 置信度 0-100 的整数
   - "evidence": 从总结原文中引用一句最能支撑该主题的话（30字以内）

正确输出示例：
[{"name":"技能提升","confidence":85,"evidence":"本周完成了Rust基础教程的三章内容"},{"name":"健康管理","confidence":70,"evidence":"连续四天在23:30前入睡"}]`;

  const userMessage = `请从以下周度总结中提取长期主题：\n\n${summaryContent}`;

  const messages: AgentMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  let fullResponse = "";
  for await (const event of provider.streamTurn({
    model,
    messages,
    tools: [],
  })) {
    if (event.type === "text_delta") {
      fullResponse += event.delta;
    }
  }

  try {
    // 清洗 Markdown 代码块包裹，再提取 JSON 数组
    const cleaned = fullResponse
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // 从响应中精准提取 JSON 数组（模型可能在前后添加文字说明）
    const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!arrayMatch) {
      console.error('主题提取响应中未找到 JSON 数组:', cleaned.slice(0, 200));
      return [];
    }

    const parsed = JSON.parse(arrayMatch[0]);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is ThemeExtractionItem =>
          typeof item.name === 'string' &&
          item.name.trim().length > 0
      );
    }
    return [];
  } catch {
    console.error('主题提取 JSON 解析失败，原始响应:', fullResponse.slice(0, 200));
    return [];
  }
};

/**
 * 将 AI 提取的主题写入数据库。
 */
const saveExtractedThemes = (
  themesService: ReturnType<typeof createThemesService>,
  extracted: ThemeExtractionItem[],
  summaryId: number,
): number => {
  try {
    const database = getDatabase();
    database
      .prepare('DELETE FROM theme_items WHERE source_type = ? AND source_id = ? AND ai_extracted = 1')
      .run('weekly_summary', String(summaryId));
    console.log(`[主题提取] 已解绑周总结(ID: ${summaryId})旧 AI 主题关联`);
  } catch (err) {
    console.error('[主题提取] 清理旧主题关联失败:', err);
  }

  if (!extracted.length) {
    themesService.cleanupOrphanedAiThemes();
    return 0;
  }

  console.log(`[主题提取] 准备写入 ${extracted.length} 个新提取主题: ${extracted.map((t) => t.name).join(', ')}`);

  let count = 0;

  for (const theme of extracted) {
    if (!theme.name?.trim()) continue;

    // 模糊匹配已有主题（双向包含匹配）
    const allThemes = themesService.list();
    const matched = allThemes.find(
      (t) => t.name.includes(theme.name.trim()) || theme.name.trim().includes(t.name)
    );

    let themeExternalId: string;
    if (matched) {
      themeExternalId = matched.externalId;
      // 更新已有主题时间 + 追加新 evidence 到描述
      themesService.update(themeExternalId, {
        description: matched.description
          ? `${matched.description}; ${theme.evidence?.slice(0, 100) ?? ''}`
          : (theme.evidence?.slice(0, 200) ?? ''),
      });
    } else {
      const created = themesService.create({
        name: theme.name.trim(),
        description: theme.evidence?.slice(0, 200) ?? '',
        aiGenerated: 1,
      });
      themeExternalId = created.externalId;
    }

    // 关联到本周总结（ON CONFLICT 自动跳过重复）
    try {
      themesService.addItem({
        themeExternalId,
        sourceType: 'weekly_summary',
        sourceId: String(summaryId),
        relevanceNote: theme.evidence?.slice(0, 200) ?? '',
        aiExtracted: 1,
      });
      count++;
    } catch (err) {
      console.error(`主题关联失败 (${theme.name}):`, err);
    }
  }

  try {
    themesService.cleanupOrphanedAiThemes();
    console.log('[主题提取] 孤立 AI 主题静默清理完成');
  } catch (err) {
    console.error('[主题提取] 静默清理孤立 AI 主题失败:', err);
  }

  console.log(`[主题提取] 成功写入 ${count}/${extracted.length} 个主题关联`);
  return count;
};

/**
 * 注册周度总结相关 IPC handlers。
 */
export const registerWeeklyHandlers = (): void => {
  const database = getDatabase();
  const weeklySummaryService = createWeeklySummaryService(
    database as unknown as DatabaseConnection,
  );
  const dailyService = createDailyService(
    database as unknown as import("@/services/dailyService").DatabaseConnection,
  );
  const peopleService = createPeopleService(
    database as unknown as import("@/services/peopleService").DatabaseConnection,
  );

  // 获取某周总结。
  ipcMain.handle("weekly:summary:get", (_, weekStartDate: string) =>
    weeklySummaryService.getByWeekStart(weekStartDate, "summary"),
  );

  // 手动保存总结。
  ipcMain.handle("weekly:summary:save", (_, input: WeeklySummarySaveInput) =>
    weeklySummaryService.save({ ...input, type: "summary" }),
  );

  // 删除总结。
  ipcMain.handle("weekly:summary:delete", (_, weekStartDate: string) =>
    weeklySummaryService.delete(weekStartDate, "summary"),
  );

  // 获取人际策展。
  ipcMain.handle("weekly:curator:get", (_, weekStartDate: string) =>
    weeklySummaryService.getByWeekStart(weekStartDate, "interpersonal"),
  );

  // 手动保存人际策展。
  ipcMain.handle("weekly:curator:save", (_, input: WeeklySummarySaveInput) =>
    weeklySummaryService.save({ ...input, type: "interpersonal" }),
  );

  // 删除人际策展。
  ipcMain.handle("weekly:curator:delete", (_, weekStartDate: string) =>
    weeklySummaryService.delete(weekStartDate, "interpersonal"),
  );

  // AI 流式生成总结（核心）。
  ipcMain.handle(
    "weekly:summary:generate",
    async (event, payload: WeeklySummaryGeneratePayload) => {
      const {
        weekStartDate,
        model: requestedModel,
        provider: requestedProvider,
      } = payload;

      // 并发拉取 7 天数据。
      const dates = getWeekDates(weekStartDate);
      const dayDataList = await Promise.all(
        dates.map((d) => dailyService.listDay(d)),
      );

      // 构造数据摘要（限制 token 消耗，每天各 500 字以内）。
      const weekDataSummary = dates
        .map((date, i) => {
          const day = dayDataList[i];
          const todos = day.todos
            .map((t) => `[${t.completed ? "x" : " "}] ${t.text}`)
            .join("\n");
          const snippets = day.snippets
            .map((s) => `${s.title}: ${s.content.slice(0, 200)}`)
            .join("\n");
          const journal = day.journal
            ? day.journal.content.slice(0, 500)
            : "（无日记）";
          return `## ${date}\n### 待办\n${todos || "无"}\n### 片段\n${snippets || "无"}\n### 日记\n${journal}`;
        })
        .join("\n\n");

      // 加载 provider 配置并创建 provider。
      const config = loadProviderConfig();
      const providerId = requestedProvider ?? config.weeklySummary.provider;
      const modelId = requestedModel ?? config.weeklySummary.model;
      const providerConfig = config.providers[providerId];
      if (!providerConfig) {
        throw new Error(`Provider not found: ${providerId}`);
      }
      const provider = await createModelProvider(providerConfig);

      // 把关检查：判断本周是否有实质内容值得总结。
      const summaryGateResult = await gatekeeperCheck(
        provider,
        modelId,
        `你是周度总结的内容把关助手。请分析以下一周数据，判断是否有值得总结的实质内容（如待办记录、工作进展、个人反思、情绪状态等）。

如果数据中存在任何值得总结的实质内容，仅回复单词：YES

如果一周数据完全为空或没有任何实质内容，仅回复：NO
并在下一行提供默认总结文本，例如：本周暂无值得总结的记录。`,
        `请判断以下一周数据是否有实质内容：\n\n${weekDataSummary}`,
      );

      if (!summaryGateResult.shouldGenerate) {
        const defaultContent = summaryGateResult.defaultContent;
        const saveInput: WeeklySummarySaveInput = {
          weekStartDate,
          type: "summary",
          title: "",
          content: "",
          modelUsed: modelId,
          generatedAt: formatNow(),
          isMeaningful: 0,
        };
        const savedItem = weeklySummaryService.save(saveInput);
        event.sender.send("weekly:summary:delta", { text: defaultContent });
        event.sender.send("weekly:summary:done", savedItem);
        return savedItem;
      }

      // 构造 prompt。
      const systemMessage: AgentMessage = {
        role: "system",
        content: `你是一位专注于个人成长的记忆助理。请根据用户提供的一周数据（包含待办完成情况、关键片段和日记），进行归纳、整合与重构，为用户生成一份客观、深刻且具有启发性的周度总结报告。

输出格式要求：
1. 第一行必须是文章的主标题，字数控制在 15 字以内。格式为：# [本周总结主标题]
2. 正文参考以下 Markdown 标题结构，每个标题下的内容必须以无序列表（- 开头）自由展开。若某个维度本周确实没有有意义的内容，可以删除对应的标题：

## 本周记录与进展
（围绕待办完成情况、核心工作进展、关键片段串联等）

## 状态与情绪反思
（围绕专注与高效时刻、焦虑与拖延时刻等）

## 发现的问题与收获
（围绕思维行为局限、可复用的原则与经验等）

## 习惯改进与行动
（围绕继续保持、需要改掉、下周尝试等）

---
## 核心反思问题
基于本周暴露出的核心问题，提出 1-2 个能促进知行合一、直接而诚恳的深度反思问题。该项可使用段落形式。

写作原则：
- 拒绝任何 Emoji。
- 禁止使用斜体。
- 正文内容必须以无序列表（- 开头）呈现，核心反思问题除外。
- 语言平实、真诚、深刻、直接，杜绝 AI 腔、废话和陈词滥调（例如：少用"本周充满了挑战"等空洞修辞，多用客观细节与深刻反思）。
- 总字数控制在 600 字以内。
- 提到人物、人名、地名和比较重要事项时，使用 \`内容\` markdown格式标记。`,
      };

      const userMessage: AgentMessage = {
        role: "user",
        content: `以下是我本周（${weekStartDate} 起）的记录数据，请生成周度总结：\n\n${weekDataSummary}`,
      };

      // 流式生成，收集完整文本并发送 delta 事件。
      let fullText = "";
      const stream: AsyncIterable<ModelStreamEvent> = provider.streamTurn({
        model: modelId,
        messages: [systemMessage, userMessage],
        tools: [],
      });

      for await (const streamEvent of stream) {
        if (streamEvent.type === "text_delta") {
          fullText += streamEvent.delta;
          event.sender.send("weekly:summary:delta", {
            text: streamEvent.delta,
          });
        }
      }

      // 提取标题（首行 # 后内容）并保存。
      const firstLine = fullText.split("\n")[0] ?? "";
      const title =
        firstLine.replace(/^#+\s*/, "").trim() || `${weekStartDate} 周度总结`;
      const saveInput: WeeklySummarySaveInput = {
        weekStartDate,
        type: "summary",
        title,
        content: fullText,
        modelUsed: modelId,
        generatedAt: formatNow(),
        isMeaningful: 1,
      };
      const savedItem = weeklySummaryService.save(saveInput);

      // 自动提取主题建议（AI 把关）
      if (savedItem.isMeaningful === 1) {
        try {
          const themesService = createThemesService(
            database as unknown as import('@/services/themesService').DatabaseConnection
          );
          const existingThemes = themesService.list('active');
          // 用独立的 AI 调用从已生成总结中提取主题，并优先归入已有主题候选池。
          const extractedThemes = await extractThemesWithAI(
            provider,
            modelId,
            fullText,
            existingThemes
          );
          const extractedCount = saveExtractedThemes(
            themesService,
            extractedThemes,
            savedItem.id
          );
          if (extractedCount > 0) {
            console.log(
              `从周度总结中 AI 提取了 ${extractedCount} 个主题: ${extractedThemes.map((t) => t.name).join(', ')}`
            );
          }
        } catch (err) {
          console.error('自动主题提取失败:', err);
        }
      }

      // 通知前端生成完成。
      event.sender.send('weekly:summary:done', savedItem);

      return savedItem;
    },
  );

  // AI 流式生成人际关系与事件策展（核心）。
  ipcMain.handle(
    "weekly:curator:generate",
    async (event, payload: WeeklySummaryGeneratePayload) => {
      const {
        weekStartDate,
        model: requestedModel,
        provider: requestedProvider,
      } = payload;

      // 并发拉取 7 天数据。
      const dates = getWeekDates(weekStartDate);
      const dayDataList = await Promise.all(
        dates.map((d) => dailyService.listDay(d)),
      );

      // 构造数据摘要（限制 token 消耗，每天各 500 字以内）。
      const weekDataSummary = dates
        .map((date, i) => {
          const day = dayDataList[i];
          const todos = day.todos
            .map((t) => `[${t.completed ? "x" : " "}] ${t.text}`)
            .join("\n");
          const snippets = day.snippets
            .map((s) => `${s.title}: ${s.content.slice(0, 200)}`)
            .join("\n");
          const journal = day.journal
            ? day.journal.content.slice(0, 500)
            : "（无日记）";
          return `## ${date}\n### 待办\n${todos || "无"}\n### 片段\n${snippets || "无"}\n### 日记\n${journal}`;
        })
        .join("\n\n");

      // 拉取系统内所有录入的人物档案列表
      const peopleList = peopleService.list();
      const peopleSummary = peopleList
        .map((p, i) => {
          return `### 关联人物 ${i + 1}: ${p.name}\n- 关系: ${p.relationship}\n- 性别: ${p.gender}\n- 状态: ${p.status}\n- 标签: ${p.tags.join(", ")}\n- 详细档案:\n${p.details}`;
        })
        .join("\n\n");

      // 加载 provider 配置并创建 provider。
      const config = loadProviderConfig();
      const providerId = requestedProvider ?? config.weeklySummary.provider;
      const modelId = requestedModel ?? config.weeklySummary.model;
      const providerConfig = config.providers[providerId];
      if (!providerConfig) {
        throw new Error(`Provider not found: ${providerId}`);
      }
      const provider = await createModelProvider(providerConfig);

      // 把关检查：判断本周是否涉及人际关系内容。
      const curatorGateResult = await gatekeeperCheck(
        provider,
        modelId,
        `你是人际关系策展的内容把关助手。请分析以下一周数据，结合人物档案，判断是否存在与人际互动相关的实质内容（如与他人的沟通、协作、见面、情感互动、人际反思等）。

如果存在与人际互动相关的实质内容，仅回复单词：YES

如果完全没有涉及人际互动的内容，仅回复：NO
并在下一行提供默认文本，例如：本周暂无涉及人际关系的记录。`,
        `人物档案：\n${peopleSummary || "暂无人物档案"}\n\n一周数据：\n${weekDataSummary}`,
      );

      if (!curatorGateResult.shouldGenerate) {
        const defaultContent = curatorGateResult.defaultContent;
        const saveInput: WeeklySummarySaveInput = {
          weekStartDate,
          type: "interpersonal",
          title: "",
          content: "",
          modelUsed: modelId,
          generatedAt: formatNow(),
          isMeaningful: 0,
        };
        const savedItem = weeklySummaryService.save(saveInput);
        event.sender.send("weekly:curator:delta", { text: defaultContent });
        event.sender.send("weekly:curator:done", savedItem);
        return savedItem;
      }

      // 构造 prompt。
      const systemMessage: AgentMessage = {
        role: "system",
        content: `你是一位专注于人际关系与个人成长的温和、诚恳的助手。请根据用户提供的一周数据（包含待办完成情况、关键片段和日记），并结合其系统内已建立的【核心人物档案】，进行深度分析，为用户生成一份充满温情、具有启发性的人际互动分析报告。

输出格式要求：
1. 第一行必须是文章的主标题，字数控制在 15 字以内。格式为：# [人际关系总结标题]
2. 正文参考以下 Markdown 标题结构，每个标题下的内容必须以无序列表（- 开头）自由展开。若某个维度本周确实没有有意义的内容，可以删除对应的标题：

## 本周人际互动
（围绕本周出现或互动的人物、整体人际交往状态等）

## 互动感受与反思
（围绕拉近距离的时刻、沟通卡点或隔阂等）

## 人物细节洞察
（结合人物档案，对本周互动细节进行深度交叉分析）

## 关系改进与行动
（围绕继续保持、需要避免、建议尝试等）

写作原则：
- 拒绝任何 Emoji。
- 禁止使用斜体。
- 正文内容必须以无序列表（- 开头）呈现。
- 语言平实、真诚、深刻、直接，温暖且有力量，杜绝 AI 腔、废话和陈词滥调。
- 总字数控制在 600 字以内。
- 提到人物、人名、地名和比较重要事项时，使用 \`内容\` markdown格式标记。`,
      };

      const userMessage: AgentMessage = {
        role: "user",
        content: `以下是我系统里存储的【核心人物档案】：\n\n${peopleSummary || "（暂无核心人物档案记录）"}\n\n以下是我本周（${weekStartDate} 起）的记录数据：\n\n${weekDataSummary}\n\n请帮我生成人际关系与事件策展：`,
      };

      // 流式生成，收集完整文本并发送 delta 事件。
      let fullText = "";
      const stream: AsyncIterable<ModelStreamEvent> = provider.streamTurn({
        model: modelId,
        messages: [systemMessage, userMessage],
        tools: [],
      });

      for await (const streamEvent of stream) {
        if (streamEvent.type === "text_delta") {
          fullText += streamEvent.delta;
          event.sender.send("weekly:curator:delta", {
            text: streamEvent.delta,
          });
        }
      }

      // 提取标题（首行 # 后内容）并保存。
      const firstLine = fullText.split("\n")[0] ?? "";
      const title =
        firstLine.replace(/^#+\s*/, "").trim() || `${weekStartDate} 人际策展`;
      const saveInput: WeeklySummarySaveInput = {
        weekStartDate,
        type: "interpersonal",
        title,
        content: fullText,
        modelUsed: modelId,
        generatedAt: formatNow(),
        isMeaningful: 1,
      };
      const savedItem = weeklySummaryService.save(saveInput);

      // 自动提取主题建议（AI 把关）
      if (savedItem.isMeaningful === 1) {
        try {
          const themesService = createThemesService(
            database as unknown as import('@/services/themesService').DatabaseConnection
          );
          const existingThemes = themesService.list('active');
          // 用独立的 AI 调用从已生成总结中提取主题，并优先归入已有主题候选池。
          const extractedThemes = await extractThemesWithAI(
            provider,
            modelId,
            fullText,
            existingThemes
          );
          const extractedCount = saveExtractedThemes(
            themesService,
            extractedThemes,
            savedItem.id
          );
          if (extractedCount > 0) {
            console.log(
              `从人际策展中 AI 提取了 ${extractedCount} 个主题: ${extractedThemes.map((t) => t.name).join(', ')}`
            );
          }
        } catch (err) {
          console.error('自动主题提取失败:', err);
        }
      }

      // 通知前端生成完成。
      event.sender.send('weekly:curator:done', savedItem);

      return savedItem;
    },
  );
};
