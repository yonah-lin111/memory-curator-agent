import { ipcMain } from "electron";
import { getDatabase } from "@/db";
import {
  createWeeklySummaryService,
  type DatabaseConnection,
} from "@/services/weeklySummaryService";
import { createDailyService } from "@/services/dailyService";
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

  // 获取某周总结。
  ipcMain.handle("weekly:summary:get", (_, weekStartDate: string) =>
    weeklySummaryService.getByWeekStart(weekStartDate),
  );

  // 手动保存总结。
  ipcMain.handle("weekly:summary:save", (_, input: WeeklySummarySaveInput) =>
    weeklySummaryService.save(input),
  );

  // 删除总结。
  ipcMain.handle("weekly:summary:delete", (_, weekStartDate: string) =>
    weeklySummaryService.delete(weekStartDate),
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
      const providerId = requestedProvider ?? config.defaultProvider;
      const modelId = requestedModel ?? config.defaultModel;
      const providerConfig = config.providers[providerId];
      if (!providerConfig) {
        throw new Error(`Provider not found: ${providerId}`);
      }
      const provider = await createModelProvider(providerConfig);

      // 构造 prompt。
      const systemMessage: AgentMessage = {
        role: "system",
        content: `你是一位专注于个人成长的顶级记忆策展助理。请根据用户提供的一周数据（包含待办完成情况、关键片段和日记），运用高级记忆梳理与反思模型【ORID（焦点讨论法）+ KPT（持续改进模型）】进行深度整合与重构，为用户生成一份学术且专业的周度总结报告。

输出格式要求：
1. 第一行必须是文章的主标题，字数控制在 15 字以内。格式为：# [具有深刻洞察力的本周总结标题]
2. 正文必须严格遵守以下固定的 Markdown 标题与结构，禁止包含任何 Emoji 图标：

## 1. 客观纪实与成果映射 (Objective)
- **待办达成度分析**：[结合本周待办列表数据，客观计算完成率并剖析核心攻坚成果]
- **黄金记忆片段**：[整理并串联本周沉淀的关键片段与重点事件，提炼高光记忆]

## 2. 情绪图谱与心智觉察 (Reflective)
- **能量巅峰 (Flow)**：[分析本周何时感到最专注、高效或极具成就感，提炼出其核心触发因子]
- **能量阻抗 (Resistance)**：[分析本周何时感到阻碍、焦虑或习惯性拖延，剖析深层的心智卡点]

## 3. 意义解析与认知升级 (Interpretive)
- **认知偏差剖析**：[本周暴露了哪些思维局限（如完美主义陷阱、决策疲劳、信息过载、行动滞后等）]
- **跨领域通用原则**：[从本周经历中沉淀出的、未来可在其他领域/场景中复用的底层行动原则与方法论]

## 4. 持续进化与高杠杆行动 (Decisional / KPT)
- **Keep (习惯固化)**：[明确本周哪些行之有效的优秀实践或思维模式需要继续保持，并形成长期固化的行为习惯]
- **Problem (负熵优化)**：[识别出本周哪些动作、习惯或环境产生了不必要的内耗，下周必须予以停止或修正]
- **Try (高杠杆尝试)**：[制定一个下周可立即执行的、能够撬动大改变的最小微步干预方案]

---
## 5. 策展助理深度发问 (Curator's Quest)
*基于本周暴露出的最核心系统性漏洞或心智卡点，提出 1-2 个直击本质、促成知行合一的深度反思问题。*

写作原则：
- 拒绝任何 Emoji。
- 语言高度专业、真诚、深刻、直接，杜绝AI腔、废话和陈词滥调（例如：少用“本周充满了挑战”等空洞修辞，多用客观细节与深刻反思）。
- 总字数控制在 800 字以内。
- 必须严格保留 1 到 5 的主标题结构（即：## 1. 客观纪实与成果映射 (Objective)），确保排版的专业美观与一致性。`,
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
};
