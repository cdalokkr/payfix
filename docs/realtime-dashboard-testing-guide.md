# Real-Time Dashboard Multi-Browser Testing Guide

This guide provides comprehensive instructions for testing the real-time dashboard implementation across multiple browser sessions with different user roles.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Summary](#architecture-summary)
3. [Test Environment Setup](#test-environment-setup)
4. [Multi-Browser Test Scenarios](#multi-browser-test-scenarios)
5. [Console Logging for Debugging](#console-logging-for-debugging)
6. [Expected Behaviors](#expected-behaviors)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The real-time dashboard implementation uses **role-based Supabase Realtime subscriptions** to ensure:

- **Admin users** receive updates for ALL changes (new users, all activities, analytics)
- **Regular users** only receive updates for their OWN activities

This is achieved through:

- Role-specific channel naming: `dashboard-admin-{userId}` vs `dashboard-user-{userId}`
- Filtered subscriptions for regular users using `filter: user_id=eq.{userId}`
- Full table subscriptions for admin users

---

## Architecture Summary

### Hooks Used

| Hook | Purpose | Target Users |
|------|---------|--------------|
| [`useAdminRealtimeDashboard()`](../hooks/use-realtime-dashboard-data.ts:271) | Full real-time updates for admins | Admin users |
| [`useUserRealtimeDashboard()`](../hooks/use-realtime-dashboard-data.ts:279) | Filtered real-time updates for users | Regular users |
| [`useRoleBasedRealtimeDashboard()`](../hooks/use-realtime-dashboard-data.ts:74) | Base hook with role configuration | Both (internal) |

### Channel Naming Convention

```
Admin: dashboard-admin-{userId}
User:  dashboard-user-{userId}
```

### Subscription Differences

**Admin Subscriptions:**

```javascript
// Subscribes to ALL changes in these tables:
- profiles (INSERT, UPDATE, DELETE)
- activities (INSERT, UPDATE, DELETE)
- analytics_metrics (INSERT, UPDATE, DELETE)
```

**User Subscriptions:**

```javascript
// Subscribes ONLY to their own activities:
- activities WHERE user_id = {currentUserId}
```

---

## Test Environment Setup

### Prerequisites

1. **Development server running:**

   ```bash
   npm run dev
   ```

2. **Supabase project with Realtime enabled:**
   - Ensure the migration [`20251125110000_enable_realtime_for_dashboard.sql`](../supabase/migrations/20251125110000_enable_realtime_for_dashboard.sql) has been applied
   - Verify RLS policies from [`20251125130000_add_dashboard_rls_policies.sql`](../supabase/migrations/20251125130000_add_dashboard_rls_policies.sql)

3. **Test accounts:**
   - At least 2 admin accounts (Admin A, Admin B)
   - At least 1 regular user account (User C)

### Browser Setup

Open **three separate browser sessions** (use different browsers or incognito/private windows):

| Browser | Account Type | Login Credentials |
|---------|--------------|-------------------|
| Browser A | Admin A | <admin-a@example.com> |
| Browser B | Admin B | <admin-b@example.com> |
| Browser C | User C | <user-c@example.com> |

### Opening Developer Console

In each browser:

1. Press `F12` or `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Option+I` (Mac)
2. Navigate to the **Console** tab
3. Filter by "🔌" or "🔔" to see real-time subscription logs

---

## Multi-Browser Test Scenarios

### Test Scenario 1: Admin Adds New User

**Action:** Admin A creates a new user from the dashboard

**Steps:**

1. In Browser A (Admin A), navigate to the admin dashboard
2. Click "Add User" button
3. Fill in the new user form and submit
4. Observe all three browser consoles

**Expected Results:**

| Browser | Expected Behavior | Console Log |
|---------|-------------------|-------------|
| Browser A (Admin A) | ✅ Dashboard updates with new user count | `🔔 [Admin] Real-time update from profiles: INSERT` |
| Browser B (Admin B) | ✅ Dashboard updates with new user count | `🔔 [Admin] Real-time update from profiles: INSERT` |
| Browser C (User C) | ❌ No update (user dashboard doesn't show user count) | No profiles-related log |

### Test Scenario 2: User Performs Activity

**Action:** User C performs an activity (e.g., views a page, updates profile)

**Steps:**

1. In Browser C (User C), perform an action that creates an activity record
2. Observe all three browser consoles

**Expected Results:**

| Browser | Expected Behavior | Console Log |
|---------|-------------------|-------------|
| Browser A (Admin A) | ✅ Activity list updates | `🔔 [Admin] Real-time update from activities: INSERT` |
| Browser B (Admin B) | ✅ Activity list updates | `🔔 [Admin] Real-time update from activities: INSERT` |
| Browser C (User C) | ✅ Own activity list updates | `🔔 [User] Real-time update from own activities: INSERT` |

### Test Scenario 3: Admin Updates Analytics

**Action:** Admin A triggers an analytics update (if applicable)

**Steps:**

1. In Browser A (Admin A), perform an action that updates analytics_metrics
2. Observe all three browser consoles

**Expected Results:**

| Browser | Expected Behavior | Console Log |
|---------|-------------------|-------------|
| Browser A (Admin A) | ✅ Analytics section updates | `🔔 [Admin] Real-time update from analytics: INSERT/UPDATE` |
| Browser B (Admin B) | ✅ Analytics section updates | `🔔 [Admin] Real-time update from analytics: INSERT/UPDATE` |
| Browser C (User C) | ❌ No update | No analytics-related log |

### Test Scenario 4: Admin A Performs Activity

**Action:** Admin A performs an activity

**Steps:**

1. In Browser A (Admin A), perform an action that creates an activity
2. Observe all three browser consoles

**Expected Results:**

| Browser | Expected Behavior | Console Log |
|---------|-------------------|-------------|
| Browser A (Admin A) | ✅ Activity list updates | `🔔 [Admin] Real-time update from activities: INSERT` |
| Browser B (Admin B) | ✅ Activity list updates | `🔔 [Admin] Real-time update from activities: INSERT` |
| Browser C (User C) | ❌ No update (not their activity) | No log (filter excludes other users) |

---

## Console Logging for Debugging

### Subscription Setup Logs

When a user loads the dashboard, you should see:

**For Admin Users:**

```
🔌 Setting up admin real-time dashboard subscriptions on channel: dashboard-admin-{userId}
👑 Admin mode: Subscribing to profiles, activities, and analytics_metrics
✅ Successfully subscribed to admin dashboard updates on dashboard-admin-{userId}
```

**For Regular Users:**

```
🔌 Setting up user real-time dashboard subscriptions on channel: dashboard-user-{userId}
👤 User mode: Subscribing only to activities for user_id={userId}
✅ Successfully subscribed to user dashboard updates on dashboard-user-{userId}
```

### Real-Time Event Logs

When data changes occur:

**Admin receiving profile change:**

```
🔔 [Admin] Real-time update from profiles: INSERT {new: {...}, old: {...}}
🔄 Manual dashboard refresh triggered
```

**Admin receiving activity change:**

```
🔔 [Admin] Real-time update from activities: INSERT {new: {...}, old: {...}}
🔄 Manual dashboard refresh triggered
```

**User receiving own activity change:**

```
🔔 [User] Real-time update from own activities: INSERT {new: {...}, old: {...}}
🔄 Manual dashboard refresh triggered
```

### Cleanup Logs

When navigating away or logging out:

```
🔌 Cleaning up admin real-time dashboard subscriptions
```

or

```
🔌 Cleaning up user real-time dashboard subscriptions
```

---

## Expected Behaviors

### Summary Table

| Scenario | Browser A (Admin) | Browser B (Admin) | Browser C (User) |
|----------|-------------------|-------------------|------------------|
| Admin A adds new user | ✅ Updated | ✅ Updated | ❌ Not updated |
| Admin B adds new user | ✅ Updated | ✅ Updated | ❌ Not updated |
| User C does activity | ✅ Updated | ✅ Updated | ✅ Updated (own only) |
| Admin A does activity | ✅ Updated | ✅ Updated | ❌ Not updated |
| Admin updates analytics | ✅ Updated | ✅ Updated | ❌ Not updated |

### Data Freshness Indicators

The dashboard shows data source status:

- `'loading'` - Initial data fetch in progress
- `'cache'` - Data served from cache
- `'fresh'` - Data freshly fetched after real-time trigger

---

## Troubleshooting

### Issue: No Real-Time Updates Received

**Symptoms:**

- Console shows subscription success but no `🔔` logs when data changes
- Dashboard doesn't update when other users make changes

**Solutions:**

1. **Verify Realtime is enabled in Supabase:**

   ```sql
   -- Check if tables are in the realtime publication
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```

2. **Check RLS policies:**
   - Ensure the user has SELECT permission on the tables
   - Verify the migration [`20251125130000_add_dashboard_rls_policies.sql`](../supabase/migrations/20251125130000_add_dashboard_rls_policies.sql) was applied

3. **Verify userId is being passed:**
   - Check console for `⚠️ No userId provided for real-time subscriptions`
   - Ensure the profile query returns a valid `user_id`

### Issue: User Receives Admin-Level Updates

**Symptoms:**

- Regular user sees updates for other users' activities
- User dashboard updates when new users are added

**Solutions:**

1. **Verify correct hook is used:**
   - Admin dashboard should use [`useAdminRealtimeDashboard()`](../hooks/use-realtime-dashboard-data.ts:271)
   - User dashboard should use [`useUserRealtimeDashboard()`](../hooks/use-realtime-dashboard-data.ts:279)

2. **Check role detection:**
   - Verify the user's role in the profile data
   - Console should show `👤 User mode:` not `👑 Admin mode:`

### Issue: Subscription Errors

**Symptoms:**

- Console shows `❌ Channel error` or `⏱️ Subscription timed out`

**Solutions:**

1. **Check Supabase connection:**
   - Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
   - Check network tab for WebSocket connection issues

2. **Check for duplicate subscriptions:**
   - Ensure cleanup function is being called on unmount
   - Look for multiple `🔌 Setting up...` logs without corresponding cleanup

### Issue: Dashboard Not Refreshing After Real-Time Event

**Symptoms:**

- Console shows `🔔` event received but UI doesn't update

**Solutions:**

1. **Check refetch is being called:**
   - Look for `🔄 Manual dashboard refresh triggered` after the event

2. **Verify tRPC query invalidation:**
   - The `refetch()` function should trigger a new query
   - Check network tab for the tRPC request

3. **Check for React state issues:**
   - Ensure component is still mounted when refetch completes
   - Look for React warnings about state updates on unmounted components

### Issue: Deprecation Warning

**Symptoms:**

- Console shows `⚠️ useComprehensiveRealtimeDashboard is deprecated`

**Solutions:**

1. **Update to role-specific hooks:**
   - Replace `useComprehensiveRealtimeDashboard()` with `useAdminRealtimeDashboard(userId)` or `useUserRealtimeDashboard(userId)`
   - Ensure you pass the user's ID from the profile

---

## Validation Checklist

Before considering the implementation complete, verify:

- [ ] Admin users see real-time updates for new user registrations
- [ ] Admin users see real-time updates for ALL activities
- [ ] Admin users see real-time updates for analytics changes
- [ ] Regular users do NOT see updates for new user registrations
- [ ] Regular users do NOT see updates for other users' activities
- [ ] Regular users DO see updates for their own activities
- [ ] Channel names follow the convention: `dashboard-{role}-{userId}`
- [ ] Cleanup functions properly remove subscriptions on unmount
- [ ] Console logs clearly indicate subscription type and events

---

## Related Files

- [`hooks/use-realtime-dashboard-data.ts`](../hooks/use-realtime-dashboard-data.ts) - Main real-time hooks
- [`components/dashboard/admin-overview.tsx`](../components/dashboard/admin-overview.tsx) - Admin dashboard component
- [`components/dashboard/user-overview.tsx`](../components/dashboard/user-overview.tsx) - User dashboard component
- [`supabase/migrations/20251125110000_enable_realtime_for_dashboard.sql`](../supabase/migrations/20251125110000_enable_realtime_for_dashboard.sql) - Realtime enablement migration
- [`supabase/migrations/20251125130000_add_dashboard_rls_policies.sql`](../supabase/migrations/20251125130000_add_dashboard_rls_policies.sql) - RLS policies migration
- [`scripts/validate-realtime-multi-browser.js`](../scripts/validate-realtime-multi-browser.js) - Validation script
