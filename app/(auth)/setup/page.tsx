"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc/client";
import { 
  Database, 
  Table2, 
  Settings, 
  UserCheck, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Rocket
} from "lucide-react";

const SETUP_STEPS = [
  { id: "init", label: "Initializing workspace", icon: Database, duration: 500 },
  { id: "creating_schema", label: "Creating database schema", icon: Database, duration: 1000 },
  { id: "cloning_tables", label: "Setting up business tables", icon: Table2, duration: 2000 },
  { id: "seeding_defaults", label: "Configuring defaults", icon: Settings, duration: 800 },
  { id: "creating_profile", label: "Setting up your admin profile", icon: UserCheck, duration: 600 },
  { id: "registering", label: "Finalizing registration", icon: CheckCircle2, duration: 400 },
  { id: "complete", label: "Workspace ready!", icon: Rocket, duration: 0 },
];

export default function SetupPage() {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const provisionMutation = trpc.auth.provisionWorkspace.useMutation({
    onSuccess: (data) => {
      if (data.alreadyProvisioned) {
        // Already done — go straight to dashboard
        router.replace("/admin");
        return;
      }
      // Animate through remaining steps then redirect
      setCurrentStepIndex(SETUP_STEPS.length - 1);
      setIsComplete(true);
      setTimeout(() => {
        router.replace("/admin");
      }, 2000);
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

  // Progress animation — advance steps on a timer for visual feedback
  useEffect(() => {
    if (isComplete || error) return;
    if (currentStepIndex >= SETUP_STEPS.length - 2) return; // Stop before 'complete'

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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: isComplete ? 0 : 360 }}
            transition={{ duration: 2, repeat: isComplete ? 0 : Infinity, ease: "linear" }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4"
          >
            {isComplete ? (
              <Rocket className="h-8 w-8 text-primary" />
            ) : (
              <Database className="h-8 w-8 text-primary" />
            )}
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground">
            {isComplete ? "All Set!" : "Setting Up Your Workspace"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isComplete
              ? "Your workspace is ready. Redirecting to dashboard..."
              : "We're preparing your workspace. This will only take a moment."}
          </p>
        </div>

        {/* Progress Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
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
                  transition={{ delay: index * 0.08, duration: 0.3 }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    isActive
                      ? "bg-primary/5 border border-primary/20"
                      : isDone
                      ? "bg-emerald-500/5 border border-emerald-500/10"
                      : "border border-transparent"
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                      isDone
                        ? "bg-emerald-500/10 text-emerald-500"
                        : isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-muted-foreground/40"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isDone
                        ? "text-emerald-500"
                        : isActive
                        ? "text-foreground"
                        : "text-muted-foreground/40"
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
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  onClick={handleRetry}
                  className="mt-3 w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-sm transition-colors"
                >
                  Retry Setup
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/60 mt-4">
          Do not close this page while setup is in progress.
        </p>
      </motion.div>
    </div>
  );
}
