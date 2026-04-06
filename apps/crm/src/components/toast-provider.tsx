"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextValue {
  toast: (opts: { type?: ToastType; title?: string; message: string }) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ type = "info", title, message }: { type?: ToastType; title?: string; message: string }) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, title, message }]);
      // Auto-dismiss after 5 seconds
      setTimeout(() => remove(id), 5000);
    },
    [remove]
  );

  const value: ToastContextValue = {
    toast,
    success: (message, title) => toast({ type: "success", message, title }),
    error: (message, title) => toast({ type: "error", message, title }),
    warning: (message, title) => toast({ type: "warning", message, title }),
    info: (message, title) => toast({ type: "info", message, title }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const styles: Record<ToastType, { icon: typeof AlertCircle; bg: string; border: string; iconColor: string }> = {
    success: {
      icon: CheckCircle2,
      bg: "bg-white",
      border: "border-green-300",
      iconColor: "text-green-600",
    },
    error: {
      icon: AlertCircle,
      bg: "bg-white",
      border: "border-red-300",
      iconColor: "text-red-600",
    },
    warning: {
      icon: AlertTriangle,
      bg: "bg-white",
      border: "border-amber-300",
      iconColor: "text-amber-600",
    },
    info: {
      icon: Info,
      bg: "bg-white",
      border: "border-blue-300",
      iconColor: "text-blue-600",
    },
  };
  const style = styles[toast.type];
  const Icon = style.icon;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-md border ${style.border} ${style.bg} p-3 shadow-lg animate-in slide-in-from-right-5`}
    >
      <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${style.iconColor}`} />
      <div className="min-w-0 flex-1">
        {toast.title && <p className="text-sm font-semibold text-gray-900">{toast.title}</p>}
        <p className="text-sm text-gray-900">{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
