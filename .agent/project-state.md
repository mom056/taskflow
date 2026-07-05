# Project State Snapshot

This file maintains the current structural and functional state of the TaskFlow project.

---

## 1. Active Modules & Components

* **Super Admin Dashboard (`src/pages/SuperAdminDashboard.tsx`):**
  * Admin interface for companies and SaaS platform metrics.
  * Displays MRR (Monthly Recurring Revenue) calculations, interactive employee capacity limits, and deactivation toggles.
  * Inputs for company limits are sanitized via `toEnglishDigits` utility to correctly parse Arabic/Eastern numbers (`١٢٣` -> `123`) on mobile keypads.
  * Multi-tab structure supporting: **Manage Companies**, **Platform Audit Logs**, and **Stripe & Billing Setup**.
  * Features a **Stripe Webhook Simulator** allowing administrators to test and trigger plan transitions (Free, Basic, Premium) and subscription billing suspension scenarios.
* **Manager Dashboard (`src/pages/ManagerDashboard.tsx`):**
  * Admin interface for tasks allocation, team management, interactive GPS visits mapping, and charts.
  * Real-time employee status badge (🟢 Busy on a task / ⚪ Available) computed dynamically using tasks memo.
  * Employee modification/deletion dialogs linked to `create-user` Edge Function.
  * Includes a "Register New Employee" quick action button in both desktop and mobile views that routes the manager to the Profile Settings page.
* **Profile Settings (`src/pages/ProfileSettings.tsx`):**
  * Manages personal settings, company logo uploads, application language, theme switches, and biometric login setups.
  * Includes the team member registration form for managers.
  * Enhanced with reactive hash-scrolling (`#register-employee`) using React Router's `useLocation` to instantly scroll and focus the onboarding form into viewport when navigated from the dashboard.
* **Employee Dashboard (`src/pages/EmployeeDashboard.tsx`):**
  * Renders the interactive **Visual Workday Path** at the top of active tasks.
  * Uses a dynamic inline **Segmented Control Bar** to switch between active and completed tasks with live counters (instead of the old 4 bulky KPI grid cards).
  * Proximity-based sorting ("الأقرب إليّ") to order tasks based on Haversine distance from the user's GPS coordinates.
  * Geofence arrival detection (pulsing glow + check-in triggers) and swipe gestures to start/complete tasks.
  * Renders the `AttendanceCard` and triggers for `LeaveRequestModal` and `VisitModal`.
* **Attendance & Field Visits Module (`v2.0.0`):**
  * **Attendance Card (`src/components/AttendanceCard.tsx` & `useAttendance.ts`):** Employee check-in/out with automated office vs field categorization using GPS-based geofence calculation.
  * **Field Visit Modal (`src/components/VisitModal.tsx` & `useVisits.ts`):** Documenting visits with coordinate capture and verification image uploads under custom RLS rules.
  * **Leave Requests Modal (`src/components/LeaveRequestModal.tsx` & `useLeaveRequests.ts`):** Interactive excuse and leave request applications.
  * **Manager Auditing Panels (`src/components/AttendanceTable.tsx` & `src/components/LeaveRequestsPanel.tsx`):** Grid/list panels mounted inside `ManagerDashboard.tsx` for monitoring, reviewing, and exporting attendance and leave requests.
* **Native Services (`src/lib/nativeServices.ts`):**
  * Core integration for Capacitor plugins (Geolocation, Browser, etc.).
  * Resilient multi-tier geolocation tracking.
  * Support for native photo capturing via Capacitor Camera.
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
  * Fields: `start_latitude`, `start_longitude` (commence position), `latitude`, `longitude` (completion position), and `target_latitude`, `target_longitude` (geofencing boundaries).
* **Table `companies`:**
  * Has `is_active` (boolean) to manage tenant active/suspended status.
  * Updates to `is_active`, `name`, `slug`, `plan`, or `max_employees` are protected at the database level by the `check_company_update` trigger, restricting updates strictly to super_admins.
  * The `get_my_company_id()` function asserts that the company `is_active = true`, causing RLS policies to deny all read/write queries to suspended tenants dynamically.
  * Stores payment metadata configurations: `stripe_customer_id`, `stripe_subscription_id`, `stripe_public_key`, and `stripe_webhook_secret`.
* **Table `platform_audit_logs`:**
  * System-wide audit log mapping administrator actions, details payload (JSONB), company references, IP addresses, and user-agent metadata.
 
---
 
## 3. Last Completed Phase
 
* **Phase 1: Security & Critical Basics:** Implemented Forgot Password flow (`ResetPassword.tsx` page and reset email trigger), database-level employee limits check trigger, verification of native push notification deployment, and confirmation dialogs for sign-out and company deactivations.
* **Phase 2: UX & Interactivity:** Integrated KPI metrics cards for employee performance, date range filter for manager dashboards, and company settings with logo upload and storage buckets.
* **Phase 3: Data Integrity & Offline:** Integrated offline React Query local persistence with custom Capacitor Preferences adapter and introduced audit activity logger (`useActivityLog`).
* **Phase 4: Production Hardening & Dashboard Unification (completed):** Resolved company types mismatch, fixed React Modal nesting bugs in Employee/Manager dashboards, enabled PWA Service Worker. Refactored Manager Dashboard to route mobile and desktop views directly into a single responsive `TasksTable` component, and replaced the status filters dropdown with a premium bilingual Segmented Button Group controller.
* **Phase 5: Future Growth, Multi-language & App Delivery (completed):** Verified Landing Page routing, implemented translation context with dynamic RTL/LTR layout switcher. Expanded with Notification Center, Biometrics Auth, Deep Linking, Offline Maps, and PDF Sharing sheets. Redesigned the Landing Page download section to offer Android APK installation steps, an interactive iOS Safari PWA guide, and an SVG-rendered QR Code. Implemented Apple-compliant "Delete Account" Danger Zone in Profile Settings with double-confirmation, invoking the `delete_own_user` DB RPC before sign-out.
* **Phase 6: Final Verification & Audit (completed):** Configured Sentry crash reporting and `ErrorBoundary.tsx`. Integrated `@capacitor/haptics` tactile feedback.
* **Phase 8: Geofencing Realignment & UX Hardening (v1.5.0) (completed):** Created `target_latitude` and `target_longitude` fields in the database schema. Updated core interfaces and `useTasks` mapping hooks. Integrated Geofencing inputs and "Use Current Location" GPS getters inside the manager's Task Modal. Upgraded the employee dashboard to measure proximity against target coordinates instead of completion coordinates, locked concurrent task update triggers to prevent double-check-in race conditions, rate-limited startup update checks to 24 hours, and built automatic chunk load failure recovery.
* **Phase 9: Security Hardening & Isolation (v1.6.0) (completed):** Implemented database-level triggers and RLS policies to prevent role escalation on profile inserts (`check_user_insert`), task details tampering by employees (`check_task_update`), employee impersonation in visits (`visits_insert_policy`), activity log spoofing (`activity_log_insert_policy`), and cross-tenant information leaks (hardened `companies` and storage buckets RLS constraints).
* **Phase 10: Attendance, Visits, and Leave Management (v2.0.0) (completed):** Built full offline-first workflow for check-in/out, lateness automated server calculation, geofencing office/field verification, coordinate audits, leave requests panel, and field visit logs. Refactored mobile bottom navigation with drawer-based menus to support >5 items and direct profile settings routing.
* **Phase 11: Employee Mobile Premium UX Upgrade (v2.1.1) (completed):** Refactored the dashboard and attendance card to native-grade premium design. Added a real-time updating digital clock (seconds and AM/PM), progressive disclosure of notes under an toggled block, and fully localized RTL/LTR translations for check-in toasts. Enhanced the dashboard header with personalized greetings ("Good Morning/Evening") based on employee name and hour, integrated a daily tasks progress bar, optimized card action targets to a single flex row, and designed custom empty-state card illustrations. Optimized the component architecture by wrapping `getMergedTasks` offline queue data reconciliation inside `useMemo` to prevent layout re-render overhead.
* **Phase 12: Security Hardening & CORS Resolutions (v2.2.0) (Completed):** Implemented the full security blueprint. The codebase now rotates webhook secrets via Supabase Vault, enforces Deno edge functions to fail-closed on webhook signature mismatches, isolates Stripe billing data into a restricted `company_billing` table, applies server-side Haversine geofencing calculations (coercing out-of-bound office check-ins to `field` type), enforces 10-character password policies across the Deno edge function and React components, locks down all SECURITY DEFINER functions with a safe `search_path`, configures the `task-images` storage bucket to private (recreating Upload/Read/Delete policies with dual-folder checks), resolves temporary signed URLs on the fly in `useTasks.ts`, restricts task status transitions at the DB level in `check_task_update()`, drops `get_user_count` RPC to hide platform user count statistics, and adds optional Upstash Redis rate-limiting on Edge Functions.
* **Build Verification:** Successfully compiled the entire client bundle with zero errors via `npx tsc --noEmit` and Vite production build (`npm run build`).

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

---

## 5. Future Architectural Directions

* **Private Repository APK Distribution Strategy:** In the event the GitHub repository is set to Private, default unauthenticated public access to GitHub releases will be blocked (causing download failures for the APK from the Landing Page). The recommended architectural solution is configuring the GitHub Actions build workflow to automatically upload the compiled `app-release.apk` binary to a Public Supabase Storage bucket (`app-distribution`), and updating the Landing Page download anchor href to point to the Supabase public CDN URL.
* **High-Fidelity PDF/Report Generation:** Migrate from client-side `jsPDF` custom font reverse character rendering to either a Backend PDF Generation service (e.g. Supabase Edge Function utilizing Puppeteer/Typst) or a native Capacitor print layout engine. This resolves browser-based Arabic RTL and letter-ligation (shaping) limitations natively.
* **Universal Links / App Links:** Transition custom schemes to verified Universal Links (`https://taskflow.com/...`) by deploying domain association files (`apple-app-site-association` and `assetlinks.json`) to prevent deep link hijacking and ensure standard web fallback routing.
* **Conflict Resolution Strategy:** Formulate concrete merging paradigms (e.g. Last-Write-Wins or user-facing change conflict dialogue) for the offline synchronizer queue when scale reaches millions of concurrent edits.
* **Telemetry Control:** Restructure the Sentry initialization parameters in production environments to cap reporting rates (e.g., set `tracesSampleRate: 0.1` or lower) and mitigate bandwidth/infrastructure telemetry bills.
* **Stripe Live Webhooks Integration:** When deploying to production, point the Stripe Developer dashboard webhooks directly to a secure Supabase Edge Function to handle live billing updates dynamically.
* **Plan Limits Guard:** Implement database check constraints or backend RLS guards verifying current employee counts against the company's `max_employees` configuration before allowing new registrations.
* **Encryption of API Secrets:** Encrypt gateway publishable/secret keys in the `companies` table using `pgcrypto` or dynamic environment configuration vaults to prevent plaintext credential exposure in case of DB read anomalies.

---

## 6. Visual Identity & Logo Architecture

* **Unified AppLogo Component (`src/components/AppLogo.tsx`):**
  * Serves as the single source of truth for the application's visual branding.
  * Renders the official high-resolution branding image (`/logo.png`) directly in the application headers, sidebars, and entry views.
  * This guarantees a 100% match with the approved premium logo design (combining glossy reflections, volumetric gradient accents, and precise shading).
  * Configurations updated in `index.html`, `vite.config.ts` (PWA assets), and `push-worker.js` (Web Push notification icons) to reference `/logo.png`.
  * Supports dynamic sizing properties (`size`) to fit responsive sidebars (30-32px) and login forms (56px) cleanly.

---

## 7. PostgreSQL Migration Notes & Manual Procedures

* **Self-Deletion RPC Migration:**
  * **File:** `supabase/migrations/20260628130000_delete_own_user_rpc.sql`
  * **Description:** Implements the `delete_own_user()` database RPC function with `SECURITY DEFINER` privileges to allow authenticated users to initiate self-deletion of their accounts from `auth.users`, cascading cleanups to their profile and sessions while setting reference keys in task histories to NULL.
  * **Deployment requirement:** Must be run in the Supabase SQL Editor or deployed using the Supabase CLI in the production dashboard prior to testing the Profile Settings "Delete Account" action.
* **Platform Audit Logs Schema Migration:**
  * **File:** `supabase/migrations/20260630120000_platform_audit_logs.sql`
  * **Description:** Provisions the `platform_audit_logs` table, establishes Stripe key placeholder fields on `companies`, and configures row-level security (RLS) allowing only `super_admin` access to the audit trails.
* **Attendance, Visits, & Leave Management Migration:**
  * **File:** `supabase/migrations/20260630150000_attendance_system.sql`
  * **Description:** Sets up the core database structure for attendance records, leave requests, and field visits. Configures Riyadh (UTC+3) schedules, automated lateness calculations, proximity geofence validation functions, and strict row-level security (RLS) policies.


