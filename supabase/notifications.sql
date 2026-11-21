-- =====================================================================
--  Students IS Platform — الإشعارات + حدّ استخدام المساعد الذكي
--  شغّل هذا الملف مرة واحدة بعد schema.sql:
--  Supabase > SQL Editor > New query > Run   (آمن للتكرار)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) جدول الإشعارات
--    الإدراج يتم فقط من Edge Functions (service_role) — الطالب يقرأ إشعاراته فقط.
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null default 'info',          -- مثال: file_approved
  title_ar   text not null,
  title_en   text not null,
  body_ar    text,
  body_en    text,
  link       text,                                  -- مسار داخل المنصة مثل /subject/calculus/Lectures/
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- الطالب يقرأ إشعاراته فقط
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

-- الطالب يستطيع تعليم إشعاراته كمقروءة فقط (لا يغيّر شيئاً آخر)
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- الطالب يحذف إشعاراته
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- منع تعديل أي عمود غير "read" من المتصفح
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;

-- (اختياري) إشعارات لحظية بدون إعادة تحميل: فعّل Realtime للجدول
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 2) حدّ استخدام المساعد الذكي (يمنع استنزاف رصيد الـ API)
-- ---------------------------------------------------------------------
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default (now() at time zone 'utc')::date,
  count   int  not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
-- لا سياسات = لا أحد من المتصفح يقرأ/يكتب. الدالة أدناه فقط (service_role).

-- تزيد العدّاد وتُرجع true إن كان المستخدم ما زال ضمن الحد اليومي
create or replace function public.bump_ai_usage(p_user uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c int;
begin
  insert into public.ai_usage (user_id, day, count)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into c;
  return c <= p_limit;
end;
$$;

revoke all on function public.bump_ai_usage(uuid, int) from public, anon, authenticated;
grant execute on function public.bump_ai_usage(uuid, int) to service_role;
