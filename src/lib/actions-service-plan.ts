'use server'

// Servisni plan: pregled, konfiguracija (admin), evidencija obavljenog servisa (engineer+), podešavanja obavještenja (admin).

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/actions-advanced'
import { localDate, isValidDate } from '@/lib/local-day'
import { projectServices, horizonRange, isHorizon, HORIZON_LABEL, type WorkPlanHorizon } from '@/lib/service-plan'
import { loadPlanRows, type PlanRow } from '@/lib/service-plan-data'
import { mailConfigured, parseEmails, sendMail } from '@/lib/mailer'
import { CHIEF_EMAILS_KEY, getTechChiefEmails } from '@/lib/service-notify'

type Result = { ok: boolean; error?: string }

export interface ServiceRecordRow {
  id: string
  equipmentCode: string
  performedAt: string
  km: number | null
  hours: number | null
  performedBy: 'INTERNAL' | 'EXTERNAL'
  provider: string | null
  invoiceNo: string | null
  cost: number | null
  notes: string | null
  recordedBy: string | null
}

export interface ServicePlanData {
  today: string
  rows: PlanRow[]
  isAdmin: boolean
  chiefEmails: string
  mail: 'smtp' | 'resend' | null
  envChief: boolean
}

async function requireRole(min: 'engineer' | 'admin'): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (min === 'admin' ? user.role !== 'admin' : user.role !== 'admin' && user.role !== 'engineer') {
    throw new Error(`Nemate dozvolu. Potrebna rola: ${min === 'admin' ? 'admin' : 'engineer'}`)
  }
  return user
}

// Pisanje u equipment/servisne tabele: service-role kad postoji (uloga je već provjerena u aplikaciji), inače sesija korisnika.
async function writer() {
  return hasServiceClient() ? createServiceClient() : await createSupabaseClient()
}

export async function getChiefEmailsRaw(): Promise<string> {
  if (isDemoMode()) return (await db.notificationSetting.findUnique({ where: { key: CHIEF_EMAILS_KEY } }))?.value ?? ''
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('notification_settings').select('value').eq('key', CHIEF_EMAILS_KEY).maybeSingle()
  return data?.value ?? ''
}

export async function getServicePlan(): Promise<ServicePlanData> {
  const user = await requireRole('engineer')
  const rows = await loadPlanRows(isDemoMode() ? null : await createSupabaseClient())
  const isAdmin = user.role === 'admin'
  let chiefEmails = ''
  if (isAdmin) { try { chiefEmails = await getChiefEmailsRaw() } catch { /* tabela još ne postoji */ } }
  return { today: localDate(new Date()), rows, isAdmin, chiefEmails, mail: mailConfigured(), envChief: parseEmails(process.env.TECH_CHIEF_EMAIL).length > 0 }
}

export async function getServiceHistory(equipmentId?: string): Promise<ServiceRecordRow[]> {
  await requireRole('engineer')
  if (isDemoMode()) {
    const list = await db.serviceRecord.findMany({ where: equipmentId ? { equipmentId } : {}, orderBy: { performedAt: 'desc' }, take: 100 })
    return list.map((r) => ({ id: r.id, equipmentCode: r.equipmentCode, performedAt: localDate(r.performedAt), km: r.km, hours: r.hours, performedBy: r.performedBy === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL', provider: r.provider, invoiceNo: r.invoiceNo, cost: r.cost, notes: r.notes, recordedBy: r.recordedBy }))
  }
  const supabase = await createSupabaseClient()
  let q = supabase.from('service_records').select('*').order('performed_at', { ascending: false }).order('created_at', { ascending: false }).limit(100)
  if (equipmentId) q = q.eq('equipment_id', equipmentId)
  const { data, error } = await q
  if (error) throw new Error(/service_records/i.test(error.message) ? 'Pokrenite migraciju 032_service_plan_external.sql.' : error.message)
  return (data ?? []).map((r) => ({
    id: r.id, equipmentCode: r.equipment_code, performedAt: r.performed_at, km: r.km == null ? null : Number(r.km), hours: r.hours == null ? null : Number(r.hours),
    performedBy: r.performed_by === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL', provider: r.provider, invoiceNo: r.invoice_no, cost: r.cost == null ? null : Number(r.cost), notes: r.notes, recordedBy: r.recorded_by,
  }))
}

const optNum = (v: unknown, max = 10_000_000): number | null | 'bad' => {
  if (v == null || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) && x >= 0 && x <= max ? x : 'bad'
}
const optText = (v: unknown, max: number) => { const s = String(v ?? '').trim().slice(0, max); return s || null }

export interface PlanConfigInput {
  equipmentId: string
  externallyMaintained: boolean
  provider?: string
  phone?: string
  email?: string
  intervalKm?: number | string | null
  intervalHours?: number | string | null
  intervalMonths?: number | string
  // početno stanje (prvi put / korekcija) - opciono
  lastDate?: string | null
  lastKm?: number | string | null
  lastHours?: number | string | null
}

export async function saveServicePlanConfig(input: PlanConfigInput): Promise<Result> {
  let user: AppUser
  try { user = await requireRole('admin') } catch (e) { return { ok: false, error: (e as Error).message } }
  const km = optNum(input.intervalKm), hrs = optNum(input.intervalHours), lkm = optNum(input.lastKm), lh = optNum(input.lastHours)
  if ([km, hrs, lkm, lh].includes('bad')) return { ok: false, error: 'Intervali i stanja brojača moraju biti brojevi ≥ 0' }
  if ((km === 0) || (hrs === 0)) return { ok: false, error: 'Interval ne može biti 0 (ostavite prazno ako se ne koristi)' }
  const months = Math.round(Number(input.intervalMonths ?? 12))
  if (!Number.isFinite(months) || months < 1 || months > 12) return { ok: false, error: 'Rok servisa je od 1 do 12 mjeseci (godišnji servis je obavezan)' }
  const lastDate = input.lastDate ? String(input.lastDate) : null
  if (lastDate && (!isValidDate(lastDate) || lastDate > localDate(new Date()))) return { ok: false, error: 'Datum zadnjeg servisa nije ispravan (ne može biti u budućnosti)' }
  const email = optText(input.email, 120)
  if (email && !parseEmails(email).length) return { ok: false, error: 'Email servisera nije ispravan' }
  const ext = !!input.externallyMaintained
  const provider = optText(input.provider, 120), phone = optText(input.phone, 40)
  if (ext && !provider) return { ok: false, error: 'Za eksterno održavanje upišite naziv servisera' }

  const patchBase = {
    ext, provider, phone, email, km: km as number | null, hrs: hrs as number | null, months,
    lastDate, lkm: lkm as number | null, lh: lh as number | null,
  }

  if (isDemoMode()) {
    const eq = await db.equipment.findUnique({ where: { id: input.equipmentId } })
    if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
    await db.equipment.update({
      where: { id: eq.id },
      data: {
        externallyMaintained: ext, serviceProvider: provider, serviceProviderPhone: phone, serviceProviderEmail: email,
        serviceIntervalKm: patchBase.km, serviceIntervalHours: patchBase.hrs, serviceIntervalMonths: months,
        ...(lastDate ? { lastServiceDate: new Date(`${lastDate}T12:00:00Z`) } : {}),
        ...(lkm != null ? { lastServiceKm: patchBase.lkm } : {}), ...(lh != null ? { lastServiceHours: patchBase.lh } : {}),
        serviceNotifiedStatus: null, serviceNotifiedAt: null,
      },
    })
  } else {
    const sb = await writer()
    const { error } = await sb.from('equipment').update({
      externally_maintained: ext, service_provider: provider, service_provider_phone: phone, service_provider_email: email,
      service_interval_km: patchBase.km, service_interval_hours: patchBase.hrs, service_interval_months: months,
      ...(lastDate ? { last_service_date: lastDate } : {}),
      ...(lkm != null ? { last_service_km: patchBase.lkm } : {}), ...(lh != null ? { last_service_hours: patchBase.lh } : {}),
      service_notified_status: null, service_notified_at: null,
    }).eq('id', input.equipmentId)
    if (error) return { ok: false, error: error.message }
  }
  await logAudit('SERVICE_PLAN_CONFIG', 'equipment', input.equipmentId, JSON.stringify({ ext, provider, km, hrs, months, lastDate, by: user.email }))
  revalidatePath('/dashboard')
  return { ok: true }
}

export interface RecordServiceInput {
  equipmentId: string
  performedAt: string
  km?: number | string | null
  hours?: number | string | null
  performedBy: 'INTERNAL' | 'EXTERNAL'
  provider?: string
  invoiceNo?: string
  cost?: number | string | null
  notes?: string
}

export async function recordService(input: RecordServiceInput): Promise<Result> {
  let user: AppUser
  try { user = await requireRole('engineer') } catch (e) { return { ok: false, error: (e as Error).message } }
  const today = localDate(new Date())
  if (!isValidDate(input.performedAt) || input.performedAt > today) return { ok: false, error: 'Datum servisa nije ispravan (ne može biti u budućnosti)' }
  const rKm = optNum(input.km), rH = optNum(input.hours), rC = optNum(input.cost, 100_000_000)
  if ([rKm, rH, rC].includes('bad')) return { ok: false, error: 'Km, sati i trošak moraju biti brojevi ≥ 0' }
  const km = rKm as number | null, hours = rH as number | null, cost = rC as number | null
  const by = input.performedBy === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL'
  const provider = optText(input.provider, 120), invoice = optText(input.invoiceNo, 60), notes = optText(input.notes, 500)
  const who = user.full_name || user.email

  if (isDemoMode()) {
    const eq = await db.equipment.findUnique({ where: { id: input.equipmentId } })
    if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
    await db.serviceRecord.create({ data: { equipmentId: eq.id, equipmentCode: eq.code, performedAt: new Date(`${input.performedAt}T12:00:00Z`), km, hours, performedBy: by, provider, invoiceNo: invoice, cost, notes, recordedBy: who } })
    await db.equipment.update({
      where: { id: eq.id },
      data: {
        lastServiceDate: new Date(`${input.performedAt}T12:00:00Z`),
        lastServiceKm: km ?? eq.totalKm, lastServiceHours: hours ?? eq.totalOperatingHours,
        ...(km != null && km > eq.totalKm ? { totalKm: km } : {}),
        ...(hours != null && hours > eq.totalOperatingHours ? { totalOperatingHours: hours } : {}),
        serviceNotifiedStatus: null, serviceNotifiedAt: null,
      },
    })
  } else {
    const sb = await writer()
    const { data: eq, error: e1 } = await sb.from('equipment').select('id,code,total_km,total_operating_hours').eq('id', input.equipmentId).maybeSingle()
    if (e1 || !eq) return { ok: false, error: e1?.message ?? 'Sredstvo nije pronađeno' }
    const curKm = Number(eq.total_km ?? 0), curH = Number(eq.total_operating_hours ?? 0)
    const { error: e2 } = await sb.from('service_records').insert({ equipment_id: eq.id, equipment_code: eq.code, performed_at: input.performedAt, km, hours, performed_by: by, provider, invoice_no: invoice, cost, notes, recorded_by: who })
    if (e2) return { ok: false, error: /service_records/i.test(e2.message) ? 'Pokrenite migraciju 032_service_plan_external.sql.' : e2.message }
    const { error: e3 } = await sb.from('equipment').update({
      last_service_date: input.performedAt, last_service_km: km ?? curKm, last_service_hours: hours ?? curH,
      ...(km != null && km > curKm ? { total_km: km } : {}), ...(hours != null && hours > curH ? { total_operating_hours: hours } : {}),
      service_notified_status: null, service_notified_at: null,
    }).eq('id', eq.id)
    if (e3) return { ok: false, error: `Servis je upisan, ali plan nije osvježen: ${e3.message}` }
  }
  await logAudit('SERVICE_RECORDED', 'equipment', input.equipmentId, JSON.stringify({ performedAt: input.performedAt, km, hours, by, provider, invoice }))
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function saveChiefEmails(raw: string): Promise<Result & { saved?: string }> {
  let user: AppUser
  try { user = await requireRole('admin') } catch (e) { return { ok: false, error: (e as Error).message } }
  const text = String(raw ?? '').trim()
  const list = parseEmails(text)
  if (text && !list.length) return { ok: false, error: 'Nijedna email adresa nije ispravna' }
  const bad = text.split(/[,;\s]+/).filter(Boolean).length - list.length
  if (bad > 0) return { ok: false, error: 'Neka od adresa nije ispravna (razdvojite ih zarezom)' }
  const value = list.join(', ')
  if (isDemoMode()) {
    await db.notificationSetting.upsert({ where: { key: CHIEF_EMAILS_KEY }, update: { value, updatedBy: user.email }, create: { key: CHIEF_EMAILS_KEY, value, updatedBy: user.email } })
  } else {
    const sb = await writer()
    const { error } = await sb.from('notification_settings').upsert({ key: CHIEF_EMAILS_KEY, value, updated_by: user.email, updated_at: new Date().toISOString() })
    if (error) return { ok: false, error: /notification_settings/i.test(error.message) ? 'Pokrenite migraciju 032_service_plan_external.sql.' : error.message }
  }
  await logAudit('CHIEF_EMAILS_SET', 'notification_settings', CHIEF_EMAILS_KEY, value)
  return { ok: true, saved: value }
}

export async function sendTestEmail(): Promise<Result & { to?: string[] }> {
  try { await requireRole('admin') } catch (e) { return { ok: false, error: (e as Error).message } }
  const to = await getTechChiefEmails()
  if (!to.length) return { ok: false, error: 'Prvo upišite i snimite email adresu šefa tehničke službe' }
  const r = await sendMail({ to, subject: '[GSE] Probna poruka', text: 'Ovo je probna poruka iz aplikacije GSE Control. Ako je vidite, obavještenja o kvarovima i servisima rade.' })
  return r.ok ? { ok: true, to } : { ok: false, error: r.error }
}

// =====================================================
// PLAN RADA (projekcija budućih servisa)
// =====================================================

export interface WorkPlanItem {
  date: string
  code: string
  name: string
  reason: 'DATE' | 'KM' | 'HOURS'
  overdue: boolean
  external: boolean
  provider: string | null
  phone: string | null
  department: string | null
}
export interface WorkPlan {
  horizon: WorkPlanHorizon
  label: string
  from: string
  to: string
  today: string
  items: WorkPlanItem[]
  noBaseline: Array<{ code: string; name: string }>
  totals: { all: number; overdue: number; external: number; internal: number; equipment: number }
  byMonth: Array<{ month: string; count: number }>
}

export async function getServiceWorkPlan(horizon: WorkPlanHorizon): Promise<WorkPlan> {
  await requireRole('engineer')
  if (!isHorizon(horizon)) throw new Error('Nepoznat period plana')
  const rows = await loadPlanRows(isDemoMode() ? null : await createSupabaseClient())
  const today = localDate(new Date())
  const { from, to } = horizonRange(horizon, today)

  const items: WorkPlanItem[] = []
  const noBaseline: WorkPlan['noBaseline'] = []
  for (const r of rows) {
    if (!r.lastDate) { noBaseline.push({ code: r.code, name: r.name }); continue }
    const events = projectServices({
      totalKm: r.totalKm, totalHours: r.totalHours, intervalKm: r.intervalKm, intervalHours: r.intervalHours,
      intervalMonths: r.intervalMonths, lastDate: r.lastDate, lastKm: r.lastKm, lastHours: r.lastHours,
    }, today, to)
    for (const e of events) {
      // dospjele servise prikazujemo uvijek (kasne), ostale samo ako upadaju u period
      if (!e.overdue && e.date < from) continue
      items.push({ date: e.date, code: r.code, name: r.name, reason: e.reason, overdue: e.overdue, external: r.external, provider: r.provider, phone: r.phone, department: r.department })
    }
  }
  items.sort((a, b) => (a.overdue === b.overdue ? a.date.localeCompare(b.date) || a.code.localeCompare(b.code) : a.overdue ? -1 : 1))

  const monthMap = new Map<string, number>()
  for (const it of items) if (!it.overdue) monthMap.set(it.date.slice(0, 7), (monthMap.get(it.date.slice(0, 7)) ?? 0) + 1)
  return {
    horizon, label: HORIZON_LABEL[horizon], from, to, today, items, noBaseline,
    totals: {
      all: items.length, overdue: items.filter((i) => i.overdue).length,
      external: items.filter((i) => i.external).length, internal: items.filter((i) => !i.external).length,
      equipment: new Set(items.map((i) => i.code)).size,
    },
    byMonth: [...monthMap.entries()].sort().map(([month, count]) => ({ month, count })),
  }
}
