import type React from "react";

/**
 * TodoPage 组件 - 待办事项页面
 */
export const TodoPage = (): React.JSX.Element => {
  return (
    <section
      aria-label="Todo 页面"
      className="flex-1 flex flex-col items-center justify-center h-auto lg:h-full bg-[#000000] p-6 text-white"
    >
      <h1 className="text-2xl font-bold tracking-tight">Todo</h1>
    </section>
  );
};
