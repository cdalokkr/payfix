"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Palette, Sparkles, Image, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppButton } from "@/components/ui/button-system";
import { FormInput } from "@/components/ui/form-input";

interface BrandingTabProps {
  tenant: {
    id: string;
    slug: string;
    companyName: string;
    branding?: {
      appName: string;
      shortName?: string | null;
      tagline?: string | null;
      primaryColor: string;
      secondaryColor: string;
      accentColor?: string | null;
      logoUrl?: string | null;
      faviconUrl?: string | null;
    } | null;
  };
  onRefresh?: () => void;
}

export function BrandingTab({ tenant, onRefresh }: BrandingTabProps) {
  const utils = trpc.useUtils();

  const [appName, setAppName] = useState(tenant.branding?.appName || tenant.companyName);
  const [shortName, setShortName] = useState(tenant.branding?.shortName || "");
  const [tagline, setTagline] = useState(tenant.branding?.tagline || "");
  const [primaryColor, setPrimaryColor] = useState(tenant.branding?.primaryColor || "#4f46e5");
  const [secondaryColor, setSecondaryColor] = useState(tenant.branding?.secondaryColor || "#0f172a");
  const [accentColor, setAccentColor] = useState(tenant.branding?.accentColor || "#f59e0b");
  const [logoUrl, setLogoUrl] = useState(tenant.branding?.logoUrl || "");
  const [faviconUrl, setFaviconUrl] = useState(tenant.branding?.faviconUrl || "");

  useEffect(() => {
    setAppName(tenant.branding?.appName || tenant.companyName);
    setShortName(tenant.branding?.shortName || "");
    setTagline(tenant.branding?.tagline || "");
    setPrimaryColor(tenant.branding?.primaryColor || "#4f46e5");
    setSecondaryColor(tenant.branding?.secondaryColor || "#0f172a");
    setAccentColor(tenant.branding?.accentColor || "#f59e0b");
    setLogoUrl(tenant.branding?.logoUrl || "");
    setFaviconUrl(tenant.branding?.faviconUrl || "");
  }, [tenant.id, tenant.branding]);

  const updateBrandingMutation = trpc.superadmin.updateTenantBranding.useMutation({
    onSuccess: () => {
      toast.success("White-label branding updated successfully!");
      utils.superadmin.listTenants.invalidate();
      onRefresh?.();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update branding");
    },
  });

  const handleSaveBranding = () => {
    if (!appName.trim()) {
      toast.error("Application name is required");
      return;
    }
    updateBrandingMutation.mutate({
      tenantId: tenant.id,
      appName: appName.trim(),
      shortName: shortName.trim() || undefined,
      tagline: tagline.trim() || undefined,
      primaryColor,
      secondaryColor,
      accentColor,
      logoUrl: logoUrl.trim() || null,
      faviconUrl: faviconUrl.trim() || null,
    });
  };

  const handleResetToDefaults = () => {
    setPrimaryColor("#4f46e5");
    setSecondaryColor("#0f172a");
    setAccentColor("#f59e0b");
    setLogoUrl("");
    setFaviconUrl("");
    setAppName(tenant.companyName);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left">
      {/* 1. App Identity Section */}
      <div className="bg-white dark:bg-[#0B131A]/60 border border-slate-200/90 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#635BFF]" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              White-Label Branding Studio
            </h4>
          </div>
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Reset Defaults
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <FormInput
            label="Application Name *"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="e.g. Acme Workforce"
          />
          <FormInput
            label="Short Name (PWA Icon)"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="e.g. Acme"
          />
          <FormInput
            label="Tagline / Motto"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="e.g. Attendance & Payroll"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          <FormInput
            label="Company Logo URL"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
          />
          <FormInput
            label="Favicon URL"
            value={faviconUrl}
            onChange={(e) => setFaviconUrl(e.target.value)}
            placeholder="https://example.com/favicon.ico"
          />
        </div>
      </div>

      {/* 2. Color Theme Palette */}
      <div className="bg-white dark:bg-[#0B131A]/60 border border-slate-200/90 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Brand Color Palette
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Colors are dynamically injected as CSS custom properties into this tenant's login screen and PWA.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Primary Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Primary Brand Color
            </label>
            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 bg-slate-50/50 dark:bg-[#121B22]">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-8 h-8 rounded-md cursor-pointer border-0 bg-transparent p-0"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-full text-xs font-mono font-medium bg-transparent focus:outline-hidden"
              />
            </div>
          </div>

          {/* Secondary Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Secondary / Header Dark Color
            </label>
            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 bg-slate-50/50 dark:bg-[#121B22]">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-8 h-8 rounded-md cursor-pointer border-0 bg-transparent p-0"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-full text-xs font-mono font-medium bg-transparent focus:outline-hidden"
              />
            </div>
          </div>

          {/* Accent Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Accent / Highlight Color
            </label>
            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 bg-slate-50/50 dark:bg-[#121B22]">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-8 h-8 rounded-md cursor-pointer border-0 bg-transparent p-0"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-full text-xs font-mono font-medium bg-transparent focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Visual Preview Card */}
      <div className="bg-slate-50/70 dark:bg-[#121B22] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Live White-Label Preview
          </h4>
        </div>

        {/* Mock PWA / Login Bar */}
        <div className="rounded-xl overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-sm max-w-lg mx-auto bg-white dark:bg-[#0B131A]">
          {/* Header Bar */}
          <div 
            className="p-3.5 flex items-center justify-between text-white transition-colors"
            style={{ backgroundColor: secondaryColor }}
          >
            <div className="flex items-center gap-2.5">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-7 h-7 object-contain rounded-md bg-white/10 p-0.5" />
              ) : (
                <div 
                  className="w-7 h-7 rounded-md flex items-center justify-center font-black text-xs"
                  style={{ backgroundColor: primaryColor }}
                >
                  {appName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <div className="text-xs font-extrabold leading-none">{appName}</div>
                {tagline && <div className="text-[10px] text-white/70 pt-0.5">{tagline}</div>}
              </div>
            </div>

            <span 
              className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs"
              style={{ backgroundColor: primaryColor }}
            >
              PWA Online
            </span>
          </div>

          {/* Sample Card Body */}
          <div className="p-5 text-center space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Welcome to <strong>{appName}</strong>. Employees see this branding across Mobile PWA, Tablet Kiosk, and Desktop Portal.
            </p>

            <button
              type="button"
              className="px-4 py-2 rounded-lg text-xs font-bold text-white shadow-xs transition-opacity hover:opacity-95 cursor-default"
              style={{ backgroundColor: primaryColor }}
            >
              Sample Branded Button
            </button>
          </div>
        </div>
      </div>

      {/* 4. Save Button Bar */}
      <div className="flex justify-end pt-2">
        <AppButton
          variant="primary"
          className="px-8 h-[38px]"
          disabled={updateBrandingMutation.isPending}
          onClick={handleSaveBranding}
        >
          {updateBrandingMutation.isPending ? "Saving Branding..." : "Save Branding Settings"}
        </AppButton>
      </div>
    </div>
  );
}
