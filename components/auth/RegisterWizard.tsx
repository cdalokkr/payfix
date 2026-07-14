"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/components/auth/ui/Toast";
import { trpc } from "@/lib/trpc/client";
import Stepper from "./Stepper";
import PersonalStep from "./steps/PersonalStep";
import CompanyStep from "./steps/CompanyStep";
import SecurityStep from "./steps/SecurityStep";
import SuccessStep from "./steps/SuccessStep";
import { initialRegisterData, type RegisterFormData } from "./steps/types";

export default function RegisterWizard() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [data, setData] = useState<RegisterFormData>(initialRegisterData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerMutation = trpc.auth.registerTenant.useMutation({
    onMutate: () => {
      setLoading(true);
      setError(null);
    },
    onError: (err) => {
      setLoading(false);
      setError(err.message || "Registration failed. Please check details and try again.");
    },
    onSuccess: () => {
      setLoading(false);
      goTo(4);
      toast({
        type: "success",
        title: "Registration Complete!",
        description: "Your workspace has been successfully initialized.",
      });
    },
  });

  function update(patch: Partial<RegisterFormData>) {
    setData((d) => ({ ...d, ...patch }));
    // Clear error on user edits
    if (error) setError(null);
  }

  function goTo(next: number) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  function handleFinalSubmit(securityData: any) {
    const finalData = { ...data, ...securityData };

    if (!navigator.onLine) {
      setError("No internet connection. Please check your network and try again.");
      return;
    }

    registerMutation.mutate({
      companyName: finalData.companyName,
      slug: finalData.workspaceName,
      adminEmail: finalData.email,
      adminPassword: finalData.password,
      firstName: finalData.firstName,
      lastName: finalData.lastName,
      phone: finalData.phone,
      country: finalData.country,
      industry: finalData.industry,
      teamSize: finalData.teamSize,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel auth-popup-card w-full max-w-[460px] rounded-[24px] border border-white/60 p-4 sm:p-6 dark:border-slate-800/50"
    >
      {step < 4 && <Stepper current={step} />}

      {error && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] sm:text-[13px] font-medium text-red-600 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="relative">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -30 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 1 && (
              <PersonalStep
                data={data}
                update={update}
                onNext={() => goTo(2)}
              />
            )}
            {step === 2 && (
              <CompanyStep
                data={data}
                update={update}
                onNext={() => goTo(3)}
                onBack={() => goTo(1)}
              />
            )}
            {step === 3 && (
              <SecurityStep
                data={data}
                update={update}
                onBack={() => goTo(2)}
                onSubmit={handleFinalSubmit}
                loading={loading}
              />
            )}
            {step === 4 && <SuccessStep slug={data.workspaceName} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {step === 1 && (
        <p className="mt-6 text-center text-[13px] text-slate-500 dark:text-slate-400 select-none">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-brand-primary hover:text-brand-hover transition-colors"
          >
            Sign in
          </Link>
        </p>
      )}
    </motion.div>
  );
}
