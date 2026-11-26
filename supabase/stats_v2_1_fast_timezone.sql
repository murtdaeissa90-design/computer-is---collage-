-- =====================================================================
--  Students IS — إصلاح سرعة إحصاءات الأدمن (v2.1)
--  المشكلة: فترتا "7 أيام" و"30 يوماً" كانتا تتأخران ~10 ثوانٍ وتفشلان (تجاوز مهلة قاعدة البيانات)
--  لأن التحقق من اسم المنطقة الزمنية كان يمسح pg_timezone_names مع كل صف. "الكل" لم تتأثر.
--  الحل: دالة stats2_tz سريعة + حساب حدود الفترة مرة واحدة. بعد الإصلاح: ~3 مللي ثانية.
--  شغّله مرة واحدة بعد stats_v2.sql (آمن للتكرار).
-- =====================================================================

create or replace function public.stats2_tz(p_tz text)
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  perform now() at time zone p_tz;
  return p_tz;
exception when others then
  return 'UTC';
end;
$$;

create or replace function public.stats2_start(p_days int, p_tz text, p_back int default 0)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case
    when p_days <= 0 then '-infinity'::timestamptz
    else (
      date_trunc('day', now() at time zone public.stats2_tz(p_tz))
      - make_interval(days => p_days * (p_back + 1) - 1)
    ) at time zone public.stats2_tz(p_tz)
  end;
$$;

create or replace function public.stats2_overview(p_days int default 30, p_tz text default 'UTC', p_include_admins boolean default false)
returns table (views bigint, downloads bigint, active_students bigint, total_students bigint,
               prev_views bigint, prev_downloads bigint, prev_active bigint)
language sql
security definer
set search_path = public
stable
as $$
  with b as materialized (
    select public.stats2_start(p_days, p_tz) as s0, public.stats2_start(p_days, p_tz, 1) as s1
  ),
  a as (
    select l.kind, l.user_id, l.created_at
    from public.activity_log l
    where public.is_admin()
      and (p_include_admins or l.user_id is null
           or not exists (select 1 from public.profiles p where p.id = l.user_id and p.role = 'admin'))
  ),
  cur as (select a.* from a, b where a.created_at >= b.s0),
  prv as (select a.* from a, b where p_days > 0 and a.created_at >= b.s1 and a.created_at < b.s0)
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

create or replace function public.stats2_hours(p_days int default 30, p_tz text default 'UTC', p_include_admins boolean default false)
returns table (hour int, events bigint)
language sql
security definer
set search_path = public
stable
as $$
  with b as materialized (select public.stats2_start(p_days, p_tz) as s0, public.stats2_tz(p_tz) as tz)
  select h, count(l.id)
  from generate_series(0, 23) h
  left join (
    select l.id, extract(hour from (l.created_at at time zone b.tz))::int as hr
    from public.activity_log l, b
    where public.is_admin()
      and l.created_at >= b.s0
      and (p_include_admins or l.user_id is null
           or not exists (select 1 from public.profiles p where p.id = l.user_id and p.role = 'admin'))
  ) l on l.hr = h
  where public.is_admin()
  group by h
  order by h;
$$;

create or replace function public.stats2_daily(p_days int default 30, p_tz text default 'UTC', p_include_admins boolean default false)
returns table (day date, views bigint, downloads bigint, students bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  tz text := public.stats2_tz(p_tz);
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

revoke all on function public.stats2_tz(text) from public, anon;
grant execute on function public.stats2_tz(text) to authenticated;
revoke all on function public.stats2_start(int, text, int) from public, anon;
grant execute on function public.stats2_start(int, text, int) to authenticated;
revoke all on function public.stats2_overview(int, text, boolean) from public, anon;
revoke all on function public.stats2_daily(int, text, boolean) from public, anon;
revoke all on function public.stats2_hours(int, text, boolean) from public, anon;
grant execute on function public.stats2_overview(int, text, boolean) to authenticated;
grant execute on function public.stats2_daily(int, text, boolean) to authenticated;
grant execute on function public.stats2_hours(int, text, boolean) to authenticated;
