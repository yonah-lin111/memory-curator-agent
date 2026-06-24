import type { AgentTool } from '@/agent/types'
import type { ThemesService } from '@/services/themesService'

/** 校验 SQL 只读 */
const CHECK_SQL_READONLY = /^(SELECT|WITH|EXPLAIN|PRAGMA)\b/i

/**
 * 创建主题策展相关 Agent 工具集。
 */
export const createThemeTools = (themesService: ThemesService): AgentTool[] => [
  {
    name: 'theme_tool_query',
    description: '查询当前所有主题及其关联，支持 SQL 查询。列出所有主题、某主题的所有关联素材、或执行自定义只读 SQL。',
    prompt: {
      summary: '查询主题与关联数据，获取跨周/跨类型素材对应的叙事聚合信息。',
      whenToUse: [
        '用户询问已有主题有哪些',
        '用户想知道某主题下有哪些关联素材',
        '用户要求统计主题分布',
        '需要执行复杂查询分析主题趋势'
      ],
      safety: ['仅执行只读 SELECT/WITH/EXPLAIN/PRAGMA 查询'],
      examples: [
        '用户: "我有哪些主题？" → theme_tool_query({ action: "list_themes" })',
        '用户: "职业转型这个主题下有什么？" → theme_tool_query({ action: "list_items", themeExternalId: "xxx" })',
        '用户: "本周哪个主题被提及最多？" → theme_tool_query({ action: "sql", sql: "SELECT ..." })'
      ]
    },
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list_themes', 'list_items', 'sql'],
          description: '操作类型：list_themes 列出所有主题，list_items 列出某主题的关联，sql 执行自定义只读查询'
        },
        themeExternalId: {
          type: 'string',
          description: '主题 external_id，list_items 时必填'
        },
        sql: {
          type: 'string',
          description: 'SQL 查询语句，仅支持 SELECT/WITH/EXPLAIN/PRAGMA，action=sql 时必填'
        },
        status: {
          type: 'string',
          enum: ['active', 'archived'],
          description: '筛选主题状态，action=list_themes 时可选'
        }
      },
      required: ['action']
    },
    execute: async (input) => {
      const args = input as {
        action: string
        themeExternalId?: string
        sql?: string
        status?: string
      }
      if (args.action === 'list_themes') {
        const themes = themesService.list(args.status)
        return {
          observation: themes.length
            ? themes
                .map(
                  (t) =>
                    `- ${t.name} (${t.status}, ${t.itemCount ?? 0}项关联): ${t.description || '无描述'}`
                )
                .join('\n')
            : '当前没有任何主题。',
          data: themes
        }
      }
      if (args.action === 'list_items') {
        if (!args.themeExternalId) {
          return { observation: '请指定 themeExternalId', data: null }
        }
        const items = themesService.listItems(args.themeExternalId)
        return {
          observation: items.length
            ? items
                .map(
                  (i) =>
                    `- [${i.sourceType}] ${i.sourceTitle ?? '无标题'}` +
                    (i.relevanceNote ? `: ${i.relevanceNote}` : '')
                )
                .join('\n')
            : '该主题下没有关联素材。',
          data: items
        }
      }
      if (args.action === 'sql') {
        if (!args.sql) {
          return { observation: '请提供 SQL 查询语句', data: null }
        }
        if (!CHECK_SQL_READONLY.test(args.sql.trim())) {
          return { observation: '仅允许只读查询（SELECT/WITH/EXPLAIN/PRAGMA）', data: null }
        }
        try {
          const rows = themesService.querySql(args.sql)
          return {
            observation:
              rows.length > 20
                ? `查询返回 ${rows.length} 行，前 20 行：\n${JSON.stringify(rows.slice(0, 20), null, 2)}`
                : JSON.stringify(rows, null, 2),
            data: rows
          }
        } catch (err) {
          return { observation: `查询失败: ${String(err)}`, data: null }
        }
      }
      return { observation: '未知操作', data: null }
    }
  },
  {
    name: 'theme_tool_add',
    description: '创建一个新的长期主题。创建前会请求用户确认。',
    confirmation: {
      header: '确认创建主题',
      question: '确认创建该主题',
      confirm: '确认创建',
      cancel: '取消',
      renderTarget: (input: any) => input?.name || '新主题',
      renderSummary: (input: any) => `将创建主题「${input?.name}」`
    },
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '主题名称，如「职业转型」「亲密关系」' },
        description: { type: 'string', description: '主题描述' },
        color: { type: 'string', description: '可选 hex 颜色' }
      },
      required: ['name']
    },
    execute: async (input) => {
      const args = input as { name: string; description?: string; color?: string }
      const theme = themesService.create({
        name: args.name,
        description: args.description,
        color: args.color
      })
      return {
        observation: `已创建主题「${theme.name}」`,
        data: theme
      }
    }
  },
  {
    name: 'theme_tool_update',
    description: '更新已有主题的名称、描述、状态或颜色。更新前会请求用户确认。',
    confirmation: {
      header: '确认更新主题',
      question: '确认更新该主题',
      confirm: '确认更新',
      cancel: '取消',
      renderTarget: (input: any) => `主题 ${input?.themeExternalId}`,
      renderSummary: (input: any) => `将更新主题 ${input?.themeExternalId}（新名称：${input?.name || '未修改'}）`
    },
    parameters: {
      type: 'object',
      properties: {
        themeExternalId: { type: 'string', description: '主题 external_id' },
        name: { type: 'string', description: '新名称' },
        description: { type: 'string', description: '新描述' },
        status: { type: 'string', enum: ['active', 'archived'], description: '新状态' },
        color: { type: 'string', description: '新颜色' }
      },
      required: ['themeExternalId']
    },
    execute: async (input) => {
      const args = input as {
        themeExternalId: string
        name?: string
        description?: string
        status?: string
        color?: string
      }
      const theme = themesService.update(args.themeExternalId, {
        name: args.name,
        description: args.description,
        status: args.status,
        color: args.color
      })
      return { observation: `已更新主题「${theme.name}」`, data: theme }
    }
  },
  {
    name: 'theme_tool_delete',
    description: '删除一个主题及其所有关联。删除前会请求用户二次确认。',
    confirmation: {
      header: '确认删除主题',
      question: '确认删除该主题及其关联',
      confirm: '确认删除',
      cancel: '取消',
      renderTarget: (input: any) => `主题 ${input?.themeExternalId}`,
      renderSummary: (input: any) => `将永久删除主题 ${input?.themeExternalId} 及其关联素材`
    },
    parameters: {
      type: 'object',
      properties: {
        themeExternalId: { type: 'string', description: '要删除的主题 external_id' }
      },
      required: ['themeExternalId']
    },
    execute: async (input) => {
      const args = input as { themeExternalId: string }
      const existing = themesService.getByExternalId(args.themeExternalId)
      if (!existing) return { observation: '主题不存在', data: null }
      themesService.delete(args.themeExternalId)
      return { observation: `已删除主题「${existing.name}」及其所有关联`, data: null }
    }
  },
  {
    name: 'theme_tool_item_add',
    description: '将一篇素材（笔记、日记、片段）关联到指定主题。关联前会请求用户确认。',
    confirmation: {
      header: '确认关联素材',
      question: '确认将素材关联至该主题',
      confirm: '确认关联',
      cancel: '取消',
      renderTarget: (input: any) => `素材 ${input?.sourceId}`,
      renderSummary: (input: any) => `将 ${input?.sourceType} ${input?.sourceId} 关联至主题 ${input?.themeExternalId}`
    },
    parameters: {
      type: 'object',
      properties: {
        themeExternalId: { type: 'string', description: '目标主题 external_id' },
        sourceType: {
          type: 'string',
          enum: ['note', 'journal', 'snippet'],
          description: '素材类型'
        },
        sourceId: { type: 'string', description: '素材 ID（数字字符串）' },
        relevanceNote: { type: 'string', description: 'AI 生成的关联说明' }
      },
      required: ['themeExternalId', 'sourceType', 'sourceId']
    },
    execute: async (input) => {
      const args = input as {
        themeExternalId: string
        sourceType: string
        sourceId: string
        relevanceNote?: string
      }
      const theme = themesService.getByExternalId(args.themeExternalId)
      if (!theme) return { observation: '主题不存在', data: null }
      const item = themesService.addItem({
        themeExternalId: args.themeExternalId,
        sourceType: args.sourceType,
        sourceId: args.sourceId,
        relevanceNote: args.relevanceNote ?? '',
        aiExtracted: 1
      })
      return {
        observation: `已将 [${item.sourceType}] 素材关联到主题「${theme.name}」`,
        data: item
      }
    }
  },
  {
    name: 'theme_tool_item_remove',
    description: '解除某篇素材与主题的关联。操作前会请求用户确认。',
    confirmation: {
      header: '确认解除关联',
      question: '确认解除素材与该主题的关联',
      confirm: '确认解除',
      cancel: '取消',
      renderTarget: (input: any) => `素材 ${input?.sourceId}`,
      renderSummary: (input: any) => `将 ${input?.sourceType} ${input?.sourceId} 与主题 ${input?.themeExternalId} 解除关联`
    },
    parameters: {
      type: 'object',
      properties: {
        themeExternalId: { type: 'string', description: '主题 external_id' },
        sourceType: {
          type: 'string',
          enum: ['note', 'journal', 'snippet', 'weekly_summary'],
          description: '素材类型'
        },
        sourceId: { type: 'string', description: '素材 ID' }
      },
      required: ['themeExternalId', 'sourceType', 'sourceId']
    },
    execute: async (input) => {
      const args = input as {
        themeExternalId: string
        sourceType: string
        sourceId: string
      }
      themesService.removeItem(args.themeExternalId, args.sourceType, args.sourceId)
      return { observation: '已解除关联', data: null }
    }
  }
]
