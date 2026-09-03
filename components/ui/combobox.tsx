"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  value: string
  label: string
  icon?: React.ReactNode
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onSelect: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
}

export function Combobox({
  options,
  value,
  onSelect,
  placeholder = "Select option...",
  searchPlaceholder = "Search options...",
  emptyText = "No option found.",
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const listboxId = React.useId()

  const selectedOption = options.find((option) => option.value === value)

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options
    return options.filter((option) =>
      option.label.toLowerCase().includes(search.toLowerCase())
    )
  }, [options, search])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
            role="combobox"
            aria-controls={listboxId}
          aria-expanded={open}
          className={cn(
            "w-full h-[38px] px-3 bg-white dark:bg-[#0B131A] border border-gray-200/90 dark:border-slate-700/80 rounded-[12px] text-xs text-slate-900 dark:text-slate-100 outline-none flex items-center justify-between gap-2 shadow-xs transition-all duration-200 focus:ring-[3px] focus:ring-indigo-500/10 focus:border-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
            !selectedOption && "text-slate-400 dark:text-slate-500 font-normal",
            className
          )}
        >
          <span className="truncate flex items-center gap-1.5">
            {selectedOption?.icon && (
              <span className="shrink-0 flex items-center">{selectedOption.icon}</span>
            )}
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50 text-slate-400 dark:text-slate-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-1.5 bg-white dark:bg-[#121B22] border border-gray-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-[14px] shadow-xl z-50">
        {options.length > 5 && (
          <div className="flex items-center border-b border-gray-100 dark:border-slate-800 px-2.5 pb-1.5 pt-1">
            <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full text-xs bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100"
            />
          </div>
        )}
        <div id={listboxId} role="listbox" className="max-h-48 overflow-y-auto py-1 space-y-0.5">
          {filteredOptions.length === 0 ? (
            <p className="p-2 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">{emptyText}</p>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onSelect(option.value)
                  setOpen(false)
                  setSearch("")
                }}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer",
                  value === option.value
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                )}
              >
                <span className="truncate flex items-center gap-1.5">
                  {option.icon && (
                    <span className="shrink-0 flex items-center">{option.icon}</span>
                  )}
                  {option.label}
                </span>
                {value === option.value && (
                  <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 ml-1.5" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
