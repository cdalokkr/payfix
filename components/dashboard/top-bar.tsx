"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserNav } from "@/components/user-nav"
import { NotificationBell } from "@/components/dashboard/notification-bell"
import { Profile } from "@/types"
import { trpc } from "@/lib/trpc/client"
import { Building2, ShieldAlert } from "lucide-react"

interface TopBarProps {
  className?: string
  user?: Profile | null
  tenantBrand?: string | null
  tenantLicenseExpiresAt?: string | null
}

function TopBarComponent({ 
  className, 
  user,
  tenantBrand,
  tenantLicenseExpiresAt: propLicenseExpiresAt
}: TopBarProps) {
  const isSuperAdmin = user?.role === 'super_admin';

  const hasPropData = !!tenantBrand;
  const { data: tenantInfo } = trpc.profile.getTenantInfo.useQuery(undefined, {
    enabled: !!user && !isSuperAdmin && !hasPropData,
  });

  const finalBrandName = tenantBrand || tenantInfo?.brandName;
  const licenseExpiresAt = propLicenseExpiresAt || tenantInfo?.licenseExpiresAt;

  const getLicenseBadge = () => {
    if (!licenseExpiresAt || !user || user.role !== "admin") return null;
    const days = Math.ceil((new Date(licenseExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    const formattedDate = new Date(licenseExpiresAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    if (days <= 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20 shadow-sm animate-pulse">
          Licence Expired
        </span>
      );
    } else if (days <= 3) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm">
          Licence Expires in {days} {days === 1 ? 'day' : 'days'}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm">
          Valid until: {formattedDate}
        </span>
      );
    }
  };

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
        {isSuperAdmin ? (
          <>
            <div className="h-6 w-px bg-border/40 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-indigo-400 shrink-0" />
              <span className="text-sm font-semibold text-indigo-400 truncate max-w-[200px]">
                Platform Admin
              </span>
            </div>
          </>
        ) : finalBrandName ? (
          <>
            <div className="h-6 w-px bg-border/40 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground/70 shrink-0" />
              <span className="text-sm font-semibold text-foreground/90 truncate max-w-[200px]">
                {finalBrandName}
              </span>
            </div>
          </>
        ) : null}
        {getLicenseBadge()}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 pr-2 border-r border-border/40">
          {user?.role !== 'super_admin' && (
            <>
              <NotificationBell />
              <div className="h-6 w-px bg-border/40" />
            </>
          )}
          <ThemeToggle />
        </div>
        <UserNav user={user || null} />
      </div>
    </header>
  )
}

// Memoize to prevent re-renders when user prop hasn't changed
export const TopBar = React.memo(TopBarComponent)
