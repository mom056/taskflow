# Project State Snapshot

This file maintains the current structural and functional state of the TaskFlow project.

---

## 1. Active Modules & Components

* **Super Admin Dashboard (`src/pages/SuperAdminDashboard.tsx`):**
  * Admin interface for companies and SaaS platform metrics.
  * Displays MRR (Monthly Recurring Revenue) calculations, interactive employee capacity limits, and deactivation toggles.
  * Inputs for company limits are sanitized via `toEnglishDigits` utility to correctly parse Arabic/Eastern numbers (`١٢٣` -> `123`) on mobile keypads.
* **Manager Dashboard (`src/pages/ManagerDashboard.tsx`):**
  * Admin interface for tasks allocation, team management, interactive GPS visits mapping, and charts.
  * Real-time employee status badge (🟢 Busy on a task / ⚪ Available) computed dynamically using tasks memo.
  * Employee modification/deletion dialogs linked to `create-user` Edge Function.
* **Employee Dashboard (`src/pages/EmployeeDashboard.tsx`):**
  * Simple task list for field employees.
  * Location recording at the start and completion of each task.
  * Sequenced task action buttons.
* **Native Services (`src/lib/nativeServices.ts`):**
  * Core integration for Capacitor plugins (Geolocation, Browser, etc.).
  * Resilient multi-tier geolocation tracking.
* **User Management Edge Function (`supabase/functions/create-user/index.ts`):**
  * Secure administrative backend running on Deno.
  * Supports actions: `create`, `update`, `delete`.
  * Company ownership check prevents unauthorized cross-tenant mutations.

---

## 2. Database Schema & Cascade Rules

* **Table `users`:**
  * Maps `id` to `auth.users(id)`.
  * Foreign key constraints configured with `ON DELETE CASCADE` so deleting the auth user cleans up the profile entry automatically.
* **Table `tasks`:**
  * Tracks task titles, descriptions, employee assignments, statuses, and coordinates.
  * Fields: `start_latitude`, `start_longitude` (commence position) and `latitude`, `longitude` (completion position).
* **Table `companies`:**
  * Has `is_active` (boolean) to manage tenant active/suspended status.
  * Updates to `is_active`, `name`, `slug`, `plan`, or `max_employees` are protected at the database level by the `check_company_update` trigger, restricting updates strictly to super_admins.
  * The `get_my_company_id()` function asserts that the company `is_active = true`, causing RLS policies to deny all read/write queries to suspended tenants dynamically.

---

## 3. Last Completed Phase

* Implemented Arabic/Eastern digit sanitization in Super Admin dashboard inputs.
* Hardened database-level security policies (RLS and Triggers) in `supabase_schema.sql` to block suspended tenants and prevent manager escalation.
* Added expected MRR metrics card and active/suspended tabs and UI indicators.
* Enabled frontend session rejection for users logging into inactive companies within `AuthContext.tsx`.
* Native Capacitor synchronization and Vite build checks complete and compile successfully (exit code 0).
