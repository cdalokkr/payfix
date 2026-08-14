"use client";

import { useState, useMemo, type InputHTMLAttributes } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { PHONE_COUNTRY_CODES } from "@/lib/data/countries";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface PhoneInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "placeholder"> {
  label: string;
  error?: string;
  countryCode?: string;
  onCountryChange?: (code: string) => void;
}

export default function PhoneInput({
  label,
  error,
  countryCode = "+91",
  onCountryChange,
  className,
  id,
  value,
  ...props
}: PhoneInputProps) {
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputId = id ?? "phone";
  const selected = PHONE_COUNTRY_CODES.find((c) => c.code === countryCode) ?? PHONE_COUNTRY_CODES[0];

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return PHONE_COUNTRY_CODES;
    const q = search.toLowerCase();
    return PHONE_COUNTRY_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.includes(q) ||
        c.iso.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="w-full text-left">
      {/* Static label */}
      <label
        htmlFor={inputId}
        className={cn(
          "block text-[13px] font-medium mb-1.5 transition-colors duration-200",
          focused
            ? "text-brand-primary dark:text-[#635BFF]"
            : "text-slate-600 dark:text-slate-400"
        )}
      >
        {label}
      </label>
      <div
        className={cn(
          "glass-input relative flex items-center rounded-[12px] h-[38px] transition-all duration-300 border bg-white dark:bg-[#0B131A]",
          focused && "border-brand-primary dark:border-[#635BFF] ring-[3px] ring-brand-primary/10 dark:ring-[#635BFF]/10",
          error && "border-red-400 dark:border-rose-500 ring-[3px] ring-red-400/10",
          !focused && !error && "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        )}
      >
        {/* Country code selector button using Radix Popover */}
        <Popover open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) setSearch("");
        }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 h-full pl-3 pr-2.5 border-r transition-colors duration-200 cursor-pointer shrink-0 border-slate-200/60 dark:border-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 rounded-l-[12px] outline-none",
                focused && "text-brand-primary dark:text-[#635BFF]"
              )}
            >
              <span className="text-sm">{selected.flag}</span>
              <span className="text-[12px] font-semibold">{selected.code}</span>
              <ChevronDown size={11} className={cn("opacity-60 transition-transform duration-200", open && "rotate-180")} />
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            sideOffset={4}
            className="w-[260px] p-0 bg-white dark:bg-[#121B22] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-2xl z-[9999] overflow-hidden flex flex-col max-h-64"
          >
            {/* Search input */}
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 bg-slate-50/70 dark:bg-slate-900/70">
              <Search size={13} className="text-slate-400 shrink-0 ml-1" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country or code..."
                className="w-full text-[12px] bg-transparent outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
              />
            </div>

            {/* Country list */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-50 dark:divide-slate-800/40 max-h-52">
              {filteredCountries.map((c) => (
                <button
                  key={c.code + c.name}
                  type="button"
                  onClick={() => {
                    onCountryChange?.(c.code);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-[12px] hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer text-left",
                    c.code === countryCode &&
                      "bg-brand-light/30 dark:bg-brand-primary/10 text-brand-primary dark:text-[#635BFF] font-semibold"
                  )}
                >
                  <span className="text-sm">{c.flag}</span>
                  <span className="text-slate-700 dark:text-slate-200 truncate flex-1">{c.name}</span>
                  <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px] shrink-0">{c.code}</span>
                </button>
              ))}
              {filteredCountries.length === 0 && (
                <div className="p-3 text-center text-xs text-slate-400">No country found</div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Phone number input */}
        <input
          id={inputId}
          type="tel"
          value={value}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          placeholder="Phone number"
          maxLength={selected.maxLen}
          className={cn(
            "flex-1 min-w-0 bg-transparent h-full px-2 text-[14px] text-slate-900 placeholder-slate-400/60 focus:outline-none dark:text-slate-100 dark:placeholder-slate-600",
            className
          )}
          aria-invalid={!!error}
          {...props}
        />
      </div>

      {error && (
        <span
          role="alert"
          className="text-[12px] font-medium text-red-500 dark:text-rose-400 flex items-center gap-1 mt-1 pl-0.5"
        >
          {error}
        </span>
      )}
    </div>
  );
}

