"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, CalendarCheck, Banknote, UserCog, Users, Building2, MessageSquareWarning } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav() {
    const pathname = usePathname()

    const isEmployee = pathname.startsWith('/employee')
    const isAdmin = pathname.startsWith('/admin')
    const isModerator = pathname.startsWith('/moderator')
    const isSuperAdmin = pathname.startsWith('/superadmin')

    if (!isEmployee && !isAdmin && !isModerator && !isSuperAdmin) return null

    const getItems = () => {
        if (isEmployee) {
            return [
                { title: "Home", href: "/employee", icon: LayoutDashboard },
                { title: "Attendance", href: "/employee/attendance-history", icon: CalendarCheck },
                { title: "Payroll", href: "/employee/payroll/leaves", icon: Banknote },
                { title: "Profile", href: "/employee/profile", icon: UserCog },
            ]
        }
        if (isAdmin) {
            return [
                { title: "Home", href: "/admin", icon: LayoutDashboard },
                { title: "Users", href: "/admin/users", icon: Users },
                { title: "Payroll", href: "/admin/payroll/leaves", icon: Banknote },
                { title: "Profile", href: "/admin/profile", icon: UserCog },
            ]
        }
        if (isModerator) {
            return [
                { title: "Home", href: "/moderator", icon: LayoutDashboard },
                { title: "Clients", href: "/moderator/clients", icon: Building2 },
                { title: "Tickets", href: "/moderator/tickets", icon: MessageSquareWarning },
                { title: "Profile", href: "/moderator/profile", icon: UserCog },
            ]
        }
        return []
    }

    const items = getItems()
    if (items.length === 0) return null

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background/80 backdrop-blur-lg lg:hidden px-4 pb-safe shadow-lg">
            {items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/employee' && item.href !== '/admin' && item.href !== '/moderator' && pathname.startsWith(item.href))
                const Icon = item.icon

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "relative flex flex-col items-center justify-center gap-1 w-full h-full mobile-nav-item transition-all duration-200",
                            isActive ? "text-primary" : "text-muted-foreground"
                        )}
                    >
                        <div className={cn(
                            "relative flex items-center justify-center p-1.5 rounded-xl transition-all duration-200",
                            isActive ? "bg-primary/10" : "bg-transparent"
                        )}>
                            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
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
