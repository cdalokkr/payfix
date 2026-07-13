"use client";

import { motion } from "framer-motion";
import {
  Wallet,
  CalendarDays,
  ClipboardCheck,
  Users,
  Bell,
  BarChart3,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

const item = (delay: number) => ({
  initial: { opacity: 0, y: 14, scale: 0.94 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
});

const AVATARS = [
  { initials: "AK", bg: "bg-indigo-500" },
  { initials: "SR", bg: "bg-emerald-500" },
  { initials: "PM", bg: "bg-amber-500" },
  { initials: "RJ", bg: "bg-rose-500" },
];

export default function FloatingWidgets({
  variant = "login",
}: {
  variant?: "login" | "register";
}) {
  if (variant === "register") {
    return <RegisterWidgets />;
  }
  return <LoginWidgets />;
}

/* ──────────────── LOGIN WIDGETS ──────────────── */
function LoginWidgets() {
  return (
    <div className="relative w-full select-none space-y-2.5">
      {/* Widget 1 — Attendance */}
      <motion.div
        {...item(0.2)}
        style={{ rotate: -1.5 }}
        className="relative"
      >
        <div className="widget-card p-3 hover:shadow-lg hover:shadow-blue-500/8 transition-shadow duration-300">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Today&apos;s Attendance
          </p>
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center h-[44px] w-[44px]">
              <svg className="absolute w-full h-full -rotate-90">
                <circle cx="22" cy="22" r="18" stroke="currentColor" strokeWidth="4" className="text-slate-100 dark:text-slate-800" fill="transparent" />
                <circle cx="22" cy="22" r="18" stroke="currentColor" strokeWidth="4" strokeDasharray={2 * Math.PI * 18} strokeDashoffset={2 * Math.PI * 18 * (1 - 0.82)} className="text-brand-primary" fill="transparent" strokeLinecap="round" />
              </svg>
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">82%</span>
            </div>
            <div className="space-y-0.5 text-[8px] font-medium text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Present 156
              </div>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />Absent 34
              </div>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Late 11
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Widget 2 — Payroll */}
      <motion.div
        {...item(0.3)}
        style={{ rotate: 1 }}
        className="relative"
      >
        <div className="widget-card p-3 hover:shadow-lg hover:shadow-blue-500/8 transition-shadow duration-300">
          <div className="flex items-center justify-between mb-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 text-brand-primary dark:bg-brand-primary/10 dark:text-blue-300">
              <Wallet size={11} />
            </span>
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">+12.5%</span>
          </div>
          <p className="text-[8px] font-medium text-slate-400 dark:text-slate-500">Payroll</p>
          <p className="text-[16px] font-bold text-slate-800 dark:text-slate-200 tracking-tight leading-tight">₹24.8L</p>
          <div className="mt-1 h-5 w-full">
            <svg viewBox="0 0 140 20" className="h-full w-full text-brand-primary">
              <defs>
                <linearGradient id="sf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 16 Q18 10, 35 14 T70 7 T105 9 T140 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M0 16 Q18 10, 35 14 T70 7 T105 9 T140 2 L140 20 L0 20Z" fill="url(#sf)" />
            </svg>
          </div>
        </div>
      </motion.div>

      {/* Widget 3 — Notification */}
      <motion.div {...item(0.4)} style={{ rotate: -0.6 }}>
        <div className="widget-card p-2.5 flex items-center gap-2 hover:shadow-lg hover:shadow-blue-500/8 transition-shadow duration-300">
          <div className="relative">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-brand-primary dark:bg-brand-primary/10 dark:text-blue-300">
              <Bell size={11} />
            </span>
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-brand-primary ring-[1.5px] ring-white dark:ring-slate-900" />
          </div>
          <div>
            <p className="text-[9px] font-medium text-slate-700 dark:text-slate-200">New payslip generated</p>
            <p className="text-[8px] text-slate-400">2 min ago</p>
          </div>
        </div>
      </motion.div>

      {/* Widget 4 — Team */}
      <motion.div {...item(0.5)} style={{ rotate: 0.5 }}>
        <div className="widget-card p-2.5 flex items-center gap-2 hover:shadow-lg hover:shadow-blue-500/8 transition-shadow duration-300">
          <div className="flex items-center">
            {AVATARS.map((a, i) => (
              <span
                key={a.initials}
                style={{ marginLeft: i === 0 ? 0 : -6, zIndex: AVATARS.length - i }}
                className={`relative flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-white dark:border-slate-900 text-[8px] font-bold text-white shadow-sm ${a.bg}`}
              >
                {a.initials}
              </span>
            ))}
          </div>
          <div>
            <p className="text-[9px] font-medium text-slate-600 dark:text-slate-300">+48 more</p>
            <p className="text-[7px] text-slate-400 flex items-center gap-0.5">
              <Users size={7} /> Online
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ──────────────── REGISTER WIDGETS ──────────────── */
function RegisterWidgets() {
  return (
    <div className="relative w-full select-none space-y-2.5">
      {/* Widget 1 — Analytics */}
      <motion.div
        {...item(0.2)}
        style={{ rotate: 1 }}
        className="relative"
      >
        <div className="widget-card p-3 hover:shadow-lg hover:shadow-indigo-500/8 transition-shadow duration-300">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <BarChart3 size={11} />
            </span>
            <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Analytics</p>
          </div>
          <div className="flex items-end gap-1 h-8">
            {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
              <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.5 + i * 0.05, duration: 0.35 }} className="flex-1 rounded-sm bg-indigo-500/80 dark:bg-indigo-400/70" />
            ))}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[8px] text-slate-400">Q2 2026</p>
            <span className="flex items-center gap-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={9} /> +23%
            </span>
          </div>
        </div>
      </motion.div>

      {/* Widget 2 — Tasks */}
      <motion.div {...item(0.3)} style={{ rotate: -0.8 }}>
        <div className="widget-card p-3 hover:shadow-lg hover:shadow-amber-500/8 transition-shadow duration-300">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <ClipboardCheck size={11} />
            </span>
            <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tasks</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center h-9 w-9">
              <svg className="absolute w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="3" className="text-slate-100 dark:text-slate-800" fill="transparent" />
                <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="3" strokeDasharray={2 * Math.PI * 14} strokeDashoffset={2 * Math.PI * 14 * (1 - 0.68)} className="text-amber-500" fill="transparent" strokeLinecap="round" />
              </svg>
              <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">68%</span>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">24</p>
              <p className="text-[8px] text-slate-400">Active</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Widget 3 — Leave */}
      <motion.div {...item(0.4)} style={{ rotate: 0.7 }}>
        <div className="widget-card p-3 hover:shadow-lg hover:shadow-violet-500/8 transition-shadow duration-300">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
              <CalendarDays size={11} />
            </span>
            <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Leave</p>
          </div>
          <p className="text-[18px] font-bold text-slate-800 dark:text-slate-100 leading-none">12 <span className="text-[10px] font-normal text-slate-400">days</span></p>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: "60%" }} transition={{ delay: 0.8, duration: 0.8 }} className="h-full bg-violet-500 rounded-full" />
          </div>
        </div>
      </motion.div>

      {/* Widget 4 — Security */}
      <motion.div {...item(0.5)} style={{ rotate: -0.4 }}>
        <div className="widget-card p-2.5 flex items-center gap-2 hover:shadow-lg hover:shadow-emerald-500/8 transition-shadow duration-300">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <ShieldCheck size={12} />
          </span>
          <div>
            <p className="text-[9px] font-medium text-slate-700 dark:text-slate-200">Enterprise security</p>
            <p className="text-[8px] text-slate-400">256-bit encryption</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
