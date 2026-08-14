"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
  containerClassName?: string;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, icon, error, containerClassName, className, id, placeholder, onFocus, onBlur, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className={cn("w-full text-left", containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "block text-[13px] font-medium mb-1.5 transition-colors duration-200",
              focused
                ? "text-brand-primary dark:text-[#635BFF]"
                : "text-slate-600 dark:text-slate-400"
            )}
          >
            {label}
          </label>
        )}
        <div
          className={cn(
            "relative flex items-center rounded-[12px] transition-all duration-300 border bg-white dark:bg-[#0B131A]",
            focused
              ? "border-brand-primary dark:border-[#635BFF] ring-[3px] ring-brand-primary/10 dark:ring-[#635BFF]/10"
              : error
              ? "border-red-400 dark:border-rose-500 ring-[3px] ring-red-400/10"
              : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          {icon && (
            <span
              className={cn(
                "absolute left-2.5 pointer-events-none transition-colors duration-200 shrink-0",
                focused
                  ? "text-brand-primary dark:text-[#635BFF]"
                  : "text-slate-500 dark:text-slate-400"
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
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            placeholder={placeholder || label}
            className={cn(
              "w-full rounded-[12px] bg-transparent h-[38px] px-2.5 text-[14px] text-slate-900 placeholder-slate-400/60 focus:outline-none dark:text-slate-100 dark:placeholder-slate-600",
              icon ? "pl-8.5" : "px-3",
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
        </div>
        {error && (
          <span
            id={`${inputId}-error`}
            role="alert"
            className="text-[12px] font-medium text-red-500 dark:text-rose-400 flex items-center gap-1 mt-1 pl-0.5"
          >
            <AlertCircle className="w-3.5 h-3.5 text-red-500 dark:text-rose-400 shrink-0" />
            {error}
          </span>
        )}
      </div>
    );
  }
);

FormInput.displayName = "FormInput";

