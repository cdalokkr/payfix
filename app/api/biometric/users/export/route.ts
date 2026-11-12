import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { resolveTrustedTenantFromRequest } from '@/lib/tenant/trusted-context';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hkbbybkeatrtdbqfurtc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYmJ5YmtlYXRydGRicWZ1cnRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODEzNDgyNCwiZXhwIjoyMDgzNzEwODI0fQ.lAA8KBHLLTVNdFFGFxS3ycJdcrkCE5LC-S9bDDOfcH4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function resolveTenant(req: NextRequest) {
    try {
        const trusted = await resolveTrustedTenantFromRequest(req);
        if (trusted?.tenantId) {
            const { data } = await supabase
                .from('tenants')
                .select('id, slug, company_name')
                .eq('id', trusted.tenantId)
                .maybeSingle();
            if (data) return data;
        }
    } catch {
        // Fall through
    }

    const headerTenantId = req.headers.get('x-tenant-id');
    if (headerTenantId) {
        const { data } = await supabase
            .from('tenants')
            .select('id, slug, company_name')
            .eq('id', headerTenantId)
            .maybeSingle();
        if (data) return data;
    }

    const { data: primaryTenant } = await supabase
        .from('tenants')
        .select('id, slug, company_name')
        .eq('slug', 'primary')
        .maybeSingle();

    return primaryTenant || {
        id: 'c3e28d92-e3ea-4fe0-8efd-927ce550b666',
        slug: 'primary',
        company_name: 'PayFix Corporate'
    };
}

export async function GET(req: NextRequest) {
    try {
        const tenant = await resolveTenant(req);

        // Fetch all active profiles for this tenant
        const { data: profiles, error: pErr } = await supabase
            .from('profiles')
            .select(`
                id,
                full_name,
                first_name,
                last_name,
                email,
                role,
                mobile_no,
                sex,
                status,
                created_at,
                departments (id, name),
                designations (id, name)
            `)
            .eq('tenant_id', tenant.id)
            .neq('status', 'deleted')
            .order('role', { ascending: true })
            .order('full_name', { ascending: true });

        if (pErr) {
            return NextResponse.json({ error: pErr.message }, { status: 500 });
        }

        const profileIds = (profiles || []).map(p => p.id);

        // Optional query filters: target specific user(s) or new arrivals only
        const targetUserId = req.nextUrl.searchParams.get('userId');
        const targetUserIdsParam = req.nextUrl.searchParams.get('userIds');
        const newOnly = req.nextUrl.searchParams.get('newOnly') === 'true';

        let targetProfiles = profiles || [];
        if (targetUserId) {
            targetProfiles = targetProfiles.filter(p => p.id === targetUserId);
        } else if (targetUserIdsParam) {
            const idList = targetUserIdsParam.split(',').map(s => s.trim());
            targetProfiles = targetProfiles.filter(p => idList.includes(p.id));
        } else if (newOnly) {
            const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            targetProfiles = targetProfiles.filter(p => p.created_at && new Date(p.created_at) >= cutoffDate);
        }

        // Fetch employee_settings for biometric user ids
        const { data: settings } = await supabase
            .from('employee_settings')
            .select('profile_id, biometric_device_user_id')
            .in('profile_id', profileIds.length > 0 ? profileIds : ['00000000-0000-0000-0000-000000000000']);

        const settingsMap = new Map<string, string>();
        (settings || []).forEach(s => {
            if (s.biometric_device_user_id) {
                settingsMap.set(s.profile_id, String(s.biometric_device_user_id).trim());
            }
        });

        // Create Excel Workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'PayFix Biometric System';
        workbook.created = new Date();

        // -------------------------------------------------------------
        // SHEET 1: Machine_Upload_Format (Universal USB & Terminal Import)
        // -------------------------------------------------------------
        const sheet1 = workbook.addWorksheet('Machine_Upload_Format');

        sheet1.columns = [
            { header: 'User ID', key: 'userId', width: 14 },
            { header: 'Name', key: 'name', width: 28 },
            { header: 'Privilege', key: 'privilege', width: 16 },
            { header: 'Department', key: 'department', width: 22 },
            { header: 'Card Number', key: 'cardNo', width: 18 },
            { header: 'Password', key: 'password', width: 14 },
            { header: 'Group', key: 'group', width: 12 },
        ];

        // Style Header Row
        const headerRow1 = sheet1.getRow(1);
        headerRow1.height = 26;
        headerRow1.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF059669' } // Emerald 600
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'medium', color: { argb: 'FF047857' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });

        // -------------------------------------------------------------
        // SHEET 2: TimeWatch_iAS_Format (Matching native Employee_Upload_New.xls)
        // -------------------------------------------------------------
        const sheet2 = workbook.addWorksheet('TimeWatch_iAS_Format');

        sheet2.columns = [
            { header: 'User No#', key: 'userNo', width: 14 },
            { header: 'Name Employee ', key: 'empName', width: 28 },
            { header: 'Department', key: 'department', width: 22 },
            { header: 'Designation', key: 'designation', width: 22 },
            { header: 'Location', key: 'location', width: 22 },
            { header: 'Sex', key: 'sex', width: 12 },
            { header: 'Mobile', key: 'mobile', width: 18 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Date Of Join', key: 'doj', width: 16 }
        ];

        const headerRow2 = sheet2.getRow(1);
        headerRow2.height = 26;
        headerRow2.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E293B' } // Slate 800
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });

        // Populate Rows
        let fallbackIdCounter = 1;

        (targetProfiles || []).forEach(p => {
            let bioId = settingsMap.get(p.id);
            if (!bioId) {
                // Assign a temporary sequential ID in the export if unassigned
                bioId = String(fallbackIdCounter);
            }
            fallbackIdCounter++;

            const rawName = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
            // Clean name for machine screen display (remove non-ascii, limit to 24 chars)
            const sanitizedName = rawName.replace(/[^\x20-\x7E]/g, '').trim().slice(0, 24);

            const isManager = p.role === 'admin' || p.role === 'moderator';
            const deptName = (p.departments as any)?.name || 'General';
            const desigTitle = (p.designations as any)?.name || p.role.toUpperCase();
            const joinDate = p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : '';

            // Add to Sheet 1 (Machine Upload Format)
            const row1 = sheet1.addRow({
                userId: bioId,
                name: sanitizedName,
                privilege: isManager ? 'Manager' : 'User',
                department: deptName,
                cardNo: '',
                password: '',
                group: '1'
            });

            row1.eachCell(cell => {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
                cell.font = { size: 10 };
            });

            // Add to Sheet 2 (TimeWatch iAS Format)
            const row2 = sheet2.addRow({
                userNo: bioId,
                empName: sanitizedName,
                department: deptName,
                designation: desigTitle,
                location: tenant.company_name,
                sex: p.sex ? p.sex.toUpperCase() : 'MALE',
                mobile: p.mobile_no || '',
                email: p.email || '',
                doj: joinDate
            });

            row2.eachCell(cell => {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
                cell.font = { size: 10 };
            });
        });

        // Write buffer and stream as Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `Biometric_Machine_Users_${tenant.slug}_${dateStr}.xlsx`;

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store, max-age=0'
            }
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
