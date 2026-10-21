-- Şifre denemelerinde, deneyen kişinin girdiği isim (şifrenin kendisi yine hiç saklanmaz).
alter table public.pin_attempts add column if not exists name text check (name is null or char_length(name) <= 40);
create index if not exists pin_attempts_name_idx on public.pin_attempts (name) where name is not null;
