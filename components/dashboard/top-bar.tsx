"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Fragment } from "react"

import { cn } from "@/lib/utils"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserNav } from "@/components/user-nav"
import { NotificationBell } from "@/components/dashboard/notification-bell"
import { Profile } from "@/types"

interface TopBarProps {
  className?: string
  user?: Profile | null
}

function TopBarComponent({ className, user }: TopBarProps) {
  const pathname = usePathname()

  // Generate breadcrumb from pathname
  const breadcrumbs = React.useMemo(() => {
    const parts = pathname.split('/').filter(Boolean)
    return parts.map((part, index) => {
      let name = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
      if (['Admin', 'Moderator', 'Employee', 'Dashboard'].includes(name)) {
        name = 'Dashboard';
      }

      return {
        name,
        href: '/' + parts.slice(0, index + 1).join('/'),
        isLast: index === parts.length - 1
      }
    })
  }, [pathname])

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
        <div className={cn(
          "h-6 w-px bg-border/40 shrink-0",
          user?.role === 'employee' && "hidden lg:block"
        )} />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => (
              <Fragment key={crumb.href}>
                {index > 0 && <BreadcrumbSeparator className="text-muted-foreground/30" />}
                <BreadcrumbItem>
                  {crumb.isLast ? (
                    <BreadcrumbPage className="font-semibold text-foreground tracking-tight">{crumb.name}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      href={crumb.href}
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {crumb.name}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
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
