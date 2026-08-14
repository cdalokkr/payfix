"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Globe, Briefcase, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/auth/ui/input";
import { SelectCustom as Select } from "@/components/auth/ui/select";
import { Button } from "@/components/auth/ui/button";
import { companyStepSchema } from "@/lib/validations/signup-wizard";
import { trpc } from "@/lib/trpc/client";
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
  const [isValidating, setIsValidating] = useState(false);
  const checkWorkspaceMutation = trpc.auth.checkWorkspaceAvailability.useMutation();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isValid, isSubmitted },
  } = useForm<Step2Data>({
    resolver: zodResolver(companyStepSchema),
    mode: "onChange",
    defaultValues: {
      companyName: data.companyName,
      workspaceDisplayName: data.workspaceDisplayName || data.companyName,
      workspaceName: data.workspaceName,
      industry: data.industry,
      teamSize: data.teamSize,
    },
  });

  const companyName = watch("companyName");
  const workspaceDisplayName = watch("workspaceDisplayName");
  const workspaceSlug = watch("workspaceName");
  const industry = watch("industry");
  const teamSize = watch("teamSize");

  const [baseDomain, setBaseDomain] = useState("payfix.com");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) {
        const port = window.location.port ? `:${window.location.port}` : "";
        setBaseDomain(`localhost${port}`);
      } else {
        const parts = host.split(".");
        if (parts.length >= 2) {
          setBaseDomain(parts.slice(-2).join("."));
        } else {
          setBaseDomain(host);
        }
      }
    }
  }, []);

  const onSubmit = async (formData: Step2Data) => {
    setIsValidating(true);
    try {
      const check = await checkWorkspaceMutation.mutateAsync({
        slug: formData.workspaceName,
        companyName: formData.companyName,
      });

      if (!check.available) {
        const errRes = check as { available: false; field?: string; message?: string };
        if (errRes.field === "slug") {
          setError("workspaceName", {
            type: "manual",
            message: errRes.message || "Workspace slug is already in use.",
          });
        } else if (errRes.field === "companyName") {
          setError("companyName", {
            type: "manual",
            message: errRes.message || "Company name is already registered.",
          });
        }
        setIsValidating(false);
        return;
      }

      update(formData);
      onNext();
    } catch (err) {
      update(formData);
      onNext();
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="text-center mb-6">
        <h2 className="text-[20px] sm:text-[22px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
          Configure Workspace Information
        </h2>
        <p className="hidden sm:block text-[13px] sm:text-[14px] text-slate-500 dark:text-slate-400 mt-1.5">
          Your registered organization and custom workspace URL
        </p>
      </div>

      <div className="space-y-3.5">
        {/* Row 1: Company Name (Full Width) */}
        <div>
          <Input
            label="Company Name"
            id="companyName"
            icon={<Building2 size={16} />}
            error={errors.companyName?.message}
            placeholder="e.g. KANISHKAM ENTERPRISES PRIVATE LIMITED"
            autoComplete="organization"
            {...register("companyName")}
            onChange={(e) => {
              const val = e.target.value;
              setValue("companyName", val, { shouldValidate: true });

              // Auto-suggest workspace display name & slug if not manually customized
              const simplifiedName = val
                .replace(/\b(PVT|LTD|PRIVATE|LIMITED|LLP|INC|CORP|LLC)\b/gi, "")
                .trim();
              if (!workspaceDisplayName || workspaceDisplayName === companyName) {
                setValue("workspaceDisplayName", simplifiedName || val, { shouldValidate: isSubmitted });
              }

              const autoSlug = (simplifiedName || val)
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "");
              if (!workspaceSlug || workspaceSlug === companyName.toLowerCase().replace(/[^a-z0-9-]/g, "")) {
                setValue("workspaceName", autoSlug, { shouldValidate: isSubmitted });
              }
            }}
          />
          <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-1 pl-0.5">
            Official registered legal entity name
          </span>
        </div>

        {/* Row 2: Workspace Name & Workspace Slug in 2 Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Input
              label="Workspace Name"
              id="workspaceDisplayName"
              icon={<Briefcase size={16} />}
              error={errors.workspaceDisplayName?.message}
              placeholder="e.g. Kanishkam Enterprises"
              value={workspaceDisplayName || ""}
              {...register("workspaceDisplayName")}
              onChange={(e) => {
                setValue("workspaceDisplayName", e.target.value, { shouldValidate: true });
              }}
            />
            <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-1 pl-0.5">
              Display name inside workspace
            </span>
          </div>

          <div>
            <Input
              label="Workspace Slug"
              id="workspaceName"
              icon={<Globe size={16} />}
              error={errors.workspaceName?.message}
              placeholder="e.g. kanishkam"
              value={workspaceSlug || ""}
              {...register("workspaceName")}
              onChange={(e) => {
                // Strict no-space alphanumeric + hyphens filter
                const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                setValue("workspaceName", sanitized, { shouldValidate: true });
              }}
            />
            <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-1 pl-0.5">
              Access URL: <code className="font-semibold text-brand-primary">{workspaceSlug || "slug"}.{baseDomain}</code>
            </span>
          </div>
        </div>

        {/* Row 3: Industry + Team Size in 2 Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" type="button" onClick={onBack} fullWidth>
          <span className="flex items-center justify-center gap-2">
            <ArrowLeft size={16} />
            Back
          </span>
        </Button>
        <Button type="submit" disabled={(isSubmitted && !isValid) || isValidating} className="group" fullWidth>
          <span className="flex items-center justify-center gap-2">
            {isValidating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Checking Availability...
              </>
            ) : (
              <>
                Next Step
                <ArrowRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </>
            )}
          </span>
        </Button>
      </div>
    </form>
  );
}
