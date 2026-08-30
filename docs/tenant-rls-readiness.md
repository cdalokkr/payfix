# Tenant RLS readiness

PayFix currently isolates shared-database tenants by resolving an authenticated
user to one active tenant and routing all business queries through a
schema-specific PostgreSQL connection whose `search_path` starts with that
tenant schema.

## Why RLS is not enabled blindly

The application uses direct PostgreSQL connections rather than PostgREST JWT
claims for tenant business queries. Enabling JWT-dependent row policies without
first adding a trusted database session identity would block legitimate PWA and
kiosk requests while giving little additional protection to the PostgreSQL
owner role.

## Required acceptance tests before enabling RLS

1. Create two non-production tenant schemas with separate users and locations.
2. Authenticate as a user from tenant A while requesting tenant B by hostname,
   query parameter, cookie, and forwarded tenant headers.
3. Confirm every request resolves back to tenant A or is rejected.
4. Attempt direct CRUD for profiles, attendance, kiosk devices, photo requests,
   and biometric verification attempts across both schemas.
5. Verify background jobs and kiosk pairing set the same trusted tenant context.
6. Add a non-owner runtime database role that cannot bypass RLS.
7. Set a transaction-local trusted tenant identifier on every database request.
8. Add tenant-schema policies bound to that identifier, then rerun PWA check-in,
   check-out, kiosk verification, enrollment, approval, and reporting tests.

Run `scripts/audit-tenant-isolation.sql` before and after the test. The audit is
read-only and reports tenant registry validity, schema/table RLS state, existing
policies, and unindexed tenant foreign keys.