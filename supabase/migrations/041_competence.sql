-- 041: Provjera osposobljenosti osoblja (ADR.OR.D.017 - osposobljenost i provjera znanja; ADR.OPS.B.024 - vozači)
-- Pokrenuti ručno u Supabase SQL editoru (nakon 040). Bezbjedno za ponovno pokretanje.
--
-- Tok: test (vozač / šef-radionica / admin) -> pad = status TRAINING (rad samo uz nadzor mentora)
--      -> N nadziranih smjena (mentor potvrđuje pri zaduživanju) -> ponovni test -> VALID.
-- Pitanja su NACRT napisan iz uputstva za korištenje: moraju ih pregledati i odobriti odgovorni za obuku.
-- Rezultati su lični podaci zaposlenih: čitaju ih samo inženjer i admin; upisi idu kroz server (service role).

create table if not exists public.competence_questions (
  id            uuid primary key default gen_random_uuid(),
  audience      text not null check (audience in ('DRIVER','SUPERVISOR','ADMIN')),
  topic         text not null,
  question      text not null,
  options       jsonb not null,                 -- niz tekstova odgovora
  correct_index int  not null,
  critical      boolean not null default false, -- jedan pogrešan kritičan odgovor = pad
  explanation   text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint competence_options_array check (jsonb_typeof(options) = 'array')
);
create index if not exists competence_q_idx on public.competence_questions (audience, active);

create table if not exists public.competence_mentors (
  employee_card_id text primary key,
  name             text not null,
  active           boolean not null default true,
  appointed_by     text,
  appointed_at     timestamptz not null default now()
);

create table if not exists public.competence_status (
  employee_card_id   text primary key,
  employee_name      text not null,
  audience           text not null default 'DRIVER',
  status             text not null default 'VALID' check (status in ('VALID','TRAINING')),
  last_result_pct    int,
  last_passed_at     timestamptz,
  valid_until        date,
  supervised_required int not null default 3,
  supervised_done    int not null default 0,
  pending_kind       text check (pending_kind in ('RANDOM','PERIODIC','RETEST','INITIAL')),
  pending_due        date,
  updated_at         timestamptz not null default now()
);

create table if not exists public.competence_attempts (
  id               uuid primary key default gen_random_uuid(),
  employee_card_id text not null,
  employee_name    text not null,
  audience         text not null,
  kind             text not null check (kind in ('INITIAL','RANDOM','PERIODIC','RETEST','SELF')),
  score_pct        int  not null,
  critical_failed  boolean not null default false,
  passed           boolean not null,
  answers          jsonb not null,              -- [{id, chosen, correct, critical}]
  taken_at         timestamptz not null default now(),
  taken_by         text                         -- ime prijavljenog korisnika, ili 'SELF' (radnik sam, karticom)
);
create index if not exists competence_attempts_idx on public.competence_attempts (employee_card_id, taken_at desc);

create table if not exists public.competence_supervised_log (
  id               uuid primary key default gen_random_uuid(),
  employee_card_id text not null,
  mentor_card_id   text not null,
  mentor_name      text not null,
  shift_date       date not null,
  equipment_code   text,
  signed_at        timestamptz not null default now(),
  unique (employee_card_id, shift_date)
);

alter table public.competence_questions       enable row level security;
alter table public.competence_mentors         enable row level security;
alter table public.competence_status          enable row level security;
alter table public.competence_attempts        enable row level security;
alter table public.competence_supervised_log  enable row level security;

-- Čitanje: inženjer i admin. Pitanja sa tačnim odgovorima ne smije vidjeti radnik/operator.
do $$
declare t text;
begin
  foreach t in array array['competence_questions','competence_mentors','competence_status','competence_attempts','competence_supervised_log'] loop
    execute format('drop policy if exists "Competence: engineer+ read" on public.%I', t);
    execute format('create policy "Competence: engineer+ read" on public.%I for select using (public.current_user_role() in (''engineer'',''admin''))', t);
  end loop;
end $$;

drop policy if exists "Competence: admin write questions" on public.competence_questions;
create policy "Competence: admin write questions" on public.competence_questions for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists "Competence: admin write mentors" on public.competence_mentors;
create policy "Competence: admin write mentors" on public.competence_mentors for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- Rezultati i evidencija nadzora se ne brišu (dokaz za inspekciju)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'fn_block_delete_always') then
    drop trigger if exists trg_competence_attempts_nodelete on public.competence_attempts;
    create trigger trg_competence_attempts_nodelete before delete on public.competence_attempts
      for each row execute function public.fn_block_delete_always();
    drop trigger if exists trg_competence_supervised_nodelete on public.competence_supervised_log;
    create trigger trg_competence_supervised_nodelete before delete on public.competence_supervised_log
      for each row execute function public.fn_block_delete_always();
  end if;
end $$;

-- ===================== NACRT BANKE PITANJA =====================
-- Seed samo ako je tabela prazna (da se ponovnim pokretanjem ne dupliraju pitanja).
do $$
begin
  if (select count(*) from public.competence_questions) > 0 then return; end if;

  insert into public.competence_questions (audience, topic, question, options, correct_index, critical, explanation) values
  -- ---------- VOZAČ / RADNIK ----------
  ('DRIVER','Dnevni pregled','Skenirali ste vozilo i aplikacija pokazuje crvenu poruku „Sredstvo nije pregledano danas“. Šta radite?',
    '["Zadužim vozilo, a pregled uradim kasnije","Uradim dnevni pregled prije zaduživanja","Zamolim kolegu da zaduži vozilo na svoju karticu","Ignorišem poruku i krenem"]', 1, true,
    'Vozilo se ne smije koristiti bez dnevnog pregleda. Pregled radi ovlašteni radnik odmah prije zaduživanja.'),
  ('DRIVER','Dnevni pregled','Pri dnevnom pregledu utvrdite da kočioni sistem ne radi ispravno. Šta radite?',
    '["Označim stavku kao neispravnu, vozilo ne koristim, prijava ide radionici","Označim ispravno jer vozilo samo treba kratko","Koristim vozilo polako i javim se kasnije","Pregled ostavim nezavršenim"]', 0, true,
    'Neispravan kočioni sistem je blokirajući nedostatak: vozilo postaje neispravno i ne smije se zadužiti.'),
  ('DRIVER','Zaduživanje','Zaduženo vozilo želite predati kolegi koji preuzima smjenu. Kako se to radi?',
    '["Kolega ga koristi dalje na moju karticu","Ja ga vratim (razdužim), a kolega ga zaduži na svoju karticu","Ostavim ga bez razduživanja","Kolega prepiše moju karticu"]', 1, true,
    'Svako vozilo je zaduženo na jednu osobu. Predaja ide kroz razduživanje i novo zaduživanje.'),
  ('DRIVER','Zaduživanje','Da li smijete koristiti tuđu ID karticu za zaduživanje?',
    '["Da, ako kolega nije tu","Da, ako sam u žurbi","Ne, svako koristi samo svoju karticu","Da, uz usmenu dozvolu šefa"]', 2, true,
    'Kartica identifikuje odgovornu osobu. Upotreba tuđe kartice je zabranjena.'),
  ('DRIVER','Ovlaštenje','Vaša airside dozvola je istekla. Smijete li zadužiti vozilo?',
    '["Da, dozvola se provjerava samo jednom godišnje","Da, ako vozite samo kratko","Ne, bez važeće airside dozvole zaduživanje nije dozvoljeno","Da, ako me kolega prati"]', 2, true,
    'Aplikacija blokira zaduživanje bez važeće airside dozvole i obuke. Javite se šefu.'),
  ('DRIVER','FOD','Na stajanci vidite vijak na asfaltu. Šta radite?',
    '["Ništa, neko drugi će ga vidjeti","Prijavim FOD kroz aplikaciju sa lokacijom","Odgurnem ga nogom sa puta","Prijavim ga tek na kraju smjene"]', 1, true,
    'FOD može oštetiti avion. Prijava se šalje odmah, sa lokacijom i vrstom predmeta.'),
  ('DRIVER','Divlje životinje','Vidite pticu ili životinju na aerodromskoj površini. Šta radite?',
    '["Prijavim „Divlja životinja“ sa vrstom i mjestom","Ništa, ptice su normalna pojava","Pozovem prijatelje da je otjeraju","Prijavim samo ako je uginula"]', 0, true,
    'Svaku životinju treba prijaviti, a posebno ako je bilo sudara sa vazduhoplovom.'),
  ('DRIVER','Kvar','Tokom vožnje primijetite novi kvar (curi ulje). Šta radite?',
    '["Nastavim, javim na kraju sedmice","Prijavim kvar u aplikaciji (slika, kategorija, opis) i obavijestim šefa","Ne prijavljujem jer ne mogu dokazati","Sam pokušam popraviti"]', 1, false,
    'Kvar se prijavi odmah: slika, kategorija i opis, a prijava ide radionici.'),
  ('DRIVER','Oznake','Šta znači oznaka „Sa ograničenjem“ pri zaduživanju?',
    '["Vozilo je neispravno i ne smije se koristiti","Vozilo se smije koristiti, ali uz ograničenje koje piše na kartici","Vozilo se koristi samo noću","Ograničenje važi za druge vozače"]', 1, false,
    'Vozilo je ispravno sa ograničenjem. Pročitajte ga prije vožnje.'),
  ('DRIVER','Razduživanje','Kad završite sa vozilom, šta radite u aplikaciji?',
    '["Ništa, vozilo se samo razduži","Pritisnem VRATI i prijavim eventualna oštećenja ili kvar","Ostavim ključ na vozilu","Javim šefu usmeno"]', 1, false,
    'Vozilo se razdužuje u aplikaciji, uz prijavu svakog oštećenja.'),
  ('DRIVER','Aplikacija','Aplikacija piše „Nema veze sa serverom“. Šta radite?',
    '["Zadužim vozilo na papiru i ne javim nikome","Provjerim internet, pokušam ponovo, a ako ne radi javim šefu","Uzmem bilo koje vozilo","Izbrišem aplikaciju"]', 1, false,
    'Bez veze se ne snima ni zaduživanje ni pregled. Javite šefu da vozilo ne ostane bez evidencije.'),
  ('DRIVER','Dnevni pregled','Šta znači rezultat pregleda „Neispravno“ za vozilo?',
    '["Vozilo ostaje dostupno","Vozilo postaje neispravno i ne može se zadužiti, radionica dobija prijavu","Vozilo se briše iz aplikacije","Samo šef smije koristiti vozilo"]', 1, false,
    'Neispravno znači van upotrebe dok radionica ne otkloni kvar.'),

  -- ---------- ŠEF / RADIONICA / INŽENJER ----------
  ('SUPERVISOR','Radionica','Stigao je novi kvar (crveni okvir, oznaka NOVO). Koji je prvi korak?',
    '["Pritisnem PREUZMI KVAR","Pritisnem POPRAVKA ZAVRŠENA","Zatvorim kvar bez akcije","Čekam da ga neko preuzme sam"]', 0, true,
    'Preuzimanjem se upisuje ko je preuzeo i kada. Od tada je kvar u popravci.'),
  ('SUPERVISOR','Radionica','Popravka je završena. Može li sredstvo odmah u upotrebu?',
    '["Da, čim mehaničar pritisne POPRAVKA ZAVRŠENA","Ne, ostaje nedostupno dok šef službe ne uradi pregled i odobri (uključujući probni rad)","Da, ako je kvar bio mali","Da, ako vozač potvrdi"]', 1, true,
    'Sredstvo se pušta tek poslije pregleda šefa službe i funkcionalnog testa.'),
  ('SUPERVISOR','Radionica','Pregled šefa službe nije prošao. Šta se dešava?',
    '["Kvar se zatvara","Kvar se vraća u popravku, ponavljaju se popravka i pregled","Sredstvo se vraća u upotrebu sa napomenom","Kvar se briše"]', 1, true,
    'Neprošao pregled vraća kvar u popravku. Upisuje se šta šef nije prihvatio.'),
  ('SUPERVISOR','Radionica','Kvar je kategorije Elektrika. Ko ga smije preuzeti?',
    '["Bilo ko iz radionice","Samo radnici sa tom kvalifikacijom","Samo vozač koji je prijavio","Samo administrator"]', 1, true,
    'Za Elektriku i Hidrauliku kvar preuzimaju samo radnici sa odgovarajućom kvalifikacijom.'),
  ('SUPERVISOR','Radionica','Sredstvo 3 dana stoji bez ikakve promjene statusa. Šta pokazuje aplikacija i šta treba uraditi?',
    '["Ništa, nije potrebno","Crveno upozorenje; upisati jednu rečenicu statusa","Kvar se automatski zatvara","Sredstvo se vraća u upotrebu"]', 1, false,
    'Poslije 3 dana bez statusa kartica postaje crvena. Dovoljna je jedna rečenica.'),
  ('SUPERVISOR','Radionica','Za veći ili kritičan kvar pregled je prošao. Šta aplikacija radi?',
    '["Ništa posebno","Automatski izdaje potvrdu o puštanju u rad (CRS)","Šalje vozilo u vanjski servis","Briše istoriju popravke"]', 1, false,
    'Za veći i kritičan kvar izdaje se potvrda o puštanju u rad (Part-145.A.50).'),
  ('SUPERVISOR','Radionica','Ista vrsta kvara ponavlja se na istom sredstvu. Na šta upozorava narandžasti znak?',
    '["Treba samo opet popraviti","Treba tražiti pravi uzrok kvara","Treba obrisati prijave","Treba zamijeniti vozača"]', 1, false,
    'Ponavljajući kvar znači da uzrok nije otklonjen.'),
  ('SUPERVISOR','Radionica','Čekate rezervni dio. Kako se to pravilno upisuje?',
    '["Ne upisuje se, upozorenje se ignoriše","Uključi se „Čeka se dio“ i upiše očekivani datum dolaska","Kvar se zatvori i otvori novi","Sredstvo se prebaci u drugu radionicu"]', 1, false,
    'Do upisanog datuma upozorenje se ne pali.'),
  ('SUPERVISOR','Dnevni pregled','Radnik je pri pregledu označio neispravan kočioni sistem. Kakav je ishod?',
    '["Sredstvo ostaje dostupno","Sredstvo postaje neispravno (van upotrebe), prijava ide radionici","Samo upozorenje, sredstvo se koristi","Pregled se poništava"]', 1, true,
    'Blokirajući nedostatak: sredstvo je neispravno i ne može se zadužiti.'),
  ('SUPERVISOR','Radionica','Vozilo je van upotrebe, a posao se mora uraditi. Šta nudi aplikacija?',
    '["Ništa, posao čeka","„Nema sredstva? Zamjena“ pokaže slična slobodna sredstva","Automatski kupuje novo vozilo","Zaduži vozilo drugog radnika"]', 1, false,
    'Zamjena pokazuje slična slobodna sredstva.'),

  -- ---------- ADMINISTRATOR ----------
  ('ADMIN','Ovlaštenja','Radnik ima istekao airside permit. Šta aplikacija radi pri zaduživanju?',
    '["Dozvoljava zaduživanje","Blokira zaduživanje dok se permit ne obnovi","Samo upozori","Briše radnika"]', 1, true,
    'Bez važeće airside dozvole zaduživanje je blokirano.'),
  ('ADMIN','Korisnici','Zaposleni napušta firmu. Kako postupate sa njegovim nalogom?',
    '["Brišem sve njegove zapise","Deaktiviram nalog, a zapisi ostaju sačuvani","Ostavljam nalog aktivnim","Dajem lozinku nasljedniku"]', 1, true,
    'Nalog se deaktivira. Zapisi o obuci i ovlaštenjima se ne brišu.'),
  ('ADMIN','Zapisi','Smiju li se brisati zapisi o ovlaštenjima vozila i obuci vozača?',
    '["Da, čim je vozilo povučeno","Ne, čuvaju se; ovlaštenje se opoziva umjesto brisanja","Da, poslije 6 mjeseci","Da, na zahtjev šefa"]', 1, true,
    'Zapisi se čuvaju najmanje 4 godine (ADR.OR.D.035).'),
  ('ADMIN','Korisnici','Korisnik je zaboravio lozinku. Šta radite?',
    '["Korisnik sam izabere „Zaboravljena lozinka“","Administrator mu postavi novu lozinku","Koristi tuđi nalog","Nalog se briše"]', 1, false,
    'Samostalna promjena lozinke trenutno ne postoji; lozinku postavlja administrator.'),
  ('ADMIN','Kvarovi','Kvar je pogrešno prijavljen (pogrešna težina ili kategorija). Ko ga ispravlja?',
    '["Niko, ostaje kako je","Administrator ispravlja, a izmjena ide u dnevnik promjena","Radnik koji je prijavio, bez traga","Radionica briše prijavu"]', 1, false,
    'Svaka izmjena se bilježi u dnevnik promjena.'),
  ('ADMIN','Ovlaštenja','Ko u aplikaciji smije mijenjati ovlaštenje vozila (zone vožnje, pozivni znak)?',
    '["Svaki radnik","Inženjer ili administrator","Samo vozač","Niko"]', 1, false,
    'Ovlaštenje vozila uređuju inženjer i administrator.'),
  ('ADMIN','Održavanje sistema','Stigla je nova verzija koja sadrži migraciju baze. Šta radite prije puštanja?',
    '["Ništa, baza se sama ažurira","Pokrenem nove migracije redom u Supabase SQL editoru","Obrišem bazu","Pokrenem migracije nasumičnim redom"]', 1, false,
    'Migracije se pokreću ručno, redom po broju.'),
  ('ADMIN','Ovlaštenja','Vozilo nema zapis o ovlaštenju vozila. Može li se zadužiti?',
    '["Ne, nikad","Da, u prelaznom periodu, ali je u registru označeno „bez ovlaštenja“","Samo šef smije","Samo noću"]', 1, false,
    'Prelazno stanje: ovlaštenja treba popuniti za cijelu flotu.');
end $$;
