-- SEPYA · ilk şema
-- Tüm tablolarda RLS açık ve hiçbir politika yok: tarayıcıdaki anahtarlar (anon/publishable)
-- hiçbir satıra erişemez. Uygulama yalnızca sunucuda, service role anahtarıyla bağlanır.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- İçerik -------------------------------------------------------------------
create type public.entry_category as enum ('siir', 'not', 'defter');

create table public.entries (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  content     text not null default '' check (char_length(content) <= 50000),
  category    public.entry_category not null,
  entry_date  date not null default (now() at time zone 'Europe/Istanbul')::date,
  cover_url   text,
  published   boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index entries_published_date_idx on public.entries (published, entry_date desc, sort_order);

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger entries_touch before update on public.entries
  for each row execute function public.touch_updated_at();

-- Ayarlar (okur PIN hash'i burada; PIN'in kendisi hiçbir yerde tutulmaz) ---------
create table public.settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- Okur oturumları ------------------------------------------------------------
create table public.reader_sessions (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null unique,
  visitor_id    uuid not null,
  name          text check (name is null or char_length(name) between 1 and 40),
  ip            inet,
  country       text,
  city          text,
  device        text,
  os            text,
  browser       text,
  user_agent    text,
  referer       text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null,
  ended_at      timestamptz,
  end_reason    text check (end_reason is null or end_reason in ('revoked', 'pin_changed', 'logout'))
);
create index reader_sessions_created_idx on public.reader_sessions (created_at desc);
create index reader_sessions_visitor_idx on public.reader_sessions (visitor_id, created_at);

create table public.page_views (
  id           bigint generated always as identity primary key,
  session_id   uuid not null references public.reader_sessions (id) on delete cascade,
  entry_id     uuid references public.entries (id) on delete set null,
  kind         text not null check (kind in ('title', 'section', 'entry', 'empty', 'archive', 'menu')),
  label        text,
  part         integer,
  category     public.entry_category,
  viewed_at    timestamptz not null default now(),
  duration_ms  integer
);
create index page_views_session_idx on public.page_views (session_id, viewed_at);
create index page_views_entry_idx on public.page_views (entry_id, viewed_at desc);
create index page_views_viewed_idx on public.page_views (viewed_at desc);

-- PIN denemeleri: PIN değeri ASLA yazılmaz -------------------------------------
create table public.pin_attempts (
  id           bigint generated always as identity primary key,
  attempted_at timestamptz not null default now(),
  ip           inet,
  country      text,
  city         text,
  device       text,
  os           text,
  browser      text,
  user_agent   text,
  success      boolean not null,
  outcome      text not null check (outcome in ('ok', 'fail', 'wait', 'blocked'))
);
create index pin_attempts_ip_idx on public.pin_attempts (ip, attempted_at desc);
create index pin_attempts_time_idx on public.pin_attempts (attempted_at desc);

create table public.ip_blocks (
  ip         inet primary key,
  until      timestamptz not null,
  reason     text not null,
  created_at timestamptz not null default now()
);

-- Yönetici -------------------------------------------------------------------
create table public.admin_users (
  id             uuid primary key default gen_random_uuid(),
  email          citext not null unique,
  password_hash  text not null,
  totp_secret    text not null,
  created_at     timestamptz not null default now()
);

create table public.admin_sessions (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique,
  admin_id     uuid not null references public.admin_users (id) on delete cascade,
  ip           inet,
  device       text,
  os           text,
  browser      text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  ended_at     timestamptz
);

create table public.admin_login_events (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  email     text,
  ip        inet,
  country   text,
  city      text,
  device    text,
  os        text,
  browser   text,
  success   boolean not null,
  reason    text
);
create index admin_login_events_ip_idx on public.admin_login_events (ip, at desc);

-- Görünümler ----------------------------------------------------------------
create view public.v_sessions with (security_invoker = true) as
select
  s.*,
  coalesce(pv.pages, 0)       as pages,
  pv.last_view_at,
  case
    when s.ended_at is not null then coalesce(s.end_reason, 'ended')
    when s.expires_at < now() or s.last_seen_at < now() - interval '30 minutes' then 'expired'
    else 'active'
  end as status
from public.reader_sessions s
left join lateral (
  select count(*) filter (where p.kind in ('title', 'section', 'entry', 'empty')) as pages,
         max(p.viewed_at) as last_view_at
  from public.page_views p where p.session_id = s.id
) pv on true;

create view public.v_entry_stats with (security_invoker = true) as
select
  e.id as entry_id,
  count(p.id)                                       as views,
  count(distinct s.visitor_id)                      as visitors,
  avg(p.duration_ms) filter (where p.duration_ms is not null)::integer as avg_ms,
  max(p.viewed_at)                                  as last_viewed_at
from public.entries e
left join public.page_views p on p.entry_id = e.id and p.kind = 'entry'
left join public.reader_sessions s on s.id = p.session_id
group by e.id;

-- Kilitler ------------------------------------------------------------------
alter table public.entries            enable row level security;
alter table public.settings           enable row level security;
alter table public.reader_sessions    enable row level security;
alter table public.page_views         enable row level security;
alter table public.pin_attempts       enable row level security;
alter table public.ip_blocks          enable row level security;
alter table public.admin_users        enable row level security;
alter table public.admin_sessions     enable row level security;
alter table public.admin_login_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;
