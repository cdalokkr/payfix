import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveTrustedTenantFromRequest } from '@/lib/tenant/trusted-context';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hkbbybkeatrtdbqfurtc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYmJ5YmtlYXRydGRicWZ1cnRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODEzNDgyNCwiZXhwIjoyMDgzNzEwODI0fQ.lAA8KBHLLTVNdFFGFxS3ycJdcrkCE5LC-S9bDDOfcH4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ResolvedTenant {
    id: string;
    slug: string;
    company_name: string;
    biometric_api_key: string;
}

async function resolveCurrentTenant(req: NextRequest): Promise<ResolvedTenant> {
    try {
        const trusted = await resolveTrustedTenantFromRequest(req);
        if (trusted?.tenantId) {
            const { data: tenantRow } = await supabase
                .from('tenants')
                .select('id, slug, company_name, biometric_api_key')
                .eq('id', trusted.tenantId)
                .maybeSingle();

            if (tenantRow) {
                return {
                    id: tenantRow.id,
                    slug: tenantRow.slug,
                    company_name: tenantRow.company_name,
                    biometric_api_key: tenantRow.biometric_api_key || `bfx_${tenantRow.slug}_key`
                };
            }
        }
    } catch {
        // Fall through
    }

    // Check forwarded headers
    const headerTenantId = req.headers.get('x-tenant-id');
    if (headerTenantId) {
        const { data: tenant } = await supabase
            .from('tenants')
            .select('id, slug, company_name, biometric_api_key')
            .eq('id', headerTenantId)
            .maybeSingle();
        if (tenant) {
            return {
                id: tenant.id,
                slug: tenant.slug,
                company_name: tenant.company_name,
                biometric_api_key: tenant.biometric_api_key || `bfx_${tenant.slug}_key`
            };
        }
    }

    // Fallback to Primary Tenant
    const { data: primaryTenant } = await supabase
        .from('tenants')
        .select('id, slug, company_name, biometric_api_key')
        .eq('slug', 'primary')
        .maybeSingle();

    return {
        id: primaryTenant?.id || 'c3e28d92-e3ea-4fe0-8efd-927ce550b666',
        slug: primaryTenant?.slug || 'primary',
        company_name: primaryTenant?.company_name || 'PayFix Corporate',
        biometric_api_key: primaryTenant?.biometric_api_key || 'bfx_live_timewatch_primary_2026'
    };
}

export async function GET(req: NextRequest) {
    try {
        const tenant = await resolveCurrentTenant(req);

        const [{ data: devices, error: dErr }, { data: locations }] = await Promise.all([
            supabase
                .from('biometric_devices')
                .select('*, office_locations(id, name)')
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false }),
            supabase
                .from('office_locations')
                .select('id, name')
                .order('name', { ascending: true })
        ]);

        if (dErr) {
            return NextResponse.json({ error: dErr.message }, { status: 500 });
        }

        return NextResponse.json({
            devices: (devices || []).map(d => ({
                id: d.id,
                name: d.name,
                serialNumber: d.serial_number,
                ipAddress: d.ip_address || '192.168.1.101',
                deviceType: d.device_type,
                status: d.status,
                locationId: d.location_id || null,
                locationName: (d.office_locations as any)?.name || d.location || null,
                lastSyncTime: d.last_sync_time ? new Date(d.last_sync_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Connected',
                lastSyncDate: d.last_sync_time ? new Date(d.last_sync_time).toISOString() : null,
                apiKey: d.api_key
            })),
            locations: (locations || []).map(l => ({ id: l.id, name: l.name })),
            apiKey: tenant.biometric_api_key,
            tenantName: tenant.company_name
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const tenant = await resolveCurrentTenant(req);
        const body = await req.json();
        const { name, serialNumber, deviceType, ipAddress, locationId, locationName } = body;

        if (!name || !serialNumber) {
            return NextResponse.json({ error: 'Name and Serial Number are required' }, { status: 400 });
        }

        const trimmedSN = serialNumber.trim();

        // 1. Enforce Cross-Tenant Device Exclusivity: Check if Serial Number exists globally
        const { data: existingDevice } = await supabase
            .from('biometric_devices')
            .select('id, name, serial_number, tenant_id')
            .ilike('serial_number', trimmedSN)
            .maybeSingle();

        if (existingDevice) {
            if (existingDevice.tenant_id === tenant.id) {
                return NextResponse.json({
                    error: `Device with Serial Number "${trimmedSN}" is already registered in your workspace as "${existingDevice.name}".`
                }, { status: 409 });
            } else {
                return NextResponse.json({
                    error: `This biometric machine (SN: "${trimmedSN}") is already registered under another workspace. A physical biometric machine can only belong to one organization.`
                }, { status: 403 });
            }
        }

        const { data, error } = await supabase
            .from('biometric_devices')
            .insert({
                tenant_id: tenant.id,
                name: name.trim(),
                serial_number: trimmedSN,
                device_type: deviceType || 'timewatch',
                ip_address: (ipAddress || '192.168.1.101').trim(),
                location_id: locationId || null,
                location: locationName || null,
                status: 'active',
                api_key: tenant.biometric_api_key
            })
            .select('*, office_locations(id, name)')
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ error: `Device with serial number "${trimmedSN}" already exists.` }, { status: 409 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, device: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const tenant = await resolveCurrentTenant(req);
        const body = await req.json();
        const { id, name, serialNumber, deviceType, ipAddress, locationId, locationName, status } = body;

        if (!id) {
            return NextResponse.json({ error: 'Device ID is required for editing' }, { status: 400 });
        }
        if (!name || !serialNumber) {
            return NextResponse.json({ error: 'Name and Serial Number are required' }, { status: 400 });
        }

        const trimmedSN = serialNumber.trim();

        // 1. Verify target device belongs to current tenant
        const { data: targetDevice } = await supabase
            .from('biometric_devices')
            .select('id, tenant_id')
            .eq('id', id)
            .maybeSingle();

        if (!targetDevice || targetDevice.tenant_id !== tenant.id) {
            return NextResponse.json({ error: 'Device not found in current workspace.' }, { status: 404 });
        }

        // 2. Cross-tenant check for updated Serial Number
        const { data: otherWithSN } = await supabase
            .from('biometric_devices')
            .select('id, name, tenant_id')
            .ilike('serial_number', trimmedSN)
            .neq('id', id)
            .maybeSingle();

        if (otherWithSN) {
            if (otherWithSN.tenant_id === tenant.id) {
                return NextResponse.json({ error: `Serial Number "${trimmedSN}" is already registered to "${otherWithSN.name}".` }, { status: 409 });
            } else {
                return NextResponse.json({ error: `This biometric machine (SN: "${trimmedSN}") is already registered under another workspace.` }, { status: 403 });
            }
        }

        const updatePayload: Record<string, any> = {
            name: name.trim(),
            serial_number: trimmedSN,
            device_type: deviceType || 'timewatch',
            ip_address: (ipAddress || '192.168.1.101').trim(),
            location_id: locationId || null,
            location: locationName || null,
            updated_at: new Date().toISOString()
        };

        if (status) {
            updatePayload.status = status;
        }

        const { data, error } = await supabase
            .from('biometric_devices')
            .update(updatePayload)
            .eq('id', id)
            .eq('tenant_id', tenant.id)
            .select('*, office_locations(id, name)')
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ error: `Device with serial number "${trimmedSN}" already exists.` }, { status: 409 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, device: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const tenant = await resolveCurrentTenant(req);
        const { searchParams } = new URL(req.url);
        let id = searchParams.get('id');

        if (!id) {
            try {
                const body = await req.json();
                id = body.id;
            } catch {
                // Ignore json parse error if empty
            }
        }

        if (!id || typeof id !== 'string' || id.trim().length < 5) {
            return NextResponse.json({ error: 'Valid Device ID is required for deletion' }, { status: 400 });
        }

        // Verify device belongs to this tenant
        const { data: targetDevice } = await supabase
            .from('biometric_devices')
            .select('id, tenant_id')
            .eq('id', id)
            .maybeSingle();

        if (!targetDevice || targetDevice.tenant_id !== tenant.id) {
            return NextResponse.json({ error: 'Device not found in current workspace.' }, { status: 404 });
        }

        const { error } = await supabase
            .from('biometric_devices')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenant.id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Device deleted successfully' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
