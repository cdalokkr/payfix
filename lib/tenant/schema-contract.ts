import { sql } from 'drizzle-orm';

/**
 * Versioned contract for every schema that stores tenant business data.
 *
 * tenant_primary is the preferred structure source for a new tenant. The
 * public schema is only a compatibility fallback for business tables that
 * tenant_primary does not contain; it is never modified by provisioning.
 */
export const TENANT_SCHEMA_VERSION = '2026-08-30.1';
export const TENANT_SCHEMA_TEMPLATE = 'tenant_primary';

export const CANONICAL_TENANT_TABLES = [
    'designations',
    'profiles',
    'activities',
    'attendance',
    'leaves',
    'notifications',
    'user_status_history',
    'analytics_metrics',
    'office_settings',
    'office_closures',
    'employee_settings',
    'biometric_devices',
    'office_locations',
    'user_mpin',
    'push_subscriptions',
    'profile_photo_requests',
    'attendance_sessions',
    'biometric_raw_logs',
    'kiosk_devices',
    'employee_salary_setup',
    'employee_advances',
    'monthly_attendance_summary',
    'clients',
    'complaints',
    'tickets',
    'ticket_assignments',
    'ticket_resolutions',
    'call_logs',
    'salary_payments',
    'biometric_verification_attempts',
] as const;

export type CanonicalTenantTable = (typeof CANONICAL_TENANT_TABLES)[number];

/**
 * Column names are deliberately kept here as a reviewable contract rather
 * than inferred from whichever source schema happens to be available.
 */
export const CANONICAL_TENANT_COLUMNS: Record<CanonicalTenantTable, readonly string[]> = {
    designations: ['id', 'name', 'description', 'role', 'created_at', 'updated_at'],
    profiles: [
        'id', 'tenant_id', 'email', 'full_name', 'avatar_url', 'role',
        'designation_id', 'first_name', 'middle_name', 'last_name', 'mobile_no',
        'date_of_birth', 'sex', 'status', 'avatar_status', 'allowed_modules',
        'face_embedding', 'face_embedding_512', 'face_embedding_pipeline_version',
        'face_quality_score', 'face_enrolled_at', 'face_photo_url',
        'created_at', 'updated_at',
    ],
    activities: ['id', 'user_id', 'activity_type', 'module', 'description', 'metadata', 'created_at'],
    attendance: [
        'id', 'profile_id', 'date', 'check_in', 'check_out', 'first_check_in',
        'last_check_out', 'total_sessions', 'current_session_status', 'working_hours',
        'status', 'remarks', 'verified_by', 'is_extra_day', 'is_half_day', 'source',
        'device_id', 'location_id', 'selfie_url', 'checkin_latitude',
        'checkin_longitude', 'checkin_location_name', 'face_match_score',
        'created_at', 'updated_at',
    ],
    leaves: [
        'id', 'profile_id', 'leave_type', 'start_date', 'end_date', 'reason',
        'status', 'is_half_day', 'half_day_period', 'remarks', 'approved_by',
        'created_at', 'updated_at',
    ],
    notifications: ['id', 'user_id', 'title', 'message', 'is_read', 'type', 'link', 'created_at'],
    user_status_history: ['id', 'profile_id', 'old_status', 'new_status', 'reason', 'changed_by', 'created_at'],
    analytics_metrics: ['id', 'metric_date', 'metric_name', 'metric_value', 'metadata', 'created_at'],
    office_settings: [
        'id', 'default_check_in', 'default_check_out', 'off_days',
        'daily_working_hours', 'absent_deduction_multiplier', 'updated_at',
    ],
    office_closures: ['id', 'date', 'reason', 'type', 'created_at'],
    employee_settings: [
        'profile_id', 'custom_check_in', 'custom_check_out',
        'biometric_device_user_id', 'face_vector', 'updated_at',
    ],
    biometric_devices: [
        'id', 'name', 'serial_number', 'location', 'location_id', 'ip_address',
        'device_type', 'api_key', 'status', 'last_sync_time', 'created_at', 'updated_at',
    ],
    office_locations: [
        'id', 'name', 'address', 'latitude', 'longitude', 'radius_meters',
        'is_active', 'created_by', 'created_at', 'updated_at',
    ],
    user_mpin: [
        'profile_id', 'mpin_hash', 'biometric_enabled', 'biometric_credential_id',
        'failed_attempts', 'locked_until', 'created_at', 'updated_at',
    ],
    push_subscriptions: [
        'id', 'profile_id', 'endpoint', 'p256dh_key', 'auth_key',
        'user_agent', 'is_active', 'created_at',
    ],
    profile_photo_requests: [
        'id', 'profile_id', 'pending_photo_url', 'pending_photo_sha256',
        'pending_face_embedding_512', 'pending_face_embedding_pipeline_version',
        'pending_face_embedding', 'status', 'reviewed_by', 'reviewed_at',
        'rejection_reason', 'created_at',
    ],
    attendance_sessions: [
        'id', 'attendance_id', 'profile_id', 'date', 'session_number', 'check_in',
        'check_out', 'working_hours', 'source', 'device_id', 'location_id',
        'selfie_url', 'checkin_latitude', 'checkin_longitude', 'checkin_location_name',
        'checkout_latitude', 'checkout_longitude', 'checkout_location_name',
        'status', 'created_at', 'updated_at',
    ],
    biometric_raw_logs: [
        'id', 'profile_id', 'biometric_user_id', 'device_id', 'location_id',
        'punch_time', 'punch_type', 'raw_payload', 'created_at',
    ],
    kiosk_devices: [
        'id', 'name', 'pairing_code', 'terminal_id', 'credential_hash', 'credential_expires_at',
        'location_id', 'is_active',
        'last_seen_at', 'created_by', 'created_at', 'updated_at',
    ],
    employee_salary_setup: [
        'id', 'profile_id', 'basic_salary', 'hra', 'da', 'ta', 'special_allowance',
        'incentive', 'other_deductions', 'deduction_remark', 'effective_from_month',
        'effective_from_year', 'effective_to_month', 'effective_to_year',
        'change_reason', 'is_active', 'created_by', 'created_at', 'updated_at',
    ],
    employee_advances: [
        'id', 'profile_id', 'date', 'amount', 'particulars', 'status',
        'adjusted_in_month', 'adjusted_in_year', 'created_by', 'created_at',
    ],
    monthly_attendance_summary: [
        'id', 'profile_id', 'month', 'year', 'total_working_days',
        'total_present_days', 'total_absent_days', 'total_half_days', 'total_leaves',
        'total_working_hours', 'total_extra_hours', 'status', 'set_for_salary_by',
        'set_for_salary_at', 'gross_salary', 'absence_deduction', 'net_salary',
        'advance_recovery', 'take_home', 'paid_amount', 'salary_breakdown',
        'paid_mode', 'pay_date', 'pay_reference_no', 'payment_remarks', 'paid_by',
        'paid_at', 'created_at', 'updated_at',
    ],
    clients: [
        'id', 'company_name', 'contact_person', 'email', 'phone', 'alt_phone',
        'gst_number', 'pan_number', 'website', 'industry', 'address_line1',
        'address_line2', 'city', 'state', 'pincode', 'country', 'contacts',
        'notes', 'status', 'created_by', 'created_at', 'updated_at',
    ],
    complaints: [
        'id', 'complaint_number', 'client_id', 'subject', 'description', 'category',
        'priority', 'status', 'source', 'sla_hours', 'resolved_at', 'closed_at',
        'created_by', 'created_at', 'updated_at',
    ],
    tickets: [
        'id', 'ticket_number', 'complaint_id', 'title', 'description', 'priority',
        'status', 'due_date', 'estimated_hours', 'actual_hours', 'created_by',
        'created_at', 'updated_at',
    ],
    ticket_assignments: [
        'id', 'ticket_id', 'assigned_to', 'assigned_by', 'role', 'is_primary', 'assigned_at',
    ],
    ticket_resolutions: [
        'id', 'ticket_id', 'resolved_by', 'resolution_text', 'remarks',
        'hours_spent', 'status_after', 'created_at',
    ],
    call_logs: [
        'id', 'ticket_id', 'complaint_id', 'client_id', 'called_by', 'contact_name',
        'contact_phone', 'call_type', 'duration_minutes', 'notes', 'remarks',
        'status', 'next_follow_up', 'created_at',
    ],
    salary_payments: [
        'id', 'summary_id', 'amount', 'paid_mode', 'pay_date', 'pay_reference_no',
        'payment_remarks', 'paid_by', 'created_at', 'updated_at',
    ],
    biometric_verification_attempts: [
        'id', 'profile_id', 'source', 'outcome', 'similarity', 'threshold',
        'reason_code', 'face_count', 'frame_count', 'liveness_passed', 'quality_score',
        'quality_diagnostics', 'capture_pipeline_version', 'embedding_pipeline_version',
        'backend_engine', 'processing_ms', 'request_id', 'created_at',
    ],
};

export const TENANT_REQUIRED_INDEXES = [
    ['profiles', 'profiles_face_embedding_hnsw_idx'],
    ['attendance_sessions', 'attendance_sessions_attendance_id_idx'],
    ['attendance_sessions', 'attendance_sessions_profile_date_checkin_idx'],
    ['biometric_raw_logs', 'biometric_raw_logs_profile_id_idx'],
    ['kiosk_devices', 'kiosk_devices_created_by_idx'],
    ['kiosk_devices', 'kiosk_devices_location_id_idx'],
    ['office_locations', 'office_locations_created_by_idx'],
    ['profile_photo_requests', 'profile_photo_requests_profile_status_created_idx'],
    ['profile_photo_requests', 'profile_photo_requests_reviewed_by_idx'],
    ['biometric_verification_attempts', 'biometric_verification_attempts_profile_created_idx'],
    ['biometric_verification_attempts', 'biometric_verification_attempts_created_idx'],
    ['kiosk_devices', 'kiosk_devices_terminal_id_idx'],
] as const;

export const TENANT_REQUIRED_FOREIGN_KEYS = [
    ['profiles', 'designation_id', 'designations', 'id'],
    ['activities', 'user_id', 'profiles', 'id'],
    ['attendance', 'profile_id', 'profiles', 'id'],
    ['attendance', 'verified_by', 'profiles', 'id'],
    ['attendance', 'location_id', 'office_locations', 'id'],
    ['leaves', 'profile_id', 'profiles', 'id'],
    ['leaves', 'approved_by', 'profiles', 'id'],
    ['employee_settings', 'profile_id', 'profiles', 'id'],
    ['biometric_devices', 'location_id', 'office_locations', 'id'],
    ['office_locations', 'created_by', 'profiles', 'id'],
    ['kiosk_devices', 'location_id', 'office_locations', 'id'],
    ['kiosk_devices', 'created_by', 'profiles', 'id'],
    ['user_mpin', 'profile_id', 'profiles', 'id'],
    ['push_subscriptions', 'profile_id', 'profiles', 'id'],
    ['profile_photo_requests', 'profile_id', 'profiles', 'id'],
    ['profile_photo_requests', 'reviewed_by', 'profiles', 'id'],
    ['attendance_sessions', 'attendance_id', 'attendance', 'id'],
    ['attendance_sessions', 'profile_id', 'profiles', 'id'],
    ['attendance_sessions', 'location_id', 'office_locations', 'id'],
    ['biometric_raw_logs', 'profile_id', 'profiles', 'id'],
    ['biometric_raw_logs', 'location_id', 'office_locations', 'id'],
    ['biometric_verification_attempts', 'profile_id', 'profiles', 'id'],
    ['employee_salary_setup', 'profile_id', 'profiles', 'id'],
    ['employee_salary_setup', 'created_by', 'profiles', 'id'],
    ['employee_advances', 'profile_id', 'profiles', 'id'],
    ['employee_advances', 'created_by', 'profiles', 'id'],
    ['monthly_attendance_summary', 'profile_id', 'profiles', 'id'],
    ['monthly_attendance_summary', 'set_for_salary_by', 'profiles', 'id'],
    ['monthly_attendance_summary', 'paid_by', 'profiles', 'id'],
    ['clients', 'created_by', 'profiles', 'id'],
    ['complaints', 'client_id', 'clients', 'id'],
    ['complaints', 'created_by', 'profiles', 'id'],
    ['tickets', 'complaint_id', 'complaints', 'id'],
    ['tickets', 'created_by', 'profiles', 'id'],
    ['ticket_assignments', 'ticket_id', 'tickets', 'id'],
    ['ticket_assignments', 'assigned_to', 'profiles', 'id'],
    ['ticket_assignments', 'assigned_by', 'profiles', 'id'],
    ['ticket_resolutions', 'ticket_id', 'tickets', 'id'],
    ['ticket_resolutions', 'resolved_by', 'profiles', 'id'],
    ['call_logs', 'ticket_id', 'tickets', 'id'],
    ['call_logs', 'complaint_id', 'complaints', 'id'],
    ['call_logs', 'client_id', 'clients', 'id'],
    ['call_logs', 'called_by', 'profiles', 'id'],
    ['salary_payments', 'summary_id', 'monthly_attendance_summary', 'id'],
    ['salary_payments', 'paid_by', 'profiles', 'id'],
] as const;

export interface TenantSchemaContractReport {
    schemaName: string;
    version: string | null;
    missingTables: string[];
    missingColumns: Array<{ table: string; column: string }>;
    missingIndexes: Array<{ table: string; index: string }>;
    missingForeignKeys: Array<{ table: string; column: string; referencedTable: string; referencedColumn: string }>;
    invalidVectorColumns: Array<{ table: string; column: string; actualType: string | null; expectedType: string }>;
    ok: boolean;
}

export function tenantSchemaContractFailure(report: TenantSchemaContractReport): Error {
    const details = [
        report.missingTables.length > 0 ? `tables: ${report.missingTables.join(', ')}` : '',
        report.missingColumns.length > 0
            ? `columns: ${report.missingColumns.map(({ table, column }) => `${table}.${column}`).join(', ')}`
            : '',
        report.missingIndexes.length > 0
            ? `indexes: ${report.missingIndexes.map(({ table, index }) => `${table}.${index}`).join(', ')}`
            : '',
        report.missingForeignKeys.length > 0
            ? `foreign keys: ${report.missingForeignKeys.map(({ table, column }) => `${table}.${column}`).join(', ')}`
            : '',
        report.invalidVectorColumns.length > 0
            ? `vector types: ${report.invalidVectorColumns.map(({ table, column, actualType, expectedType }) => `${table}.${column}=${actualType ?? 'missing'} (expected ${expectedType})`).join(', ')}`
            : '',
    ].filter(Boolean);

    return new Error(`Tenant schema contract failed for ${report.schemaName}: ${details.join('; ')}`);
}

export function shouldRollbackTenantSchema(schemaCreatedByInvocation: boolean): boolean {
    return schemaCreatedByInvocation;
}

export function tenantSchemaNameFromSlug(slug: string): string {
    const safeSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    if (safeSlug.length < 3 || safeSlug.length > 30) {
        throw new Error('Tenant subdomain must be between 3 and 30 characters and alphanumeric.');
    }
    return `tenant_${safeSlug.replace(/-/g, '_')}`;
}

export function assertTenantSchemaName(schemaName: string): void {
    if (!/^tenant_[a-z0-9_]+$/.test(schemaName) || schemaName.length > 63) {
        throw new Error(`Invalid tenant schema name: ${schemaName}`);
    }
}

function hasForeignKey(
    rows: any[],
    table: string,
    column: string,
    referencedTable: string,
    referencedColumn: string,
): boolean {
    return rows.some((row) =>
        row.table_name === table &&
        row.column_name === column &&
        row.referenced_table === referencedTable &&
        row.referenced_column === referencedColumn
    );
}

/**
 * Read-only contract check used by provisioning and the audit script.
 */
export async function inspectTenantSchemaContract(
    database: any,
    schemaName: string,
): Promise<TenantSchemaContractReport> {
    assertTenantSchemaName(schemaName);

    const [tableRows, columnRows, indexRows, foreignKeyRows, versionRows, vectorRows] = await Promise.all([
        database.execute(sql`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = ${schemaName} AND table_type = 'BASE TABLE'
        `),
        database.execute(sql`
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = ${schemaName}
        `),
        database.execute(sql`
            SELECT tablename AS table_name, indexname AS index_name
            FROM pg_indexes
            WHERE schemaname = ${schemaName}
        `),
        database.execute(sql`
            SELECT
                child.relname AS table_name,
                child_attr.attname AS column_name,
                parent.relname AS referenced_table,
                parent_attr.attname AS referenced_column
            FROM pg_constraint constraint_row
            JOIN pg_class child ON child.oid = constraint_row.conrelid
            JOIN pg_namespace child_namespace ON child_namespace.oid = child.relnamespace
            JOIN pg_class parent ON parent.oid = constraint_row.confrelid
            JOIN pg_attribute child_attr
              ON child_attr.attrelid = child.oid
             AND child_attr.attnum = constraint_row.conkey[1]
            JOIN pg_attribute parent_attr
              ON parent_attr.attrelid = parent.oid
             AND parent_attr.attnum = constraint_row.confkey[1]
            WHERE constraint_row.contype = 'f'
              AND child_namespace.nspname = ${schemaName}
        `),
        database.execute(sql`
            SELECT value
            FROM ${sql.raw(schemaName)}._tenant_schema_metadata
            WHERE key = 'schema_version'
            LIMIT 1
        `).catch(() => []),
        database.execute(sql`
            SELECT
                table_name,
                column_name,
                format_type(attribute.atttypid, attribute.atttypmod) AS actual_type
            FROM information_schema.columns
            JOIN pg_class ON pg_class.relname = information_schema.columns.table_name
            JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
                              AND pg_namespace.nspname = information_schema.columns.table_schema
            JOIN pg_attribute attribute ON attribute.attrelid = pg_class.oid
                                       AND attribute.attname = information_schema.columns.column_name
            WHERE information_schema.columns.table_schema = ${schemaName}
              AND (
                (table_name = 'profiles' AND column_name IN ('face_embedding', 'face_embedding_512'))
                OR (table_name = 'profile_photo_requests' AND column_name IN ('pending_face_embedding', 'pending_face_embedding_512'))
              )
        `),
    ]);

    const tables = new Set(tableRows.map((row: any) => row.table_name));
    const columns = new Set(columnRows.map((row: any) => `${row.table_name}.${row.column_name}`));
    const indexes = new Set(indexRows.map((row: any) => `${row.table_name}.${row.index_name}`));

    const missingTables = CANONICAL_TENANT_TABLES.filter((table) => !tables.has(table));
    const missingColumns: Array<{ table: string; column: string }> = [];
    for (const table of CANONICAL_TENANT_TABLES) {
        for (const column of CANONICAL_TENANT_COLUMNS[table]) {
            if (!columns.has(`${table}.${column}`)) {
                missingColumns.push({ table, column });
            }
        }
    }

    const missingIndexes = TENANT_REQUIRED_INDEXES
        .filter(([table, index]) => !indexes.has(`${table}.${index}`))
        .map(([table, index]) => ({ table, index }));

    const missingForeignKeys = TENANT_REQUIRED_FOREIGN_KEYS
        .filter(([table, column, referencedTable, referencedColumn]) =>
            !hasForeignKey(foreignKeyRows, table, column, referencedTable, referencedColumn)
        )
        .map(([table, column, referencedTable, referencedColumn]) => ({
            table,
            column,
            referencedTable,
            referencedColumn,
        }));

    const expectedVectorTypes: Record<string, string> = {
        'profiles.face_embedding': 'vector(128)',
        'profiles.face_embedding_512': 'vector(512)',
        'profile_photo_requests.pending_face_embedding': 'vector(128)',
        'profile_photo_requests.pending_face_embedding_512': 'vector(512)',
    };
    const invalidVectorColumns: TenantSchemaContractReport['invalidVectorColumns'] = [];
    for (const row of vectorRows) {
        const expectedType = expectedVectorTypes[`${row.table_name}.${row.column_name}`];
        if (expectedType && row.actual_type !== expectedType) {
            invalidVectorColumns.push({
                table: row.table_name,
                column: row.column_name,
                actualType: row.actual_type,
                expectedType,
            });
        }
    }

    return {
        schemaName,
        version: versionRows[0]?.value ?? null,
        missingTables,
        missingColumns,
        missingIndexes,
        missingForeignKeys,
        invalidVectorColumns,
        ok:
            missingTables.length === 0 &&
            missingColumns.length === 0 &&
            missingIndexes.length === 0 &&
            missingForeignKeys.length === 0 &&
            invalidVectorColumns.length === 0,
    };
}
