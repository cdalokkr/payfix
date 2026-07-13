"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/auth/ui/button";

const CONFETTI_COLORS = [
  "#2563EB",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#818CF8",
  "#F472B6",
  "#06B6D4",
  "#A78BFA",
];

function ConfettiPiece({
  color,
  left,
  delay,
  duration,
  size,
}: {
  color: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
}) {
  return (
    <motion.div
      initial={{ y: -60, x: 0, rotate: 0, opacity: 1 }}
      animate={{
        y: 600,
        x: [0, Math.random() * 80 - 40, Math.random() * 60 - 30],
        rotate: Math.random() * 720,
        opacity: [1, 1, 0],
      }}
      transition={{ duration, delay, ease: "easeIn" }}
      style={{
        position: "absolute",
        left: `${left}%`,
        top: -20,
        width: size,
        height: size * (Math.random() > 0.5 ? 1.5 : 1),
        borderRadius: Math.random() > 0.5 ? "50%" : 2,
        background: color,
      }}
    />
  );
}

export default function SuccessStep({ slug }: { slug?: string }) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(true), 200);
    return () => clearTimeout(t);
  }, []);

  const pieces = useMemo(
    () =>
      Array.from({ length: 35 }).map((_, i) => ({
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2 + Math.random() * 2,
        size: 6 + Math.random() * 6,
      })),
    []
  );

  return (
    <div className="relative text-center overflow-hidden py-4">
      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {pieces.map((p, i) => (
            <ConfettiPiece key={i} {...p} />
          ))}
        </div>
      )}

      {/* Shield icon with glow */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 20,
          delay: 0.1,
        }}
        className="relative mx-auto mb-6"
      >
        <div className="absolute inset-0 m-auto w-28 h-28 rounded-full bg-brand-primary/10 blur-xl" />
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary/10 to-blue-100/50 dark:from-brand-primary/20 dark:to-blue-900/30">
          <ShieldCheck
            size={48}
            className="text-brand-primary"
            strokeWidth={1.5}
          />
        </div>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="text-[22px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white"
      >
        Account Created Successfully! 🎉
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="text-[14px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed max-w-[320px] mx-auto"
      >
        Your account has been created. You can now sign in and start managing
        your workforce.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="mt-8"
      >
        <Link href={slug ? `/login?tenant=${slug}` : "/login"}>
          <Button type="button" className="group">
            <span className="flex items-center justify-center gap-2">
              Go to Sign In
              <ArrowRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </span>
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
