"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserNav } from "@/components/user-nav"
import { NotificationBell } from "@/components/dashboard/notification-bell"
import { Profile } from "@/types"

interface TopBarProps {
  className?: string
  user?: Profile | null
}

function TopBarComponent({ className, user }: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 flex h-16 shrink-0 items-center justify-between gap-2 border-b transition-all duration-300 ease-in-out bg-background/60 backdrop-blur-xl z-30 px-6",
        className
      )}
    >
      <div className="flex h-full items-center gap-4">
        <SidebarTrigger className={cn(
          "-ml-1 h-9 w-9 hover:bg-sidebar-accent/50 transition-colors",
          user?.role === 'employee' && "hidden lg:flex"
        )} />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 pr-2 border-r border-border/40">
          <NotificationBell />
          <div className="h-6 w-px bg-border/40" />
          <ThemeToggle />
        </div>
        <UserNav user={user || null} />
      </div>
    </header>
  )
}

// Memoize to prevent re-renders when user prop hasn't changed
export const TopBar = React.memo(TopBarComponent)
