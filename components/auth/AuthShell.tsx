"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { motion } from "framer-motion";
import Logo from "@/components/brand/Logo";
import ThemeToggle from "@/components/auth/ui/ThemeToggle";
import MobileMenuDrawer from "./MobileMenuDrawer";
import BrandPanel from "@/components/brand/BrandPanel";
import { ToastProvider } from "@/components/auth/ui/Toast";

export default function AuthShell({
  variant = "login",
  children,
}: {
  variant?: "login" | "register";
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="auth-bg relative min-h-screen min-h-dvh select-none">
      {/* Noise texture overlay */}
      <div className="noise-bg" />

      {/* Floating orb decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-20 -top-20 h-[450px] w-[450px] rounded-full bg-brand-primary/[0.07] blur-[110px] dark:bg-brand-primary/15"
        />
        <motion.div
          animate={{ x: [0, -50, 30, 0], y: [0, 40, -30, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-32 top-1/4 h-[550px] w-[550px] rounded-full bg-indigo-500/[0.06] blur-[130px] dark:bg-indigo-500/[0.12]"
        />
        <motion.div
          animate={{ y: [0, -50, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-100px] left-1/3 h-[400px] w-[400px] rounded-full bg-blue-400/[0.06] blur-[100px] dark:bg-blue-500/10"
        />
      </div>

      {/* Main grid layout — wider left panel (7:5 ratio) */}
      <div className="relative z-10 mx-auto grid min-h-screen min-h-dvh w-full max-w-[1440px] grid-cols-1 lg:grid-cols-[7fr_5fr] lg:p-4">
        {/* Left column — Brand Hero (Desktop only) */}
        <div className="relative hidden overflow-hidden rounded-2xl border border-white/50 bg-white/35 backdrop-blur-[12px] lg:block dark:border-slate-800/40 dark:bg-slate-900/25">
          <div className="h-full overflow-y-auto no-scrollbar">
            <BrandPanel variant={variant} />
          </div>
        </div>

        {/* Right column — Form */}
        <div className="relative flex flex-col min-h-screen min-h-dvh lg:min-h-0">
          {/* Mobile header */}
          <div className="flex items-center justify-between px-5 pt-5 lg:hidden">
            <Logo />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => setMenuOpen(true)}
                aria-label="Open navigation menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white/70 text-slate-600 shadow-sm backdrop-blur-md transition-all hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-900 cursor-pointer"
              >
                <Menu size={15} />
              </button>
            </div>
          </div>

          {/* Mobile hero heading */}
          <div className="px-5 pt-4 pb-5 lg:hidden">
            <h1 className="text-[24px] sm:text-[28px] md:text-[32px] font-bold leading-[1.1] tracking-[-0.025em] text-slate-900 dark:text-white">
              {variant === "login" ? (
                <>
                  Run Your Workforce.
                  <br />
                  <span className="text-brand-primary">Smarter. Faster. Better.</span>
                </>
              ) : (
                <>
                  One Platform.
                  <br />
                  <span className="text-brand-primary">All Your Workforce Needs.</span>
                </>
              )}
            </h1>
            <p className="hidden sm:block text-[13px] sm:text-[14px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              {variant === "login"
                ? "Access attendance, payroll, leave, tasks and HR operations from one secure workspace."
                : "Create your company's secure HR workspace and start managing your workforce in minutes."}
            </p>
          </div>

          {/* Desktop — Theme toggle top right, form starts below it */}
          <div className="hidden lg:flex justify-end px-6 pt-4 pb-0">
            <ThemeToggle />
          </div>

          {/* Form container — starts after theme toggle, scrollable */}
          <div className="flex flex-1 items-start lg:items-center justify-center overflow-y-auto no-scrollbar px-4 py-4 sm:px-6 lg:px-6 lg:py-4">
            <div className="flex w-full justify-center">
              <ToastProvider>{children}</ToastProvider>
            </div>
          </div>
        </div>
      </div>

      <MobileMenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        variant={variant}
      />
    </div>
  );
}
