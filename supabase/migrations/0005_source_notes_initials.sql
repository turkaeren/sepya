-- Okurun nereden geldiği, okur notları, yazılarda baş harf

alter table public.reader_sessions
  add column if not exists source     text check (source is null or char_length(source) <= 40),
  add column if not exists source_ref text check (source_ref is null or char_length(source_ref) <= 300);
create index if not exists reader_sessions_source_idx on public.reader_sessions (created_at desc, source);

alter table public.pin_attempts
  add column if not exists source text check (source is null or char_length(source) <= 40);

alter table public.entries
  add column if not exists initials       text check (initials is null or char_length(initials) between 1 and 12),
  add column if not exists initials_style text not null default 'el' check (initials_style in ('el', 'daktilo', 'gotik'));

create table if not exists public.reader_notes (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references public.reader_sessions (id) on delete set null,
  visitor_id  uuid,
  name        text,
  entry_id    uuid references public.entries (id) on delete set null,
  entry_title text,
  body        text not null check (char_length(body) between 1 and 2000),
  ip          inet,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index if not exists reader_notes_created_idx on public.reader_notes (created_at desc);
create index if not exists reader_notes_session_idx on public.reader_notes (session_id, created_at desc);

alter table public.reader_notes enable row level security;
revoke all on public.reader_notes from anon, authenticated;
