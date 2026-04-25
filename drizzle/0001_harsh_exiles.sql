CREATE TYPE "public"."attendance_source" AS ENUM('mobile', 'biometric', 'manual', 'bulk');--> statement-breakpoint
CREATE TYPE "public"."call_log_status" AS ENUM('done', 'pending', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."complaint_category" AS ENUM('billing', 'technical', 'service', 'product', 'general');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "biometric_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"serial_number" varchar(100),
	"location" text,
	"ip_address" varchar(45),
	"status" text DEFAULT 'active',
	"last_sync_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "biometric_devices_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid,
	"complaint_id" uuid,
	"client_id" uuid,
	"called_by" uuid NOT NULL,
	"contact_name" text,
	"contact_phone" varchar(20),
	"call_type" text DEFAULT 'outbound',
	"duration_minutes" integer,
	"notes" text,
	"remarks" text,
	"status" "call_log_status" DEFAULT 'pending',
	"next_follow_up" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" varchar(20),
	"alt_phone" varchar(20),
	"gst_number" varchar(20),
	"pan_number" varchar(15),
	"website" text,
	"industry" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"pincode" varchar(10),
	"country" text DEFAULT 'India',
	"contacts" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"status" text DEFAULT 'active',
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"complaint_number" varchar(20) NOT NULL,
	"client_id" uuid,
	"subject" text NOT NULL,
	"description" text,
	"category" "complaint_category" DEFAULT 'general',
	"priority" "ticket_priority" DEFAULT 'medium',
	"status" "ticket_status" DEFAULT 'open',
	"source" text DEFAULT 'email',
	"sla_hours" integer DEFAULT 48,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "complaints_complaint_number_unique" UNIQUE("complaint_number")
);
--> statement-breakpoint
CREATE TABLE "ticket_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"assigned_to" uuid NOT NULL,
	"assigned_by" uuid,
	"role" text DEFAULT 'assignee',
	"is_primary" boolean DEFAULT false,
	"assigned_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"resolved_by" uuid NOT NULL,
	"resolution_text" text NOT NULL,
	"remarks" text,
	"hours_spent" numeric(6, 2),
	"status_after" "ticket_status" DEFAULT 'in_progress',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" varchar(20) NOT NULL,
	"complaint_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"priority" "ticket_priority" DEFAULT 'medium',
	"status" "ticket_status" DEFAULT 'open',
	"due_date" date,
	"estimated_hours" numeric(6, 2),
	"actual_hours" numeric(6, 2),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "source" "attendance_source" DEFAULT 'mobile';--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "device_id" text;--> statement-breakpoint
ALTER TABLE "employee_settings" ADD COLUMN "biometric_device_user_id" text;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_called_by_profiles_id_fk" FOREIGN KEY ("called_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_assigned_by_profiles_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_resolutions" ADD CONSTRAINT "ticket_resolutions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_resolutions" ADD CONSTRAINT "ticket_resolutions_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;