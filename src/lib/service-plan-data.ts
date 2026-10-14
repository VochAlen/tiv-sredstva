// Učitavanje servisnog plana (Prisma u demo modu, Supabase inače). Nije 'use server' - dijele ga akcije i cron.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { localDate } from '@/lib/local-day'
import {
  computeServiceStatus, resolveProgram, isProgram,
  type ServiceResult, type ServiceProgram, type ServiceInput, type Level,
} from '@/lib/service-plan'

export interface PlanRow {
  id: string
  code: string
  name: string
  type: string
  status: string
  department: string | null
  totalKm: number
  totalHours: number
  external: boolean
  provider: string | null
  phone: string | null
  email: string | null
  // program održavanja (AHM 917)
  program: ServiceProgram // efektivni
  programRaw: ServiceProgram | null // kako je upisano (null = nije izabran)
  minor: Level
  major: Level
  intervalKm: number | null // OEM minor
  intervalHours: number | null
  intervalMonths: number
  majorMonths: number | null // OEM major
  majorHours: number | null
  majorKm: number | null
  variationNote: string | null
  // baze
  lastDate: string | null
  lastKm: number | null
  lastHours: number | null
  lastMajorDate: string | null
  lastMajorKm: number | null
  lastMajorHours: number | null
  notifiedStatus: string | null
  result: ServiceResult
}

const COLS = 'id,code,name,type,status,department,total_km,total_operating_hours,externally_maintained,service_provider,service_provider_phone,service_provider_email,service_interval_km,service_interval_hours,service_interval_months,last_service_date,last_service_km,last_service_hours,service_notified_status,service_program,major_interval_months,major_interval_hours,major_interval_km,last_major_date,last_major_km,last_major_hours,service_variation_note'

const n = (v: unknown): number | null => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)

type Raw = Omit<PlanRow, 'result' | 'program' | 'minor' | 'major'>

export function toServiceInput(r: Pick<PlanRow, 'totalKm' | 'totalHours' | 'minor' | 'major' | 'lastDate' | 'lastKm' | 'lastHours' | 'lastMajorDate' | 'lastMajorKm' | 'lastMajorHours'>): ServiceInput {
  return {
    totalKm: r.totalKm, totalHours: r.totalHours, minor: r.minor, major: r.major,
    last: { date: r.lastDate, km: r.lastKm, hours: r.lastHours },
    lastMajor: { date: r.lastMajorDate, km: r.lastMajorKm, hours: r.lastMajorHours },
  }
}

function finish(raw: Raw, today: string): PlanRow {
  const p = resolveProgram({
    program: raw.programRaw, minorKm: raw.intervalKm, minorHours: raw.intervalHours, minorMonths: raw.programRaw === 'OEM' || (!raw.programRaw && (raw.intervalKm || raw.intervalHours)) ? raw.intervalMonths : null,
    majorKm: raw.majorKm, majorHours: raw.majorHours, majorMonths: raw.majorMonths,
  })
  const row = { ...raw, program: p.program, minor: p.minor, major: p.major }
  return { ...row, result: computeServiceStatus(toServiceInput(row), today) }
}

export async function loadPlanRows(supabase: any | null): Promise<PlanRow[]> {
  const today = localDate(new Date())
  if (isDemoMode()) {
    const list = await db.equipment.findMany({ orderBy: { code: 'asc' } })
    return list.map((e) => finish({
      id: e.id, code: e.code, name: e.name, type: e.type, status: e.status, department: e.department,
      totalKm: e.totalKm ?? 0, totalHours: e.totalOperatingHours ?? 0, external: e.externallyMaintained,
      provider: e.serviceProvider, phone: e.serviceProviderPhone, email: e.serviceProviderEmail,
      programRaw: isProgram(e.serviceProgram) ? e.serviceProgram : null,
      intervalKm: e.serviceIntervalKm, intervalHours: e.serviceIntervalHours, intervalMonths: e.serviceIntervalMonths || 12,
      majorMonths: e.majorIntervalMonths, majorHours: e.majorIntervalHours, majorKm: e.majorIntervalKm, variationNote: e.serviceVariationNote,
      lastDate: e.lastServiceDate ? localDate(e.lastServiceDate) : null, lastKm: e.lastServiceKm, lastHours: e.lastServiceHours,
      lastMajorDate: e.lastMajorDate ? localDate(e.lastMajorDate) : null, lastMajorKm: e.lastMajorKm, lastMajorHours: e.lastMajorHours,
      notifiedStatus: e.serviceNotifiedStatus,
    }, today))
  }
  if (!supabase) throw new Error('Supabase klijent nije dostupan')
  const rows: PlanRow[] = []
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await supabase.from('equipment').select(COLS).order('code').range(from, from + 999)
    if (error) {
      if (/externally_maintained|service_|last_service|last_major|major_interval/i.test(error.message)) throw new Error('Pokrenite migracije 032, 033 i 034 (supabase/MIGRATIONS.md) u Supabase SQL editoru.')
      throw new Error(error.message)
    }
    for (const e of data ?? []) {
      rows.push(finish({
        id: e.id, code: e.code, name: e.name, type: e.type, status: e.status, department: e.department ?? null,
        totalKm: n(e.total_km) ?? 0, totalHours: n(e.total_operating_hours) ?? 0, external: !!e.externally_maintained,
        provider: e.service_provider ?? null, phone: e.service_provider_phone ?? null, email: e.service_provider_email ?? null,
        programRaw: isProgram(e.service_program) ? e.service_program : null,
        intervalKm: n(e.service_interval_km), intervalHours: n(e.service_interval_hours), intervalMonths: e.service_interval_months || 12,
        majorMonths: n(e.major_interval_months), majorHours: n(e.major_interval_hours), majorKm: n(e.major_interval_km), variationNote: e.service_variation_note ?? null,
        lastDate: e.last_service_date ?? null, lastKm: n(e.last_service_km), lastHours: n(e.last_service_hours),
        lastMajorDate: e.last_major_date ?? null, lastMajorKm: n(e.last_major_km), lastMajorHours: n(e.last_major_hours),
        notifiedStatus: e.service_notified_status ?? null,
      }, today))
    }
    if (!data || data.length < 1000) break
  }
  return rows
}
