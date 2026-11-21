-- =====================================================================
--  Students IS Platform — إعداد الطلاب والأدمن في Supabase
--  شغّل هذا الملف كاملاً: Supabase > SQL Editor > New query > Run  (آمن للتكرار)
--  ترقية من v1.1: شغّله مرة أخرى كما هو، فيطبّق سياسات v1.2 الجديدة.
--  ⚠️ شغّله قبل نشر النسخة الجديدة، وقبل أن يسجّل أي طالب.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) جدول الملفات الشخصية (الاسم + الدور: student / admin)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  role       text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- دالة التحقق من الأدمن (security definer كي لا تحصل حلقة في سياسات RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- الطالب يرى ملفه فقط، والأدمن يرى الجميع (للبحث عن الطلاب)
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- الأدمن فقط يعدّل الملفات الشخصية (مثلاً لمنح صلاحية أدمن). الطالب لا يستطيع تعديل دوره.
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- إنشاء ملف شخصي تلقائياً عند تسجيل أي طالب جديد
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- إنشاء ملفات شخصية للحسابات الموجودة مسبقاً (ومنها حساب الأدمن الحالي)
insert into public.profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2) 👑 اجعل حساب الأدمن الحالي أدمن  (غيّر البريد قبل التشغيل!)
-- ---------------------------------------------------------------------
update public.profiles
set role = 'admin'
where email = 'ADMIN_EMAIL_HERE';

-- ---------------------------------------------------------------------
-- 3) جدول الملفات المرفوعة (submissions): من يقرأ ومن يعدّل
--    (v1.2) path يحفظ "مسار الملف داخل التخزين" وليس رابطاً كاملاً:
--      - ملف بانتظار الموافقة: داخل bucket الخاص pending-uploads بالشكل  <user_id>/<وقت>_<اسم>
--      - ملف معتمد: داخل bucket العام Twix بالشكل  approved/<...>
--    الصفوف القديمة التي تحمل رابطاً كاملاً (https://...) ما زالت تعمل.
-- ---------------------------------------------------------------------
create table if not exists public.submissions (
  id         bigint generated always as identity primary key,
  subject    text not null,
  material   text not null,
  name       text not null,
  path       text not null,
  approved   boolean not null default false,
  user_id    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.submissions enable row level security;
alter table public.submissions add column if not exists user_id uuid default auth.uid();

-- الطلاب المسجّلون فقط يرون الملفات المعتمدة (المنصة كلها تتطلب الدخول)
drop policy if exists "submissions_read_approved" on public.submissions;
create policy "submissions_read_approved" on public.submissions
  for select to authenticated
  using (approved = true);

-- الطالب يرى ملفاته هو حتى قبل الموافقة (للمساعد وحالة "ملفاتي")
drop policy if exists "submissions_read_own" on public.submissions;
create policy "submissions_read_own" on public.submissions
  for select to authenticated
  using (user_id = auth.uid());

-- الطالب المسجّل يرفع ملفاً بحالة "غير معتمد" فقط، باسمه هو فقط، وإلى مجلده هو فقط.
-- هذا يمنع: الرفع باسم طالب آخر، ووضع روابط خارجية أو javascript: بدل مسار الملف.
drop policy if exists "submissions_insert_pending" on public.submissions;
create policy "submissions_insert_pending" on public.submissions
  for insert to authenticated
  with check (
    approved = false
    and user_id = auth.uid()
    and path like auth.uid()::text || '/%'
    and path !~ '(\.\.|//|:)'
    and char_length(path) <= 300
    and char_length(name) between 1 and 120
    and char_length(subject) <= 120
    and material in ('Lectures', 'Exams')
  );

-- الأدمن فقط: يرى كل شيء، يوافق، يحذف
drop policy if exists "submissions_admin_all" on public.submissions;
create policy "submissions_admin_all" on public.submissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 4) التخزين (Storage)
--    - pending-uploads: bucket خاص (غير عام) لملفات الطلاب قبل الموافقة.
--      لا يراها إلا الأدمن عبر روابط موقّتة، مع حد للحجم والأنواع المسموحة.
--    - Twix: bucket العام للملفات المعتمدة. الطلاب لا يرفعون إليه مباشرة بعد الآن.
--    غيّر 'Twix' إذا كان اسم الـ bucket العام مختلفاً.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pending-uploads', 'pending-uploads', false, 26214400,  -- 25 ميجابايت
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- (قديم) كان يسمح للطلاب بالرفع إلى Twix/pending العام — أُلغي في v1.2
drop policy if exists "twix_upload_pending" on storage.objects;

-- الطالب يرفع إلى مجلده فقط داخل pending-uploads
drop policy if exists "pending_upload_own" on storage.objects;
create policy "pending_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pending-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

-- الطالب يحذف ملفه من الانتظار (يُستخدم لتنظيف الملف إن فشل تسجيله في الجدول)
drop policy if exists "pending_delete_own" on storage.objects;
create policy "pending_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pending-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

-- الأدمن يقرأ ويحذف ملفات الانتظار (للمعاينة والرفض والنقل)
drop policy if exists "pending_admin_read" on storage.objects;
create policy "pending_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'pending-uploads' and public.is_admin());

drop policy if exists "pending_admin_delete" on storage.objects;
create policy "pending_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pending-uploads' and public.is_admin());

-- الأدمن ينقل الملف المعتمد إلى Twix/approved (الطريق الاحتياطي إن لم تكن الدالة منشورة)
drop policy if exists "twix_admin_insert" on storage.objects;
create policy "twix_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'Twix' and public.is_admin());

drop policy if exists "twix_admin_delete" on storage.objects;
create policy "twix_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'Twix' and public.is_admin());

-- ---------------------------------------------------------------------
-- 5) ⚠️ مراجعة مهمة بعد التشغيل
-- الصفحة القديمة كانت تعتبر أي مستخدم مسجّل دخول أدمن. إذا كانت عندك سياسات قديمة
-- على submissions أو storage.objects تسمح لـ "authenticated" بالتعديل أو الحذف،
-- فسيستطيع أي طالب مسجّل استخدامها! شغّل هذا الاستعلام لرؤية كل السياسات:
--
--   select schemaname, tablename, policyname, cmd, roles, qual
--   from pg_policies
--   where tablename in ('submissions', 'objects', 'profiles')
--   order by tablename, policyname;
--
-- واحذف أي سياسة قديمة (غير التي أنشأها هذا الملف) تسمح لـ authenticated
-- بـ update أو delete على submissions، أو delete على storage.objects:
--   drop policy "اسم_السياسة_القديمة" on public.submissions;
-- ---------------------------------------------------------------------
