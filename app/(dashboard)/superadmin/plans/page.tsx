"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { 
  Building2, Users, Calendar, Shield, CreditCard, 
  Plus, Edit2, Check, X, Loader2, CheckCircle2, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { MetricCard } from "@/components/dashboard/metric-card";

export default function PlansPage() {
  const utils = trpc.useUtils();
  
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
      setIsPlanModalOpen(false);
      utils.superadmin.listPlans.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update plan");
    }
  });

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

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 text-foreground font-sans">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 pb-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Subscription Plans Control
            </h1>
            <p className="text-muted-foreground text-sm">
              Configure SaaS subscription levels, resource limits, and monthly price tiers.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Workspaces"
          value={tenantsList?.length || 0}
          description="Registered SaaS workspaces"
          icon={<Building2 />}
          loading={loadingTenants}
          iconBgColor="bg-blue-500/20"
          iconColor="text-blue-700 dark:text-blue-400"
          borderColor="border-x-gray-200/80 border-b-gray-200/80 dark:border-x-zinc-800 dark:border-b-zinc-800"
          gradientColor="from-blue-500/10 to-blue-500/5"
          cardBgColor="bg-[#FFFFFF] dark:bg-zinc-900"
          topBorderColor="border-t-blue-700 dark:border-t-blue-500"
          hoverBorderColor="hover:border-t-blue-700 hover:border-x-blue-500/30 hover:border-b-blue-500/30 dark:hover:border-t-blue-500 dark:hover:border-x-blue-500/40 dark:hover:border-b-blue-500/40"
          hoverShadowColor="hover:shadow-[0_8px_30px_rgba(29,78,216,0.12)] dark:hover:shadow-[0_8px_30px_rgba(59,130,246,0.2)]"
          delay={0.2}
          padding="p-3 sm:p-3.5"
        />
        <MetricCard
          title="Active & Trial"
          value={tenantsList?.filter(t => t.status === 'active' || t.status === 'trial').length || 0}
          description="Healthy running workspaces"
          icon={<CheckCircle2 />}
          loading={loadingTenants}
          iconBgColor="bg-emerald-500/20"
          iconColor="text-emerald-700 dark:text-emerald-400"
          borderColor="border-x-gray-200/80 border-b-gray-200/80 dark:border-x-zinc-800 dark:border-b-zinc-800"
          gradientColor="from-emerald-500/10 to-emerald-500/5"
          cardBgColor="bg-[#FFFFFF] dark:bg-zinc-900"
          topBorderColor="border-t-emerald-700 dark:border-t-emerald-500"
          hoverBorderColor="hover:border-t-emerald-700 hover:border-x-emerald-500/30 hover:border-b-emerald-500/30 dark:hover:border-t-emerald-500 dark:hover:border-x-emerald-500/40 dark:hover:border-b-emerald-500/40"
          hoverShadowColor="hover:shadow-[0_8px_30px_rgba(4,120,87,0.12)] dark:hover:shadow-[0_8px_30px_rgba(16,185,129,0.2)]"
          delay={0.3}
          padding="p-3 sm:p-3.5"
        />
        <MetricCard
          title="Suspended Workspaces"
          value={tenantsList?.filter(t => t.status === 'suspended' || t.status === 'cancelled').length || 0}
          description="Blocked or canceled contracts"
          icon={<XCircle />}
          loading={loadingTenants}
          iconBgColor="bg-rose-500/20"
          iconColor="text-rose-700 dark:text-rose-400"
          borderColor="border-x-gray-200/80 border-b-gray-200/80 dark:border-x-zinc-800 dark:border-b-zinc-800"
          gradientColor="from-rose-500/10 to-rose-500/5"
          cardBgColor="bg-[#FFFFFF] dark:bg-zinc-900"
          topBorderColor="border-t-rose-700 dark:border-t-rose-500"
          hoverBorderColor="hover:border-t-rose-700 hover:border-x-rose-500/30 hover:border-b-rose-500/30 dark:hover:border-t-rose-500 dark:hover:border-x-rose-500/40 dark:hover:border-b-rose-500/40"
          hoverShadowColor="hover:shadow-[0_8px_30px_rgba(225,29,72,0.12)] dark:hover:shadow-[0_8px_30px_rgba(248,113,113,0.2)]"
          delay={0.4}
          padding="p-3 sm:p-3.5"
        />
        <MetricCard
          title="Subscription Plans"
          value={plansList?.length || 0}
          description="Active platform product tiers"
          icon={<CreditCard />}
          loading={loadingPlans}
          iconBgColor="bg-amber-500/20"
          iconColor="text-amber-700 dark:text-amber-400"
          borderColor="border-x-gray-200/80 border-b-gray-200/80 dark:border-x-zinc-800 dark:border-b-zinc-800"
          gradientColor="from-amber-500/10 to-amber-500/5"
          cardBgColor="bg-[#FFFFFF] dark:bg-zinc-900"
          topBorderColor="border-t-amber-700 dark:border-t-amber-500"
          hoverBorderColor="hover:border-t-amber-700 hover:border-x-amber-500/30 hover:border-b-amber-500/30 dark:hover:border-t-amber-500 dark:hover:border-x-amber-500/40 dark:hover:border-b-amber-500/40"
          hoverShadowColor="hover:shadow-[0_8px_30px_rgba(217,119,6,0.12)] dark:hover:shadow-[0_8px_30px_rgba(245,158,11,0.2)]"
          delay={0.5}
          padding="p-3 sm:p-3.5"
        />
      </div>

      {/* Plans Action Bar & Table */}
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-card/45 p-4 border border-border/60 rounded-2xl backdrop-blur-xl">
          <span className="text-sm text-muted-foreground">Manage platform product tiers dynamically.</span>
          <button
            onClick={handleOpenCreatePlan}
            className="flex items-center gap-2 py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-sm transition-all shadow-lg hover:shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            Create Plan
          </button>
        </div>

        {loadingPlans ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <span className="text-muted-foreground text-sm">Loading plans data...</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-border/60 rounded-2xl bg-card/30 backdrop-blur-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground text-xs font-semibold bg-muted/30">
                  <th className="py-4 px-6">Plan Name</th>
                  <th className="py-4 px-6">System Key</th>
                  <th className="py-4 px-6">Monthly Price</th>
                  <th className="py-4 px-6">Max Employees</th>
                  <th className="py-4 px-6">Max Moderators</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {plansList?.map((plan) => (
                  <tr key={plan.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-4 px-6 font-bold text-foreground">{plan.displayName}</td>
                    <td className="py-4 px-6 font-mono text-xs text-primary">{plan.name}</td>
                    <td className="py-4 px-6 font-semibold text-card-foreground">${plan.priceMonthly}</td>
                    <td className="py-4 px-6 font-mono font-semibold text-muted-foreground">{plan.maxEmployees}</td>
                    <td className="py-4 px-6 font-mono font-semibold text-muted-foreground">{plan.maxModifiers}</td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleOpenEditPlan(plan)}
                        className="p-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-colors"
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

      {/* Create/Edit Plan Dialog / Modal */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-border mb-6">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                {editingPlan ? "Edit Plan Details" : "Create Subscription Plan"}
              </h2>
              <button 
                onClick={() => setIsPlanModalOpen(false)} 
                className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground">Plan Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Silver Plan"
                  value={planForm.displayName}
                  onChange={(e) => setPlanForm({ ...planForm, displayName: e.target.value })}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl p-3 text-sm text-foreground outline-none transition-colors"
                  required
                />
              </div>

              {!editingPlan && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">Plan Key Name (Immutable)</label>
                  <input
                    type="text"
                    placeholder="e.g. silver"
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    className="w-full bg-background border border-border focus:border-primary rounded-xl p-3 text-sm text-foreground outline-none transition-colors font-mono"
                    required
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground">Monthly Price (USD)</label>
                <input
                  type="text"
                  placeholder="29.99"
                  value={planForm.priceMonthly}
                  onChange={(e) => setPlanForm({ ...planForm, priceMonthly: e.target.value })}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl p-3 text-sm text-foreground outline-none transition-colors"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground">Max Allowed Employees</label>
                <input
                  type="number"
                  placeholder="15"
                  value={planForm.maxEmployees}
                  onChange={(e) => setPlanForm({ ...planForm, maxEmployees: parseInt(e.target.value) || 0 })}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl p-3 text-sm text-foreground outline-none transition-colors"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground">Max Allowed Moderators</label>
                <input
                  type="number"
                  placeholder="2"
                  value={planForm.maxModerators}
                  onChange={(e) => setPlanForm({ ...planForm, maxModerators: parseInt(e.target.value) || 0 })}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl p-3 text-sm text-foreground outline-none transition-colors"
                  required
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="py-2.5 px-4 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPlanMutation.isPending || updatePlanLimitsMutation.isPending}
                  className="py-2.5 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-sm transition-colors flex items-center gap-2"
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
