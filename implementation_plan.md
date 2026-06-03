# تحويل TaskFlow إلى منصة متعددة الشركات (Multi-Tenant SaaS)

تحويل التطبيق من نظام خاص بشركة واحدة إلى **منصة SaaS** تستضيف عدداً غير محدود من الشركات مع عزل تام للبيانات والأمان.

---

## User Review Required

> [!IMPORTANT]
> هذا التحول هو أكبر تعديل هيكلي منذ بداية المشروع. سيتم تعديل **كل جدول في قاعدة البيانات** وتعديل **كل ملف كود تقريباً** في المشروع. يرجى مراجعة الخطة بعناية قبل الموافقة على التنفيذ.

> [!WARNING]
> **البيانات الحالية:** إذا كان لديك بيانات حقيقية (موظفين ومهام) في قاعدة البيانات الحالية، سنحتاج لربطهم بشركة افتراضية أثناء الترحيل. سيتم الحفاظ على جميع البيانات الموجودة.

---

## الأسلوب المعماري المختار

**Shared Database, Shared Schema with `company_id` Isolation**

هذا الأسلوب يعني أن جميع الشركات تتشارك نفس قاعدة البيانات ونفس الجداول، لكن كل صف بيانات مرتبط بـ `company_id` فريد. العزل يتم عبر:

1. **PostgreSQL RLS (Row Level Security):** يُفرض على مستوى قاعدة البيانات - يستحيل على أي مستخدم الوصول لبيانات شركة أخرى حتى لو حدث خطأ في كود الفرونت إند.
2. **دالة مساعدة `get_my_company_id()`:** دالة SQL تُرجع `company_id` الخاص بالمستخدم الحالي وتُستخدم في كل سياسة أمان.

### لماذا هذا الأسلوب وليس غيره؟

| الأسلوب                              | المزايا                                   | العيوب                          | القرار       |
| ------------------------------------ | ----------------------------------------- | ------------------------------- | ------------ |
| **قاعدة بيانات منفصلة لكل شركة**     | عزل كامل                                  | تكلفة عالية جداً، صعوبة الإدارة | ❌ مرفوض     |
| **Schema منفصل لكل شركة**            | عزل جيد                                   | تعقيد في الترحيل والصيانة       | ❌ مرفوض     |
| **`company_id` في جدول مشترك + RLS** | تكلفة منخفضة، سهولة الإدارة، أمان عبر RLS | يتطلب سياسات RLS دقيقة          | ✅ **مختار** |

---

## Proposed Changes

### المرحلة الأولى: تعديل قاعدة البيانات (Database Schema Migration)

---

#### [MODIFY] [supabase_schema.sql](file:///d:/CP+/taskflow/supabase_schema.sql)

**1. إنشاء جدول الشركات الجديد (`companies`) وجدول الباقات (`subscription_plans`):**

```sql
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,           -- معرف فريد للشركة في الرابط
  logo_url TEXT,                       -- شعار الشركة
  plan TEXT NOT NULL DEFAULT 'free',   -- الباقة: free, pro, enterprise
  max_employees INT NOT NULL DEFAULT 5,-- الحد الأقصى حسب الباقة
  created_at BIGINT NOT NULL,
  is_active BOOLEAN DEFAULT true       -- لتعطيل الشركات عند الحاجة
);
```

**2. إضافة عمود `company_id` لجميع الجداول الرئيسية:**

```sql
-- جدول المستخدمين
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- جدول المهام
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- جدول الزيارات
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- جدول اشتراكات الإشعارات
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
```

**3. إنشاء دالة مساعدة `get_my_company_id()` لتُستخدم في جميع سياسات الأمان:**

```sql
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

**4. إعادة كتابة كل سياسات الأمان (RLS Policies) بالكامل:**

كل سياسة ستُضاف إليها شرط `company_id = get_my_company_id()` لضمان العزل التام. مثال:

```sql
-- المستخدمون: يرون فقط مستخدمي شركتهم
CREATE POLICY "users_tenant_isolation" ON public.users
  FOR SELECT USING (company_id = get_my_company_id());

-- المهام: المدير يرى مهام شركته فقط، الموظف يرى مهامه فقط
CREATE POLICY "tasks_tenant_isolation" ON public.tasks
  FOR SELECT USING (
    company_id = get_my_company_id()
    AND (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
      OR employee_id = auth.uid()
    )
  );
```

**5. ترحيل البيانات الحالية (Data Migration):**

```sql
-- إنشاء شركة افتراضية للبيانات الحالية
INSERT INTO public.companies (id, name, slug, created_at)
VALUES (gen_random_uuid(), 'الشركة الافتراضية', 'default', extract(epoch from now()) * 1000);

-- ربط جميع المستخدمين الحاليين بالشركة الافتراضية
UPDATE public.users SET company_id = (SELECT id FROM public.companies WHERE slug = 'default');
UPDATE public.tasks SET company_id = (SELECT id FROM public.companies WHERE slug = 'default');
UPDATE public.visits SET company_id = (SELECT id FROM public.companies WHERE slug = 'default');
```

**6. فرض القيد NOT NULL بعد الترحيل:**

```sql
ALTER TABLE public.users ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.visits ALTER COLUMN company_id SET NOT NULL;
```

**7. إنشاء فهارس (Indexes) لتسريع الاستعلامات:**

```sql
CREATE INDEX IF NOT EXISTS idx_users_company ON public.users(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_visits_company ON public.visits(company_id);
```

---

### المرحلة الثانية: تعديل الأنواع وسياق المصادقة (Types & Auth Context)

---

#### [MODIFY] [types.ts](file:///d:/CP+/taskflow/src/types.ts)

إضافة `companyId` لجميع الواجهات وإضافة واجهات جديدة:

```diff
 export interface User {
   id: string;
   name: string;
   email: string;
-  role: 'manager' | 'employee';
+  role: 'manager' | 'employee' | 'super_admin';
   createdAt: number;
   avatarUrl?: string;
+  companyId: string;
 }

+export interface Company {
+  id: string;
+  name: string;
+  slug: string;
+  logoUrl?: string;
+  plan: 'free' | 'pro' | 'enterprise';
+  maxEmployees: number;
+  createdAt: number;
+  isActive: boolean;
+}

 export interface Task {
   ...
+  companyId: string;
 }

 export interface Visit {
   ...
+  companyId: string;
 }
```

---

#### [MODIFY] [AuthContext.tsx](file:///d:/CP+/taskflow/src/contexts/AuthContext.tsx)

تعديلات رئيسية:

1. إضافة `company_id` و `company` إلى واجهة `UserProfile`.
2. تعديل `fetchOrCreateProfile()` لجلب بيانات الشركة عند تسجيل الدخول.
3. تعديل منطق إنشاء حساب أول مستخدم: بدلاً من إنشاء مستخدم فقط، سيتم أيضاً إنشاء **شركة جديدة** وربط المستخدم بها كـ `manager`.
4. تمرير `company` و `companyId` عبر الـ Context لجميع المكونات.

```diff
 interface UserProfile {
   id: string;
   name: string;
   email: string;
   role: Role;
   created_at: number;
   avatar_url?: string;
+  company_id: string;
 }

 interface AuthContextType {
   user: User | null;
   userRole: Role;
   profile: UserProfile | null;
+  company: Company | null;
   loading: boolean;
   signOut: () => Promise<void>;
   refreshRole: () => Promise<void>;
 }
```

---

### المرحلة الثالثة: تعديل الخطافات (Hooks)

---

#### [MODIFY] [useUsers.ts](file:///d:/CP+/taskflow/src/hooks/useUsers.ts)

إضافة `companyId` لـ mapping الخارجي. لا حاجة لفلترة يدوية بالكود لأن الـ RLS ستتكفل بالعزل تلقائياً على مستوى قاعدة البيانات.

#### [MODIFY] [useTasks.ts](file:///d:/CP+/taskflow/src/hooks/useTasks.ts)

إضافة `companyId` لـ mapping الخارجي.

#### [MODIFY] [useVisits.ts](file:///d:/CP+/taskflow/src/hooks/useVisits.ts)

إضافة `companyId` لـ mapping الخارجي.

---

### المرحلة الرابعة: تعديل المكونات والصفحات (Components & Pages)

---

#### [MODIFY] [TaskModal.tsx](file:///d:/CP+/taskflow/src/components/TaskModal.tsx)

عند إنشاء مهمة جديدة (INSERT)، إضافة `company_id` من الـ AuthContext:

```diff
 const { error } = await supabase.from('tasks').insert([{
   ...
   created_by: currentUserId,
+  company_id: companyId,
   ...
 }]);
```

#### [MODIFY] [ManagerDashboard.tsx](file:///d:/CP+/taskflow/src/pages/ManagerDashboard.tsx)

- تعديل الشريط الجانبي لعرض **اسم الشركة وشعارها** بدلاً من "TaskFlow" الثابت.
- تمرير `companyId` عند إنشاء المهام والزيارات.

#### [MODIFY] [EmployeeDashboard.tsx](file:///d:/CP+/taskflow/src/pages/EmployeeDashboard.tsx)

- تمرير `company_id` عند إنشاء الزيارات الميدانية.
- عرض اسم الشركة في الشريط العلوي.

#### [MODIFY] [Login.tsx](file:///d:/CP+/taskflow/src/pages/Login.tsx)

تعديل تدفق التسجيل الذاتي:

- عند تسجيل أول مستخدم (الذي يصبح مديراً): يتم إنشاء شركة جديدة تلقائياً.
- إضافة حقل **"اسم الشركة"** في نموذج التسجيل (يظهر فقط عند إنشاء حساب جديد).

#### [MODIFY] [ProfileSettings.tsx](file:///d:/CP+/taskflow/src/pages/ProfileSettings.tsx)

- إضافة قسم **"إعدادات المؤسسة"** للمدير: تعديل اسم الشركة، رفع شعار المؤسسة، عرض حالة الباقة والحدود.
- تعديل دالة تسجيل الموظفين لتمرير `company_id` في طلب الـ Edge Function.
- التحقق من حد الموظفين المسموح قبل التسجيل.

---

### المرحلة الخامسة: لوحة المشرف العام وإدارة الاشتراكات (Super Admin & Subscriptions)

---

#### [NEW] [SuperAdminDashboard.tsx](file:///d:/CP+/taskflow/src/pages/SuperAdminDashboard.tsx)

صفحة كاملة خاصة بمالك المنصة (`role = 'super_admin'`) تتضمن:

- **جدول الشركات:** قائمة بجميع الشركات مع (الاسم، عدد الموظفين، الباقة، الحالة: نشطة/معطلة).
- **أزرار التحكم:** تفعيل/تعطيل أي شركة بضغطة زر.
- **تعديل الباقة:** ترقية أو تخفيض باقة أي شركة (free → pro → enterprise) مع تعديل الحد الأقصى للموظفين.
- **إحصائيات المنصة (KPIs):** إجمالي الشركات، إجمالي المستخدمين النشطين، إجمالي المهام المنجزة عبر كل المنصة.

#### [MODIFY] [App.tsx](file:///d:/CP+/taskflow/src/App.tsx)

- إضافة مسار محمي جديد `/super-admin` يوجه لـ `SuperAdminDashboard`.
- تعديل `ProtectedRoute` ليدعم دور `super_admin` والتوجيه التلقائي حسب الدور.

#### [MODIFY] [ProtectedRoute.tsx](file:///d:/CP+/taskflow/src/components/ProtectedRoute.tsx)

- إضافة دعم دور `super_admin` في منطق التوجيه:
  - `super_admin` → `/super-admin`
  - `manager` → `/manager`
  - `employee` → `/employee`

---

### المرحلة السادسة: تعديل الدوال السحابية (Edge Functions)

---

#### [MODIFY] [create-user/index.ts](file:///d:/CP+/taskflow/supabase/functions/create-user/index.ts)

تعديل الدالة لتقوم بـ:

1. جلب `company_id` و `max_employees` الخاص بالمدير.
2. التحقق من عدم تجاوز حد الموظفين المسموح في باقة الشركة.
3. إضافة `company_id` عند إدخال سجل الموظف الجديد.

```diff
 const { data: callerProfile } = await supabaseAdmin
   .from('users')
-  .select('role')
+  .select('role, company_id')
   .eq('id', callerUser.id)
   .single();

+// Check employee limit
+const { count } = await supabaseAdmin
+  .from('users')
+  .select('*', { count: 'exact', head: true })
+  .eq('company_id', callerProfile.company_id);
+const { data: company } = await supabaseAdmin
+  .from('companies')
+  .select('max_employees')
+  .eq('id', callerProfile.company_id)
+  .single();
+if (count >= company.max_employees) throw new Error('تم تجاوز الحد الأقصى للموظفين');

 const { error: insertError } = await supabaseAdmin.from('users').insert({
   id: newUserId,
   name, email, role,
+  company_id: callerProfile.company_id,
   created_at: Date.now()
 });
```

#### [MODIFY] [send-push/index.ts](file:///d:/CP+/taskflow/supabase/functions/send-push/index.ts)

لا تحتاج لتعديل جوهري لأنها تعمل بالفعل على أساس `employee_id` المحدد.

---

### المرحلة السابعة: التحقق والرفع (Verification & Deployment)

---

1. **TypeScript Lint:** تشغيل `tsc --noEmit` للتأكد من عدم وجود أخطاء في الأنواع.
2. **Production Build:** تشغيل `npm run build` للتأكد من نجاح عملية البناء.
3. **إعادة نشر دالة `create-user`:** تشغيل `npx supabase functions deploy create-user`.
4. **تنفيذ السكربت المحدّث في Supabase SQL Editor.**
5. **إنشاء حساب Super Admin:** تعيين حسابك الشخصي كـ `super_admin` في قاعدة البيانات.
6. **Commit & Push** لجميع التعديلات إلى GitHub.

---

## Verification Plan

### Automated Tests

```bash
npm run lint     # TypeScript type checking
npm run build    # Production bundle verification
```

### Manual Verification

1. تسجيل دخول كمدير الشركة الافتراضية → التأكد من ظهور بياناته ومهامه الحالية بشكل طبيعي.
2. إنشاء حساب جديد (مدير جديد) → التأكد من إنشاء شركة جديدة تلقائياً وعدم ظهور بيانات الشركة الأولى.
3. إضافة موظف من المدير الجديد → التأكد من ارتباطه بالشركة الصحيحة.
4. إنشاء مهمة من الشركة الثانية → التأكد من عدم ظهورها في لوحة تحكم الشركة الأولى.

---

## ملخص الملفات المتأثرة

| الملف                                     | نوع التعديل                                           | الأولوية |
| ----------------------------------------- | ----------------------------------------------------- | -------- |
| `supabase_schema.sql`                     | تعديل جوهري (جداول جديدة + أعمدة + RLS + super_admin) | 🔴 حرج   |
| `src/types.ts`                            | إضافة واجهات وحقول + Company + super_admin role       | 🔴 حرج   |
| `src/contexts/AuthContext.tsx`            | تعديل جوهري (company context)                         | 🔴 حرج   |
| `src/hooks/useUsers.ts`                   | تعديل بسيط (mapping)                                  | 🟡 متوسط |
| `src/hooks/useTasks.ts`                   | تعديل بسيط (mapping)                                  | 🟡 متوسط |
| `src/hooks/useVisits.ts`                  | تعديل بسيط (mapping)                                  | 🟡 متوسط |
| `src/components/TaskModal.tsx`            | تعديل متوسط (company_id في insert)                    | 🟡 متوسط |
| `src/components/ProtectedRoute.tsx`       | تعديل متوسط (دعم super_admin)                         | 🟡 متوسط |
| `src/pages/Login.tsx`                     | تعديل متوسط (حقل اسم الشركة)                          | 🟡 متوسط |
| `src/pages/ManagerDashboard.tsx`          | تعديل بسيط (عرض اسم الشركة)                           | 🟢 بسيط  |
| `src/pages/EmployeeDashboard.tsx`         | تعديل بسيط (عرض اسم الشركة)                           | 🟢 بسيط  |
| `src/pages/ProfileSettings.tsx`           | تعديل متوسط (إعدادات المؤسسة + حد الباقة)             | 🟡 متوسط |
| **`src/pages/SuperAdminDashboard.tsx`**   | **🆕 صفحة جديدة** (إدارة الشركات والباقات)            | 🔴 حرج   |
| `src/App.tsx`                             | تعديل بسيط (مسار /super-admin)                        | 🟢 بسيط  |
| `supabase/functions/create-user/index.ts` | تعديل متوسط (company_id + حد الباقة)                  | 🟡 متوسط |
