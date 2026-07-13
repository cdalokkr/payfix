"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 text-[14px] font-semibold tracking-[-0.01em] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 select-none cursor-pointer w-full",
  {
    variants: {
      variant: {
        default: "btn-primary h-[38px] rounded-[10px] text-white",
        secondary:
          "h-[38px] rounded-[10px] border border-slate-200/80 bg-white/70 backdrop-blur-md text-slate-700 hover:bg-slate-50 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-950/80",
        ghost:
          "h-[38px] rounded-[10px] text-brand-primary hover:bg-brand-light/30 dark:hover:bg-brand-primary/10",
        link: "text-brand-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps
  extends Omit<React.ComponentProps<typeof motion.button>, "children">,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      loading = false,
      fullWidth = true,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ y: disabled || loading ? 0 : -1 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
        transition={{ type: "spring", stiffness: 450, damping: 25 }}
        disabled={disabled || loading}
        className={cn(
          buttonVariants({ variant, size, className }),
          !fullWidth && "w-auto"
        )}
        {...props}
      >
        {loading && <Loader2 size={16} className="animate-spin text-current" />}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
