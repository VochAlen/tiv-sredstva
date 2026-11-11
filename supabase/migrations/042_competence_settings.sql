-- 042: Postavke provjere znanja koje bira ADMIN + datum sljedećeg testa (nadogradnja migracije 041)
-- Pokrenuti ručno u Supabase SQL editoru (nakon 041). Bezbjedno za ponovno pokretanje.
--
--  * competence_settings: za svaku ulogu (vozač / šef-radionica / admin) admin bira
--      - rok ponavljanja: admin upisuje broj mjeseci (1 do 120), jer se propis (CAA/EASA) može promijeniti; sada je najviše 24
--      - broj pitanja u kratkom testu (3 do 20), nasumično iz banke
--      - prag prolaza (50 do 100 posto)
--  * competence_status.next_test_at: nasumičan datum u periodu kada se test pojavljuje radniku
--    (valid_until ostaje krajnji rok). Zamjenjuje mjesečni cron: zadatak se računa iz datuma, bez zakazanih poslova.
--  * Tačni odgovori pitanja sada su vidljivi SAMO administratoru (ranije i inženjeru).

create table if not exists public.competence_settings (
  audience           text primary key check (audience in ('DRIVER','SUPERVISOR','ADMIN')),
  interval_months    int  not null default 12 check (interval_months between 1 and 120),
  questions_per_test int  not null default 10 check (questions_per_test between 3 and 20),
  pass_pct           int  not null default 80 check (pass_pct between 50 and 100),
  updated_by         text,
  updated_at         timestamptz not null default now()
);

insert into public.competence_settings (audience) values ('DRIVER'), ('SUPERVISOR'), ('ADMIN')
on conflict (audience) do nothing;

-- ako je ranija verzija ove migracije već pokrenuta (rok samo 3/6/12/24), proširi ograničenje
alter table public.competence_settings drop constraint if exists competence_settings_interval_months_check;
alter table public.competence_settings add constraint competence_settings_interval_months_check check (interval_months between 1 and 120);

alter table public.competence_status add column if not exists next_test_at date;

alter table public.competence_settings enable row level security;
drop policy if exists "Competence settings: admin all" on public.competence_settings;
create policy "Competence settings: admin all" on public.competence_settings for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
-- (aplikacija čita postavke kroz service role pri svakom testu; radnici nemaju direktan pristup)

-- Pitanja sa tačnim odgovorima: samo admin
drop policy if exists "Competence: engineer+ read" on public.competence_questions;
drop policy if exists "Competence: admin read" on public.competence_questions;
create policy "Competence: admin read" on public.competence_questions for select
  using (public.current_user_role() = 'admin');

-- Popuni next_test_at za radnike koji su već položili (nasumično 90 do 300 dana poslije položenog testa)
update public.competence_status
   set next_test_at = (last_passed_at::date + (90 + floor(random() * 211))::int)
 where status = 'VALID' and last_passed_at is not null and next_test_at is null;

-- Cron za nasumične provjere više nije potreban: obrisati iz vercel.json ako je dodat (/api/cron/competence-random).
