import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveTrustedTenantFromRequest } from '@/lib/tenant/trusted-context';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hkbbybkeatrtdbqfurtc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYmJ5YmtlYXRydGRicWZ1cnRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODEzNDgyNCwiZXhwIjoyMDgzNzEwODI0fQ.lAA8KBHLLTVNdFFGFxS3ycJdcrkCE5LC-S9bDDOfcH4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function resolveTenantId(req: NextRequest): Promise<string> {
    try {
        const trusted = await resolveTrustedTenantFromRequest(req);
        if (trusted?.tenantId) return trusted.tenantId;
    } catch {
        // Fall through
    }

    const headerTenantId = req.headers.get('x-tenant-id');
    if (headerTenantId) return headerTenantId;

    const { data: primaryTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', 'primary')
        .maybeSingle();

    return primaryTenant?.id || 'c3e28d92-e3ea-4fe0-8efd-927ce550b666';
}

// 1. GET: Fetch all employees and moderators for current tenant with their biometric mapping & unmapped punches
export async function GET(req: NextRequest) {
    try {
        const tenantId = await resolveTenantId(req);

        // Fetch active profiles (employees, moderators, admins) for this tenant
        const { data: profiles, error: pErr } = await supabase
            .from('profiles')
            .select(`
                id,
                full_name,
                email,
                role,
                mobile_no,
                status,
                department_id,
                designation_id,
                departments (id, name),
                designations (id, name)
            `)
            .eq('tenant_id', tenantId)
            .neq('status', 'deleted')
            .order('role', { ascending: true })
            .order('full_name', { ascending: true });

        if (pErr) {
            return NextResponse.json({ error: pErr.message }, { status: 500 });
        }

        const profileIds = (profiles || []).map(p => p.id);

        // Fetch employee_settings for these profiles
        const { data: settings } = await supabase
            .from('employee_settings')
            .select('profile_id, biometric_device_user_id')
            .in('profile_id', profileIds.length > 0 ? profileIds : ['00000000-0000-0000-0000-000000000000']);

        const settingsMap = new Map<string, string>();
        const usedIds = new Set<string>();

        (settings || []).forEach(s => {
            if (s.biometric_device_user_id) {
                const val = String(s.biometric_device_user_id).trim();
                settingsMap.set(s.profile_id, val);
                usedIds.add(val);
            }
        });

        // Compute next recommended numeric ID (1, 2, 3...)
        let nextId = 1;
        while (usedIds.has(String(nextId))) {
            nextId++;
        }

        const users = (profiles || []).map(p => ({
            id: p.id,
            fullName: p.full_name || p.email || 'Unnamed User',
            email: p.email || '',
            role: p.role || 'employee',
            mobileNo: p.mobile_no || '',
            departmentName: (p.departments as any)?.name || null,
            designationTitle: (p.designations as any)?.name || null,
            biometricDeviceId: settingsMap.get(p.id) || null,
            isLinked: settingsMap.has(p.id)
        }));

        // Fetch recent unmapped punches from biometric_raw_logs (last 10 unmapped punches)
        const { data: unmappedLogs } = await supabase
            .from('biometric_raw_logs')
            .select('id, biometric_user_id, device_id, punch_time, punch_type')
            .is('profile_id', null)
            .order('punch_time', { ascending: false })
            .limit(10);

        return NextResponse.json({
            success: true,
            users,
            stats: {
                totalUsers: users.length,
                linkedCount: users.filter(u => u.isLinked).length,
                unlinkedCount: users.filter(u => !u.isLinked).length,
                nextRecommendedId: String(nextId)
            },
            unmappedPunches: (unmappedLogs || []).map(l => ({
                id: l.id,
                userId: l.biometric_user_id,
                deviceId: l.device_id,
                punchTime: l.punch_time,
                punchType: l.punch_type === 1 ? 'Out' : 'In'
            }))
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// 2. POST: Link / Update Biometric Device User ID for an individual user
export async function POST(req: NextRequest) {
    try {
        const tenantId = await resolveTenantId(req);
        const body = await req.json();
        const { profileId, biometricDeviceId } = body;

        if (!profileId) {
            return NextResponse.json({ error: 'Profile ID is required.' }, { status: 400 });
        }

        // Verify profile belongs to this tenant
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, email, tenant_id')
            .eq('id', profileId)
            .eq('tenant_id', tenantId)
            .maybeSingle();

        if (!profile) {
            return NextResponse.json({ error: 'User not found in current workspace.' }, { status: 404 });
        }

        const cleanId = biometricDeviceId ? String(biometricDeviceId).trim() : null;

        // If assigning an ID, ensure uniqueness across users of this tenant
        if (cleanId) {
            // Find all profiles in this tenant
            const { data: tenantProfiles } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('tenant_id', tenantId);

            const tenantPIds = (tenantProfiles || []).map(p => p.id);

            const { data: existingMapping } = await supabase
                .from('employee_settings')
                .select('profile_id, biometric_device_user_id')
                .eq('biometric_device_user_id', cleanId)
                .neq('profile_id', profileId)
                .in('profile_id', tenantPIds)
                .maybeSingle();

            if (existingMapping) {
                const conflictUser = tenantProfiles?.find(p => p.id === existingMapping.profile_id);
                return NextResponse.json({
                    error: `Biometric Machine ID "${cleanId}" is already assigned to "${conflictUser?.full_name || 'another user'}". Every user on the biometric machine must have a unique ID.`
                }, { status: 409 });
            }
        }

        // Upsert employee_settings record
        const { error: upsertErr } = await supabase
            .from('employee_settings')
            .upsert({
                profile_id: profileId,
                biometric_device_user_id: cleanId,
                updated_at: new Date().toISOString()
            }, { onConflict: 'profile_id' });

        if (upsertErr) {
            return NextResponse.json({ error: upsertErr.message }, { status: 500 });
        }

        // If this user was linked, retroactively link any unmapped raw logs matching this cleanId
        if (cleanId) {
            await supabase
                .from('biometric_raw_logs')
                .update({ profile_id: profileId })
                .eq('biometric_user_id', cleanId)
                .is('profile_id', null);
        }

        return NextResponse.json({
            success: true,
            message: cleanId ? `Linked Biometric ID "${cleanId}" to ${profile.full_name}` : `Unlinked Biometric ID for ${profile.full_name}`
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// 3. PUT: Auto-Assign Sequential Biometric IDs (1, 2, 3...) to all unlinked employees & moderators
export async function PUT(req: NextRequest) {
    try {
        const tenantId = await resolveTenantId(req);

        // Fetch all profiles for tenant
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .eq('tenant_id', tenantId)
            .neq('status', 'deleted')
            .order('role', { ascending: true })
            .order('full_name', { ascending: true });

        if (!profiles || profiles.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: 'No users found.' });
        }

        const profileIds = profiles.map(p => p.id);

        const { data: existingSettings } = await supabase
            .from('employee_settings')
            .select('profile_id, biometric_device_user_id')
            .in('profile_id', profileIds);

        const usedIds = new Set<number>();
        const mappedProfiles = new Set<string>();

        (existingSettings || []).forEach(s => {
            if (s.biometric_device_user_id) {
                mappedProfiles.add(s.profile_id);
                const num = parseInt(String(s.biometric_device_user_id).trim(), 10);
                if (!isNaN(num)) usedIds.add(num);
            }
        });

        const unmappedUsers = profiles.filter(p => !mappedProfiles.has(p.id));
        if (unmappedUsers.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: 'All users are already mapped with Biometric IDs!' });
        }

        let currentId = 1;
        const updates: Array<{ profile_id: string; biometric_device_user_id: string; updated_at: string }> = [];

        for (const user of unmappedUsers) {
            while (usedIds.has(currentId)) {
                currentId++;
            }
            updates.push({
                profile_id: user.id,
                biometric_device_user_id: String(currentId),
                updated_at: new Date().toISOString()
            });
            usedIds.add(currentId);
            currentId++;
        }

        // Upsert all updates in batches
        const { error: upsertErr } = await supabase
            .from('employee_settings')
            .upsert(updates, { onConflict: 'profile_id' });

        if (upsertErr) {
            return NextResponse.json({ error: upsertErr.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            count: updates.length,
            message: `Successfully auto-assigned Biometric IDs to ${updates.length} users!`
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
