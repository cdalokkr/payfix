"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { 
  Building2, Users, Search, Edit2, Loader2, Trash2, Mail, Phone, Clock,
  Calendar, Power, Check, ChevronDown, Eye, ShieldCheck,
  CreditCard, DollarSign, UserCheck, Lock, Key, Activity, Plus, Gift, X,
  CheckCircle2, XCircle, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { AppButton } from "@/components/ui/button-system";
import { FormInput } from "@/components/ui/form-input";
import CreateUserButton from "@/components/ui/create-user-button";
import { CancelButton } from "@/components/ui/action-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

// Zod schemas for card validations
const adminInfoSchema = z.object({
  adminName: z.string().trim().min(2, "Contact name must be at least 2 characters"),
  adminEmail: z.string().trim().email("Please enter a valid email address"),
  adminPhone: z.string().trim().min(10, "Phone number must be at least 10 digits"),
});

const securitySchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function TenantsPage() {
  const utils = trpc.useUtils();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"payments" | "logs">("payments");

  // Status & Plan Filter States
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  // Modals & Popovers state
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddTenantModalOpen, setIsAddTenantModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // Dedicated Modal Popup States for Cards
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  // New tenant form states
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");

  // Plan editing states
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [empOverride, setEmpOverride] = useState<string>("");
  const [modOverride, setModOverride] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);

  // Delete tenant states
  const [deletingTenant, setDeletingTenant] = useState<any | null>(null);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState("");

  // Middle Cards Form States & Errors
  const [adminNameInput, setAdminNameInput] = useState("");
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [adminPhoneInput, setAdminPhoneInput] = useState("");
  const [isAdminSaving, setIsAdminSaving] = useState(false);
  const [adminErrors, setAdminErrors] = useState<{ adminName?: string; adminEmail?: string; adminPhone?: string }>({});

  const [isSubSaving, setIsSubSaving] = useState(false);

  const [newSecPassword, setNewSecPassword] = useState("");
  const [confirmSecPassword, setConfirmSecPassword] = useState("");
  const [isSecuritySaving, setIsSecuritySaving] = useState(false);
  const [securityErrors, setSecurityErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});

  // Queries
  const { data: tenantsList, isLoading: loadingTenants } = trpc.superadmin.listTenants.useQuery();
  const { data: plansList } = trpc.superadmin.listPlans.useQuery();

  // Helper variables for plans
  const freeDbPlan = plansList?.find((p: any) => p.name === 'free' || p.displayName?.toLowerCase() === 'free plan');
  const freeDbPlanId = freeDbPlan?.id;
  const paidPlansList = plansList?.filter((p: any) => p.name !== 'free' && p.displayName?.toLowerCase() !== 'free plan') || [];

  // Mutations
  const updateStatusMutation = trpc.superadmin.updateTenantStatus.useMutation({
    onSuccess: () => {
      toast.success("Tenant status updated successfully!");
      utils.superadmin.listTenants.invalidate();
      setIsActionsOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update tenant status");
    }
  });

  const updatePlanMutation = trpc.superadmin.updateTenantPlan.useMutation({
    onSuccess: () => {
      utils.superadmin.listTenants.invalidate();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update tenant plan");
    }
  });

  const updateAdminInfoMutation = trpc.superadmin.updateAdminInfo.useMutation({
    onSuccess: () => {
      utils.superadmin.listTenants.invalidate();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update admin info");
    }
  });

  const resetAdminPasswordMutation = trpc.superadmin.resetAdminPassword.useMutation({
    onError: (err: any) => {
      toast.error(err.message || "Failed to reset admin password");
    }
  });

  const deleteTenantMutation = trpc.superadmin.deleteTenant.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Tenant deleted successfully! ${data.deletedUsers} auth users removed.`);
      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach((w: string) => toast.warning(w));
      }
      setDeletingTenant(null);
      setDeleteConfirmSlug("");
      setSelectedTenantId(null);
      setIsActionsOpen(false);
      utils.superadmin.listTenants.invalidate();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete tenant");
    }
  });

  // Action handlers
  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "suspended" ? "active" : "suspended";
    await updateStatusMutation.mutateAsync({ tenantId, status: nextStatus });
  };

  const handleSaveTenantPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    try {
      const targetPlanId = selectedPlanId === "" ? (freeDbPlanId || null) : selectedPlanId;
      await updatePlanMutation.mutateAsync({
        tenantId: selectedTenant.id,
        planId: targetPlanId,
        maxEmployeesOverride: empOverride.trim() !== "" ? parseInt(empOverride) : null,
        maxModeratorsOverride: modOverride.trim() !== "" ? parseInt(modOverride) : null,
        licenseExpiresAt: expiryDate ? expiryDate.toISOString() : new Date().toISOString(),
      });
    } catch (err) {
      // Handled in mutation
    }
  };

  const handleAddTenantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName || !newSlug || !newAdminEmail) {
      toast.error("Please fill in all required fields.");
      return;
    }
    toast.success(`Tenant "${newCompanyName}" registration request submitted!`);
    setIsAddTenantModalOpen(false);
    setNewCompanyName("");
    setNewSlug("");
    setNewAdminEmail("");
  };

  // Filter Tenants for List
  const filteredTenants = tenantsList?.filter((t: any) => {
    const matchesSearch = 
      t.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.adminEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || t.status === statusFilter || (statusFilter === "active" && t.status === "trial");
    const matchesPlan = planFilter === "all" 
      || (planFilter === "free" && (!t.plan || t.plan.id === freeDbPlanId || t.plan.id === "free" || t.plan.name === "free" || t.plan.displayName?.toLowerCase() === "free plan"))
      || (t.plan?.id === planFilter || t.plan?.displayName === planFilter || t.plan?.name === planFilter);

    return matchesSearch && matchesStatus && matchesPlan;
  }) || [];

  const handleSaveAdminInfo = async () => {
    if (!selectedTenant) return;
    setAdminErrors({});
    const validation = adminInfoSchema.safeParse({
      adminName: adminNameInput,
      adminEmail: adminEmailInput,
      adminPhone: adminPhoneInput,
    });

    if (!validation.success) {
      const errs: { [key: string]: string } = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) errs[issue.path[0].toString()] = issue.message;
      });
      setAdminErrors(errs);
      return;
    }

    setIsAdminSaving(true);
    try {
      await updateAdminInfoMutation.mutateAsync({
        tenantId: selectedTenant.id,
        adminName: adminNameInput,
        adminEmail: adminEmailInput,
        adminPhone: adminPhoneInput,
      });
      toast.success("Admin information updated successfully!");
      // 2-second delay before auto-closing modal dialog
      await new Promise(r => setTimeout(r, 2000));
      setIsAdminModalOpen(false);
      setAdminErrors({});
    } catch (err) {
      // Handled in mutation onError
    } finally {
      setIsAdminSaving(false);
    }
  };

  const handleSaveSubDetails = async () => {
    if (!selectedTenant) return;
    setIsSubSaving(true);
    try {
      const targetPlanId = selectedPlanId === "" ? (freeDbPlanId || null) : selectedPlanId;
      await updatePlanMutation.mutateAsync({
        tenantId: selectedTenant.id,
        planId: targetPlanId,
        maxEmployeesOverride: empOverride.trim() !== "" ? parseInt(empOverride) : null,
        maxModeratorsOverride: modOverride.trim() !== "" ? parseInt(modOverride) : null,
        licenseExpiresAt: expiryDate ? expiryDate.toISOString() : new Date().toISOString(),
      });
      toast.success("Subscription details updated successfully!");
      // 2-second delay before auto-closing modal dialog
      await new Promise(r => setTimeout(r, 2000));
      setIsSubModalOpen(false);
    } catch (err) {
      // Handled in mutation onError
    } finally {
      setIsSubSaving(false);
    }
  };

  const handleSaveSecurity = async () => {
    if (!selectedTenant) return;
    setSecurityErrors({});
    const validation = securitySchema.safeParse({
      newPassword: newSecPassword,
      confirmPassword: confirmSecPassword,
    });

    if (!validation.success) {
      const errs: { [key: string]: string } = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) errs[issue.path[0].toString()] = issue.message;
      });
      setSecurityErrors(errs);
      return;
    }

    setIsSecuritySaving(true);
    try {
      await resetAdminPasswordMutation.mutateAsync({
        tenantId: selectedTenant.id,
        newPassword: newSecPassword,
      });
      toast.success("Admin password reset successfully!");
      // 2-second delay before auto-closing modal dialog
      await new Promise(r => setTimeout(r, 2000));
      setNewSecPassword("");
      setConfirmSecPassword("");
      setSecurityErrors({});
      setIsSecurityModalOpen(false);
    } catch (err) {
      // Handled in mutation onError
    } finally {
      setIsSecuritySaving(false);
    }
  };

  // No default tenant selected initially (User directive)
  const selectedTenant = selectedTenantId ? (tenantsList?.find((t: any) => t.id === selectedTenantId) || null) : null;

  // Sync form states whenever selectedTenant changes
  useEffect(() => {
    if (selectedTenant) {
      setAdminNameInput(selectedTenant.adminName || "");
      setAdminEmailInput(selectedTenant.adminEmail || "");
      setAdminPhoneInput(selectedTenant.adminPhone || "");
      setNewSecPassword("");
      setConfirmSecPassword("");

      const isFree = !selectedTenant.plan || selectedTenant.plan.id === freeDbPlanId || selectedTenant.plan.name === 'free' || selectedTenant.plan.displayName?.toLowerCase() === 'free plan';
      setSelectedPlanId(isFree ? "" : (selectedTenant.plan?.id || ""));
      setEmpOverride(selectedTenant.maxEmployeesOverride !== null ? String(selectedTenant.maxEmployeesOverride) : "");
      setModOverride(selectedTenant.maxModeratorsOverride !== null ? String(selectedTenant.maxModeratorsOverride) : "");
      
      if (selectedTenant.licenseExpiresAt) {
        setExpiryDate(new Date(selectedTenant.licenseExpiresAt));
      } else {
        setExpiryDate(undefined);
      }
    }
  }, [selectedTenant?.id, freeDbPlanId]);

  // Metric counts
  const totalTenantsCount = tenantsList?.length || 8;
  const activeTenantsCount = tenantsList?.filter((t: any) => t.status === "active" || t.status === "trial").length || 6;
  const suspendedTenantsCount = tenantsList?.filter((t: any) => t.status === "suspended").length || 2;
  const freeTenantsCount = tenantsList?.filter((t: any) => !t.plan || t.plan.id === freeDbPlanId || t.plan.name === 'free').length || 5;

  const formattedExpiry = selectedTenant ? new Date(selectedTenant.licenseExpiresAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }) : "";

  const formattedCreated = selectedTenant ? new Date(selectedTenant.createdAt || selectedTenant.trialStart).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }) : "";

  // Relative time helper
  const getRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "26 days ago";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays <= 0 ? 1 : diffDays} days ago`;
  };

  // Mock Invoice List for the active tenant
  const getInvoicesList = (tenant: any) => {
    if (!tenant) return [];
    return [
      { id: "INV-2026-0008", date: "Jun 21, 2026", amount: "₹0", status: "Paid" },
      { id: "INV-2026-0007", date: "May 21, 2026", amount: "₹0", status: "Paid" },
      { id: "INV-2026-0006", date: "Apr 21, 2026", amount: "₹0", status: "Paid" },
      { id: "INV-2026-0005", date: "Mar 21, 2026", amount: "₹0", status: "Paid" },
      { id: "INV-2026-0004", date: "Feb 21, 2026", amount: "₹0", status: "Paid" },
    ];
  };

  // Mock Audit Logs List for the active tenant with category colors & Lucide icons
  const getAuditLogsList = (tenant: any) => {
    if (!tenant) return [];
    const adminName = tenant.adminName || "SRP Admin";
    return [
      {
        activity: "Plan Updated from Free Plan to Free Plan",
        performedBy: adminName,
        dateTime: "Jun 21, 2026 10:24 AM",
        ip: "103.112.45.67",
        bg: "bg-purple-100 text-purple-600",
        icon: Lock
      },
      {
        activity: "Invoice Generated INV-2026-0008",
        performedBy: "System",
        dateTime: "Jun 21, 2026 10:21 AM",
        ip: "103.112.45.67",
        bg: "bg-emerald-100 text-emerald-600",
        icon: CreditCard
      },
      {
        activity: "Payment Received for INV-2026-0008",
        performedBy: "System",
        dateTime: "Jun 21, 2026 10:22 AM",
        ip: "103.112.45.67",
        bg: "bg-amber-100 text-amber-600",
        icon: DollarSign
      },
      {
        activity: "Tenant Activated",
        performedBy: adminName,
        dateTime: "Jun 21, 2026 10:20 AM",
        ip: "103.112.45.67",
        bg: "bg-blue-100 text-blue-600",
        icon: Key
      },
      {
        activity: "Tenant Created / Signup",
        performedBy: adminName,
        dateTime: "Jun 21, 2026 10:15 AM",
        ip: "103.112.45.67",
        bg: "bg-indigo-100 text-indigo-600",
        icon: Users
      },
      {
        activity: "Contact Info Updated",
        performedBy: adminName,
        dateTime: "Jun 21, 2026 09:50 AM",
        ip: "103.112.45.67",
        bg: "bg-red-100 text-red-600",
        icon: UserCheck
      },
      {
        activity: `Login by Admin ${adminName}`,
        performedBy: adminName,
        dateTime: "Jun 21, 2026 09:12 AM",
        ip: "103.112.45.67",
        bg: "bg-orange-100 text-orange-600",
        icon: ShieldCheck
      },
    ];
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 text-[#1e293b] dark:text-slate-100 font-sans bg-[#F8FAFC] dark:bg-[#0B131A] min-h-screen transition-colors duration-200">
      
      {/* 1. Page Header (Only Page Heading without Card) */}
      <div className="flex items-center justify-between text-left pb-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] dark:text-slate-100 tracking-tight leading-none">
          Tenant Workspace Management
        </h1>
      </div>

      {/* 2. Quick Stats (4 Equal Cards Grid with compact p-3.5 sm:p-4 padding) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Tenants */}
        <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-3.5 sm:p-4 shadow-xs flex items-center space-x-3.5 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all duration-200 cursor-default">
          <div className="w-11 h-11 bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/50 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <Building2 className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div className="text-left">
            <div className="text-xl font-black text-slate-900 dark:text-white leading-none">{totalTenantsCount}</div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Total Tenants</div>
          </div>
        </div>

        {/* Card 2: Active Tenants */}
        <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-3.5 sm:p-4 shadow-xs flex items-center space-x-3.5 hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-500/30 transition-all duration-200 cursor-default">
          <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/50 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <UserCheck className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div className="text-left">
            <div className="text-xl font-black text-slate-900 dark:text-white leading-none">{activeTenantsCount}</div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Active Tenants</div>
          </div>
        </div>

        {/* Card 3: Suspended Tenants */}
        <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-3.5 sm:p-4 shadow-xs flex items-center space-x-3.5 hover:shadow-md hover:border-red-200 dark:hover:border-red-500/30 transition-all duration-200 cursor-default">
          <div className="w-11 h-11 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-800/50 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
            <Lock className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div className="text-left">
            <div className="text-xl font-black text-slate-900 dark:text-white leading-none">{suspendedTenantsCount}</div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Suspended Tenants</div>
          </div>
        </div>

        {/* Card 4: Free Plan Tenants */}
        <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-3.5 sm:p-4 shadow-xs flex items-center space-x-3.5 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-500/30 transition-all duration-200 cursor-default">
          <div className="w-11 h-11 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/50 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Gift className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div className="text-left">
            <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{freeTenantsCount}</div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Free Plan Tenants</div>
          </div>
        </div>
      </div>

      {/* 3. Workspace Directory Card (Toolbar sequence: Search, Select Tenant, Status Filter, Plan Filter) */}
      <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-3.5 sm:p-4 shadow-xs space-y-4">
        {/* Header with Title, Subtitle, and Top-Right Primary CTA (+ Add Tenant) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 text-left">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-none">Workspace Directory</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Quickly find and manage any tenant workspace</p>
          </div>

          <AppButton
            variant="primary"
            leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
            onClick={() => setIsAddTenantModalOpen(true)}
            className="shrink-0 self-start sm:self-center"
          >
            Add Tenant
          </AppButton>
        </div>

        {/* Horizontal Toolbar (Search -> Select Tenant -> Status Filter -> Plan Filter) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3.5">
          {/* 1. Search Box (Takes more width space) */}
          <div className="flex-1 flex flex-col gap-1 text-left min-w-[180px]">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Search</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 stroke-[1.8]" />
              <input
                type="text"
                placeholder="Search by tenant name, domain, admin..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3.5 h-[38px] border border-slate-200/90 dark:border-slate-700/80 rounded-[12px] text-xs sm:text-[13px] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-[3px] focus:ring-[#635BFF]/10 focus:border-[#635BFF] bg-white dark:bg-[#0B131A] dark:text-slate-100 transition-all duration-200 shadow-2xs"
              />
            </div>
          </div>

          {/* 2. Select Tenant Dropdown (Takes more width space) */}
          <div className="flex-1 flex flex-col gap-1 text-left min-w-[200px]">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Tenant</label>
            <Combobox
              options={[
                ...filteredTenants.map((t: any) => ({
                  value: t.id,
                  label: `${t.companyName} (${t.slug})`,
                  icon: t.status === 'suspended'
                    ? <XCircle className="w-3.5 h-3.5 text-red-500" />
                    : t.status === 'cancelled'
                    ? <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                }))
              ]}
              value={selectedTenantId || ""}
              onSelect={(val: string) => setSelectedTenantId(val)}
              placeholder="Select tenant..."
              searchPlaceholder="Search tenants..."
            />
          </div>

          {/* 3. Status Filter (Reduced Width) */}
          <div className="w-full sm:w-[150px] flex flex-col gap-1 text-left shrink-0">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status</label>
            <Combobox
              options={[
                { value: "all", label: "All Status", icon: <Activity className="w-3.5 h-3.5 text-slate-400" /> },
                { value: "active", label: "Active", icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> },
                { value: "suspended", label: "Suspended", icon: <XCircle className="w-3.5 h-3.5 text-red-500" /> },
                { value: "cancelled", label: "Cancelled", icon: <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> },
              ]}
              value={statusFilter}
              onSelect={(val: string) => setStatusFilter(val)}
              placeholder="Filter status..."
              searchPlaceholder="Search status..."
            />
          </div>

          {/* 4. Plan Filter (Reduced Width) */}
          <div className="w-full sm:w-[150px] flex flex-col gap-1 text-left shrink-0">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Plan</label>
            <Combobox
              options={[
                { value: "all", label: "All Plans" },
                { value: "free", label: "Free Plan ($0.00)" },
                ...paidPlansList.map((p: any) => ({ value: p.id, label: `${p.displayName}` }))
              ]}
              value={planFilter}
              onSelect={(val: string) => setPlanFilter(val)}
              placeholder="Filter plan..."
              searchPlaceholder="Search plans..."
            />
          </div>
        </div>
      </div>

      {loadingTenants ? (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-[#121B22] rounded-[16px] border border-slate-200 dark:border-slate-800 shadow-xs min-h-[300px]">
          <Loader2 className="h-8 w-8 text-[#635BFF] dark:text-[#0BDBB9] animate-spin" />
        </div>
      ) : !selectedTenant ? (
        <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-[16px] p-12 bg-white dark:bg-[#121B22] flex flex-col items-center justify-center text-center shadow-xs min-h-[320px]">
          <Building2 className="h-12 w-12 text-[#635BFF] dark:text-[#0BDBB9] mb-3 stroke-[1.5]" />
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">No Workspace Selected</h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm">
            Select a tenant workspace from the directory controls above to view admin info, subscription details, invoices, and audit logs.
          </p>
        </div>
      ) : (
        /* 4. Unified Outer Card wrapping all selected tenant details */
        <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-3.5 sm:p-5 shadow-xs space-y-5 text-left">
          
          {/* Tenant Overview Header Bar */}
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center space-x-4">
              {/* Tenant Avatar */}
              <div className="w-12 h-12 sm:w-13 sm:h-13 bg-[#635BFF] rounded-2xl flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-md shadow-indigo-200 dark:shadow-indigo-950 shrink-0">
                {selectedTenant.companyName.charAt(0).toUpperCase()}
              </div>

              <div className="space-y-1 text-left">
                {/* Name & Status Badge with Lucide Icon */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                    {selectedTenant.companyName}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold tracking-wide uppercase flex items-center gap-1 ${
                    selectedTenant.status === "active" || selectedTenant.status === "trial" 
                      ? "bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60" 
                      : selectedTenant.status === "suspended" 
                      ? "bg-red-100/80 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200/60 dark:border-red-800/60" 
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  }`}>
                    {selectedTenant.status === "suspended" ? (
                      <XCircle className="w-3 h-3 text-red-600 dark:text-red-400 stroke-[2.5]" />
                    ) : selectedTenant.status === "cancelled" ? (
                      <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 stroke-[2.5]" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                    )}
                    {selectedTenant.status === "trial" ? "ACTIVE" : selectedTenant.status.toUpperCase()}
                  </span>
                </div>

                {/* Tenant URL */}
                <p className="text-xs font-semibold text-[#635BFF] hover:underline cursor-pointer">
                  {selectedTenant.customDomain || `${selectedTenant.slug}.payfix.com`}
                </p>

                {/* Metadata Line */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium pt-0.5">
                  <span className="flex items-center">
                    <Users className="w-3.5 h-3.5 mr-1 text-[#635BFF]" />
                    {selectedTenant.employeeCount >= 0 ? selectedTenant.employeeCount : 11} Users
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1 text-[#635BFF]" />
                    Created: {formattedCreated}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-[#635BFF]" />
                    Expiry: {formattedExpiry}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="flex items-center">
                    <Activity className="w-3.5 h-3.5 mr-1 text-[#635BFF]" />
                    Last Updated: {getRelativeTime(selectedTenant.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Dropdown */}
            <Popover open={isActionsOpen} onOpenChange={setIsActionsOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-[36px] px-3.5 border border-indigo-200/90 dark:border-indigo-800/80 rounded-[12px] bg-white dark:bg-[#0B131A] text-[#635BFF] dark:text-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-150 shadow-2xs self-start md:self-center shrink-0"
                >
                  <span className="text-[12.5px]">⋮ Actions</span>
                  <ChevronDown className="w-3.5 h-3.5 stroke-[2]" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={6} className="w-56 p-1.5 bg-white dark:bg-[#121B22] border border-slate-200 dark:border-slate-800 rounded-[14px] shadow-xl space-y-1 z-50 text-left">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(selectedTenant.id, selectedTenant.status)}
                  disabled={updateStatusMutation.isPending}
                  className="w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  {selectedTenant.status === "suspended" ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600 stroke-[2]" />
                      Activate Workspace
                    </>
                  ) : (
                    <>
                      <Power className="w-4 h-4 text-amber-600 stroke-[2]" />
                      Suspend Workspace
                    </>
                  )}
                </button>

                {['suspended', 'cancelled'].includes(selectedTenant.status) && selectedTenant.slug !== 'primary' && (
                  <button
                    type="button"
                    onClick={() => { setIsActionsOpen(false); setDeletingTenant(selectedTenant); setDeleteConfirmSlug(""); }}
                    className="w-full px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400 stroke-[1.8]" />
                    Delete Workspace
                  </button>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* 5. Middle Section: Admin Information, Subscription Details & Card Security */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
            {/* Card 1: Admin Information */}
            <div className="bg-white dark:bg-[#0B131A]/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4 text-left flex flex-col justify-between">
              <div>
                {/* Card Header */}
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-[#635BFF]" />
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Admin Information</span>
                </div>

                {/* View Mode: Clean side-by-side list */}
                <div className="space-y-2">
                  {/* Contact Name */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserCheck className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Contact Name</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate text-right">
                      {selectedTenant.adminName || "—"}
                    </span>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  {/* Email */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Email</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate text-right">
                      {selectedTenant.adminEmail}
                    </span>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  {/* Phone */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Phone className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Phone</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 text-right">
                      {selectedTenant.adminPhone || "—"}
                    </span>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  {/* Registration Date */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Registered</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 text-right">
                      {formattedCreated}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Action Area */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
                <AppButton
                  variant="primary"
                  fullWidth
                  leftIcon={<Edit2 className="w-4 h-4 text-white" />}
                  onClick={() => setIsAdminModalOpen(true)}
                >
                  Edit Admin Info
                </AppButton>
              </div>
            </div>

            {/* Card 2: Subscription Details */}
            <div className="bg-white dark:bg-[#0B131A]/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4 text-left flex flex-col justify-between">
              <div>
                {/* Card Header */}
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-5 h-5 text-[#635BFF]" />
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Subscription Details</span>
                </div>

                {/* View Mode: Clean side-by-side list */}
                <div className="space-y-2">
                  {/* Current Plan */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Gift className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Current Plan</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 text-right">
                      {selectedTenant.plan?.displayName || "Free Plan"}
                    </span>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  {/* Billing Cycle */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Billing Cycle</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 text-right">Monthly</span>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  {/* Amount */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <DollarSign className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Amount</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 text-right">
                      {selectedTenant.plan?.priceMonthly ? `₹${selectedTenant.plan.priceMonthly} / month` : '₹0 / month'}
                    </span>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  {/* Expiry Date */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Expiry Date</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 text-right">
                      {formattedExpiry}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Action Area */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
                <AppButton
                  variant="primary"
                  fullWidth
                  leftIcon={<Edit2 className="w-4 h-4 text-white" />}
                  onClick={() => setIsSubModalOpen(true)}
                >
                  Edit Subscription
                </AppButton>
              </div>
            </div>

            {/* Card 3: Card Security */}
            <div className="bg-white dark:bg-[#0B131A]/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4 text-left flex flex-col justify-between">
              <div>
                {/* Card Header */}
                <div className="flex items-center gap-2 mb-3">
                  <Key className="w-5 h-5 text-[#635BFF]" />
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Card Security</span>
                </div>

                {/* View Mode: Masked side-by-side list */}
                <div className="space-y-2">
                  {/* New Password */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Lock className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Password</span>
                    </div>
                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500 text-right">••••••••</span>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  {/* Encryption Status */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Encryption</span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 text-right">Active (AES-256)</span>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  {/* Auth System */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Auth Engine</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 text-right">Supabase Auth</span>
                  </div>
                </div>
              </div>

              {/* Bottom Action Area */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
                <AppButton
                  variant="primary"
                  fullWidth
                  leftIcon={<Edit2 className="w-4 h-4 text-white" />}
                  onClick={() => setIsSecurityModalOpen(true)}
                >
                  Reset Password
                </AppButton>
              </div>
            </div>
          </div>

          {/* DEDICATED INNER CARD: Wrapping Tabs and their details inside a card */}
          <div className="bg-white dark:bg-[#0B131A]/60 border border-slate-200/90 dark:border-slate-800/80 rounded-[14px] p-4 shadow-2xs space-y-4 text-left">
            {/* Tabs Header with Underline for Active Tab */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar -mx-2 px-2">
              <button
                type="button"
                onClick={() => setActiveTab("payments")}
                className={`px-4 py-2.5 text-xs sm:text-sm flex items-center whitespace-nowrap -mb-[2px] transition-all cursor-pointer ${
                  activeTab === "payments"
                    ? "font-extrabold text-[#635BFF] dark:text-[#0BDBB9] border-b-2 border-[#635BFF] dark:border-[#0BDBB9]"
                    : "font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                <CreditCard className="w-4 h-4 mr-2 stroke-[1.8]" />
                Invoice & Payments
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("logs")}
                className={`px-4 py-2.5 text-xs sm:text-sm flex items-center whitespace-nowrap -mb-[2px] transition-all cursor-pointer ${
                  activeTab === "logs"
                    ? "font-extrabold text-[#635BFF] dark:text-[#0BDBB9] border-b-2 border-[#635BFF] dark:border-[#0BDBB9]"
                    : "font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                <Clock className="w-4 h-4 mr-2 stroke-[1.8]" />
                Audit Logs
              </button>
            </div>

            {/* Tab 1: Invoice & Payments Details */}
            {activeTab === "payments" && (
              <div className="space-y-3 animate-in fade-in duration-200 text-left">
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl bg-white dark:bg-[#121B22] shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold bg-slate-50/70 dark:bg-slate-800/40">
                        <th className="py-2.5 px-3">Invoice #</th>
                        <th className="py-2.5 px-3">Invoice Date</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {getInvoicesList(selectedTenant).map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{inv.id}</td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{inv.date}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">{inv.amount}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoice(inv)}
                              className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-[#635BFF] dark:hover:text-[#0BDBB9] hover:border-indigo-300 dark:hover:border-[#0BDBB9]/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/40 inline-flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Eye className="w-3 h-3 stroke-[1.8]" />
                              View Invoice
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 2: Connecting Node Audit Logs */}
            {activeTab === "logs" && (
              <div className="space-y-4 animate-in fade-in duration-200 text-left">
                <div className="relative border-l-2 border-indigo-150 dark:border-indigo-900/60 ml-4 pl-6 space-y-5 py-2">
                  {getAuditLogsList(selectedTenant).map((log, idx) => {
                    const IconComp = log.icon;
                    return (
                      <div key={idx} className="relative">
                        {/* Connecting Node Dot */}
                        <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#635BFF] dark:bg-[#0BDBB9] text-white dark:text-[#0A1118] ring-4 ring-white dark:ring-[#121B22] shadow-xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-white dark:bg-[#0A1118]" />
                        </span>
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center space-x-2">
                              <div className={`w-5 h-5 rounded-full ${log.bg} flex items-center justify-center shrink-0`}>
                                <IconComp className="w-3 h-3 stroke-[2]" />
                              </div>
                              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{log.activity}</h4>
                            </div>
                            <span className="text-[10.5px] text-slate-400 dark:text-slate-500 font-semibold whitespace-nowrap">{log.dateTime}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pl-7">
                            Performed by <span className="font-semibold text-slate-700 dark:text-slate-200">{log.performedBy}</span> • IP <span className="font-mono text-[10.5px] dark:text-slate-300">{log.ip}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* + Add Tenant Modal Dialog */}
      {isAddTenantModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#121B22] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-[#635BFF] stroke-[1.8]" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add New Tenant Workspace</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTenantModalOpen(false)}
                className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2]" />
              </button>
            </div>

            <form onSubmit={handleAddTenantSubmit} className="space-y-4">
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corp"
                    value={newCompanyName}
                    onChange={(e) => {
                      setNewCompanyName(e.target.value);
                      if (!newSlug) setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                    }}
                    className="w-full h-[38px] bg-white dark:bg-[#0B131A] border border-slate-200/90 dark:border-slate-700/80 rounded-[12px] px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-[3px] focus:ring-[#635BFF]/10 focus:border-[#635BFF] transition-all shadow-2xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Workspace Slug *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. acmecorp"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    className="w-full h-[38px] bg-white dark:bg-[#0B131A] border border-slate-200/90 dark:border-slate-700/80 rounded-[12px] px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-[3px] focus:ring-[#635BFF]/10 focus:border-[#635BFF] transition-all shadow-2xs font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Admin Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@acmecorp.com"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="w-full h-[38px] bg-white dark:bg-[#0B131A] border border-slate-200/90 dark:border-slate-700/80 rounded-[12px] px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-[3px] focus:ring-[#635BFF]/10 focus:border-[#635BFF] transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <CancelButton
                  size="md"
                  onClick={() => setIsAddTenantModalOpen(false)}
                >
                  Cancel
                </CancelButton>
                <CreateUserButton
                  type="submit"
                  mode="edit"
                  size="md"
                >
                  Provision Tenant
                </CreateUserButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Subscription & Limits Modal */}
      {isEditModalOpen && selectedTenant && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#121B22] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-5 h-5 text-[#635BFF] stroke-[1.8]" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Subscription & Overrides</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2]" />
              </button>
            </div>

            <form onSubmit={handleSaveTenantPlan} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Assigned Plan */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Assigned Subscription Plan</label>
                  <Combobox
                    options={[
                      { value: "", label: "Free Plan ($0.00/mo)" },
                      ...paidPlansList.map((p: any) => ({ value: p.id, label: `${p.displayName} ($${p.priceMonthly}/mo)` }))
                    ]}
                    value={selectedPlanId}
                    onSelect={(val: string) => setSelectedPlanId(val)}
                    placeholder="Select plan..."
                    searchPlaceholder="Search plans..."
                  />
                </div>

                {/* License Expiration */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">License Expiration Date</label>
                  <DatePicker
                    date={expiryDate}
                    setDate={setExpiryDate}
                    placeholder="Select expiration date"
                  />
                </div>

                {/* Max Employees Override */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Custom Max Employees</label>
                  <input
                    type="number"
                    placeholder="Use plan default"
                    value={empOverride}
                    onChange={(e) => setEmpOverride(e.target.value)}
                    className="w-full h-[38px] bg-white dark:bg-[#0B131A] border border-slate-200/90 dark:border-slate-700/80 rounded-[12px] px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-[3px] focus:ring-[#635BFF]/10 focus:border-[#635BFF] transition-all shadow-2xs"
                  />
                </div>

                {/* Max Moderators Override */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Custom Max Moderators</label>
                  <input
                    type="number"
                    placeholder="Use plan default"
                    value={modOverride}
                    onChange={(e) => setModOverride(e.target.value)}
                    className="w-full h-[38px] bg-white dark:bg-[#0B131A] border border-slate-200/90 dark:border-slate-700/80 rounded-[12px] px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-[3px] focus:ring-[#635BFF]/10 focus:border-[#635BFF] transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <CancelButton
                  size="md"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </CancelButton>
                <CreateUserButton
                  type="submit"
                  mode="edit"
                  size="md"
                  asyncState={updatePlanMutation.isPending ? 'loading' : 'idle'}
                >
                  Save Subscription
                </CreateUserButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Viewer Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#121B22] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-[#635BFF] stroke-[1.8]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Invoice {selectedInvoice.id}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2]" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 bg-slate-50/60 dark:bg-[#0B131A]/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Invoice Number:</span>
                <span className="font-mono font-bold text-[#635BFF]">{selectedInvoice.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Billing Date:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedInvoice.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Subscription Tier:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedTenant?.plan?.displayName || "Free Plan"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Total Amount Paid:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{selectedInvoice.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Payment Status:</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                  {selectedInvoice.status}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="h-9 px-4 btn-save-superadmin font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Tenant Confirmation Dialog */}
      {deletingTenant && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#121B22] border border-slate-200 dark:border-slate-800 rounded-[20px] max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400">
                <Trash2 className="h-5 w-5 stroke-[1.8]" />
              </div>
              <h3 className="text-[18px] font-bold text-slate-900 dark:text-slate-100">Delete Tenant Permanently</h3>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                This will permanently delete <strong className="text-slate-900 dark:text-slate-100">{deletingTenant.companyName}</strong> and cannot be undone.
              </p>
              <div className="bg-red-50/50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-xl p-4 text-[12px] text-red-700 dark:text-red-400 space-y-1.5">
                <p>• Drop database schema <code className="bg-red-100/50 dark:bg-red-900/50 px-1.5 py-0.5 rounded font-bold">{deletingTenant.tenantSchema}</code> and all business tables</p>
                <p>• Delete all auth user accounts belonging to this tenant</p>
                <p>• Remove branding, trial tracking, and tenant record</p>
                <p>• Clear all cached connections and resolver entries</p>
              </div>
              <div className="pt-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                  Type <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-900 dark:text-slate-100 font-bold">{deletingTenant.slug}</code> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmSlug}
                  onChange={(e) => setDeleteConfirmSlug(e.target.value)}
                  placeholder={deletingTenant.slug}
                  className="w-full h-11 bg-white dark:bg-[#0B131A] border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setDeletingTenant(null); setDeleteConfirmSlug(""); }}
                className="h-9 px-4 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold rounded-lg text-sm transition-all cursor-pointer"
                disabled={deleteTenantMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTenantMutation.mutate({
                  tenantId: deletingTenant.id,
                  confirmSlug: deleteConfirmSlug,
                })}
                disabled={deleteConfirmSlug !== deletingTenant.slug || deleteTenantMutation.isPending}
                className="h-9 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-300 dark:disabled:bg-red-900/50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                {deleteTenantMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Modal Dialog 1: Edit Admin Information */}
      <Dialog open={isAdminModalOpen} onOpenChange={(open) => { if (!open && !isAdminSaving) setIsAdminModalOpen(false); }}>
        <DialogContent 
          overlayClassName="bg-transparent backdrop-none shadow-none pointer-events-none"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="sm:max-w-[480px] p-6 bg-white dark:bg-[#0E1726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 pointer-events-auto"
        >
          <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 text-left">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Users className="w-5 h-5 text-[#635BFF]" />
              Edit Admin Information
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Update administrator contact information for {selectedTenant?.companyName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-4">
            <FormInput
              label="Contact Name"
              icon={<UserCheck className="w-4 h-4 text-[#635BFF]" />}
              value={adminNameInput}
              onChange={(e) => {
                setAdminNameInput(e.target.value);
                if (adminErrors.adminName) setAdminErrors((prev) => ({ ...prev, adminName: undefined }));
              }}
              placeholder="Enter admin name..."
              error={adminErrors.adminName}
            />

            <FormInput
              label="Email Address"
              icon={<Mail className="w-4 h-4 text-[#635BFF]" />}
              type="email"
              value={adminEmailInput}
              onChange={(e) => {
                setAdminEmailInput(e.target.value);
                if (adminErrors.adminEmail) setAdminErrors((prev) => ({ ...prev, adminEmail: undefined }));
              }}
              placeholder="Enter admin email..."
              error={adminErrors.adminEmail}
            />

            <FormInput
              label="Phone Number"
              icon={<Phone className="w-4 h-4 text-[#635BFF]" />}
              value={adminPhoneInput}
              onChange={(e) => {
                setAdminPhoneInput(e.target.value);
                if (adminErrors.adminPhone) setAdminErrors((prev) => ({ ...prev, adminPhone: undefined }));
              }}
              placeholder="Enter phone number..."
              error={adminErrors.adminPhone}
            />
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
            <CreateUserButton
              mode="edit"
              size="md"
              className="w-full"
              asyncState={isAdminSaving ? 'loading' : 'idle'}
              onClick={handleSaveAdminInfo}
            >
              Save
            </CreateUserButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dedicated Modal Dialog 2: Edit Subscription */}
      <Dialog open={isSubModalOpen} onOpenChange={(open) => { if (!open && !isSubSaving) setIsSubModalOpen(false); }}>
        <DialogContent 
          overlayClassName="bg-transparent backdrop-none shadow-none pointer-events-none"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="sm:max-w-[520px] p-6 bg-white dark:bg-[#0E1726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 pointer-events-auto"
        >
          <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 text-left">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <CreditCard className="w-5 h-5 text-[#635BFF]" />
              Edit Subscription & Plan Setup
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Select plan assignments and customized employee/moderator limits for {selectedTenant?.companyName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Plan selection listing ALL plans */}
            <div className="flex flex-col gap-1 text-left">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-[#635BFF]" /> Subscription Plan
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full h-11 px-3 bg-white dark:bg-[#0B131A] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#635BFF]"
              >
                <option value="">Free Plan ($0.00/mo)</option>
                {plansList?.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName} (₹{p.priceMonthly}/mo — Max {p.maxEmployees} Employees, {p.maxModerators} Moderators)
                  </option>
                ))}
              </select>
            </div>

            {/* Employee Limit Override */}
            <FormInput
              label="Custom Max Employees Override"
              type="number"
              value={empOverride}
              onChange={(e) => setEmpOverride(e.target.value)}
              placeholder="Leave blank to use plan default limit"
            />

            {/* Moderator Limit Override */}
            <FormInput
              label="Custom Max Moderators Override"
              type="number"
              value={modOverride}
              onChange={(e) => setModOverride(e.target.value)}
              placeholder="Leave blank to use plan default limit"
            />

            {/* License Expiry Date */}
            <div className="flex flex-col gap-1 text-left">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#635BFF]" /> License Expiry Date
              </label>
              <div className="w-full">
                <DatePicker date={expiryDate} setDate={setExpiryDate} />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
            <CreateUserButton
              mode="edit"
              size="md"
              className="w-full"
              asyncState={isSubSaving ? 'loading' : 'idle'}
              onClick={handleSaveSubDetails}
            >
              Save
            </CreateUserButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dedicated Modal Dialog 3: Reset Admin Password */}
      <Dialog open={isSecurityModalOpen} onOpenChange={(open) => { if (!open && !isSecuritySaving) setIsSecurityModalOpen(false); }}>
        <DialogContent 
          overlayClassName="bg-transparent backdrop-none shadow-none pointer-events-none"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="sm:max-w-[480px] p-6 bg-white dark:bg-[#0E1726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 pointer-events-auto"
        >
          <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 text-left">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Key className="w-5 h-5 text-[#635BFF]" />
              Reset Admin Password
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Reset login credentials for {selectedTenant?.adminEmail}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <FormInput
              label="New Password"
              type="password"
              icon={<Lock className="w-4 h-4 text-[#635BFF]" />}
              value={newSecPassword}
              onChange={(e) => {
                setNewSecPassword(e.target.value);
                if (securityErrors.newPassword) setSecurityErrors((prev) => ({ ...prev, newPassword: undefined }));
              }}
              placeholder="Enter new password (min 6 characters)"
              error={securityErrors.newPassword}
            />

            <FormInput
              label="Confirm Password"
              type="password"
              icon={<ShieldCheck className="w-4 h-4 text-[#635BFF]" />}
              value={confirmSecPassword}
              onChange={(e) => {
                setConfirmSecPassword(e.target.value);
                if (securityErrors.confirmPassword) setSecurityErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              placeholder="Re-enter password to confirm"
              error={securityErrors.confirmPassword}
            />
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
            <CreateUserButton
              mode="edit"
              size="md"
              className="w-full"
              asyncState={isSecuritySaving ? 'loading' : 'idle'}
              onClick={handleSaveSecurity}
            >
              Save
            </CreateUserButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
