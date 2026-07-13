"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, ArrowRight } from "lucide-react";
import { Input } from "@/components/auth/ui/input";
import PhoneInput from "@/components/auth/ui/phone-input";
import { SelectCustom as Select } from "@/components/auth/ui/select";
import { Button } from "@/components/auth/ui/button";
import { personalStepSchema } from "@/lib/validations/signup-wizard";
import type { RegisterFormData } from "./types";

const COUNTRIES = [
  { value: "IN", label: "India" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" },
  { value: "OTHER", label: "Other" },
];

type Step1Data = z.infer<typeof personalStepSchema>;

export default function PersonalStep({
  data,
  update,
  onNext,
}: {
  data: RegisterFormData;
  update: (patch: Partial<RegisterFormData>) => void;
  onNext: () => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid, isSubmitted },
  } = useForm<Step1Data>({
    resolver: zodResolver(personalStepSchema),
    mode: "onChange",
    defaultValues: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      countryCode: data.countryCode,
      country: data.country,
    },
  });

  const countryCode = watch("countryCode");
  const country = watch("country");
  const phone = watch("phone");

  const onSubmit = (formData: Step1Data) => {
    update(formData);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="text-center mb-6">
        <h2 className="text-[20px] sm:text-[22px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
          Create Your Account
        </h2>
        <p className="text-[13px] sm:text-[14px] text-slate-500 dark:text-slate-400 mt-1.5">
          Let&apos;s start with your personal information
        </p>
      </div>

      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            id="firstName"
            error={errors.firstName?.message}
            autoComplete="given-name"
            {...register("firstName")}
          />
          <Input
            label="Last Name"
            id="lastName"
            error={errors.lastName?.message}
            autoComplete="family-name"
            {...register("lastName")}
          />
        </div>

        <Input
          label="Email Address"
          type="email"
          id="email"
          icon={<Mail size={16} />}
          error={errors.email?.message}
          autoComplete="email"
          {...register("email")}
        />

        {/* Phone + Country — side by side on lg+, stacked on mobile/tablet */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <PhoneInput
            label="Phone Number"
            id="phone"
            value={phone}
            countryCode={countryCode}
            onCountryChange={(code) => setValue("countryCode", code, { shouldValidate: true })}
            error={errors.phone?.message}
            onChange={(e) => setValue("phone", e.target.value, { shouldValidate: true })}
          />
          <Select
            label="Country"
            id="country"
            options={COUNTRIES}
            value={country}
            error={errors.country?.message}
            onChange={(val) => setValue("country", val, { shouldValidate: true })}
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={isSubmitted && !isValid}
        className="mt-5 group"
      >
        <span className="flex items-center justify-center gap-2">
          Next Step
          <ArrowRight
            size={16}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </span>
      </Button>
    </form>
  );
}
