-- reader_notes daha önce farklı bir yapıyla oluşturulmuştu; 0005'teki "create table if not exists" atlandı.
-- Tabloyu uygulamanın beklediği yapıya getirir.
alter table public.reader_notes rename column reader_name to name;
alter table public.reader_notes add column if not exists visitor_id uuid, add column if not exists ip inet;
alter table public.reader_notes drop constraint if exists reader_notes_body_check;
alter table public.reader_notes add constraint reader_notes_body_check check (char_length(body) between 1 and 2000);
alter table public.reader_notes alter column entry_title drop not null, alter column name drop not null, alter column session_id drop not null, alter column entry_id drop not null;
alter table public.reader_notes alter column created_at set default now(), alter column id set default gen_random_uuid();
create index if not exists reader_notes_created_idx on public.reader_notes (created_at desc);
create index if not exists reader_notes_visitor_idx on public.reader_notes (visitor_id, created_at desc);
alter table public.reader_notes enable row level security;
revoke all on public.reader_notes from anon, authenticated;
