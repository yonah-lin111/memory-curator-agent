import type React from "react";

/**
 * SnippetsPage 组件 - 随记页面
 */
export const SnippetsPage = (): React.JSX.Element => {
  return (
    <section
      aria-label="随记 页面"
      className="flex-1 flex flex-col items-center justify-center h-auto lg:h-full bg-[#000000] p-6 text-white"
    >
      <h1 className="text-2xl font-bold tracking-tight">随记</h1>
    </section>
  );
};
