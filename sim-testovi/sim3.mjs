import { db } from './all.mjs'
import assert from 'node:assert'
const q = async (sql, params) => (await db.query(sql, params)).rows
const asRole = async (role, fn, sub) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${sub ?? ''}',false);`)
  try { return await fn() } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`) }
}
await db.exec(`grant usage on schema public to anon, authenticated; grant all on all tables in schema public to anon, authenticated; grant all on all functions in schema public to anon, authenticated; grant usage on schema auth to anon, authenticated; grant execute on all functions in schema auth to anon, authenticated;`)
await db.exec(`insert into equipment (code,name,type,status,location,department) values ('GPU-1','GPU','GPU','AVAILABLE','A','TEHNICKA_SLUZBA'),('DEL-1','Pogrešno uneseno','OTHER','AVAILABLE','A','TEHNICKA_SLUZBA'),('TT-1','Tow','TOW_TRACTOR','AVAILABLE','A','TEHNICKA_SLUZBA');`)
const adm='00000000-0000-0000-0000-0000000000a1', eng='00000000-0000-0000-0000-0000000000e1'
await db.exec(`insert into auth.users(id,email) values ('${adm}','a@x'),('${eng}','e@x'); insert into profiles(id,email,full_name,card_id,role,active) values ('${adm}','a@x','Admin','EMP-9','admin',true),('${eng}','e@x','Eng','EMP-1011','engineer',true) on conflict (id) do update set role=excluded.role, card_id=excluded.card_id, full_name=excluded.full_name, active=true;`)
const ok=[{id:'1',label:'x',passed:true,severity:'BLOCKING',category:'MEHANIKA'}]
const bad=[{id:'1',label:'kočnice',passed:false,severity:'BLOCKING',category:'MEHANIKA'}]
const insp=(code,cl)=>q(`select fn_create_daily_inspection($1,$2,$3,$4,$5::jsonb,null) r`,[code,'EMP-9','Admin','MORNING',JSON.stringify(cl)]).then(r=>r[0].r)

// 1) fn_create_daily_inspection: authenticated + anon
let r = await asRole('authenticated',()=>insp('GPU-1',ok),adm); console.log('inspekcija (auth) ->',r)
r = await asRole('anon',()=>insp('TT-1',bad)); console.log('inspekcija neispravno (anon) ->',r)
console.log('di rows', await q(`select equipment_code,result from daily_inspections order by equipment_code`))
// direktan insert za anon mora biti blokiran
let blocked=false; try{ await asRole('anon',()=>db.exec(`insert into daily_inspections(equipment_code,equipment_name,inspector_card_id,inspector_name,shift,checklist_json,result) values ('x','x','x','x','MORNING','[]','FIT')`)) }catch{blocked=true}
console.log('anon direct insert daily_inspections', blocked?'BLOKIRANO (ispravno)':'PROŠLO (!)'); assert(blocked)

// 2) čitanje tabela autorizacije bez service ključa (koristi getInspectableEquipment)
for (const t of ['driver_authorizations','equipment_qualifications','equipment_access']) {
  for (const [role,sub] of [['authenticated',eng],['anon',undefined]]) {
    let n; try{ n=(await asRole(role,()=>q(`select 1 from ${t}`),sub)).length }catch(e){ n='GREŠKA' }
    console.log('read',t,'as',role,'->',n)
  }
}

// 3) admin izmjene pod RLS
await db.exec(`insert into employees(card_id,name) values ('EMP-5','Test') on conflict do nothing;`)
const empId=(await q(`select id from employees where card_id='EMP-5'`))[0].id
const ins = (role,sub)=>asRole(role,()=>db.exec(`insert into equipment_qualifications(employee_id,employee_card_id,employee_name,equipment_type,qualification_level) values ('${empId}','EMP-5','Test','GPU','OPERATOR')`),sub)
await ins('authenticated',adm); console.log('admin insert qual OK')
const qid=(await q(`select id from equipment_qualifications where employee_card_id='EMP-5'`))[0].id
for (const [role,sub,label] of [['authenticated',adm,'admin'],['authenticated',eng,'engineer']]) {
  await asRole(role,()=>db.exec(`update equipment_qualifications set qualification_level='SENIOR' where id='${qid}'`),sub)
  console.log(label,'update qual ->',(await q(`select qualification_level l from equipment_qualifications where id='${qid}'`))[0].l)
}
await asRole('authenticated',()=>db.exec(`insert into maintenance_skills(employee_card_id,employee_name,category,level) values ('EMP-5','Test','MEHANIKA','CERTIFIED')`),adm)
await asRole('authenticated',()=>db.exec(`update maintenance_skills set valid_until='2030-01-01' where employee_card_id='EMP-5'`),adm)
await asRole('authenticated',()=>db.exec(`delete from maintenance_skills where employee_card_id='EMP-5' and category='MEHANIKA'`),adm)
console.log('skills left', (await q(`select 1 from maintenance_skills where employee_card_id='EMP-5'`)).length)
await asRole('authenticated',()=>db.exec(`delete from equipment_qualifications where id='${qid}'`),adm)
console.log('quals left', (await q(`select 1 from equipment_qualifications where employee_card_id='EMP-5'`)).length)

// maintenance_log update (admin)
const gid=(await q(`select id from equipment where code='GPU-1'`))[0].id
await db.exec(`insert into maintenance_log(equipment_id,equipment_code,equipment_name,maintenance_type,description,performed_by,status) values ('${gid}','GPU-1','GPU','PREVENTIVE','Servis','Pero','COMPLETED')`).catch(e=>console.log('ml insert err',e.message.split('\n')[0]))
await asRole('authenticated',()=>db.exec(`update maintenance_log set status='CANCELLED', updated_at=now() where equipment_code='GPU-1'`),adm)
console.log('log status', (await q(`select status from maintenance_log where equipment_code='GPU-1'`)))
// damage_reports update (admin)
await asRole('authenticated',()=>db.exec(`update damage_reports set severity='CRITICAL', description='ispravljeno', category='ELEKTRIKA'`),adm)
console.log('damage', await q(`select severity,category,description from damage_reports limit 1`))

// 4) brisanje sredstva: bez historije prolazi, sa historijom guard (aplikacijski) — provjera cascade-a
const did=(await q(`select id from equipment where code='DEL-1'`))[0].id
await asRole('authenticated',()=>db.exec(`delete from equipment where id='${did}'`),adm)
console.log('DEL-1 obrisano', (await q(`select 1 from equipment where code='DEL-1'`)).length===0)
await asRole('authenticated',()=>db.exec(`delete from equipment where code='TT-1'`),eng)
console.log('engineer delete equipment -> ostaje', (await q(`select 1 from equipment where code='TT-1'`)).length===1)
const hist = await q(`select (select count(*) from daily_inspections where equipment_id=(select id from equipment where code='TT-1')) di`)
console.log('TT-1 ima historiju pregleda (guard ga mora zaštititi):', hist)
console.log('audit', await q(`select action,count(*) from audit_log group by 1 order by 1`))
console.log('GOTOVO')
