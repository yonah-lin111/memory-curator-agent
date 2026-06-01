import type { AssociatedPersonItem, PersonRelationship } from '../../db/schema'
import type { PeopleService } from '../../services/peopleService'
import type {
  AgentTool,
  PeopleQueryConditions,
  PeopleQueryToolInput,
  PeopleQueryToolItem,
  PeopleQueryToolResult
} from '../types'

// People 查询工具类型。
type PeopleQueryTool = Omit<AgentTool, 'execute'> & {
  /**
   * 执行 People 查询。
   */
  execute: (input: unknown) => Promise<PeopleQueryToolResult>
}

// People 工具默认返回数量。
const DEFAULT_PEOPLE_LIMIT = 8

// People 工具最大返回数量。
const MAX_PEOPLE_LIMIT = 20

// People SQL 最大长度。
const MAX_PEOPLE_SQL_LENGTH = 1200

// People 查询表名。
const PEOPLE_TABLE_NAME = 'associated_people'

// People 查询字段清单。
const PEOPLE_COLUMNS =
  'id, avatar, name, gender, relationship, status, birthday, contact, tags, details, created_at, updated_at'

// People 默认查询字段清单，不包含 details。
const DEFAULT_PEOPLE_COLUMNS =
  'id, avatar, name, gender, relationship, status, birthday, contact, tags, created_at, updated_at'

// 禁止 AI SQL 使用的高风险关键字。
const FORBIDDEN_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace|reindex|begin|commit|rollback|union|join)\b/i

// SQL 注释片段。
const SQL_COMMENT_PATTERN = /--|\/\*|\*\//

// People 数据库行类型。
type PeopleSqlRow = Record<string, unknown>

/**
 * 将人物压缩为工具返回项。
 */
const toToolItem = (person: AssociatedPersonItem): PeopleQueryToolItem => ({
  id: person.id,
  name: person.name,
  gender: person.gender,
  relationship: person.relationship,
  status: person.status,
  birthday: person.birthday,
  contact: person.contact,
  tags: person.tags,
  details: person.details,
  updatedAt: person.updatedAt
})

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * 判断 SQL 原始行是否包含完整人物字段。
 */
const isPersonSqlRow = (value: unknown): value is PeopleSqlRow =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.gender === 'string' &&
  typeof value.relationship === 'string' &&
  typeof value.status === 'string' &&
  typeof value.birthday === 'string' &&
  typeof value.contact === 'string' &&
  typeof value.tags === 'string' &&
  typeof value.updated_at === 'string'

/**
 * 解析 SQL 行中的标签字段。
 */
const parseSqlTags = (value: string): string[] => {
  const parsed = JSON.parse(value) as unknown

  return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : []
}

/**
 * 将完整 SQL 人物行映射为工具返回项。
 */
const sqlRowToToolItem = (row: PeopleSqlRow): PeopleQueryToolItem =>
  toToolItem({
    id: row.id as string,
    avatar: '',
    name: row.name as string,
    gender: row.gender as string,
    relationship: row.relationship as PersonRelationship,
    status: row.status as string,
    birthday: row.birthday as string,
    contact: row.contact as string,
    tags: parseSqlTags(row.tags as string),
    details: typeof row.details === 'string' ? row.details : '',
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    updatedAt: row.updated_at as string
  })

/**
 * 解析字符串字段。
 */
const parseString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

/**
 * 解析 People 条件查询入参。
 */
const parseConditions = (value: unknown): PeopleQueryConditions | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  return {
    name: parseString(value.name),
    gender: parseString(value.gender),
    relationship: parseString(value.relationship) as PersonRelationship | undefined,
    status: parseString(value.status),
    birthday: parseString(value.birthday),
    contact: parseString(value.contact),
    tag: parseString(value.tag),
    details: parseString(value.details),
    updatedAfter: parseString(value.updatedAfter),
    updatedBefore: parseString(value.updatedBefore)
  }
}

/**
 * 解析 People 工具入参。
 */
const parseInput = (input: unknown): PeopleQueryToolInput => {
  if (!isRecord(input)) {
    return {}
  }

  return {
    query: parseString(input.query),
    relationship: parseString(input.relationship) as PersonRelationship | undefined,
    conditions: parseConditions(input.conditions),
    sql: parseString(input.sql),
    limit: typeof input.limit === 'number' ? input.limit : undefined
  }
}

/**
 * 转义 SQL 字符串字面量。
 */
const escapeSqlString = (value: string): string => value.replace(/'/g, "''")

/**
 * 转义 LIKE 查询字面量。
 */
const escapeSqlLike = (value: string): string => escapeSqlString(value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_'))

/**
 * 构造 LIKE 条件。
 */
const buildLikeCondition = (column: string, value: string | undefined): string | null => {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  return `${column} LIKE '%${escapeSqlLike(trimmed)}%' ESCAPE '\\'`
}

/**
 * 构造相等条件。
 */
const buildEqualCondition = (column: string, value: string | undefined): string | null => {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  return `${column} = '${escapeSqlString(trimmed)}'`
}

/**
 * 构造基础字段 query 条件。
 */
const buildBaseQueryCondition = (query: string | undefined): string | null => {
  const trimmed = query?.trim()
  if (!trimmed) {
    return null
  }

  return `(${['name', 'gender', 'relationship', 'status', 'birthday', 'contact', 'tags']
    .map((column) => buildLikeCondition(column, trimmed))
    .filter((condition): condition is string => Boolean(condition))
    .join(' OR ')})`
}

/**
 * 构造结构化查询 WHERE 子句。
 */
const buildStructuredWhere = (
  parsed: PeopleQueryToolInput,
  queryTarget: 'base' | 'details'
): string => {
  const conditions = parsed.conditions
  const whereParts = [
    buildEqualCondition('relationship', parsed.relationship),
    buildLikeCondition('name', conditions?.name),
    buildLikeCondition('gender', conditions?.gender),
    buildEqualCondition('relationship', conditions?.relationship),
    buildLikeCondition('status', conditions?.status),
    buildLikeCondition('birthday', conditions?.birthday),
    buildLikeCondition('contact', conditions?.contact),
    buildLikeCondition('tags', conditions?.tag),
    buildLikeCondition('details', conditions?.details),
    conditions?.updatedAfter ? `updated_at >= '${escapeSqlString(conditions.updatedAfter.trim())}'` : null,
    conditions?.updatedBefore ? `updated_at <= '${escapeSqlString(conditions.updatedBefore.trim())}'` : null,
    queryTarget === 'base' ? buildBaseQueryCondition(parsed.query) : buildLikeCondition('details', parsed.query)
  ].filter((condition): condition is string => Boolean(condition))

  return whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : ''
}

/**
 * 将结构化查询编译为受控 SQL。
 */
const buildStructuredSql = (
  parsed: PeopleQueryToolInput,
  queryTarget: 'base' | 'details',
  limit: number
): string => {
  const isSingleQuery = limit === 1
  const shouldSelectDetails = isSingleQuery || Boolean(parsed.conditions?.details) || queryTarget === 'details'
  const columns = shouldSelectDetails ? PEOPLE_COLUMNS : DEFAULT_PEOPLE_COLUMNS

  return `SELECT ${columns} FROM ${PEOPLE_TABLE_NAME}${buildStructuredWhere(parsed, queryTarget)} ORDER BY updated_at DESC, created_at DESC`
}

/**
 * 校验并限制 AI 生成的 People SQL。
 */
const preparePeopleSql = (sql: string, limit: number): string => {
  const normalizedSql = sql.trim()

  if (!normalizedSql) {
    throw new Error('People SQL 不能为空')
  }

  if (normalizedSql.length > MAX_PEOPLE_SQL_LENGTH) {
    throw new Error('People SQL 过长')
  }

  if (normalizedSql.includes(';') || SQL_COMMENT_PATTERN.test(normalizedSql)) {
    throw new Error('People SQL 只允许单条无注释 SELECT')
  }

  if (!/^select\b/i.test(normalizedSql)) {
    throw new Error('People SQL 只允许 SELECT 查询')
  }

  if (FORBIDDEN_SQL_PATTERN.test(normalizedSql)) {
    throw new Error('People SQL 包含禁止关键字')
  }

  if (!new RegExp(`\\bfrom\\s+${PEOPLE_TABLE_NAME}\\b`, 'i').test(normalizedSql)) {
    throw new Error(`People SQL 只能查询 ${PEOPLE_TABLE_NAME} 表`)
  }

  if (/\bfrom\s+(?!associated_people\b)[a-z_][\w]*/i.test(normalizedSql)) {
    throw new Error(`People SQL 只能查询 ${PEOPLE_TABLE_NAME} 表`)
  }

  const hasLimit = /\blimit\s+\d+\b/i.test(normalizedSql)
  return hasLimit ? normalizedSql : `${normalizedSql} LIMIT ${limit}`
}

/**
 * 执行受控 People SQL 查询。
 */
const queryBySql = (
  peopleService: Pick<PeopleService, 'querySql'>,
  sql: string,
  limit: number
): { items: PeopleQueryToolItem[]; rows: unknown[] } => {
  const rows = peopleService.querySql(preparePeopleSql(sql, limit)).slice(0, limit)
  const items = rows.filter(isPersonSqlRow).map(sqlRowToToolItem)

  return {
    items,
    rows
  }
}

/**
 * 渲染 SQL 查询观察文本。
 */
const renderSqlObservation = (rows: unknown[]): string => {
  if (rows.length === 0) {
    return 'SQL 查询没有返回数据。'
  }

  return `SQL 查询返回 ${rows.length} 行，结构化数据已回传。`
}

/**
 * 执行结构化 SQL 查询，必要时再兜底查询 details。
 */
const queryStructuredBySql = (
  peopleService: Pick<PeopleService, 'querySql'>,
  parsed: PeopleQueryToolInput,
  limit: number
): { items: PeopleQueryToolItem[]; rows: unknown[] } => {
  const baseResult = queryBySql(peopleService, buildStructuredSql(parsed, 'base', limit), limit)
  if (baseResult.rows.length > 0 || !parsed.query?.trim() || parsed.conditions?.details) {
    return baseResult
  }

  return queryBySql(peopleService, buildStructuredSql(parsed, 'details', limit), limit)
}

/**
 * 创建 People 只读查询工具。
 */
export const createPeopleQueryTool = (peopleService: Pick<PeopleService, 'querySql'>): PeopleQueryTool => ({
  name: 'people_query',
  description: '查询本地 People 表中的关联人物档案，只读，不会修改数据。',
  prompt: {
    summary: '查询本地 People 表中的关联人物档案，只读，不会修改数据。支持结构化条件，也支持受控 SQL。',
    intentKeywords: [
      '人',
      '人物',
      '谁',
      '关系',
      '女朋友',
      '男朋友',
      '朋友',
      '家人',
      '同事',
      '喜欢',
      '爱吃',
      '偏好',
      '生日',
      '联系方式',
      '标签',
      '状态',
      'people',
      'person',
      'profile'
    ],
    whenToUse: [
      '用户询问某个人是谁、关系、状态、生日、联系方式或标签时使用。',
      '用户明确询问详情、偏好、喜好、经历、备注、背景等可能只存在于 details 的信息时使用 details。',
      '用户的问题需要用本地 People 表确认人物事实时使用。',
      '用户给出姓名、关系、状态、标签或详情关键词，需要查找匹配人物时使用。',
      '用户需要组合条件、排序或更精细过滤时，可生成只读 SQL 查询 associated_people 表。'
    ],
    whenNotToUse: [
      '用户只是闲聊、写作、翻译或不涉及本地人物档案时不要使用。',
      '用户要求新增、修改或删除人物档案时不要使用。'
    ],
    safety: [
      '只读取本地 People 表，不写入任何数据。',
      `SQL 只能是单条 SELECT，只能查询 ${PEOPLE_TABLE_NAME} 表，禁止 JOIN、UNION、注释、多语句和写入关键字。`,
      '单个查询（即 limit = 1）时，不受 restrictions 限制，默认包含 details 字段；批量查询（即 limit > 1）时，默认不包含 details 字段以节省传输和计算资源。',
      '【极其重要】当用户输入的需要查询的内容没有匹配到（未命中）任何姓名、关系、状态、标签等基础字段时，或者进行单个查询（limit = 1）时，应该添加 details 这个字段。批量查询时（limit > 1）默认不加入 details，除非基础字段未匹配到任何结果。',
      '工具没有返回的人物事实不能编造。',
      '工具结果不足时直接说明信息不足。'
    ],
    output: '优先返回能回答用户问题的人物事实，不要复述无关字段。',
    examples: [
      `{"sql":"SELECT ${DEFAULT_PEOPLE_COLUMNS} FROM ${PEOPLE_TABLE_NAME} WHERE relationship = '朋友' ORDER BY updated_at DESC","limit":5}`,
      `{"sql":"SELECT COUNT(*) AS count FROM ${PEOPLE_TABLE_NAME}","limit":1}`,
      `{"sql":"SELECT ${PEOPLE_COLUMNS} FROM ${PEOPLE_TABLE_NAME} WHERE details LIKE '%爱吃%' ORDER BY updated_at DESC","limit":5}`,
      '{"conditions":{"relationship":"同事","tag":"产品"},"limit":5}'
    ]
  },
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '按姓名、性别、关系、状态、生日、联系方式或标签搜索；单个查询（limit = 1）或这些基础字段没有命中任何结果时，会自动配合/兜底包含 details 字段进行搜索。'
      },
      relationship: {
        type: 'string',
        enum: ['女朋友', '家人', '朋友', '同事', '其他'],
        description: '关系分类过滤'
      },
      conditions: {
        type: 'object',
        description: '结构化条件过滤；字符串字段均为包含匹配，relationship 为精确匹配',
        properties: {
          name: {
            type: 'string',
            description: '姓名包含'
          },
          gender: {
            type: 'string',
            description: '性别包含'
          },
          relationship: {
            type: 'string',
            enum: ['女朋友', '家人', '朋友', '同事', '其他'],
            description: '关系分类精确过滤'
          },
          status: {
            type: 'string',
            description: '状态包含'
          },
          birthday: {
            type: 'string',
            description: '生日包含'
          },
          contact: {
            type: 'string',
            description: '联系方式包含'
          },
          tag: {
            type: 'string',
            description: '任一标签包含'
          },
          details: {
            type: 'string',
            description: '详情包含；单个查询（limit = 1）默认可用，批量查询（limit > 1）在基础字段无法回答、没有命中匹配，或者明确需要详情时，可以使用此字段进行搜索。'
          },
          updatedAfter: {
            type: 'string',
            description: '更新时间下界，格式同 updated_at'
          },
          updatedBefore: {
            type: 'string',
            description: '更新时间上界，格式同 updated_at'
          }
        }
      },
      sql: {
        type: 'string',
        description: `受控只读 SQL。只能 SELECT FROM ${PEOPLE_TABLE_NAME}，可写 WHERE、ORDER BY、LIMIT，也可用 COUNT(*) AS count 做数量统计；单个查询（limit = 1）时 SELECT 应该包含 details，批量查询（limit > 1）时默认不要包含 details，除非基础字段没有命中时才添加 details。`
      },
      limit: {
        type: 'number',
        description: '最多返回数量'
      }
    }
  },
  execute: async (input) => {
    const parsed = parseInput(input)
    const limit = Math.max(1, Math.min(parsed.limit ?? DEFAULT_PEOPLE_LIMIT, MAX_PEOPLE_LIMIT))
    const queryResult = parsed.sql ? queryBySql(peopleService, parsed.sql, limit) : queryStructuredBySql(peopleService, parsed, limit)
    const { items, rows } = queryResult
    const observation = renderSqlObservation(rows)

    return {
      observation,
      data: {
        rows,
        items
      },
      items,
      rows
    }
  }
})
