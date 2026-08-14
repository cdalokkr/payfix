"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/auth/ui/input";
import PhoneInput from "@/components/auth/ui/phone-input";
import { SelectCustom as Select } from "@/components/auth/ui/select";
import { Button } from "@/components/auth/ui/button";
import { personalStepSchema } from "@/lib/validations/signup-wizard";
import { COUNTRY_OPTIONS, WORLD_COUNTRIES } from "@/lib/data/countries";
import { trpc } from "@/lib/trpc/client";
import type { RegisterFormData } from "./types";

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
  const [isValidating, setIsValidating] = useState(false);
  const checkContactMutation = trpc.auth.checkContactAvailability.useMutation();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
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
      countryCode: data.countryCode || "+91",
      country: data.country || "IN",
    },
  });

  const countryCode = watch("countryCode");
  const country = watch("country");
  const phone = watch("phone");

  const handleCountryChange = (countryIso: string) => {
    setValue("country", countryIso, { shouldValidate: true });
    const matched = WORLD_COUNTRIES.find((c) => c.code === countryIso);
    if (matched) {
      setValue("countryCode", matched.dialCode, { shouldValidate: true });
    }
  };

  const handlePhoneCountryChange = (dialCode: string) => {
    setValue("countryCode", dialCode, { shouldValidate: true });
    const matched = WORLD_COUNTRIES.find((c) => c.dialCode === dialCode);
    if (matched) {
      setValue("country", matched.code, { shouldValidate: true });
    }
  };

  const onSubmit = async (formData: Step1Data) => {
    setIsValidating(true);
    try {
      const check = await checkContactMutation.mutateAsync({
        email: formData.email,
        phone: `${formData.countryCode}${formData.phone}`,
      });

      if (!check.available) {
        const errRes = check as { available: false; field?: string; message?: string };
        setError("email", {
          type: "manual",
          message: errRes.message || "This email is already registered.",
        });
        setIsValidating(false);
        return;
      }

      update(formData);
      onNext();
    } catch (err) {
      // If network error, still allow progressing or notify
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
          Create Your Account
        </h2>
        <p className="hidden sm:block text-[13px] sm:text-[14px] text-slate-500 dark:text-slate-400 mt-1.5">
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
            onCountryChange={handlePhoneCountryChange}
            error={errors.phone?.message}
            onChange={(e) => setValue("phone", e.target.value, { shouldValidate: true })}
          />
          <Select
            label="Country"
            id="country"
            options={COUNTRY_OPTIONS}
            value={country}
            error={errors.country?.message}
            onChange={handleCountryChange}
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={(isSubmitted && !isValid) || isValidating}
        className="mt-5 group"
      >
        <span className="flex items-center justify-center gap-2">
          {isValidating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Verifying...
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
    </form>
  );
}
