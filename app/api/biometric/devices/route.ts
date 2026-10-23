import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hkbbybkeatrtdbqfurtc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYmJ5YmtlYXRydGRicWZ1cnRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODEzNDgyNCwiZXhwIjoyMDgzNzEwODI0fQ.lAA8KBHLLTVNdFFGFxS3ycJdcrkCE5LC-S9bDDOfcH4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function GET(req: NextRequest) {
    try {
        const { data: devices, error: dErr } = await supabase
            .from('biometric_devices')
            .select('*')
            .order('created_at', { ascending: false });

        if (dErr) {
            return NextResponse.json({ error: dErr.message }, { status: 500 });
        }

        const { data: tenant } = await supabase
            .from('tenants')
            .select('company_name, slug, biometric_api_key')
            .eq('slug', 'primary')
            .maybeSingle();

        return NextResponse.json({
            devices: (devices || []).map(d => ({
                id: d.id,
                name: d.name,
                serialNumber: d.serial_number,
                ipAddress: d.ip_address || '192.168.1.101',
                deviceType: d.device_type,
                status: d.status,
                lastSyncTime: d.last_sync_time ? new Date(d.last_sync_time).toLocaleTimeString('en-IN') : 'Connected',
                apiKey: d.api_key
            })),
            apiKey: tenant?.biometric_api_key || 'bfx_live_timewatch_primary_2026',
            tenantName: tenant?.company_name || 'PayFix Corporate'
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, serialNumber, deviceType, ipAddress } = body;

        if (!name || !serialNumber) {
            return NextResponse.json({ error: 'Name and Serial Number are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('biometric_devices')
            .insert({
                name,
                serial_number: serialNumber,
                device_type: deviceType || 'timewatch',
                ip_address: ipAddress || '192.168.1.101',
                status: 'active',
                api_key: 'bfx_live_timewatch_primary_2026'
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, device: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
