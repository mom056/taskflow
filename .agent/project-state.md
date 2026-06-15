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

* **Phase 1: Security & Critical Basics:** Implemented Forgot Password flow (`ResetPassword.tsx` page and reset email trigger), database-level employee limits check trigger, verification of native push notification deployment, and confirmation dialogs for sign-out and company deactivations.
* **Phase 2: UX & Interactivity:** Integrated KPI metrics cards for employee performance, date range filter for manager dashboards, and company settings with logo upload and storage buckets.
* **Phase 3: Data Integrity & Offline:** Integrated offline React Query local persistence with custom Capacitor Preferences adapter and introduced audit activity logger (`useActivityLog`).
* **Phase 4: Production Hardening:** Resolved company types mismatch, fixed React Modal nesting bugs in Employee/Manager dashboards, and enabled PWA Service Worker.
* **Phase 5: Future Growth & Multi-language:** Verified Landing Page routing, implemented lightweight type-safe translation context with dynamic RTL/LTR layout switcher for English/Arabic languages.
* **Build Verification:** Successfully verified TypeScript compilation (`npx tsc --noEmit`) and production build compilation (`npm run build`) with zero errors.

---

## 4. iOS Distribution & Build Strategy

* **Automation Tool:** GitHub Actions workflow configured in `.github/workflows/ios-build.yml` running on `macos-latest` runner.
* **Prerequisites for deployment:**
  1. Paid Apple Developer Account ($99/year) to sign applications for testing/production.
  2. Registered test device UDIDs in Apple Developer Portal for Ad-Hoc distribution.
  3. Signing credentials encoded in Base64 and stored under GitHub repository secrets:
     * `BUILD_CERTIFICATE_BASE64`: Private signing certificate (`.p12`).
     * `P12_PASSWORD`: Password protecting the `.p12` certificate.
     * `BUILD_PROVISION_PROFILE_BASE64`: Provisioning profile (`.mobileprovision`).
* **Build Trigger:** Manually triggered via GitHub Actions tab (`iOS Production Build`). Yields a downloadable `app-release.ipa` package that can be shared via Diawi or uploaded to App Store/TestFlight.
