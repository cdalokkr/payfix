import { pgTable, uuid, text, timestamp, varchar, date, numeric, integer, boolean, pgEnum, jsonb, customType } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// pgvector is returned by postgres.js as "[n,n,...]". Keep vectors as numeric
// arrays in application code while sending a valid pgvector literal to Postgres.
const vector128 = customType<{ data: number[]; driverData: string }>({
    dataType() {
        return 'vector(128)';
    },
    toDriver(value) {
        if (!Array.isArray(value) || value.length !== 128 || value.some((item) => !Number.isFinite(item))) {
            throw new Error('Expected a finite 128-dimensional face embedding');
        }
        return `[${value.join(',')}]`;
    },
    fromDriver(value) {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed) || parsed.length !== 128 || parsed.some((item) => typeof item !== 'number')) {
            throw new Error('Database returned an invalid 128-dimensional face embedding');
        }
        return parsed;
    },
});

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'moderator', 'employee']);
export const activityTypeEnum = pgEnum('activity_type', ['login', 'logout', 'profile_update', 'data_view', 'data_edit', 'data_delete', 'data_create', 'password_change']);

export const attendanceSourceEnum = pgEnum('attendance_source', ['mobile', 'biometric', 'manual', 'bulk']);

// Complaint & Ticket Enums
export const ticketStatusEnum = pgEnum('ticket_status', ['open', 'in_progress', 'resolved', 'closed', 'cancelled']);
export const ticketPriorityEnum = pgEnum('ticket_priority', ['low', 'medium', 'high', 'critical']);
export const callLogStatusEnum = pgEnum('call_log_status', ['done', 'pending', 'cancelled']);
export const complaintCategoryEnum = pgEnum('complaint_category', ['billing', 'technical', 'service', 'product', 'general']);

// Designations
export const designations = pgTable('designations', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    description: text('description'),
    role: text('role').notNull().default('employee'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Profiles
export const profiles = pgTable('profiles', {
    id: uuid('id').primaryKey(),
    email: text('email').notNull().unique(),
    full_name: text('full_name'),
    avatar_url: text('avatar_url'),
    role: userRoleEnum('role').default('employee'),
    designation_id: uuid('designation_id').references(() => designations.id, { onDelete: 'set null' }),
    first_name: varchar('first_name', { length: 255 }),
    middle_name: text('middle_name'),
    last_name: varchar('last_name', { length: 255 }),
    mobile_no: varchar('mobile_no', { length: 20 }),
    date_of_birth: date('date_of_birth'),
    sex: text('sex'),
    status: text('status').default('active'),
    avatar_status: text('avatar_status').default('default'), // 'default' or 'custom'
    allowed_modules: text('allowed_modules').array(),
    face_embedding: vector128('face_embedding'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Activities
export const activities = pgTable('activities', {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
    activity_type: activityTypeEnum('activity_type').notNull(),
    module: text('module'),
    description: text('description'),
    metadata: jsonb('metadata'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Attendance
export const attendance = pgTable('attendance', {
    id: uuid('id').primaryKey().defaultRandom(),
    profile_id: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    date: date('date').notNull().defaultNow(),
    check_in: timestamp('check_in', { withTimezone: true }),
    check_out: timestamp('check_out', { withTimezone: true }),
    working_hours: numeric('working_hours'),
    status: text('status').notNull().default('pending'),
    remarks: text('remarks'),
    verified_by: uuid('verified_by').references(() => profiles.id, { onDelete: 'set null' }),
    is_extra_day: boolean('is_extra_day').default(false),
    is_half_day: boolean('is_half_day').default(false),
    source: attendanceSourceEnum('source').default('mobile'),
    device_id: text('device_id'),
    // Mobile attendance fields
    selfie_url: text('selfie_url'),
    checkin_latitude: numeric('checkin_latitude', { precision: 10, scale: 7 }),
    checkin_longitude: numeric('checkin_longitude', { precision: 10, scale: 7 }),
    checkin_location_name: text('checkin_location_name'),
    face_match_score: numeric('face_match_score', { precision: 5, scale: 4 }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Leaves
export const leaves = pgTable('leaves', {
    id: uuid('id').primaryKey().defaultRandom(),
    profile_id: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    leave_type: text('leave_type'),
    start_date: date('start_date').notNull(),
    end_date: date('end_date').notNull(),
    reason: text('reason'),
    status: text('status').notNull().default('pending'),
    is_half_day: boolean('is_half_day').default(false),
    half_day_period: text('half_day_period'), // 'morning' or 'afternoon'
    remarks: text('remarks'),
    approved_by: uuid('approved_by').references(() => profiles.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Notifications
export const notifications = pgTable('notifications', {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id'), // This seems to refer to auth.uid in some routers, but let's check
    title: text('title').notNull(),
    message: text('message').notNull(),
    is_read: boolean('is_read').default(false),
    type: text('type'),
    link: text('link'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// User Status History
export const userStatusHistory = pgTable('user_status_history', {
    id: uuid('id').primaryKey().defaultRandom(),
    profile_id: uuid('profile_id').references(() => profiles.id, { onDelete: 'cascade' }),
    old_status: text('old_status'),
    new_status: text('new_status'),
    reason: text('reason'),
    changed_by: uuid('changed_by').references(() => profiles.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Analytics Metrics
export const analyticsMetrics = pgTable('analytics_metrics', {
    id: uuid('id').primaryKey().defaultRandom(),
    metric_date: date('metric_date').notNull(),
    metric_name: text('metric_name').notNull(),
    metric_value: numeric('metric_value').notNull(),
    metadata: jsonb('metadata'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Office Settings
export const officeSettings = pgTable('office_settings', {
    id: uuid('id').primaryKey().defaultRandom(),
    default_check_in: text('default_check_in').notNull().default('10:00:00'),
    default_check_out: text('default_check_out').notNull().default('19:00:00'),
    off_days: integer('off_days').array().default([0]),
    daily_working_hours: jsonb('daily_working_hours').default({}),
    absent_deduction_multiplier: integer('absent_deduction_multiplier').notNull().default(1),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Office Closures
export const officeClosures = pgTable('office_closures', {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date').notNull().unique(),
    reason: text('reason').notNull(),
    type: text('type').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Employee Settings
export const employeeSettings = pgTable('employee_settings', {
    profile_id: uuid('profile_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
    custom_check_in: text('custom_check_in'),
    custom_check_out: text('custom_check_out'),
    biometric_device_user_id: text('biometric_device_user_id'),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Biometric Devices
export const biometricDevices = pgTable('biometric_devices', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    serial_number: varchar('serial_number', { length: 100 }).unique(),
    location: text('location'),
    ip_address: varchar('ip_address', { length: 45 }),
    status: text('status').default('active'),
    last_sync_time: timestamp('last_sync_time', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Office Locations (for geofencing)
export const officeLocations = pgTable('office_locations', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    address: text('address'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
    longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
    radius_meters: integer('radius_meters').notNull().default(200),
    is_active: boolean('is_active').default(true),
    created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// User MPIN (6-digit mobile PIN)
export const userMpin = pgTable('user_mpin', {
    profile_id: uuid('profile_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
    mpin_hash: text('mpin_hash').notNull(),
    biometric_enabled: boolean('biometric_enabled').default(false),
    biometric_credential_id: text('biometric_credential_id'),
    failed_attempts: integer('failed_attempts').default(0),
    locked_until: timestamp('locked_until', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Push Subscriptions (for web push notifications)
export const pushSubscriptions = pgTable('push_subscriptions', {
    id: uuid('id').primaryKey().defaultRandom(),
    profile_id: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh_key: text('p256dh_key').notNull(),
    auth_key: text('auth_key').notNull(),
    user_agent: text('user_agent'),
    is_active: boolean('is_active').default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Profile Photo Requests (for approval workflow)
export const profilePhotoRequests = pgTable('profile_photo_requests', {
    id: uuid('id').primaryKey().defaultRandom(),
    profile_id: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    pending_photo_url: text('pending_photo_url').notNull(),
    // This is verified at upload time and is promoted atomically with the
    // approved portrait. Pending templates must never be used for attendance.
    pending_face_embedding: vector128('pending_face_embedding'),
    status: text('status').notNull().default('pending'), // 'pending', 'approved', 'rejected'
    reviewed_by: uuid('reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
    reviewed_at: timestamp('reviewed_at', { withTimezone: true }),
    rejection_reason: text('rejection_reason'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// One-time evidence that the server compared a live attendance selfie with an
// approved template. A browser cannot mark attendance without consuming one.
export const biometricVerificationTokens = pgTable('biometric_verification_tokens', {
    id: uuid('id').primaryKey().defaultRandom(),
    profile_id: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    action: text('action').notNull(), // 'clock_in' | 'clock_out'
    token_hash: text('token_hash').notNull().unique(),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    used_at: timestamp('used_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Employee Salary Setup (versioned salary components)
export const employeeSalarySetup = pgTable('employee_salary_setup', {
    id: uuid('id').primaryKey().defaultRandom(),
    profile_id: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    basic_salary: numeric('basic_salary', { precision: 12, scale: 2 }).notNull().default('0'),
    hra: numeric('hra', { precision: 12, scale: 2 }).notNull().default('0'),
    da: numeric('da', { precision: 12, scale: 2 }).notNull().default('0'),
    ta: numeric('ta', { precision: 12, scale: 2 }).notNull().default('0'),
    special_allowance: numeric('special_allowance', { precision: 12, scale: 2 }).notNull().default('0'),
    incentive: numeric('incentive', { precision: 12, scale: 2 }).notNull().default('0'),
    other_deductions: numeric('other_deductions', { precision: 12, scale: 2 }).notNull().default('0'),
    deduction_remark: text('deduction_remark'),
    effective_from_month: integer('effective_from_month').notNull(),
    effective_from_year: integer('effective_from_year').notNull(),
    effective_to_month: integer('effective_to_month'),
    effective_to_year: integer('effective_to_year'),
    change_reason: text('change_reason'),
    is_active: boolean('is_active').default(true),
    created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Employee Advances / Loans (day-by-day tracking)
export const employeeAdvances = pgTable('employee_advances', {
    id: uuid('id').primaryKey().defaultRandom(),
    profile_id: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    particulars: text('particulars').notNull(),
    status: text('status').notNull().default('pending'), // 'pending' | 'adjusted'
    adjusted_in_month: integer('adjusted_in_month'),
    adjusted_in_year: integer('adjusted_in_year'),
    created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Monthly Attendance Summary (compiled attendance + payslip)
export const monthlyAttendanceSummary = pgTable('monthly_attendance_summary', {
    id: uuid('id').primaryKey().defaultRandom(),
    profile_id: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    total_working_days: integer('total_working_days').notNull().default(0),
    total_present_days: integer('total_present_days').notNull().default(0),
    total_absent_days: integer('total_absent_days').notNull().default(0),
    total_half_days: integer('total_half_days').notNull().default(0),
    total_leaves: integer('total_leaves').notNull().default(0),
    total_working_hours: numeric('total_working_hours', { precision: 8, scale: 2 }).default('0'),
    total_extra_hours: numeric('total_extra_hours', { precision: 8, scale: 2 }).default('0'),
    status: text('status').notNull().default('draft'), // 'draft' | 'set_for_salary' | 'payslip_generated'
    set_for_salary_by: uuid('set_for_salary_by').references(() => profiles.id, { onDelete: 'set null' }),
    set_for_salary_at: timestamp('set_for_salary_at', { withTimezone: true }),
    gross_salary: numeric('gross_salary', { precision: 12, scale: 2 }),
    absence_deduction: numeric('absence_deduction', { precision: 12, scale: 2 }),
    net_salary: numeric('net_salary', { precision: 12, scale: 2 }),
    advance_recovery: numeric('advance_recovery', { precision: 12, scale: 2 }),
    take_home: numeric('take_home', { precision: 12, scale: 2 }),
    paid_amount: numeric('paid_amount', { precision: 12, scale: 2 }),
    salary_breakdown: jsonb('salary_breakdown'),
    paid_mode: text('paid_mode'),
    pay_date: date('pay_date'),
    pay_reference_no: text('pay_reference_no'),
    payment_remarks: text('payment_remarks'),
    paid_by: uuid('paid_by').references(() => profiles.id, { onDelete: 'set null' }),
    paid_at: timestamp('paid_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================
// Complaint & Ticket Management Tables
// ============================================

// Clients (CRM-style)
export const clients = pgTable('clients', {
    id: uuid('id').primaryKey().defaultRandom(),
    company_name: text('company_name').notNull(),
    contact_person: text('contact_person'),
    email: text('email'),
    phone: varchar('phone', { length: 20 }),
    alt_phone: varchar('alt_phone', { length: 20 }),
    gst_number: varchar('gst_number', { length: 20 }),
    pan_number: varchar('pan_number', { length: 15 }),
    website: text('website'),
    industry: text('industry'),
    address_line1: text('address_line1'),
    address_line2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    pincode: varchar('pincode', { length: 10 }),
    country: text('country').default('India'),
    contacts: jsonb('contacts').default([]), // Array of {name, role, phone, email}
    notes: text('notes'),
    status: text('status').default('active'), // 'active' | 'inactive'
    created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Complaints
export const complaints = pgTable('complaints', {
    id: uuid('id').primaryKey().defaultRandom(),
    complaint_number: varchar('complaint_number', { length: 20 }).notNull().unique(),
    client_id: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    subject: text('subject').notNull(),
    description: text('description'),
    category: complaintCategoryEnum('category').default('general'),
    priority: ticketPriorityEnum('priority').default('medium'),
    status: ticketStatusEnum('status').default('open'),
    source: text('source').default('email'), // 'email' | 'phone' | 'walk-in' | 'whatsapp'
    sla_hours: integer('sla_hours').default(48),
    resolved_at: timestamp('resolved_at', { withTimezone: true }),
    closed_at: timestamp('closed_at', { withTimezone: true }),
    created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Tickets (linked to complaints, supports multi-member via ticket_assignments)
export const tickets = pgTable('tickets', {
    id: uuid('id').primaryKey().defaultRandom(),
    ticket_number: varchar('ticket_number', { length: 20 }).notNull().unique(),
    complaint_id: uuid('complaint_id').references(() => complaints.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    priority: ticketPriorityEnum('priority').default('medium'),
    status: ticketStatusEnum('status').default('open'),
    due_date: date('due_date'),
    estimated_hours: numeric('estimated_hours', { precision: 6, scale: 2 }),
    actual_hours: numeric('actual_hours', { precision: 6, scale: 2 }),
    created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Ticket Assignments (multi-member assignment junction table)
export const ticketAssignments = pgTable('ticket_assignments', {
    id: uuid('id').primaryKey().defaultRandom(),
    ticket_id: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
    assigned_to: uuid('assigned_to').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    assigned_by: uuid('assigned_by').references(() => profiles.id, { onDelete: 'set null' }),
    role: text('role').default('assignee'), // 'assignee' | 'reviewer' | 'observer'
    is_primary: boolean('is_primary').default(false),
    assigned_at: timestamp('assigned_at', { withTimezone: true }).defaultNow(),
});

// Ticket Resolutions (detailed remarks by team members)
export const ticketResolutions = pgTable('ticket_resolutions', {
    id: uuid('id').primaryKey().defaultRandom(),
    ticket_id: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
    resolved_by: uuid('resolved_by').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    resolution_text: text('resolution_text').notNull(),
    remarks: text('remarks'),
    hours_spent: numeric('hours_spent', { precision: 6, scale: 2 }),
    status_after: ticketStatusEnum('status_after').default('in_progress'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Call Logs (tracked as done / pending / cancelled on dashboard)
export const callLogs = pgTable('call_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    ticket_id: uuid('ticket_id').references(() => tickets.id, { onDelete: 'cascade' }),
    complaint_id: uuid('complaint_id').references(() => complaints.id, { onDelete: 'cascade' }),
    client_id: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    called_by: uuid('called_by').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    contact_name: text('contact_name'),
    contact_phone: varchar('contact_phone', { length: 20 }),
    call_type: text('call_type').default('outbound'), // 'inbound' | 'outbound' | 'follow_up'
    duration_minutes: integer('duration_minutes'),
    notes: text('notes'),
    remarks: text('remarks'),
    status: callLogStatusEnum('status').default('pending'),
    next_follow_up: timestamp('next_follow_up', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});


// Relations
export const profilesRelations = relations(profiles, ({ one, many }) => ({
    designation: one(designations, {
        fields: [profiles.designation_id],
        references: [designations.id],
    }),
    activities: many(activities),
    attendance: many(attendance),
    leaves: many(leaves),
    settings: one(employeeSettings, {
        fields: [profiles.id],
        references: [employeeSettings.profile_id],
    }),
    statusHistory: many(userStatusHistory),
    salarySetups: many(employeeSalarySetup),
    advances: many(employeeAdvances),
    monthlySummaries: many(monthlyAttendanceSummary),
    ticketAssignments: many(ticketAssignments),
    ticketResolutions: many(ticketResolutions),
    callLogs: many(callLogs),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
    profile: one(profiles, {
        fields: [attendance.profile_id],
        references: [profiles.id],
    }),
    verifier: one(profiles, {
        fields: [attendance.verified_by],
        references: [profiles.id],
    }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
    profile: one(profiles, {
        fields: [activities.user_id],
        references: [profiles.id],
    }),
}));

export const leavesRelations = relations(leaves, ({ one }) => ({
    profile: one(profiles, {
        fields: [leaves.profile_id],
        references: [profiles.id],
    }),
    approver: one(profiles, {
        fields: [leaves.approved_by],
        references: [profiles.id],
    }),
}));

export const userStatusHistoryRelations = relations(userStatusHistory, ({ one }) => ({
    profile: one(profiles, {
        fields: [userStatusHistory.profile_id],
        references: [profiles.id],
    }),
    actor: one(profiles, {
        fields: [userStatusHistory.changed_by],
        references: [profiles.id],
    }),
}));

export const officeLocationsRelations = relations(officeLocations, ({ one }) => ({
    creator: one(profiles, {
        fields: [officeLocations.created_by],
        references: [profiles.id],
    }),
}));

export const userMpinRelations = relations(userMpin, ({ one }) => ({
    profile: one(profiles, {
        fields: [userMpin.profile_id],
        references: [profiles.id],
    }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
    profile: one(profiles, {
        fields: [pushSubscriptions.profile_id],
        references: [profiles.id],
    }),
}));

export const profilePhotoRequestsRelations = relations(profilePhotoRequests, ({ one }) => ({
    profile: one(profiles, {
        fields: [profilePhotoRequests.profile_id],
        references: [profiles.id],
    }),
    reviewer: one(profiles, {
        fields: [profilePhotoRequests.reviewed_by],
        references: [profiles.id],
    }),
}));

export const biometricVerificationTokensRelations = relations(biometricVerificationTokens, ({ one }) => ({
    profile: one(profiles, {
        fields: [biometricVerificationTokens.profile_id],
        references: [profiles.id],
    }),
}));

export const employeeSalarySetupRelations = relations(employeeSalarySetup, ({ one }) => ({
    profile: one(profiles, {
        fields: [employeeSalarySetup.profile_id],
        references: [profiles.id],
    }),
    creator: one(profiles, {
        fields: [employeeSalarySetup.created_by],
        references: [profiles.id],
    }),
}));

export const employeeAdvancesRelations = relations(employeeAdvances, ({ one }) => ({
    profile: one(profiles, {
        fields: [employeeAdvances.profile_id],
        references: [profiles.id],
    }),
    creator: one(profiles, {
        fields: [employeeAdvances.created_by],
        references: [profiles.id],
    }),
}));

export const monthlyAttendanceSummaryRelations = relations(monthlyAttendanceSummary, ({ one, many }) => ({
    profile: one(profiles, {
        fields: [monthlyAttendanceSummary.profile_id],
        references: [profiles.id],
    }),
    confirmedBy: one(profiles, {
        fields: [monthlyAttendanceSummary.set_for_salary_by],
        references: [profiles.id],
    }),
    payments: many(salaryPayments),
}));

// Complaint & Ticket Relations
export const clientsRelations = relations(clients, ({ one, many }) => ({
    creator: one(profiles, {
        fields: [clients.created_by],
        references: [profiles.id],
    }),
    complaints: many(complaints),
    callLogs: many(callLogs),
}));

export const complaintsRelations = relations(complaints, ({ one, many }) => ({
    client: one(clients, {
        fields: [complaints.client_id],
        references: [clients.id],
    }),
    creator: one(profiles, {
        fields: [complaints.created_by],
        references: [profiles.id],
    }),
    tickets: many(tickets),
    callLogs: many(callLogs),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
    complaint: one(complaints, {
        fields: [tickets.complaint_id],
        references: [complaints.id],
    }),
    creator: one(profiles, {
        fields: [tickets.created_by],
        references: [profiles.id],
    }),
    assignments: many(ticketAssignments),
    resolutions: many(ticketResolutions),
    callLogs: many(callLogs),
}));

export const ticketAssignmentsRelations = relations(ticketAssignments, ({ one }) => ({
    ticket: one(tickets, {
        fields: [ticketAssignments.ticket_id],
        references: [tickets.id],
    }),
    assignee: one(profiles, {
        fields: [ticketAssignments.assigned_to],
        references: [profiles.id],
    }),
    assigner: one(profiles, {
        fields: [ticketAssignments.assigned_by],
        references: [profiles.id],
    }),
}));

export const ticketResolutionsRelations = relations(ticketResolutions, ({ one }) => ({
    ticket: one(tickets, {
        fields: [ticketResolutions.ticket_id],
        references: [tickets.id],
    }),
    resolver: one(profiles, {
        fields: [ticketResolutions.resolved_by],
        references: [profiles.id],
    }),
}));

export const callLogsRelations = relations(callLogs, ({ one }) => ({
    ticket: one(tickets, {
        fields: [callLogs.ticket_id],
        references: [tickets.id],
    }),
    complaint: one(complaints, {
        fields: [callLogs.complaint_id],
        references: [complaints.id],
    }),
    client: one(clients, {
        fields: [callLogs.client_id],
        references: [clients.id],
    }),
    caller: one(profiles, {
        fields: [callLogs.called_by],
        references: [profiles.id],
    }),
}));

// Salary Payments (individual transactions against a payslip)
export const salaryPayments = pgTable('salary_payments', {
    id: uuid('id').primaryKey().defaultRandom(),
    summary_id: uuid('summary_id').notNull().references(() => monthlyAttendanceSummary.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    paid_mode: text('paid_mode').notNull(),
    pay_date: date('pay_date').notNull(),
    pay_reference_no: text('pay_reference_no'),
    payment_remarks: text('payment_remarks'),
    paid_by: uuid('paid_by').references(() => profiles.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const salaryPaymentsRelations = relations(salaryPayments, ({ one }) => ({
    summary: one(monthlyAttendanceSummary, {
        fields: [salaryPayments.summary_id],
        references: [monthlyAttendanceSummary.id],
    }),
    paidByProfile: one(profiles, {
        fields: [salaryPayments.paid_by],
        references: [profiles.id],
    }),
}));
