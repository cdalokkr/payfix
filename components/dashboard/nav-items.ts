import { Profile, UserRole } from '@/types'

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  badge?: string;
  children?: NavItem[];
  requiredRole?: string
  moduleId?: string
  description?: string;
}

export interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
}

export const adminNavItems: NavGroup[] = [
  {
    label: "Workspace",
    icon: "Layers2",
    items: [
      {
        title: "Dashboard",
        href: "/admin",
        icon: "LayoutDashboard",
        moduleId: "dashboard",
        description: "Overview of system metrics and activities"
      },
    ]
  },
  {
    label: "Management",
    icon: "Settings2",
    items: [
      {
        title: "Users",
        href: "/admin/users",
        icon: "Users",
        moduleId: "users",
        requiredRole: "admin",
        description: "User administration and management tools"
      },
      {
        title: "Designation",
        href: "/admin/designations",
        icon: "Briefcase",
        moduleId: "designations",
        requiredRole: "admin",
        description: "Manage various job designations"
      },
      {
        title: "Analytics",
        href: "/admin/analytics",
        icon: "Activity",
        moduleId: "analytics",
        requiredRole: "admin",
        description: "System analytics and overview"
      },
      {
        title: "Reports",
        href: "/admin/reports",
        icon: "FileChartColumnIncreasing",
        moduleId: "reports",
        requiredRole: "admin",
        description: "System analytics and reports"
      },
      {
        title: "Photo Approvals",
        href: "/admin/photo-approvals",
        icon: "ScanFace",
        moduleId: "profile",
        requiredRole: "admin",
        description: "Review employee photo updates"
      },
    ]
  },
  {
    label: "Payroll",
    icon: "Banknote",
    items: [
      {
        title: "Dashboard",
        href: "/admin/payroll/dashboard",
        icon: "LayoutDashboard",
        moduleId: "payroll",
        description: "Payroll overview and statistics"
      },
      {
        title: "Attendance",
        href: "/admin/payroll/attendance",
        icon: "CalendarCheck",
        moduleId: "attendance",
        description: "Manage employee attendance"
      },
      {
        title: "Leaves",
        href: "/admin/payroll/leaves",
        icon: "CalendarOff",
        moduleId: "leaves",
        description: "Manage leave applications"
      },
      {
        title: "Settings",
        href: "/admin/payroll/settings",
        icon: "Settings",
        moduleId: "settings",
        description: "Office timing and closures"
      },
    ]
  },
  {
    label: "Personalize",
    icon: "UserPen",
    items: [
      {
        title: "Profile",
        href: "/admin/profile",
        icon: "UserCog",
        moduleId: "profile",
        requiredRole: "admin",
        description: "Your profile and account settings"
      },
    ]
  }
];

// Moderator nav items - full backoffice access
export const moderatorNavItems: NavGroup[] = [
  {
    label: "Workspace",
    icon: "Layers2",
    items: [
      {
        title: "Dashboard",
        href: "/moderator",
        icon: "LayoutDashboard",
        moduleId: "dashboard",
        description: "Overview of your activities"
      },
    ]
  },
  {
    label: "Management",
    icon: "Settings2",
    items: [
      {
        title: "Analytics",
        href: "/moderator/analytics",
        icon: "Activity",
        moduleId: "analytics",
        description: "System analytics and overview"
      },
      {
        title: "Reports",
        href: "/moderator/reports",
        icon: "FileChartColumnIncreasing",
        moduleId: "reports",
        description: "View reports"
      },
      {
        title: "Photo Approvals",
        href: "/moderator/photo-approvals",
        icon: "ScanFace",
        moduleId: "profile",
        description: "Review employee photo updates"
      },
    ]
  },
  {
    label: "Payroll",
    icon: "Banknote",
    items: [
      {
        title: "Dashboard",
        href: "/moderator/payroll/dashboard",
        icon: "LayoutDashboard",
        moduleId: "payroll",
        description: "Payroll overview"
      },
      {
        title: "Attendance",
        href: "/moderator/payroll/attendance",
        icon: "CalendarCheck",
        moduleId: "attendance",
        description: "Manage employee attendance"
      },
      {
        title: "Leaves",
        href: "/moderator/payroll/leaves",
        icon: "CalendarOff",
        moduleId: "leaves",
        description: "Manage leave applications"
      },
    ]
  },
  {
    label: "Personalize",
    icon: "UserPen",
    items: [
      {
        title: "Profile",
        href: "/moderator/profile",
        icon: "UserCog",
        moduleId: "profile",
        description: "Your profile and account settings"
      },
    ]
  }
];

// Employee nav items - restricted access based on allowed_modules
export const employeeNavItems: NavGroup[] = [
  {
    label: "Workspace",
    icon: "Layers2",
    items: [
      {
        title: "Dashboard",
        href: "/employee",
        icon: "LayoutDashboard",
        moduleId: "dashboard",
        description: "Your employee dashboard"
      },
    ]
  },
  {
    label: "Payroll",
    icon: "Banknote",
    items: [
      {
        title: "Dashboard",
        href: "/employee/payroll/dashboard",
        icon: "LayoutDashboard",
        moduleId: "payroll",
        description: "Your payroll overview"
      },
      {
        title: "Attendance",
        href: "/employee/attendance",
        icon: "CalendarCheck",
        moduleId: "attendance",
        description: "Mark attendance and view history"
      },
      {
        title: "Leaves",
        href: "/employee/payroll/leaves",
        icon: "CalendarOff",
        moduleId: "leaves",
        description: "Apply for leaves and view status"
      },
    ]
  },
  {
    label: "Personalize",
    icon: "UserPen",
    items: [
      {
        title: "Profile",
        href: "/employee/profile",
        icon: "UserCog",
        moduleId: "profile",
        description: "Your profile and account settings"
      },
    ]
  }
];

// Legacy user nav items (kept for backward compatibility)
export const userNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/user/dashboard",
    icon: "LayoutDashboard",
    moduleId: "dashboard",
  },
  {
    title: "Reports",
    href: "/user/reports",
    icon: "FileChartColumnIncreasing",
    moduleId: "reports",
  },
  {
    title: "Profile",
    href: "/user/profile",
    icon: "User",
    moduleId: "profile",
  },
  {
    title: "Notifications",
    href: "/user/notifications",
    icon: "Bell",
    moduleId: "notifications",
    badge: "3",
  },
  {
    title: "Billing",
    href: "/user/billing",
    icon: "CreditCard",
    moduleId: "billing",
  },
  {
    title: "Settings", // Keeping Settings just in case or we can remove it if redundant
    href: "/user/profile",
    icon: "Settings",
    moduleId: "settings",
  },
];