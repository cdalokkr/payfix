"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface InputProps
  extends Omit<React.ComponentProps<"input">, "placeholder"> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, id, ...props }, ref) => {
    const [focused, setFocused] = React.useState(false);
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {/* Static label above */}
        <label
          htmlFor={inputId}
          className={cn(
            "block text-[13px] font-medium mb-1.5 transition-colors duration-200",
            focused
              ? "text-brand-primary"
              : "text-slate-600 dark:text-slate-400"
          )}
        >
          {label}
        </label>
        <div
          className={cn(
            "glass-input relative flex items-center rounded-[12px] transition-all duration-300",
            focused &&
              "border-brand-primary ring-[3px] ring-brand-primary/10",
            error && "border-red-400 ring-[3px] ring-red-400/10",
            !focused && !error && "hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          {icon && (
            <span
              className={cn(
                "absolute left-2.5 pointer-events-none transition-colors duration-200",
                focused
                  ? "text-brand-primary"
                  : "text-slate-800 dark:text-slate-300"
              )}
              aria-hidden
            >
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            placeholder={label}
            className={cn(
              "w-full rounded-[12px] bg-transparent h-[38px] px-2.5 text-[14px] text-slate-900 placeholder-slate-400/60 focus:outline-none dark:text-slate-100 dark:placeholder-slate-600",
              icon && "pl-8.5",
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
        </div>
        <AnimatePresence>
          {error && (
            <motion.p
              id={`${inputId}-error`}
              role="alert"
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 4 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.2 }}
              className="text-[12px] text-red-500 overflow-hidden pl-1"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
