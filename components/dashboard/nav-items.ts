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
        title: "Salary Setup",
        href: "/admin/payroll/salary-setup",
        icon: "IndianRupee",
        moduleId: "salary",
        requiredRole: "admin",
        description: "Configure employee salary components"
      },
      {
        title: "Advances",
        href: "/admin/payroll/advances",
        icon: "HandCoins",
        moduleId: "salary",
        description: "Manage employee advances and loans"
      },
      {
        title: "Monthly Attendance",
        href: "/admin/payroll/monthly-attendance",
        icon: "CalendarRange",
        moduleId: "salary",
        description: "Compile monthly attendance for payroll"
      },
      {
        title: "Payslips",
        href: "/admin/payroll/payslips",
        icon: "Receipt",
        moduleId: "salary",
        description: "Generate and view payslips"
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
    label: "Service Desk",
    icon: "Headset",
    items: [
      {
        title: "Clients",
        href: "/admin/clients",
        icon: "Building2",
        moduleId: "clients",
        requiredRole: "admin",
        description: "Manage client directory"
      },
      {
        title: "Complaints",
        href: "/admin/complaints",
        icon: "MessageSquareWarning",
        moduleId: "complaints",
        requiredRole: "admin",
        description: "Client complaint management"
      },
      {
        title: "Tickets",
        href: "/admin/tickets",
        icon: "TicketCheck",
        moduleId: "tickets",
        requiredRole: "admin",
        description: "Track assigned tickets"
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
      {
        title: "Attendance History",
        href: "/employee/attendance-history",
        icon: "CalendarCheck",
        moduleId: "attendance",
        description: "View your personal attendance history"
      },
      {
        title: "My Leaves",
        href: "/employee/payroll/leaves",
        icon: "CalendarOff",
        moduleId: "leaves",
        description: "Apply for leaves and track status"
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
      {
        title: "Advances",
        href: "/moderator/payroll/advances",
        icon: "HandCoins",
        moduleId: "salary",
        description: "Manage employee advances and loans"
      },
      {
        title: "Monthly Attendance",
        href: "/moderator/payroll/monthly-attendance",
        icon: "CalendarRange",
        moduleId: "salary",
        description: "Compile monthly attendance for payroll"
      },
      {
        title: "Payslips",
        href: "/moderator/payroll/payslips",
        icon: "Receipt",
        moduleId: "salary",
        description: "Generate and view payslips"
      },
    ]
  },
  {
    label: "Service Desk",
    icon: "Headset",
    items: [
      {
        title: "Clients",
        href: "/moderator/clients",
        icon: "Building2",
        moduleId: "clients",
        description: "Manage client directory"
      },
      {
        title: "Complaints",
        href: "/moderator/complaints",
        icon: "MessageSquareWarning",
        moduleId: "complaints",
        description: "Client complaint management"
      },
      {
        title: "Tickets",
        href: "/moderator/tickets",
        icon: "TicketCheck",
        moduleId: "tickets",
        description: "Track assigned tickets"
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
      {
        title: "Attendance History",
        href: "/employee/attendance-history",
        icon: "CalendarCheck",
        moduleId: "attendance",
        description: "View your personal attendance history"
      },
      {
        title: "My Leaves",
        href: "/employee/payroll/leaves",
        icon: "CalendarOff",
        moduleId: "leaves",
        description: "Apply for leaves and track status"
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
        title: "Attendance History",
        href: "/employee/attendance-history",
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
      {
        title: "Advances",
        href: "/employee/payroll/advances",
        icon: "HandCoins",
        moduleId: "salary",
        description: "View your personal advances and loans"
      },
    ]
  },
  {
    label: "Service Desk",
    icon: "Headset",
    items: [
      {
        title: "My Tickets",
        href: "/employee/tickets",
        icon: "TicketCheck",
        moduleId: "tickets",
        description: "View and work on assigned tickets"
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