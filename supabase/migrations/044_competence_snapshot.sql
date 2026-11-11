-- 044: snimak pitanja uz svaki pokušaj provjere osposobljenosti (revizijski trag).
-- Uz odgovore se čuva i TEKST pitanja i ponuđenih odgovora u trenutku testa, pa pregled
-- ostaje tačan i kad admin kasnije izmijeni ili obriše pitanje.
-- Pokrenuti ručno u Supabase SQL editoru (nakon 043). Sigurno za ponovno pokretanje.
-- Stari pokušaji nemaju snimak: za njih se tekst čita iz banke pitanja dok se pitanje ne promijeni.

alter table public.competence_attempts add column if not exists questions jsonb;   -- [{id, topic, question, options[], correctIndex, chosen, critical}]
alter table public.competence_attempts add column if not exists pass_pct int;      -- prag prolaza koji je važio u trenutku testa

create index if not exists competence_attempts_taken_idx on public.competence_attempts (taken_at desc);
create index if not exists competence_attempts_name_idx on public.competence_attempts (employee_name);
