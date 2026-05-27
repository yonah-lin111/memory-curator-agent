import type React from "react";

/**
 * PeoplePage 组件 - 人物关系档案页面
 */
export const PeoplePage = (): React.JSX.Element => {
  return (
    <section
      aria-label="People 页面"
      className="flex-1 flex flex-col items-center justify-center h-auto lg:h-full bg-[#000000] p-6 text-white"
    >
      <h1 className="text-2xl font-bold tracking-tight">人物关系档案</h1>
    </section>
  );
};
