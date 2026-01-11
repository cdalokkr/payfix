# PayFix Fresh Database Setup Guide

Complete steps to set up a new PayFix instance with database and Edge Functions.

---

## Prerequisites

- Node.js 18+ installed
- A Supabase project created at <https://supabase.com>
- Project credentials from Supabase Dashboard → Settings → API

---

## Step 1: Environment Setup

Create `.env.local` in project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Step 2: Create Database Schema

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy contents of `supabase/setup-fresh-db.sql`
3. Paste and click **Run**

This creates all tables, indexes, functions, triggers, and RLS policies.

---

## Step 3: Seed Default Data

Run from project root:

```bash
npm run db:seed
```

This seeds:

- ✅ Designations
- ✅ Office settings
- ✅ 2026 holidays
- ✅ Master admin user

**Admin Login:**

- Email: `srpadmin@saaskit.in`
- Password: `Srpadmin@7626$`

---

## Step 4: Deploy Edge Functions

### 4.1 Get Access Token

1. Go to <https://supabase.com/dashboard/account/tokens>
2. Generate new token
3. Copy the token

### 4.2 Deploy Functions

```powershell
# Set your token and project ref
$env:SUPABASE_ACCESS_TOKEN="your_token_here"

# Deploy all functions
npx supabase functions deploy attendance-clock --project-ref YOUR_PROJECT_REF
npx supabase functions deploy broadcast-notification --project-ref YOUR_PROJECT_REF
npx supabase functions deploy attendance-stats --project-ref YOUR_PROJECT_REF
```

---

## Step 5: Verify Setup

```bash
npm run setup:fresh
```

This checks:

- Database tables exist
- Default data seeded
- Shows Edge Function deployment status

---

## Step 6: Start the App

```bash
npm run dev
```

Open <http://localhost:3000> and login with admin credentials.

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run db:seed` | Seed database with defaults |
| `npm run setup:fresh` | Check setup status |
| `npm run seed:admin` | Create/reset admin user |
| `npm run functions:deploy` | Deploy edge functions |
| `npm run dev` | Start development server |

---

## Troubleshooting

### "relation does not exist"

Run `setup-fresh-db.sql` in Supabase SQL Editor first.

### "Email already registered"

The admin user exists. Use `seed:admin` to reset.

### Edge function 401 errors

Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly.

---

## File Reference

| File | Purpose |
|------|---------|
| `supabase/setup-fresh-db.sql` | Complete database schema |
| `supabase/seed-admin.sql` | Admin user SQL (manual) |
| `scripts/seed-database.ts` | Node seed script |
| `scripts/setup-fresh.ts` | Setup verification |
| `supabase/functions/` | Edge functions |
