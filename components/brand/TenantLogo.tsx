"use client"

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';

export type TenantLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';

interface TenantLogoProps {
  className?: string;
  size?: TenantLogoSize;
  width?: number;
  height?: number;
  showText?: boolean;
  textClassName?: string;
  logoUrl?: string | null;
  appName?: string | null;
  fallbackText?: string;
  fallbackLogoUrl?: string | null;
}

const SIZE_MAP: Record<Exclude<TenantLogoSize, 'custom'>, { box: string; icon: string; text: string; px: number }> = {
  xs: { box: 'h-6 w-6', icon: 'text-[11px]', text: 'text-xs', px: 24 },
  sm: { box: 'h-8 w-8', icon: 'text-xs', text: 'text-sm font-semibold', px: 32 },
  md: { box: 'h-9 w-9', icon: 'text-sm', text: 'text-base font-bold', px: 36 },
  lg: { box: 'h-12 w-12', icon: 'text-base', text: 'text-lg font-bold', px: 48 },
  xl: { box: 'h-16 w-16', icon: 'text-xl', text: 'text-xl font-extrabold', px: 64 },
};

/**
 * TenantLogo: Strictly for Tenant Workspaces (Admin, Moderator, Employee, Reports, Payslips)
 * Displays the tenant's private uploaded logo. If no logo is uploaded, displays
 * the tenant's initial letter in capital.
 */
export function TenantLogo({
  className,
  size = 'md',
  width,
  height,
  showText = false,
  textClassName,
  logoUrl: propLogoUrl,
  appName: propAppName,
  fallbackText,
  fallbackLogoUrl,
}: TenantLogoProps) {
  const [imgError, setImgError] = useState(false);

  // If props aren't provided directly, load branding query for the current tenant context
  const shouldFetch = propLogoUrl === undefined && propAppName === undefined;
  const { data: orgData } = trpc.organization.getBranding.useQuery(undefined, {
    enabled: shouldFetch,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const activeLogoUrl = (propLogoUrl !== undefined && propLogoUrl !== null)
    ? propLogoUrl
    : (orgData?.branding?.logoUrl || fallbackLogoUrl || null);

  const activeAppName = propAppName !== undefined 
    ? propAppName 
    : (orgData?.branding?.appName || orgData?.companyName || fallbackText || 'Workspace');

  const sizeSpec = size === 'custom' ? null : SIZE_MAP[size];

  // Fallback icon with tenant's first letter in Capital
  const renderFallbackIcon = () => {
    const initialLetter = (activeAppName || 'W').charAt(0).toUpperCase();
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white font-black shadow-md shadow-indigo-500/20 select-none shrink-0",
          size === 'custom' ? '' : sizeSpec?.box,
          className
        )}
        style={size === 'custom' ? { width: width || 36, height: height || 36 } : undefined}
      >
        <span className={cn("leading-none", sizeSpec?.icon || 'text-sm font-black')}>
          {initialLetter}
        </span>
      </div>
    );
  };

  const hasValidCustomLogo = Boolean(activeLogoUrl && !imgError);

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)} suppressHydrationWarning>
      {hasValidCustomLogo ? (
        <div
          className={cn(
            "relative flex items-center justify-center overflow-hidden rounded-xl bg-card border border-border/40 shadow-xs shrink-0",
            size === 'custom' ? '' : sizeSpec?.box
          )}
          style={size === 'custom' ? { width: width || 36, height: height || 36 } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeLogoUrl!}
            alt={activeAppName}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain p-0.5"
            loading="lazy"
          />
        </div>
      ) : (
        renderFallbackIcon()
      )}

      {showText && (
        <div className="flex flex-col min-w-0">
          <span className={cn("truncate tracking-tight text-foreground", sizeSpec?.text, textClassName)}>
            {activeAppName}
          </span>
        </div>
      )}
    </div>
  );
}

export default TenantLogo;
