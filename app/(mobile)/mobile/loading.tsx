"use client"

import { motion } from "framer-motion"

export default function MobileDashboardLoading() {
    return (
        <div className="space-y-6 pb-4 select-none">
            {/* Today's Status Card Skeleton */}
            <div className="min-h-[235px] rounded-[1.5rem] bg-slate-200/60 dark:bg-slate-900/50 animate-pulse border border-slate-200/40 dark:border-slate-800/40 flex flex-col justify-between p-5">
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        {/* Heading */}
                        <div className="h-3.5 w-28 bg-slate-300 dark:bg-slate-800 rounded-full" />
                        {/* Location Subtitle */}
                        <div className="h-3 w-36 bg-slate-300 dark:bg-slate-800 rounded-full" />
                    </div>
                    {/* Calendar Badge */}
                    <div className="h-12 w-12 bg-slate-300 dark:bg-slate-800 rounded-xl" />
                </div>
                {/* Center Loading Spinner */}
                <div className="flex flex-col items-center justify-center py-4 space-y-2.5">
                    <div className="h-8 w-8 rounded-full border-4 border-slate-300 dark:border-slate-800 border-t-blue-500 animate-spin" />
                    <div className="h-3 w-32 bg-slate-300 dark:bg-slate-800 rounded-full" />
                </div>
            </div>

            {/* Quick Actions Grid Skeleton */}
            <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between px-2">
                    <div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1 ml-4" />
                </div>
                <div className="grid grid-cols-3 gap-3 px-2 pb-4 pt-1">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                            key={i}
                            className="bg-white dark:bg-slate-900/60 p-4 rounded-2xl flex flex-col items-center gap-3 shadow-[0_2px_10px_rgba(0,0,0,0.01)] border border-slate-100 dark:border-slate-800/40 w-full animate-pulse"
                        >
                            {/* Action Icon box */}
                            <div className="w-10 h-10 rounded-[1rem] bg-slate-200 dark:bg-slate-800" />
                            {/* Action Label */}
                            <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
