"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Personal", "Company", "Security"];

export default function Stepper({ current }: { current: number }) {
  return (
    <div className="mx-auto mb-3 flex w-full max-w-sm items-center justify-between select-none">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const isDone = step < current;
        const isActive = step === current;

        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5 relative">
              {/* Step circle */}
              <motion.div
                animate={{ scale: isActive ? 1.1 : 1 }}
                transition={{ type: "spring", stiffness: 450, damping: 22 }}
                className={cn(
                  "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-[11px] sm:text-[12px] font-bold transition-all duration-300",
                  isDone &&
                    "bg-brand-primary text-white shadow-sm shadow-blue-500/20",
                  isActive &&
                    "bg-brand-primary text-white ring-[3px] ring-brand-primary/[0.18] shadow-sm shadow-blue-500/20",
                  !isDone &&
                    !isActive &&
                    "bg-slate-100/80 text-slate-400 border border-slate-200/60 dark:bg-slate-900/60 dark:text-slate-500 dark:border-slate-800/80"
                )}
              >
                {isDone ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 20,
                    }}
                  >
                    <Check size={13} strokeWidth={3} />
                  </motion.div>
                ) : (
                  <span>{step}</span>
                )}
              </motion.div>

              {/* Step label */}
              <span
                className={cn(
                  "text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider transition-colors duration-300",
                  isActive && "text-brand-primary",
                  isDone && "text-slate-500 dark:text-slate-400",
                  !isDone && !isActive && "text-slate-400 dark:text-slate-600"
                )}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {step !== STEPS.length && (
              <div className="mx-2 sm:mx-3 h-[2px] flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <motion.div
                  initial={false}
                  animate={{ width: isDone ? "100%" : "0%" }}
                  transition={{ duration: 0.45, ease: "easeInOut" }}
                  className="h-full bg-brand-primary"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
