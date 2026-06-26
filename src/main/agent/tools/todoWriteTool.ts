import type { AgentTool } from '@/agent/types'
import type { TodosService } from '@/services/todosService'
import type { ToolConfirmationConfig } from '@/agent/tools/toolConfirmation'

export const createTodoWriteTool = (todosService: Pick<TodosService, 'create' | 'update' | 'delete'>): AgentTool => {
  return {
    name: 'write_todo',
    description: '创建、更新或删除待办事项 (TODO)。操作具有一定破坏性，可能需要用户确认。',
    prompt: {
      summary: '管理待办事项',
      whenToUse: ['用户要求新增一个任务', '用户要求标记某个任务为完成', '用户想要删除已完成或不再需要的任务'],
      whenNotToUse: ['查询任务列表时（使用 read_todo 或对应查询工具）'],
      safety: ['删除操作可能导致数据丢失，涉及删除应谨慎'],
      output: '操作成功结果或错误消息'
    },
    confirmation: {
      message: (input: unknown) => {
        const { action } = input as { action: string }
        if (action === 'delete') return '是否允许删除该待办事项？'
        if (action === 'update') return '是否允许更新该待办事项？'
        return '是否允许添加新待办事项？'
      }
    } as ToolConfirmationConfig,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'delete'],
          description: '要执行的操作类型'
        },
        id: {
          type: 'string',
          description: '更新或删除时必须提供待办事项的ID'
        },
        title: {
          type: 'string',
          description: '创建或更新时的标题内容'
        },
        status: {
          type: 'number',
          enum: [0, 1],
          description: '状态：0-未完成，1-已完成'
        }
      },
      required: ['action']
    },
    execute: async (input: unknown) => {
      const { action, id, title, status } = input as any
      try {
        if (action === 'create') {
          if (!title) return { observation: 'Missing title for create action', data: null }
          const item = await todosService.create({ title, content: '', priority: 0 })
          return { observation: `Successfully created todo: ${item.title}`, data: item }
        }
        if (action === 'update') {
          if (!id) return { observation: 'Missing id for update action', data: null }
          const updateData: any = {}
          if (title !== undefined) updateData.title = title
          if (status !== undefined) updateData.status = status
          const item = await todosService.update(id, updateData)
          return { observation: `Successfully updated todo ${id}`, data: item }
        }
        if (action === 'delete') {
          if (!id) return { observation: 'Missing id for delete action', data: null }
          await todosService.delete(id)
          return { observation: `Successfully deleted todo ${id}`, data: { id } }
        }
        return { observation: `Invalid action: ${action}`, data: null }
      } catch (err: any) {
        return { observation: `Todo write failed: ${err.message}`, data: null }
      }
    }
  }
}
