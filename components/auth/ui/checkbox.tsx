"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps
  extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, "onChange"> {
  label?: React.ReactNode;
  onCheckedChange?: (checked: boolean | "indeterminate") => void;
  onChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, checked, onChange, onCheckedChange, ...props }, ref) => {
  const handleChange = (val: boolean | "indeterminate") => {
    onCheckedChange?.(val);
    if (onChange) {
      onChange(val === true);
    }
  };

  const checkboxNode = (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      onCheckedChange={handleChange}
      className={cn(
        "peer size-[18px] shrink-0 rounded-md border border-slate-300 transition-all outline-none focus-visible:border-brand-primary focus-visible:ring-[3px] focus-visible:ring-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-brand-primary data-[state=checked]:bg-brand-primary data-[state=checked]:text-white shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700 cursor-pointer",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-content-center text-current transition-none">
        <Check size={11} strokeWidth={3} className="text-white" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (label) {
    return (
      <label
        className={cn(
          "flex cursor-pointer select-none items-center gap-2.5 text-[13px] text-slate-600 dark:text-slate-400",
          className
        )}
      >
        {checkboxNode}
        <span>{label}</span>
      </label>
    );
  }

  return checkboxNode;
});

Checkbox.displayName = "Checkbox";

export { Checkbox };
