import { cn } from "@/lib/utils";

export default function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] shadow-lg shadow-blue-600/25">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 21V3H14.5C17.5376 3 20 5.4624 20 8.5C20 11.5376 17.5376 14 14.5 14H11"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        Pay<span className="text-brand-primary">Fix</span>
      </span>
    </div>
  );
}
