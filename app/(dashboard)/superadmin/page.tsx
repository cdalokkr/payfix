"use client";

import { trpc } from "@/lib/trpc/client";
import { 
  Building2, Calendar, Shield, CreditCard, 
  CheckCircle2, XCircle, ArrowRight, Activity, Database, Server, Settings
} from "lucide-react";
import Link from "next/link";
import { MetricCard } from "@/components/dashboard/metric-card";

export default function SuperAdminDashboardPage() {
  // Queries
  const { data: tenantsList, isLoading: loadingTenants } = trpc.superadmin.listTenants.useQuery();
  const { data: plansList, isLoading: loadingPlans } = trpc.superadmin.listPlans.useQuery();

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 text-foreground font-sans">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Platform Dashboard
            </h1>
            <p className="text-muted-foreground text-sm">
              Global metrics, deployment health, and tenant status overview.
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
          delay={0.1}
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
          delay={0.2}
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
          delay={0.3}
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
          delay={0.4}
          padding="p-3 sm:p-3.5"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - System Health */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card/45 border border-border/60 rounded-2xl p-6 backdrop-blur-xl space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Activity className="h-5 w-5 text-primary" />
              Platform Infrastructure Health
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-border/40 bg-background/40 flex items-start gap-3">
                <Database className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-foreground block">Central Database Connection</span>
                  <span className="text-xs text-muted-foreground">Master postgres connection pool active. Ready to route.</span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase mt-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border/40 bg-background/40 flex items-start gap-3">
                <Server className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-foreground block">Multi-tenant Schema Resolver</span>
                  <span className="text-xs text-muted-foreground">Dynamic schema search_path routing middleware running.</span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase mt-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Healthy
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border/40 bg-background/40 flex items-start gap-3">
                <Settings className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-foreground block">Provisioning Engine</span>
                  <span className="text-xs text-muted-foreground">SaaS automatic schema generation & user creation queue.</span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase mt-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Operational
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border/40 bg-background/40 flex items-start gap-3">
                <Shield className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-foreground block">Security & API Keys</span>
                  <span className="text-xs text-muted-foreground">Biometric key resolver and JWT auth endpoints.</span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase mt-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Navigation Shortcuts */}
        <div className="space-y-6">
          <div className="bg-card/45 border border-border/60 rounded-2xl p-6 backdrop-blur-xl space-y-4">
            <h2 className="text-xl font-bold text-foreground">Control shortcuts</h2>
            <p className="text-xs text-muted-foreground">
              Access individual platform components to make overrides, suspend customers, or manage pricing tiers.
            </p>

            <div className="space-y-3 pt-2">
              <Link 
                href="/superadmin/tenants" 
                className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-background/40 hover:bg-primary/5 hover:border-primary transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <span className="text-sm font-bold text-foreground block">Tenants Registry</span>
                    <span className="text-[10px] text-muted-foreground">Manage workspaces and plan overrides</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>

              <Link 
                href="/superadmin/plans" 
                className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-background/40 hover:bg-primary/5 hover:border-primary transition-all group"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <span className="text-sm font-bold text-foreground block">Subscription Plans</span>
                    <span className="text-[10px] text-muted-foreground">Configure pricing levels and limits</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
