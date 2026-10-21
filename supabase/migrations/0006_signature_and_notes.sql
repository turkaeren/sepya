-- Yazının sağ altında görünen imza/baş harf.
alter table public.entries add column if not exists signature text check (signature is null or char_length(signature) <= 12);

-- Okurların bir yazı için bıraktığı notlar.
create table if not exists public.reader_notes (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid references public.entries (id) on delete set null,
  entry_title  text not null default '',
  session_id   uuid references public.reader_sessions (id) on delete set null,
  reader_name  text not null default '',
  body         text not null check (char_length(body) between 1 and 1000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index if not exists reader_notes_created_idx on public.reader_notes (created_at desc);
create index if not exists reader_notes_unread_idx on public.reader_notes (created_at desc) where read_at is null;
create index if not exists reader_notes_session_idx on public.reader_notes (session_id, created_at desc);

alter table public.reader_notes enable row level security;
revoke all on public.reader_notes from anon, authenticated;
