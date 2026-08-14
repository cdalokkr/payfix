"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppButtonVariant =
  | "primary"
  | "save-superadmin"
  | "success"
  | "cancel"
  | "secondary"
  | "outline"
  | "destructive";

export interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppButtonVariant;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<AppButtonVariant, string> = {
  primary:
    "bg-[#635BFF] hover:bg-[#5249ea] text-white shadow-xs hover:shadow-md border border-transparent",
  "save-superadmin":
    "btn-save-superadmin border border-transparent",
  success:
    "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-md border border-transparent",
  cancel:
    "bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60",
  secondary:
    "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-transparent",
  outline:
    "bg-white dark:bg-[#0B131A] hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700",
  destructive:
    "bg-red-600 hover:bg-red-700 text-white shadow-xs hover:shadow-md border border-transparent",
};

export const AppButton = React.forwardRef<HTMLButtonElement, AppButtonProps>(
  (
    {
      variant = "primary",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "h-[38px] px-4 font-semibold text-xs sm:text-sm rounded-[12px] flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none",
          fullWidth && "w-full",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && (
          <span className="shrink-0 flex items-center">{rightIcon}</span>
        )}
      </button>
    );
  }
);

AppButton.displayName = "AppButton";
