"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, ArrowRight, ArrowLeft } from "lucide-react";
import { Input } from "@/components/auth/ui/input";
import { SelectCustom as Select } from "@/components/auth/ui/select";
import { Button } from "@/components/auth/ui/button";
import { companyStepSchema } from "@/lib/validations/signup-wizard";
import type { RegisterFormData } from "./types";

const INDUSTRIES = [
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance" },
  { value: "education", label: "Education" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
];

const TEAM_SIZES = [
  { value: "1-10", label: "1–10 employees" },
  { value: "11-50", label: "11–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "201-500", label: "201–500 employees" },
  { value: "500+", label: "500+ employees" },
];

type Step2Data = z.infer<typeof companyStepSchema>;

export default function CompanyStep({
  data,
  update,
  onNext,
  onBack,
}: {
  data: RegisterFormData;
  update: (patch: Partial<RegisterFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid, isSubmitted },
  } = useForm<Step2Data>({
    resolver: zodResolver(companyStepSchema),
    mode: "onChange",
    defaultValues: {
      companyName: data.companyName,
      workspaceName: data.workspaceName,
      industry: data.industry,
      teamSize: data.teamSize,
    },
  });

  const industry = watch("industry");
  const teamSize = watch("teamSize");

  const onSubmit = (formData: Step2Data) => {
    update(formData);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="text-center mb-6">
        <h2 className="text-[20px] sm:text-[22px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
          Tell us about your company
        </h2>
        <p className="hidden sm:block text-[13px] sm:text-[14px] text-slate-500 dark:text-slate-400 mt-1.5">
          We&apos;ll customize your workspace experience
        </p>
      </div>

      <div className="space-y-3.5">
        <Input
          label="Company Name"
          id="companyName"
          icon={<Building2 size={16} />}
          error={errors.companyName?.message}
          autoComplete="organization"
          {...register("companyName")}
        />

        <Input
          label="Workspace Name (Subdomain)"
          id="workspaceName"
          error={errors.workspaceName?.message}
          {...register("workspaceName")}
          onChange={(e) => {
            setValue("workspaceName", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""), { shouldValidate: true });
          }}
        />

        {/* Industry + Team Size — side by side on lg+, stacked on mobile/tablet */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Select
            label="Industry"
            id="industry"
            options={INDUSTRIES}
            value={industry}
            error={errors.industry?.message}
            onChange={(val) => setValue("industry", val, { shouldValidate: true })}
          />
          <Select
            label="Team Size"
            id="teamSize"
            options={TEAM_SIZES}
            value={teamSize}
            error={errors.teamSize?.message}
            onChange={(val) => setValue("teamSize", val, { shouldValidate: true })}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" type="button" onClick={onBack} fullWidth>
          <span className="flex items-center justify-center gap-2">
            <ArrowLeft size={16} />
            Back
          </span>
        </Button>
        <Button type="submit" disabled={isSubmitted && !isValid} className="group" fullWidth>
          <span className="flex items-center justify-center gap-2">
            Next Step
            <ArrowRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </span>
        </Button>
      </div>
    </form>
  );
}
