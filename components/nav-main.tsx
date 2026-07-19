"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"


import { cn } from "@/lib/utils"
import { Icons } from "@/components/icons"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { NavItem, NavGroup } from "@/components/dashboard/nav-items"
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({ groups }: { groups: NavGroup[] }) {
    const pathname = usePathname()

    return (
        <div className="flex flex-col gap-4">
            {groups.map((group) => {
                return (
                    <Collapsible key={group.label} defaultOpen className="group/collapsible-group">
                        <SidebarGroup className="px-2 py-0">
                            <CollapsibleTrigger asChild>
                                <SidebarGroupLabel className="flex w-full items-center justify-between hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer transition-colors rounded-md group/label">
                                    <div className="flex items-center gap-2 py-4 text-[10px] font-bold text-sidebar-foreground/40 uppercase tracking-[0.2em] group-hover/label:text-sidebar-foreground/70 transition-colors">
                                        <span>{group.label}</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-sidebar-foreground/40 transition-transform duration-200 group-data-[state=open]/collapsible-group:rotate-90 group-hover/label:text-sidebar-foreground/70" />
                                </SidebarGroupLabel>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                                <SidebarGroupContent>
                                    <SidebarMenu className="gap-1 mt-1">
                                        {group.items.map((item) => (
                                            <NavItemComponent key={item.href} item={item} pathname={pathname} />
                                        ))}
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </CollapsibleContent>
                        </SidebarGroup>
                    </Collapsible>
                )
            })}
        </div>
    )
}

const NavItemComponent = React.memo(({ item, pathname }: { item: NavItem; pathname: string }) => {
    const Icon = Icons[item.icon as keyof typeof Icons]
    // Handle Active State
    // Use exact match for dashboard to avoid it being active for sub-routes if strictly desired, 
    // OR just fix the logic. User says "dashboard menu always shows active menu background while it's active or not".
    // This usually happens because everything starts with /. 
    // Correct logic:
    // If item.href is exactly the pathname, it's active.
    // OR if item.href is NOT root/dashboard root, and pathname starts with it. 
    // Actually, usually dashboard is /admin or /user/dashboard. 

    // Let's refine:
    // If item.href is /admin or /user/dashboard, strict equality check?
    // Often Dashboards are /admin. If I go to /admin/users, /admin matches start.
    // User wants: Dashboard active ONLY when on dashboard.

    const isDashboard = item.moduleId === 'dashboard' || ['/superadmin', '/admin', '/moderator', '/employee'].includes(item.href);
    const isActive = isDashboard
        ? pathname === item.href
        : pathname.startsWith(item.href);

    const hasChildren = item.children && item.children.length > 0
    const [open, setOpen] = React.useState(isActive)

    // Check if any child is active to auto-expand
    const isChildActive = hasChildren ? item.children!.some(child => pathname === child.href) : false

    React.useEffect(() => {
        if (isActive || isChildActive) {
            setOpen(true)
        }
    }, [isActive, isChildActive])

    if (hasChildren) {
        return (
            <Collapsible
                open={open}
                onOpenChange={setOpen}
                className="group/collapsible"
            >
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                            tooltip={item.title}
                            isActive={isActive}
                            className={cn(
                                "relative flex items-center gap-3 pl-[14px] pr-3 py-2 rounded-xl transition-all duration-150 ease-in-out",
                                "hover:bg-sidebar-accent/50",
                                isActive && "text-primary font-semibold"
                            )}



                        >
                            <div className="relative flex items-center justify-center">
                                {Icon && <Icon className={cn(
                                    "h-5 w-5 transition-transform duration-300 group-hover/collapsible:scale-110 group-hover/collapsible:text-primary",
                                    isActive ? "text-primary" : "text-sidebar-foreground/70"
                                )} />}

                            </div>
                            <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
                            <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90 text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden" />


                            {isActive && (
                                <motion.div
                                    layoutId="active-indicator"
                                    className="absolute inset-0 bg-primary/10 rounded-xl -z-10"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                />
                            )}
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <SidebarMenuSub className="ml-4 pl-4 border-l border-sidebar-border/50 mt-1 space-y-1">
                            {item.children!.map((child) => {
                                const ChildIcon = Icons[child.icon as keyof typeof Icons]
                                const childIsActive = pathname === child.href
                                return (
                                    <SidebarMenuSubItem key={child.href}>
                                        <SidebarMenuSubButton
                                            asChild
                                            isActive={childIsActive}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg transition-all duration-200",
                                                childIsActive ? "text-primary font-medium bg-primary/5" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
                                            )}
                                        >
                                            <Link href={child.href} className="flex items-center gap-3 w-full">
                                                {ChildIcon && <ChildIcon className={cn("h-4 w-4", childIsActive && "text-primary")} />}
                                                <span className="text-sm">{child.title}</span>
                                            </Link>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                )
                            })}
                        </SidebarMenuSub>
                    </CollapsibleContent>
                </SidebarMenuItem>
            </Collapsible>
        )
    }

    return (
        <SidebarMenuItem className="group/nav-item">
            <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={isActive}
                className={cn(
                    "relative flex items-center gap-3 pl-[14px] pr-3 py-2 rounded-xl transition-all duration-150 ease-in-out",
                    "hover:bg-sidebar-accent/50",
                    isActive && "text-primary font-semibold"
                )}



            >
                <Link href={item.href} className="flex items-center gap-3 w-full">
                    <div className="relative flex items-center justify-center">
                        {Icon && <Icon className={cn(
                            "h-5 w-5 transition-all duration-300 group-hover/nav-item:scale-110 group-hover/nav-item:text-primary",
                            isActive ? "text-primary" : "text-sidebar-foreground/70"
                        )} />}

                    </div>
                    <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
                    {item.badge && (
                        <span className="ml-auto flex h-5 px-1.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold group-data-[collapsible=icon]:hidden">
                            {item.badge}
                        </span>
                    )}

                    {isActive && (
                        <motion.div
                            layoutId="active-indicator"
                            className="absolute inset-0 bg-primary/10 rounded-xl -z-10"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                        />
                    )}
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    )

})

NavItemComponent.displayName = 'NavItemComponent'
