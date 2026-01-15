"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import React from "react"

export type MetricTheme = 'primary' | 'emerald' | 'amber' | 'rose' | 'blue' | 'indigo' | 'purple' | 'red' | 'green' | 'orange'

interface CompactMetricCardProps {
    label: string
    value: string | number
    icon: any // Lucide or Phosphor icon
    theme?: MetricTheme
    loading?: boolean
    delay?: number
    className?: string
}

const THEME_MAP: Record<MetricTheme, { color: string; bg: string; border: string; hoverBg: string; hoverBorder: string }> = {
    primary: { color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", hoverBg: "hover:bg-primary/8", hoverBorder: "hover:border-primary/40" },
    emerald: { color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/20", hoverBg: "hover:bg-emerald-500/8", hoverBorder: "hover:border-emerald-500/40" },
    amber: { color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/20", hoverBg: "hover:bg-amber-500/8", hoverBorder: "hover:border-amber-500/40" },
    rose: { color: "text-rose-600", bg: "bg-rose-500/10", border: "border-rose-500/20", hoverBg: "hover:bg-rose-500/8", hoverBorder: "hover:border-rose-500/40" },
    blue: { color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-500/20", hoverBg: "hover:bg-blue-500/8", hoverBorder: "hover:border-blue-500/40" },
    indigo: { color: "text-indigo-600", bg: "bg-indigo-500/10", border: "border-indigo-500/20", hoverBg: "hover:bg-indigo-500/8", hoverBorder: "hover:border-indigo-500/40" },
    purple: { color: "text-purple-600", bg: "bg-purple-500/10", border: "border-purple-500/20", hoverBg: "hover:bg-purple-500/8", hoverBorder: "hover:border-purple-500/40" },
    red: { color: "text-red-600", bg: "bg-red-500/10", border: "border-red-500/20", hoverBg: "hover:bg-red-500/8", hoverBorder: "hover:border-red-500/40" },
    green: { color: "text-green-600", bg: "bg-green-500/10", border: "border-green-500/20", hoverBg: "hover:bg-green-500/8", hoverBorder: "hover:border-green-500/40" },
    orange: { color: "text-orange-600", bg: "bg-orange-500/10", border: "border-orange-500/20", hoverBg: "hover:bg-orange-500/8", hoverBorder: "hover:border-orange-500/40" },
}

export function CompactMetricCard({
    label,
    value,
    icon: Icon,
    theme = 'primary',
    loading = false,
    delay = 0,
    className
}: CompactMetricCardProps) {
    const { color, bg, border, hoverBg, hoverBorder } = THEME_MAP[theme]

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            transition={{ delay }}
            className={cn(
                "flex flex-col p-3 rounded-xl border transition-all duration-300",
                "bg-background/40 hover:bg-background/80",
                "group cursor-default shadow-sm w-full",
                border,
                hoverBg,
                hoverBorder,
                className
            )}
        >
            <div className="flex items-center justify-between mb-2">
                <div className={cn(
                    "p-1.5 rounded-lg transition-transform duration-300 group-hover:scale-110",
                    bg,
                    color
                )}>
                    {/* Handle both Phosphor (with weight) and Lucide icons */}
                    {React.isValidElement(Icon) ? (
                        Icon
                    ) : (
                        <Icon size={28} weight="duotone" className="h-7 w-7" />
                    )}
                </div>
                {loading ? (
                    <div className="h-8 w-12 bg-muted/30 rounded-md animate-pulse self-center" />
                ) : (
                    <span className={cn("text-2xl font-black tabular-nums tracking-tight", color)}>{value}</span>
                )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
                {label}
            </p>
        </motion.div>
    )
}
