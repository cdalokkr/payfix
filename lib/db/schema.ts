import { pgTable, uuid, text, timestamp, varchar, date, numeric, integer, boolean, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'moderator', 'employee']);
export const activityTypeEnum = pgEnum('activity_type', ['login', 'logout', 'profile_update', 'data_view', 'data_edit', 'data_delete', 'data_create', 'password_change']);

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
    user_id: uuid('user_id'), // Auth UID
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
    allowed_modules: text('allowed_modules').array(),
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
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Leaves
export const leaves = pgTable('leaves', {
    id: uuid('id').primaryKey().defaultRandom(),
    profile_id: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    leave_type: text('leave_type'),
    start_date: date('start_date').notNull(),
    endDate: date('end_date').notNull(), // Matching the SQL which had end_date as endDate in my manual map? recheck
    reason: text('reason'),
    status: text('status').notNull().default('pending'),
    remarks: text('remarks'),
    approved_by: uuid('approved_by').references(() => profiles.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Re-check leaves field name from migration
// CREATE TABLE IF NOT EXISTS public.leaves (
//     ...
//     end_date DATE NOT NULL,
// let's fix to end_date

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
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
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
