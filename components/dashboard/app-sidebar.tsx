"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { GalleryVerticalEnd } from "lucide-react"

import { UserRole, Profile, Module } from "@/types"
import { adminNavItems, moderatorNavItems, employeeNavItems, NavGroup } from "./nav-items"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
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
  onTenantSwitch: (tenantId: string) => void
  user: Profile | null
}

export function AppSidebar({ role, tenants, defaultTenant, onTenantSwitch, user, ...props }: AppSidebarProps) {
  let navGroups: NavGroup[] = []

  if (role === "admin") {
    navGroups = adminNavItems
  } else if (role === "moderator") {
    navGroups = moderatorNavItems
  } else if (role === "employee") {
    // Filter items within each group based on allowed_modules
    navGroups = employeeNavItems.map(group => ({
      ...group,
      items: group.items.filter(item =>
        item.moduleId === "dashboard" ||
        item.moduleId === "profile" ||
        item.moduleId === "payroll" ||
        item.moduleId === "attendance" ||
        item.moduleId === "leaves" ||
        (item.moduleId && user?.allowed_modules?.includes(item.moduleId as Module))
      )
    })).filter(group => group.items.length > 0)
  } else {
    navGroups = moderatorNavItems
  }

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar/70 backdrop-blur-2xl supports-backdrop-filter:bg-sidebar/50"
      {...props}
    >
      <SidebarHeader className="h-16 border-b border-sidebar-border/50 bg-transparent justify-center p-0">
        <SidebarMenu translate="no">
          <SidebarMenuItem>
            <div className="flex h-full w-full items-center pl-[14px] gap-3 rounded-md text-sidebar-foreground transition-all duration-150 group-data-[state=collapsed]:gap-0">


              <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <GalleryVerticalEnd className="size-5" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight transition-all duration-300 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:flex-none overflow-hidden">
                <span className="truncate font-bold tracking-tight">SaaS Kit</span>
                <span className="truncate text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-semibold">Enterprise</span>
              </div>
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
