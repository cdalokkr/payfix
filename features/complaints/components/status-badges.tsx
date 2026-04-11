"use client"

import { cn } from "@/lib/utils"
import type { TicketStatus, TicketPriority, CallLogStatus } from "@/types"

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  open: { label: "Open", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/15", border: "border-blue-200 dark:border-blue-500/30" },
  in_progress: { label: "In Progress", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/15", border: "border-amber-200 dark:border-amber-500/30" },
  resolved: { label: "Resolved", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/15", border: "border-emerald-200 dark:border-emerald-500/30" },
  closed: { label: "Closed", color: "text-slate-700 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-500/15", border: "border-slate-200 dark:border-slate-500/30" },
  cancelled: { label: "Cancelled", color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-500/15", border: "border-rose-200 dark:border-rose-500/30" },
}

const priorityConfig: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  low: { label: "Low", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-500/10", border: "border-slate-200", dot: "bg-slate-400" },
  medium: { label: "Medium", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10", border: "border-blue-200", dot: "bg-blue-500" },
  high: { label: "High", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200", dot: "bg-orange-500" },
  critical: { label: "Critical", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-500/10", border: "border-rose-200", dot: "bg-rose-500 animate-pulse" },
}

const callLogStatusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  done: { label: "Done", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/15", border: "border-emerald-200 dark:border-emerald-500/30" },
  pending: { label: "Pending", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/15", border: "border-amber-200 dark:border-amber-500/30" },
  cancelled: { label: "Cancelled", color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-500/15", border: "border-rose-200 dark:border-rose-500/30" },
}

export function TicketStatusBadge({ status, className }: { status: string | null; className?: string }) {
  const config = statusConfig[status || 'open'] || statusConfig.open
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold tracking-wide border",
      config.color, config.bg, config.border, className
    )}>
      {config.label}
    </span>
  )
}

export function PriorityBadge({ priority, className }: { priority: string | null; className?: string }) {
  const config = priorityConfig[priority || 'medium'] || priorityConfig.medium
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold tracking-wide border",
      config.color, config.bg, config.border, className
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  )
}

export function CallLogStatusBadge({ status, className }: { status: string | null; className?: string }) {
  const config = callLogStatusConfig[status || 'pending'] || callLogStatusConfig.pending
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold tracking-wide border",
      config.color, config.bg, config.border, className
    )}>
      {config.label}
    </span>
  )
}

export function CategoryBadge({ category, className }: { category: string | null; className?: string }) {
  const colors: Record<string, string> = {
    billing: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-400",
    technical: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-400",
    service: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-400",
    product: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/15 dark:text-pink-400",
    general: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400",
  }
  const color = colors[category || 'general'] || colors.general
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold tracking-wide border capitalize", color, className)}>
      {category || 'General'}
    </span>
  )
}
