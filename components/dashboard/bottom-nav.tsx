"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, CalendarCheck, Banknote, UserCog } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

const navItems = [
    {
        title: "Home",
        href: "/employee",
        icon: LayoutDashboard,
    },
    {
        title: "Attendance",
        href: "/employee/attendance-history",
        icon: CalendarCheck,
    },
    {
        title: "Payroll",
        href: "/employee/payroll/leaves",
        icon: Banknote,
    },
    {
        title: "Profile",
        href: "/employee/profile",
        icon: UserCog,
    },
]

export function BottomNav() {
    const pathname = usePathname()

    // Only show for employee routes
    if (!pathname.startsWith('/employee')) return null

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background/80 backdrop-blur-lg lg:hidden px-4 pb-safe">
            {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/employee' && pathname.startsWith(item.href))
                const Icon = item.icon

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "relative flex flex-col items-center justify-center gap-1 w-full h-full mobile-nav-item",
                            isActive ? "text-primary" : "text-muted-foreground"
                        )}
                    >
                        <div className="relative">
                            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            {isActive && (
                                <motion.div
                                    layoutId="bottom-nav-active"
                                    className="absolute -inset-2 bg-primary/10 rounded-xl -z-10"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-tighter">
                            {item.title}
                        </span>
                    </Link>
                )
            })}
        </nav>
    )
}
