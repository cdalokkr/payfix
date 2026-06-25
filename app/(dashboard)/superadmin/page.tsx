"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { 
  Building2, Users, Calendar, Shield, CreditCard, 
  Search, Plus, Edit2, Check, X, ShieldAlert,
  Loader2, Trash2, Power
} from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminPage() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"tenants" | "plans">("tenants");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal states for editing tenants
  const [editingTenant, setEditingTenant] = useState<any | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [empOverride, setEmpOverride] = useState<string>("");
  const [modOverride, setModOverride] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");

  // Modal states for creating/editing plans
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "",
    displayName: "",
    priceMonthly: "0.00",
    maxEmployees: 10,
    maxModerators: 2,
  });
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  // Queries
  const { data: tenantsList, isLoading: loadingTenants } = trpc.superadmin.listTenants.useQuery();
  const { data: plansList, isLoading: loadingPlans } = trpc.superadmin.listPlans.useQuery();

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
      setEditingTenant(null);
      utils.superadmin.listTenants.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update tenant plan");
    }
  });

  const createPlanMutation = trpc.superadmin.createPlan.useMutation({
    onSuccess: () => {
      toast.success("New subscription plan created!");
      setIsPlanModalOpen(false);
      utils.superadmin.listPlans.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create plan");
    }
  });

  const updatePlanLimitsMutation = trpc.superadmin.updatePlan.useMutation({
    onSuccess: () => {
      toast.success("Plan updated successfully!");
      setEditingPlan(null);
      utils.superadmin.listPlans.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update plan");
    }
  });

  // Action handlers
  const handleToggleStatus = (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "suspended" ? "active" : "suspended";
    updateStatusMutation.mutate({ tenantId, status: nextStatus });
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

  const handleSaveTenantPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    updatePlanMutation.mutate({
      tenantId: editingTenant.id,
      planId: selectedPlanId || null,
      maxEmployeesOverride: empOverride.trim() !== "" ? parseInt(empOverride) : null,
      maxModeratorsOverride: modOverride.trim() !== "" ? parseInt(modOverride) : null,
      licenseExpiresAt: new Date(expiryDate).toISOString(),
    });
  };

  const handleOpenCreatePlan = () => {
    setPlanForm({
      name: "",
      displayName: "",
      priceMonthly: "0.00",
      maxEmployees: 10,
      maxModerators: 2,
    });
    setEditingPlan(null);
    setIsPlanModalOpen(true);
  };

  const handleOpenEditPlan = (plan: any) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      displayName: plan.displayName,
      priceMonthly: plan.priceMonthly,
      maxEmployees: plan.maxEmployees,
      maxModerators: plan.maxModerators,
    });
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlan) {
      updatePlanLimitsMutation.mutate({
        id: editingPlan.id,
        displayName: planForm.displayName,
        priceMonthly: planForm.priceMonthly,
        maxEmployees: planForm.maxEmployees,
        maxModerators: planForm.maxModerators,
        isActive: true,
      });
    } else {
      createPlanMutation.mutate({
        name: planForm.name,
        displayName: planForm.displayName,
        priceMonthly: planForm.priceMonthly,
        maxEmployees: planForm.maxEmployees,
        maxModerators: planForm.maxModerators,
        features: {},
      });
    }
  };

  // Filters
  const filteredTenants = tenantsList?.filter(t => 
    t.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.adminEmail.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
            <Shield className="h-8 w-8 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Super Admin Control Plane
            </h1>
            <p className="text-slate-400 text-sm">
              Manage platform workspaces, subscription plans, and dynamic parameters.
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl self-start md:self-center">
          <button
            id="tab-tenants"
            onClick={() => setActiveTab("tenants")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "tenants" 
                ? "bg-indigo-600 text-white shadow-lg" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Tenants
          </button>
          <button
            id="tab-plans"
            onClick={() => setActiveTab("plans")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "plans" 
                ? "bg-indigo-600 text-white shadow-lg" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Plans
          </button>
        </div>
      </div>

      {activeTab === "tenants" ? (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between bg-slate-900/60 p-4 border border-slate-850 rounded-2xl backdrop-blur-xl">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                id="search-tenants"
                type="text"
                placeholder="Search by company name, slug or admin email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl py-2.5 pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Showing <b>{filteredTenants.length}</b> tenants</span>
            </div>
          </div>

          {/* Tenants Grid/Table */}
          {loadingTenants ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
              <span className="text-slate-400 text-sm">Loading tenants registry...</span>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-slate-800 rounded-3xl bg-slate-900/20">
              <ShieldAlert className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-1">No Tenants Found</h3>
              <p className="text-slate-500 text-sm">No workspace matches your search query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-850 rounded-2xl bg-slate-900/40 backdrop-blur-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold bg-slate-900/60">
                    <th className="py-4 px-6">Company & Domain</th>
                    <th className="py-4 px-6">Assigned Plan</th>
                    <th className="py-4 px-6">License Expiration</th>
                    <th className="py-4 px-6">Users (Emp/Mod)</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-sm">
                  {filteredTenants.map((tenant) => {
                    const isExpired = new Date(tenant.licenseExpiresAt).getTime() < Date.now();
                    const formattedExpiry = new Date(tenant.licenseExpiresAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    });

                    return (
                      <tr key={tenant.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-base">{tenant.companyName}</span>
                            <span className="text-xs text-indigo-400 font-mono mt-0.5">{tenant.slug}.payfix.com</span>
                            <span className="text-xs text-slate-500 mt-1">{tenant.adminEmail}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-200">
                              {tenant.plan?.displayName || "No Plan"}
                            </span>
                            <span className="text-[10px] text-slate-500 mt-0.5">
                              Limits: {tenant.maxEmployeesOverride || tenant.plan?.maxEmployees || 5} Emp / {tenant.maxModeratorsOverride || tenant.plan?.maxModerators || 2} Mod
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-500" />
                            <div className="flex flex-col">
                              <span className={`font-medium ${isExpired ? "text-red-400 font-semibold" : "text-slate-200"}`}>
                                {formattedExpiry}
                              </span>
                              {isExpired && (
                                <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Expired</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-center text-xs w-32">
                              <span className="text-slate-500">Employees:</span>
                              <span className="font-mono text-slate-300 font-bold">
                                {tenant.employeeCount} / {tenant.maxEmployeesOverride || tenant.plan?.maxEmployees || 5}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs w-32">
                              <span className="text-slate-500">Moderators:</span>
                              <span className="font-mono text-slate-300 font-bold">
                                {tenant.moderatorCount} / {tenant.maxModeratorsOverride || tenant.plan?.maxModerators || 2}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            tenant.status === "active" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                            tenant.status === "trial" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                            "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}>
                            {tenant.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          <button
                            onClick={() => handleOpenEditTenant(tenant)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg hover:text-white transition-colors"
                            title="Edit Plan & Limits"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleToggleStatus(tenant.id, tenant.status)}
                            className={`p-2 rounded-lg transition-colors ${
                              tenant.status === "suspended" 
                                ? "bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white" 
                                : "bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white"
                            }`}
                            title={tenant.status === "suspended" ? "Activate tenant" : "Suspend tenant"}
                            disabled={updateStatusMutation.isPending}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Plans Action Bar */}
          <div className="flex justify-between items-center bg-slate-900/60 p-4 border border-slate-850 rounded-2xl backdrop-blur-xl">
            <span className="text-sm text-slate-400">Manage platform product tiers dynamically.</span>
            <button
              onClick={handleOpenCreatePlan}
              className="flex items-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg hover:shadow-indigo-500/20"
            >
              <Plus className="h-4 w-4" />
              Create Plan
            </button>
          </div>

          {/* Plans Registry Table */}
          {loadingPlans ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
              <span className="text-slate-400 text-sm">Loading plans data...</span>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-850 rounded-2xl bg-slate-900/40 backdrop-blur-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold bg-slate-900/60">
                    <th className="py-4 px-6">Plan Name</th>
                    <th className="py-4 px-6">System Key</th>
                    <th className="py-4 px-6">Monthly Price</th>
                    <th className="py-4 px-6">Max Employees</th>
                    <th className="py-4 px-6">Max Moderators</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-sm">
                  {plansList?.map((plan) => (
                    <tr key={plan.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="py-4 px-6 font-bold text-white">{plan.displayName}</td>
                      <td className="py-4 px-6 font-mono text-xs text-indigo-400">{plan.name}</td>
                      <td className="py-4 px-6 font-semibold text-slate-200">${plan.priceMonthly}</td>
                      <td className="py-4 px-6 font-mono font-semibold text-slate-300">{plan.maxEmployees}</td>
                      <td className="py-4 px-6 font-mono font-semibold text-slate-300">{plan.maxModerators}</td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleOpenEditPlan(plan)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg hover:text-white transition-colors"
                          title="Edit Plan Configuration"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Tenant Dialog / Modal */}
      {editingTenant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-3xl p-6 w-full max-w-lg shadow-[0_25px_60px_rgba(0,0,0,0.4)] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-indigo-500" />
                Customize: {editingTenant.companyName}
              </h2>
              <button 
                onClick={() => setEditingTenant(null)} 
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTenantPlan} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Select Subscription Plan */}
                <div className="flex flex-col gap-2 col-span-2">
                  <label className="text-xs font-semibold text-slate-400">Assigned Plan</label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">No Plan (Standard limits apply)</option>
                    {plansList?.map(p => (
                      <option key={p.id} value={p.id}>{p.displayName} (${p.priceMonthly}/mo)</option>
                    ))}
                  </select>
                </div>

                {/* Overrides */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400">Custom Max Employees</label>
                  <input
                    type="number"
                    placeholder="Use plan default"
                    value={empOverride}
                    onChange={(e) => setEmpOverride(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400">Custom Max Moderators</label>
                  <input
                    type="number"
                    placeholder="Use plan default"
                    value={modOverride}
                    onChange={(e) => setModOverride(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-colors"
                  />
                </div>

                {/* License Expiration */}
                <div className="flex flex-col gap-2 col-span-2">
                  <label className="text-xs font-semibold text-slate-400">Licence Expiration Date (Datetime)</label>
                  <input
                    type="datetime-local"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-100 outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatePlanMutation.isPending}
                  className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-2"
                >
                  {updatePlanMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Overrides
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create/Edit Plan Dialog / Modal */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-3xl p-6 w-full max-w-md shadow-[0_25px_60px_rgba(0,0,0,0.4)] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-indigo-500" />
                {editingPlan ? "Edit Plan Details" : "Create Subscription Plan"}
              </h2>
              <button 
                onClick={() => setIsPlanModalOpen(false)} 
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400">Plan Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Silver Plan"
                  value={planForm.displayName}
                  onChange={(e) => setPlanForm({ ...planForm, displayName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-100 outline-none transition-colors"
                  required
                />
              </div>

              {!editingPlan && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400">Plan Key Name (Immutable)</label>
                  <input
                    type="text"
                    placeholder="e.g. silver"
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-100 outline-none transition-colors font-mono"
                    required
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400">Monthly Price (USD)</label>
                <input
                  type="text"
                  placeholder="29.99"
                  value={planForm.priceMonthly}
                  onChange={(e) => setPlanForm({ ...planForm, priceMonthly: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-100 outline-none transition-colors"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400">Max Allowed Employees</label>
                <input
                  type="number"
                  placeholder="15"
                  value={planForm.maxEmployees}
                  onChange={(e) => setPlanForm({ ...planForm, maxEmployees: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-100 outline-none transition-colors"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400">Max Allowed Moderators</label>
                <input
                  type="number"
                  placeholder="2"
                  value={planForm.maxModerators}
                  onChange={(e) => setPlanForm({ ...planForm, maxModerators: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-100 outline-none transition-colors"
                  required
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPlanMutation.isPending || updatePlanLimitsMutation.isPending}
                  className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-2"
                >
                  {(createPlanMutation.isPending || updatePlanLimitsMutation.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {editingPlan ? "Save Plan" : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
