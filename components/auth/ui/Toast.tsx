"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning";

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toast: (message: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = (message: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...message, id }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-3 w-full max-w-[360px] pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastCard key={t.id} message={t} onClose={() => removeToast(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ message, onClose }: { message: ToastMessage; onClose: () => void }) {
  const { type, title, description, duration = 4000 } = message;
  const [progress, setProgress] = useState(100);

  // Auto-dismiss after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // Smoothly decrement progress bar
  useEffect(() => {
    const step = 100 / (duration / 50);
    const interval = setInterval(() => {
      setProgress((prev) => Math.max(0, prev - step));
    }, 50);

    return () => clearInterval(interval);
  }, [duration]);

  const icons = {
    success: <CheckCircle2 className="text-emerald-500 h-5 w-5 shrink-0" />,
    warning: <AlertTriangle className="text-amber-500 h-5 w-5 shrink-0" />,
    error: <XCircle className="text-red-500 h-5 w-5 shrink-0" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "relative flex flex-col rounded-xl border p-4 shadow-lg backdrop-blur-md pointer-events-auto overflow-hidden",
        "bg-white/90 border-slate-200/80 dark:bg-slate-900/90 dark:border-slate-800"
      )}
    >
      <div className="flex gap-3">
        {icons[type]}
        <div className="flex-1 space-y-1">
          <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-tight">
            {title}
          </p>
          {description && (
            <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-normal">
              {description}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 rounded-md self-start cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 h-[3px] bg-slate-100 dark:bg-slate-800 w-full">
        <div
          className={cn(
            "h-full transition-all duration-75",
            type === "success" && "bg-emerald-500",
            type === "warning" && "bg-amber-500",
            type === "error" && "bg-red-500"
          )}
          style={{ width: `${progress}%`, transitionTimingFunction: "linear" }}
        />
      </div>
    </motion.div>
  );
}
