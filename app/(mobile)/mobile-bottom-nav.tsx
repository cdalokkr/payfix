"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Home as IconHome, ClipboardCheck as IconChecklist, User2 as IconUser, TicketCheck as IconTicket } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

const navItems = [
    {
        href: "/mobile",
        icon: IconHome,
        label: "Home",
    },
    {
        href: "/mobile/tickets",
        icon: IconTicket,
        label: "Tickets",
    },
    {
        href: "/mobile/profile",
        icon: IconUser,
        label: "Profile",
    },
]

export function MobileBottomNav() {
    const pathname = usePathname()

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50">
            {/* Glass-morphism background with shadow */}
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]" />

            {/* Safe area spacer */}
            <div className="absolute bottom-0 left-0 right-0 h-[env(safe-area-inset-bottom)] bg-transparent" />

            {/* Nav content */}
            <div className="relative max-w-md mx-auto flex justify-around items-end h-16 px-6 pb-[env(safe-area-inset-bottom)]">
                {navItems.map((item) => {
                    const isActive = pathname === item.href
                    const Icon = item.icon

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            prefetch={true}
                            className="relative flex flex-col items-center justify-center h-16 min-w-[64px] group"
                        >
                            <motion.div
                                whileTap={{ scale: 0.9 }}
                                className="relative flex flex-col items-center gap-1"
                            >
                                <div className={cn(
                                    "relative p-1.5 rounded-xl transition-all duration-300",
                                    isActive ? "text-primary bg-primary/10" : "text-slate-500 dark:text-slate-400"
                                )}>
                                    <Icon
                                        className={cn(
                                            "w-6 h-6 transition-all",
                                            isActive && "stroke-[2.5]"
                                        )}
                                    />
                                    {/* Small indicator dot */}
                                    {isActive && (
                                        <motion.span
                                            layoutId="nav-dot"
                                            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                                        />
                                    )}
                                </div>
                                <span className={cn(
                                    "text-[10px] font-semibold transition-all duration-300",
                                    isActive ? "text-primary scale-105" : "text-slate-500 dark:text-slate-400"
                                )}>
                                    {item.label}
                                </span>
                            </motion.div>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
