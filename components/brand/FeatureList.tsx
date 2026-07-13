"use client";

import { motion } from "framer-motion";
import {
  CircleCheck,
  Wallet,
  CalendarDays,
  ClipboardCheck,
  BarChart3,
} from "lucide-react";

const FEATURES = [
  {
    icon: CircleCheck,
    title: "Real-time Attendance",
    desc: "Track presence with accuracy",
  },
  {
    icon: Wallet,
    title: "Payroll & Payslips",
    desc: "Automated salary management",
  },
  {
    icon: CalendarDays,
    title: "Leave Management",
    desc: "Simple leave tracking & approval",
  },
  {
    icon: ClipboardCheck,
    title: "Task & Project Management",
    desc: "Assign, track and complete tasks",
  },
  {
    icon: BarChart3,
    title: "HR Analytics",
    desc: "Powerful insights for better decisions",
  },
];

export default function FeatureList() {
  return (
    <div className="space-y-3">
      {FEATURES.map((f, i) => {
        const Icon = f.icon;
        return (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: 0.25 + i * 0.06,
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 border border-blue-100/60 dark:bg-blue-900/20 dark:border-blue-800/30">
              <Icon size={17} className="text-brand-primary" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-[14px] lg:text-[15px] font-medium text-slate-800 dark:text-slate-200 leading-tight">
                {f.title}
              </p>
              <p className="text-[12px] lg:text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {f.desc}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
