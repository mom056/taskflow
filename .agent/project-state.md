# Project State Snapshot

This file maintains the current structural and functional state of the TaskFlow project.

---

## 1. Active Modules & Components

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

---

## 3. Last Completed Phase

* Implementation of employee editing (email, password, role, name) and employee deletion inside Manager Dashboard.
* Full integration with Deno Edge function.
* Native Capacitor synchronization and Vite build checks complete.
