import { db } from './all.mjs'
import assert from 'node:assert'
const q = async (sql, params) => (await db.query(sql, params)).rows
const asRole = async (role, fn, sub) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${sub ?? ''}',false);`)
  try { return await fn() } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`) }
}
await db.exec(`grant usage on schema public to anon, authenticated; grant all on all tables in schema public to anon, authenticated; grant all on all functions in schema public to anon, authenticated; grant usage on schema auth to anon, authenticated; grant execute on all functions in schema auth to anon, authenticated;`)
await db.exec(`insert into equipment (code,name,type,status,location,department) values ('V-1','Vozilo 1','TOW_TRACTOR','AVAILABLE','A','TEHNICKA_SLUZBA'),('V-2','Vozilo 2','GPU','AVAILABLE','A','TEHNICKA_SLUZBA');`)
const L=(over={})=>{const base=[
 {id:'fluids',label:'ulje',passed:true,severity:'BLOCKING',category:'MEHANIKA'},
 {id:'lights',label:'Svjetla',passed:true,severity:'RESTRICTIVE',category:'ELEKTRIKA',restrictionCode:'DAYTIME_ONLY',restrictionLabel:'Koristiti isključivo po danu'},
 {id:'wipers',label:'Brisači',passed:true,severity:'RESTRICTIVE',category:'ELEKTRIKA',restrictionCode:'FAIR_WEATHER_ONLY',restrictionLabel:'Koristiti samo po lijepom vremenu (ne po kiši)'},
 {id:'brakes',label:'Kočnice',passed:true,severity:'BLOCKING',category:'MEHANIKA',damageSeverity:'CRITICAL'},
 {id:'clean',label:'Čistoća',passed:true,severity:'MINOR',category:'OPSTE'}]
 return base.map(i=>({...i,passed: over[i.id]===false?false:true}))}
const insp=(code,cl,role='anon')=>asRole(role,()=>q(`select fn_create_daily_inspection($1,'EMP-9','Admin','MORNING',$2::jsonb,'napomena') r`,[code,JSON.stringify(cl)]),role==='authenticated'?'00000000-0000-0000-0000-0000000000a1':undefined).then(r=>r[0].r)
const eq=async c=>(await q(`select status,fitness_status,active_restrictions from equipment where code=$1`,[c]))[0]
const dmg=async c=>await q(`select severity,category,restriction_code,status,source_item from damage_reports where equipment_code=$1 order by source_item`,[c])

let r=await insp('V-1',L({lights:false})); console.log('svjetla ->',r); assert.equal(r.result,'CONDITIONAL'); assert.equal(r.restrictive,1)
let e=await eq('V-1'); console.log(e); assert.equal(e.status,'AVAILABLE'); assert.equal(e.active_restrictions[0].code,'DAYTIME_ONLY')
r=await insp('V-1',L({lights:false,wipers:false})); console.log('+brisači ->',r); e=await eq('V-1'); console.log(e.active_restrictions.map(x=>x.code)); assert.equal(e.active_restrictions.length,2)
console.log(await dmg('V-1')); assert.equal((await dmg('V-1')).length,2) // nema duplikata za svjetla

// razduženje (simulacija) ne smije obrisati ograničenja
await db.exec(`update equipment set status='ASSIGNED' where code='V-1'; update equipment set status='AVAILABLE', active_restrictions=null, notes=null where code='V-1'`)
e=await eq('V-1'); console.log('nakon razduženja', e.active_restrictions.map(x=>x.code)); assert.equal(e.active_restrictions.length,2)

// kočnice -> UNFIT + OUT_OF_SERVICE + CRITICAL kvar
r=await insp('V-2',L({brakes:false}),'authenticated'); console.log('kočnice ->',r); assert.equal(r.result,'UNFIT')
e=await eq('V-2'); console.log(e); assert.equal(e.status,'OUT_OF_SERVICE')
console.log(await dmg('V-2')); assert.equal((await dmg('V-2'))[0].severity,'CRITICAL')
r=await insp('V-2',L({brakes:false})); assert.equal((await dmg('V-2')).length,1); console.log('ponovljeni pregled - bez duplikata OK')

// kvar svjetla riješen -> ograničenje nestaje, brisači ostaju
await db.exec(`update damage_reports set status='RESOLVED' where equipment_code='V-1' and source_item='daily:lights'`)
e=await eq('V-1'); console.log('nakon rješavanja svjetala', e.active_restrictions.map(x=>x.code)); assert.deepEqual(e.active_restrictions.map(x=>x.code),['FAIR_WEATHER_ONLY'])
await db.exec(`update damage_reports set status='RESOLVED' where equipment_code='V-1'`)
e=await eq('V-1'); console.log('sve riješeno', e.active_restrictions); assert.equal(e.active_restrictions,null)

// radni nalog: engineer upisuje dijelove
const eng='00000000-0000-0000-0000-0000000000e1', adm='00000000-0000-0000-0000-0000000000a1'
await db.exec(`insert into auth.users(id,email) values ('${adm}','a@x'),('${eng}','e@x') on conflict do nothing; insert into profiles(id,email,full_name,card_id,role,active) values ('${adm}','a@x','Admin','EMP-9','admin',true),('${eng}','e@x','Eng','EMP-1011','engineer',true) on conflict (id) do update set role=excluded.role, active=true;`)
await asRole('authenticated',()=>db.exec(`update damage_reports set parts_json='[{"name":"Pločice","qty":2}]'::jsonb, work_hours=1.5, work_cost=40, worker_names='Alen, Marko', resolution='zamijenjeno' where equipment_code='V-2'`),eng)
console.log('radni nalog', await q(`select parts_json,work_hours,worker_names from damage_reports where equipment_code='V-2'`))
// anon ne smije direktno upisati kvar
let blocked=false; try{ await asRole('anon',()=>db.exec(`insert into damage_reports(equipment_code,equipment_name,reported_by_card_id,reported_by_name,description) values ('x','x','x','x','x')`)) }catch{blocked=true}
console.log('anon direktan insert kvara', blocked?'BLOKIRANO':'PROŠLO (!)')
console.log('GOTOVO')
