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

# خطة تنفيذية شاملة: نظام الحضور والانصراف والزيارات الميدانية (v2.0.0)

## الهدف العام

تحويل TaskFlow من "نظام إدارة مهام" إلى **"منصة شاملة لإدارة الموارد البشرية والعمل الميداني" (HR & Field Force Management SaaS)** عبر إضافة:

1. نظام الحضور والانصراف المقيد جغرافياً
2. نظام الزيارات الميدانية المستقل
3. نظام طلبات الأذونات والإجازات
4. لوحة تحليلات ساعات العمل والإنتاجية
5. تحليلات المواقع الجغرافية الأكثر نشاطاً

---

## المرحلة 1: قاعدة البيانات والجداول الجديدة

### 1.1 تعديل جدول الشركات `companies`

إضافة حقول إحداثيات المقر وإعدادات الدوام:

```sql
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS hq_latitude DECIMAL(10, 8);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS hq_longitude DECIMAL(11, 8);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS hq_radius_meters INT DEFAULT 200;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS work_start_time TEXT DEFAULT '08:00';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS work_end_time TEXT DEFAULT '17:00';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS work_days TEXT[] DEFAULT ARRAY['Sun','Mon','Tue','Wed','Thu'];
```

**التأثير:** لا يوجد تأثير سلبي — إضافة أعمدة اختيارية فقط. الكود الحالي لا يقرأ هذه الحقول.

### 1.2 جدول الحضور والانصراف `attendance` [جديد]

```sql
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  check_in_time BIGINT NOT NULL,
  check_in_lat DECIMAL(10, 8),
  check_in_lng DECIMAL(11, 8),
  check_in_type TEXT DEFAULT 'office', -- 'office' | 'field' | 'remote'
  check_out_time BIGINT,
  check_out_lat DECIMAL(10, 8),
  check_out_lng DECIMAL(11, 8),
  total_hours DECIMAL(5, 2),
  notes TEXT,
  is_late BOOLEAN DEFAULT false,
  created_at BIGINT NOT NULL
);
```

### 1.3 توسيع جدول الزيارات `visits`

```sql
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS visit_type TEXT DEFAULT 'client_visit';
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS duration_minutes INT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS check_in_time BIGINT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS check_out_time BIGINT;
```

**التأثير:** الكود الحالي في `useVisits.ts` يقرأ `SELECT *` — الحقول الجديدة ستكون `null` للسجلات القديمة ولن تسبب أي خطأ.

### 1.4 جدول طلبات الأذونات والإجازات `leave_requests` [جديد]

```sql
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL DEFAULT 'excuse', -- 'excuse' | 'sick' | 'annual' | 'emergency'
  reason TEXT NOT NULL,
  start_date BIGINT NOT NULL,
  end_date BIGINT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at BIGINT,
  review_note TEXT,
  created_at BIGINT NOT NULL
);
```

### 1.5 سياسات RLS للجداول الجديدة

- **attendance**: الموظف يقرأ سجلاته فقط ويُدرج لنفسه فقط. المدير يقرأ كل سجلات شركته.
- **leave_requests**: الموظف يُدرج ويقرأ طلباته. المدير يقرأ ويُحدّث (قبول/رفض) طلبات شركته.
- **visits**: تحديث السياسة الحالية لدعم الحقول الجديدة.

### 1.6 Triggers أمنية

- **attendance_insert_trigger**: يمنع الموظف من تسجيل حضور باسم موظف آخر (`employee_id = auth.uid()`).
- **attendance_checkout_trigger**: يحسب `total_hours` و `is_late` تلقائياً عند تسجيل الانصراف.

---

## المرحلة 2: أنواع TypeScript والـ Hooks الجديدة

### 2.1 تحديث `src/types.ts`

إضافة الواجهات (Interfaces) التالية:

- `Attendance` — لنظام الحضور والانصراف
- `LeaveRequest` — لطلبات الأذونات والإجازات
- توسيع واجهة `Visit` بالحقول الجديدة
- توسيع واجهة `Company` بحقول المقر وإعدادات الدوام

### 2.2 Hooks جديدة

| الملف                      | الوظيفة                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `useAttendance.ts`         | جلب/إدراج سجلات الحضور والانصراف، حساب حالة اليوم                                  |
| `useLeaveRequests.ts`      | جلب/إدراج/تحديث طلبات الأذونات                                                     |
| تحديث `useVisits.ts`       | دعم الحقول الجديدة (الإحداثيات، اسم العميل، الصور)                                 |
| تحديث `useOfflineQueue.ts` | إضافة أنواع `check_in`, `check_out`, `create_visit` للمزامنة أثناء انقطاع الإنترنت |

**التأثير:** لا يوجد تأثير على الكود الحالي — كل الإضافات هي ملفات جديدة أو توسعات متوافقة.

---

## المرحلة 3: واجهة الموظف (Employee Dashboard)

### 3.1 بطاقة الحضور اليومي (أعلى الشاشة)

بطاقة عريضة مميزة بألوان متدرجة تعرض:

- **قبل التحضير:** زر "تسجيل حضور" كبير مع أيقونة ⏰ وتحقق GPS تلقائي
- **أثناء الدوام:** عداد زمني حي (Live Timer) يعرض ساعات العمل المنقضية + زر "تسجيل انصراف"
- **بعد الانصراف:** ملخص اليوم (وقت الحضور، الانصراف، إجمالي الساعات)

### 3.2 التحقق الجغرافي (Geofenced Check-in)

- عند الضغط على "تسجيل حضور"، يتم جلب إحداثيات الموظف.
- مقارنة المسافة بـ `hq_latitude/hq_longitude` + `hq_radius_meters` من جدول الشركة.
- إذا كان داخل النطاق ← تسجيل كـ `office`.
- إذا كان خارج النطاق ← تسجيل كـ `field` مع تنبيه.

### 3.3 تبويب الزيارات الميدانية المستقل

إضافة تبويب ثالث في الـ Segmented Control: **"المهام" | "الزيارات" | "المكتملة"**

- تبويب "الزيارات" يعرض زر عائم (FAB) لإضافة زيارة جديدة.
- نموذج الزيارة: اسم العميل/الجهة، الملاحظات، التقاط صورة إثبات، تسجيل الإحداثيات تلقائياً.

### 3.4 طلب إذن/إجازة سريعة

زر صغير في بطاقة الحضور اليومي: **"طلب إذن"**

- نموذج سريع: نوع الطلب (إذن ساعات / مرضي / سنوي / طارئ)، السبب، التاريخ.
- يُرسل إشعار فوري للمدير.

**التأثير:** تعديل `EmployeeDashboard.tsx` (1351 سطراً). سنضيف المكونات كـ Components منفصلة ونستوردها، مما يقلل التأثير على الكود الحالي.

---

## المرحلة 4: واجهة المدير (Manager Dashboard)

### 4.1 تبويب "الحضور والانصراف"

إضافة تبويب جديد في شريط التنقل: **"الحضور"**

- جدول يومي يعرض: اسم الموظف، وقت الحضور، وقت الانصراف، إجمالي الساعات، حالة التأخير.
- فلتر حسب التاريخ (يوم/أسبوع/شهر).
- مؤشرات ملونة: 🟢 حاضر في الوقت | 🟡 متأخر | 🔴 غائب | 🔵 في إذن.

### 4.2 تبويب "طلبات الأذونات"

- قائمة بطلبات الموظفين المعلقة مع أزرار **قبول ✅ / رفض ❌**.
- إشعار فوري للموظف عند الرد على طلبه.

### 4.3 تبويب "الزيارات الميدانية" (محسّن)

تحديث التبويب الموجود حالياً لعرض:

- اسم العميل/الجهة المُزارة.
- الإحداثيات على الخريطة.
- صور الإثبات.
- مدة الزيارة.

### 4.4 إعدادات مقر الشركة والدوام

في صفحة `ProfileSettings.tsx` (قسم إعدادات الشركة):

- حقول إحداثيات المقر مع زر "استخدم موقعي الحالي".
- حقل نطاق السماح بالأمتار (Radius).
- اختيار أيام العمل ووقت البداية والنهاية.

**التأثير:** تعديل `ManagerDashboard.tsx` — إضافة تبويبات جديدة. التبويبات الحالية (overview, tasks, visits, employees, analytics, activity) لن تتأثر.

---

## المرحلة 5: تحليلات الإنتاجية والمواقع

### 5.1 بطاقات KPI جديدة في لوحة المدير

| المؤشر                    | الوصف                                             |
| ------------------------- | ------------------------------------------------- |
| متوسط ساعات العمل اليومية | إجمالي ساعات الحضور ÷ عدد الأيام                  |
| نسبة الالتزام بالمواعيد   | عدد أيام الحضور في الوقت ÷ إجمالي أيام الحضور     |
| أكثر موظف إنتاجية         | الموظف صاحب أكبر عدد مهام مكتملة + أقل تأخير      |
| أكثر المواقع زيارة        | المنطقة/العميل الأكثر تكراراً في الزيارات والمهام |

### 5.2 رسم بياني: ساعات العمل الأسبوعية

مخطط أعمدة (Bar Chart) يعرض ساعات عمل كل موظف خلال الأسبوع/الشهر.

### 5.3 تقرير المواقع الأكثر نشاطاً

جدول مرتب يعرض:

- اسم الموقع/العميل → عدد الزيارات → إجمالي ساعات العمل هناك → عدد المهام المنجزة.
- يساعد الإدارة على تحديد العملاء الأكثر استهلاكاً للموارد.

### 5.4 تصدير التقارير (توسيع `useReportExport`)

توسيع نظام التصدير الحالي ليشمل:

- تقرير الحضور والانصراف (PDF/طباعة).
- تقرير الزيارات الميدانية.
- تقرير ساعات العمل الشهري (للرواتب).

---

## المرحلة 6: المزامنة عند انقطاع الإنترنت

### 6.1 توسيع `useOfflineQueue.ts`

إضافة أنواع العمليات الجديدة:

```typescript
type: "create_task" |
  "update_status" |
  "update_notes" |
  "check_in" |
  "check_out" |
  "create_visit" |
  "create_leave_request";
```

- عند انقطاع الإنترنت، يتم حفظ وقت الجهاز الفعلي + الإحداثيات محلياً.
- عند عودة الاتصال، تتم المزامنة تلقائياً بالترتيب الزمني.

**التأثير:** توسيع الـ `syncQueue` function بإضافة `else if` branches للأنواع الجديدة — لا تأثير على الأنواع الموجودة.

---

## المرحلة 7: الإشعارات الفورية

- إشعار للمدير عند تسجيل حضور/انصراف موظف.
- إشعار للمدير عند تقديم طلب إذن جديد.
- إشعار للموظف عند قبول/رفض طلب الإذن.
- إشعار تذكيري للموظف إذا لم يسجل حضوره خلال 30 دقيقة من بداية الدوام.

---

## المرحلة 8: التحقق والنشر

1. فحص TypeScript: `npx tsc --noEmit`
2. بناء الحزمة الإنتاجية: `npm run build`
3. رفع التحديثات إلى GitHub مع وسم الإصدار `v2.0.0`
4. بناء تطبيقات الهاتف عبر GitHub Actions

---

## ملخص الملفات المتأثرة

### ملفات جديدة

| الملف                                                      | الوظيفة                         |
| ---------------------------------------------------------- | ------------------------------- |
| `supabase/migrations/20260630150000_attendance_system.sql` | هجرة الحضور والزيارات والإجازات |
| `src/hooks/useAttendance.ts`                               | Hook نظام الحضور                |
| `src/hooks/useLeaveRequests.ts`                            | Hook طلبات الأذونات             |
| `src/components/AttendanceCard.tsx`                        | بطاقة الحضور اليومي للموظف      |
| `src/components/VisitModal.tsx`                            | نموذج إضافة زيارة ميدانية       |
| `src/components/LeaveRequestModal.tsx`                     | نموذج طلب إذن/إجازة             |
| `src/components/AttendanceTable.tsx`                       | جدول الحضور في لوحة المدير      |
| `src/components/LeaveRequestsPanel.tsx`                    | لوحة طلبات الأذونات للمدير      |
| `src/components/charts/AttendanceChart.tsx`                | رسم بياني لساعات العمل          |
| `src/components/LocationAnalytics.tsx`                     | تحليلات المواقع الأكثر نشاطاً   |

### ملفات معدّلة

| الملف                             | نوع التعديل                                                  |
| --------------------------------- | ------------------------------------------------------------ |
| `supabase_schema.sql`             | إضافة الجداول والسياسات الجديدة                              |
| `src/types.ts`                    | إضافة واجهات Attendance, LeaveRequest, توسيع Visit و Company |
| `src/hooks/useVisits.ts`          | دعم الحقول الجديدة                                           |
| `src/hooks/useOfflineQueue.ts`    | إضافة أنواع المزامنة الجديدة                                 |
| `src/hooks/useReportExport.ts`    | تقارير الحضور والزيارات                                      |
| `src/pages/EmployeeDashboard.tsx` | بطاقة الحضور + تبويب الزيارات + طلب الإذن                    |
| `src/pages/ManagerDashboard.tsx`  | تبويبات الحضور والطلبات + تحليلات                            |
| `src/pages/ProfileSettings.tsx`   | إعدادات مقر الشركة والدوام                                   |

---

## ترتيب التنفيذ المقترح

| الترتيب | المرحلة                        | التقدير الزمني |
| ------- | ------------------------------ | -------------- |
| 1       | قاعدة البيانات (المرحلة 1)     | جلسة واحدة     |
| 2       | الأنواع والـ Hooks (المرحلة 2) | جلسة واحدة     |
| 3       | واجهة الموظف (المرحلة 3)       | جلستان         |
| 4       | واجهة المدير (المرحلة 4)       | جلستان         |
| 5       | التحليلات (المرحلة 5)          | جلسة واحدة     |
| 6       | المزامنة Offline (المرحلة 6)   | جلسة واحدة     |
| 7       | الإشعارات (المرحلة 7)          | جلسة واحدة     |
| 8       | التحقق والنشر (المرحلة 8)      | جلسة واحدة     |

---

## Open Questions

> [!IMPORTANT]
>
> 1. هل تريد أن يكون تسجيل الحضور **إجبارياً** قبل بدء أي مهمة؟ (أي لا يستطيع الموظف بدء مهمة إلا بعد تسجيل حضوره)
> 2. هل تريد تحديد عدد أيام الإجازات السنوية المسموحة لكل موظف في النظام؟
> 3. هل تريد إضافة خيار "العمل عن بُعد" (Remote) كنوع ثالث للحضور؟

# Landing Page Redesign — Corrected Plan

Complete redesign of the Landing Page to reflect Phase 10 features and eliminate the generic AI-template aesthetic, while maintaining **strict brand consistency** with the rest of the application.

---

## Critical Design Corrections (vs. Previous Plan)

> [!WARNING]
> The previous plan had 3 architectural flaws that would have caused brand inconsistency and maintenance burden. All three are corrected below.

| Issue             | Previous Plan (Wrong)                                  | Corrected Plan                                                                                     |
| ----------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **Typography**    | Switch to Almarai for Landing only                     | Keep **Tajawal** globally (it's already the app's unified font in `index.css`)                     |
| **Color Palette** | Switch to Mint/Cyan (green-dominant)                   | Keep **Blue (#2563eb)** as primary brand color, but refine usage to feel premium and human-crafted |
| **Simulators**    | Complex interactive state machines (GPS, offline, PDF) | Beautiful **static visual mockups** with simple CSS hover/transition effects only                  |

---

## Design Philosophy: "Handcrafted, Not Generated"

### What makes a page look "AI-generated":

1. ❌ Perfectly symmetrical 3-column grids with identical card sizes
2. ❌ Overuse of gradient text (`bg-clip-text text-transparent`)
3. ❌ Neon-glow borders and excessive `animate-pulse`
4. ❌ Generic emoji-heavy section headers
5. ❌ Dot-grid background patterns

### What makes a page look "Custom premium":

1. ✅ **Asymmetric Bento Grid** — Cards of different sizes creating visual hierarchy
2. ✅ **Refined typography** — Mix of font weights (300/400/700/800) with generous letter-spacing
3. ✅ **Restrained color** — One accent color used sparingly, large areas of neutral white space or dark slate
4. ✅ **Real product screenshots or high-fidelity static mockups** — Not animated simulations
5. ✅ **Clean borders** — Ultra-thin `1px` borders with `slate-200/30` opacity, no glows
6. ✅ **Subtle motion** — Only `hover:translate-y` and `transition-all duration-300`, no pulsing/pinging

---

## Proposed Changes

### Component 1: Global Typography Refinement

#### [MODIFY] [index.css](file:///d:/CP+/taskflow/src/index.css)

- Import additional Tajawal weights (300 light, 800 extra-bold) for typographic variety
- Add a `.landing-heading` utility class using `font-weight: 800; letter-spacing: -0.025em` for premium headline feel
- Add `.landing-body` with `font-weight: 400; line-height: 1.75` for readable body text

---

### Component 2: Landing Page Complete Rewrite

#### [MODIFY] [LandingPage.tsx](file:///d:/CP+/taskflow/src/pages/LandingPage.tsx)

**Section 1 — Hero (Asymmetric Layout):**

- Left/Right split (not centered text block)
- Left side: Bold headline + subtitle + 2 CTA buttons (stacked vertically on mobile)
- Right side: A floating, slightly rotated product screenshot/mockup of the Manager Dashboard
- Background: Clean solid `bg-slate-950` — NO dot grids, NO radial gradients, NO blur orbs
- Subtle trust indicators below CTAs: "100+ شركة تستخدم TaskFlow" with small avatar stack

**Section 2 — Bento Grid Features (Asymmetric):**

- 2×3 grid with varying cell sizes:
  - **Cell A (span-2 wide):** GPS Geofence Attendance — Shows a static mockup of an employee checking in with coordinates displayed and "✓ داخل النطاق الجغرافي" badge
  - **Cell B (span-1):** Offline Mode — Shows a static phone mockup with a "لا يوجد اتصال" banner and queued items count
  - **Cell C (span-1):** Photo Verification — Shows a camera viewfinder frame with a timestamp overlay
  - **Cell D (span-2 wide):** PDF Report Export — Shows a static print-preview of a beautifully formatted Arabic report with Cairo font, company header, and tabular data
- Each cell has a clean border, subtle background tint matching the feature color, and a hover scale effect

**Section 3 — How It Works (Horizontal Timeline):**

- Clean 4-step horizontal timeline with numbered circles connected by lines
- Steps: تكليف → وصول GPS → توثيق بالصور → تقرير PDF
- Minimal icons, clean text, no emoji

**Section 4 — Manager vs Employee Views:**

- Side-by-side static mockups:
  - Left: Desktop browser frame showing Manager Dashboard with attendance table, charts, and export buttons
  - Right: Mobile phone frame showing Employee app with check-in card, visit log, and leave request button
- Clean browser/phone bezels with realistic proportions

**Section 5 — Download App Section:**

- Keep the existing platform tabs (Android APK / iOS PWA) with QR code
- Restyle tab buttons to use solid fills instead of glow borders
- Simplify step instructions

**Section 6 — CTA Section:**

- Full-width solid blue banner (`bg-blue-600`) — NO gradients
- Clean white text, 2 buttons (primary white, secondary outlined)

**Section 7 — Footer:**

- Minimal footer with copyright and version number

---

### Component 3: Translation Updates

#### [MODIFY] [ar.ts](file:///d:/CP+/taskflow/src/locales/ar.ts)

- Update `landing.subtitle` to a more professional tagline
- Add new keys for Bento Grid cell titles and descriptions

#### [MODIFY] [en.ts](file:///d:/CP+/taskflow/src/locales/en.ts)

- Mirror Arabic translation updates

---

### Component 4: Theme & Color Contrast Tweaks

#### [MODIFY] [index.css](file:///d:/CP+/taskflow/src/index.css)

- Add `.bg-white-forced` and `.text-slate-900-forced` utility classes to bypass the global `.dark` color-override styles for components that must remain high-contrast.
- Clean up scrollbar theme rules to adapt smoothly to dark and light background states.

#### [MODIFY] [LandingPage.tsx](file:///d:/CP+/taskflow/src/pages/LandingPage.tsx)

- Wrap the QR Code container with `style={{ backgroundColor: '#ffffff' }}` or `.bg-white-forced` to ensure it is always 100% white and easily scannable on all devices.
- Hardcode the Landing Page UI elements to static Slate colors to shield them from getting messed up by the global `.dark` classes when logged out.

#### [MODIFY] [WeeklyPerformanceChart.tsx](file:///d:/CP+/taskflow/src/components/charts/WeeklyPerformanceChart.tsx) (and other Recharts instances)

- Apply adaptive text colors to Recharts `<XAxis />`, `<YAxis />`, and `<Tooltip />` labels to ensure absolute readability when switching between light and dark themes.

---

## Verification Plan

### Manual Verification

1. Open Landing Page on **desktop** (1440px) → verify Bento Grid renders asymmetrically
2. Open on **mobile** (375px) → verify all cells stack properly in single column
3. Navigate from Landing → Login → Dashboard → verify **font and color consistency** across all transitions
4. Verify Arabic RTL layout renders correctly with proper text alignment
5. Test the APK download link on the Download section

# 🔄 خطة ترقية تجربة الهاتف — Employee Mobile Premium UX

## المشكلة

بعد مراجعة شاملة لكود التطبيق، التجربة الحالية **تعمل وظيفياً** لكنها لا تشعر المستخدم أنه يستخدم تطبيق هاتف احترافي. التطبيق يشبه موقع ويب مفتوح على الهاتف أكثر من كونه تطبيق Native.

---

## 🔍 المشاكل المكتشفة من مراجعة الكود

### 1. `AttendanceCard.tsx` — بطاقة تسجيل الحضور

> [!CAUTION]
> **كل النصوص مكتوبة بالعربية فقط بشكل ثابت (hardcoded)**، بينما التطبيق يدعم العربية والإنجليزية. هذا خلل معماري.

| المشكلة                         | التفاصيل                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| ❌ لا يدعم تبديل اللغة          | النصوص مثل `"تحضير الدوام اليومي"`, `"غير محضر"`, `"تسجيل حضور العمل"` كلها hardcoded بالعربية |
| ❌ لا يستخدم `useTranslation()` | الـ component لا يستقبل أي language context                                                    |
| ❌ حقل الملاحظات ظاهر دائماً    | الـ textarea يأخذ مساحة حتى لو المستخدم لن يكتب ملاحظة                                         |
| ❌ لا يعرض الوقت الحالي         | قبل تسجيل الحضور لا يُظهر الساعة الحالية                                                       |
| ❌ نص المسافة بالعربي فقط       | `"تبعد X متر عن مقر العمل"`                                                                    |

### 2. `EmployeeDashboard.tsx` — الشاشة الرئيسية

| المشكلة                             | التفاصيل                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------ |
| ❌ لا يوجد ترحيب                    | التطبيقات الاحترافية تُرحّب بالمستخدم: "صباح الخير, أحمد"                |
| ❌ لا يوجد ملخص يومي                | لا يوجد عرض سريع لـ "أنجزت 3 من 7 مهام اليوم"                            |
| ❌ العنوان الرئيسي مكرر             | Header يعرض "مهامي النشطة" والـ Segmented Control أيضاً يعرض "مهام نشطة" |
| ❌ منطقة الأزرار في البطاقات مزدحمة | قسم "تغيير الحالة" به أزرار كثيرة صغيرة في مساحة ضيقة                    |
| ❌ الحالة الفارغة بسيطة جداً        | أيقونة + سطر نص فقط، بدون رسم توضيحي أو CTA                              |

### 3. تجربة عامة

| المشكلة                   | التفاصيل                          |
| ------------------------- | --------------------------------- |
| ❌ لا يوجد تحية زمنية     | صباح الخير / مساء الخير حسب الوقت |
| ❌ لا يوجد شريط تقدم يومي | يفتقر لإحساس الإنجاز والتحفيز     |

---

## ✅ التحسينات المقترحة

### المرحلة 1: AttendanceCard — دعم ثنائي اللغة + تحسين UX

#### [MODIFY] [AttendanceCard.tsx](file:///d:/CP+/taskflow/src/components/AttendanceCard.tsx)

1. **إضافة `useTranslation()`** واستبدال كل النصوص الثابتة بنصوص ديناميكية حسب اللغة
2. **إضافة ساعة حية** قبل تسجيل الحضور (عرض الوقت الحالي بتنسيق كبير أنيق)
3. **إخفاء حقل الملاحظات** افتراضياً وإظهاره بزر "إضافة ملاحظة" صغير
4. **دعم RTL/LTR** في تخطيط العناصر الداخلية

---

### المرحلة 2: EmployeeDashboard — ترحيب + ملخص يومي

#### [MODIFY] [EmployeeDashboard.tsx](file:///d:/CP+/taskflow/src/pages/EmployeeDashboard.tsx)

1. **إضافة قسم ترحيب ذكي** أعلى المحتوى (داخل `activeTab === 'active'`):
   - تحية زمنية: صباح الخير / مساء الخير
   - اسم الموظف
   - تاريخ اليوم

2. **إضافة شريط تقدم يومي** بعد الترحيب:
   - Progress bar دائري أو خطي يعرض نسبة الإنجاز
   - "أنجزت 3 من 7 مهام" بشكل مرئي
   - يحسب من `activeTasks.length` و `completedTasks.length`

3. **تحسين Mobile Header**:
   - عرض التحية بدلاً من "مهامي النشطة" (المكررة مع Segmented Control)
   - إبقاء Subtitle كاسم الشركة فقط

4. **تحسين بطاقات المهام**:
   - تبسيط منطقة الأزرار — إزالة label "تغيير الحالة"
   - جعل الأزرار أكبر وأوضح
   - إضافة أيقونة الحالة الحالية بشكل أبرز

5. **تحسين الحالة الفارغة**:
   - رسالة تحفيزية أوضح
   - زر CTA لإضافة مهمة

---

## Open Questions

> [!IMPORTANT]
>
> 1. هل تريد أن يكون الترحيب يعرض صورة الموظف الشخصية بجانب الاسم في قسم الترحيب؟
> 2. هل تريد شريط التقدم دائري (مثل Apple Watch) أم خطي (Progress Bar عادي)؟
> 3. هل تريد إضافة أصوات أو اهتزازات (Haptic Feedback) عند تسجيل الحضور والانصراف؟

---

## Verification Plan

### Automated Tests

```bash
npx tsc --noEmit          # TypeScript type-check
npm run cap:build         # Capacitor build + sync
```

### Manual Verification

- مراجعة الواجهة بالعربية والإنجليزية للتأكد من عدم وجود نصوص ثابتة
- اختبار تسجيل الحضور في كلتا اللغتين
- التأكد من ظهور قسم الترحيب وشريط التقدم بشكل صحيح
