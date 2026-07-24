"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DatePicker({
  date,
  setDate,
  placeholder = "Pick a date",
  className,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "w-full h-[38px] px-3 bg-white dark:bg-[#0B131A] border border-gray-200/90 dark:border-slate-700/80 rounded-[12px] text-xs text-slate-900 dark:text-slate-100 outline-none flex items-center justify-between gap-2 shadow-xs transition-all duration-200 focus:ring-[3px] focus:ring-indigo-500/10 focus:border-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
            !date && "text-slate-400 dark:text-slate-500 font-normal",
            className
          )}
        >
          <span className="truncate">
            {date ? format(date, "PPP") : placeholder}
          </span>
          <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0 bg-transparent border-0 shadow-none z-50">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          captionLayout="dropdown"
          onSelect={(d) => {
            setDate(d)
            setOpen(false)
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
