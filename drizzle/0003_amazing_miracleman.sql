ALTER TABLE "monthly_attendance_summary" ADD COLUMN "paid_mode" text;--> statement-breakpoint
ALTER TABLE "monthly_attendance_summary" ADD COLUMN "pay_date" date;--> statement-breakpoint
ALTER TABLE "monthly_attendance_summary" ADD COLUMN "pay_reference_no" text;--> statement-breakpoint
ALTER TABLE "monthly_attendance_summary" ADD COLUMN "payment_remarks" text;--> statement-breakpoint
ALTER TABLE "monthly_attendance_summary" ADD COLUMN "paid_by" uuid;--> statement-breakpoint
ALTER TABLE "monthly_attendance_summary" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "office_settings" ADD COLUMN "absent_deduction_multiplier" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "monthly_attendance_summary" ADD CONSTRAINT "monthly_attendance_summary_paid_by_profiles_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;