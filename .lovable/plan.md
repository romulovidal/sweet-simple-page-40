---
title: Super Admin Implementation Plan
description: Establish a hierarchical administrative structure with a Super Admin role, secure database functions, and a management interface.
type: feature
---

# Plan: Super Admin Implementation

We will implement a definitive administrative structure using a hierarchical model (Super Admin > Admin > User) rooted in the `public.user_roles` table, removing fragile frontend fallbacks.

## Technical Details

### 1. Database Schema & Permissions (Supabase)

We will execute a migration to:
- Add `super_admin` to the `app_role` enum.
- Grant `super_admin` role to the specific UUID `5850679f-697b-4ec2-a47c-47b88a96bffa`.
- Update `public.has_role` to support hierarchy (Super Admin satisfies Admin checks).
- Create `public.is_super_admin(user_id)` as a `SECURITY DEFINER` function.
- Enforce RLS on `public.user_roles`: only Super Admins can insert/update/delete roles; users can only read their own roles (Super Admins can read all).

### 2. Frontend Infrastructure

- **Hook `useIsAdmin`**: Refactor to return `{ isAdmin, isSuperAdmin, role, loading }` using a single source of truth (PostgREST query to `user_roles`).
- **Route Protection**: Update `/admin` to wait for session and role resolution before deciding access.
- **Admin Panel**: Create a new "Administrators" section accessible only to `isSuperAdmin`.

### 3. Admin Management Logic

- Implement a secure RPC `manage_user_role` that allows a Super Admin to promote/demote other users to `admin`.
- Ensure the first Super Admin cannot be removed through the UI.

## Steps

1. **Database Migration**: Run SQL to update enum, functions, and initial permissions.
2. **Refactor Hook**: Update `src/hooks/useIsAdmin.ts` with hierarchical logic and proper loading states.
3. **Update Admin Route**: Modify `src/pages/AdminPage.tsx` to handle the new role and loading flow.
4. **Create Management UI**: Build the "Administrators" component and integrate it into the Admin Panel.
5. **Security Audit & Cleanup**: Remove legacy fallback code and verify RLS policies.
6. **Final Validation**: Execute the requested test battery for UUID `5850679f-697b-4ec2-a47c-47b88a96bffa`.
