"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/auth/ui/Toast";
import AuthShell from "@/components/auth/AuthShell";
import { 
  Database, 
  Table2, 
  Settings, 
  UserCheck, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Rocket,
  Building2,
  Mail,
  User,
  Check
} from "lucide-react";

const SETUP_STEPS = [
  { id: "init", label: "Initializing workspace", icon: Database, duration: 500 },
  { id: "creating_schema", label: "Creating database schema", icon: Database, duration: 1000 },
  { id: "cloning_tables", label: "Setting up business tables", icon: Table2, duration: 2000 },
  { id: "seeding_defaults", label: "Configuring defaults", icon: Settings, duration: 800 },
  { id: "creating_profile", label: "Setting up admin profile", icon: UserCheck, duration: 600 },
  { id: "registering", label: "Finalizing registration", icon: CheckCircle2, duration: 400 },
  { id: "complete", label: "Workspace ready!", icon: Rocket, duration: 0 },
];

export default function SetupPage() {
  return (
    <AuthShell variant="register">
      <SetupWizard />
    </AuthShell>
  );
}

function SetupWizard() {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();

  // Fetch tenant info for the heading
  const { data: setupInfo } = trpc.auth.getSetupInfo.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const provisionMutation = trpc.auth.provisionWorkspace.useMutation({
    onSuccess: (data) => {
      if (data.alreadyProvisioned) {
        window.location.href = "/admin?setup_done=1";
        return;
      }
      // Complete all steps and show success
      setCurrentStepIndex(SETUP_STEPS.length - 1);
      setIsComplete(true);

      toast({
        type: "success",
        title: "Workspace Ready! 🎉",
        description: "Your workspace has been set up successfully. Redirecting to dashboard...",
      });
      
      // Hard redirect with setup_done=1 so proxy clears stale caches
      setTimeout(() => {
        window.location.href = "/admin?setup_done=1";
      }, 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to set up workspace. Please try again.");
    },
  });

  // Auto-start provisioning on mount
  useEffect(() => {
    if (!provisionMutation.isPending && !provisionMutation.isSuccess && !error) {
      provisionMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress animation
  useEffect(() => {
    if (isComplete || error) return;
    if (currentStepIndex >= SETUP_STEPS.length - 2) return;

    const step = SETUP_STEPS[currentStepIndex];
    const timer = setTimeout(() => {
      setCurrentStepIndex((i) => Math.min(i + 1, SETUP_STEPS.length - 2));
    }, step.duration + 800);

    return () => clearTimeout(timer);
  }, [currentStepIndex, isComplete, error]);

  const handleRetry = useCallback(() => {
    setError(null);
    setCurrentStepIndex(0);
    provisionMutation.mutate();
  }, [provisionMutation]);

  const progress = Math.round(((currentStepIndex + 1) / SETUP_STEPS.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel auth-popup-card w-full max-w-[460px] rounded-[24px] border border-white/60 p-4 sm:p-6 dark:border-slate-800/50"
    >
      {/* Heading matching RegisterWizard / LoginForm */}
      <div className="text-center mb-6">
        <h1 className="text-[24px] font-bold tracking-[-0.025em] font-outfit text-slate-900 dark:text-white">
          {isComplete ? "Workspace Ready" : "Setting Up Workspace"}
        </h1>
        <p className="text-[14px] text-slate-500 dark:text-slate-400 mt-2 font-inter">
          {isComplete 
            ? "Redirecting to your new dashboard..." 
            : "Please wait while we initialize your organization database."}
        </p>
      </div>

      {/* Tenant Info Header — always rendered, shows skeleton while loading */}
      <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/55 rounded-2xl p-4 mb-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-primary/10 shrink-0">
            <Building2 className="h-5 w-5 text-brand-primary" />
          </div>
          <div className="min-w-0">
            {setupInfo ? (
              <>
                <h2 className="text-[15px] font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                  {setupInfo.companyName}
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{setupInfo.slug}.payfix.com</p>
              </>
            ) : (
              <>
                <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                <div className="h-3 w-28 bg-slate-100 dark:bg-slate-900 rounded animate-pulse mt-1" />
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 pl-[52px]">
          {setupInfo ? (
            <>
              {setupInfo.adminName && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{setupInfo.adminName}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{setupInfo.adminEmail}</span>
              </div>
            </>
          ) : (
            <>
              <div className="h-3 w-32 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
              <div className="h-3 w-44 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-brand-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Steps with Process Spinner and Ticks */}
      <div className="space-y-1.5">
        {SETUP_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStepIndex;
          const isDone = index < currentStepIndex || isComplete;
          const isPending = index > currentStepIndex;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.25 }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors ${
                isActive
                  ? "bg-brand-primary/5 border-brand-primary/20 dark:bg-brand-primary/10 dark:border-brand-primary/30"
                  : isDone
                  ? "bg-emerald-500/5 border-transparent dark:bg-emerald-950/10"
                  : "border-transparent"
              }`}
            >
              {/* Spinner for processing, tick for done, default icon for pending */}
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-colors ${
                  isDone
                    ? "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20"
                    : isActive
                    ? "bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20"
                    : "bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600"
                }`}
              >
                {isDone ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={`text-[13px] font-semibold transition-colors ${
                  isDone
                    ? "text-emerald-600 dark:text-emerald-400"
                    : isActive
                    ? "text-slate-800 dark:text-slate-200"
                    : "text-slate-300 dark:text-slate-600"
                }`}
              >
                {step.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Error state */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden"
          >
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/5 border border-red-500/25 text-red-500 dark:text-red-400 text-xs font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={handleRetry}
              className="mt-3 w-full py-2.5 bg-brand-primary hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
            >
              Retry Setup
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      {!isComplete && (
        <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-4">
          Do not close this page while setup is in progress.
        </p>
      )}
    </motion.div>
  );
}
