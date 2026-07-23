// 待办优先级，限制为固定四档。
export type TodoPriority = "P0" | "P1" | "P2" | "P3"

// 待办事项对象，供页面与弹窗共享。
export interface TodoItem {
  // 待办唯一标识。
  id: number
  // 待办内容文本。
  text: string
  // 是否已完成。
  completed: boolean
  // 当前优先级。
  priority: TodoPriority
}

// 优先级顺序，用于循环切换。
export const TODO_PRIORITY_SEQUENCE: TodoPriority[] = ["P0", "P1", "P2", "P3"]

// 优先级权重，用于列表稳定排序。
export const TODO_PRIORITY_WEIGHT: Record<TodoPriority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
}

/**
 * 计算下一个优先级。
 */
export const getNextTodoPriority = (priority: TodoPriority): TodoPriority => {
  const nextIndex = (TODO_PRIORITY_SEQUENCE.indexOf(priority) + 1) % TODO_PRIORITY_SEQUENCE.length

  return TODO_PRIORITY_SEQUENCE[nextIndex]
}

/**
 * 以主流 todo 列表的方式排序：未完成优先，其次按优先级。
 */
export const sortTodoItems = (todos: TodoItem[]): TodoItem[] =>
  [...todos].sort((leftTodo, rightTodo) => {
    if (leftTodo.completed !== rightTodo.completed) {
      return leftTodo.completed ? 1 : -1
    }

    return TODO_PRIORITY_WEIGHT[leftTodo.priority] - TODO_PRIORITY_WEIGHT[rightTodo.priority]
  })
