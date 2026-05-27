import type React from "react";

/**
 * ChatsPage 组件 - 聊天记录（日输入）页面
 */
export const ChatsPage = (): React.JSX.Element => {
  return (
    <section
      aria-label="聊天记录 页面"
      className="flex-1 flex flex-col items-center justify-center h-auto lg:h-full bg-[#000000] p-6 text-white"
    >
      <h1 className="text-2xl font-bold tracking-tight">聊天记录（日输入）</h1>
    </section>
  );
};
