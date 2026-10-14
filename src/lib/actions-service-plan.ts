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
import { projectServices, horizonRange, isHorizon, isProgram, HORIZON_LABEL, type WorkPlanHorizon, type ServiceProgram, type ServiceKind } from '@/lib/service-plan'
import { loadPlanRows, toServiceInput, type PlanRow } from '@/lib/service-plan-data'
import { persistService, type RecordServiceInput } from '@/lib/service-plan-write'
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
  kind: ServiceKind | null
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
    return list.map((r) => ({ id: r.id, equipmentCode: r.equipmentCode, performedAt: localDate(r.performedAt), km: r.km, hours: r.hours, performedBy: r.performedBy === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL', kind: r.kind === 'MAJOR' || r.kind === 'MINOR' ? r.kind : null, provider: r.provider, invoiceNo: r.invoiceNo, cost: r.cost, notes: r.notes, recordedBy: r.recordedBy }))
  }
  const supabase = await createSupabaseClient()
  let q = supabase.from('service_records').select('*').order('performed_at', { ascending: false }).order('created_at', { ascending: false }).limit(100)
  if (equipmentId) q = q.eq('equipment_id', equipmentId)
  const { data, error } = await q
  if (error) throw new Error(/service_records/i.test(error.message) ? 'Pokrenite migraciju 032_service_plan_external.sql.' : error.message)
  return (data ?? []).map((r) => ({
    id: r.id, equipmentCode: r.equipment_code, performedAt: r.performed_at, km: r.km == null ? null : Number(r.km), hours: r.hours == null ? null : Number(r.hours),
    performedBy: r.performed_by === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL', kind: r.kind === 'MAJOR' || r.kind === 'MINOR' ? r.kind : null, provider: r.provider, invoiceNo: r.invoice_no, cost: r.cost == null ? null : Number(r.cost), notes: r.notes, recordedBy: r.recorded_by,
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
  // program održavanja po AHM 917
  program: ServiceProgram
  intervalKm?: number | string | null // OEM minor
  intervalHours?: number | string | null
  intervalMonths?: number | string | null
  majorMonths?: number | string | null // OEM major
  majorHours?: number | string | null
  majorKm?: number | string | null
  variationNote?: string
  // početno stanje (prvi put / korekcija) - opciono
  lastDate?: string | null
  lastKm?: number | string | null
  lastHours?: number | string | null
  lastMajorDate?: string | null
  lastMajorKm?: number | string | null
  lastMajorHours?: number | string | null
  /** Isti program (bez baznih stanja, servisera i varijacije) primijeni na sva sredstva istog tipa */
  applyProgramToType?: boolean
}

export async function saveServicePlanConfig(input: PlanConfigInput): Promise<Result & { applied?: number }> {
  let user: AppUser
  try { user = await requireRole('admin') } catch (e) { return { ok: false, error: (e as Error).message } }
  if (!isProgram(input.program)) return { ok: false, error: 'Izaberite program održavanja' }
  const oem = input.program === 'OEM'
  const nums = {
    km: optNum(input.intervalKm), hrs: optNum(input.intervalHours), mHrs: optNum(input.majorHours), mKm: optNum(input.majorKm),
    lkm: optNum(input.lastKm), lh: optNum(input.lastHours), lmkm: optNum(input.lastMajorKm), lmh: optNum(input.lastMajorHours),
  }
  if (Object.values(nums).includes('bad')) return { ok: false, error: 'Intervali i stanja brojača moraju biti brojevi ≥ 0' }
  const v = nums as Record<keyof typeof nums, number | null>
  if (oem && [v.km, v.hrs, v.mHrs, v.mKm].some((x) => x === 0)) return { ok: false, error: 'Interval ne može biti 0 (ostavite prazno ako se ne koristi)' }
  const monthsOf = (raw: unknown): number | null | 'bad' => {
    if (raw == null || raw === '') return null
    const m = Math.round(Number(raw))
    return Number.isFinite(m) && m >= 1 && m <= 12 ? m : 'bad' as const
  }
  const minorM = monthsOf(input.intervalMonths), majorM = monthsOf(input.majorMonths)
  if (oem && (minorM === 'bad' || majorM === 'bad')) return { ok: false, error: 'Rok u mjesecima je od 1 do 12 (major servis je obavezan najmanje jednom godišnje)' }
  const today = localDate(new Date())
  const dateOk = (d: string | null | undefined) => !d || (isValidDate(d) && d <= today)
  const lastDate = input.lastDate ? String(input.lastDate) : null
  const lastMajorDate = input.lastMajorDate ? String(input.lastMajorDate) : null
  if (!dateOk(lastDate) || !dateOk(lastMajorDate)) return { ok: false, error: 'Datum servisa nije ispravan (ne može biti u budućnosti)' }
  if (lastDate && lastMajorDate && lastMajorDate > lastDate) return { ok: false, error: 'Zadnji major servis ne može biti noviji od zadnjeg servisa' }
  const email = optText(input.email, 120)
  if (email && !parseEmails(email).length) return { ok: false, error: 'Email servisera nije ispravan' }
  const ext = !!input.externallyMaintained
  const provider = optText(input.provider, 120), phone = optText(input.phone, 40)
  if (ext && !provider) return { ok: false, error: 'Za eksterno održavanje upišite naziv servisera' }
  const note = oem ? optText(input.variationNote, 300) : null

  // IATA programi koriste fiksne intervale - OEM polja se brišu (da ne zbunjuju)
  const prog = {
    program: input.program,
    km: oem ? v.km : null, hrs: oem ? v.hrs : null, minorM: oem ? (minorM as number | null) ?? 12 : 12,
    majorM: oem ? (majorM as number | null) : null, mHrs: oem ? v.mHrs : null, mKm: oem ? v.mKm : null, note,
  }
  let applied = 0

  if (isDemoMode()) {
    const eq = await db.equipment.findUnique({ where: { id: input.equipmentId } })
    if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
    await db.equipment.update({
      where: { id: eq.id },
      data: {
        externallyMaintained: ext, serviceProvider: provider, serviceProviderPhone: phone, serviceProviderEmail: email,
        serviceProgram: prog.program, serviceIntervalKm: prog.km, serviceIntervalHours: prog.hrs, serviceIntervalMonths: prog.minorM,
        majorIntervalMonths: prog.majorM, majorIntervalHours: prog.mHrs, majorIntervalKm: prog.mKm, serviceVariationNote: prog.note,
        ...(lastDate ? { lastServiceDate: new Date(`${lastDate}T12:00:00Z`) } : {}),
        ...(v.lkm != null ? { lastServiceKm: v.lkm } : {}), ...(v.lh != null ? { lastServiceHours: v.lh } : {}),
        ...(lastMajorDate ? { lastMajorDate: new Date(`${lastMajorDate}T12:00:00Z`) } : {}),
        ...(v.lmkm != null ? { lastMajorKm: v.lmkm } : {}), ...(v.lmh != null ? { lastMajorHours: v.lmh } : {}),
        serviceNotifiedStatus: null, serviceNotifiedAt: null,
      },
    })
    if (input.applyProgramToType) {
      const r = await db.equipment.updateMany({
        where: { type: eq.type, id: { not: eq.id } },
        data: { serviceProgram: prog.program, serviceIntervalKm: prog.km, serviceIntervalHours: prog.hrs, serviceIntervalMonths: prog.minorM, majorIntervalMonths: prog.majorM, majorIntervalHours: prog.mHrs, majorIntervalKm: prog.mKm, serviceNotifiedStatus: null, serviceNotifiedAt: null },
      })
      applied = r.count
    }
  } else {
    const sb = await writer()
    const { data: eq, error: e0 } = await sb.from('equipment').select('id,type').eq('id', input.equipmentId).maybeSingle()
    if (e0 || !eq) return { ok: false, error: e0?.message ?? 'Sredstvo nije pronađeno' }
    const { error } = await sb.from('equipment').update({
      externally_maintained: ext, service_provider: provider, service_provider_phone: phone, service_provider_email: email,
      service_program: prog.program, service_interval_km: prog.km, service_interval_hours: prog.hrs, service_interval_months: prog.minorM,
      major_interval_months: prog.majorM, major_interval_hours: prog.mHrs, major_interval_km: prog.mKm, service_variation_note: prog.note,
      ...(lastDate ? { last_service_date: lastDate } : {}),
      ...(v.lkm != null ? { last_service_km: v.lkm } : {}), ...(v.lh != null ? { last_service_hours: v.lh } : {}),
      ...(lastMajorDate ? { last_major_date: lastMajorDate } : {}),
      ...(v.lmkm != null ? { last_major_km: v.lmkm } : {}), ...(v.lmh != null ? { last_major_hours: v.lmh } : {}),
      service_notified_status: null, service_notified_at: null,
    }).eq('id', input.equipmentId)
    if (error) return { ok: false, error: /service_program|major_|last_major|service_variation/i.test(error.message) ? 'Pokrenite migracije 033 i 034 (supabase/MIGRATIONS.md).' : error.message }
    if (input.applyProgramToType) {
      const { data, error: e2 } = await sb.from('equipment').update({
        service_program: prog.program, service_interval_km: prog.km, service_interval_hours: prog.hrs, service_interval_months: prog.minorM,
        major_interval_months: prog.majorM, major_interval_hours: prog.mHrs, major_interval_km: prog.mKm,
        service_notified_status: null, service_notified_at: null,
      }).eq('type', eq.type).neq('id', eq.id).select('id')
      if (e2) return { ok: false, error: `Sredstvo je snimljeno, ali primjena na tip nije uspjela: ${e2.message}` }
      applied = data?.length ?? 0
    }
  }
  await logAudit('SERVICE_PLAN_CONFIG', 'equipment', input.equipmentId, JSON.stringify({ ext, provider, program: prog.program, minor: [prog.km, prog.hrs, prog.minorM], major: [prog.mKm, prog.mHrs, prog.majorM], note, lastDate, lastMajorDate, applied, by: user.email }))
  revalidatePath('/dashboard')
  return { ok: true, applied }
}

export async function recordService(input: RecordServiceInput): Promise<Result> {
  let user: AppUser
  try { user = await requireRole('engineer') } catch (e) { return { ok: false, error: (e as Error).message } }
  return persistService(input, user.full_name || user.email)
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
  kind: ServiceKind
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
    const events = projectServices(toServiceInput(r), today, to)
    for (const e of events) {
      // dospjele servise prikazujemo uvijek (kasne), ostale samo ako upadaju u period
      if (!e.overdue && e.date < from) continue
      items.push({ date: e.date, code: r.code, name: r.name, kind: e.kind, reason: e.reason, overdue: e.overdue, external: r.external, provider: r.provider, phone: r.phone, department: r.department })
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
