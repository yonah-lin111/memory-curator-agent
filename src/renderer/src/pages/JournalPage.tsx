import type React from "react";

/**
 * JournalPage 组件 - 日记条目回看
 */
export const JournalPage = (): React.JSX.Element => {
  return (
    <section
      aria-label="Journal 页面"
      className="flex-1 flex flex-col items-center justify-center h-auto lg:h-full bg-[#000000] p-6 text-white"
    >
      <h1 className="text-2xl font-bold tracking-tight">Journal</h1>
    </section>
  );
};
