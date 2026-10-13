-- 029: upravljanje korisnicima + aerodrom (Tivat / Podgorica)
-- Idempotentno. Aerodrom je OZNAKA na korisniku (ne razdvaja podatke).
--   employees.department = naziv službe, employees.role = naziv radnog mjesta (postojeće kolone)
--   profiles.role        = pravo pristupa u aplikaciji (operator / engineer / admin)

alter table public.employees add column if not exists airport text not null default 'TIVAT';
alter table public.profiles  add column if not exists airport text not null default 'TIVAT';

alter table public.employees drop constraint if exists employees_airport_check;
alter table public.employees add constraint employees_airport_check check (airport in ('TIVAT', 'PODGORICA'));
alter table public.profiles  drop constraint if exists profiles_airport_check;
alter table public.profiles  add constraint profiles_airport_check  check (airport in ('TIVAT', 'PODGORICA'));

create index if not exists idx_employees_airport on public.employees(airport);
