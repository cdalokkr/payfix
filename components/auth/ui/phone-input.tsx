"use client";

import { useState, useRef, useEffect, useCallback, type InputHTMLAttributes } from "react";
import { ChevronDown, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PHONE_COUNTRY_CODES } from "@/lib/data/countries";

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
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const inputId = id ?? "phone";
  const selected = PHONE_COUNTRY_CODES.find((c) => c.code === countryCode) ?? PHONE_COUNTRY_CODES[0];
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const filteredCountries = PHONE_COUNTRY_CODES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search) ||
      c.iso.toLowerCase().includes(search.toLowerCase())
  );

  // Fixed-position dropdown
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < 260 && rect.top > 260;
    setDropStyle({
      position: "fixed" as const,
      left: rect.left,
      width: 240,
      ...(dropUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="w-full">
      {/* Static label */}
      <label
        htmlFor={inputId}
        className={cn(
          "block text-[13px] font-medium mb-1.5 transition-colors duration-200",
          focused
            ? "text-brand-primary"
            : "text-slate-600 dark:text-slate-400"
        )}
      >
        {label}
      </label>
      <div
        className={cn(
          "glass-input relative flex items-center rounded-[12px] h-[38px] overflow-hidden transition-all duration-300",
          focused && "border-brand-primary ring-[3px] ring-brand-primary/10",
          error && "border-red-400 ring-[3px] ring-red-400/10",
          !focused && !error && "hover:border-slate-300 dark:hover:border-slate-700"
        )}
      >
        {/* Country code selector */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-1.5 h-full pl-3 pr-2.5 border-r transition-colors duration-200 cursor-pointer shrink-0 border-slate-200/60 dark:border-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50/50 dark:hover:bg-slate-950/30",
            focused && "text-brand-primary"
          )}
        >
          <span className="text-sm">{selected.flag}</span>
          <span className="text-[12px] font-semibold">{selected.code}</span>
          <ChevronDown size={11} className="opacity-60 transition-transform duration-200" />
        </button>

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

        {/* Fixed-position country dropdown */}
        <AnimatePresence>
          {open && (
            <motion.div
              ref={dropRef}
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={dropStyle}
              className="z-[100] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-64"
            >
              {/* Search input */}
              <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 bg-slate-50/50 dark:bg-slate-950/50">
                <Search size={13} className="text-slate-400 shrink-0 ml-1" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search country or code..."
                  className="w-full text-[12px] bg-transparent outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                  autoFocus
                />
              </div>

              {/* Country list */}
              <div className="overflow-y-auto flex-1 divide-y divide-slate-50 dark:divide-slate-800/40">
                {filteredCountries.map((c) => (
                  <button
                    key={c.code + c.name}
                    type="button"
                    onClick={() => {
                      onCountryChange?.(c.code);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-[12px] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left",
                      c.code === countryCode &&
                        "bg-brand-light/30 dark:bg-brand-primary/10 text-brand-primary font-semibold"
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 4 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2 }}
            className="text-[12px] text-red-500 overflow-hidden pl-1"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
