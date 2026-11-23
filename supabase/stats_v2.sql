-- =====================================================================
--  Students IS Platform — إحصاءات الأدمن v2 (أحدث وأدق)
--  شغّله مرة واحدة: Supabase > SQL Editor > New query > Run  (آمن للتكرار، لا يمسّ البيانات)
--  يتطلب أن stats.sql شُغّل سابقاً (جدول activity_log).
--
--  ما الذي يجعلها أدق؟
--   1) نشاط الأدمن (تجاربك أنت) يُستثنى افتراضياً فلا يشوّه الأرقام.
--   2) حدود الفترة بالتقويم المحلي (توقيت متصفح الأدمن) وليس UTC، فأرقام اليوم تطابق يومك.
--   3) كل الأرقام (الملخص، الرسم اليومي، المواد، الملفات) تُحسب من نفس نافذة الزمن.
--   4) مقارنة مع الفترة السابقة المساوية لها طولاً.
--   5) الأيام الخالية تظهر بصفر في الرسم (لا فجوات).
--  كل الدوال للأدمن فقط: لغير الأدمن ترجع نتيجة فارغة.
-- =====================================================================

-- بداية الفترة بالتوقيت المحلي. p_days <= 0 تعني "كل الوقت". p_back: عدد الفترات للرجوع (1 = الفترة السابقة)
create or replace function public.stats2_start(p_days int, p_tz text, p_back int default 0)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case
    when p_days <= 0 then '-infinity'::timestamptz
    else (
      date_trunc('day', now() at time zone
        (case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'UTC' end))
      - make_interval(days => p_days * (p_back + 1) - 1)
    ) at time zone (case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'UTC' end)
  end;
$$;

-- ملخص: الأرقام الحالية + الفترة السابقة
create or replace function public.stats2_overview(p_days int default 30, p_tz text default 'UTC', p_include_admins boolean default false)
returns table (views bigint, downloads bigint, active_students bigint, total_students bigint,
               prev_views bigint, prev_downloads bigint, prev_active bigint)
language sql
security definer
set search_path = public
stable
as $$
  with a as (
    select l.kind, l.user_id, l.created_at
    from public.activity_log l
    where public.is_admin()
      and (p_include_admins or l.user_id is null
           or not exists (select 1 from public.profiles p where p.id = l.user_id and p.role = 'admin'))
  ),
  cur as (select * from a where created_at >= public.stats2_start(p_days, p_tz)),
  prv as (select * from a where p_days > 0
            and created_at >= public.stats2_start(p_days, p_tz, 1)
            and created_at <  public.stats2_start(p_days, p_tz))
  select
    (select count(*) from cur where kind = 'view'),
    (select count(*) from cur where kind = 'download'),
    (select count(distinct user_id) from cur),
    (select count(*) from public.profiles where role = 'student'),
    (select count(*) from prv where kind = 'view'),
    (select count(*) from prv where kind = 'download'),
    (select count(distinct user_id) from prv)
  where public.is_admin();
$$;

-- رسم يومي: كل يوم في الفترة (بما فيه الأيام الخالية). "كل الوقت" يعرض آخر 90 يوماً.
create or replace function public.stats2_daily(p_days int default 30, p_tz text default 'UTC', p_include_admins boolean default false)
returns table (day date, views bigint, downloads bigint, students bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  tz text := case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'UTC' end;
  n int := case when p_days <= 0 then 90 else least(p_days, 366) end;
  today date := (now() at time zone tz)::date;
begin
  if not public.is_admin() then return; end if;
  return query
  select d::date,
         count(*) filter (where l.kind = 'view'),
         count(*) filter (where l.kind = 'download'),
         count(distinct l.user_id)
  from generate_series((today - (n - 1))::timestamp, today::timestamp, interval '1 day') d
  left join public.activity_log l
    on (l.created_at at time zone tz)::date = d::date
   and (p_include_admins or l.user_id is null
        or not exists (select 1 from public.profiles p where p.id = l.user_id and p.role = 'admin'))
  group by d
  order by d;
end;
$$;

-- حسب المادة
create or replace function public.stats2_subjects(p_days int default 30, p_tz text default 'UTC', p_include_admins boolean default false)
returns table (subject text, views bigint, downloads bigint, visitors bigint)
language sql
security definer
set search_path = public
stable
as $$
  select l.subject,
         count(*) filter (where l.kind = 'view'),
         count(*) filter (where l.kind = 'download'),
         count(distinct l.user_id)
  from public.activity_log l
  where public.is_admin()
    and l.created_at >= public.stats2_start(p_days, p_tz)
    and (p_include_admins or l.user_id is null
         or not exists (select 1 from public.profiles p where p.id = l.user_id and p.role = 'admin'))
  group by l.subject
  order by count(*) desc, l.subject
  limit 50;
$$;

-- أكثر الملفات تنزيلاً (مع عدد الطلاب المختلفين)
create or replace function public.stats2_files(p_days int default 30, p_tz text default 'UTC', p_include_admins boolean default false, p_limit int default 10)
returns table (file_name text, subject text, material text, downloads bigint, students bigint)
language sql
security definer
set search_path = public
stable
as $$
  select l.file_name, l.subject, l.material, count(*), count(distinct l.user_id)
  from public.activity_log l
  where public.is_admin()
    and l.kind = 'download' and l.file_name is not null
    and l.created_at >= public.stats2_start(p_days, p_tz)
    and (p_include_admins or l.user_id is null
         or not exists (select 1 from public.profiles p where p.id = l.user_id and p.role = 'admin'))
  group by l.file_name, l.subject, l.material
  order by count(*) desc, l.file_name
  limit least(greatest(p_limit, 1), 50);
$$;

-- ساعات الذروة (0–23 بالتوقيت المحلي)
create or replace function public.stats2_hours(p_days int default 30, p_tz text default 'UTC', p_include_admins boolean default false)
returns table (hour int, events bigint)
language sql
security definer
set search_path = public
stable
as $$
  select h, count(l.id)
  from generate_series(0, 23) h
  left join public.activity_log l
    on public.is_admin()
   and extract(hour from (l.created_at at time zone
         (case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'UTC' end)))::int = h
   and l.created_at >= public.stats2_start(p_days, p_tz)
   and (p_include_admins or l.user_id is null
        or not exists (select 1 from public.profiles p where p.id = l.user_id and p.role = 'admin'))
  where public.is_admin()
  group by h
  order by h;
$$;

revoke all on function public.stats2_start(int, text, int) from public, anon;
revoke all on function public.stats2_overview(int, text, boolean) from public, anon;
revoke all on function public.stats2_daily(int, text, boolean) from public, anon;
revoke all on function public.stats2_subjects(int, text, boolean) from public, anon;
revoke all on function public.stats2_files(int, text, boolean, int) from public, anon;
revoke all on function public.stats2_hours(int, text, boolean) from public, anon;
grant execute on function public.stats2_start(int, text, int) to authenticated;
grant execute on function public.stats2_overview(int, text, boolean) to authenticated;
grant execute on function public.stats2_daily(int, text, boolean) to authenticated;
grant execute on function public.stats2_subjects(int, text, boolean) to authenticated;
grant execute on function public.stats2_files(int, text, boolean, int) to authenticated;
grant execute on function public.stats2_hours(int, text, boolean) to authenticated;
