"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Globe, Copy, Check, ExternalLink, ShieldCheck, AlertCircle, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AppButton } from "@/components/ui/button-system";
import { FormInput } from "@/components/ui/form-input";

interface DomainTabProps {
  tenant: {
    id: string;
    slug: string;
    companyName: string;
    customDomain: string | null;
  };
  baseDomain: string;
  onRefresh?: () => void;
}

export function DomainTab({ tenant, baseDomain, onRefresh }: DomainTabProps) {
  const utils = trpc.useUtils();
  const [domainInput, setDomainInput] = useState(tenant.customDomain || "");
  const [copiedSubdomain, setCopiedSubdomain] = useState(false);
  const [copiedCname, setCopiedCname] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState(false);

  useEffect(() => {
    setDomainInput(tenant.customDomain || "");
  }, [tenant.id, tenant.customDomain]);

  const updateDomainMutation = trpc.superadmin.updateTenantDomain.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.customDomain 
          ? `Custom domain "${data.customDomain}" linked successfully!`
          : "Custom domain removed. Workspace reverted to standard subdomain."
      );
      utils.superadmin.listTenants.invalidate();
      onRefresh?.();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update domain");
    },
  });

  const handleSaveDomain = async () => {
    const trimmed = domainInput.trim().toLowerCase();
    if (trimmed && !trimmed.includes(".")) {
      toast.error("Please enter a valid domain format (e.g. attendance.clientcompany.com)");
      return;
    }
    updateDomainMutation.mutate({
      tenantId: tenant.id,
      customDomain: trimmed || null,
    });
  };

  const handleRemoveDomain = async () => {
    updateDomainMutation.mutate({
      tenantId: tenant.id,
      customDomain: null,
    });
  };

  const defaultSubdomainUrl = `https://${tenant.slug}.${baseDomain}`;
  const customHostName = tenant.customDomain ? tenant.customDomain.split(".")[0] : "attendance";

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left">
      {/* 1. Subdomain Card */}
      <div className="bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#635BFF] dark:text-[#0BDBB9]" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Default Cloud Subdomain
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                Active & Live
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Wildcard cloud routing handles this subdomain out-of-the-box. No client DNS required.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(defaultSubdomainUrl);
                setCopiedSubdomain(true);
                setTimeout(() => setCopiedSubdomain(false), 2000);
                toast.success("Subdomain URL copied to clipboard!");
              }}
              className="h-8 px-2.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121B22] rounded-lg text-slate-700 dark:text-slate-300 hover:text-[#635BFF] hover:border-indigo-300 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedSubdomain ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSubdomain ? "Copied" : "Copy URL"}</span>
            </button>

            <a
              href={defaultSubdomainUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-3 text-xs font-semibold bg-[#635BFF] hover:bg-[#5248EE] text-white rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <span>Visit</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-white dark:bg-[#121B22] border border-slate-200/70 dark:border-slate-800 font-mono text-xs text-[#635BFF] dark:text-[#0BDBB9] font-medium break-all select-all">
          {defaultSubdomainUrl}
        </div>
      </div>

      {/* 2. Custom Domain Mapping Card */}
      <div className="bg-white dark:bg-[#0B131A]/60 border border-slate-200/90 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#635BFF]" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              White-Label Custom Domain
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Attach the client&apos;s corporate domain (e.g. <span className="font-mono text-slate-700 dark:text-slate-300">attendance.clientcompany.com</span>). All existing tenant data and biometric sync continue seamlessly.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-8">
            <FormInput
              label="Custom Domain Host"
              placeholder="e.g. attendance.clientcompany.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
            />
          </div>

          <div className="sm:col-span-4 flex items-center gap-2">
            <AppButton
              variant="primary"
              className="w-full h-[38px]"
              disabled={updateDomainMutation.isPending}
              onClick={handleSaveDomain}
            >
              {updateDomainMutation.isPending ? "Saving..." : tenant.customDomain ? "Update Domain" : "Link Domain"}
            </AppButton>

            {tenant.customDomain && (
              <button
                type="button"
                onClick={handleRemoveDomain}
                disabled={updateDomainMutation.isPending}
                title="Remove Custom Domain"
                className="h-[38px] px-3 text-xs font-semibold border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {tenant.customDomain && (
          <div className="flex items-center gap-2 pt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <Check className="w-4 h-4 shrink-0" />
            <span>Currently routing requests from <strong>{tenant.customDomain}</strong> to <strong>{tenant.companyName}</strong>.</span>
          </div>
        )}
      </div>

      {/* 3. DNS CNAME Configuration Box */}
      <div className="bg-gradient-to-br from-indigo-50/50 via-slate-50/50 to-white dark:from-[#121B22] dark:to-[#0B131A] border border-indigo-100 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#635BFF] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              DNS Configuration Instructions for Client IT
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Share these DNS records with the client&apos;s IT team or domain registrar (GoDaddy, Cloudflare, Namecheap, etc.):
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-lg bg-white dark:bg-[#0B131A] shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 font-semibold bg-slate-50/70 dark:bg-slate-800/40">
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Name / Host</th>
                <th className="py-2.5 px-3">Target / Points To</th>
                <th className="py-2.5 px-3">TTL</th>
                <th className="py-2.5 px-3 text-right">Quick Copy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              <tr>
                <td className="py-2.5 px-3 font-bold text-[#635BFF]">CNAME</td>
                <td className="py-2.5 px-3 text-slate-900 dark:text-slate-100">{customHostName}</td>
                <td className="py-2.5 px-3 text-slate-900 dark:text-slate-100">cname.vercel-dns.com</td>
                <td className="py-2.5 px-3 text-slate-500">Auto / 300</td>
                <td className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      const text = `Type: CNAME\nHost: ${customHostName}\nValue: cname.vercel-dns.com\nTTL: 300`;
                      navigator.clipboard.writeText(text);
                      toast.success("Complete DNS record copied!");
                    }}
                    className="px-2 py-1 text-[11px] font-sans font-semibold border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    Copy Record
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="text-[11.5px] text-slate-500 dark:text-slate-400 space-y-1">
          <p>• <strong>Automatic SSL:</strong> Vercel provisions a free, auto-renewing SSL certificate within 5–15 minutes of DNS propagation.</p>
          <p>• <strong>Supabase Auth:</strong> Add <span className="font-mono text-slate-700 dark:text-slate-300">https://{tenant.customDomain || `${tenant.slug}.${baseDomain}`}/{"**"}</span> into Supabase Auth Redirect URLs if using social logins.</p>
        </div>
      </div>
    </div>
  );
}
