"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
  containerClassName?: string;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, icon, error, containerClassName, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className={cn("flex flex-col gap-1 text-left w-full", containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1"
          >
            {icon && <span className="shrink-0 flex items-center">{icon}</span>}
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "w-full h-[38px] px-3 bg-white dark:bg-[#0B131A] border border-slate-200 dark:border-slate-700 rounded-[12px] text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all focus:ring-[3px] focus:ring-indigo-500/10 focus:border-[#635BFF]",
            error && "border-rose-400 dark:border-rose-500 focus:border-rose-500 focus:ring-rose-500/10",
            className
          )}
          {...props}
        />
        {error && (
          <span className="text-[11px] font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1 mt-0.5">
            <AlertCircle className="w-3 h-3 text-rose-500 dark:text-rose-400 shrink-0" />
            {error}
          </span>
        )}
      </div>
    );
  }
);

FormInput.displayName = "FormInput";
