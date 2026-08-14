"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { 
  Building2, Users, Calendar, Shield, CreditCard, 
  Plus, Edit2, Check, X, Loader2, CheckCircle2, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { MetricCard } from "@/components/dashboard/metric-card";
import CreateUserButton, { AsyncState } from "@/components/ui/create-user-button";
import ModalDialog from "@/components/ui/modal-dialog";
import { FormInput } from "@/components/ui/form-input";

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
  const [planAsyncState, setPlanAsyncState] = useState<AsyncState>('idle');

  // Queries
  const { data: tenantsList, isLoading: loadingTenants } = trpc.superadmin.listTenants.useQuery();
  const { data: plansList, isLoading: loadingPlans } = trpc.superadmin.listPlans.useQuery();

  // Mutations
  const createPlanMutation = trpc.superadmin.createPlan.useMutation({
    onError: (err) => {
      toast.error(err.message || "Failed to create plan");
      setPlanAsyncState('error');
      setTimeout(() => setPlanAsyncState('idle'), 3000);
    }
  });

  const updatePlanLimitsMutation = trpc.superadmin.updatePlan.useMutation({
    onError: (err) => {
      toast.error(err.message || "Failed to update plan");
      setPlanAsyncState('error');
      setTimeout(() => setPlanAsyncState('idle'), 3000);
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
    setPlanAsyncState('idle');
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
    setPlanAsyncState('idle');
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.displayName.trim()) {
      toast.error("Please enter a display name for the plan.");
      return;
    }
    setPlanAsyncState('loading');
    try {
      if (editingPlan) {
        await updatePlanLimitsMutation.mutateAsync({
          id: editingPlan.id,
          displayName: planForm.displayName,
          priceMonthly: planForm.priceMonthly,
          maxEmployees: planForm.maxEmployees,
          maxModerators: planForm.maxModerators,
          isActive: true,
        });
        toast.success("Plan updated successfully!");
      } else {
        await createPlanMutation.mutateAsync({
          name: planForm.name || planForm.displayName.toLowerCase().replace(/\s+/g, '-'),
          displayName: planForm.displayName,
          priceMonthly: planForm.priceMonthly,
          maxEmployees: planForm.maxEmployees,
          maxModerators: planForm.maxModerators,
          features: {},
        });
        toast.success("New subscription plan created!");
      }
      setPlanAsyncState('success');
      utils.superadmin.listPlans.invalidate();
      await new Promise(r => setTimeout(r, 2000));
      setIsPlanModalOpen(false);
      setPlanAsyncState('idle');
    } catch (err) {
      setPlanAsyncState('error');
      setTimeout(() => setPlanAsyncState('idle'), 3000);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 text-foreground font-sans bg-[#F8FAFC] dark:bg-[#0B131A] min-h-screen transition-colors duration-200">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 pb-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Subscription Plans Control
            </h1>
            <p className="text-muted-foreground dark:text-slate-400 text-sm">
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
          borderColor="border-x-gray-200/80 border-b-gray-200/80 dark:border-x-slate-800 dark:border-b-slate-800"
          gradientColor="from-blue-500/10 to-blue-500/5"
          cardBgColor="bg-[#FFFFFF] dark:bg-[#121B22]"
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
          borderColor="border-x-gray-200/80 border-b-gray-200/80 dark:border-x-slate-800 dark:border-b-slate-800"
          gradientColor="from-emerald-500/10 to-emerald-500/5"
          cardBgColor="bg-[#FFFFFF] dark:bg-[#121B22]"
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
          borderColor="border-x-gray-200/80 border-b-gray-200/80 dark:border-x-slate-800 dark:border-b-slate-800"
          gradientColor="from-rose-500/10 to-rose-500/5"
          cardBgColor="bg-[#FFFFFF] dark:bg-[#121B22]"
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
          borderColor="border-x-gray-200/80 border-b-gray-200/80 dark:border-x-slate-800 dark:border-b-slate-800"
          gradientColor="from-amber-500/10 to-amber-500/5"
          cardBgColor="bg-[#FFFFFF] dark:bg-[#121B22]"
          topBorderColor="border-t-amber-700 dark:border-t-amber-500"
          hoverBorderColor="hover:border-t-amber-700 hover:border-x-amber-500/30 hover:border-b-amber-500/30 dark:hover:border-t-amber-500 dark:hover:border-x-amber-500/40 dark:hover:border-b-amber-500/40"
          hoverShadowColor="hover:shadow-[0_8px_30px_rgba(217,119,6,0.12)] dark:hover:shadow-[0_8px_30px_rgba(245,158,11,0.2)]"
          delay={0.5}
          padding="p-3 sm:p-3.5"
        />
      </div>

      {/* Plans Action Bar & Table */}
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white dark:bg-[#121B22] p-4 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs">
          <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Manage platform product tiers dynamically.</span>
          <CreateUserButton
            mode="create"
            size="md"
            onClick={handleOpenCreatePlan}
          >
            Create Plan
          </CreateUserButton>
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
              <tbody className="divide-y divide-border/60 text-sm font-medium">
                {plansList?.map((plan) => (
                  <tr key={plan.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-4 px-6 font-semibold flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      {plan.displayName}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-muted-foreground">{plan.name}</td>
                    <td className="py-4 px-6 text-emerald-600 dark:text-emerald-400 font-bold">₹{plan.priceMonthly}/mo</td>
                    <td className="py-4 px-6">{plan.maxEmployees}</td>
                    <td className="py-4 px-6">{plan.maxModerators}</td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleOpenEditPlan(plan)}
                        className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Edit Plan Tiers"
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

      {/* Plan Edit/Create Modal Dialog */}
      <ModalDialog
        open={isPlanModalOpen}
        onOpenChange={setIsPlanModalOpen}
        title={editingPlan ? "Edit Plan Details" : "Create New Subscription Plan"}
        icon={<Shield className="w-5 h-5 text-[#635BFF]" />}
        saveText={editingPlan ? "Save Plan" : "Create Plan"}
        buttonMode={editingPlan ? "edit" : "create"}
        buttonVariant={editingPlan ? "secondary" : "primary"}
        asyncState={planAsyncState}
        onSave={handleSavePlan}
      >
        <FormInput
          label="Display Name"
          placeholder="e.g. Silver Plan"
          value={planForm.displayName}
          onChange={(e) => setPlanForm({ ...planForm, displayName: e.target.value })}
          required
        />

        {!editingPlan && (
          <FormInput
            label="Plan Key Name (Immutable)"
            placeholder="e.g. silver"
            value={planForm.name}
            onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
            required
          />
        )}

        <FormInput
          label="Monthly Price (INR/USD)"
          type="text"
          placeholder="29.99"
          value={planForm.priceMonthly}
          onChange={(e) => setPlanForm({ ...planForm, priceMonthly: e.target.value })}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormInput
            label="Max Allowed Employees"
            type="number"
            placeholder="15"
            value={planForm.maxEmployees.toString()}
            onChange={(e) => setPlanForm({ ...planForm, maxEmployees: parseInt(e.target.value) || 0 })}
            required
          />

          <FormInput
            label="Max Allowed Moderators"
            type="number"
            placeholder="2"
            value={planForm.maxModerators.toString()}
            onChange={(e) => setPlanForm({ ...planForm, maxModerators: parseInt(e.target.value) || 0 })}
            required
          />
        </div>
      </ModalDialog>
    </div>
  );
}
