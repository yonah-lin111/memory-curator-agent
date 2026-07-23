import { beforeEach, describe, expect, it } from "vitest"
import type { AssociatedPersonRow } from "@/db/schema"
import {
  createPeopleService,
  type DatabaseConnection,
  type DatabaseStatement,
} from "@/services/peopleService"

// 测试数据库连接。
let sqlite: MemoryPeopleDatabase

// 内存 People 数据库，用于避免 Node/Vitest 加载 Electron ABI 的原生 SQLite 模块。
class MemoryPeopleDatabase implements DatabaseConnection {
  // 内存人物行。
  private rows: AssociatedPersonRow[] = []

  /**
   * 准备内存 SQL 语句。
   */
  prepare = (sql: string): DatabaseStatement => {
    if (
      sql.startsWith(
        "SELECT external_id AS id, avatar, name, gender, relationship, status, birthday, contact, tags, details, created_at, updated_at FROM associated_people ORDER BY",
      )
    ) {
      return {
        all: () =>
          [...this.rows].sort(
            (left, right) =>
              right.updated_at.localeCompare(left.updated_at) ||
              right.created_at.localeCompare(left.created_at),
          ),
        get: () => undefined,
        run: () => undefined,
      }
    }

    if (sql.startsWith("SELECT * FROM associated_people WHERE relationship = ")) {
      return {
        all: () =>
          this.rows
            .filter((row) => sql.includes(`'${row.relationship}'`))
            .map((row, index) => ({
              ...row,
              id: index + 1,
              external_id: row.id,
            })),
        get: () => undefined,
        run: () => undefined,
      }
    }

    if (sql.startsWith("SELECT COUNT(*) AS count FROM associated_people")) {
      return {
        all: () => [{ count: this.rows.length }],
        get: () => undefined,
        run: () => undefined,
      }
    }

    if (sql.startsWith("INSERT INTO associated_people")) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.rows.push({
            id: values[0] as string,
            avatar: values[1] as string,
            name: values[2] as string,
            gender: values[3] as string,
            relationship: values[4] as AssociatedPersonRow["relationship"],
            status: values[5] as string,
            birthday: values[6] as string,
            contact: values[7] as string,
            tags: values[8] as string,
            details: values[9] as string,
            created_at: values[10] as string,
            updated_at: values[11] as string,
          })
        },
      }
    }

    if (
      sql.startsWith(
        "SELECT external_id AS id, avatar, name, gender, relationship, status, birthday, contact, tags, details, created_at, updated_at FROM associated_people WHERE external_id = ?",
      )
    ) {
      return {
        all: () => [],
        get: (...values) => this.rows.find((row) => row.id === values[0]),
        run: () => undefined,
      }
    }

    if (sql.startsWith("UPDATE associated_people SET")) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.rows = this.rows.map((row) =>
            row.id === values[10]
              ? {
                  ...row,
                  avatar: values[0] as string,
                  name: values[1] as string,
                  gender: values[2] as string,
                  relationship: values[3] as AssociatedPersonRow["relationship"],
                  status: values[4] as string,
                  birthday: values[5] as string,
                  contact: values[6] as string,
                  tags: values[7] as string,
                  details: values[8] as string,
                  updated_at: values[9] as string,
                }
              : row,
          )
        },
      }
    }

    if (sql.startsWith("DELETE FROM associated_people WHERE external_id = ?")) {
      return {
        all: () => [],
        get: () => undefined,
        run: (...values) => {
          this.rows = this.rows.filter((row) => row.id !== values[0])
        },
      }
    }

    throw new Error(`未支持的测试 SQL: ${sql}`)
  }
}

beforeEach(() => {
  sqlite = new MemoryPeopleDatabase()
})

describe("peopleService", () => {
  it("新数据库默认没有关联人物", () => {
    const service = createPeopleService(sqlite)

    expect(service.list()).toEqual([])
  })

  it("支持只读 SQL 查询原始行", () => {
    const service = createPeopleService(sqlite)

    const created = service.create({
      avatar: "",
      name: "小周",
      gender: "女",
      relationship: "同事",
      status: "项目协作",
      birthday: "",
      contact: "微信",
      tags: ["产品"],
      details: "# 小周",
    })

    expect(service.querySql("SELECT * FROM associated_people WHERE relationship = '同事'")).toEqual(
      [
        {
          id: 1,
          external_id: created.id,
          avatar: "",
          name: "小周",
          gender: "女",
          relationship: "同事",
          status: "项目协作",
          birthday: "",
          contact: "微信",
          tags: JSON.stringify(["产品"]),
          details: "# 小周",
          created_at: created.createdAt,
          updated_at: created.updatedAt,
        },
      ],
    )
    expect(service.querySql("SELECT COUNT(*) AS count FROM associated_people")).toEqual([
      { count: 1 },
    ])
  })

  it("支持创建、读取、更新、删除关联人物", () => {
    const service = createPeopleService(sqlite)

    const created = service.create({
      avatar: "",
      name: "阿明",
      gender: "男",
      relationship: "朋友",
      status: "技术狂热者",
      birthday: "09月11日",
      contact: "GitHub: aming-coder",
      tags: ["极客", "开朗"],
      details: "# 阿明",
    })

    expect(created).toMatchObject({
      avatar: "",
      name: "阿明",
      gender: "男",
      relationship: "朋友",
      status: "技术狂热者",
      birthday: "09月11日",
      contact: "GitHub: aming-coder",
      tags: ["极客", "开朗"],
      details: "# 阿明",
    })
    expect(created.id).toMatch(/^[\da-f]{32}$/)
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    expect(service.list()).toEqual([created])

    const updated = service.update(created.id, {
      avatar: "mc-image://people/avatar.png",
      name: "阿明",
      gender: "男",
      relationship: "同事",
      status: "协作伙伴",
      birthday: "09月11日",
      contact: "GitHub: aming-coder",
      tags: ["架构"],
      details: "# 协作记录",
    })

    expect(updated).toEqual({
      ...created,
      avatar: "mc-image://people/avatar.png",
      relationship: "同事",
      status: "协作伙伴",
      tags: ["架构"],
      details: "# 协作记录",
      updatedAt: updated.updatedAt,
    })
    expect(service.list()).toEqual([updated])

    service.delete(created.id)

    expect(service.list()).toEqual([])
  })

  it("校验错误的人物输入", () => {
    const service = createPeopleService(sqlite)

    expect(() =>
      service.create({
        avatar: "",
        name: " ",
        gender: "男",
        relationship: "朋友",
        status: "",
        birthday: "",
        contact: "",
        tags: [],
        details: "",
      }),
    ).toThrow("姓名不能为空")

    expect(() =>
      service.create({
        avatar: "",
        name: "阿明",
        gender: "男",
        relationship: "朋友",
        status: "",
        birthday: "",
        contact: "",
        tags: [1 as never],
        details: "",
      }),
    ).toThrow("人物标签格式不正确")
  })
})
