# Detailed Implementation Plan - TaskFlow Production Hardening & Signature UI (Updated)

This plan outlines the precise steps and code changes required to refactor TaskFlow into a production-grade, highly-functional, mobile-optimized, and brand-distinctive application (Signature UI).

All updates are designed to be future-proof (DRY, decoupling styling from layouts, using existing database schemas) and compliant with mobile app store policies.

---

## 💎 Approved Signature Features & UX Upgrades

### 🗺️ 1. Proximity-Based Sorting ("الأقرب إليّ")

- **Behavior:** The employee dashboard retrieves coordinates using `useGeoLocation`.
- **UI Display:** Each active task card displays its distance from the employee (e.g., `"تبعد 1.2 كم"` or `"على بعد 300 متر"`).
- **Proximity Sorting:** A sorting toggle will be added to the dashboard to order active tasks by proximity (nearest first), helping field agents plan their travel.

### 📈 2. Visual Workday Path (خط مسار اليوم التفاعلي)

- **Behavior:** A visual dotted horizontal path showing the sequence of active tasks for the day (Task 1 ➔ Task 2 ➔ Task 3).
- **UI:** Clicking a node in this path highlights/scrolls to the task card. Completed tasks display as checked green nodes.

### ☝️ 3. Mobile Swipe Gestures (إيماءات السحب للمهام)

- **Behavior:** Standard touch gesture listeners (`onTouchStart`, `onTouchMove`, `onTouchEnd`) on mobile cards.
- **Swipe Right:** Instantly marks a task as `in_progress` with tactile feedback (`triggerHaptic('light')`).
- **Swipe Left:** Instantly opens the Camera/Notes upload overlay (to Complete).

### 🔔 4. Geofence Arrival Glow (الاستشعار الجغرافي للوصول)

- **Behavior:** Checks the distance between the employee and the active task coordinates.
- **UI:** If distance < 100m, the card border glows in pulsing green with a prominent "لقد وصلت! تسجيل الدخول" (Arrived! Check-in) button.

### 🛡️ 5. Smart Permission & Installation Guides (مرشد تفعيل الصلاحيات وتثبيت التطبيق)

- **Behavior:** Prevents silent errors when GPS or Notifications are disabled or blocked at the OS/Browser level, and guides users through manual installation processes.
- **Solution:**
  - Create a custom **`PermissionGuideModal`** component.
  - **Native Mobile Push Notifications:** If permission is denied, show a guide showing iOS/Android users how to re-enable them in settings, with a button to open settings directly.
  - **Native Mobile GPS:** If GPS is disabled in quick toggles, display a visual guide to activate location services.
  - **Web Browser Geolocation:** Display step-by-step visual instructions to click the secure lock icon in the browser URL bar and set Location to "Allow".
  - **Web Notifications Soft-Prompt:** Use an in-app banner for notifications to prevent automatic browser blocking.
  - **Android APK Security Bypass Instructions:** Provide clear instructions on the landing page and within the app under download links explaining how to toggle "Allow from this source" when the OS displays the "Unknown Sources" security prompt.

### 🛑 6. Apple Store Account Deletion Compliance (حذف الحساب)

- **Database Function:** Add a Postgres function `public.delete_own_user()` with `SECURITY DEFINER` that deletes the user from `auth.users` when called, triggering database cascades.
- **UI Button:** In `ProfileSettings.tsx`, add a red "حذف الحساب" (Delete Account) section with a confirmation modal. Once confirmed, it invokes the RPC and calls `signOut()`.

### 🤖 7. GitHub Automated Build & Release (الأتمتة عبر GitHub Releases)

- **Behavior:** Compile Android APK automatically in GitHub Actions on Vercel/Release trigger.
- **Release Automation:** Modify `.github/workflows/android-build.yml` to trigger on new git tags (e.g. `v1.0.0`) and automatically create a **GitHub Release**, uploading the compiled APK to the release assets.
- **Download Link Integration:** Link the **"تحميل لأندرويد"** button on the website landing page directly to:
  `https://github.com/mom056/taskflow/releases/latest/download/app-release.apk`
  This URL automatically downloads the newest APK from the latest release without any manual file replacement needed on Supabase or the website.

### 🔄 8. In-App Update Checker (مكتشف التحديثات الذكي داخل التطبيق)

- **Behavior:** On app startup, query the GitHub Releases API (`https://api.github.com/repos/mom056/taskflow/releases/latest`) to fetch the latest published version tag.
- **Version Check:** Compare it with the local app version (e.g., `v1.0.0` defined in `package.json` or config).
- **UI Alert:** If a newer version exists, show a non-blocking modal inside the app: _"يتوفر إصدار جديد من التطبيق (vX.Y.Z). قم بالتحديث الآن للاستفادة من أحدث التحسينات"_ with a button to download the APK.

---

## Proposed Changes File by File

### 1. Database & Migrations

#### [NEW] [delete_own_user_rpc.sql](file:///d:/CP+/taskflow/supabase/migrations/20260628130000_delete_own_user_rpc.sql)

- Write the secure PostgreSQL function:

```sql
CREATE OR REPLACE FUNCTION public.delete_own_user()
RETURNS VOID AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 2. Design System & Global Styles

#### [MODIFY] [index.css](file:///d:/CP+/taskflow/src/index.css)

- Define CSS Variables for branding:
  ```css
  :root {
    --brand-blue: #2563eb;
    --brand-cyan: #06b6d4;
    --brand-green: #10b981;
  }
  ```
- Add utility keyframes and classes:
  - `@keyframes pulse-geofence`: Pulsing green glow shadow animation.
  - `.geofence-glow`: Class applying the pulsing glow shadow.
  - `.status-edge-new`, `.status-edge-in_progress`, `.status-edge-completed`, `.status-edge-pending`: Coloured border highlights.
  - `.workday-path-line`: Styles for linking chronological task nodes.

---

### 3. Shared Components & Workflows

#### [MODIFY] [TasksTable.tsx](file:///d:/CP+/taskflow/src/components/TasksTable.tsx)

- Upgrade component structure to support responsive presentation:
  - **Desktop (md and up):** Renders clean data columns with quick navigation buttons.
  - **Mobile (below md):** Transforms into **Action-First Cards** with touch swipe triggers.
- Link location coordinates to open navigation instantly via `openExternalUrl`.

#### [MODIFY] [android-build.yml](file:///d:/CP+/taskflow/.github/workflows/android-build.yml)

- Update triggers to support release tagging: `on: push: tags: 'v*.*.*'` and `workflow_dispatch`.
- Add a job step to build release-ready APK and use `softprops/action-gh-release@v2` to upload the build to a GitHub Release automatically.

---

### 4. Page Routes & Dashboards

#### [MODIFY] [EmployeeDashboard.tsx](file:///d:/CP+/taskflow/src/pages/EmployeeDashboard.tsx)

- Redesign layout:
  - Remove the 4 bulky KPI grid cards.
  - Render the **Visual Workday Path** at the top.
  - Add a **Segmented Control Bar** for filtering Active/Completed with inline task counts.
- Add proximity calculation logic using the Haversine formula:
  - Compute distance dynamically between user's current GPS location and task coordinates.
  - Add a "Sort by Proximity" toggle button.
- Integrate the swipe gesture listeners on task card items.
- Integrate the `PermissionGuideModal` which triggers on location failure or notification block.
- Add an automatic version check against GitHub API on mount. If a newer tag is found, render the custom Update Alert banner/modal.

#### [MODIFY] [ManagerDashboard.tsx](file:///d:/CP+/taskflow/src/pages/ManagerDashboard.tsx)

- Redesign filter panel into a Segmented Control bar.
- Link the tasks list view to use the updated responsive `TasksTable`.

#### [MODIFY] [ProfileSettings.tsx](file:///d:/CP+/taskflow/src/pages/ProfileSettings.tsx)

- Add a new "حذف الحساب" (Delete Account) section at the bottom.
- Show a prominent confirmation warning modal.
- On confirm, trigger `supabase.rpc('delete_own_user')`, show a success toast, and invoke `signOut()` to redirect to the login page.

#### [MODIFY] [LandingPage.tsx](file:///d:/CP+/taskflow/src/pages/LandingPage.tsx)

- Add a visual **"تحميل التطبيق" (Download App)** call-to-action block.
- Provide a direct download button linking to the latest GitHub Release APK.
- Display a micro-instruction text beneath the Android download button showing how to bypass the "Unknown Sources" warning (تنبيه تثبيت مصادر غير معروفة).
- Display a **QR Code** on desktop viewports so users can quickly scan with their phones to download the APK.
- Provide step-by-step PWA iOS installation guide instructions for Safari "Add to Home Screen".

---

## Verification Plan

### Automated Tests

- Run `npm run lint` to ensure TypeScript compilation and style properties compile cleanly.
- Run `npm run cap:build` to confirm the production distribution builds and synchronizes successfully.

### Manual Verification

1. **Swipe Actions:** Emulate mobile viewports in Chrome DevTools to swipe left and right on task cards, verifying status transitions and upload prompts.
2. **GPS Proximity:** Temporarily overwrite coordinates in the geolocation handler to match a task location, confirming that the card starts glowing green and displays the "Arrived" button.
3. **Permission Guide:** Mock location permission rejection and verify that `PermissionGuideModal` opens with helpful instructions.
4. **Account Deletion:** Create a temporary test account, navigate to Profile Settings, click "Delete Account", confirm the action, and verify the user is logged out and the user record is deleted in Supabase.
5. **App Download Link:** Test clicking the download APK button on the Landing Page and ensure it routes to the correct GitHub release URL.
6. **In-App Update:** Mock a lower local version value in code and verify the app displays the "Update Available" modal with the correct tag name from GitHub.

# Detailed Implementation Plan - TaskFlow Production Hardening & Signature UI (Updated)

This plan outlines the precise steps and code changes required to refactor TaskFlow into a production-grade, highly-functional, mobile-optimized, and brand-distinctive application (Signature UI).

All updates are designed to be future-proof (DRY, decoupling styling from layouts, using existing database schemas) and compliant with mobile app store policies.

---

## 💎 Approved Signature Features & UX Upgrades

### 🗺️ 1. Proximity-Based Sorting ("الأقرب إليّ")

- **Behavior:** The employee dashboard retrieves coordinates using `useGeoLocation`.
- **UI Display:** Each active task card displays its distance from the employee (e.g., `"تبعد 1.2 كم"` or `"على بعد 300 متر"`).
- **Proximity Sorting:** A sorting toggle will be added to the dashboard to order active tasks by proximity (nearest first), helping field agents plan their travel.

### 📈 2. Visual Workday Path (خط مسار اليوم التفاعلي)

- **Behavior:** A visual dotted horizontal path showing the sequence of active tasks for the day (Task 1 ➔ Task 2 ➔ Task 3).
- **UI:** Clicking a node in this path highlights/scrolls to the task card. Completed tasks display as checked green nodes.

### ☝️ 3. Mobile Swipe Gestures (إيماءات السحب للمهام)

- **Behavior:** Standard touch gesture listeners (`onTouchStart`, `onTouchMove`, `onTouchEnd`) on mobile cards.
- **Swipe Right:** Instantly marks a task as `in_progress` with tactile feedback (`triggerHaptic('light')`).
- **Swipe Left:** Instantly opens the Camera/Notes upload overlay (to Complete).

### 🔔 4. Geofence Arrival Glow (الاستشعار الجغرافي للوصول)

- **Behavior:** Checks the distance between the employee and the active task coordinates.
- **UI:** If distance < 100m, the card border glows in pulsing green with a prominent "لقد وصلت! تسجيل الدخول" (Arrived! Check-in) button.

### 🛡️ 5. Smart Permission & Installation Guides (مرشد تفعيل الصلاحيات وتثبيت التطبيق)

- **Behavior:** Prevents silent errors when GPS or Notifications are disabled or blocked at the OS/Browser level, and guides users through manual installation processes.
- **Solution:**
  - Create a custom **`PermissionGuideModal`** component.
  - **Native Mobile Push Notifications:** If permission is denied, show a guide showing iOS/Android users how to re-enable them in settings, with a button to open settings directly.
  - **Native Mobile GPS:** If GPS is disabled in quick toggles, display a visual guide to activate location services.
  - **Web Browser Geolocation:** Display step-by-step visual instructions to click the secure lock icon in the browser URL bar and set Location to "Allow".
  - **Web Notifications Soft-Prompt:** Use an in-app banner for notifications to prevent automatic browser blocking.
  - **Android APK Security Bypass Instructions:** Provide clear instructions on the landing page and within the app under download links explaining how to toggle "Allow from this source" when the OS displays the "Unknown Sources" security prompt.

### 🛑 6. Apple Store Account Deletion Compliance (حذف الحساب)

- **Database Function:** Add a Postgres function `public.delete_own_user()` with `SECURITY DEFINER` that deletes the user from `auth.users` when called, triggering database cascades.
- **UI Button:** In `ProfileSettings.tsx`, add a red "حذف الحساب" (Delete Account) section with a confirmation modal. Once confirmed, it invokes the RPC and calls `signOut()`.

### 🤖 7. GitHub Automated Build & Release (الأتمتة عبر GitHub Releases)

- **Behavior:** Compile Android APK automatically in GitHub Actions on Vercel/Release trigger.
- **Release Automation:** Modify `.github/workflows/android-build.yml` to trigger on new git tags (e.g. `v1.0.0`) and automatically create a **GitHub Release**, uploading the compiled APK to the release assets.
- **Download Link Integration:** Link the **"تحميل لأندرويد"** button on the website landing page directly to:
  `https://github.com/mom056/taskflow/releases/latest/download/app-release.apk`
  This URL automatically downloads the newest APK from the latest release without any manual file replacement needed on Supabase or the website.

### 🔄 8. In-App Update Checker (مكتشف التحديثات الذكي داخل التطبيق)

- **Behavior:** On app startup, query the GitHub Releases API (`https://api.github.com/repos/mom056/taskflow/releases/latest`) to fetch the latest published version tag.
- **Version Check:** Compare it with the local app version (e.g., `v1.0.0` defined in `package.json` or config).
- **UI Alert:** If a newer version exists, show a non-blocking modal inside the app: _"يتوفر إصدار جديد من التطبيق (vX.Y.Z). قم بالتحديث الآن للاستفادة من أحدث التحسينات"_ with a button to download the APK.

---

## Proposed Changes File by File

### 1. Database & Migrations

#### [NEW] [delete_own_user_rpc.sql](file:///d:/CP+/taskflow/supabase/migrations/20260628130000_delete_own_user_rpc.sql)

- Write the secure PostgreSQL function:

```sql
CREATE OR REPLACE FUNCTION public.delete_own_user()
RETURNS VOID AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 2. Design System & Global Styles

#### [MODIFY] [index.css](file:///d:/CP+/taskflow/src/index.css)

- Define CSS Variables for branding:
  ```css
  :root {
    --brand-blue: #2563eb;
    --brand-cyan: #06b6d4;
    --brand-green: #10b981;
  }
  ```
- Add utility keyframes and classes:
  - `@keyframes pulse-geofence`: Pulsing green glow shadow animation.
  - `.geofence-glow`: Class applying the pulsing glow shadow.
  - `.status-edge-new`, `.status-edge-in_progress`, `.status-edge-completed`, `.status-edge-pending`: Coloured border highlights.
  - `.workday-path-line`: Styles for linking chronological task nodes.

---

### 3. Shared Components & Workflows

#### [MODIFY] [TasksTable.tsx](file:///d:/CP+/taskflow/src/components/TasksTable.tsx)

- Upgrade component structure to support responsive presentation:
  - **Desktop (md and up):** Renders clean data columns with quick navigation buttons.
  - **Mobile (below md):** Transforms into **Action-First Cards** with touch swipe triggers.
- Link location coordinates to open navigation instantly via `openExternalUrl`.

#### [MODIFY] [android-build.yml](file:///d:/CP+/taskflow/.github/workflows/android-build.yml)

- Update triggers to support release tagging: `on: push: tags: 'v*.*.*'` and `workflow_dispatch`.
- Add a job step to build release-ready APK and use `softprops/action-gh-release@v2` to upload the build to a GitHub Release automatically.

---

### 4. Page Routes & Dashboards

#### [MODIFY] [EmployeeDashboard.tsx](file:///d:/CP+/taskflow/src/pages/EmployeeDashboard.tsx)

- Redesign layout:
  - Remove the 4 bulky KPI grid cards.
  - Render the **Visual Workday Path** at the top.
  - Add a **Segmented Control Bar** for filtering Active/Completed with inline task counts.
- Add proximity calculation logic using the Haversine formula:
  - Compute distance dynamically between user's current GPS location and task coordinates.
  - Add a "Sort by Proximity" toggle button.
- Integrate the swipe gesture listeners on task card items.
- Integrate the `PermissionGuideModal` which triggers on location failure or notification block.
- Add an automatic version check against GitHub API on mount. If a newer tag is found, render the custom Update Alert banner/modal.

#### [MODIFY] [ManagerDashboard.tsx](file:///d:/CP+/taskflow/src/pages/ManagerDashboard.tsx)

- Redesign filter panel into a Segmented Control bar.
- Link the tasks list view to use the updated responsive `TasksTable`.

#### [MODIFY] [ProfileSettings.tsx](file:///d:/CP+/taskflow/src/pages/ProfileSettings.tsx)

- Add a new "حذف الحساب" (Delete Account) section at the bottom.
- Show a prominent confirmation warning modal.
- On confirm, trigger `supabase.rpc('delete_own_user')`, show a success toast, and invoke `signOut()` to redirect to the login page.

#### [MODIFY] [LandingPage.tsx](file:///d:/CP+/taskflow/src/pages/LandingPage.tsx)

- Add a visual **"تحميل التطبيق" (Download App)** call-to-action block.
- Provide a direct download button linking to the latest GitHub Release APK.
- Display a micro-instruction text beneath the Android download button showing how to bypass the "Unknown Sources" warning (تنبيه تثبيت مصادر غير معروفة).
- Display a **QR Code** on desktop viewports so users can quickly scan with their phones to download the APK.
- Provide step-by-step PWA iOS installation guide instructions for Safari "Add to Home Screen".

---

## Verification Plan

### Automated Tests

- Run `npm run lint` to ensure TypeScript compilation and style properties compile cleanly.
- Run `npm run cap:build` to confirm the production distribution builds and synchronizes successfully.

### Manual Verification

1. **Swipe Actions:** Emulate mobile viewports in Chrome DevTools to swipe left and right on task cards, verifying status transitions and upload prompts.
2. **GPS Proximity:** Temporarily overwrite coordinates in the geolocation handler to match a task location, confirming that the card starts glowing green and displays the "Arrived" button.
3. **Permission Guide:** Mock location permission rejection and verify that `PermissionGuideModal` opens with helpful instructions.
4. **Account Deletion:** Create a temporary test account, navigate to Profile Settings, click "Delete Account", confirm the action, and verify the user is logged out and the user record is deleted in Supabase.
5. **App Download Link:** Test clicking the download APK button on the Landing Page and ensure it routes to the correct GitHub release URL.
6. **In-App Update:** Mock a lower local version value in code and verify the app displays the "Update Available" modal with the correct tag name from GitHub.
