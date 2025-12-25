# Implementation Plan: Module-Based Access Control

## Overview
This plan outlines the implementation of a module-based access control system with `Employee`, `BackOffice`, and `Full Control` (Admin) roles.

## Roles & Permissions
1. **Full Control (Admin)**
   - Access: Total Project Access (All Modules).
   - Role Value: `admin`

2. **BackOffice (Standard User)**
   - Access: Standard user role access (default modules).
   - Role Value: `backoffice` (or `user` with specific module set).
   - *Note: We will map the existing `user` role to this behavior or explicity rename it.*

3. **Employee (Restricted)**
   - Access: Only assigned modules.
   - Role Value: `employee`
   - Requires: explicit `allowed_modules` assignment.

## Phase 1: Database & Type Definition
1. **Update Types (`types/index.ts`)**
   - Extend `UserRole` to include `'employee' | 'backoffice'`.
   - Define `Module` type (e.g., `'dashboard' | 'users' | 'reports' | 'settings' | 'analytics'`).
   - Update `Profile` interface to include `allowed_modules?: Module[]`.

2. **Database Schema (Supabase)**
   - *Action Required*: Execute SQL migration to add `allowed_modules` column and update `role` enum/check constraint.
   ```sql
   -- Example Migration
   ALTER TABLE profiles ADD COLUMN allowed_modules text[];
   
   -- Update Role Check Constraint (if exists)
   ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
   ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
     CHECK (role IN ('admin', 'user', 'employee', 'backoffice'));
   ```

## Phase 2: Backend Logic (`lib/trpc/routers`)
1. **Admin Users Router (`admin-users.ts`)**
   - Update `updateUserRole` to support new roles.
   - Add/Update `updateUser` to handle `allowed_modules` assignment.
   - Ensure `getUsers` returns `allowed_modules` and supports filtering by new roles.

2. **Auth Router (`auth.ts`)**
   - Ensure session/login returns the updated role and modules in the profile.

## Phase 3: Frontend Navigation & UI
1. **Navigation Items (`components/dashboard/nav-items.ts`)**
   - Tag navigation items with `moduleId` or strictly map them.
   - Define module constants.

2. **Sidebar Logic (`components/dashboard/app-sidebar.tsx`)**
   - Implement filtering logic:
     - If `admin`: Show all `adminNavItems`.
     - If `backoffice`: Show standard `userNavItems` (or `backofficeNavItems`).
     - If `employee`: Show `userNavItems` FILTERED by `allowed_modules`.

3. **User Management UI (`app/(dashboard)/admin/users`)**
   - Update User Edit/Create forms to allow:
     - Selecting `Employee` role.
     - Multi-select checkbox for "Allowed Modules" (visible only if Role = Employee).

## Phase 4: Route Protection (Middleware/Page Level)
- Ensure API routes & Pages verify access to specific modules if the user is an `Employee`.
