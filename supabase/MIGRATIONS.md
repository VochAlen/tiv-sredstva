# Redoslijed migracija

Migracije se primjenjuju **ovim redom** (leksikografski po imenu fajla — isti redoslijed koji
koristi `ls` i Supabase SQL editor). Četiri broja (016–019) imaju po dva fajla; redoslijed unutar
para je fiksan i ne smije se mijenjati:

| # | Fajl |
|---|------|
| 1 | 016_secure_checkout_checklist_qualifications.sql |
| 2 | 016_security_hardening_rls.sql |
| 3 | 017_real_fleet_types_repair_approval.sql |
| 4 | 017_security_hardening_read_mismatch.sql |
| 5 | 018_incident_number_sequence.sql |
| 6 | 018_maintenance_skills_by_category.sql |
| 7 | 019_hour_meter_odometer_checkin.sql |
| 8 | 019_security_hardening_engineer_read.sql |
| 9 | 020_fod_wildlife_fitness.sql |
| 10 | 021_equipment_department_inspection_tracking.sql |
| 11 | 022_notification_triggers.sql |
| 12 | 023_audit_trail.sql |
| 13 | 024_fod_removal.sql |
| 14 | 025_wildlife_admin.sql |

Fajlovi **nisu** preimenovani namjerno: ako ste ih već pokretali ručno po broju, preimenovanje
ništa ne popravlja a pravi zabunu. Duplirani brojevi smetaju samo Supabase CLI-ju (`supabase db push`),
koji traži jedinstvenu numeričku verziju — ako ga počnete koristiti, preimenovanje se radi jednom,
zajedno sa `supabase migration repair`. Sve migracije su pisane da se mogu bezbjedno pokrenuti
ponovo (`if not exists` / `drop ... if exists`).
