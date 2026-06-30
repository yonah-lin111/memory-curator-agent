import { describe, expect, it, vi } from "vitest";
import type {
  AssociatedPersonCreateInput,
  AssociatedPersonItem,
  AssociatedPersonUpdateInput,
} from '@/db/schema';
import {
  createPeopleAddTool,
  createPeopleDeleteTool,
  createPeopleQueryTool,
  createPeopleTools,
  createPeopleUpdateTool,
} from '@/agent/tools/people';
import type { PeopleService } from '@/services/peopleService';

const people: AssociatedPersonItem[] = [
  {
    id: "person-1",
    avatar: "",
    name: "阿明",
    gender: "男",
    relationship: "朋友",
    status: "技术狂热者",
    birthday: "09月11日",
    contact: "GitHub: aming-coder",
    tags: ["极客", "开朗"],
    details: "# 阿明\n喜欢 TypeScript 和本地优先工具。",
    createdAt: "2026-05-01 10:00",
    updatedAt: "2026-05-02 10:00",
  },
  {
    id: "person-2",
    avatar: "",
    name: "小周",
    gender: "女",
    relationship: "同事",
    status: "项目协作",
    birthday: "",
    contact: "微信",
    tags: ["产品"],
    details: "# 小周",
    createdAt: "2026-05-01 09:00",
    updatedAt: "2026-05-02 09:00",
  },
  {
    id: "person-3",
    avatar: "",
    name: "小林",
    gender: "男",
    relationship: "朋友",
    status: "TypeScript 同好",
    birthday: "",
    contact: "",
    tags: [],
    details: "# 小林\n不是本地优先工具的主要协作者。",
    createdAt: "2026-05-01 08:00",
    updatedAt: "2026-05-02 08:00",
  },
];

const toSqlRow = (
  person: AssociatedPersonItem,
  includeDetails = true,
): Record<string, unknown> => ({
  id: person.id,
  avatar: person.avatar,
  name: person.name,
  gender: person.gender,
  relationship: person.relationship,
  status: person.status,
  birthday: person.birthday,
  contact: person.contact,
  tags: JSON.stringify(person.tags),
  ...(includeDetails ? { details: person.details } : {}),
  created_at: person.createdAt,
  updated_at: person.updatedAt,
});

const matchesBaseQuery = (
  person: AssociatedPersonItem,
  query: string,
): boolean =>
  [
    person.name,
    person.gender,
    person.relationship,
    person.status,
    person.birthday,
    person.contact,
    ...person.tags,
  ]
    .join("\n")
    .includes(query);

const peopleService: Pick<PeopleService, "querySql"> = {
  querySql: (sql) => {
    if (sql.includes("COUNT(*)")) {
      return [{ count: people.length }];
    }

    if (sql.includes("relationship = '同事'")) {
      return people
        .filter((person) => person.relationship === "同事")
        .map((person) => toSqlRow(person));
    }

    if (sql.includes("本地优先")) {
      if (!sql.includes("details LIKE")) {
        return [];
      }

      return people
        .filter((person) => person.details.includes("本地优先工具"))
        .filter((person) =>
          sql.includes("极客") ? person.tags.includes("极客") : true,
        )
        .map((person) => toSqlRow(person));
    }

    if (sql.includes("TypeScript")) {
      return people
        .filter((person) => matchesBaseQuery(person, "TypeScript"))
        .map((person) => toSqlRow(person, false));
    }

    return people.map((person) =>
      toSqlRow(
        person,
        !sql.startsWith(
          "SELECT id, avatar, name, gender, relationship, status, birthday, contact, tags, created_at, updated_at",
        ),
      ),
    );
  },
};

const peopleWriteService: Pick<
  PeopleService,
  "querySql" | "create" | "update" | "delete"
> = {
  ...peopleService,
  create: vi.fn((input: AssociatedPersonCreateInput) => ({
    id: "person-new",
    createdAt: "2026-06-03 10:00",
    updatedAt: "2026-06-03 10:00",
    ...input,
  })),
  update: vi.fn((id: string, input: AssociatedPersonUpdateInput) => ({
    id,
    createdAt: "2026-05-01 10:00",
    updatedAt: "2026-06-03 10:00",
    ...input,
  })),
  delete: vi.fn(),
};

describe("peopleTool", () => {
  it("使用 people_tool_query 作为查询工具名", () => {
    const tool = createPeopleQueryTool(peopleService);

    expect(tool.name).toBe("people_tool_query");
  });

  it("按 query 查询 people 表并返回观察文本", async () => {
    const tool = createPeopleQueryTool(peopleService);

    const result = await tool.execute({
      query: "TypeScript",
    });

    expect(result.items.map((item) => item.name)).toEqual(["小林"]);
    expect(result.items[0].details).toBe("");
    expect(result.observation).toBe("SQL query returned 1 row.");
    expect(result.observation).not.toContain("小林");
  });

  it("query 基础字段无命中时才兜底查询 details", async () => {
    const tool = createPeopleQueryTool(peopleService);

    const result = await tool.execute({
      query: "本地优先工具",
    });

    expect(result.items.map((item) => item.name)).toEqual(["阿明", "小林"]);
    expect(result.items[0].details).toContain("本地优先工具");
    expect(result.observation).toBe("SQL query returned 2 rows.");
    expect(result.observation).not.toContain("阿明");
  });

  it("返回完整详情，不截断查询内容", async () => {
    const tool = createPeopleQueryTool({
      ...peopleService,
      querySql: (sql) =>
        sql.includes("details LIKE")
          ? [
              toSqlRow({
                ...people[0],
                details: `# 阿明\n${"很长的详情内容。".repeat(20)}`,
              }),
            ]
          : [],
    });

    const result = await tool.execute({
      query: "很长的详情内容",
    });

    expect(result.items[0].details).toContain("很长的详情内容。".repeat(20));
    expect(result.items[0].details).not.toContain("...");
  });

  it("支持关系过滤和 limit 限制", async () => {
    const tool = createPeopleQueryTool(peopleService);

    const result = await tool.execute({
      relationship: "同事",
      limit: 1,
    });

    expect(result.items.map((item) => item.name)).toEqual(["小周"]);
  });

  it("支持结构化条件查询", async () => {
    const tool = createPeopleQueryTool(peopleService);

    const result = await tool.execute({
      conditions: {
        relationship: "朋友",
        tag: "极客",
        details: "本地优先",
      },
    });

    expect(result.items.map((item) => item.name)).toEqual(["阿明"]);
  });

  it("支持受控 SQL 条件查询", async () => {
    const tool = createPeopleQueryTool(peopleService);

    const result = await tool.execute({
      sql: "SELECT * FROM associated_people WHERE relationship = '同事' ORDER BY updated_at DESC",
      limit: 5,
    });

    expect(result.items.map((item) => item.name)).toEqual(["小周"]);
    expect(result.data).toMatchObject({
      rows: [
        expect.objectContaining({
          name: "小周",
        }),
      ],
    });
  });

  it("支持受控 SQL 数量统计", async () => {
    const tool = createPeopleQueryTool(peopleService);

    const result = await tool.execute({
      sql: "SELECT COUNT(*) AS count FROM associated_people",
      limit: 1,
    });

    expect(result.items).toEqual([]);
    expect(result.data).toEqual({
      rows: [{ count: 3 }],
      items: [],
    });
    expect(result.observation).toBe("SQL query returned 1 row.");
  });

  it("拒绝危险 SQL", async () => {
    const tool = createPeopleQueryTool(peopleService);

    await expect(
      tool.execute({
        sql: "DROP TABLE associated_people",
      }),
    ).rejects.toThrow("People SQL only allows SELECT queries");
  });

  it("添加人物并返回创建后的资料", async () => {
    const tool = createPeopleAddTool(peopleWriteService);

    const result = await tool.execute({
      avatar: "",
      name: "小陈",
      gender: "女",
      relationship: "朋友",
      status: "新朋友",
      birthday: "",
      contact: "微信",
      tags: ["设计"],
      details: "# 小陈",
    });

    expect(tool.name).toBe("people_tool_add");
    expect(peopleWriteService.create).toHaveBeenCalledWith({
      avatar: "",
      name: "小陈",
      gender: "女",
      relationship: "朋友",
      status: "新朋友",
      birthday: "",
      contact: "微信",
      tags: ["设计"],
      details: "# 小陈",
    });
    expect(result.observation).toBe("Created people profile: 小陈.");
    expect(result.data).toMatchObject({
      item: {
        id: "person-new",
        name: "小陈",
      },
    });
  });

  it("添加人物提示词仅用 common_tool_ask 补充缺失信息并要求 details 使用 Markdown", () => {
    const tool = createPeopleAddTool(peopleWriteService);

    expect(tool.prompt?.whenToUse.join("\n")).toContain("common_tool_ask");
    expect(tool.prompt?.whenToUse.join("\n")).toContain("missing required facts");
    expect(tool.prompt?.safety?.join("\n")).toContain("internal confirmation");
    expect(tool.prompt?.safety?.join("\n")).toContain("confirmationSummary");
    expect(tool.prompt?.safety?.join("\n")).toContain("do not use profile ids");
    expect(tool.prompt?.safety?.join("\n")).toContain("key known profile facts");
    expect(tool.prompt?.safety?.join("\n")).toContain("do not write only a generic create sentence");
    expect(tool.prompt?.safety?.join("\n")).toContain("Markdown");
    expect(tool.parameters.properties?.confirmationSummary.description).toContain(
      "key add/update/delete facts",
    );
    expect(tool.parameters.properties?.details.description).toContain(
      "Markdown",
    );
  });

  it("优先使用 AI 输出的 People 写入确认说明", () => {
    const tool = createPeopleUpdateTool(peopleWriteService);

    expect(
      tool.confirmation?.renderSummary({
        confirmationSummary: "将更新阿明的人物档案：状态改为技术负责人。",
        id: "person-1",
        name: "阿明",
        status: "技术负责人",
      }),
    ).toBe("将更新阿明的人物档案：状态改为技术负责人。");
  });

  it("People 写入完成提示来自 confirmation.completion 配置", () => {
    const addTool = createPeopleAddTool(peopleWriteService);
    const updateTool = createPeopleUpdateTool(peopleWriteService);
    const deleteTool = createPeopleDeleteTool(peopleWriteService);

    expect(
      addTool.confirmation?.completion?.renderMessage(
        { name: "小陈" },
        {
          observation: "Created people profile: 小陈.",
          data: {
            item: {
              id: "person-new",
              name: "小陈",
            },
          },
        },
      ),
    ).toBe("已添加人物资料：小陈。");
    expect(
      updateTool.confirmation?.completion?.renderMessage(
        { id: "person-1", name: "阿明" },
        {
          observation: "Updated people profile: 阿明.",
          data: {
            item: {
              id: "person-1",
              name: "阿明",
            },
          },
        },
      ),
    ).toBe("已更新人物资料：阿明。");
    expect(
      deleteTool.confirmation?.completion?.renderMessage(
        { id: "person-1" },
        {
          observation: "Deleted people profile: person-1.",
          data: {
            id: "person-1",
          },
        },
      ),
    ).toBe("已删除人物资料。");
  });

  it("修改人物并返回更新后的资料", async () => {
    const tool = createPeopleUpdateTool(peopleWriteService);

    const result = await tool.execute({
      id: "person-1",
      avatar: "",
      name: "阿明",
      gender: "男",
      relationship: "朋友",
      status: "技术负责人",
      birthday: "09月11日",
      contact: "GitHub: aming-coder",
      tags: ["极客"],
      details: "# 阿明\n更新后的详情。",
    });

    expect(tool.name).toBe("people_tool_update");
    expect(peopleWriteService.update).toHaveBeenCalledWith("person-1", {
      avatar: "",
      name: "阿明",
      gender: "男",
      relationship: "朋友",
      status: "技术负责人",
      birthday: "09月11日",
      contact: "GitHub: aming-coder",
      tags: ["极客"],
      details: "# 阿明\n更新后的详情。",
    });
    expect(result.observation).toBe("Updated people profile: 阿明.");
    expect(result.data).toMatchObject({
      item: {
        id: "person-1",
        status: "技术负责人",
      },
    });
  });

  it("修改人物提示词要求用户明确指定更新", () => {
    const tool = createPeopleUpdateTool(peopleWriteService);

    expect(tool.prompt?.whenToUse.join("\n")).toContain("explicitly asks");
    expect(tool.prompt?.whenNotToUse?.join("\n")).toContain(
      "has not explicitly asked to update saved data",
    );
  });

  it("删除人物并返回删除 ID", async () => {
    const tool = createPeopleDeleteTool(peopleWriteService);

    const result = await tool.execute({
      id: "person-1",
    });

    expect(tool.name).toBe("people_tool_delete");
    expect(peopleWriteService.delete).toHaveBeenCalledWith("person-1");
    expect(result.observation).toBe("Deleted people profile: person-1.");
    expect(result.data).toEqual({
      id: "person-1",
    });
  });

  it("集中创建四个 People 工具", () => {
    expect(createPeopleTools(peopleWriteService).map((tool) => tool.name)).toEqual([
      "people_tool_query",
      "people_tool_add",
      "people_tool_update",
      "people_tool_delete",
      "people_tool_batch_add",
      "people_tool_batch_update",
      "people_tool_batch_delete",
    ]);
  });
});
