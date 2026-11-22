"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { GalleryVerticalEnd } from "lucide-react"

import { UserRole, Profile, Module } from "@/types"
import { adminNavItems, moderatorNavItems, employeeNavItems, superAdminNavItems, NavGroup } from "./nav-items"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TenantLogo } from "@/components/brand/TenantLogo"
import { trpc } from "@/lib/trpc/client"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

interface Tenant {
  id: string
  name: string
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  role: UserRole
  tenants: Tenant[]
  defaultTenant: Tenant
  tenantLogo?: string | null
  onTenantSwitch: (tenantId: string) => void
  user: Profile | null
}

export function AppSidebar({ role, tenants, defaultTenant, tenantLogo, onTenantSwitch, user, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const isSuperAdmin = role === "super_admin" || user?.role === "super_admin" || pathname?.startsWith("/superadmin")

  const { data: orgData } = trpc.organization.getBranding.useQuery(undefined, {
    enabled: !isSuperAdmin,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  let navGroups: NavGroup[] = []

  if (isSuperAdmin) {
    navGroups = superAdminNavItems
  } else if (role === "admin") {
    navGroups = adminNavItems
  } else if (role === "moderator") {
    navGroups = moderatorNavItems
  } else if (role === "employee") {
    // Grant access to all employee dashboard navigation items
    navGroups = employeeNavItems
  } else {
    navGroups = moderatorNavItems
  }

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar"
      {...props}
    >
      <SidebarHeader className="h-16 border-b border-sidebar-border/50 bg-transparent justify-center p-0">
        <SidebarMenu translate="no">
          <SidebarMenuItem>
            <div className="flex h-full w-full items-center pl-[14px] gap-3 rounded-md text-sidebar-foreground transition-all duration-150 group-data-[state=collapsed]:gap-0">
              {isSuperAdmin ? (
                <>
                  <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-md shadow-indigo-500/25 shrink-0">
                    <GalleryVerticalEnd className="size-5" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight transition-all duration-300 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:flex-none overflow-hidden">
                    <span className="truncate font-bold tracking-tight">
                      PayFix
                    </span>
                    <span className="truncate text-[10px] uppercase tracking-widest text-indigo-500 dark:text-indigo-400 font-semibold">
                      Platform Admin
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <TenantLogo
                    size="md"
                    logoUrl={orgData?.branding?.logoUrl || tenantLogo || null}
                    appName={orgData?.branding?.appName || defaultTenant?.name}
                    className="shrink-0"
                  />
                  <div className="grid flex-1 text-left text-sm leading-tight transition-all duration-300 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:flex-none overflow-hidden">
                    <span className="truncate font-bold tracking-tight">
                      {orgData?.branding?.appName || defaultTenant?.name || 'PayFix'}
                    </span>
                    <span className="truncate text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-semibold">
                      {orgData?.branding?.tagline || 'Workspace'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="scroll-py-4 px-2">
        <NavMain groups={navGroups} />
      </SidebarContent>
      <SidebarFooter className="h-20 border-t border-sidebar-border/50 bg-transparent justify-center p-0">

        <NavUser user={user || null} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
