import type React from "react";

// 通用空状态属性。
interface EmptyStateProps {
  // 空状态标题。
  title: string;
  // 空状态描述。
  description: string;
  // 附加动作区域。
  action?: React.ReactNode;
}

/**
 * EmptyState - 通用空状态卡片。
 */
export const EmptyState = ({
  title,
  description,
  action,
}: EmptyStateProps): React.JSX.Element => (
  <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8">
    <p className="text-sm font-semibold text-white/80">{title}</p>
    <p className="mt-1 text-xs leading-5 text-white/40">{description}</p>
    {action ? <div className="mt-3">{action}</div> : null}
  </div>
);
