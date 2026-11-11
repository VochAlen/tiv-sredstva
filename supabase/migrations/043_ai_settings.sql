-- 043: AI prekidač (ON/OFF) koji administrator mijenja iz aplikacije, bez promjene koda.
-- Pokrenuti ručno u Supabase SQL editoru. Sigurno za ponovno pokretanje.
-- AI je podrazumijevano ISKLJUČEN dok ga administrator ne uključi.
-- Dodatno, promjenljiva okruženja AI_ENABLED=false gasi AI potpuno, bez obzira na ovu tabelu.

create table if not exists public.ai_settings (
  id          int primary key default 1 check (id = 1),
  enabled     boolean not null default false,
  updated_by  text,
  updated_at  timestamptz not null default now()
);
insert into public.ai_settings (id) values (1) on conflict (id) do nothing;

alter table public.ai_settings enable row level security;
drop policy if exists "AI settings: admin all" on public.ai_settings;
create policy "AI settings: admin all" on public.ai_settings for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
-- (aplikacija čita prekidač kroz service role; radnici nemaju direktan pristup tabeli)
