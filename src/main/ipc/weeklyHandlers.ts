import { ipcMain } from "electron";
import { getDatabase } from "@/db";
import {
  createWeeklySummaryService,
  type DatabaseConnection,
} from "@/services/weeklySummaryService";
import { createDailyService } from "@/services/dailyService";
import { createPeopleService } from "@/services/peopleService";
import { loadProviderConfig } from "@/agent/providers/providerConfig";
import { createModelProvider } from "@/agent/providers/providerFactory";
import type { WeeklySummarySaveInput } from "@/db/schema";
import type { AgentMessage, ModelStreamEvent } from "@/agent/types";

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

      // 构造 prompt。
      const systemMessage: AgentMessage = {
        role: "system",
        content: `你是一位专注于个人成长的记忆助理。请根据用户提供的一周数据（包含待办完成情况、关键片段和日记），进行归纳、整合与重构，为用户生成一份客观、深刻且具有启发性的周度总结报告。

输出格式要求：
1. 第一行必须是文章的主标题，字数控制在 15 字以内。格式为：# [本周总结主标题]
2. 正文必须严格遵守以下固定的 Markdown 标题与结构，禁止包含任何 Emoji 图标：

## 本周记录与进展
- **待办达成分析**：[结合本周待办列表数据，总结完成率并提炼核心工作进展]
- **重要片段梳理**：[梳理并串联本周沉淀的关键片段与重点事件]

## 状态与情绪反思
- **专注与高效时刻**：[分析本周何时感到最专注、高效或有成就感，并提炼其原因]
- **焦虑与拖延时刻**：[分析本周何时感到阻碍、焦虑或习惯性拖延，剖析核心原因]

## 发现的问题与收获
- **思维误区分析**：[分析本周暴露了哪些思维或行为局限（如完美主义、决策疲劳、信息过载、行动滞后等）]
- **原则与经验总结**：[从本周经历中沉淀出的、未来可复用的底层行动原则与方法]

## 习惯改进与行动
- **继续保持**：[明确本周哪些行之有效的优秀实践在下周需要继续保持，并逐步形成习惯]
- **需要改掉**：[识别出本周哪些动作、习惯产生了不必要的内耗，下周必须予以停止或修正]
- **下周尝试**：[制定一个下周可立即执行的、有助改善现状的具体微步行动方案]

---
## 核心反思问题
*基于本周暴露出的核心问题，提出 1-2 个能促进知行合一、直接而诚恳的深度反思问题。*

写作原则：
- 拒绝任何 Emoji。
- 禁止使用斜体
- 语言平实、真诚、深刻、直接，杜绝 AI 腔、废话和陈词滥调（例如：少用“本周充满了挑战”等空洞修辞，多用客观细节与深刻反思）。
- 总字数控制在 600 字以内。
- 必须严格保留规定的大标题结构，确保排版的专业美观与一致性。`,
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
      };
      const savedItem = weeklySummaryService.save(saveInput);

      // 通知前端生成完成。
      event.sender.send("weekly:summary:done", savedItem);

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

      // 构造 prompt。
      const systemMessage: AgentMessage = {
        role: "system",
        content: `你是一位专注于人际关系与个人成长的温和、诚恳的助手。请根据用户提供的一周数据（包含待办完成情况、关键片段和日记），并结合其系统内已建立的【核心人物档案】，进行深度分析，为用户生成一份充满温情、具有启发性的人际互动分析报告。

输出格式要求：
1. 第一行必须是文章的主标题，字数控制在 15 字以内。格式为：# [人际关系总结标题]
2. 正文必须严格遵守以下固定的 Markdown 标题与结构，禁止包含任何 Emoji 图标：

## 本周人际互动
- **[人物名称] (关系分类)**：[客观分析本周此人在用户日志中出现的细节。他们共同经历了什么？用户的字里行间流露了怎样的态度？若本周有多个核心人物出现，请依次拆分出多个子段落。若无特定人物出现，客观分析本周用户在整体人际交往上的状态，是充实、疏离还是陷入社交内耗。]

## 互动感受与反思
- **拉近距离的时刻**：[本周哪些人际互动、工作协作或日常关怀让用户感受到了连结、支持或愉悦？这触动了用户怎样的情感需求？]
- **沟通卡点或隔阂**：[本周在人际交往、亲密关系或协作中，暴露了用户怎样的交往阻碍或心理顾虑（如：过度讨好、社交疲劳、防备心、沟通失误、忽略亲密关系、承诺未兑现等）？]

## 人物细节洞察
- **[人物名称] 深度洞察**：[结合人物的【详细背景档案、偏好、备忘录、特征标签】，将当周日志里的客观细节与该人物的画像进行深度交叉碰撞。例如：根据档案，某人极易换季敏感，本周日志提及她稍微咳嗽，这说明什么？或者某人爱吃某种食物，本周提及了某餐饮，是否是一次机会？给出极其细节、有洞察力的对照关联分析。]

## 关系改进与行动
- **继续保持**：[明确本周哪些行之有效的沟通、倾听方式或反馈机制在下周需要继续保持，并巩固关系]
- **需要避免**：[识别本周有哪些误解、忽略、冷淡、过度承诺未兑现等不当交往行为，下周必须予以停止或修正]
- **建议尝试**：[根据人物档案与本周的实际互动状况，制定一个下周可立即执行的、最容易让对方感受到暖意、或促成良好合作的最小具体行动]

写作原则：
- 拒绝任何 Emoji。
- 禁止使用斜体
- 语言平实、真诚、深刻、直接，温暖且有力量，杜绝 AI 腔、废话和陈词滥调。
- 总字数控制在 600 字以内。
- 必须严格保留规定的大标题结构，确保排版的专业美观与一致性。`,
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
      };
      const savedItem = weeklySummaryService.save(saveInput);

      // 通知前端生成完成。
      event.sender.send("weekly:curator:done", savedItem);

      return savedItem;
    },
  );
};
