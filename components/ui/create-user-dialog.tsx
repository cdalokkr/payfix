"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import AsyncButton from "./async-button";
import { X, UserPlus, User, Shield, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const userSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  mobile: z
    .string()
    .min(10, "Mobile number must be at least 10 digits")
    .regex(/^[0-9]+$/, "Mobile number must be numeric"),
  dob: z.string().min(1, "Date of birth is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["User", "Admin"] as const, { message: "Role is required" }),
});

type UserFormData = z.infer<typeof userSchema>;

export default function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      mobile: "",
      dob: "",
      email: "",
      password: "",
      role: "User",
    },
    mode: "onChange", // validate as user types
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting: formSubmitting },
    trigger,
    setValue,
    watch,
    reset,
  } = form;

  const handleCreateUser = async (data: UserFormData) => {
    // Simulate API call
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create user");
    }

    await new Promise((r) => setTimeout(r, 800));
    reset();
    setOpen(false);
  };

  // ✅ AsyncButton handler that checks form validity first
  const handleAsyncButtonClick = async () => {
    try {
      setIsSubmitting(true);
      const isValid = await trigger(); // trigger validation manually
      if (!isValid) throw new Error("Please correct the highlighted fields");
      const data = form.getValues();
      await handleCreateUser(data);
      setIsSubmitting(false);
    } catch (error) {
      setIsSubmitting(false);
      throw error;
    }
  };

  // Check for form validation errors
  const hasFormErrors = Object.keys(form.formState.errors).length > 0;
  
  // Check if required fields have values
  const hasRequiredFields = !!form.watch('firstName') &&
                           !!form.watch('lastName') &&
                           !!form.watch('email') &&
                           !!form.watch('password');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          <UserPlus className="w-4 h-4" />
          Create User
        </button>
      </DialogTrigger>

      <DialogContent
        className={cn(
          "sm:max-w-lg p-0 overflow-hidden rounded-xl border bg-white shadow-lg"
        )}
      >
        {/* Fixed Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-100 text-blue-700">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Create a New User</h2>
              <p className="text-sm text-gray-500">
                Create a new user for Application users
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form className="max-h-[70vh] overflow-y-auto p-4 space-y-6">
          <Accordion type="multiple" defaultValue={["personal", "account"]}>
            {/* PERSONAL */}
            <AccordionItem value="personal">
              <AccordionTrigger className="text-base font-medium">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <div>
                    <p>Personal Information</p>
                    <span className="text-xs text-gray-500">
                      Basic personal details
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-3 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>First Name</Label>
                    <Input {...register("firstName")} placeholder="Enter first name" />
                    {errors.firstName && (
                      <p className="text-sm text-red-500 mt-1">{errors.firstName.message}</p>
                    )}
                  </div>

                  <div>
                    <Label>Last Name</Label>
                    <Input {...register("lastName")} placeholder="Enter last name" />
                    {errors.lastName && (
                      <p className="text-sm text-red-500 mt-1">{errors.lastName.message}</p>
                    )}
                  </div>

                  <div>
                    <Label>Mobile No</Label>
                    <Input {...register("mobile")} placeholder="Enter mobile number" />
                    {errors.mobile && (
                      <p className="text-sm text-red-500 mt-1">{errors.mobile.message}</p>
                    )}
                  </div>

                  <div>
                    <Label>Date of Birth</Label>
                    <Input type="date" {...register("dob")} />
                    {errors.dob && (
                      <p className="text-sm text-red-500 mt-1">{errors.dob.message}</p>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ACCOUNT CREDENTIAL */}
            <AccordionItem value="account">
              <AccordionTrigger className="text-base font-medium">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-600" />
                  <div>
                    <p>Account Credential</p>
                    <span className="text-xs text-gray-500">
                      Email and password setup
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-3 space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input {...register("email")} placeholder="Enter email" />
                  {errors.email && (
                    <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <Label>Password</Label>
                  <PasswordInput {...register("password")} placeholder="Enter password" />
                  {errors.password && (
                    <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ACCESS & PERMISSION */}
            <AccordionItem value="access">
              <AccordionTrigger className="text-base font-medium">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-600" />
                  <div>
                    <p>Access and Permission</p>
                    <span className="text-xs text-gray-500">
                      Define user role and access level
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-3 space-y-4">
                <div>
                  <Label>Role</Label>
                  <Select
                    onValueChange={(val) => setValue("role", val as "User" | "Admin")}
                    value={watch("role")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="User">User</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.role && (
                    <p className="text-sm text-red-500 mt-1">{errors.role.message}</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>

            <AsyncButton
              onClick={handleAsyncButtonClick}
              loadingText="Creating user..."
              successText="User created!"
              errorText={hasFormErrors ? "Please fix form errors" : "Failed to create user"}
              hasFormErrors={hasFormErrors}
              successDuration={3000}
              className="min-w-[140px]"
              disabled={!hasRequiredFields || isSubmitting || formSubmitting}
              variant="primary"
            >
              Create User
            </AsyncButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
