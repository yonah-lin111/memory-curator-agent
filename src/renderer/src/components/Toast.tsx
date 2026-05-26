import type React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";

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
}

// 消息提示上下文接口。
interface ToastContextType {
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
 * 消息提示 Provider 组件。
 * 管理全局消息队列，并在视口右上角渲染消息堆叠卡片。
 */
export const ToastProvider = ({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element => {
  // 消息列表状态。
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  /**
   * 移除指定 ID 的消息。
   */
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
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

  /**
   * 获取不同类型对应的图标与样式配置。
   */
  const getToastStyle = (type: ToastType) => {
    switch (type) {
      case "success":
        return {
          icon: CheckCircle2,
          iconClass: "text-emerald-400",
          borderClass: "border-emerald-500/20",
        };
      case "error":
        return {
          icon: AlertCircle,
          iconClass: "text-rose-400",
          borderClass: "border-rose-500/20",
        };
      case "warning":
        return {
          icon: AlertTriangle,
          iconClass: "text-amber-400",
          borderClass: "border-amber-500/20",
        };
      case "info":
      default:
        return {
          icon: Info,
          iconClass: "text-blue-400",
          borderClass: "border-blue-500/20",
        };
    }
  };

  return (
    <ToastContext.Provider value={{ show, success, error, info, warning }}>
      {children}

      {/* 消息提示卡片层容器 */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col items-end gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const { icon: Icon, iconClass, borderClass } = getToastStyle(toast.type);

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 w-auto rounded-[6px] border bg-[#212121] p-3 shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all duration-300 animate-card-modal-in ${borderClass}`}
              role="alert"
            >
              {/* 类型对应高亮图标 */}
              <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${iconClass}`} />

              {/* 核心消息内容文本，默认 13px */}
              <span className="flex-1 text-sm font-medium text-white/90 leading-normal break-all">
                {toast.message}
              </span>

              {/* 手动关闭按钮 */}
              <button
                type="button"
                className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] text-white/30 transition-all duration-150 hover:bg-white/5 hover:text-white outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
                onClick={() => removeToast(toast.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

/**
 * 全局消息提示 Hook。
 * 供各页面或组件调用以输出轻量级提示信息。
 */
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast 必须在 ToastProvider 内部使用");
  }
  return context;
};
