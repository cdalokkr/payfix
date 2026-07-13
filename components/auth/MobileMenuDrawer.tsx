"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import BrandPanel from "@/components/brand/BrandPanel";

export default function MobileMenuDrawer({
  open,
  onClose,
  variant = "login",
}: {
  open: boolean;
  onClose: () => void;
  variant?: "login" | "register";
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="auth-bg fixed inset-y-0 left-0 z-50 w-[86%] max-w-sm overflow-y-auto shadow-2xl lg:hidden"
          >
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm dark:bg-slate-800/80 cursor-pointer z-10"
            >
              <X size={16} />
            </button>
            <BrandPanel variant={variant} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
