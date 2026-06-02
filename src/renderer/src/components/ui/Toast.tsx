import type React from "react";
import { createContext, useContext, useState, useCallback } from "react";

// 消息提示类型。
export type ToastType = "success" | "error" | "info" | "warning";

// 单个消息提示的数据结构。
export interface ToastItem {
  // 唯一标识。
  id: string;
  // 消息文本。
  message: string;
  // 提示类型。
  type: ToastType;
  // 是否正在退出（用于退出动画）
  isExiting?: boolean;
}

// 消息提示上下文接口。
interface ToastContextType {
  // 当前消息列表。
  toasts: ToastItem[];
  // 触发通用消息提示。
  show: (message: string, type?: ToastType, duration?: number) => void;
  // 触发成功类型消息。
  success: (message: string, duration?: number) => void;
  // 触发错误类型消息。
  error: (message: string, duration?: number) => void;
  // 触发信息类型消息。
  info: (message: string, duration?: number) => void;
  // 触发警告类型消息。
  warning: (message: string, duration?: number) => void;
}

// 消息提示上下文实例。
const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * 获取不同类型对应的文字颜色类名。
 */
export const getToastColorClass = (type: ToastType): string => {
  switch (type) {
    case "success":
      return "text-emerald-400";
    case "error":
      return "text-rose-400";
    case "warning":
      return "text-amber-400";
    case "info":
    default:
      return "text-blue-400";
  }
};

/**
 * 消息提示 Provider 组件。
 * 管理全局消息队列。
 */
export const ToastProvider = ({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element => {
  // 消息列表状态。
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  /**
   * 移除指定 ID 的消息（带退出过渡）。
   */
  const removeToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((toast) => (toast.id === id ? { ...toast, isExiting: true } : toast))
    );
    // 延迟 300ms（等待 CSS 过渡结束）后，真正移出
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 300);
  }, []);

  /**
   * 创建并显示一条消息。
   */
  const show = useCallback(
    (message: string, type: ToastType = "info", duration = 3000) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, message, type };

      setToasts((prev) => [...prev, newToast]);

      // 定时自动关闭。
      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  /**
   * 快捷触发成功提示。
   */
  const success = useCallback(
    (message: string, duration = 3000) => {
      show(message, "success", duration);
    },
    [show]
  );

  /**
   * 快捷触发错误提示。
   */
  const error = useCallback(
    (message: string, duration = 3000) => {
      show(message, "error", duration);
    },
    [show]
  );

  /**
   * 快捷触发信息提示。
   */
  const info = useCallback(
    (message: string, duration = 3000) => {
      show(message, "info", duration);
    },
    [show]
  );

  /**
   * 快捷触发警告提示。
   */
  const warning = useCallback(
    (message: string, duration = 3000) => {
      show(message, "warning", duration);
    },
    [show]
  );

  return (
    <ToastContext.Provider value={{ toasts, show, success, error, info, warning }}>
      {children}
      {/* 隐藏的辅助无障碍 alert 容器，供屏幕阅读器和测试框架定位 */}
      <div className="sr-only" aria-live="assertive">
        {toasts.map((toast) => (
          <div key={toast.id} role="alert">
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

/**
 * 全局消息提示 Hook。
 */
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    // 优雅降级，防止非 Provider 环境下崩溃
    return {
      toasts: [],
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
      warning: () => {},
    };
  }
  return context;
};
