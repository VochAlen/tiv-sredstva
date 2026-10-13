import { db } from './all.mjs'
import fs from 'node:fs'
import assert from 'node:assert'
const q = async (sql, params) => (await db.query(sql, params)).rows
const asRole = async (role, fn, sub) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${sub ?? ''}',false);`)
  try { return await fn() } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`) }
}
// grants kao u Supabase
await db.exec(`grant usage on schema public to anon, authenticated; grant all on all tables in schema public to anon, authenticated; grant all on all functions in schema public to anon, authenticated; grant usage on schema auth to anon, authenticated; grant execute on all functions in schema auth to anon, authenticated;`)
// test oprema
await db.exec(`insert into equipment (code,name,type,status,location,department) values
 ('GPU-1','GPU test','GPU','AVAILABLE','A','TEHNICKA_SLUZBA'),
 ('TT-1','Tow test','TOW_TRACTOR','AVAILABLE','A','TEHNICKA_SLUZBA'),
 ('RST-1','Restricted','OTHER','AVAILABLE','A','SLUZBA_PO');
 update equipment set restricted_access=true where code='RST-1';`)
// seed Alen — dvaput (idempotentnost)
const seed = fs.readFileSync('/home/claude/work/fresh/supabase/seed_alen_vocanec.sql','utf8')
await db.exec(seed); await db.exec(seed)
console.log('seed counts', await q(`select (select count(*) from driver_authorizations) d,(select count(*) from equipment_qualifications) q,(select count(*) from maintenance_skills) s,(select count(*) from equipment_access) a,(select count(*) from employees) e`))
// admin + engineer profili
const adm='00000000-0000-0000-0000-0000000000a1', eng='00000000-0000-0000-0000-0000000000e1'
await db.exec(`insert into auth.users(id,email) values ('${adm}','a@x'),('${eng}','e@x'); insert into profiles(id,email,full_name,card_id,role,active) values ('${adm}','a@x','Admin','EMP-9','admin',true),('${eng}','e@x','Eng','EMP-1011','engineer',true) on conflict (id) do update set role=excluded.role, card_id=excluded.card_id, full_name=excluded.full_name, active=true;`)

const okChecklist = [{id:'1',label:'x',passed:true,severity:'BLOCKING',category:'MEHANIKA'}]
const badChecklist = [{id:'1',label:'curi ulje',passed:false,severity:'BLOCKING',category:'HIDRAULIKA'},{id:'2',label:'ok',passed:true,severity:'BLOCKING',category:'OPSTE'}]
const restrictive = [{id:'1',label:'svjetlo',passed:false,severity:'RESTRICTIVE',category:'ELEKTRIKA',restrictionCode:'NO_NIGHT',restrictionLabel:'Bez noćne upotrebe'}]
const out = (code, cl, desc, sev='MINOR') => q(`select fn_check_out_equipment($1,$2,$3,$4::jsonb,null,null,$5,$6) r`,[code,'EMP-1011','Alen Vočanec',JSON.stringify(cl),desc,sev]).then(r=>r[0].r)

// 1) zaduženje bez kvara (anon)
let r = await asRole('anon', () => out('GPU-1', okChecklist, null)); console.log('checkout OK ->', r); assert.equal(r.ok,true)
// 2) isto sredstvo još jednom -> odbijeno
r = await asRole('anon', () => out('GPU-1', okChecklist, null)); assert.equal(r.ok,false); console.log('dupli ->', r.error)
// 3) razduženje
r = await asRole('anon', () => q(`select fn_check_in_equipment('GPU-1','EMP-1011','Alen Vočanec',null,null,'MINOR') r`)).then(x=>x[0].r); console.log('checkin ->', r); assert.equal(r.ok,true)
// 4) zaduženje sa blokirajućim kvarom
r = await asRole('anon', () => out('TT-1', badChecklist, 'Curi ulje', 'MAJOR')); console.log('blokirano ->', r); assert.equal(r.ok,false); assert(r.damageReportId)
console.log('status TT-1', await q(`select status from equipment where code='TT-1'`))
// 5) restriktivna stavka
r = await asRole('anon', () => out('RST-1', restrictive, null)); console.log('ograničeno ->', r); assert.equal(r.ok,true)
// 6) anon NE smije direktno pisati (RLS) i NE smije upisati sliku
for (const [name, sql] of [['assignments',`insert into assignments(equipment_code,equipment_name,employee_card_id,employee_name,action) values ('x','x','x','x','CHECK_OUT')`],['photos',`insert into equipment_photos(photo_data) values ('data:image/jpeg;base64,AAA')`]]) {
  let blocked=false; try { await asRole('anon', () => db.exec(sql)) } catch(e){ blocked=true }
  console.log('anon direct insert', name, blocked ? 'BLOKIRANO (ispravno)' : 'PROŠLO (!)')
}
// 7) FOD i wildlife kao anon (javni insert)
await asRole('anon', () => db.exec(`insert into fod_reports(location,item_type,description,found_by_name) values ('Stand A1','TOOL','ključ','Alen'); insert into wildlife_reports(species,count,location,strike,reported_by_name) values ('galeb',3,'RWY 14','f','Alen')`))
// 8) vidljivost: engineer vidi kvar, FOD, wildlife; anon ne vidi
const vis = async (role,sub) => asRole(role, async () => ({ dmg:(await q('select id from damage_reports')).length, fod:(await q('select id from fod_reports')).length, wl:(await q('select id from wildlife_reports')).length }), sub)
console.log('engineer vidi', await vis('authenticated', eng)); console.log('anon vidi', await vis('anon'))
// 9) uklanjanje FOD-a: engineer može, anon ne
await asRole('authenticated', () => db.exec(`update fod_reports set removed=true, removed_at=now(), removed_by='Eng'`), eng)
console.log('fod removed', await q('select removed, removed_by from fod_reports'))
// 10) audit trag
console.log('audit', (await q('select action from audit_log order by created_at')).map(x=>x.action))
console.log('SIM OK')
// --- tok popravke ---
const dmgId = (await q(`select id from damage_reports limit 1`))[0].id
// engineer (Alen) preuzima i označava popravku direktno (kao TS markRepaired)
await asRole('authenticated', () => db.exec(`update damage_reports set status='IN_REPAIR', acknowledged_at=now(), acknowledged_by='Eng' where id='${dmgId}'`), eng)
await asRole('authenticated', () => db.exec(`update damage_reports set status='AWAITING_APPROVAL', repaired_by_card_id='EMP-1011', repaired_by_name='Alen', repaired_at=now(), resolution='zamijenjen zaptivač' where id='${dmgId}'`), eng)
console.log('nakon popravke', await q(`select status from damage_reports where id='${dmgId}'`))
const ap = await asRole('authenticated', () => q(`select fn_approve_repair($1::uuid,$2,$3) r`,[dmgId,'EMP-9','Admin']), adm)
console.log('odobrenje ->', ap[0].r)
console.log('oprema', await q(`select status, needs_first_use_confirmation from equipment where code='TT-1'`))
r = await asRole('anon', () => out('TT-1', okChecklist, null)); console.log('zaduženje bez potvrde ->', r); assert.equal(r.ok,false); assert.equal(r.needsFirstUseConfirmation,true)
r = await asRole('anon', () => q(`select fn_check_out_equipment('TT-1','EMP-1011','Alen Vočanec',$1::jsonb,null,null,null,'MINOR',true) r`,[JSON.stringify(okChecklist)])).then(x=>x[0].r); console.log('sa potvrdom ->', r.ok); assert.equal(r.ok,true)
console.log('FLOW OK')
// --- wildlife: samo admin uređuje ---
const upd = async (sub, role) => { await asRole(role, () => db.exec(`update wildlife_reports set status='IN_REVIEW', admin_notes='provjereno', updated_by='x'`), sub); return (await q('select status from wildlife_reports'))[0].status }
console.log('admin ->', await upd(adm,'authenticated'))
await db.exec(`update wildlife_reports set status='NEW'`)
console.log('engineer ->', await upd(eng,'authenticated'), '(mora ostati NEW)')
console.log('anon ->', await upd(null,'anon'), '(mora ostati NEW)')
let bad=false; try { await db.exec(`update wildlife_reports set status='XYZ'`) } catch { bad=true }
assert(bad); console.log('WILDLIFE OK')
// --- šta anon radnik čita pri skeniranju ---
for (const t of ['equipment','equipment_manuals','driver_authorizations','equipment_qualifications']) {
  let n; try { n = (await asRole('anon', () => q(`select 1 from ${t}`))).length } catch(e) { n = 'ERR '+e.message }
  console.log('anon čita', t, '->', n)
}
await asRole('anon', () => db.exec(`insert into fitness_declarations(employee_card_id,employee_name,confirmed) values ('EMP-1011','Alen',true)`)); console.log('fitness insert anon OK')
