// ============================================
// lib/trpc/routers/organization.ts
// Tenant Business Profile, Logo & Branding Router
// Accessible by Tenant Admins, Moderators, and SuperAdmins
// ============================================
import { z } from 'zod';
import { router, protectedProcedure } from '../server';
import { TRPCError } from '@trpc/server';
import { masterDb } from '@/lib/db/master-connection';
import { tenants, tenantBranding } from '@/lib/db/master-schema';
import { eq } from 'drizzle-orm';
import { clearTenantBrandingCache } from '@/lib/tenant/resolver';
import { deleteTenantLogo } from '@/lib/utils/tenant-logo-upload';

// Authorization middleware: allows Tenant Admin, Moderator, and SuperAdmin
const tenantStaffProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.tenant?.trusted) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'A valid workspace context is required.',
    });
  }

  const role = ctx.profile.role;
  if (role !== 'admin' && role !== 'moderator' && role !== 'super_admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only workspace administrators and moderators have access to business branding and profile settings.',
    });
  }

  return next({ ctx });
});

export const organizationRouter = router({
  // 1. Get current tenant branding and business profile
  getBranding: protectedProcedure.query(async ({ ctx }) => {
    try {
      const tenantId = ctx.tenant?.tenantId;
      if (!tenantId) {
        return null;
      }

      const [tenantRecord, brandingRecord] = await Promise.all([
        masterDb.query.tenants.findFirst({
          where: eq(tenants.id, tenantId),
        }),
        masterDb.query.tenantBranding.findFirst({
          where: eq(tenantBranding.tenant_id, tenantId),
        }).catch(() => null)
      ]);

      if (!tenantRecord) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant workspace not found' });
      }

      return {
        tenantId: tenantRecord.id,
        slug: tenantRecord.slug,
        companyName: tenantRecord.company_name,
        adminEmail: tenantRecord.admin_email,
        branding: brandingRecord ? {
          appName: brandingRecord.app_name || tenantRecord.company_name,
          shortName: brandingRecord.short_name || tenantRecord.company_name,
          tagline: brandingRecord.tagline || null,
          logoUrl: brandingRecord.logo_url || null,
          faviconUrl: brandingRecord.favicon_url || null,
          splashUrl: brandingRecord.splash_url || null,
          primaryColor: brandingRecord.primary_color || '#4f46e5',
          secondaryColor: brandingRecord.secondary_color || '#0f172a',
          accentColor: brandingRecord.accent_color || '#f59e0b',
          // Business details
          companyLegalName: brandingRecord.company_legal_name || tenantRecord.company_name,
          companyAddress: brandingRecord.company_address || null,
          city: brandingRecord.city || null,
          state: brandingRecord.state || null,
          pincode: brandingRecord.pincode || null,
          country: brandingRecord.country || 'India',
          contactEmail: brandingRecord.contact_email || tenantRecord.admin_email,
          contactPhone: brandingRecord.contact_phone || null,
          website: brandingRecord.website || null,
          taxId: brandingRecord.tax_id || null,
          reportLogoHeight: brandingRecord.report_logo_height ?? 24,
          reportLogoAlignment: (brandingRecord.report_logo_alignment as 'left' | 'center' | 'right') || 'left',
          payslipNotes: brandingRecord.payslip_notes || 'This is a computer generated payslip and does not require a signature.',
        } : {
          appName: tenantRecord.company_name,
          shortName: tenantRecord.company_name,
          tagline: null,
          logoUrl: null,
          faviconUrl: null,
          splashUrl: null,
          primaryColor: '#4f46e5',
          secondaryColor: '#0f172a',
          accentColor: '#f59e0b',
          companyLegalName: tenantRecord.company_name,
          companyAddress: null,
          city: null,
          state: null,
          pincode: null,
          country: 'India',
          contactEmail: tenantRecord.admin_email,
          contactPhone: null,
          website: null,
          taxId: null,
          reportLogoHeight: 24,
          reportLogoAlignment: 'left' as const,
          payslipNotes: 'This is a computer generated payslip and does not require a signature.',
        }
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('[ORGANIZATION] getBranding error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve workspace branding',
      });
    }
  }),

  // 2. Update Business Logo (Admin & Moderator)
  updateLogo: tenantStaffProcedure
    .input(z.object({
      logoUrl: z.string().min(1, 'Logo URL is required'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.tenant!.tenantId;

        const existing = await masterDb.query.tenantBranding.findFirst({
          where: eq(tenantBranding.tenant_id, tenantId),
        });

        const oldLogoUrl = existing?.logo_url;

        if (existing) {
          await masterDb
            .update(tenantBranding)
            .set({
              logo_url: input.logoUrl,
              updated_at: new Date(),
            })
            .where(eq(tenantBranding.tenant_id, tenantId));
        } else {
          await masterDb.insert(tenantBranding).values({
            tenant_id: tenantId,
            logo_url: input.logoUrl,
            updated_at: new Date(),
          });
        }

        // Delete previous custom logo from storage if it changed and was not a default
        if (oldLogoUrl && oldLogoUrl !== input.logoUrl) {
          await deleteTenantLogo(oldLogoUrl).catch((err) => {
            console.warn('[ORGANIZATION] Failed to cleanup previous logo:', err);
          });
        }

        // Invalidate resolver cache so web app, PWA, and reports see new logo immediately
        clearTenantBrandingCache(tenantId);
        if (ctx.tenant?.slug) {
          clearTenantBrandingCache(ctx.tenant.slug);
        }

        return {
          success: true,
          logoUrl: input.logoUrl,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[ORGANIZATION] updateLogo error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update business logo',
        });
      }
    }),

  // 3. Delete Business Logo (Admin & Moderator)
  deleteLogo: tenantStaffProcedure
    .mutation(async ({ ctx }) => {
      try {
        const tenantId = ctx.tenant!.tenantId;

        const existing = await masterDb.query.tenantBranding.findFirst({
          where: eq(tenantBranding.tenant_id, tenantId),
        });

        if (existing?.logo_url) {
          const oldLogoUrl = existing.logo_url;

          await masterDb
            .update(tenantBranding)
            .set({
              logo_url: null,
              updated_at: new Date(),
            })
            .where(eq(tenantBranding.tenant_id, tenantId));

          // Clean up file in Supabase storage
          await deleteTenantLogo(oldLogoUrl).catch((err) => {
            console.warn('[ORGANIZATION] Failed to delete logo file from storage:', err);
          });
        }

        // Invalidate resolver cache
        clearTenantBrandingCache(tenantId);
        if (ctx.tenant?.slug) {
          clearTenantBrandingCache(ctx.tenant.slug);
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[ORGANIZATION] deleteLogo error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete business logo',
        });
      }
    }),

  // 4. Update Business Details & Report Settings (Admin & Moderator)
  updateBusinessDetails: tenantStaffProcedure
    .input(z.object({
      appName: z.string().trim().min(1).optional(),
      tagline: z.string().trim().optional().nullable(),
      companyLegalName: z.string().trim().optional().nullable(),
      companyAddress: z.string().trim().optional().nullable(),
      city: z.string().trim().optional().nullable(),
      state: z.string().trim().optional().nullable(),
      pincode: z.string().trim().optional().nullable(),
      country: z.string().trim().optional().nullable(),
      contactEmail: z.string().trim().email().optional().nullable().or(z.literal('')),
      contactPhone: z.string().trim().optional().nullable(),
      website: z.string().trim().optional().nullable(),
      taxId: z.string().trim().optional().nullable(),
      reportLogoHeight: z.number().min(12).max(60).optional(),
      reportLogoAlignment: z.enum(['left', 'center', 'right']).optional(),
      payslipNotes: z.string().trim().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.tenant!.tenantId;

        const existing = await masterDb.query.tenantBranding.findFirst({
          where: eq(tenantBranding.tenant_id, tenantId),
        });

        const payload: Record<string, any> = {
          updated_at: new Date(),
        };

        if (input.appName !== undefined) payload.app_name = input.appName;
        if (input.tagline !== undefined) payload.tagline = input.tagline || null;
        if (input.companyLegalName !== undefined) payload.company_legal_name = input.companyLegalName || null;
        if (input.companyAddress !== undefined) payload.company_address = input.companyAddress || null;
        if (input.city !== undefined) payload.city = input.city || null;
        if (input.state !== undefined) payload.state = input.state || null;
        if (input.pincode !== undefined) payload.pincode = input.pincode || null;
        if (input.country !== undefined) payload.country = input.country || 'India';
        if (input.contactEmail !== undefined) payload.contact_email = input.contactEmail || null;
        if (input.contactPhone !== undefined) payload.contact_phone = input.contactPhone || null;
        if (input.website !== undefined) payload.website = input.website || null;
        if (input.taxId !== undefined) payload.tax_id = input.taxId || null;
        if (input.reportLogoHeight !== undefined) payload.report_logo_height = input.reportLogoHeight;
        if (input.reportLogoAlignment !== undefined) payload.report_logo_alignment = input.reportLogoAlignment;
        if (input.payslipNotes !== undefined) payload.payslip_notes = input.payslipNotes || null;

        if (existing) {
          await masterDb
            .update(tenantBranding)
            .set(payload)
            .where(eq(tenantBranding.tenant_id, tenantId));
        } else {
          await masterDb.insert(tenantBranding).values({
            tenant_id: tenantId,
            ...payload,
          });
        }

        // Invalidate cache
        clearTenantBrandingCache(tenantId);
        if (ctx.tenant?.slug) {
          clearTenantBrandingCache(ctx.tenant.slug);
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[ORGANIZATION] updateBusinessDetails error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update business profile details',
        });
      }
    }),

  // 5. AI Smart Autofill: Extract business details from Business Card / GST Document
  extractBusinessDetailsWithAI: tenantStaffProcedure
    .input(z.object({
      base64Image: z.string().min(1, 'Base64 image data is required'),
      mimeType: z.string().default('image/jpeg'),
    }))
    .mutation(async ({ input }) => {
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY in environment variables.',
          });
        }

        const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Strip prefix if included
        const cleanBase64 = input.base64Image.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');

        const prompt = `Analyze this business document (e.g., business card, GST certificate, letterhead, or invoice header). 
Extract the business information and return ONLY a valid JSON object with the following fields:
{
  "companyLegalName": "Company or Business Name",
  "tagline": "Slogan or tagline if visible",
  "companyAddress": "Street address or landmark",
  "city": "City name",
  "state": "State name",
  "pincode": "Postal/PIN code",
  "country": "Country (default India if not specified)",
  "contactEmail": "Official email address",
  "contactPhone": "Phone or mobile number",
  "website": "Website URL if visible",
  "taxId": "GSTIN / PAN / Registration Number if visible"
}
If any field is missing or not visible in the image, set its value to null. Return ONLY the raw JSON without markdown formatting or code blocks.`;

        const requestBody = {
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: input.mimeType,
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`Gemini API error [${res.status}]: ${errBody}`);
        }

        const data = (await res.json()) as any;
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text || '{}';

        // Clean out possible markdown code blocks ```json ... ```
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('AI was unable to parse structured business details from this image.');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          details: parsed,
        };
      } catch (err: any) {
        console.error('[ORGANIZATION] extractBusinessDetailsWithAI error:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'AI document extraction failed',
        });
      }
    }),
});
