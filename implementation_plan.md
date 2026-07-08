# 🔒 الخطة التنفيذية التفصيلية الشاملة لتحصين تطبيق TaskFlow أمنياً ومعمارياً

هذه الخطة هي الدمج الشامل والكامل للخطة الخارجية والخطة الداخلية المقترحة. تم ترتيبها حسب **أولوية التنفيذ الفعلية** مع تضمين الكود الجاهز لكل خطوة وطريقة التأكد من سلامة التشغيل.

---

## 📋 ملخص بنود الخطة وأولوياتها

| # | البند | الخطورة | وقت التنفيذ المقدر | الملفات المتأثرة |
|---|------|:---:|:---:|---|
| **0.1** | تدوير سرّ الـ Webhook المسرّب وتأمين الدالة | 🔴 حرج | 15 د | `supabase/migrations/20260706000000_rotate_webhook_secret.sql` |
| **0.2** | إصلاح ثغرة Fail-Open في إرسال الإشعارات | 🔴 حرج | 10 د | `supabase/functions/send-push/index.ts` |
| **1.1** | منع تصعيد باقات الشركات (Mass Assignment) | 🔴 حرج | 30 د | `supabase/migrations/20260706010000_isolate_billing_and_prevent_escalation.sql` |
| **1.2** | عزل مفاتيح وأسرار Stripe الحساسة عن واجهة المستخدم | 🔴 حرج | 45 د | `company_billing` (جديد)، `src/contexts/AuthContext.tsx` |
| **2.1** | التحقق الجغرافي من الحضور على السيرفر (Haversine) | 🟠 متوسط | 60 د | `supabase/migrations/20260706020000_attendance_geofencing_and_security_hardening.sql` |
| **2.2** | منع انتحال حقل `created_by` بالمهام (RLS Policy) | 🟠 متوسط | 20 د | `supabase/migrations/20260706020000_attendance_geofencing_and_security_hardening.sql` |
| **2.3** | تقوية سياسة تعقيد كلمة المرور (10 أحرف كحد أدنى) | 🟠 متوسط | 30 د | `create-user/index.ts`, `Login.tsx`, `ResetPassword.tsx`, `ProfileSettings.tsx` |
| **2.4** | تثبيت مسار البحث `search_path` لدوال SECURITY DEFINER | 🟠 متوسط | 15 د | `supabase/migrations/20260706020000_attendance_geofencing_and_security_hardening.sql` |
| **3.1** | تنظيف بيئة العمل وتحديث ملفات التجاهل | 🟡 منخفض | 10 د | `.gitignore` (تم التنفيذ والرفع بنجاح) |
| **3.2** | حماية خصوصية صور إثبات المهام (Signed URLs) | 🟡 منخفض | 90 د | `task-images` bucket RLS, `src/pages/ManagerDashboard.tsx`, `src/pages/EmployeeDashboard.tsx` |
| **3.3** | تقييم التخزين الآمن لجلسات الهاتف | 🟡 منخفض | تقييم | توثيق `@capacitor/preferences` مقابل التخزين المشفر |
| **3.4** | إعداد حدود الطلبات (Rate Limiting) على الدوال | 🟡 منخفض | 120 د | `create-user/index.ts`, `send-push/index.ts` (باستخدام Upstash) |
| **3.5** | منع التلاعب بحالات المهام والتحقق من تسلسلها | 🟡 منخفض | 45 د | `check_task_update` trigger |
| **3.6** | تحديث التبعيات والوقاية من الثغرات المكتبية | 🟡 منخفض | 30 د | `package.json` (تشغيل `npm audit fix`) |
| **3.7** | إخفاء تسريب إحصائيات عدد المستخدمين الإجمالية | 🟡 منخفض | 15 د | `src/contexts/AuthContext.tsx` |

---

## 🚨 قرارات مطلوبة من المستخدم (User Review Required)

> [!IMPORTANT]
> **خيار الجدار الجغرافي الصارم (Geofencing Enforcement Option):**
> سنقوم بحساب المسافة الفعلية بين إحداثيات الموظف ومقر الشركة على السيرفر مباشرة. تم الاستقرار على:
> * **الخيار أ (تصحيح التسمية تلقائياً - المعتمد):** إذا كان الموظف خارج النطاق الجغرافي، يتم تسجيل العملية بنجاح وتصنيفها تلقائياً كـ `field` (زيارة ميدانية) حتى لو ادعى الموظف أنها حضور مكتبي. (تمت إزالة كود الرفض الصارم الخاص بـ "الخيار ب" بالكامل من الكود البرمجي ليكون التنفيذ مطابقاً تماماً لهذا القرار دون غموض).

---

## 🛠️ تفاصيل التنفيذ التقنية والكود الجاهز

### المرحلة 0: طوارئ فورية (إصلاح التسريبات والـ Webhook)

#### [NEW] 0.1 تدوير مفتاح الـ Webhook وتأمينه
الملف المكتوب: [20260706000000_rotate_webhook_secret.sql](file:///d:/CP+/taskflow/supabase/migrations/20260706000000_rotate_webhook_secret.sql)

السر السابق (تم تسريبه وتدويره) تم تدويره بنجاح. سنقوم بالتالي:
1. توليد سر قوي جديد: `openssl rand -hex 32` (مثال: `9d863f68-7d6f-4c56-9721-7299a9a3b6ef`).
2. تحديث السر في مشروع Supabase باستخدام الأمر التالي:
```bash
npx supabase secrets set WEBHOOK_SECRET=<السر_الجديد> --project-ref bzsmwmkgmropuadpkcku
```
3. تحديث نفس القيمة داخل دالة `notify_new_task()` في قاعدة البيانات عبر migration جديدة (تعديل الـ headers بالقيمة الجديدة مباشرة):
```sql
-- انسخ جسم الدالة notify_new_task() كما هو، وغير فقط سطر الـ headers:
headers := jsonb_build_object(
  'Content-Type', 'application/json',
  'X-Webhook-Secret', '<السر_الجديد_هنا>'
)
```
4. احذف المفتاح القديم المسرّب من جميع ملفات الـ migrations الثلاثة القديمة (`notify_new_task_webhook.sql`, `phase_2_security_fixes.sql`, `20260616120002_phase_2_security_fixes.sql`) واستبدله بتعليق يوضح أن القيمة الفعلية تُدار بشكل منفصل غير مقروء علناً.
5. **الخيار الأفضل والأكثر أماناً على المدى الطويل:** تخزين السر في خزنة Supabase Vault الآمنة واستدعائه ديناميكياً لتجنب أي كتابة ثابتة للمفاتيح في ملفات الهجرة مستقبلاً:
```sql
-- ولّد السر في خزنة Vault
SELECT vault.create_secret('<السر_الجديد>', 'webhook_secret');
```
ثم جلب السر داخل الدالة:
```sql
SELECT decrypted_secret INTO webhook_secret
FROM vault.decrypted_secrets WHERE name = 'webhook_secret';
```
6. **تنظيف تاريخ Git:** بعد تدوير المفاتيح، نوصي بتشغيل `git filter-repo` أو أداة BFG لإزالة المفتاح القديم نهائياً من تاريخ الالتزامات (Commits) على GitHub لحماية المستودع بالكامل.

#### [MODIFY] 0.2 إصلاح fail-open في دالة إرسال الإشعارات
الملف المتأثر: [send-push/index.ts](file:///d:/CP+/taskflow/supabase/functions/send-push/index.ts)

تعديل منطق التحقق ليكون Fail-Closed دائماً:
```typescript
// تعديل التحقق لمنع تمرير الطلبات إذا كان مفتاح البيئة غير مضبوط أو غير متطابق
if (!webhookSecret || incomingSecret !== webhookSecret) {
  console.warn('[send-push] Rejected: missing or invalid webhook secret.');
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

### المرحلة 1: ثغرات حرجة (الباقات وفواتير Stripe)

#### [NEW] 1.1 منع تصعيد باقات الشركات (Mass Assignment)
الملف المكتوب: [20260706010000_isolate_billing_and_prevent_escalation.sql](file:///d:/CP+/taskflow/supabase/migrations/20260706010000_isolate_billing_and_prevent_escalation.sql)

كتابة trigger يجبر أي شركة جديدة يتم تسجيلها من واجهة العميل العادية على الحصول على الباقة المجانية والحد الأقصى (5 موظفين) لضمان عدم قيام المهاجمين بتمرير باقات مدفوعة مجاناً:
```sql
CREATE OR REPLACE FUNCTION public.check_company_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  company_count INT;
BEGIN
  -- السماح للسوبر أدمن أو عمليات الخلفية ذات الصلاحيات العالية (service_role)
  IF auth.role() = 'service_role' OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- استثناء تهيئة النظام عند تثبيت أول شركة في قاعدة البيانات
  SELECT COUNT(*) INTO company_count FROM public.companies;
  IF company_count = 0 THEN
    RETURN NEW;
  END IF;

  -- التعيين الإجباري للباقة المجانية
  NEW.plan := 'free';
  NEW.max_employees := 5;
  NEW.is_active := true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_company_insert_trigger ON public.companies;
CREATE TRIGGER check_company_insert_trigger
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.check_company_insert();

* **اختبار الاستغلال (تأكد إنه ما عاد يشتغل):** سجّل حساب تجريبي من التطبيق، ثم بـ curl:
  ```bash
  curl -X POST 'https://bzsmwmkgmropuadpkcku.supabase.co/rest/v1/companies' \
    -H "apikey: <anon_key>" \
    -H "Authorization: Bearer <access_token_من_الحساب_التجريبي>" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","slug":"test-xyz","plan":"premium","max_employees":999999}'
  ```
  تأكد إن الصف المسجَّل فعلياً بقاعدة البيانات فيه `plan: free` و`max_employees: 5` رغم القيم المرسلة.
* تأكد إن إنشاء شركة بباقة مخصّصة من لوحة السوبر أدمن (SuperAdminDashboard) لسا شغّال عادي.
* تأكد إن أول تسجيل على منصة تجريبية فارغة تماماً لسا يحصل على الباقة الافتراضية الأعلى (استثناء "أول شركة").
```

#### [NEW] 1.2 عزل مفاتيح وأسرار Stripe الحساسة
الملف المكتوب: [20260706010000_isolate_billing_and_prevent_escalation.sql](file:///d:/CP+/taskflow/supabase/migrations/20260706010000_isolate_billing_and_prevent_escalation.sql)

> [!WARNING]
> **تنبيه أمان قاعدة البيانات لقسم الفواتير:**
> هذه الخطوة تقوم بحذف الأعمدة الحساسة نهائياً (`DROP COLUMN`) من جدول `companies` بعد ترحيلها إلى جدول `company_billing` الجديد. **يُوصى بشدة بأخذ نسخة احتياطية كاملة (Database Backup) وتطبيق هذا التعديل على بيئة تجريبية (Staging) أولاً** قبل تطبيقه على بيئة الإنتاج لتجنب أي فقدان للبيانات.

سنقوم بنقل أسرار Stripe من جدول `companies` العام إلى جدول خاص `company_billing` وتفعيل RLS عليه بالكامل دون إنشاء أي سياسة سماح للقراءة من الخارج:
```sql
-- إنشاء جدول الفواتير المعزول
CREATE TABLE IF NOT EXISTS public.company_billing (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_webhook_secret TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- تفعيل RLS بشكل كامل (مغلق افتراضياً أمام الجميع ومسموح فقط لـ service_role)
ALTER TABLE public.company_billing ENABLE ROW LEVEL SECURITY;

-- ترحيل البيانات الحالية من جدول الشركات إلى جدول الفواتير المعزول
INSERT INTO public.company_billing (company_id, stripe_customer_id, stripe_subscription_id, stripe_webhook_secret)
SELECT id, stripe_customer_id, stripe_subscription_id, stripe_webhook_secret
FROM public.companies
WHERE stripe_customer_id IS NOT NULL
   OR stripe_subscription_id IS NOT NULL
   OR stripe_webhook_secret IS NOT NULL
ON CONFLICT (company_id) DO NOTHING;

-- حذف الأعمدة الحساسة من جدول الشركات العام لضمان عدم تسريبها بالخطأ للواجهة الأمامية
ALTER TABLE public.companies DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.companies DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE public.companies DROP COLUMN IF EXISTS stripe_webhook_secret;
```

#### [MODIFY] تعديل جلب بيانات الشركة بالواجهة الأمامية
الملف المتأثر: [AuthContext.tsx](file:///d:/CP+/taskflow/src/contexts/AuthContext.tsx)

تعديل سطر الاستعلام العام لتحديد الأعمدة الصالحة صراحة، لتجنب تسريب أي حقول حساسة جديدة قد تضاف لجدول الشركات مستقبلاً:
```typescript
// استبدال الاستعلام النجمي بجلب الحقول المطلوبة فقط
.select('*, company:companies(id, name, slug, logo_url, plan, max_employees, is_active, hq_latitude, hq_longitude, hq_radius_meters, work_start_time, work_end_time, work_days, stripe_public_key, created_at)')
```

---

### المرحلة 2: متوسطة الخطورة (الحضور، المهام، ومستوى الأمان)

#### [NEW] 2.1 الجدار الجغرافي للحضور وحساب Haversine
الملف المكتوب: [20260706020000_attendance_geofencing_and_security_hardening.sql](file:///d:/CP+/taskflow/supabase/migrations/20260706020000_attendance_geofencing_and_security_hardening.sql)

حساب المسافة ديناميكياً على السيرفر للتحقق من مصداقية الحضور المكتبي:
```sql
CREATE OR REPLACE FUNCTION public.check_attendance_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  comp_start_time TEXT;
  hq_lat DECIMAL; hq_lng DECIMAL; hq_radius INT;
  distance_meters DOUBLE PRECISION;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- التأكد من أن الموظف يسجل لنفسه فقط
  IF NEW.employee_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'غير مسموح بتسجيل حضور موظف آخر';
  END IF;

  -- جلب الشركة الخاصة بالموظف تلقائياً لعدم السماح بالتلاعب بها
  SELECT company_id INTO NEW.company_id FROM public.users WHERE id = auth.uid();

  -- جلب إعدادات الشركة الجغرافية وموعد بدء العمل
  SELECT work_start_time, hq_latitude, hq_longitude, hq_radius_meters
    INTO comp_start_time, hq_lat, hq_lng, hq_radius
    FROM public.companies WHERE id = NEW.company_id;

  -- احتساب حالة التأخير
  IF comp_start_time IS NOT NULL AND NEW.check_in_time IS NOT NULL THEN
    NEW.is_late := (to_timestamp(NEW.check_in_time / 1000.0) AT TIME ZONE 'Asia/Riyadh')::time > comp_start_time::time;
  END IF;

  -- التحقق الجغرافي الفعلي باستخدام معادلة Haversine
  IF hq_lat IS NOT NULL AND hq_lng IS NOT NULL THEN
    IF NEW.check_in_lat IS NULL OR NEW.check_in_lng IS NULL THEN
      NEW.check_in_type := 'field';
    ELSE
      distance_meters := 6371000 * 2 * asin(sqrt(
        power(sin(radians((NEW.check_in_lat - hq_lat) / 2)), 2) +
        cos(radians(hq_lat)) * cos(radians(NEW.check_in_lat)) *
        power(sin(radians((NEW.check_in_lng - hq_lng) / 2)), 2)
      ));
      
      -- الخيار أ: تصحيح نوع الحضور بناءً على المسافة الفعلية
      NEW.check_in_type := CASE WHEN distance_meters <= COALESCE(hq_radius, 200) THEN 'office' ELSE 'field' END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

#### [NEW] 2.2 منع انتحال منشئ المهمة `created_by`
تعديل سياسة الإدخال بجدول المهام لربط `created_by` بـ `auth.uid()` الحقيقي للضيف بدلاً من الثقة بما يرسله العميل:
```sql
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
CREATE POLICY "tasks_insert_policy" ON public.tasks
  FOR INSERT WITH CHECK (
    is_super_admin() OR (
      company_id = get_my_company_id()
      AND created_by = auth.uid()
      AND (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'manager')
        OR employee_id = auth.uid()
      )
    )
  );
```

#### [NEW] 2.3 تشديد مسارات البحث `search_path` للدوال الحساسة
إغلاق ثغرة mutable search_path بتثبيته على `public, pg_temp` لجميع دوال `SECURITY DEFINER` المكتوبة:
```sql
ALTER FUNCTION public.get_my_company_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_super_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_count() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_user_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_user_insert() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_employee_limit() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_task_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_company_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_attendance_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_own_user() SET search_path = public, pg_temp;
```

#### [MODIFY] 2.4 تقوية طول كلمة المرور (10 أحرف على الأقل)
* الملف المتأثر: [create-user/index.ts](file:///d:/CP+/taskflow/supabase/functions/create-user/index.ts)
  * تحديث التحقق من طول كلمة المرور في دالة التسجيل والتحديث ليكون 10 أحرف.
* الملفات المتأثرة بالفرونت إند: [Login.tsx](file:///d:/CP+/taskflow/src/pages/Login.tsx), [ResetPassword.tsx](file:///d:/CP+/taskflow/src/pages/ResetPassword.tsx), [ProfileSettings.tsx](file:///d:/CP+/taskflow/src/pages/ProfileSettings.tsx)
  * في `Login.tsx` و `ResetPassword.tsx`: استبدال `password.length < 6` بالفحص الجديد `password.length < 10` وتعديل التنبيهات المرتبطة به.
  * في `ProfileSettings.tsx`: تعديل الفحص في موقعين (ملاحظة: قد تختلف أرقام الأسطر قليلاً حسب التعديلات الموضعية السابقة، لذا يُرجى البحث عن النصوص البرمجية مباشرة بدلاً من الاعتماد على أرقام الأسطر الثابتة):
    1. **تغيير كلمة المرور الشخصية للمدير/الموظف (ابحث عن `newPassword.length < 6`):** تعديل الفحص ليصبح `newPassword.length < 10` وتحديث رسالة التنبيه باللغتين العربية والإنجليزية.
    2. **تسجيل موظف جديد من قبل المدير (ابحث عن `newEmpPassword.length < 6`):** تعديل الفحص ليصبح `newEmpPassword.length < 10` وتحديث رسالة التنبيه باللغتين العربية والإنجليزية.
* **تعديل لوحة التحكم بـ Supabase:** الانتقال إلى قسم Authentication -> Policies وتفعيل Leaked Password Protection.

---

### المرحلة 3: تحسينات وإضافات (أمان متقدم)

#### 3.1 تنظيف بيئة العمل (تم إنجازها)
* تم إضافة `scratch/` لملف `.gitignore` وحذف الملفات المؤقتة محلياً ودفعها بنجاح للفرع الرئيسي.

#### 3.2 تأمين خصوصية صور المهام (Private Buckets)
* إغلاق الباقة وحذف سياسة القراءة العامة المفتوحة بالكامل لحظر الوصول العشوائي للصور، وتثبيت السياسة المقيّدة بالشركة:
```sql
-- تحويل باقة صور المهام لتصبح خاصة
UPDATE storage.buckets SET public = false WHERE id = 'task-images';

-- حذف سياسة الوصول العام القديمة المفتوحة بالكامل لمنع الالتفاف
DROP POLICY IF EXISTS "Task Images Public Read Access" ON storage.objects;

-- إنشاء سياسة الفحص المقيدة بـ RLS المعتمدة على الشركة المالكة للمهمة
CREATE POLICY "Task Images Read Access" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-images' AND (
      is_super_admin() OR
      EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id::text = (storage.foldername(name))[1]
        AND t.company_id = get_my_company_id()
      )
    )
  );
```

* استبدال الروابط المباشرة للصور بالفرونت إند بروابط موقعة مؤقتة `createSignedUrl` قبل عرضها:
  ```ts
  const { data } = await supabase.storage.from('task-images').createSignedUrl(path, 3600);
  ```
* **تنبيه هام:** هذا يتطلب مسحاً شاملاً لكل مكان بالكود يعرض `image_url` (لوحة الموظف، لوحة المدير، أي تقرير PDF) وتعديله للتعامل مع الروابط الموقعة، لذا يجب تخصيص وقت كافٍ له.

#### 3.3 تقييم التخزين الآمن لجلسات الهاتف
* مراجعة نص الـ README الذي يذكر "حفظ الجلسات بشكل مشفر محلياً" — إمّا أن يتم تعديل النص ليطابق الواقع (حيث أن `@capacitor/preferences` تخزن النصوص بشكل عادي غير مشفّر تقنياً)، أو يتم البحث عن حل تخزين آمن حقيقي (يعتمد على Android Keystore / iOS Keychain) إذا كانت دقة التوثيق أو الامتثال (compliance) ضرورية، خصوصاً مع ميزة الدخول بالبصمة.

#### 3.4 إعداد حدود الطلبات (Rate Limiting) على الـ Edge Functions
* التسجيل في Upstash للحصول على Redis Instance مجاني لتنفيذ تحديد الطلبات على مستوى الدوال.
* استيراد الحزم `@upstash/ratelimit` و `@upstash/redis` باستخدام استيراد Deno بأعلى ملفي `create-user/index.ts` و `send-push/index.ts`.
* تطبيق حد معقول، مثلاً 10 طلبات بالدقيقة لكل مستخدم (`auth.uid()`) على دالة `create-user`.
* مراجعة إعدادات حدود الطلبات الافتراضية لقنوات المصادقة الأساسية عبر لوحة تحكم Supabase في **Authentication → Rate Limits** لضمان تطابقها مع حجم الاستخدام المتوقع.

#### 3.5 التحقق من تسلسل حالات المهمة لمنع التلاعب
إضافة التحقق من الحالات المسموحة داخل دالة `check_task_update` قبل السماح بالتعديل:
```sql
IF OLD.status IS DISTINCT FROM NEW.status THEN
  IF NOT (
    public.is_super_admin() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'manager') OR
    (OLD.status = 'new' AND NEW.status IN ('in_progress', 'pending')) OR
    (OLD.status = 'in_progress' AND NEW.status IN ('completed', 'pending')) OR
    (OLD.status = 'pending' AND NEW.status IN ('new', 'in_progress'))
  ) THEN
    RAISE EXCEPTION 'انتقال حالة غير مسموح: % → %', OLD.status, NEW.status;
  END IF;
END IF;
```

> [!IMPORTANT]
> **تنبيه:** يرجى مراجعة هذا الجدول الانتقالي جيداً قبل التطبيق النهائي للتأكد من توافقه تماماً مع دورة العمل الفعلية لديكم (على سبيل المثال: هل يُسمح للمدير بإرجاع مهمة مكتملة `completed` إلى قيد الانتظار `pending` لمراجعتها؟). يجب اختبار كافة هذه الانتقالات يدوياً بعد تفعيلها للتأكد من عدم تعطل أي جزء من التطبيق.

#### 3.6 تحديث التبعيات والوقاية من الثغرات المكتبية
* تشغيل الأمر `npm audit fix` وتدقيق إصدارات الحزم وبخاصة الحزم الحساسة للتأكد من خلو المشروع من ثغرات المكتبات الخارجية.

#### 3.7 إخفاء تسريب إحصائيات عدد المستخدمين
* إزالة دالة `get_user_count` واستدعائها عبر `supabase.rpc('get_user_count')` من ملف `AuthContext.tsx` والفرونت إند بالكامل.
* التأكد من أن منطق "هل هذا هو المستخدم الأول بالمنصة؟" يتم احتسابه بالكامل داخل السيرفر في trigger الإدخال لجدول المستخدمين `check_user_insert` (وهي دالة ذات صلاحية `SECURITY DEFINER` ولا تعرض أرقام المستخدمين أبداً لجانب العميل)، بدلاً من اعتماد الواجهة الأمامية على الاستعلام المباشر عن أعداد المسجلين بالمنصة لتحديد الصلاحية الافتراضية.

---

## 📋 خطة التحقق والتدقيق (Verification Plan)

### الاختبارات التلقائية
1. تشغيل مدقق الأنواع: `npx tsc --noEmit`.
2. تجربة بناء الحزمة المحلية: `npm run build`.

### الاختبارات اليدوية
1. **الـ Webhook:** إرسال طلب لـ `send-push` بدون المفتاح السري الجديد، والتحقق من رفضه بـ 401. وأيضاً بنسخة تجريبية، احذف مؤقتاً secret الـ `WEBHOOK_SECRET` وتأكد أن الطلبات بدون الهيدر ترجع 401 وليس 200 (تحقق Fail-Closed).
2. **عزل Stripe:** تسجيل دخول مستخدم عادي ومحاولة استعلام جدول `company_billing` للتحقق من أن RLS يمنعه ويعيد قائمة فارغة أو خطأ.
3. **تجاوز الباقة (Mass Assignment):** محاولة إنشاء شركة جديدة بباقة `premium` عبر استدعاء الـ API المباشر للـ REST (باستخدام أمر الـ `curl` الموثق بالبند 1.1) والتحقق من أن السيرفر يجبر الحقول على الباقة الافتراضية `free` والحد الأقصى 5 موظفين.
4. **تثبيت المسار والكلمات السرية:** اختبار شاشات التسجيل وتغيير كلمات السر بكلمات قصيرة والتأكد من رفضها.
5. **اختبار تسلسل الحالات:** محاولة تعديل حالة مهمة من `new` إلى `completed` مباشرة والتأكد من رفضها.
6. **منع انتحال منشئ المهمة:** محاولة إدخال مهمة جديدة بوضع `created_by` مختلف عن آي دي المستخدم الحالي عبر استعلام API مباشر، والتأكد من قيام RLS برفض العملية وإرجاع خطأ.
