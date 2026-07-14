"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { PasswordInput } from "@/components/auth/ui/password-input";
import { Button } from "@/components/auth/ui/button";
import { securityStepSchema } from "@/lib/validations/signup-wizard";
import type { RegisterFormData } from "./types";

type Step3Data = z.infer<typeof securityStepSchema>;

export default function SecurityStep({
  data,
  update,
  onBack,
  onSubmit,
  loading,
}: {
  data: RegisterFormData;
  update: (patch: Partial<RegisterFormData>) => void;
  onBack: () => void;
  onSubmit: (formData: Step3Data) => void;
  loading: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid, isSubmitted },
  } = useForm<Step3Data>({
    resolver: zodResolver(securityStepSchema),
    mode: "onChange",
    defaultValues: {
      password: data.password,
      confirmPassword: data.confirmPassword,
    },
  });

  const password = watch("password");

  const onFormSubmit = (formData: Step3Data) => {
    update(formData);
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)}>
      <div className="text-center mb-7">
        <h2 className="text-[22px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
          Secure Your Account
        </h2>
        <p className="hidden sm:block text-[14px] text-slate-500 dark:text-slate-400 mt-1.5">
          Set a strong password to protect your account
        </p>
      </div>

      <div className="space-y-4">
        <PasswordInput
          label="Password"
          id="reg-password"
          showStrength
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <PasswordInput
          label="Confirm Password"
          id="reg-confirm-password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" type="button" onClick={onBack} fullWidth>
          <span className="flex items-center justify-center gap-2">
            <ArrowLeft size={16} />
            Back
          </span>
        </Button>
        <Button
          type="submit"
          loading={loading}
          disabled={(isSubmitted && !isValid) || !password}
          fullWidth
        >
          {!loading && "Create Account"}
          {loading && "Creating..."}
        </Button>
      </div>
    </form>
  );
}
