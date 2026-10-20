-- Yönetim paneli için toplu istatistik fonksiyonları (yalnızca service_role çağırabilir).

create or replace function public.admin_analytics(p_days int default 14)
returns jsonb language sql stable security invoker set search_path = '' as $$
with b as (
  select ((now() at time zone 'Europe/Istanbul')::date - (p_days - 1)) as d0
),
b2 as (
  select d0, (d0::timestamp at time zone 'Europe/Istanbul') as t0 from b
),
days as (
  select g::date as d
  from generate_series((select d0 from b2), (now() at time zone 'Europe/Istanbul')::date, interval '1 day') g
),
s as (
  select id, visitor_id, device, browser, country, (created_at at time zone 'Europe/Istanbul')::date as d
  from public.reader_sessions where created_at >= (select t0 from b2)
),
firsts as (
  select visitor_id, (min(created_at) at time zone 'Europe/Istanbul')::date as fd
  from public.reader_sessions group by visitor_id
),
pv as (
  select p.kind, p.entry_id, p.category, p.duration_ms,
         (p.viewed_at at time zone 'Europe/Istanbul')::date as d,
         extract(hour from p.viewed_at at time zone 'Europe/Istanbul')::int as h
  from public.page_views p where p.viewed_at >= (select t0 from b2)
),
pa as (
  select outcome, (attempted_at at time zone 'Europe/Istanbul')::date as d
  from public.pin_attempts where attempted_at >= (select t0 from b2)
)
select jsonb_build_object(
  'daily', (select jsonb_agg(jsonb_build_object(
      'd', days.d,
      'sessions', (select count(*) from s where s.d = days.d),
      'visitors', (select count(distinct s.visitor_id) from s where s.d = days.d),
      'new', (select count(distinct s.visitor_id) from s join firsts f using (visitor_id) where s.d = days.d and f.fd = days.d),
      'views', (select count(*) from pv where pv.d = days.d and pv.kind in ('title', 'section', 'entry', 'empty')),
      'ok', (select count(*) from pa where pa.d = days.d and pa.outcome = 'ok'),
      'fail', (select count(*) from pa where pa.d = days.d and pa.outcome = 'fail')
    ) order by days.d) from days),
  'devices', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
              from (select coalesce(device, 'Diğer') as k, count(*) as n from s group by 1) x),
  'browsers', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
               from (select coalesce(browser, 'Diğer') as k, count(*) as n from s group by 1) x),
  'countries', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
                from (select coalesce(country, 'Bilinmiyor') as k, count(*) as n from s group by 1) x),
  'categories', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
                 from (select category::text as k, count(*) as n from pv where kind = 'entry' and category is not null group by 1) x),
  'hours', (select jsonb_agg((select count(*) from pv where pv.h = hh and pv.kind in ('title', 'section', 'entry', 'empty')) order by hh)
            from generate_series(0, 23) hh),
  'top', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'n', x.n, 'avg', x.avg_ms) order by x.n desc), '[]'::jsonb)
          from (select entry_id, count(*) as n, avg(duration_ms)::int as avg_ms from pv
                where kind = 'entry' and entry_id is not null group by 1 order by 2 desc limit 6) x
          join public.entries e on e.id = x.entry_id),
  'totals', jsonb_build_object(
      'sessions_all', (select count(*) from public.reader_sessions),
      'visitors_all', (select count(distinct visitor_id) from public.reader_sessions),
      'sessions', (select count(*) from s),
      'visitors', (select count(distinct visitor_id) from s),
      'views', (select count(*) from pv where kind in ('title', 'section', 'entry', 'empty')),
      'returning', (select count(distinct s.visitor_id) from s join firsts f using (visitor_id) where f.fd < s.d)
  )
);
$$;

create or replace function public.admin_fail_hourly()
returns table (t timestamptz, n bigint) language sql stable security invoker set search_path = '' as $$
  select g.t,
         (select count(*) from public.pin_attempts a
           where a.outcome = 'fail' and a.attempted_at >= g.t and a.attempted_at < g.t + interval '1 hour')
  from generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') as g(t);
$$;

create or replace function public.admin_fail_daily(p_days int)
returns table (d date, n bigint) language sql stable security invoker set search_path = '' as $$
  select g.d::date,
         (select count(*) from public.pin_attempts a
           where a.outcome = 'fail' and (a.attempted_at at time zone 'Europe/Istanbul')::date = g.d::date)
  from generate_series((now() at time zone 'Europe/Istanbul')::date - (p_days - 1),
                       (now() at time zone 'Europe/Istanbul')::date, interval '1 day') as g(d);
$$;

create or replace function public.admin_entry_stats(p_entry uuid, p_days int default 14)
returns jsonb language sql stable security invoker set search_path = '' as $$
with v as (
  select p.session_id, p.part, p.duration_ms, p.viewed_at, s.visitor_id, s.name, s.device, s.browser, s.country
  from public.page_views p join public.reader_sessions s on s.id = p.session_id
  where p.entry_id = p_entry and p.kind = 'entry'
),
parts as (select max(part) as last_part from v)
select jsonb_build_object(
  'views', (select count(*) from v),
  'visitors', (select count(distinct visitor_id) from v),
  'avg_ms', (select avg(duration_ms)::int from v where duration_ms is not null),
  'last', (select jsonb_build_object('at', viewed_at, 'name', name, 'device', device) from v order by viewed_at desc limit 1),
  'views_7d', (select count(*) from v where viewed_at >= now() - interval '7 days'),
  'finish_rate', (select case when count(distinct session_id) filter (where part = 1) = 0 then null
                   else round(100.0 * count(distinct session_id) filter (where part = (select last_part from parts))
                              / count(distinct session_id) filter (where part = 1)) end from v),
  'daily', (select jsonb_agg(jsonb_build_object('d', g::date,
              'n', (select count(*) from v where (v.viewed_at at time zone 'Europe/Istanbul')::date = g::date)) order by g)
            from generate_series((now() at time zone 'Europe/Istanbul')::date - (p_days - 1),
                                 (now() at time zone 'Europe/Istanbul')::date, interval '1 day') g),
  'devices', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
              from (select coalesce(device, 'Diğer') || ' / ' || coalesce(browser, '?') as k, count(*) as n from v group by 1) x),
  'countries', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
                from (select coalesce(country, 'Bilinmiyor') as k, count(*) as n from v group by 1) x),
  'dwell', jsonb_build_array(
      (select count(*) from v where duration_ms < 15000),
      (select count(*) from v where duration_ms >= 15000 and duration_ms < 30000),
      (select count(*) from v where duration_ms >= 30000 and duration_ms < 45000),
      (select count(*) from v where duration_ms >= 45000 and duration_ms < 60000),
      (select count(*) from v where duration_ms >= 60000)),
  'readers', (select coalesce(jsonb_agg(x.r order by x.at desc), '[]'::jsonb) from (
      select jsonb_build_object('session', session_id, 'name', name, 'at', viewed_at, 'ms', duration_ms,
                                'device', device, 'browser', browser) as r, viewed_at as at
      from v order by viewed_at desc limit 8) x)
);
$$;

revoke execute on function public.admin_analytics(int) from anon, authenticated, public;
revoke execute on function public.admin_fail_hourly() from anon, authenticated, public;
revoke execute on function public.admin_fail_daily(int) from anon, authenticated, public;
revoke execute on function public.admin_entry_stats(uuid, int) from anon, authenticated, public;
grant execute on function public.admin_analytics(int) to service_role;
grant execute on function public.admin_fail_hourly() to service_role;
grant execute on function public.admin_fail_daily(int) to service_role;
grant execute on function public.admin_entry_stats(uuid, int) to service_role;
