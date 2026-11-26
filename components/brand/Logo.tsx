"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Global Master Platform / App Brand Logo
 * Exclusively for Public Areas (Login, Register, Landing, etc.)
 * Strictly isolated from any tenant's private logo.
 */
export default function Logo({
  className,
  showText = true,
  size = "md",
}: LogoProps) {
  const [imgError, setImgError] = useState(false);

  // Future master platform logo (configured via environment or global assets)
  const masterAppLogoUrl = process.env.NEXT_PUBLIC_APP_LOGO_URL || null;

  const sizeClasses = {
    sm: { box: "h-7 w-7", text: "text-base", icon: "text-xs" },
    md: { box: "h-9 w-9", text: "text-xl", icon: "text-sm" },
    lg: { box: "h-11 w-11", text: "text-2xl", icon: "text-base" },
  }[size];

  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      {masterAppLogoUrl && !imgError ? (
        <div
          className={cn(
            "relative flex items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md",
            sizeClasses.box
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={masterAppLogoUrl}
            alt="NIYAMO Platform"
            onError={() => setImgError(true)}
            className="w-full h-full object-contain p-1"
          />
        </div>
      ) : (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white shadow-lg shadow-blue-600/25",
            sizeClasses.box
          )}
        >
          <span className={cn("font-black tracking-tighter leading-none select-none text-white", sizeClasses.icon)}>
            N
          </span>
        </div>
      )}

      {showText && (
        <span
          className={cn(
            "font-bold tracking-tight text-slate-900 dark:text-white",
            sizeClasses.text
          )}
        >
          NI<span className="text-brand-primary">YAMO</span>
        </span>
      )}
    </div>
  );
}
