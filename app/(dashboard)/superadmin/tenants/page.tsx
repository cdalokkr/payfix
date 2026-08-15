"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { 
  Building2, Users, Search, Edit2, Loader2, Trash2, Mail, Phone, Clock,
  Calendar, Power, Check, ChevronDown, Eye, ShieldCheck,
  CreditCard, DollarSign, UserCheck, Lock, Key, Activity, Plus, Gift, X,
  CheckCircle2, XCircle, AlertCircle, MoreHorizontal, Briefcase, RefreshCw, ArrowUpDown
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { AppButton } from "@/components/ui/button-system";
import { FormInput } from "@/components/ui/form-input";
import { FormPasswordInput, getPasswordStrength } from "@/components/ui/form-password-input";
import PhoneInput from "@/components/auth/ui/phone-input";
import CreateUserButton, { AsyncState } from "@/components/ui/create-user-button";
import { CancelButton } from "@/components/ui/action-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import ModalDialog from "@/components/ui/modal-dialog";

// Zod schema for Add Tenant Single Form Layout
const addTenantFullSchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters"),
  workspaceName: z.string().trim().min(2, "Workspace name must be at least 2 characters"),
  slug: z.string().trim().min(2, "Workspace slug must be at least 2 characters").regex(/^[a-z0-9-]+$/i, "Slug can only contain letters, numbers, and hyphens"),
  adminName: z.string().trim().min(2, "Contact name must be at least 2 characters"),
  adminEmail: z.string().trim().email("Please enter a valid email address"),
  adminPhone: z.string().trim().min(8, "Phone number must be at least 8 digits"),
});

// Zod schemas for card validations
const adminInfoSchema = z.object({
  adminName: z.string().trim().min(2, "Contact name must be at least 2 characters"),
  adminEmail: z.string().trim().email("Please enter a valid email address"),
  adminPhone: z.string().trim().regex(/^(\+\d{1,3}[- ]?)?\d{10}$/, "Phone number must be a valid 10-digit number (e.g. 9876543210 or +919876543210)"),
});

const securitySchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least 1 uppercase letter")
    .regex(/[a-z]/, "Must contain at least 1 lowercase letter")
    .regex(/[0-9]/, "Must contain at least 1 number")
    .regex(/[^A-Za-z0-9]/, "Must contain at least 1 special character"),
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

  // Status, Plan & Sort Filter States
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"name-asc" | "name-desc" | "newest" | "expiry">("name-asc");
  const [baseDomain, setBaseDomain] = useState("payfix.com");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) {
        const port = window.location.port ? `:${window.location.port}` : "";
        setBaseDomain(`localhost${port}`);
      } else {
        const parts = host.split(".");
        if (parts.length >= 2) {
          setBaseDomain(parts.slice(-2).join("."));
        } else {
          setBaseDomain(host);
        }
      }
    }
  }, []);

  // Modals & Popovers state
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddTenantModalOpen, setIsAddTenantModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // Dedicated Modal Popup States for Cards
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);

  // Renewal form states
  const [renewPlanId, setRenewPlanId] = useState<string>("");
  const [renewExpiryDate, setRenewExpiryDate] = useState<Date | undefined>(undefined);
  const [renewEmpOverride, setRenewEmpOverride] = useState("");
  const [renewModOverride, setRenewModOverride] = useState("");
  const [renewPeriod, setRenewPeriod] = useState<string>("1m");
  const [renewAsyncState, setRenewAsyncState] = useState<AsyncState>('idle');

  // New tenant single form states & validation errors
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPhone, setNewAdminPhone] = useState("");
  const [newAdminCountryCode, setNewAdminCountryCode] = useState("+91");
  const [newAddTenantPlanId, setNewAddTenantPlanId] = useState<string>("");
  const [newAddTenantExpiryDate, setNewAddTenantExpiryDate] = useState<Date | undefined>(undefined);
  const [addTenantAsyncState, setAddTenantAsyncState] = useState<AsyncState>('idle');
  const [addTenantErrors, setAddTenantErrors] = useState<{
    companyName?: string;
    workspaceName?: string;
    slug?: string;
    adminName?: string;
    adminEmail?: string;
    adminPhone?: string;
  }>({});

  const handleResetAddTenantModal = (open: boolean) => {
    setIsAddTenantModalOpen(open);
    setNewCompanyName("");
    setNewWorkspaceName("");
    setNewSlug("");
    setNewAdminName("");
    setNewAdminEmail("");
    setNewAdminPhone("");
    setNewAdminCountryCode("+91");
    setNewAddTenantPlanId("");
    setNewAddTenantExpiryDate(undefined);
    setAddTenantErrors({});
    setAddTenantAsyncState('idle');
  };

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
  const [adminAsyncState, setAdminAsyncState] = useState<AsyncState>('idle');
  const [adminErrors, setAdminErrors] = useState<{ adminName?: string; adminEmail?: string; adminPhone?: string }>({});

  const [isSubSaving, setIsSubSaving] = useState(false);
  const [subAsyncState, setSubAsyncState] = useState<AsyncState>('idle');

  const [newSecPassword, setNewSecPassword] = useState("");
  const [confirmSecPassword, setConfirmSecPassword] = useState("");
  const [isSecuritySaving, setIsSecuritySaving] = useState(false);
  const [securityAsyncState, setSecurityAsyncState] = useState<AsyncState>('idle');
  const [securityErrors, setSecurityErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});

  // Queries
  const { data: tenantsList, isLoading: loadingTenants } = trpc.superadmin.listTenants.useQuery();
  const { data: plansList } = trpc.superadmin.listPlans.useQuery();

  // Helper variables for plans
  const freeDbPlan = plansList?.find((p: any) => p.name === 'free' || p.displayName?.toLowerCase() === 'free plan');
  const freeDbPlanId = freeDbPlan?.id;
  const paidPlansList = plansList?.filter((p: any) => p.name !== 'free' && p.displayName?.toLowerCase() !== 'free plan') || [];

  // Mutations
  const createTenantMutation = trpc.superadmin.createTenant.useMutation({
    onSuccess: () => {
      utils.superadmin.listTenants.invalidate();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to provision tenant workspace");
    }
  });

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

  const renewTenantSubscriptionMutation = trpc.superadmin.renewTenantSubscription.useMutation({
    onSuccess: () => {
      utils.superadmin.listTenants.invalidate();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to renew subscription");
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

  const handleAddTenantSubmit = async () => {
    setAddTenantErrors({});
    const validation = addTenantFullSchema.safeParse({
      companyName: newCompanyName,
      workspaceName: newWorkspaceName || newCompanyName,
      slug: newSlug,
      adminName: newAdminName,
      adminEmail: newAdminEmail,
      adminPhone: newAdminPhone,
    });

    if (!validation.success) {
      const errs: { [key: string]: string } = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) errs[issue.path[0].toString()] = issue.message;
      });
      setAddTenantErrors(errs);
      return;
    }

    setAddTenantAsyncState('loading');
    try {
      // 14-day default trial period assigned internally
      const trialExpiryDate = new Date();
      trialExpiryDate.setDate(trialExpiryDate.getDate() + 14);

      const fullPhone = newAdminPhone.startsWith('+') ? newAdminPhone : `${newAdminCountryCode}${newAdminPhone}`;

      await createTenantMutation.mutateAsync({
        companyName: newWorkspaceName || newCompanyName,
        slug: newSlug,
        adminName: newAdminName || newCompanyName + " Admin",
        adminEmail: newAdminEmail,
        adminPhone: fullPhone,
        planId: null, // Assigned default trial plan internally
        licenseExpiresAt: trialExpiryDate.toISOString(),
      });
      toast.success("Tenant workspace provisioned successfully!");
      setAddTenantAsyncState('success');
      await new Promise(r => setTimeout(r, 2000));
      handleResetAddTenantModal(false);
    } catch (err) {
      setAddTenantAsyncState('error');
      setTimeout(() => setAddTenantAsyncState('idle'), 3000);
    }
  };

  // Filter & Sort Tenants for List (Ascending A-Z by default)
  const filteredTenants = (tenantsList?.filter((t: any) => {
    const matchesSearch = 
      t.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.adminEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || t.status === statusFilter || (statusFilter === "active" && t.status === "trial");
    const matchesPlan = planFilter === "all" 
      || (planFilter === "free" && (!t.plan || t.plan.id === freeDbPlanId || t.plan.id === "free" || t.plan.name === "free" || t.plan.displayName?.toLowerCase() === "free plan"))
      || (t.plan?.id === planFilter || t.plan?.displayName === planFilter || t.plan?.name === planFilter);

    return matchesSearch && matchesStatus && matchesPlan;
  }) || []).sort((a: any, b: any) => {
    if (sortOrder === "name-asc") {
      return a.companyName.localeCompare(b.companyName);
    }
    if (sortOrder === "name-desc") {
      return b.companyName.localeCompare(a.companyName);
    }
    if (sortOrder === "expiry") {
      const dateA = a.licenseExpiresAt ? new Date(a.licenseExpiresAt).getTime() : 0;
      const dateB = b.licenseExpiresAt ? new Date(b.licenseExpiresAt).getTime() : 0;
      return dateA - dateB;
    }
    if (sortOrder === "newest") {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    }
    return a.companyName.localeCompare(b.companyName);
  });

  // Selected tenant from dropdown/list
  const selectedTenant = selectedTenantId ? (tenantsList?.find((t: any) => t.id === selectedTenantId) || null) : null;

  const handleOpenRenewModal = (tenant: any) => {
    const currentExpiry = tenant.licenseExpiresAt ? new Date(tenant.licenseExpiresAt) : new Date();
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + 30);

    setRenewPlanId(tenant.plan?.id || "");
    setRenewExpiryDate(nextDate);
    setRenewPeriod("1m");
    setRenewEmpOverride(tenant.maxEmployeesOverride ? tenant.maxEmployeesOverride.toString() : "");
    setRenewModOverride(tenant.maxModeratorsOverride ? tenant.maxModeratorsOverride.toString() : "");
    setRenewAsyncState('idle');
    setIsRenewModalOpen(true);
  };

  const handleRenewalPeriodChange = (val: string) => {
    setRenewPeriod(val);
    if (!selectedTenant) return;
    const currentExp = selectedTenant.licenseExpiresAt ? new Date(selectedTenant.licenseExpiresAt) : new Date();
    const baseDate = currentExp > new Date() ? currentExp : new Date();
    const nextDate = new Date(baseDate);

    if (val === "1m") {
      nextDate.setDate(nextDate.getDate() + 30);
      setRenewExpiryDate(nextDate);
    } else if (val === "3m") {
      nextDate.setDate(nextDate.getDate() + 90);
      setRenewExpiryDate(nextDate);
    } else if (val === "6m") {
      nextDate.setDate(nextDate.getDate() + 180);
      setRenewExpiryDate(nextDate);
    } else if (val === "1y") {
      nextDate.setDate(nextDate.getDate() + 365);
      setRenewExpiryDate(nextDate);
    }
  };

  // Dynamic Total Amount Calculation for Plan Renewal Modal
  const selectedRenewPlan = plansList?.find((p: any) => p.id === renewPlanId);
  const renewPlanMonthlyPrice = selectedRenewPlan?.priceMonthly ? parseFloat(selectedRenewPlan.priceMonthly) : 0;
  const currentTenantExp = selectedTenant?.licenseExpiresAt ? new Date(selectedTenant.licenseExpiresAt) : new Date();
  const baseRenewalDate = currentTenantExp > new Date() ? currentTenantExp : new Date();
  const renewDaysDiff = renewExpiryDate 
    ? Math.max(1, Math.round((renewExpiryDate.getTime() - baseRenewalDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 30;

  let renewalTotalAmount = 0;
  if (renewPeriod === "1m") renewalTotalAmount = renewPlanMonthlyPrice * 1;
  else if (renewPeriod === "3m") renewalTotalAmount = renewPlanMonthlyPrice * 3;
  else if (renewPeriod === "6m") renewalTotalAmount = renewPlanMonthlyPrice * 6;
  else if (renewPeriod === "1y") renewalTotalAmount = renewPlanMonthlyPrice * 12;
  else {
    renewalTotalAmount = Math.round((renewPlanMonthlyPrice / 30) * renewDaysDiff);
  }

  const handleRenewSubscription = async () => {
    if (!selectedTenant || !renewExpiryDate) {
      toast.error("Please select a valid expiry date");
      return;
    }

    setRenewAsyncState('loading');
    try {
      const targetPlanId = renewPlanId === "" ? (freeDbPlanId || null) : renewPlanId;
      await renewTenantSubscriptionMutation.mutateAsync({
        tenantId: selectedTenant.id,
        planId: targetPlanId,
        licenseExpiresAt: renewExpiryDate.toISOString(),
        maxEmployeesOverride: renewEmpOverride.trim() !== "" ? parseInt(renewEmpOverride) : null,
        maxModeratorsOverride: renewModOverride.trim() !== "" ? parseInt(renewModOverride) : null,
      });

      toast.success("Tenant plan renewed & license extended successfully!");
      setRenewAsyncState('success');
      await new Promise(r => setTimeout(r, 2000));
      setIsRenewModalOpen(false);
      setRenewAsyncState('idle');
    } catch (err) {
      setRenewAsyncState('error');
      setTimeout(() => setRenewAsyncState('idle'), 3000);
    }
  };

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
    setAdminAsyncState('loading');
    try {
      await updateAdminInfoMutation.mutateAsync({
        tenantId: selectedTenant.id,
        adminName: adminNameInput,
        adminEmail: adminEmailInput,
        adminPhone: adminPhoneInput,
      });
      toast.success("Admin information updated successfully!");
      setAdminAsyncState('success');
      // 2-second delay showing emerald success state before auto-closing modal dialog
      await new Promise(r => setTimeout(r, 2000));
      setIsAdminModalOpen(false);
      setAdminAsyncState('idle');
      setAdminErrors({});
    } catch (err) {
      setAdminAsyncState('error');
      setTimeout(() => setAdminAsyncState('idle'), 3000);
    } finally {
      setIsAdminSaving(false);
    }
  };

  const handleSaveSubDetails = async () => {
    if (!selectedTenant) return;
    setIsSubSaving(true);
    setSubAsyncState('loading');
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
      setSubAsyncState('success');
      // 2-second delay showing emerald success state before auto-closing modal dialog
      await new Promise(r => setTimeout(r, 2000));
      setIsSubModalOpen(false);
      setSubAsyncState('idle');
    } catch (err) {
      setSubAsyncState('error');
      setTimeout(() => setSubAsyncState('idle'), 3000);
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
    setSecurityAsyncState('loading');
    try {
      await resetAdminPasswordMutation.mutateAsync({
        tenantId: selectedTenant.id,
        newPassword: newSecPassword,
      });
      toast.success("Admin password reset successfully!");
      setSecurityAsyncState('success');
      // 2-second delay showing emerald success state before auto-closing modal dialog
      await new Promise(r => setTimeout(r, 2000));
      setNewSecPassword("");
      setConfirmSecPassword("");
      setSecurityErrors({});
      setIsSecurityModalOpen(false);
      setSecurityAsyncState('idle');
    } catch (err) {
      setSecurityAsyncState('error');
      setTimeout(() => setSecurityAsyncState('idle'), 3000);
    } finally {
      setIsSecuritySaving(false);
    }
  };

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

  const formattedExpiry = selectedTenant ? format(new Date(selectedTenant.licenseExpiresAt), "dd/MM/yyyy") : "";

  const formattedCreated = selectedTenant ? format(new Date(selectedTenant.createdAt || selectedTenant.trialStart), "dd/MM/yyyy") : "";

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
            leftIcon={<Plus className="w-4 h-4 text-white" />}
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
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">Search</label>
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
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">Select Tenant</label>
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
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">Status</label>
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
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">Plan</label>
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
          <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No workspace selected</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mt-1">
            Choose a workspace from the search or dropdown above to view its details.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* TOP TENANT BANNER */}
          <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center space-x-4">
              <div className="w-12 h-12 sm:w-13 sm:h-13 bg-[#635BFF] rounded-2xl flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-md shadow-indigo-200 dark:shadow-indigo-950 shrink-0">
                {selectedTenant.companyName.charAt(0).toUpperCase()}
              </div>

              <div className="space-y-1 text-left">
                {/* Name & Status Badge with Lucide Icon */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                    {selectedTenant.companyName}
                  </h2>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold tracking-wide uppercase flex items-center gap-1",
                    selectedTenant.status === "active" || selectedTenant.status === "trial" 
                      ? "bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60" 
                      : selectedTenant.status === "suspended" 
                      ? "bg-red-100/80 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200/60 dark:border-red-800/60" 
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  )}>
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
                  {selectedTenant.customDomain || `${selectedTenant.slug}.${baseDomain}`}
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

            {/* Actions Split Button Group (Action label + Three-dot menu) */}
            <div className="flex items-center self-start md:self-center shrink-0">
              <div className="inline-flex rounded-[12px] border border-indigo-200/90 dark:border-indigo-800/80 bg-white dark:bg-[#0B131A] shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsActionsOpen(!isActionsOpen)}
                  className="h-[36px] px-3.5 text-xs font-semibold text-[#635BFF] dark:text-indigo-400 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50 transition-colors flex items-center gap-1.5 cursor-pointer border-r border-indigo-200/80 dark:border-indigo-800/80"
                >
                  <span>Action</span>
                </button>

                <Popover open={isActionsOpen} onOpenChange={setIsActionsOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-[36px] px-2.5 text-xs font-extrabold text-[#635BFF] dark:text-indigo-400 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50 transition-colors flex items-center justify-center cursor-pointer"
                      title="More Actions"
                    >
                      <MoreHorizontal className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" sideOffset={6} className="w-56 p-1.5 bg-white dark:bg-[#121B22] border border-slate-200 dark:border-slate-800 rounded-[14px] shadow-xl space-y-1 z-50 text-left">
                    {/* Option 1: Reset Admin Password */}
                    <button
                      type="button"
                      onClick={() => { setIsActionsOpen(false); setIsSecurityModalOpen(true); }}
                      className="w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-[#635BFF] dark:hover:text-indigo-400 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Key className="w-4 h-4 text-[#635BFF] stroke-[2]" />
                      Reset Admin Password
                    </button>

                    {/* Option 2: Toggle Workspace Status (Suspend / Activate) */}
                    <button
                      type="button"
                      onClick={() => { setIsActionsOpen(false); handleToggleStatus(selectedTenant.id, selectedTenant.status); }}
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

                    {/* Option 3: Delete Workspace (if suspended/cancelled) */}
                    {['suspended', 'cancelled'].includes(selectedTenant.status) && selectedTenant.slug !== 'primary' && (
                      <button
                        type="button"
                        onClick={() => { setIsActionsOpen(false); setDeletingTenant(selectedTenant); setDeleteConfirmSlug(""); }}
                        className="w-full px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800"
                      >
                        <Trash2 className="w-4 h-4 text-red-600 stroke-[1.8]" />
                        Delete Workspace
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* MIDDLE 2 DETAILED CARDS: 1. Admin Info + 2. Subscription Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Card 1: Admin Info */}
            <div className="bg-white dark:bg-[#0B131A]/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4 text-left flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 -mx-4 px-4 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                  <Users className="w-5 h-5 text-[#635BFF]" />
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Primary Admin Information</span>
                </div>

                <div className="space-y-2.5 text-left">
                  <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserCheck className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Contact Name</span>
                    </div>
                    <span className="text-xs font-normal text-slate-600 dark:text-slate-400 text-left truncate">
                      {selectedTenant.adminName || selectedTenant.companyName + " Admin"}
                    </span>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Email</span>
                    </div>
                    <span className="text-xs font-normal text-slate-600 dark:text-slate-400 text-left truncate">
                      {selectedTenant.adminEmail}
                    </span>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Phone className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Phone</span>
                    </div>
                    <span className="text-xs font-normal text-slate-600 dark:text-slate-400 text-left truncate">
                      {selectedTenant.adminPhone || "—"}
                    </span>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Registered</span>
                    </div>
                    <span className="text-xs font-normal text-slate-600 dark:text-slate-400 text-left truncate">
                      {formattedCreated}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3 flex justify-end">
                <AppButton
                  variant="primary"
                  leftIcon={<Edit2 className="w-3.5 h-3.5 text-white" />}
                  onClick={() => setIsAdminModalOpen(true)}
                >
                  Edit
                </AppButton>
              </div>
            </div>

            {/* Card 2: Subscription Details */}
            <div className="bg-white dark:bg-[#0B131A]/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4 text-left flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 -mx-4 px-4 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                  <CreditCard className="w-5 h-5 text-[#635BFF]" />
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Subscription Details</span>
                </div>

                <div className="space-y-2.5 text-left">
                  <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Gift className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Plan</span>
                    </div>
                    <span className="text-xs font-bold text-[#635BFF] dark:text-[#0BDBB9] text-left truncate">
                      {selectedTenant.plan?.displayName || 'Free Plan'}
                    </span>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Billing Cycle</span>
                    </div>
                    <span className="text-xs font-normal text-slate-600 dark:text-slate-400 text-left truncate">Monthly</span>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <DollarSign className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Amount</span>
                    </div>
                    <span className="text-xs font-normal text-slate-600 dark:text-slate-400 text-left truncate">
                      {selectedTenant.plan?.priceMonthly ? `₹${selectedTenant.plan.priceMonthly} / month` : '₹0 / month'}
                    </span>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Expiry Date</span>
                    </div>
                    <span className="text-xs font-normal text-slate-600 dark:text-slate-400 text-left truncate">
                      {formattedExpiry}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Action Area: Renew Plan + Edit Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3 flex items-center justify-end gap-2.5">
                <AppButton
                  variant="success"
                  leftIcon={<RefreshCw className="w-3.5 h-3.5 text-white" />}
                  onClick={() => handleOpenRenewModal(selectedTenant)}
                >
                  Renew Plan
                </AppButton>
                <AppButton
                  variant="primary"
                  leftIcon={<Edit2 className="w-3.5 h-3.5 text-white" />}
                  onClick={() => setIsSubModalOpen(true)}
                >
                  Edit
                </AppButton>
              </div>
            </div>
          </div>

          {/* DEDICATED INNER CARD: Wrapping Tabs and their details inside a card */}
          <div className="bg-white dark:bg-[#0B131A]/60 border border-slate-200/90 dark:border-slate-800/80 rounded-[14px] p-4 shadow-2xs space-y-4 text-left">
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
                              View PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "logs" && (
              <div className="space-y-4 animate-in fade-in duration-200 text-left">
                <div className="relative border-l-2 border-indigo-150 dark:border-indigo-900/60 ml-4 pl-6 space-y-5 py-2">
                  {getAuditLogsList(selectedTenant).map((log, idx) => {
                    const IconComp = log.icon;
                    return (
                      <div key={idx} className="relative">
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

      {/* Add New Tenant Workspace Modal Dialog (3-Column Layout: Workspace | Admin | Subscription) */}
      <ModalDialog
        open={isAddTenantModalOpen}
        onOpenChange={(val) => handleResetAddTenantModal(val)}
        title="Add New Tenant Workspace"
        icon={<Building2 className="w-5 h-5 text-[#635BFF]" />}
        showSaveButton={false}
        maxWidth="md:max-w-[840px]"
        footer={
          <div className="flex items-center justify-end w-full">
            <CreateUserButton
              mode="create"
              variant="primary"
              size="md"
              className="w-full sm:w-auto px-8"
              asyncState={addTenantAsyncState}
              loadingText="Provisioning Tenant..."
              successText="Tenant Provisioned!!"
              onClick={handleAddTenantSubmit}
            >
              Provision Tenant Workspace
            </CreateUserButton>
          </div>
        }
      >
        <div className="space-y-6 text-left">
          {/* Section 1: Primary Admin Contact (Contact Name 4/12 + Email 5/12 + PhoneInput 3/12) */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-[#635BFF]">
              <UserCheck className="w-3.5 h-3.5" />
              <span>1. Primary Admin Contact</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
              {/* Contact Name (4/12 width) */}
              <div className="md:col-span-4">
                <FormInput
                  label="Contact Name *"
                  value={newAdminName}
                  onChange={(e) => {
                    setNewAdminName(e.target.value);
                    if (addTenantErrors.adminName) setAddTenantErrors(prev => ({ ...prev, adminName: undefined }));
                  }}
                  placeholder="e.g. Alok Kumar"
                  error={addTenantErrors.adminName}
                />
              </div>

              {/* Admin Email Address (5/12 width - increased) */}
              <div className="md:col-span-5">
                <FormInput
                  label="Admin Email Address *"
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => {
                    setNewAdminEmail(e.target.value);
                    if (addTenantErrors.adminEmail) setAddTenantErrors(prev => ({ ...prev, adminEmail: undefined }));
                  }}
                  placeholder="e.g. admin@acmecorp.com"
                  error={addTenantErrors.adminEmail}
                />
              </div>

              {/* Admin Phone with Country Code (3/12 width - reduced, matches slug width below) */}
              <div className="md:col-span-3">
                <PhoneInput
                  label="Phone Number *"
                  id="addTenantPhoneInput"
                  value={newAdminPhone}
                  countryCode={newAdminCountryCode}
                  onCountryChange={(code) => setNewAdminCountryCode(code)}
                  error={addTenantErrors.adminPhone}
                  onChange={(e) => {
                    setNewAdminPhone(e.target.value);
                    if (addTenantErrors.adminPhone) setAddTenantErrors(prev => ({ ...prev, adminPhone: undefined }));
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Workspace Details (Company Name full width, Workspace Name 9/12, Workspace Slug 3/12) */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-[#635BFF]">
              <Building2 className="w-3.5 h-3.5" />
              <span>2. Workspace Details</span>
            </div>
            
            {/* Row 1: Company Name (Full Width) */}
            <div>
              <FormInput
                label="Company Name *"
                value={newCompanyName}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewCompanyName(val);
                  const simplified = val.replace(/\b(PVT|LTD|PRIVATE|LIMITED|LLP|INC|CORP|LLC)\b/gi, "").trim();
                  if (!newWorkspaceName || newWorkspaceName === newCompanyName) {
                    setNewWorkspaceName(simplified || val);
                  }
                  const autoSlug = (simplified || val).toLowerCase().replace(/[^a-z0-9]/g, '');
                  if (!newSlug || newSlug === newCompanyName.toLowerCase().replace(/[^a-z0-9]/g, '')) {
                    setNewSlug(autoSlug);
                  }
                  if (addTenantErrors.companyName) setAddTenantErrors(prev => ({ ...prev, companyName: undefined }));
                }}
                placeholder="e.g. KANISHKAM ENTERPRISES PRIVATE LIMITED"
                error={addTenantErrors.companyName}
              />
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-1 pl-0.5">
                Official registered legal entity name
              </span>
            </div>

            {/* Row 2: Workspace Name (9/12 wider) + Workspace Slug (3/12 matching phone number width above!) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
              <div className="md:col-span-9">
                <FormInput
                  label="Workspace Name *"
                  value={newWorkspaceName}
                  onChange={(e) => {
                    setNewWorkspaceName(e.target.value);
                    if (addTenantErrors.workspaceName) setAddTenantErrors(prev => ({ ...prev, workspaceName: undefined }));
                  }}
                  placeholder="e.g. Kanishkam Enterprises"
                  error={addTenantErrors.workspaceName}
                />
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-1 pl-0.5">
                  Display name inside workspace
                </span>
              </div>

              <div className="md:col-span-3">
                <FormInput
                  label="Workspace Slug *"
                  value={newSlug}
                  onChange={(e) => {
                    const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                    setNewSlug(sanitized);
                    if (addTenantErrors.slug) setAddTenantErrors(prev => ({ ...prev, slug: undefined }));
                  }}
                  placeholder="e.g. kanishkam"
                  error={addTenantErrors.slug}
                />
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-1 pl-0.5 truncate">
                  URL: <code className="font-semibold text-brand-primary">{newSlug || "slug"}.{baseDomain}</code>
                </span>
              </div>
            </div>
          </div>
        </div>
      </ModalDialog>

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
      <ModalDialog
        open={isAdminModalOpen}
        onOpenChange={setIsAdminModalOpen}
        title="Edit Admin Information"
        icon={<Users className="w-5 h-5 text-[#635BFF]" />}
        buttonMode="edit"
        buttonVariant="secondary"
        asyncState={adminAsyncState}
        onSave={handleSaveAdminInfo}
      >
        <FormInput
          label="Contact Name"
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
          value={adminPhoneInput}
          onChange={(e) => {
            setAdminPhoneInput(e.target.value);
            if (adminErrors.adminPhone) setAdminErrors((prev) => ({ ...prev, adminPhone: undefined }));
          }}
          placeholder="Enter phone number..."
          error={adminErrors.adminPhone}
        />
      </ModalDialog>

      {/* Dedicated Modal Dialog 2: Edit Subscription */}
      <ModalDialog
        open={isSubModalOpen}
        onOpenChange={setIsSubModalOpen}
        title="Edit Subscription & Plan Setup"
        icon={<CreditCard className="w-5 h-5 text-[#635BFF]" />}
        maxWidth="sm:max-w-[480px]"
        buttonMode="edit"
        buttonVariant="secondary"
        asyncState={subAsyncState}
        onSave={handleSaveSubDetails}
      >
        <div className="flex flex-col text-left mb-3">
          <label className="block text-[13px] font-medium mb-1.5 text-slate-600 dark:text-slate-400">
            Subscription Plan
          </label>
          <Combobox
            options={[
              { value: "", label: "Free Plan ($0.00/mo)" },
              ...(plansList?.map((p: any) => ({
                value: p.id,
                label: `${p.displayName} (₹${p.priceMonthly}/mo — Max ${p.maxEmployees} Employees, ${p.maxModerators} Moderators)`
              })) || [])
            ]}
            value={selectedPlanId}
            onSelect={(val: string) => setSelectedPlanId(val)}
            placeholder="Select Subscription Plan..."
            searchPlaceholder="Search plans..."
          />
        </div>

        {/* Single Row Layout for Overrides and Expiration Date with Compact Input Widths */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <FormInput
            label="Employees Overrides"
            type="number"
            value={empOverride}
            onChange={(e) => setEmpOverride(e.target.value)}
            placeholder="Default"
            className="w-full max-w-[130px]"
          />

          <FormInput
            label="Moderators Override"
            type="number"
            value={modOverride}
            onChange={(e) => setModOverride(e.target.value)}
            placeholder="Default"
            className="w-full max-w-[130px]"
          />

          <div className="flex flex-col text-left w-full">
            <label className="block text-[13px] font-medium mb-1.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
              Expiry Date
            </label>
            <div className="w-full">
              <DatePicker date={expiryDate} setDate={setExpiryDate} />
            </div>
          </div>
        </div>
      </ModalDialog>

      {/* Dedicated Modal Dialog 3: Reset Admin Password with Real-time Strength & Rules Checklist */}
      <ModalDialog
        open={isSecurityModalOpen}
        onOpenChange={setIsSecurityModalOpen}
        title="Reset Admin Password"
        icon={<Key className="w-5 h-5 text-[#635BFF]" />}
        buttonMode="reset"
        buttonVariant="primary"
        asyncState={securityAsyncState}
        onSave={handleSaveSecurity}
      >
        <FormPasswordInput
          label="New Password"
          showStrength={true}
          value={newSecPassword}
          onChange={(e) => {
            setNewSecPassword(e.target.value);
            if (securityErrors.newPassword) setSecurityErrors((prev) => ({ ...prev, newPassword: undefined }));
          }}
          placeholder="Enter new password (min 8 characters)"
          error={securityErrors.newPassword}
        />

        <FormPasswordInput
          label="Confirm Password"
          value={confirmSecPassword}
          onChange={(e) => {
            setConfirmSecPassword(e.target.value);
            if (securityErrors.confirmPassword) setSecurityErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }}
          placeholder="Re-enter password to confirm"
          error={securityErrors.confirmPassword}
        />
      </ModalDialog>

      {/* Dedicated Modal Dialog 4: Renew Tenant Subscription & Extend License */}
      <ModalDialog
        open={isRenewModalOpen}
        onOpenChange={setIsRenewModalOpen}
        title="Renew Subscription & Extend License"
        icon={<RefreshCw className="w-5 h-5 text-[#635BFF]" />}
        maxWidth="sm:max-w-[540px]"
        buttonMode="edit"
        buttonVariant="secondary"
        saveText="Renew & Extend License"
        asyncState={renewAsyncState}
        onSave={handleRenewSubscription}
      >
        {selectedTenant && (
          <div className="space-y-3.5 text-left">
            {/* Tenant Overview Card */}
            <div className="p-3 bg-slate-50 dark:bg-[#121B22] border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Workspace</span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{selectedTenant.companyName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Current Expiry</span>
                <span className="text-xs font-mono font-bold text-brand-primary">
                  {selectedTenant.licenseExpiresAt ? format(new Date(selectedTenant.licenseExpiresAt), "dd/MM/yyyy") : "N/A"}
                </span>
              </div>
            </div>

            {/* Row 1: Subscription Tier & Renewal Period (Single Row) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium mb-1.5 text-slate-600 dark:text-slate-400">
                  Subscription Tier
                </label>
                <Combobox
                  options={[
                    { value: "", label: "Free Plan ($0.00/mo)" },
                    ...(plansList?.map((p: any) => ({
                      value: p.id,
                      label: `${p.displayName} (₹${p.priceMonthly}/mo)`
                    })) || [])
                  ]}
                  value={renewPlanId}
                  onSelect={(val) => setRenewPlanId(val)}
                  placeholder="Select Plan..."
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium mb-1.5 text-slate-600 dark:text-slate-400">
                  Renewal Period
                </label>
                <Combobox
                  options={[
                    { value: "1m", label: "+1 Month" },
                    { value: "3m", label: "+3 Month" },
                    { value: "6m", label: "+6 Month" },
                    { value: "1y", label: "+1 Year" },
                    { value: "custom", label: "Custom" },
                  ]}
                  value={renewPeriod}
                  onSelect={(val) => handleRenewalPeriodChange(val)}
                  placeholder="Select Period..."
                />
              </div>
            </div>

            {/* Row 2: Custom Expiry Date & New Extended Expiry (Single Row) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-[13px] font-medium mb-1.5 text-slate-600 dark:text-slate-400">
                  Custom Expiry Date
                </label>
                <div className="w-full">
                  <DatePicker
                    date={renewExpiryDate}
                    minDate={baseRenewalDate}
                    setDate={(date) => {
                      if (date) {
                        setRenewExpiryDate(date);
                        setRenewPeriod("custom");
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col text-left">
                <label className="block text-[13px] font-medium mb-1.5 text-slate-600 dark:text-slate-400">
                  New Extended Expiry
                </label>
                <div className="h-[38px] px-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 rounded-[12px] flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300">Expires:</span>
                  <span className="font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    {renewExpiryDate ? format(renewExpiryDate, "dd/MM/yyyy") : "Not set"}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 3: Dynamic Total Amount Calculation */}
            <div className="p-3 bg-slate-50 dark:bg-[#0B131A] border border-slate-200/80 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-slate-600 dark:text-slate-300 font-semibold">Total Renewal Amount</span>
                <div className="text-[11px] text-slate-400">
                  {selectedRenewPlan?.displayName || "Free Plan"} • {renewPeriod === "custom" ? `${renewDaysDiff} Days Extension` : renewPeriod === "1m" ? "+1 Month (+30 Days)" : renewPeriod === "3m" ? "+3 Months (+90 Days)" : renewPeriod === "6m" ? "+6 Months (+180 Days)" : "+1 Year (+365 Days)"}
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-extrabold text-[#635BFF] dark:text-[#0BDBB9]">
                  ₹{renewalTotalAmount.toLocaleString()}
                </span>
                <span className="block text-[10px] text-slate-400">Total Payable</span>
              </div>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
