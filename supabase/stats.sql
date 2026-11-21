-- =====================================================================
--  Students IS Platform — إحصاءات الاستخدام (أكثر المواد دخولاً وتنزيلاً)
--  شغّل هذا الملف مرة واحدة: Supabase > SQL Editor > New query > Run
--  (بعد schema.sql — آمن للتكرار)
-- =====================================================================

-- 1) سجل النشاط: كل صف = دخول مادة أو فتح/تنزيل ملف
create table if not exists public.activity_log (
  id         bigint generated always as identity primary key,
  user_id    uuid default auth.uid() references auth.users(id) on delete set null,
  kind       text not null check (kind in ('view', 'download')),
  subject    text not null check (char_length(subject) <= 120),
  material   text check (char_length(material) <= 40),
  file_name  text check (char_length(file_name) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_idx on public.activity_log (created_at desc);
create index if not exists activity_log_subject_idx on public.activity_log (subject, kind);

alter table public.activity_log enable row level security;

-- الطالب المسجّل يُدرج نشاطه فقط. لا توجد سياسة قراءة: لا أحد يقرأ الجدول مباشرة من المتصفح.
drop policy if exists "activity_insert_own" on public.activity_log;
create policy "activity_insert_own" on public.activity_log
  for insert to authenticated
  with check (user_id = auth.uid());

-- (v1.2) حدّ معدّل: 300 نشاط لكل طالب في الساعة، يمنع إغراق الجدول بطلبات وهمية تشوّه الإحصاءات
create index if not exists activity_log_user_created_idx on public.activity_log (user_id, created_at desc);

create or replace function public.activity_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.activity_log
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 300 then
    return null;  -- تجاهل الصف بصمت (لا خطأ يظهر للطالب)
  end if;
  return new;
end;
$$;

drop trigger if exists activity_rate_limit on public.activity_log;
create trigger activity_rate_limit
  before insert on public.activity_log
  for each row execute function public.activity_rate_limit();

-- 2) دوال الإحصاء — للأدمن فقط (لغير الأدمن ترجع نتيجة فارغة)
create or replace function public.stats_by_subject(p_days int default 30)
returns table (subject text, views bigint, downloads bigint, visitors bigint)
language sql
security definer
set search_path = public
stable
as $$
  select a.subject,
         count(*) filter (where a.kind = 'view')     as views,
         count(*) filter (where a.kind = 'download') as downloads,
         count(distinct a.user_id)                   as visitors
  from public.activity_log a
  where public.is_admin()
    and (p_days <= 0 or a.created_at >= now() - make_interval(days => p_days))
  group by a.subject
  order by count(*) desc
  limit 50;
$$;

create or replace function public.stats_top_files(p_days int default 30, p_limit int default 10)
returns table (file_name text, subject text, material text, downloads bigint)
language sql
security definer
set search_path = public
stable
as $$
  select a.file_name, a.subject, a.material, count(*) as downloads
  from public.activity_log a
  where public.is_admin()
    and a.kind = 'download'
    and a.file_name is not null
    and (p_days <= 0 or a.created_at >= now() - make_interval(days => p_days))
  group by a.file_name, a.subject, a.material
  order by count(*) desc
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.stats_by_subject(int) from public, anon;
revoke all on function public.stats_top_files(int, int) from public, anon;
grant execute on function public.stats_by_subject(int) to authenticated;
grant execute on function public.stats_top_files(int, int) to authenticated;
