"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import { 
  Building2, Users, Calendar, Shield, CreditCard, 
  Plus, Edit2, Check, X, Loader2, CheckCircle2, XCircle,
  Gift, Search, ArrowUpDown, DollarSign, HardDrive, 
  Sparkles, CheckSquare, Layers, Globe, IndianRupee
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { AppButton } from "@/components/ui/button-system";
import { FormInput } from "@/components/ui/form-input";
import ModalDialog from "@/components/ui/modal-dialog";
import { AsyncState } from "@/components/ui/create-user-button";

export default function PlansPage() {
  const utils = trpc.useUtils();

  // Search, Filter & Currency States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"name-asc" | "name-desc" | "price-asc" | "price-desc" | "emp">("name-asc");
  const [activeCurrencyView, setActiveCurrencyView] = useState<"INR" | "USD">("INR");

  // Modal states for creating/editing plans
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "",
    displayName: "",
    priceMonthly: "1999.00",
    priceUsd: "29.99",
    primaryCurrency: "INR",
    maxEmployees: 25,
    maxModerators: 3,
    maxStorageGb: 5,
    isActive: true,
    featureBiometric: true,
    featureGeofencing: true,
    featureCustomPayroll: false,
    featureDedicatedDb: false,
    featurePrioritySupport: false,
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

  const updatePlanMutation = trpc.superadmin.updatePlan.useMutation({
    onError: (err) => {
      toast.error(err.message || "Failed to update plan");
      setPlanAsyncState('error');
      setTimeout(() => setPlanAsyncState('idle'), 3000);
    }
  });

  // Metric Computations
  const totalWorkspaces = tenantsList?.length || 0;
  const activeTiersCount = plansList?.filter(p => p.isActive).length || 0;
  const totalTiersCount = plansList?.length || 0;

  // Monthly Revenue Estimate Calculation
  const estimatedRevenueINR = useMemo(() => {
    if (!tenantsList) return 0;
    return tenantsList.reduce((acc, t) => {
      if (t.status === "active" || t.status === "trial") {
        const price = t.plan?.priceMonthly ? parseFloat(t.plan.priceMonthly) : 0;
        return acc + (isNaN(price) ? 0 : price);
      }
      return acc;
    }, 0);
  }, [tenantsList]);

  // Filtered and Sorted Plans List (Ascending A-Z default)
  const filteredPlans = useMemo(() => {
    if (!plansList) return [];

    return plansList
      .filter((plan) => {
        const matchesSearch = 
          plan.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          plan.name.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = 
          statusFilter === "all" ? true :
          statusFilter === "active" ? plan.isActive :
          !plan.isActive;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortOrder === "name-asc") {
          return a.displayName.localeCompare(b.displayName);
        }
        if (sortOrder === "name-desc") {
          return b.displayName.localeCompare(a.displayName);
        }
        if (sortOrder === "price-asc") {
          return parseFloat(a.priceMonthly || "0") - parseFloat(b.priceMonthly || "0");
        }
        if (sortOrder === "price-desc") {
          return parseFloat(b.priceMonthly || "0") - parseFloat(a.priceMonthly || "0");
        }
        if (sortOrder === "emp") {
          return b.maxEmployees - a.maxEmployees;
        }
        return a.displayName.localeCompare(b.displayName);
      });
  }, [plansList, searchTerm, statusFilter, sortOrder]);

  const handleOpenCreatePlan = () => {
    setPlanForm({
      name: "",
      displayName: "",
      priceMonthly: "1999.00",
      priceUsd: "29.99",
      primaryCurrency: "INR",
      maxEmployees: 25,
      maxModerators: 3,
      maxStorageGb: 5,
      isActive: true,
      featureBiometric: true,
      featureGeofencing: true,
      featureCustomPayroll: false,
      featureDedicatedDb: false,
      featurePrioritySupport: false,
    });
    setEditingPlan(null);
    setPlanAsyncState('idle');
    setIsPlanModalOpen(true);
  };

  const handleOpenEditPlan = (plan: any) => {
    setEditingPlan(plan);
    const features = (plan.features as Record<string, any>) || {};
    setPlanForm({
      name: plan.name,
      displayName: plan.displayName,
      priceMonthly: plan.priceMonthly || "0.00",
      priceUsd: features.priceUsd || "29.99",
      primaryCurrency: features.currency || "INR",
      maxEmployees: plan.maxEmployees || 10,
      maxModerators: plan.maxModerators || 2,
      maxStorageGb: plan.maxStorageGb || 1,
      isActive: plan.isActive,
      featureBiometric: features.biometric ?? true,
      featureGeofencing: features.geofencing ?? true,
      featureCustomPayroll: features.customPayroll ?? false,
      featureDedicatedDb: features.dedicatedDb ?? false,
      featurePrioritySupport: features.prioritySupport ?? false,
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
      const featuresPayload = {
        currency: planForm.primaryCurrency,
        priceInr: planForm.priceMonthly,
        priceUsd: planForm.priceUsd,
        biometric: planForm.featureBiometric,
        geofencing: planForm.featureGeofencing,
        customPayroll: planForm.featureCustomPayroll,
        dedicatedDb: planForm.featureDedicatedDb,
        prioritySupport: planForm.featurePrioritySupport,
      };

      if (editingPlan) {
        await updatePlanMutation.mutateAsync({
          id: editingPlan.id,
          displayName: planForm.displayName,
          priceMonthly: planForm.priceMonthly,
          maxEmployees: planForm.maxEmployees,
          maxModerators: planForm.maxModerators,
          maxStorageGb: planForm.maxStorageGb,
          features: featuresPayload,
          isActive: planForm.isActive,
        });
        toast.success("Plan updated successfully!");
      } else {
        await createPlanMutation.mutateAsync({
          name: planForm.name || planForm.displayName.toLowerCase().replace(/\s+/g, '-'),
          displayName: planForm.displayName,
          priceMonthly: planForm.priceMonthly,
          maxEmployees: planForm.maxEmployees,
          maxModerators: planForm.maxModerators,
          maxStorageGb: planForm.maxStorageGb,
          features: featuresPayload,
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
      {/* 1. Top Banner Matching Tenants Page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800 text-left">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Gift className="w-6 h-6 text-[#635BFF]" />
            Subscription Plans & Quota Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Configure multi-currency subscription tiers, employee quotas, moderator limits, and global feature access.
          </p>
        </div>

        <AppButton
          variant="primary"
          leftIcon={<Plus className="w-4 h-4 text-white" />}
          onClick={handleOpenCreatePlan}
          className="shrink-0 self-start md:self-center"
        >
          Create New Plan
        </AppButton>
      </div>

      {/* 2. Top Metric Cards (4 Cards Grid Matching Tenants Page) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Workspaces */}
        <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-3.5 sm:p-4 shadow-xs flex items-center space-x-3.5 hover:shadow-md transition-all duration-200 cursor-default">
          <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50 rounded-xl flex items-center justify-center text-[#635BFF] dark:text-indigo-400 shrink-0">
            <Building2 className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div className="text-left">
            <div className="text-xl font-black text-slate-900 dark:text-white leading-none">{totalWorkspaces}</div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Total Workspaces</div>
          </div>
        </div>

        {/* Card 2: Active Plan Tiers */}
        <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-3.5 sm:p-4 shadow-xs flex items-center space-x-3.5 hover:shadow-md transition-all duration-200 cursor-default">
          <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/50 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div className="text-left">
            <div className="text-xl font-black text-slate-900 dark:text-white leading-none">{activeTiersCount}</div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Active Plan Tiers</div>
          </div>
        </div>

        {/* Card 3: Est. Monthly Revenue (INR) */}
        <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-3.5 sm:p-4 shadow-xs flex items-center space-x-3.5 hover:shadow-md transition-all duration-200 cursor-default">
          <div className="w-11 h-11 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/50 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <CreditCard className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div className="text-left">
            <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
              ₹{estimatedRevenueINR.toLocaleString()}
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Est. Monthly Revenue</div>
          </div>
        </div>

        {/* Card 4: Total Tiers */}
        <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-3.5 sm:p-4 shadow-xs flex items-center space-x-3.5 hover:shadow-md transition-all duration-200 cursor-default">
          <div className="w-11 h-11 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/50 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Layers className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div className="text-left">
            <div className="text-xl font-black text-slate-900 dark:text-white leading-none">{totalTiersCount}</div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Total Tier Options</div>
          </div>
        </div>
      </div>

      {/* 3. Toolbar & Currency Switcher Card */}
      <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-3.5 sm:p-4 shadow-xs space-y-4 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-none">Plans Directory</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Filter, sort, and manage subscription quotas</p>
          </div>

          {/* Dual Currency View Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#0B131A] rounded-xl border border-slate-200/80 dark:border-slate-800 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setActiveCurrencyView("INR")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer",
                activeCurrencyView === "INR"
                  ? "bg-white dark:bg-[#121B22] text-[#635BFF] shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <IndianRupee className="w-3.5 h-3.5" />
              <span>India (INR ₹)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCurrencyView("USD")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer",
                activeCurrencyView === "USD"
                  ? "bg-white dark:bg-[#121B22] text-[#635BFF] shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Global (USD $)</span>
            </button>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3.5">
          {/* Search Box */}
          <div className="flex-1 flex flex-col gap-1 text-left min-w-[200px]">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">Search Plans</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 stroke-[1.8]" />
              <input
                type="text"
                placeholder="Search plan by name, key..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3.5 h-[38px] border border-slate-200/90 dark:border-slate-700/80 rounded-[12px] text-xs sm:text-[13px] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-[3px] focus:ring-[#635BFF]/10 focus:border-[#635BFF] bg-white dark:bg-[#0B131A] dark:text-slate-100 transition-all duration-200 shadow-2xs"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-[160px] flex flex-col gap-1 text-left shrink-0">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">Status</label>
            <Combobox
              options={[
                { value: "all", label: "All Status" },
                { value: "active", label: "Active Plans" },
                { value: "inactive", label: "Inactive / Draft" },
              ]}
              value={statusFilter}
              onSelect={(val: string) => setStatusFilter(val)}
              placeholder="Filter status..."
              searchPlaceholder="Search status..."
            />
          </div>

          {/* Sort Order Selector (Ascending by default) */}
          <div className="w-full sm:w-[170px] flex flex-col gap-1 text-left shrink-0">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" /> Sort Order
            </label>
            <Combobox
              options={[
                { value: "name-asc", label: "Name (A to Z)" },
                { value: "name-desc", label: "Name (Z to A)" },
                { value: "price-asc", label: "Price (Low to High)" },
                { value: "price-desc", label: "Price (High to Low)" },
                { value: "emp", label: "Max Employees" },
              ]}
              value={sortOrder}
              onSelect={(val: any) => setSortOrder(val)}
              placeholder="Sort by..."
              searchPlaceholder="Search sorting..."
            />
          </div>
        </div>
      </div>

      {/* 4. Plan Cards Grid Matching Tenants Page Cards */}
      {loadingPlans ? (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-[#121B22] rounded-[16px] border border-slate-200 dark:border-slate-800 shadow-xs min-h-[300px]">
          <Loader2 className="h-8 w-8 text-[#635BFF] dark:text-[#0BDBB9] animate-spin" />
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-[16px] p-12 bg-white dark:bg-[#121B22] flex flex-col items-center justify-center text-center shadow-xs min-h-[320px]">
          <Gift className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No subscription plans found</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mt-1">
            Try adjusting your search terms or create a new subscription plan tier.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map((plan) => {
            const features = (plan.features as Record<string, any>) || {};
            const displayPrice = activeCurrencyView === "INR"
              ? `₹${parseFloat(plan.priceMonthly || "0").toLocaleString()}`
              : `$${features.priceUsd || (parseFloat(plan.priceMonthly || "0") > 0 ? (parseFloat(plan.priceMonthly || "0") / 80).toFixed(2) : "0.00")}`;

            return (
              <div
                key={plan.id}
                className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between text-left space-y-4"
              >
                <div className="space-y-4">
                  {/* Top Card Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{plan.displayName}</h3>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          plan.isActive 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        )}>
                          {plan.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                        key: {plan.name}
                      </p>
                    </div>

                    {/* Subscriber Count Badge */}
                    <div className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/40 rounded-xl text-center shrink-0">
                      <div className="text-xs font-black text-brand-primary">
                        {(plan as any).tenantCount || 0}
                      </div>
                      <div className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-400">
                        Tenants
                      </div>
                    </div>
                  </div>

                  {/* Pricing Rate Display */}
                  <div className="bg-slate-50 dark:bg-[#0B131A]/70 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3 flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        {displayPrice}
                      </span>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">
                        / month
                      </span>
                    </div>

                    {/* Dual currency secondary hint */}
                    <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                      {activeCurrencyView === "INR" 
                        ? `Global: $${features.priceUsd || "29.99"}`
                        : `India: ₹${plan.priceMonthly}`
                      }
                    </div>
                  </div>

                  {/* Resource Limits List */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#635BFF]" /> Max Employees Limit
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {plan.maxEmployees} Employees
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-[#635BFF]" /> Max Moderators Limit
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {plan.maxModerators} Moderators
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-[#635BFF]" /> Storage Quota
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {(plan as any).maxStorageGb || 1} GB
                      </span>
                    </div>
                  </div>

                  {/* Feature Badges */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5">
                    {features.biometric && (
                      <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-[#635BFF] dark:text-indigo-300 rounded-md text-[10px] font-semibold">
                        Biometric Attendance
                      </span>
                    )}
                    {features.geofencing && (
                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-md text-[10px] font-semibold">
                        Geofencing
                      </span>
                    )}
                    {features.customPayroll && (
                      <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded-md text-[10px] font-semibold">
                        Custom Payroll
                      </span>
                    )}
                    {features.dedicatedDb && (
                      <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 rounded-md text-[10px] font-semibold">
                        Dedicated DB
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <AppButton
                    variant="primary"
                    leftIcon={<Edit2 className="w-3.5 h-3.5 text-white" />}
                    onClick={() => handleOpenEditPlan(plan)}
                  >
                    Edit Plan Limits
                  </AppButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Plan Create & Edit Modal Dialog with Dual Currency Setup */}
      <ModalDialog
        open={isPlanModalOpen}
        onOpenChange={setIsPlanModalOpen}
        title={editingPlan ? `Edit Subscription Plan: ${editingPlan.displayName}` : "Create New Subscription Tier"}
        icon={<Gift className="w-5 h-5 text-[#635BFF]" />}
        maxWidth="md:max-w-[680px]"
        buttonMode={editingPlan ? "edit" : "create"}
        buttonVariant={editingPlan ? "secondary" : "primary"}
        saveText={editingPlan ? "Save Plan Changes" : "Create Plan"}
        asyncState={planAsyncState}
        onSave={handleSavePlan}
      >
        <div className="space-y-4 text-left">
          {/* Row 1: Plan Display Name & System Key */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              label="Plan Display Name *"
              value={planForm.displayName}
              onChange={(e) => {
                const val = e.target.value;
                setPlanForm(prev => ({
                  ...prev,
                  displayName: val,
                  name: editingPlan ? prev.name : val.toLowerCase().replace(/[^a-z0-9]/g, '-')
                }));
              }}
              placeholder="e.g. Professional Tier"
            />

            <FormInput
              label="System Key (Slug) *"
              value={planForm.name}
              disabled={!!editingPlan}
              onChange={(e) => setPlanForm(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
              placeholder="e.g. professional"
            />
          </div>

          {/* Row 2: Dual / Multi-Currency Pricing Setup */}
          <div className="p-3 bg-slate-50 dark:bg-[#0B131A] border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#635BFF]" /> Multi-Currency Pricing Configuration
              </span>
              <span className="text-[11px] text-slate-400">Monthly Billing</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput
                label="India Domestic Price (INR ₹) *"
                type="number"
                value={planForm.priceMonthly}
                onChange={(e) => setPlanForm(prev => ({ ...prev, priceMonthly: e.target.value }))}
                placeholder="1999.00"
              />

              <FormInput
                label="Global International Price (USD $) *"
                type="number"
                value={planForm.priceUsd}
                onChange={(e) => setPlanForm(prev => ({ ...prev, priceUsd: e.target.value }))}
                placeholder="29.99"
              />
            </div>
          </div>

          {/* Row 3: Hard Quotas & Limits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormInput
              label="Max Employees *"
              type="number"
              value={planForm.maxEmployees}
              onChange={(e) => setPlanForm(prev => ({ ...prev, maxEmployees: parseInt(e.target.value) || 1 }))}
              placeholder="25"
            />

            <FormInput
              label="Max Moderators *"
              type="number"
              value={planForm.maxModerators}
              onChange={(e) => setPlanForm(prev => ({ ...prev, maxModerators: parseInt(e.target.value) || 1 }))}
              placeholder="3"
            />

            <FormInput
              label="Storage Quota (GB) *"
              type="number"
              value={planForm.maxStorageGb}
              onChange={(e) => setPlanForm(prev => ({ ...prev, maxStorageGb: parseInt(e.target.value) || 1 }))}
              placeholder="5"
            />
          </div>

          {/* Row 4: Feature Flags */}
          <div className="space-y-2 pt-1">
            <label className="block text-[13px] font-medium text-slate-600 dark:text-slate-400">
              Enabled Feature Tier Modules
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {[
                { key: "featureBiometric", label: "Biometric Integration" },
                { key: "featureGeofencing", label: "GPS Geofencing" },
                { key: "featureCustomPayroll", label: "Custom Payroll Formulas" },
                { key: "featureDedicatedDb", label: "Dedicated Database" },
                { key: "featurePrioritySupport", label: "24/7 Priority SLA" },
              ].map((feat) => (
                <label
                  key={feat.key}
                  className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B131A] cursor-pointer hover:border-[#635BFF]/50"
                >
                  <input
                    type="checkbox"
                    checked={(planForm as any)[feat.key]}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, [feat.key]: e.target.checked }))}
                    className="rounded border-slate-300 text-[#635BFF] focus:ring-[#635BFF]"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{feat.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
