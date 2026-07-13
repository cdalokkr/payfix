"use client";

import { motion } from "framer-motion";
import { CircleCheck } from "lucide-react";
import Logo from "./Logo";
import FeatureList from "./FeatureList";
import FloatingWidgets from "./FloatingWidgets";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const BENEFITS = [
  "Easy to get started",
  "Secure & Reliable",
  "Scalable for growing teams",
  "Loved by HR & Finance teams",
];

export default function BrandPanel({
  variant = "login",
}: {
  variant?: "login" | "register";
}) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="flex h-full flex-col justify-between p-5 lg:p-6 xl:p-7 select-none"
    >
      {/* Logo */}
      <motion.div variants={fadeUp}>
        <Logo />
      </motion.div>

      {/* Hero Content */}
      <div className="my-auto py-4">


        {/* Heading — full width, responsive sizing */}
        <motion.h1
          variants={fadeUp}
          className="text-[28px] sm:text-[32px] md:text-[34px] lg:text-[38px] xl:text-[44px] font-bold leading-[1.08] tracking-[-0.025em] text-slate-900 dark:text-white"
        >
          {variant === "login" ? (
            <>
              Run Your Workforce.
              <br />
              <span className="text-brand-primary">Smarter. </span>
              <span className="text-brand-primary">Faster. </span>
              <span className="text-brand-primary">Better.</span>
            </>
          ) : (
            <>
              One Platform.
              <br />
              <span className="text-brand-primary">
                All Your Workforce Needs.
              </span>
            </>
          )}
        </motion.h1>

        {/* ─── Description + Key Points (left) | Floating Widgets (right) ─── */}
        <div className="mt-4 grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-x-5 gap-y-4 items-start">
          {/* Left — Description + Key Points stacked */}
          <div>
            <motion.p
              variants={fadeUp}
              className="text-[14px] lg:text-[15px] text-slate-500 dark:text-slate-400 leading-[1.7] max-w-[380px]"
            >
              {variant === "login"
                ? "Access attendance, payroll, leave, tasks and HR operations from one secure workspace."
                : "Join thousands of companies that trust PayFix to simplify their workforce management."}
            </motion.p>

            {/* Key Points — parallel to widgets */}
            <motion.div variants={fadeUp} className="mt-5">
              {variant === "login" ? (
                <FeatureList />
              ) : (
                <div className="space-y-3">
                  {BENEFITS.map((b) => (
                    <div
                      key={b}
                      className="flex items-center gap-2.5 text-[14px] lg:text-[15px] text-slate-600 dark:text-slate-300"
                    >
                      <CircleCheck
                        size={18}
                        className="text-brand-primary shrink-0"
                        strokeWidth={2}
                      />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* Right — Floating Dashboard Widgets */}
          <motion.div variants={fadeUp} className="hidden xl:block w-[220px]">
            <FloatingWidgets variant={variant} />
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <motion.p
        variants={fadeUp}
        className="text-[10px] text-slate-400/70 dark:text-slate-600"
      >
        © {new Date().getFullYear()} PayFix Inc. Enterprise Workforce Platform.
      </motion.p>
    </motion.div>
  );
}
