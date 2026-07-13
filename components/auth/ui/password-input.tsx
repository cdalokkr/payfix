"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, Lock, CircleCheck, Circle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "placeholder"> {
  label: string;
  error?: string;
  showStrength?: boolean;
}

function getStrength(val: string) {
  const checks = {
    length: val.length >= 8,
    upper: /[A-Z]/.test(val),
    lower: /[a-z]/.test(val),
    number: /[0-9]/.test(val),
    special: /[^A-Za-z0-9]/.test(val),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { checks, score };
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, showStrength = false, className, id, value, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const [visible, setVisible] = useState(false);
    const inputId = id ?? "password";
    const val = typeof value === "string" ? value : "";
    const { checks, score } = getStrength(val);

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
      <div className="w-full">
        {/* Static label */}
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
            focused && "border-brand-primary ring-[3px] ring-brand-primary/10",
            error && "border-red-400 ring-[3px] ring-red-400/10",
            !focused && !error && "hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <span
            className={cn(
              "absolute left-2.5 pointer-events-none transition-colors duration-200",
              focused
                ? "text-brand-primary"
                : "text-slate-800 dark:text-slate-300"
            )}
            aria-hidden
          >
            <Lock size={16} />
          </span>
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
            placeholder={label}
            className={cn(
              "w-full rounded-[12px] bg-transparent h-[38px] pl-8.5 pr-9.5 text-[14px] text-slate-900 placeholder-slate-400/60 focus:outline-none dark:text-slate-100 dark:placeholder-slate-600",
              className
            )}
            aria-invalid={!!error}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg cursor-pointer"
            tabIndex={-1}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
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

        {showStrength && (
          <div className="mt-2.5 space-y-2.5">
            {val.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="strength-meter flex-1">
                  <div
                    className={cn("strength-fill", strengthColor)}
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
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {[
                { key: "length", label: "At least 8 characters" },
                { key: "upper", label: "One uppercase (A-Z)" },
                { key: "lower", label: "One lowercase (a-z)" },
                { key: "number", label: "One number (0-9)" },
                { key: "special", label: "One special (!@#$)" },
              ].map(({ key, label: ruleLabel }) => {
                const met = checks[key as keyof typeof checks];
                return (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] transition-colors duration-200",
                      met
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-400 dark:text-slate-500/80"
                    )}
                  >
                    {met ? (
                      <CircleCheck size={12} className="shrink-0" />
                    ) : (
                      <Circle size={12} className="shrink-0" />
                    )}
                    <span>{ruleLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
