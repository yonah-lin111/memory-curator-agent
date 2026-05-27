import type React from "react";

/**
 * ThemesPage 组件 - 长期主题追踪
 */
export const ThemesPage = (): React.JSX.Element => {
  return (
    <section
      aria-label="Themes 页面"
      className="flex-1 flex flex-col items-center justify-center h-auto lg:h-full bg-[#000000] p-6 text-white"
    >
      <h1 className="text-2xl font-bold tracking-tight">Themes</h1>
    </section>
  );
};
