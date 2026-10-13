import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const dir='/home/claude/work/fresh/supabase/migrations/'
const order=`001_initial_schema.sql 002_advanced_features.sql 003_easa_compliance.sql 004_adr_ops_c007.sql 005_equipment_manuals.sql 006_equipment_access.sql 007_certificate_of_release.sql 008_scheduling_spare_parts.sql 009_incidents_driver_auth.sql 010_fuel_parking.sql 011_deicing.sql 012_aerodrome_inspection.sql 013_sms.sql 014_audit_compliance.sql 015_document_control.sql 016_secure_checkout_checklist_qualifications.sql 016_security_hardening_rls.sql 017_real_fleet_types_repair_approval.sql 017_security_hardening_read_mismatch.sql 018_incident_number_sequence.sql 018_maintenance_skills_by_category.sql 019_hour_meter_odometer_checkin.sql 019_security_hardening_engineer_read.sql 020_fod_wildlife_fitness.sql 021_equipment_department_inspection_tracking.sql 022_notification_triggers.sql 023_audit_trail.sql 024_fod_removal.sql 025_wildlife_admin.sql`.split(/\s+/)
export const db = new PGlite()
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
create schema if not exists extensions;
`)
let failed=0
for (const f of order) {
  try { await db.exec(fs.readFileSync(dir+f,'utf8')); console.log('ok  ',f) }
  catch(e){ failed++; console.log('FAIL',f,'::',e.message.split('\n')[0]) }
}
console.log('failed:',failed)
