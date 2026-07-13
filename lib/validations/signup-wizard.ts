import { z } from "zod";

// Register Step 1: Personal Schema
export const personalStepSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .min(8, "Phone number must be at least 8 characters"),
  countryCode: z.string().min(1, "Country code is required"),
  country: z.string().min(1, "Country selection is required"),
});

// Register Step 2: Company Schema
export const companyStepSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  workspaceName: z
    .string()
    .min(1, "Workspace name is required")
    .regex(/^[a-z0-9-]+$/, "Workspace URL can only contain lowercase letters, numbers, and hyphens"),
  industry: z.string().min(1, "Industry selection is required"),
  teamSize: z.string().min(1, "Team size is required"),
});

// Register Step 3: Security Schema
export const securityStepSchema = z
  .object({
    password: z
      .string()
      .min(1, "Password is required")
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
