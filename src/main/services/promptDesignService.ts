import { getDatabase } from "../db"
import { createCompactUuid } from "../id"
import {
  PromptDesignProject,
  PromptDesignProjectCreateInput,
  PromptDesignProjectRow,
  PromptDesignProjectUpdateInput,
  PromptDesign,
  PromptDesignCreateInput,
  PromptDesignRow,
  PromptDesignUpdateInput,
} from "../db/schema"

export const promptDesignService = {
  // ==================== 项目 ====================

  listProjects: (): PromptDesignProject[] => {
    const db = getDatabase()
    const rows = db.prepare("SELECT * FROM prompt_design_projects ORDER BY created_at DESC").all() as PromptDesignProjectRow[]
    return rows.map((row) => ({
      id: row.external_id,
      name: row.name,
      type: row.type as "filesystem" | "virtual",
      path: row.path || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  },

  createProject: (input: PromptDesignProjectCreateInput): PromptDesignProject => {
    const db = getDatabase()
    const id = input.id || createCompactUuid()
    const now = new Date().toISOString()
    const type = input.type || "virtual"

    db.prepare(
      "INSERT INTO prompt_design_projects (external_id, name, type, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, input.name, type, input.path || null, now, now)

    return {
      id,
      name: input.name,
      type,
      path: input.path,
      createdAt: now,
      updatedAt: now,
    }
  },

  renameProject: (id: string, name: string): void => {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.prepare("UPDATE prompt_design_projects SET name = ?, updated_at = ? WHERE external_id = ?").run(
      name,
      now,
      id
    )
  },

  updateProject: (id: string, input: PromptDesignProjectUpdateInput): void => {
    const db = getDatabase()
    const now = new Date().toISOString()
    
    if (input.name !== undefined && input.path !== undefined) {
      db.prepare("UPDATE prompt_design_projects SET name = ?, path = ?, updated_at = ? WHERE external_id = ?").run(
        input.name,
        input.path,
        now,
        id
      )
    } else if (input.name !== undefined) {
      db.prepare("UPDATE prompt_design_projects SET name = ?, updated_at = ? WHERE external_id = ?").run(
        input.name,
        now,
        id
      )
    } else if (input.path !== undefined) {
      db.prepare("UPDATE prompt_design_projects SET path = ?, updated_at = ? WHERE external_id = ?").run(
        input.path,
        now,
        id
      )
    }
  },

  deleteProject: (id: string): void => {
    const db = getDatabase()
    // 外键 ON DELETE CASCADE 会自动处理关联设计
    db.prepare("DELETE FROM prompt_design_projects WHERE external_id = ?").run(id)
  },

  // ==================== 设计 ====================

  listDesigns: (projectId?: string): PromptDesign[] => {
    const db = getDatabase()
    let rows: PromptDesignRow[]
    
    if (projectId) {
      rows = db.prepare("SELECT * FROM prompt_design_items WHERE project_id = ? ORDER BY created_at ASC").all(projectId) as PromptDesignRow[]
    } else {
      rows = db.prepare("SELECT * FROM prompt_design_items ORDER BY created_at ASC").all() as PromptDesignRow[]
    }

    return rows.map((row) => ({
      id: row.external_id,
      projectId: row.project_id,
      name: row.name,
      designData: row.design_data ? JSON.parse(row.design_data) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  },

  createDesign: (input: PromptDesignCreateInput): PromptDesign => {
    const db = getDatabase()
    const id = input.id || createCompactUuid()
    const now = new Date().toISOString()
    const designDataStr = input.designData ? JSON.stringify(input.designData) : null

    db.prepare(
      "INSERT INTO prompt_design_items (external_id, project_id, name, design_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, input.projectId, input.name, designDataStr, now, now)

    return {
      id,
      projectId: input.projectId,
      name: input.name,
      designData: input.designData || null,
      createdAt: now,
      updatedAt: now,
    }
  },

  renameDesign: (id: string, name: string): void => {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.prepare("UPDATE prompt_design_items SET name = ?, updated_at = ? WHERE external_id = ?").run(
      name,
      now,
      id
    )
  },

  updateDesign: (id: string, input: PromptDesignUpdateInput): void => {
    const db = getDatabase()
    const now = new Date().toISOString()

    // 采用 sqlite 事务，保证画布 JSON 状态和扁平化业务节点的强一致性
    const transaction = db.transaction(() => {
      // 1. 更新主设计项大 JSON
      if (input.name !== undefined && input.designData !== undefined) {
        db.prepare("UPDATE prompt_design_items SET name = ?, design_data = ?, updated_at = ? WHERE external_id = ?").run(
          input.name,
          JSON.stringify(input.designData),
          now,
          id
        )
      } else if (input.name !== undefined) {
        db.prepare("UPDATE prompt_design_items SET name = ?, updated_at = ? WHERE external_id = ?").run(
          input.name,
          now,
          id
        )
      } else if (input.designData !== undefined) {
        db.prepare("UPDATE prompt_design_items SET design_data = ?, updated_at = ? WHERE external_id = ?").run(
          JSON.stringify(input.designData),
          now,
          id
        )
      }

      // 2. 方案二 CQRS：仅在 designData 实际发生更新时，才触发节点同步解析与落库
      if (input.designData !== undefined && Array.isArray(input.designData.nodes)) {
        // 先清理本设计项下的历史同步业务节点
        db.prepare("DELETE FROM prompt_active_nodes WHERE design_item_id = ?").run(id)

        const nodes = input.designData.nodes

        // 计算 sort_order 的方式：按节点 Y 坐标升序，X 坐标为第二权重，使画布上看起来“从上到下、从左到右”的节点天然具备合理的顺序
        const sortedNodes = [...nodes].sort((a, b) => {
          const yA = a.position?.y ?? 0
          const yB = b.position?.y ?? 0
          if (yA !== yB) return yA - yB
          return (a.position?.x ?? 0) - (b.position?.x ?? 0)
        })

        const insertStmt = db.prepare(`
          INSERT INTO prompt_active_nodes (
            external_id, design_item_id, parent_node_id, node_type, title, content, sort_order, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)

        sortedNodes.forEach((node, index) => {
          const nodeData = node.data || {}
          // 仅记录核心业务节点，剔除没有任何提示词实体的容器、连接辅助板
          const nodeType = nodeData.nodeType
          if (!nodeType || nodeType === "assemble_a" || nodeType === "compiler_c") {
            return
          }

          const externalId = node.id
          const parentNodeId = node.parentId || null
          const title = nodeData.title || ""
          const content = nodeData.content !== undefined ? String(nodeData.content) : null

          insertStmt.run(
            externalId,
            id,
            parentNodeId,
            nodeType,
            title,
            content,
            index, // 排序序号
            now
          )
        })
      }
    })

    transaction()
  },

  deleteDesign: (id: string): void => {
    const db = getDatabase()
    db.prepare("DELETE FROM prompt_design_items WHERE external_id = ?").run(id)
  },

  // ==================== 文件工具支持 ====================

  /**
   * 根据 designItemId 查询关联项目的文件系统路径。
   * 仅返回 type='filesystem' 且 path 非空的项目路径，否则返回 null（虚拟项目）。
   */
  getProjectPathByDesignItemId: (designItemId: string): string | null => {
    const db = getDatabase()
    const row = db.prepare(
      `SELECT p.path
       FROM prompt_design_items di
       JOIN prompt_design_projects p ON p.external_id = di.project_id
       WHERE di.external_id = ? AND p.type = 'filesystem' AND p.path IS NOT NULL AND p.path != ''`
    ).get(designItemId) as { path: string } | undefined

    return row?.path ?? null
  },
}
