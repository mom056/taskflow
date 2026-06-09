# TaskFlow Supreme Development Rules

Welcome to the **TaskFlow** project. These rules govern architectural integrity, code quality, and development guidelines for this repository.

---

## 1. Core Architecture & Stack

TaskFlow is a multi-platform task management system built on the following technologies:
* **Frontend:** React + Vite + TypeScript.
* **Styling:** Vanilla CSS + Tailwind CSS (utilizing responsive layouts and full RTL support for Arabic language).
* **Native Wrappers:** Capacitor (Android & iOS).
* **Backend:** Supabase (Postgres Database, RLS Policies, Edge Functions).

---

## 2. Key Engineering Principles

### 2.1. Security & Company Isolation (Tenant Separation)
* **Rule:** Every query, mutation, or administrative operation MUST explicitly enforce company tenant isolation.
* **Database level:** Check `company_id` on all tables.
* **Edge Functions:** When creating, updating, or deleting user accounts via the admin SDK, verify that the calling manager belongs to the same company as the target employee.

### 2.2. Robust Geolocation Tracking
* **Rule:** Geolocation calls on mobile devices must be resilient to indoor and offline environments.
* **Fallback Chain:** Always attempt high-accuracy GPS first with a reasonable timeout (e.g., 8s). Fallback to coarse network location (8s timeout) if GPS fails, and finally fallback to cached coordinates (up to 24 hours old) to prevent task transitions from failing.

### 2.3. Task State Sequence Enforcement
* **Rule:** Task states must follow a logical, sequential workflow:
  `pending` -> `in_progress` -> `completed` / `suspended`.
* **UI Constraint:** A user must NOT be allowed to complete a task without first starting it (transitioning it to `in_progress`).

### 2.4. Supabase Auth and User Management
* **Rule:** Client-side users cannot update or delete other users in `auth.users`.
* **Solution:** All user management actions (creation, editing email/password, deletion) must route through the `create-user` Edge Function which uses the administrative service role client.

---

## 3. Coding Style & Quality

* **Typing:** Strict TypeScript typing. Avoid `any` type casting.
* **Performance:** Use `useMemo` for high-overhead computations (e.g., matching employees to tasks in list views).
* **UI/UX:** High aesthetics, smooth transitions, pulsing indicators, and standard RTL Arabic text alignment.
