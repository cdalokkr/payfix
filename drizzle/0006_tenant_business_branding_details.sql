-- Alter public.tenant_branding to add business details and report customization columns
ALTER TABLE "tenant_branding" ADD COLUMN IF NOT EXISTS "company_legal_name" text;
ALTER TABLE "tenant_branding" ADD COLUMN IF NOT EXISTS "company_address" text;
ALTER TABLE "tenant_branding" ADD COLUMN IF NOT EXISTS "city" varchar(100);
ALTER TABLE "tenant_branding" ADD COLUMN IF NOT EXISTS "state" varchar(100);
ALTER TABLE "tenant_branding" ADD COLUMN IF NOT EXISTS "pincode" varchar(20);
ALTER TABLE "tenant_branding" ADD COLUMN IF NOT EXISTS "country" varchar(100) DEFAULT 'India';
ALTER TABLE "tenant_branding" ADD COLUMN IF NOT EXISTS "contact_email" text;
ALTER TABLE "tenant_branding" ADD COLUMN IF NOT EXISTS "contact_phone" varchar(30);
ALTER TABLE "tenant_branding" ADD COLUMN IF NOT EXISTS "website" text;
ALTER TABLE "tenant_branding" ADD COLUMN IF NOT EXISTS "tax_id" varchar(50);
ALTER TABLE "tenant_branding" ADD COLUMN IF NOT EXISTS "report_logo_height" integer DEFAULT 24;
ALTER TABLE "tenant_branding" ADD COLUMN IF NOT EXISTS "report_logo_alignment" varchar(20) DEFAULT 'left';
ALTER TABLE "tenant_branding" ADD COLUMN IF NOT EXISTS "payslip_notes" text;
