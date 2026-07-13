"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-7 h-7" />;

  const dark = theme === "dark";
  const toggle = () => {
    setTheme(dark ? "light" : "dark");
  };

  return (
    <button
      onClick={toggle}
      className="relative w-7 h-7 rounded-lg flex items-center justify-center
        bg-white/60 dark:bg-white/5 backdrop-blur-md
        border border-black/[0.04] dark:border-white/[0.06]
        shadow-sm hover:shadow-md
        transition-all duration-300 cursor-pointer
        focus-ring"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <AnimatePresence mode="wait">
        {dark ? (
          <motion.div
            key="moon"
            initial={{ rotate: -90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <Moon className="w-3.5 h-3.5 text-amber-300" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ rotate: 90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: -90, scale: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <Sun className="w-3.5 h-3.5 text-slate-600" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
