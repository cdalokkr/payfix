"use client";

import React, { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormPasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  showStrength?: boolean;
}

export function getPasswordStrength(val: string) {
  const checks = {
    length: val.length >= 8,
    upper: /[A-Z]/.test(val),
    lower: /[a-z]/.test(val),
    number: /[0-9]/.test(val),
    special: /[^A-Za-z0-9]/.test(val),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const isValid = score === 5;
  return { checks, score, isValid };
}

export const FormPasswordInput = forwardRef<HTMLInputElement, FormPasswordInputProps>(
  ({ label, error, showStrength = false, className, id, value, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const [visible, setVisible] = useState(false);
    const inputId = id ?? label.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const val = typeof value === "string" ? value : "";
    const { checks, score } = getPasswordStrength(val);

    const strengthColor =
      score <= 1
        ? "bg-red-500"
        : score <= 2
          ? "bg-amber-500"
          : score <= 3
            ? "bg-yellow-500"
            : score <= 4
              ? "bg-emerald-400"
              : "bg-emerald-500";

    const strengthLabel =
      score <= 1 ? "Weak" : score <= 2 ? "Fair" : score <= 3 ? "Good" : score <= 4 ? "Strong" : "Excellent";

    return (
      <div className="w-full text-left">
        {/* Label */}
        <label
          htmlFor={inputId}
          className={cn(
            "block text-[13px] font-medium mb-1.5 transition-colors duration-200",
            focused ? "text-brand-primary dark:text-[#635BFF]" : "text-slate-600 dark:text-slate-400"
          )}
        >
          {label}
        </label>

        {/* Input Container */}
        <div
          className={cn(
            "relative flex items-center rounded-[12px] h-[38px] transition-all duration-300 border bg-white dark:bg-[#0B131A]",
            focused && "border-brand-primary dark:border-[#635BFF] ring-[3px] ring-brand-primary/10 dark:ring-[#635BFF]/10",
            error && "border-red-400 dark:border-rose-500 ring-[3px] ring-red-400/10",
            !focused && !error && "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            value={value}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            placeholder={props.placeholder || label}
            className={cn(
              "w-full rounded-[12px] bg-transparent h-full px-3 pr-10 text-[14px] text-slate-900 placeholder-slate-400/60 focus:outline-none dark:text-slate-100 dark:placeholder-slate-600 font-normal",
              className
            )}
            aria-invalid={!!error}
            {...props}
          />

          {/* Password View/Hide Toggle Icon Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setVisible(!visible);
            }}
            className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg cursor-pointer focus:outline-none"
            tabIndex={-1}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Inline Error Message */}
        {error && (
          <span
            role="alert"
            className="text-[12px] font-medium text-red-500 dark:text-rose-400 flex items-center gap-1 mt-1 pl-0.5"
          >
            {error}
          </span>
        )}

        {/* Real-time Strength Meter & Signup Step 3 Validation Checklist */}
        {showStrength && val.length > 0 && (
          <div className="mt-2.5 space-y-2 p-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 rounded-xl">
            {/* Strength Bar */}
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full transition-all duration-300 rounded-full", strengthColor)}
                  style={{ width: `${score * 20}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  score <= 1
                    ? "text-red-500"
                    : score <= 2
                      ? "text-amber-500"
                      : score <= 3
                        ? "text-yellow-600 dark:text-yellow-500"
                        : score <= 4
                          ? "text-emerald-500"
                          : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {strengthLabel}
              </span>
            </div>

            {/* Checklist Items */}
            <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
              <div className={cn("flex items-center gap-1.5", checks.length ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500")}>
                {checks.length ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                <span>8+ Characters</span>
              </div>
              <div className={cn("flex items-center gap-1.5", checks.upper ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500")}>
                {checks.upper ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                <span>1 Uppercase (A-Z)</span>
              </div>
              <div className={cn("flex items-center gap-1.5", checks.lower ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500")}>
                {checks.lower ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                <span>1 Lowercase (a-z)</span>
              </div>
              <div className={cn("flex items-center gap-1.5", checks.number ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500")}>
                {checks.number ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                <span>1 Number (0-9)</span>
              </div>
              <div className={cn("flex items-center gap-1.5 col-span-2", checks.special ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500")}>
                {checks.special ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                <span>1 Special Symbol (!@#$%^&*)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

FormPasswordInput.displayName = "FormPasswordInput";
export default FormPasswordInput;
