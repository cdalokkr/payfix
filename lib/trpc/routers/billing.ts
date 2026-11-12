// ============================================
// lib/trpc/routers/billing.ts
// Workspace Subscription, Renewal & Invoices
// Accessible by Tenant Admins and Moderators
// ============================================
import { z } from 'zod';
import { router, protectedProcedure } from '../server';
import { TRPCError } from '@trpc/server';
import { masterDb } from '@/lib/db/master-connection';
import { tenants, tenantPlans, tenantInvoices, tenantBranding } from '@/lib/db/master-schema';
import { profiles } from '@/lib/db/schema';
import { eq, sql, count } from 'drizzle-orm';

// Restrict access to tenant administrators, moderators, and super admins
const tenantStaffProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.tenant?.trusted) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'A valid workspace context is required.',
    });
  }

  if (ctx.profile.role !== 'admin' && ctx.profile.role !== 'moderator' && ctx.profile.role !== 'super_admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only workspace administrators and moderators have access to billing and invoices.',
    });
  }

  return next({ ctx });
});

export const billingRouter = router({
  // 1. Get workspace subscription, validity, renewal status, and seat usage
  getSubscriptionInfo: tenantStaffProcedure.query(async ({ ctx }) => {
    try {
      const tenantId = ctx.tenant!.tenantId;

      const tenant = await masterDb.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      });

      if (!tenant) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace record not found' });
      }

      let plan: any = null;
      if (tenant.plan_id) {
        plan = await masterDb.query.tenantPlans.findFirst({
          where: eq(tenantPlans.id, tenant.plan_id),
        });
      }

      // Check tenant branding
      const branding = await masterDb.query.tenantBranding.findFirst({
        where: eq(tenantBranding.tenant_id, tenantId),
      }).catch(() => null);

      // Active employee count in this tenant schema
      let activeEmployees = 0;
      try {
        const empCountResult = await ctx.db.select({ val: count() }).from(profiles);
        activeEmployees = Number(empCountResult[0]?.val || 0);
      } catch (err) {
        activeEmployees = 1;
      }

      const expiryDate = tenant.license_expires_at ? new Date(tenant.license_expires_at) : null;
      const isExpired = expiryDate ? expiryDate.getTime() < Date.now() : false;
      const daysRemaining = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
      const isRenewalDue = isExpired || daysRemaining <= 15;

      const maxAllowedEmployees = tenant.max_employees_override ?? plan?.max_employees ?? 50;

      return {
        tenantId: tenant.id,
        companyName: tenant.company_name,
        slug: tenant.slug,
        status: tenant.status,
        effectiveStatus: isExpired ? 'renewal_due' : (tenant.status === 'trial' ? (isRenewalDue ? 'renewal_due' : 'trial') : tenant.status),
        isExpired,
        isRenewalDue,
        daysRemaining: daysRemaining < 0 ? 0 : daysRemaining,
        licenseExpiresAt: expiryDate ? expiryDate.toISOString() : null,
        formattedExpiry: expiryDate ? expiryDate.toLocaleDateString('en-GB') : 'N/A',
        createdAt: tenant.created_at ? new Date(tenant.created_at).toISOString() : null,
        formattedCreated: tenant.created_at ? new Date(tenant.created_at).toLocaleDateString('en-GB') : 'N/A',
        adminEmail: tenant.admin_email,
        adminName: (tenant as any).admin_name || 'Workspace Administrator',
        adminPhone: (tenant as any).admin_phone || 'N/A',
        branding: {
          appName: branding?.app_name || 'PayFix',
          logoUrl: branding?.logo_url || null,
          primaryColor: branding?.primary_color || '#4f46e5',
        },
        plan: {
          id: plan?.id || 'free',
          name: plan?.name || 'free',
          displayName: plan?.display_name || 'Free Plan',
          priceMonthly: Number(plan?.price_monthly || 0),
          features: (plan?.features as Record<string, any>) || {},
          maxEmployees: maxAllowedEmployees,
        },
        usage: {
          currentEmployees: activeEmployees,
          maxEmployees: maxAllowedEmployees,
          percentUsed: Math.min(100, Math.round((activeEmployees / maxAllowedEmployees) * 100)),
        }
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('[BILLING] getSubscriptionInfo error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve workspace subscription information',
      });
    }
  }),

  // 2. Get list of all real invoices for the current workspace
  getInvoices: tenantStaffProcedure.query(async ({ ctx }) => {
    try {
      const tenantId = ctx.tenant!.tenantId;
      const rows = await masterDb
        .select()
        .from(tenantInvoices)
        .where(eq(tenantInvoices.tenant_id, tenantId))
        .orderBy(sql`${tenantInvoices.created_at} DESC`);

      return rows.map((inv) => ({
        id: inv.invoice_number,
        rawId: inv.id,
        date: inv.billing_date ? new Date(inv.billing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
        amount: `₹${Number(inv.amount || 0).toLocaleString('en-IN')}`,
        rawAmount: Number(inv.amount || 0),
        status: inv.status.charAt(0).toUpperCase() + inv.status.slice(1),
        planName: inv.plan_name,
        currency: inv.currency,
        billingCycle: inv.billing_cycle,
        periodStart: inv.period_start ? new Date(inv.period_start).toLocaleDateString('en-GB') : null,
        periodEnd: inv.period_end ? new Date(inv.period_end).toLocaleDateString('en-GB') : null,
        paymentMethod: inv.payment_method || 'Credit Card / Online',
        transactionId: inv.transaction_id || `TXN-${inv.invoice_number.replace('INV-', '')}`,
        createdAt: inv.created_at ? new Date(inv.created_at).toISOString() : null,
      }));
    } catch (error) {
      console.error('[BILLING] getInvoices error:', error);
      return [];
    }
  }),
});
