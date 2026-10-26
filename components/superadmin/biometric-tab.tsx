"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { 
  Fingerprint, Copy, Check, RefreshCw, Key, ShieldCheck, 
  Cpu, HardDrive, AlertCircle, Eye, EyeOff, Radio, ExternalLink, Tablet
} from "lucide-react";
import { toast } from "sonner";
import { AppButton } from "@/components/ui/button-system";
import ModalDialog from "@/components/ui/modal-dialog";

interface BiometricTabProps {
  tenant: {
    id: string;
    slug: string;
    companyName: string;
    customDomain: string | null;
    biometricApiKey?: string | null;
  };
  baseDomain: string;
  onRefresh?: () => void;
}

export function BiometricTab({ tenant, baseDomain, onRefresh }: BiometricTabProps) {
  const utils = trpc.useUtils();
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedKiosk, setCopiedKiosk] = useState(false);
  const [isRegenModalOpen, setIsRegenModalOpen] = useState(false);

  // Fetch live biometric configuration & devices from the tenant's schema
  const { data: configData, isLoading: isLoadingConfig, refetch } = 
    trpc.superadmin.getTenantBiometricConfig.useQuery(
      { tenantId: tenant.id },
      { enabled: !!tenant.id }
    );

  const activeKey = configData?.biometricApiKey || tenant.biometricApiKey || "bfx_live_pending_generation";
  const targetDomain = tenant.customDomain || `${tenant.slug}.${baseDomain}`;

  const regenerateKeyMutation = trpc.superadmin.regenerateBiometricKey.useMutation({
    onSuccess: (data) => {
      toast.success("New biometric API key generated!");
      utils.superadmin.listTenants.invalidate();
      refetch();
      setIsRegenModalOpen(false);
      onRefresh?.();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to regenerate API key");
    },
  });

  const agentEnvSnippet = `# PayFix Biometric Agent Config (${tenant.companyName})
CLOUD_API_URL=https://${targetDomain}/api/biometric/sync
BIOMETRIC_API_KEY=${activeKey}
DEVICE_ID=MAIN-ENTRANCE-GATE`;

  const kioskUrl = `https://${targetDomain}/kiosk`;

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left">
      {/* 1. Tenant Biometric API Key Card */}
      <div className="bg-white dark:bg-[#0B131A]/60 border border-slate-200/90 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[#635BFF]" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Workspace Biometric API Key
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Unique security bearer token that authorizes physical eSSL / Timewatch machines to write to this tenant schema.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(activeKey);
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2000);
                toast.success("API key copied to clipboard!");
              }}
              className="h-8 px-2.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121B22] rounded-lg text-slate-700 dark:text-slate-300 hover:text-[#635BFF] hover:border-indigo-300 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey ? "Copied" : "Copy Key"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRegenModalOpen(true)}
              className="h-8 px-2.5 text-xs font-semibold border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Regenerate</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-[#121B22] border border-slate-200/80 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200">
          <span className="flex-1 truncate">
            {showKey ? activeKey : activeKey.substring(0, 14) + "••••••••••••••••••••••••"}
          </span>
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
            title={showKey ? "Hide Key" : "Show Key"}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Integration Modes: ADMS Cloud vs Local Sync Agent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Method A: Direct Cloud ADMS (eSSL / ZKTeco) */}
        <div className="bg-white dark:bg-[#0B131A]/60 border border-slate-200/90 dark:border-slate-800/80 rounded-xl p-4.5 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Radio className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Method A: Direct Cloud ADMS Push
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              For modern eSSL / ZKTeco machines with Wi-Fi / 4G SIM. <strong>No PC required</strong> — punches stream straight to cloud.
            </p>

            <div className="space-y-1.5 text-xs font-mono bg-slate-50 dark:bg-[#121B22] p-3 rounded-lg border border-slate-200/70 dark:border-slate-800">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500 font-sans">Cloud / ADMS:</span>
                <span className="text-emerald-600 font-bold">Enabled</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500 font-sans">Server Domain:</span>
                <span className="text-slate-900 dark:text-slate-100">{targetDomain}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500 font-sans">Server Port:</span>
                <span className="text-slate-900 dark:text-slate-100">443 (HTTPS)</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500 font-sans">Push URL Path:</span>
                <span className="text-[#635BFF] font-bold">/api/biometric/iclock</span>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-400">
            Punches are ingested, verified against office shifts, and logged in &lt; 2 seconds.
          </div>
        </div>

        {/* Method B: LAN Socket & Timewatch PC Agent */}
        <div className="bg-white dark:bg-[#0B131A]/60 border border-slate-200/90 dark:border-slate-800/80 rounded-xl p-4.5 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#635BFF]" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Method B: Local LAN / Timewatch Agent
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(agentEnvSnippet);
                  setCopiedEnv(true);
                  setTimeout(() => setCopiedEnv(false), 2000);
                  toast.success("Agent .env configuration copied!");
                }}
                className="text-[11px] font-semibold text-[#635BFF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedEnv ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedEnv ? "Copied" : "Copy .env"}</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              For older LAN machines without cloud firmware. Paste into <span className="font-mono text-slate-700 dark:text-slate-300">sync-agent/.env</span> on an office PC.
            </p>

            <pre className="text-[11px] font-mono bg-slate-900 text-slate-200 p-2.5 rounded-lg overflow-x-auto leading-relaxed">
              {agentEnvSnippet}
            </pre>
          </div>

          <div className="pt-2 text-[11px] text-slate-400">
            Supports Port 4370 socket listeners, Timewatch bridge, and eTimeTrackLite MS SQL sync.
          </div>
        </div>
      </div>

      {/* 3. Entrance Tablet Kiosk Mode Card */}
      <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-transparent border border-purple-200/60 dark:border-purple-900/40 rounded-xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Tablet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Express Tablet Kiosk (Entrance Terminal)
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
            Turn any budget iPad or Android tablet into a high-speed, touchless facial recognition punch terminal. Caches employee face embeddings locally and works 100% offline.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(kioskUrl);
              setCopiedKiosk(true);
              setTimeout(() => setCopiedKiosk(false), 2000);
              toast.success("Kiosk URL copied!");
            }}
            className="h-8 px-2.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121B22] rounded-lg text-slate-700 dark:text-slate-300 hover:text-purple-600 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            {copiedKiosk ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKiosk ? "Copied" : "Copy URL"}</span>
          </button>

          <a
            href={kioskUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span>Launch Kiosk</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 4. Live Connected Biometric Machines Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#635BFF]" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Connected Biometric Devices ({configData?.devices?.length || 0})
            </h4>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs font-semibold text-[#635BFF] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh Devices</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-[#121B22] shadow-2xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-semibold bg-slate-50/70 dark:bg-slate-800/40">
                <th className="py-2.5 px-3">Device Name</th>
                <th className="py-2.5 px-3">Serial Number</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">IP Address</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Last Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {configData?.devices && configData.devices.length > 0 ? (
                configData.devices.map((device: any) => (
                  <tr key={device.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{device.name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">{device.serialNumber || "—"}</td>
                    <td className="py-2.5 px-3 uppercase text-[10.5px] font-bold text-slate-500">{device.deviceType}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{device.ipAddress || "Cloud"}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                        {device.status || "Active"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500">
                      {device.lastSyncTime ? new Date(device.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Never"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No physical biometric machines connected yet. When the client points their eSSL machine or starts sync-agent, the machine will register here automatically.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for API Key Regeneration */}
      <ModalDialog
        open={isRegenModalOpen}
        onOpenChange={setIsRegenModalOpen}
        title="Regenerate Biometric API Key"
        icon={<AlertCircle className="w-5 h-5 text-amber-600" />}
        showSaveButton={false}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <AppButton variant="secondary" onClick={() => setIsRegenModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="destructive"
              disabled={regenerateKeyMutation.isPending}
              onClick={() => regenerateKeyMutation.mutate({ tenantId: tenant.id })}
            >
              {regenerateKeyMutation.isPending ? "Regenerating..." : "Yes, Regenerate Key"}
            </AppButton>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
          <p>
            Are you sure you want to regenerate the biometric API key for <strong>{tenant.companyName}</strong>?
          </p>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-lg text-amber-800 dark:text-amber-300">
            <strong>Warning:</strong> Existing eSSL machines and running sync agents will immediately stop syncing until updated with the new key.
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
