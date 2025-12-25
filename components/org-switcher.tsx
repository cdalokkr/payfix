import * as React from 'react';
import { Building } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';

interface Tenant {
  id: string;
  name: string;
}

interface OrgSwitcherProps {
  tenants: Tenant[];
  defaultTenant: Tenant;
  onTenantSwitch: (tenantId: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function OrgSwitcher({ tenants: _tenants, defaultTenant, onTenantSwitch: _onTenantSwitch }: OrgSwitcherProps) {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <div className="flex items-center gap-2">
      <Building className="h-4 w-4" />
      {!isCollapsed && <span className="text-sm font-medium">{defaultTenant.name}</span>}
    </div>
  );
}