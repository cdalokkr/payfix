import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarOff,
  CheckCircle2,
  Clock,
  Cpu,
  Globe,
  Headset,
  IndianRupee,
  LayoutDashboard,
  Lock,
  LogIn,
  MapPin,
  Receipt,
  ScanFace,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Users,
} from "lucide-react";
import Logo from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const PLATFORM_MODULES = [
  {
    icon: ScanFace,
    tag: "AI Biometrics",
    title: "Face Verification & Express Kiosk",
    description:
      "512-d ArcFace / ONNX facial matching with passive liveness detection and an always-on entrance kiosk terminal.",
    accent: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  },
  {
    icon: MapPin,
    tag: "Field & Office",
    title: "Geofenced Mobile PWA & MPIN",
    description:
      "GPS radius verification per office branch, offline-resilient mobile portal, and fast WebAuthn / MPIN sign-in.",
    accent: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: Cpu,
    tag: "Hardware Sync",
    title: "eSSL & TimeWatch Biometric Bridge",
    description:
      "Native iClock / ADMS push support and local SQL sync bridge streaming real-time terminal punches straight to the cloud.",
    accent: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
  {
    icon: Clock,
    tag: "Scheduling",
    title: "Shifts, Rotations & Duty Roster",
    description:
      "Multi-shift rules, overnight Day-1 attribution, 15-minute grace buffers, weekly department rosters, and extra-shift tracking.",
    accent: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: IndianRupee,
    tag: "Payroll Engine",
    title: "Payroll, Salary Book & Payslips",
    description:
      "Monthly attendance compilation, salary component setup, advances & bonuses, PDF payslips, and Excel salary registers.",
    accent: "text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/20",
  },
  {
    icon: CalendarOff,
    tag: "Approvals",
    title: "Leaves & Profile Photo Review",
    description:
      "Leave balance workflows automatically synced with attendance compilation, plus admin photo approval queues.",
    accent: "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: Headset,
    tag: "Service Desk",
    title: "Clients, Complaints & AI Triage",
    description:
      "Manage client directories, customer complaints, and internal support tickets with automated AI categorization.",
    accent: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
  },
  {
    icon: Building2,
    tag: "Multi-Tenant",
    title: "Isolated Workspaces & White-Label",
    description:
      "Dedicated tenant PostgreSQL schemas with Row-Level Security, custom logos, subdomains, and billing invoices.",
    accent: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
];

const BIOMETRIC_PIPELINE = [
  {
    step: "01",
    title: "Capture Anywhere",
    detail:
      "Employees punch in via Mobile PWA selfie, shared Entrance Kiosk tablet, or physical eSSL / TimeWatch hardware.",
    icon: Tablet,
  },
  {
    step: "02",
    title: "Verify Identity & Location",
    detail:
      "Liveness checks, facial vector matching, GPS geofence radius, and shift grace buffers validate every punch in real time.",
    icon: ShieldCheck,
  },
  {
    step: "03",
    title: "Compile Attendance & Payroll",
    detail:
      "Verified sessions flow directly into daily logs, leave reconciliation, salary passbooks, and one-click PDF payslips.",
    icon: Receipt,
  },
];

const ROLE_PORTALS = [
  {
    role: "Company Admin",
    summary: "Full workforce directory, office geofences, shifts, payroll runs, biometric devices, and billing.",
    icon: LayoutDashboard,
    href: "/login",
    cta: "Admin Sign In",
  },
  {
    role: "Moderator / HR Ops",
    summary: "Daily attendance verification, leave approvals, monthly compilation, reports, and service desk triage.",
    icon: Users,
    href: "/login",
    cta: "Moderator Sign In",
  },
  {
    role: "Employee Mobile PWA",
    summary: "Installable mobile portal for biometric check-in, leave requests, advances, attendance history, and payslips.",
    icon: Smartphone,
    href: "/login",
    cta: "Open Portal",
  },
  {
    role: "Entrance Kiosk Terminal",
    summary: "Zero-scroll, touchless face recognition terminal built for lobby tablets and high-traffic shift changes.",
    icon: Tablet,
    href: "/kiosk",
    cta: "Launch Kiosk",
  },
];

export default function NiyamoLanding() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B131A] text-[#0F172A] dark:text-slate-100 selection:bg-[#5B5CEB]/20">
      {/* Ambient Background Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 left-1/4 h-[480px] w-[480px] rounded-full bg-[#5B5CEB]/10 blur-[130px] dark:bg-[#5B5CEB]/15" />
        <div className="absolute top-1/3 -right-24 h-[420px] w-[420px] rounded-full bg-[#02A88E]/10 blur-[130px] dark:bg-[#0BDBB9]/10" />
      </div>

      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 dark:border-slate-800/80 bg-white/80 dark:bg-[#0B131A]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 focus:outline-none">
            <Logo size="md" />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#475569] dark:text-slate-400">
            <a href="#modules" className="hover:text-[#0F172A] dark:hover:text-white transition-colors">
              Modules
            </a>
            <a href="#biometrics" className="hover:text-[#0F172A] dark:hover:text-white transition-colors">
              Biometric Flow
            </a>
            <a href="#portals" className="hover:text-[#0F172A] dark:hover:text-white transition-colors">
              Portals
            </a>
            <Link href="/kiosk" className="hover:text-[#0F172A] dark:hover:text-white transition-colors">
              Kiosk
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link href="/login">
              <Button
                variant="outline"
                className="h-9 rounded-[12px] border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#121B22] text-xs sm:text-sm font-semibold"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="btn-save-superadmin h-9 rounded-[12px] px-3.5 sm:px-4 text-xs sm:text-sm font-bold border-0">
                Create Workspace
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#121B22] px-3.5 py-1.5 text-xs font-semibold text-[#475569] dark:text-slate-300 shadow-2xs">
                <Globe className="h-3.5 w-3.5 text-[#5B5CEB] dark:text-[#0BDBB9]" />
                <span>niyamo.auravics.com</span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="text-[#02A88E] dark:text-[#0BDBB9]">Multi-Tenant Workforce Cloud</span>
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight text-[#0F172A] dark:text-slate-100 sm:text-5xl lg:text-[54px] lg:leading-[1.08]">
                Biometric Attendance, Geofencing &amp; Payroll —{" "}
                <span className="bg-gradient-to-r from-[#5B5CEB] to-[#02A88E] dark:from-[#818CF8] dark:to-[#0BDBB9] bg-clip-text text-transparent">
                  Unified on NIYAMO
                </span>
              </h1>

              <p className="max-w-2xl text-base sm:text-lg leading-relaxed text-[#475569] dark:text-slate-400">
                Run multi-branch attendance across AI face verification, entrance kiosks, GPS geofencing, and eSSL
                hardware—then compile shifts, leaves, advances, and payslips inside isolated tenant workspaces.
              </p>

              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-2">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="btn-save-superadmin h-12 w-full sm:w-auto rounded-[14px] px-6 text-sm font-bold border-0"
                  >
                    Create Company Workspace
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-full sm:w-auto rounded-[14px] border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#121B22] px-6 text-sm font-semibold"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign In to Workspace
                  </Button>
                </Link>
                <Link href="/kiosk">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="h-12 w-full sm:w-auto rounded-[14px] px-5 text-sm font-semibold text-[#475569] dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/60"
                  >
                    <Tablet className="h-4 w-4" />
                    Launch Kiosk Mode
                  </Button>
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 text-xs font-medium text-[#475569] dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#02A88E] dark:text-[#0BDBB9]" />
                  PostgreSQL Schema &amp; RLS Isolation
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#02A88E] dark:text-[#0BDBB9]" />
                  Installable Mobile &amp; Kiosk PWA
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#02A88E] dark:text-[#0BDBB9]" />
                  Dedicated Subdomain Workspaces
                </span>
              </div>
            </div>

            {/* Right Visual — Live Platform Snapshot */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#121B22] p-5 sm:p-6 shadow-xl shadow-slate-200/60 dark:shadow-black/40 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5B5CEB]/10 text-[#5B5CEB] dark:text-indigo-400">
                      <CalendarCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Workspace Command Center
                      </p>
                      <p className="text-sm font-bold text-[#0F172A] dark:text-slate-100">
                        acme.niyamo.auravics.com
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-[#0BDBB9]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-[#0BDBB9]" />
                    Live Sync
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0B131A] p-4">
                    <div className="flex items-center justify-between text-xs text-[#475569] dark:text-slate-400">
                      <span>Verified Today</span>
                      <ScanFace className="h-4 w-4 text-[#5B5CEB] dark:text-indigo-400" />
                    </div>
                    <p className="mt-2 text-2xl font-extrabold text-[#0F172A] dark:text-white">94.6%</p>
                    <p className="mt-1 text-[11px] text-emerald-600 dark:text-[#0BDBB9] font-semibold">
                      Face + GPS + eSSL matched
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0B131A] p-4">
                    <div className="flex items-center justify-between text-xs text-[#475569] dark:text-slate-400">
                      <span>Shift Coverage</span>
                      <Clock className="h-4 w-4 text-amber-500" />
                    </div>
                    <p className="mt-2 text-2xl font-extrabold text-[#0F172A] dark:text-white">3 Shifts</p>
                    <p className="mt-1 text-[11px] text-[#475569] dark:text-slate-400">
                      15m buffer &amp; overnight Day-1
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0B131A] p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#475569] dark:text-slate-400">
                      Monthly Payroll Compilation
                    </span>
                    <span className="text-xs font-bold text-[#02A88E] dark:text-[#0BDBB9]">
                      Ready for Payslips
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="h-full w-[88%] rounded-full bg-gradient-to-r from-[#5B5CEB] to-[#02A88E] dark:to-[#0BDBB9]" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#475569] dark:text-slate-400">
                    <span>Attendance, Leaves &amp; Advances reconciled</span>
                    <span className="font-semibold text-[#0F172A] dark:text-slate-200">PDF &amp; XLSX</span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0B131A] px-4 py-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Lock className="h-4 w-4 text-[#02A88E] dark:text-[#0BDBB9]" />
                    <span className="font-medium text-[#0F172A] dark:text-slate-200">
                      Tenant-isolated schema &amp; white-label PWA
                    </span>
                  </div>
                  <Sparkles className="h-4 w-4 text-[#5B5CEB] dark:text-indigo-400 shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Modules Grid */}
        <section id="modules" className="border-t border-slate-200/90 dark:border-slate-800/80 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-[#5B5CEB] dark:text-[#0BDBB9]">
                Complete Workforce Suite
              </p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-slate-100 sm:text-4xl">
                Every operational tool your HR, payroll, and branch teams need
              </h2>
              <p className="mt-3 text-base text-[#475569] dark:text-slate-400">
                Built around real field and factory workflows—connecting biometric terminals, mobile punches, duty
                rosters, and salary registers without spreadsheets.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PLATFORM_MODULES.map((mod) => {
                const Icon = mod.icon;
                return (
                  <div
                    key={mod.title}
                    className="group rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#121B22] p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:hover:border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${mod.accent}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {mod.tag}
                      </span>
                    </div>
                    <h3 className="mt-4 text-base font-bold text-[#0F172A] dark:text-slate-100">
                      {mod.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#475569] dark:text-slate-400">
                      {mod.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Biometric & Payroll Pipeline */}
        <section
          id="biometrics"
          className="border-t border-slate-200/90 dark:border-slate-800/80 bg-white/60 dark:bg-[#121B22]/40 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-widest text-[#02A88E] dark:text-[#0BDBB9]">
                  End-to-End Flow
                </p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-slate-100">
                  From entrance punch to finalized payslip in three steps
                </h2>
              </div>
              <Link href="/signup" className="text-sm font-semibold text-[#5B5CEB] dark:text-[#0BDBB9] hover:underline inline-flex items-center gap-1">
                Provision your tenant workspace <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {BIOMETRIC_PIPELINE.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.step}
                    className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#121B22] p-6 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#5B5CEB] dark:text-[#0BDBB9]">
                        STEP {item.step}
                      </span>
                      <Icon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-[#0F172A] dark:text-slate-100">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#475569] dark:text-slate-400">
                      {item.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Role-Based Portals */}
        <section id="portals" className="border-t border-slate-200/90 dark:border-slate-800/80 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-[#5B5CEB] dark:text-[#0BDBB9]">
                Dedicated Surfaces
              </p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-slate-100">
                Purpose-built portals for every role in your organization
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {ROLE_PORTALS.map((portal) => {
                const Icon = portal.icon;
                return (
                  <div
                    key={portal.role}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#121B22] p-5 shadow-2xs"
                  >
                    <div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-[#0F172A] dark:text-slate-100">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-base font-bold text-[#0F172A] dark:text-slate-100">
                        {portal.role}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#475569] dark:text-slate-400">
                        {portal.summary}
                      </p>
                    </div>
                    <Link
                      href={portal.href}
                      className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-[#5B5CEB] dark:text-[#0BDBB9] hover:underline"
                    >
                      {portal.cta} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#121B22] p-8 sm:p-12 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-slate-100">
                Ready to launch your company workspace on NIYAMO?
              </h2>
              <p className="mt-2 text-sm sm:text-base text-[#475569] dark:text-slate-400">
                Provision your isolated tenant at <code className="font-semibold text-[#5B5CEB] dark:text-[#0BDBB9]">&lt;company&gt;.niyamo.auravics.com</code> in minutes with full biometric, roster, and payroll automation.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
              <Link href="/signup">
                <Button size="lg" className="btn-save-superadmin h-11 w-full sm:w-auto rounded-[12px] px-6 text-sm font-bold border-0">
                  Create Workspace
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 w-full sm:w-auto rounded-[12px] border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#0B131A] px-6 text-sm font-semibold"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200/90 dark:border-slate-800/80 bg-white/70 dark:bg-[#0B131A]">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8 text-xs text-[#475569] dark:text-slate-400">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span>•</span>
            <span>niyamo.auravics.com</span>
          </div>
          <div className="flex flex-wrap items-center gap-5 font-medium">
            <Link href="/login" className="hover:text-[#0F172A] dark:hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-[#0F172A] dark:hover:text-white transition-colors">
              Register Workspace
            </Link>
            <Link href="/kiosk" className="hover:text-[#0F172A] dark:hover:text-white transition-colors">
              Kiosk Terminal
            </Link>
            <span>&copy; 2026 NIYAMO • Auravics</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
