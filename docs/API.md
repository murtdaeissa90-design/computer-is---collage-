# الـ API الخاص بالمنصة (Supabase Edge Functions)

الـ Edge Functions هي أكواد تعمل على **سيرفر Supabase** وليس في المتصفح، لذلك تستطيع أن تفعل أشياء حقيقية
لا يجوز أن يفعلها المتصفح: إرسال إشعار، إرسال بريد، استدعاء الذكاء الاصطناعي بمفتاح سري.

| الدالة | الملف | تفعل ماذا |
|---|---|---|
| `approve-submission` | `supabase/functions/approve-submission/index.ts` | الأدمن يوافق على ملف ← تُدرج إشعاراً للطالب (🔔) وتُرسل بريداً إن فُعّل |
| `student-assistant` | `supabase/functions/student-assistant/index.ts` | المساعد الذكي للطلاب (شات 🤖) |
| (مشترك) | `supabase/functions/_shared/common.ts` | CORS، التحقق من المستخدم، التحقق من الأدمن |
| (مولَّد) | `supabase/functions/_shared/catalog.json` | نسخة من المواد والملفات والأسئلة للمساعد (يُولَّد من `src/data/`) |

> **وضع المساعد:** افتراضياً مساعد مبسّط مجاني داخل المتصفح (`src/lib/localAssistant.js`). لتفعيل مساعد Claude: انشر `student-assistant` وضع مفتاح Anthropic، ثم أضف في Netlify المتغير `NEXT_PUBLIC_ASSISTANT_MODE=ai` وأعد النشر.
> **للنشر من محرر Supabase مباشرة:** استخدم الملف المجمّع `supabase/dashboard/approve-submission.ts` (ملف واحد) وسمّ الدالة `approve-submission`.

## التركيب خطوة بخطوة

### 1) جداول الإشعارات
في Supabase ← **SQL Editor** شغّل الملف `supabase/notifications.sql` (بعد `schema.sql`). آمن للتكرار.

### 2) تثبيت Supabase CLI وربط المشروع
```bash
npm install -g supabase            # أو: npx supabase ...
supabase login
supabase link --project-ref jetxkhyvcxuxvheastlr
```
(الرمز `jetxkhyvcxuxvheastlr` هو الجزء الأول من رابط مشروعك `https://jetxkhyvcxuxvheastlr.supabase.co`.)

> إن طلب منك CLI مجلد `supabase/config.toml` شغّل `supabase init` مرة واحدة داخل مجلد المشروع (لن يحذف ملفاتك).

### 3) الأسرار (Secrets)
```bash
# إلزامي للمساعد الذكي (مفتاح Anthropic من console.anthropic.com)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# اختياري
supabase secrets set ANTHROPIC_MODEL=claude-haiku-5-5    # الأرخص والأسرع (الافتراضي)
supabase secrets set AI_DAILY_LIMIT=40                   # رسائل لكل طالب يومياً
supabase secrets set ALLOWED_ORIGIN=https://computer-is-collage.netlify.app

# اختياري: إرسال بريد عند الموافقة (حساب مجاني على resend.com)
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set MAIL_FROM="Students IS <noreply@yourdomain.com>"
```
`SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` يضيفهما Supabase للدوال تلقائياً — **لا تضعهما في الكود أبداً**.

> ⚠️ بدون نطاق (domain) موثّق في Resend لا يرسل البريد إلا إلى بريد حسابك أنت. الإشعار داخل المنصة 🔔 يعمل دائماً بدون أي إعداد.

### 4) النشر
```bash
supabase functions deploy approve-submission --no-verify-jwt
supabase functions deploy student-assistant --no-verify-jwt
```
نستخدم `--no-verify-jwt` لأن الدالتين تتحققان من التوكن بنفسهما داخل الكود (`getUser`)، وهذا يتجنب مشكلة بوابة Supabase مع مفاتيح `sb_publishable_`. أي طلب بلا توكن صحيح يُرفض بـ 401 من الدالة نفسها.

أعد النشر بعد أي تعديل على كود الدالة. وإذا عدّلت `src/data/` (مواد/ملفات/أسئلة):
```bash
node scripts/build-catalog.mjs
supabase functions deploy student-assistant --no-verify-jwt
```

### بديل: النشر من الهاتف (بدون حاسوب)
1. Supabase ← **Edge Functions ← Secrets**: أضف `ANTHROPIC_API_KEY`.
2. افتح supabase.com/dashboard/account/tokens ← **Generate new token** وانسخه.
3. GitHub ← المستودع ← **Settings ← Secrets and variables ← Actions ← New repository secret**، وأضف:
   - `SUPABASE_ACCESS_TOKEN` = التوكن السابق
   - `SUPABASE_PROJECT_REF` = `jetxkhyvcxuxvheastlr`
4. عند رفع الكود (الذي فيه `.github/workflows/deploy-functions.yml`) تُنشر الدالتان تلقائياً. تابع من تبويب **Actions**، ويمكن تشغيله يدوياً بـ **Run workflow**.

### 5) جرّب
- ارفع ملفاً كطالب ← ادخل كأدمن ووافق عليه ← افتح حساب الطالب: يظهر 🔔 برقم.
- اضغط 🤖 واسأل: «كيف أرفع ملفاً؟» أو «اعرض لي محاضرات Calculus».
- الأخطاء: Supabase ← **Edge Functions** ← اسم الدالة ← **Logs**.

## تفاصيل الطلبات

### `approve-submission`
```
POST /functions/v1/approve-submission
Authorization: Bearer <توكن الأدمن>
{ "submission_id": "123" }
→ { "ok": true, "notified": true, "emailed": false }
```
رموز الأخطاء: `unauthorized` (401) · `forbidden` (403 ليس أدمن) · `not_found` (404) · `bad_json`/`submission_id_required` (400).
الإشعار يُرسل فقط إذا كان الملف مرتبطاً بحساب (`submissions.user_id`)؛ الملفات القديمة المرفوعة قبل الحسابات لا تملك صاحباً.

### `student-assistant`
```
POST /functions/v1/student-assistant
Authorization: Bearer <توكن الطالب>
{ "messages": [{ "role": "user", "content": "كيف أرفع ملفاً؟" }], "lang": "ar" }
→ { "reply": "..." }
```
رموز الأخطاء: `unauthorized` (401) · `daily_limit` (429) · `ai_busy` (503) · `ai_not_configured` (503) · `server_not_ready` (500: لم يُشغَّل notifications.sql).

أدوات المساعد (يقرر Claude متى يستخدمها): `list_files` ملفات مادة · `get_practice_questions` أسئلة مراجعة · `my_uploads` حالة ملفاتي.

## الأمان (مهم)
- **كل دالة تتحقق من هوية المستدعي من التوكن على السيرفر**، ولا تثق بأي معرّف يرسله المتصفح. الأدمن يُتحقق منه من جدول `profiles`.
- مفتاح Anthropic ومفتاح `service_role` يبقيان على السيرفر فقط، ولا يظهران في المتصفح ولا في GitHub.
- المساعد يرى ملفات الطالب نفسه فقط (`my_uploads` يستخدم هوية الطالب من التوكن لا من كلام النموذج).
- حدّ يومي لكل طالب (`AI_DAILY_LIMIT`) يحمي رصيد الـ API، وكل رسالة مقصوصة (2000 حرف) وآخر 12 رسالة فقط تُرسل.
- أسماء الملفات التي يرفعها الطلاب تُعامل كبيانات وليست أوامر (حماية من Prompt Injection)، لكن لا حماية كاملة ضدها، فأبقِ صلاحيات الأدوات للقراءة فقط كما هي.

## كيف تضيف دالة جديدة لاحقاً (للتعلّم)
1. `supabase functions new my-function` ينشئ `supabase/functions/my-function/index.ts`.
2. ابدأ بنفس هيكل `approve-submission`: `preflight` ← `getUser` ← (`isAdmin`) ← تحقق من المدخلات ← نفّذ ← `json(...)`.
3. استدعها من الواجهة بإضافة سطر في `src/lib/api.js` يستخدم `call("my-function", {...})`.
