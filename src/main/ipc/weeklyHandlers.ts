import { ipcMain } from "electron";
import { getDatabase } from "@/db";
import {
  createWeeklySummaryService,
  type DatabaseConnection,
} from "@/services/weeklySummaryService";
import { createThemesService } from "@/services/themesService";
import { createDailyService } from "@/services/dailyService";
import { createPeopleService } from "@/services/peopleService";
import { createBillsService } from "@/services/billsService";
import { loadProviderConfig } from "@/agent/providers/providerConfig";
import { createModelProvider } from "@/agent/providers/providerFactory";
import { updateThemeDescription } from "@/ipc/themeDescriptionUpdater";
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
  return new Date().toISOString();
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

/** AI 主题提取落库结果 */
type SaveExtractedThemesResult = {
  count: number;
  themeExternalIds: string[];
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
  const existingThemesText =
    existingThemes.length > 0
      ? existingThemes.map((theme) => `- ${theme.name}`).join("\n")
      : "（目前无已有主题）";
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
     - "evidence": 阐述总结中与此主题关联的具体事件或进展（100字以内）。
       【极其重要规则】：
       - 必须以「我」作为第一人称动作主体来阐述（例如不要只写成“完成了 Rust 基础学习”，而应明确写成“本周我完成了 Rust...”）。
       - 禁止使用「他、她、它、这些、哪些、他们、她们、它们、此、该」等代词（如不可用“完成了他的工作”或“记录了这些事情”）。
       - 必须具体且完整地描述涉及的人物（如使用具体的姓名、称呼或明确的社会/家庭关系，例如「伴侣」「同事小李」「主管」等）以及具体的事件内容，确保该段关联说明即便脱离周度总结上下文，依然具有完全自洽的主体、人物和语义清晰度。

  正确输出示例：
  [{"name":"技能提升","confidence":85,"evidence":"本周我完成了 Rust 编程语言中关于所有权、生命周期与 Trait 相关的三章基础内容学习。"},{"name":"健康管理","confidence":70,"evidence":"本周我作息管理上取得进展，连续四天在晚上 23:30 前按时入睡。"}]`;

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
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    // 从响应中精准提取 JSON 数组（模型可能在前后添加文字说明）
    const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!arrayMatch) {
      return [];
    }

    const parsed = JSON.parse(arrayMatch[0]);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is ThemeExtractionItem =>
          typeof item.name === "string" && item.name.trim().length > 0,
      );
    }
    return [];
  } catch {
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
): SaveExtractedThemesResult => {
  try {
    const database = getDatabase();
    database
      .prepare(
        "DELETE FROM theme_items WHERE source_type = ? AND source_id = ? AND ai_extracted = 1",
      )
      .run("weekly_summary", String(summaryId));
  } catch {
    // 清理旧关联失败不影响后续流程
  }

  if (!extracted.length) {
    themesService.cleanupOrphanedAiThemes();
    return { count: 0, themeExternalIds: [] };
  }

  let count = 0;
  const themeExternalIds = new Set<string>();

  for (const theme of extracted) {
    if (!theme.name?.trim()) continue;

    // 模糊匹配已有主题（双向包含匹配）
    const allThemes = themesService.list();
    const matched = allThemes.find(
      (t) =>
        t.name.includes(theme.name.trim()) ||
        theme.name.trim().includes(t.name),
    );

    let themeExternalId: string;
    if (matched) {
      themeExternalId = matched.externalId;
      // 更新已有主题时间 + 追加新 evidence 到描述
      themesService.update(themeExternalId, {
        description: matched.description
          ? `${matched.description}; ${theme.evidence?.slice(0, 100) ?? ""}`
          : (theme.evidence?.slice(0, 200) ?? ""),
      });
    } else {
      const created = themesService.create({
        name: theme.name.trim(),
        description: theme.evidence?.slice(0, 200) ?? "",
        aiGenerated: 1,
      });
      themeExternalId = created.externalId;
    }

    // 关联到本周总结（ON CONFLICT 自动跳过重复）
    try {
      themesService.addItem({
        themeExternalId,
        sourceType: "weekly_summary",
        sourceId: String(summaryId),
        relevanceNote: theme.evidence?.slice(0, 200) ?? "",
        aiExtracted: 1,
      });
      themeExternalIds.add(themeExternalId);
      count++;
    } catch {
      // 主题关联失败，跳过
    }
  }

  try {
    themesService.cleanupOrphanedAiThemes();
  } catch {
    // 清理孤立主题失败不影响主流程
  }

  return { count, themeExternalIds: Array.from(themeExternalIds) };
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
  const billsService = createBillsService(
    database as unknown as import("@/services/billsService").DatabaseConnection,
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

  // AI 流式生成统一周度报告（个人成长 + 人际关系）。
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
        dates.map(async (d) => {
          const dayData = await dailyService.listDay(d);
          const billsData = billsService.list({ billDate: d });
          return { ...dayData, bills: billsData };
        }),
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
          const bills = day.bills
            .map((b) => `[${b.billType === "expense" ? "支出" : "收入"}] ¥${(b.amount / 100).toFixed(2)} ${b.category} ${b.note ? `- ${b.note}` : ""}`)
            .join("\n");
          const journal = day.journal
            ? day.journal.content.slice(0, 500)
            : "（无日记）";
          return `## ${date}\n### 待办\n${todos || "无"}\n### 片段\n${snippets || "无"}\n### 账单\n${bills || "无"}\n### 日记\n${journal}`;
        })
        .join("\n\n");

      // 拉取系统内所有录入的人物档案列表（供统一报告的人际维度使用）。
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

      // 把关检查：判断本周是否有实质内容值得总结。
      const summaryGateResult = await gatekeeperCheck(
        provider,
        modelId,
        `你是周度总结的内容把关助手。请分析以下一周数据，判断是否有值得总结的实质内容（如待办记录、工作进展、个人反思、情绪状态、账单消费等）。

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
        event.sender.send("weekly:summary:delta", {
          weekStartDate,
          text: defaultContent,
        });
        event.sender.send("weekly:summary:done", savedItem);
        return savedItem;
      }

      //       构造 prompt。
      const systemMessage: AgentMessage = {
        role: "system",
        content: `你是一位专注于个人成长的记忆助理。请根据用户提供的一周数据（包含待办完成情况、关键片段和日记），并结合其系统内已建立的【核心人物档案】，进行归纳、整合与重构，为用户生成一份客观、深刻且具有启发性的统一周度报告，同时覆盖个人成长与人际关系两个维度。

报告必须是一份可直接预览的完整 Markdown 文档，包含如下结构（若某部分本周无实质内容则可跳过对应章节，保持精炼）：

# [本周总结主标题：15字以内]

> 一句凝练本周核心基调的观察或洞察（blockquote 格式）。

## 本周统计快照

| 维度 | 指标 | 备注 |
| --- | --- | --- |
| 待办完成 | N/M (xx%) | 较上周趋势 |
| 日记记录 | N 天 | 连续/间隔 |
| 关键片段 | N 条 | 主要领域 |

\`\`\`mermaid
pie
    title 本周活动分布
    "类别1" : <数值>
    "类别2" : <数值>
    "类别3" : <数值>
\`\`\`

（用 pie 图展示时间或精力在各类事务中的分布比例）

## 本周记录与进展
- 围绕待办完成情况、核心工作进展、关键片段串联等，用无序列表展开。

## 本周账单速览

| 日期 | 分类 | 收支明细 | 金额 |
| --- | --- | --- | --- |
| ... | ... | ... | ... |

（用表格展示本周重要的账单记录，并在表格后简短总结本周消费情况）

## 状态与情绪反思
- 围绕专注与高效时刻、焦虑与拖延时刻等，用无序列表展开。

## 发现的问题与收获
- 围绕思维行为局限、可复用的原则与经验等，用无序列表展开。

## 习惯改进与行动

| [保持] | [改进] | [尝试] |
| --- | --- | --- |
| ... | ... | ... |

（用三栏表格对比习惯改进方向：继续保持的好习惯、需要改掉的坏习惯、下周新尝试）

## 人际互动
- 围绕本周出现或互动的人物、整体人际交往状态、拉近距离或存在隔阂的时刻等。
- 【重要】如果【核心人物档案】中的某个人物此前的状态（status）或详细档案（details）暗示存在未解决的矛盾、关系紧张或负面冲突（如「冷战」「吵架中」「矛盾未解」等），则本周报告中必须完全排除该人物的所有提及，不得出现在人际互动章节的任何位置。

\`\`\`mermaid
mindmap
  root((本周人物))
    <人物1>
      <互动要点>
    <人物2>
      <互动要点>
\`\`\`

（用 mindmap 图展示本周人际网络。根节点用 \`root((...))\`，子节点为人物名及互动关键词。同样遵守上述排除了矛盾人物的规则）

---

## 核心反思问题
基于本周暴露出的核心问题，提出 1-2 个能促进知行合一、直接而诚恳的深度反思问题。该项可使用段落形式。

写作原则：
- 全文禁止使用 Emoji 和斜体。
- 正文内容以无序列表（\`-\` 开头）呈现，核心反思问题、表格和 Mermaid 图表除外。
- 语言平实、真诚、深刻、直接，杜绝 AI 腔、废话和陈词滥调。多用客观细节与深刻反思，少用空泛概括。
- 总字数控制在 1000 字以内（Mermaid 图表不计入）。
- 【重要】提到人物、人名、地名和重要事项时，使用 \`内容\` 标记。
- 人际关系相关内容务必与【核心人物档案】交叉印证，对人物称呼保持档案中的正式名称。
- 如果【核心人物档案】中某人物状态或详情暗示存在未解决矛盾/关系紧张，则本周报告中不得包含该人物的任何内容。
- Mermaid 图表必须用 \`\`\`mermaid 代码块包裹，语法必须正确，节点文字避免特殊字符和换行。`,
      };

      const userMessage: AgentMessage = {
        role: "user",
        content: `以下是我系统里存储的【核心人物档案】：\n\n${peopleSummary || "（暂无核心人物档案记录）"}\n\n以下是我本周（${weekStartDate} 起）的记录数据，请生成统一周度报告：\n\n${weekDataSummary}`,
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
            weekStartDate,
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
            database as unknown as import("@/services/themesService").DatabaseConnection,
          );
          const existingThemes = themesService.list("active");
          // 用独立的 AI 调用从已生成总结中提取主题，并优先归入已有主题候选池。
          const extractedThemes = await extractThemesWithAI(
            provider,
            modelId,
            fullText,
            existingThemes,
          );
          const extractedResult = saveExtractedThemes(
            themesService,
            extractedThemes,
            savedItem.id,
          );
          if (extractedResult.count > 0) {
            for (const themeExternalId of extractedResult.themeExternalIds) {
              void updateThemeDescription(themesService, themeExternalId);
            }
          }
        } catch {
          // 自动主题提取失败不影响主流程
        }
      }

      // 通知前端生成完成。
      event.sender.send("weekly:summary:done", savedItem);

      return savedItem;
    },
  );
};
