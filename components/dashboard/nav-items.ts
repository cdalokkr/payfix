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
      {
        title: "Billing & Invoices",
        href: "/admin/billing",
        icon: "Receipt",
        moduleId: "settings",
        requiredRole: "admin",
        description: "Workspace subscription, renewal timeline, and invoices"
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
    label: "Organization",
    icon: "Building2",
    items: [
      {
        title: "Deptt. & Desig.",
        href: "/admin/departments",
        icon: "Building2",
        moduleId: "departments",
        requiredRole: "admin",
        description: "Manage organizational departments and job designations"
      },
      {
        title: "Office & Holidays",
        href: "/admin/office-locations",
        icon: "MapPin",
        moduleId: "settings",
        requiredRole: "admin",
        description: "Office branches, timings, geofencing & holiday closures"
      },
      {
        title: "Shifts & Rotation",
        href: "/admin/shifts",
        icon: "Clock",
        moduleId: "shifts",
        requiredRole: "admin",
        description: "Shift timing configuration & rotation builder"
      },
      {
        title: "Duty Roster",
        href: "/admin/roster",
        icon: "CalendarDays",
        moduleId: "shifts",
        requiredRole: "admin",
        description: "Weekly department roster board & shift allocation"
      },
      {
        title: "Biometrics & Kiosks",
        href: "/admin/devices",
        icon: "Cpu",
        moduleId: "settings",
        requiredRole: "admin",
        description: "eSSL biometric devices & selfie kiosk tablets"
      },
    ]
  },
  {
    label: "Payroll",
    icon: "Banknote",
    items: [
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
        title: "Payroll & Payslips",
        href: "/admin/payroll/monthly-attendance",
        icon: "Receipt",
        moduleId: "salary",
        description: "Compile monthly attendance, manage bonuses & generate payslips"
      },
      {
        title: "Salary Book",
        href: "/admin/payroll/salary-book",
        icon: "BookOpen",
        moduleId: "salary",
        description: "Employee salary passbook & payment ledger with grand totals"
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
      {
        title: "Billing & Invoices",
        href: "/admin/billing",
        icon: "Receipt",
        moduleId: "settings",
        description: "Workspace subscription, renewal timeline, and invoices"
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
    label: "Organization",
    icon: "Building2",
    items: [
      {
        title: "Duty Roster",
        href: "/admin/roster",
        icon: "CalendarDays",
        moduleId: "shifts",
        description: "Weekly shift duty roster & on-behalf leaves"
      },
      {
        title: "Shifts & Rotation",
        href: "/admin/shifts",
        icon: "Clock",
        moduleId: "shifts",
        description: "Shift timings & rotation schedules"
      },
      {
        title: "Office Schedule & Holidays",
        href: "/admin/office-locations",
        icon: "MapPin",
        moduleId: "settings",
        description: "Branch timings & holiday closures"
      },
    ]
  },
  {
    label: "Payroll",
    icon: "Banknote",
    items: [
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
        title: "Payroll & Payslips",
        href: "/moderator/payroll/monthly-attendance",
        icon: "Receipt",
        moduleId: "salary",
        description: "Compile monthly attendance, manage bonuses & generate payslips"
      },
      {
        title: "Salary Book",
        href: "/moderator/payroll/salary-book",
        icon: "BookOpen",
        moduleId: "salary",
        description: "Employee salary passbook & payment ledger with grand totals"
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
        title: "Reports",
        href: "/employee/reports",
        icon: "FileChartColumnIncreasing",
        moduleId: "reports",
        description: "Your personal activity reports and analytics"
      },
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
    title: "Settings",
    href: "/user/profile",
    icon: "Settings",
    moduleId: "settings",
  },
];

export const superAdminNavItems: NavGroup[] = [
  {
    label: "Platform",
    icon: "ShieldUser",
    items: [
      {
        title: "Dashboard",
        href: "/superadmin",
        icon: "LayoutDashboard",
        moduleId: "superadmin",
        description: "Overview of platform metrics"
      },
      {
        title: "Tenants",
        href: "/superadmin/tenants",
        icon: "Building2",
        moduleId: "superadmin",
        description: "Manage workspaces"
      },
      {
        title: "Plans",
        href: "/superadmin/plans",
        icon: "CreditCard",
        moduleId: "superadmin",
        description: "Manage subscription plans"
      }
    ]
  }
];
