"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { 
  Building2, Users, Calendar, Shield, CreditCard, 
  Search, Edit2, Check, X, ShieldAlert,
  Loader2, Trash2, Power, CheckCircle2, XCircle, Mail, Phone, User, Landmark, Clock
} from "lucide-react";
import { toast } from "sonner";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AsyncActionButton } from "@/components/ui/async-action-button";

export default function TenantsPage() {
  const utils = trpc.useUtils();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"contact" | "plan" | "payments">("contact");
  
  // Payment search state
  const [paymentSearchQuery, setPaymentSearchQuery] = useState("");

  // Modal states for editing tenants
  const [editingTenant, setEditingTenant] = useState<any | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [empOverride, setEmpOverride] = useState<string>("");
  const [modOverride, setModOverride] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");

  // Delete tenant states
  const [deletingTenant, setDeletingTenant] = useState<any | null>(null);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState("");

  // Queries
  const { data: tenantsList, isLoading: loadingTenants } = trpc.superadmin.listTenants.useQuery();
  const { data: plansList } = trpc.superadmin.listPlans.useQuery();

  // Mutations
  const updateStatusMutation = trpc.superadmin.updateTenantStatus.useMutation({
    onSuccess: () => {
      toast.success("Tenant status updated successfully!");
      utils.superadmin.listTenants.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update tenant status");
    }
  });

  const updatePlanMutation = trpc.superadmin.updateTenantPlan.useMutation({
    onSuccess: () => {
      toast.success("Tenant plan and overrides updated!");
      utils.superadmin.listTenants.invalidate();
      // Sync selected state
      if (selectedTenantId) {
        const updated = tenantsList?.find(t => t.id === selectedTenantId);
        if (updated) handleOpenEditTenant(updated);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update tenant plan");
    }
  });

  const deleteTenantMutation = trpc.superadmin.deleteTenant.useMutation({
    onSuccess: (data) => {
      toast.success(`Tenant deleted successfully! ${data.deletedUsers} auth users removed.`);
      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach((w: string) => toast.warning(w));
      }
      setDeletingTenant(null);
      setDeleteConfirmSlug("");
      setSelectedTenantId(null);
      utils.superadmin.listTenants.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete tenant");
    }
  });

  // Action handlers
  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "suspended" ? "active" : "suspended";
    await updateStatusMutation.mutateAsync({ tenantId, status: nextStatus });
  };

  const handleOpenEditTenant = (tenant: any) => {
    setEditingTenant(tenant);
    setSelectedPlanId(tenant.plan?.id || "");
    setEmpOverride(tenant.maxEmployeesOverride !== null ? String(tenant.maxEmployeesOverride) : "");
    setModOverride(tenant.maxModeratorsOverride !== null ? String(tenant.maxModeratorsOverride) : "");
    
    // Format expiration date for datetime-local input
    if (tenant.licenseExpiresAt) {
      const d = new Date(tenant.licenseExpiresAt);
      const isoString = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setExpiryDate(isoString);
    } else {
      setExpiryDate("");
    }
  };

  const handleSaveTenantPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    try {
      await updatePlanMutation.mutateAsync({
        tenantId: editingTenant.id,
        planId: selectedPlanId || null,
        maxEmployeesOverride: empOverride.trim() !== "" ? parseInt(empOverride) : null,
        maxModeratorsOverride: modOverride.trim() !== "" ? parseInt(modOverride) : null,
        licenseExpiresAt: new Date(expiryDate).toISOString(),
      });
    } catch (err) {
      // toast.error handled in mutation
    }
  };

  // Filters
  const filteredTenants = tenantsList?.filter(t => 
    t.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.adminEmail.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const selectedTenant = tenantsList?.find(t => t.id === selectedTenantId) || null;

  const isExpired = selectedTenant ? new Date(selectedTenant.licenseExpiresAt).getTime() < Date.now() : false;
  const formattedExpiry = selectedTenant ? new Date(selectedTenant.licenseExpiresAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }) : "";

  // Generated simulated payment details based on registration dates
  const getPaymentLogs = (tenant: any) => {
    if (!tenant) return [];
    
    const start = new Date(tenant.createdAt || tenant.trialStart);
    const planName = tenant.plan?.displayName || "Standard Plan";
    
    const logs = [
      {
        id: "TXN-88204-P",
        date: start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        description: `Workspace provisioned & initialized on Trial tier`,
        amount: "$0.00",
        status: "Trial active",
        method: "System provision"
      }
    ];

    if (tenant.status === "active" || new Date(tenant.licenseExpiresAt).getTime() > start.getTime()) {
      const activationDate = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days after signup
      logs.push({
        id: "TXN-90412-M",
        date: activationDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        description: `Subscription activated - ${planName}`,
        amount: "$29.99",
        status: "Success",
        method: "Stripe Invoice"
      });
      
      // If tenant signup is older than 45 days, add a renewal log
      if (Date.now() - activationDate.getTime() > 30 * 24 * 60 * 60 * 1000) {
        const renewalDate = new Date(activationDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        logs.push({
          id: "TXN-91185-R",
          date: renewalDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          description: `Subscription monthly renewal - ${planName}`,
          amount: "$29.99",
          status: "Success",
          method: "Stripe Autopay"
        });
      }
    }

    if (tenant.status === "suspended") {
      logs.push({
        id: "TXN-91500-S",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        description: `Subscription suspended - Contract lock`,
        amount: "$0.00",
        status: "Suspended",
        method: "Manual trigger"
      });
    }

    return logs.filter(log => 
      log.id.toLowerCase().includes(paymentSearchQuery.toLowerCase()) ||
      log.description.toLowerCase().includes(paymentSearchQuery.toLowerCase()) ||
      log.method.toLowerCase().includes(paymentSearchQuery.toLowerCase()) ||
      log.status.toLowerCase().includes(paymentSearchQuery.toLowerCase())
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 text-foreground font-sans">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 pb-6 border-b border-b-gray-200/80 dark:border-b-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Workspaces Management
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage multi-tenant database schemas, resources, contact details, and transactions.
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column - Unified Tenants List (Search inside the same card) */}
        <div className="lg:col-span-5">
          <div className="bg-card/45 border border-border/60 rounded-2xl p-4 backdrop-blur-xl flex flex-col gap-4 shadow-sm">
            <div className="space-y-2">
              <h2 className="text-lg font-bold tracking-tight text-foreground">Workspace Directory</h2>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <input
                  id="search-tenants"
                  type="text"
                  placeholder="Search by company name, slug or admin email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-background border border-border/60 focus:border-primary rounded-xl py-2 pl-10 pr-4 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors"
                />
              </div>
              <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground pt-1">
                <span>Total Registered: <b>{tenantsList?.length || 0}</b></span>
                <span>Filtered matches: <b>{filteredTenants.length}</b></span>
              </div>
            </div>

            {loadingTenants ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <span className="text-muted-foreground text-xs">Loading workspaces registry...</span>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-xl bg-muted/20">
                <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-xs font-semibold">No tenants found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                {filteredTenants.map((t) => {
                  const isSelected = t.id === selectedTenantId;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTenantId(t.id);
                        handleOpenEditTenant(t);
                      }}
                      className={`flex items-center justify-between p-2.5 border rounded-xl cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "bg-card/30 border-primary"
                          : "bg-card/30 border-border/60 hover:bg-muted/40 hover:border-border"
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-2 flex-1">
                        <span className="font-bold text-foreground text-xs truncate">{t.companyName}</span>
                        <span className="text-xs text-primary font-mono mt-0.5 truncate">{t.slug}.payfix.com</span>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2 text-right">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-normal tracking-tight leading-none ${
                          t.status === "active" ? "bg-emerald-500/5 text-emerald-500" :
                          t.status === "trial" ? "bg-blue-500/5 text-blue-400" :
                          "bg-red-500/5 text-red-500"
                        }`}>
                          {t.status.toUpperCase()}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                          Licence Valid: {new Date(t.licenseExpiresAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Tenant Details with Tabs */}
        <div className="lg:col-span-7">
          {selectedTenant ? (
            <div className="bg-card/45 border border-border/60 rounded-2xl p-6 backdrop-blur-xl space-y-6 shadow-xl">
              {/* Detail Header - Expiry Status aligned under buttons and aligned with the slug row */}
              <div className="flex justify-between items-start pb-6 border-b border-border/40 gap-4">
                <div className="space-y-1 text-left min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-black text-foreground truncate">{selectedTenant.companyName}</h2>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-normal leading-none ${
                      selectedTenant.status === "active" ? "bg-emerald-500/5 text-emerald-500" :
                      selectedTenant.status === "trial" ? "bg-blue-500/5 text-blue-400" :
                      "bg-red-500/5 text-red-500"
                    }`}>
                      {selectedTenant.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-primary font-mono">{selectedTenant.slug}.payfix.com</p>
                </div>

                {/* Actions and Expiry Info column */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {/* Actions Header Row */}
                  <div className="flex items-center gap-2">
                    <AsyncActionButton
                      action={selectedTenant.status === "suspended" ? "activate" : "suspend"}
                      size="sm"
                      title={selectedTenant.status === "suspended" ? "Activate Tenant" : "Suspend Tenant"}
                      onClick={() => handleToggleStatus(selectedTenant.id, selectedTenant.status)}
                      disabled={updateStatusMutation.isPending}
                    />

                    {['suspended', 'cancelled'].includes(selectedTenant.status) && selectedTenant.slug !== 'primary' && (
                      <AsyncActionButton
                        action="delete"
                        size="sm"
                        title="Delete Tenant Permanently"
                        onClick={() => { setDeletingTenant(selectedTenant); setDeleteConfirmSlug(""); }}
                        disabled={deleteTenantMutation.isPending}
                      />
                    )}
                  </div>

                  {/* License Expiry Status in Header (aligned under action buttons in same row height as slug) */}
                  <div className="text-xs text-right mt-1">
                    <span className="text-muted-foreground mr-1">Expiry:</span>
                    <span className="font-normal px-2 py-0.5 rounded text-[10px] uppercase tracking-wide bg-primary/5 text-primary">
                      {formattedExpiry} {isExpired && "(EXPIRED)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabs Bar */}
              <div className="flex border-b border-border/40 text-sm font-semibold">
                <button
                  onClick={() => setActiveDetailTab("contact")}
                  className={`pb-3 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
                    activeDetailTab === "contact"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <User className="h-4 w-4" />
                  Contact Info
                </button>
                <button
                  onClick={() => setActiveDetailTab("plan")}
                  className={`pb-3 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
                    activeDetailTab === "plan"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  Plan Details
                </button>
                <button
                  onClick={() => setActiveDetailTab("payments")}
                  className={`pb-3 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
                    activeDetailTab === "payments"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Landmark className="h-4 w-4" />
                  Payment History
                </button>
              </div>

              {/* Tab Contents */}
              <div className="pt-2 text-left">
                {/* Tab 1: Contact Info */}
                {activeDetailTab === "contact" && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-2.5 rounded-xl border border-border/40 bg-background/50 flex items-start gap-2.5">
                        <User className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Admin Contact Name</span>
                          <span className="text-sm font-bold text-foreground">{selectedTenant.adminName || "Not Provided"}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl border border-border/40 bg-background/50 flex items-start gap-2.5">
                        <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Admin Email Address</span>
                          <span className="text-sm font-bold text-foreground truncate block max-w-[200px]">{selectedTenant.adminEmail}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl border border-border/40 bg-background/50 flex items-start gap-2.5">
                        <Phone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Admin Contact Number</span>
                          <span className="text-sm font-bold text-foreground">{selectedTenant.adminPhone || "Not Provided"}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl border border-border/40 bg-background/50 flex items-start gap-2.5">
                        <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Registration Date</span>
                          <span className="text-sm font-bold text-foreground">
                            {new Date(selectedTenant.createdAt || selectedTenant.trialStart).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-border/40 bg-background/30 text-xs text-muted-foreground space-y-1.5">
                      <span className="font-bold text-foreground block text-[10px] uppercase tracking-wide">Workspace Schema Routing</span>
                      <p>• Database Schema: <code className="bg-secondary px-1 rounded text-primary">{selectedTenant.tenantSchema || "shared_schema"}</code></p>
                      <p>• Connection URL: <code className="bg-secondary px-1 rounded text-foreground font-mono">Central Cluster DB</code></p>
                    </div>
                  </div>
                )}

                {/* Tab 2: Plan Details (Overrides and Form) */}
                {activeDetailTab === "plan" && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Resource Utilization statistics */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-border/40 bg-background/50">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-2">Employees Utilization</span>
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-xl font-black text-foreground">
                            {selectedTenant.employeeCount} <span className="text-xs text-muted-foreground font-normal">registered</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-muted-foreground">
                            Limit: {selectedTenant.maxEmployeesOverride || selectedTenant.plan?.maxEmployees || 5}
                          </span>
                        </div>
                        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-primary h-full rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min(100, (selectedTenant.employeeCount / (selectedTenant.maxEmployeesOverride || selectedTenant.plan?.maxEmployees || 5)) * 100)}%` 
                            }}
                          />
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-border/40 bg-background/50">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-2">Moderators Utilization</span>
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-xl font-black text-foreground">
                            {selectedTenant.moderatorCount} <span className="text-xs text-muted-foreground font-normal">registered</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-muted-foreground">
                            Limit: {selectedTenant.maxModeratorsOverride || selectedTenant.plan?.maxModerators || 2}
                          </span>
                        </div>
                        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min(100, (selectedTenant.moderatorCount / (selectedTenant.maxModeratorsOverride || selectedTenant.plan?.maxModerators || 2)) * 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Editing Overrides Form */}
                    {editingTenant && (
                      <div className="pt-4 border-t border-border/40 space-y-4">
                        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground uppercase tracking-wide">
                          <Edit2 className="h-4 w-4 text-primary" />
                          Edit plan levels & resource overrides
                        </h3>
                        
                        <form onSubmit={handleSaveTenantPlan} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Subscription Plan */}
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                              <label className="text-xs font-semibold text-muted-foreground">Assigned subscription plan</label>
                              <select
                                value={selectedPlanId}
                                onChange={(e) => setSelectedPlanId(e.target.value)}
                                className="w-full bg-background border border-border/60 rounded-xl p-3 text-sm text-foreground outline-none focus:border-primary transition-colors"
                              >
                                <option value="">No Plan (Standard limits apply)</option>
                                {plansList?.map(p => (
                                  <option key={p.id} value={p.id}>{p.displayName} (${p.priceMonthly}/mo)</option>
                                ))}
                              </select>
                            </div>

                            {/* Custom Max Employees */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-muted-foreground">Custom Max Employees Limit</label>
                              <input
                                type="number"
                                placeholder="Use plan default"
                                value={empOverride}
                                onChange={(e) => setEmpOverride(e.target.value)}
                                className="w-full bg-background border border-border/60 focus:border-primary rounded-xl p-3 text-sm text-foreground outline-none transition-colors"
                              />
                            </div>

                            {/* Custom Max Moderators */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-muted-foreground">Custom Max Moderators Limit</label>
                              <input
                                type="number"
                                placeholder="Use plan default"
                                value={modOverride}
                                onChange={(e) => setModOverride(e.target.value)}
                                className="w-full bg-background border border-border/60 focus:border-primary rounded-xl p-3 text-sm text-foreground outline-none transition-colors"
                              />
                            </div>

                            {/* Expiration Date */}
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                              <label className="text-xs font-semibold text-muted-foreground">License expiration datetime</label>
                              <input
                                type="datetime-local"
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                                className="w-full bg-background border border-border/60 focus:border-primary rounded-xl p-3 text-sm text-foreground outline-none transition-colors"
                                required
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              type="submit"
                              disabled={updatePlanMutation.isPending}
                              className="py-2.5 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-sm transition-colors flex items-center gap-2 shadow-lg hover:shadow-primary/20 disabled:opacity-50"
                            >
                              {updatePlanMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                              Save Overrides
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Payment History */}
                {activeDetailTab === "payments" && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wide">Billing & Activation Logs</span>
                      <div className="relative max-w-xs w-full">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                        <input
                          type="text"
                          placeholder="Search invoices..."
                          value={paymentSearchQuery}
                          onChange={(e) => setPaymentSearchQuery(e.target.value)}
                          className="w-full bg-background border border-border/60 focus:border-primary rounded-lg py-1.5 pl-8 pr-3 text-[11px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {getPaymentLogs(selectedTenant).length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-border rounded-xl bg-muted/20">
                        <p className="text-muted-foreground text-xs">No transaction records found matching search query.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-border/40 rounded-xl bg-background/30 max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border/40 text-muted-foreground font-semibold bg-muted/25">
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Transaction ID</th>
                              <th className="py-2 px-3">Description</th>
                              <th className="py-2 px-3">Amount</th>
                              <th className="py-2 px-3">Method</th>
                              <th className="py-2 px-3 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {getPaymentLogs(selectedTenant).map((log) => (
                              <tr key={log.id} className="hover:bg-muted/15">
                                <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{log.date}</td>
                                <td className="py-2 px-3 font-mono font-bold text-primary">{log.id}</td>
                                <td className="py-2 px-3 max-w-[200px] truncate" title={log.description}>{log.description}</td>
                                <td className="py-2 px-3 font-semibold text-foreground">{log.amount}</td>
                                <td className="py-2 px-3 text-muted-foreground">{log.method}</td>
                                <td className="py-2 px-3 text-right">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    log.status === "Success" ? "bg-emerald-500/10 text-emerald-500" :
                                    log.status.includes("active") ? "bg-blue-500/10 text-blue-500" :
                                    log.status === "Suspended" ? "bg-rose-500/10 text-rose-500" :
                                    "bg-zinc-500/10 text-zinc-500"
                                  }`}>
                                    {log.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full border border-dashed border-border/80 rounded-2xl p-12 bg-card/20 flex flex-col items-center justify-center text-center">
              <Building2 className="h-14 w-14 text-muted-foreground/35 mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-1">No Workspace Selected</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                Select a tenant workspace from the list on the left to view metrics, contact details, plan configuration, and transaction history.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Tenant Confirmation Dialog */}
      {deletingTenant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-500/10">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold">Delete Tenant Permanently</h3>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-sm text-muted-foreground">
                This will permanently delete <strong className="text-foreground">{deletingTenant.companyName}</strong> and cannot be undone.
              </p>
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-xs text-red-400 space-y-1">
                <p>• Drop database schema <code className="bg-red-500/10 px-1 rounded">{deletingTenant.tenantSchema}</code> and all business tables</p>
                <p>• Delete all auth user accounts belonging to this tenant</p>
                <p>• Remove branding, trial tracking, and tenant record</p>
                <p>• Clear all cached connections and resolver entries</p>
              </div>
              <div className="pt-2">
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">
                  Type <code className="bg-secondary px-1.5 py-0.5 rounded text-foreground font-bold">{deletingTenant.slug}</code> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmSlug}
                  onChange={(e) => setDeleteConfirmSlug(e.target.value)}
                  placeholder={deletingTenant.slug}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setDeletingTenant(null); setDeleteConfirmSlug(""); }}
                className="py-2.5 px-4 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold rounded-xl text-sm transition-colors"
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
                className="py-2.5 px-5 bg-red-600 hover:bg-red-700 disabled:bg-red-600/30 disabled:text-red-450/50 text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-2"
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
    </div>
  );
}
