// SAMO za server (nije 'use server'). Pregled rezultata testova: upit sa filterima, detalji pokušaja i CSV.
// Koriste ga akcije (tabela na dashboardu) i API rute (CSV, PDF mentorski izvještaj).

import { createServiceClient } from '@/lib/supabase/service'

export type ResultSort = 'taken_at' | 'employee_name' | 'employee_card_id' | 'score_pct' | 'kind' | 'passed'
const SORTS: ResultSort[] = ['taken_at', 'employee_name', 'employee_card_id', 'score_pct', 'kind', 'passed']
const KINDS = ['INITIAL', 'RANDOM', 'PERIODIC', 'RETEST', 'SELF']
const TZ = 'Europe/Podgorica'

export const KIND_LABEL: Record<string, string> = { INITIAL: 'Početna', RANDOM: 'Nasumična', PERIODIC: 'Periodična', RETEST: 'Ponovni test', SELF: 'Samostalno' }

export interface ResultFilters {
  q?: string
  department?: string
  from?: string // YYYY-MM-DD (lokalni datum)
  to?: string
  outcome?: 'ALL' | 'PASSED' | 'FAILED'
  kind?: string
  sort?: ResultSort
  dir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface ResultRow {
  id: string
  takenAt: string
  name: string
  cardId: string
  department: string
  kind: string
  audience: string
  scorePct: number
  passed: boolean
  criticalFailed: boolean
  right: number
  total: number
  takenBy: string | null
}

export interface ResultPage { rows: ResultRow[]; total: number; page: number; pageSize: number; departments: string[] }

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Početak lokalnog dana (Europe/Podgorica) kao ISO instant; dayOffset=1 daje početak sljedećeg dana. */
export function zonedDayStart(ymd: string, dayOffset = 0): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d + dayOffset, 0, 0, 0))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(guess)
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return new Date(guess.getTime() - (asUtc - guess.getTime())).toISOString()
}

const cleanQ = (q: string) => q.replace(/[%_,()*\\"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)

export function cleanFilters(f: ResultFilters): Required<Pick<ResultFilters, 'outcome' | 'sort' | 'dir' | 'page' | 'pageSize'>> & ResultFilters {
  return {
    q: cleanQ(String(f.q ?? '')),
    department: String(f.department ?? '').trim().slice(0, 80),
    from: f.from && YMD.test(f.from) ? f.from : undefined,
    to: f.to && YMD.test(f.to) ? f.to : undefined,
    outcome: f.outcome === 'PASSED' || f.outcome === 'FAILED' ? f.outcome : 'ALL',
    kind: f.kind && KINDS.includes(f.kind) ? f.kind : undefined,
    sort: SORTS.includes(f.sort as ResultSort) ? (f.sort as ResultSort) : 'taken_at',
    dir: f.dir === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Math.floor(Number(f.page) || 1)),
    pageSize: Math.min(1000, Math.max(1, Math.floor(Number(f.pageSize) || 25))),
  }
}

export async function queryResults(input: ResultFilters): Promise<ResultPage> {
  const f = cleanFilters(input)
  const sb = createServiceClient()

  const { data: emps } = await sb.from('employees').select('card_id, department')
  const deptOf = new Map<string, string>((emps ?? []).map((e: any) => [String(e.card_id).toUpperCase(), e.department ?? '']))
  const departments = Array.from(new Set(Array.from(deptOf.values()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'sr-Latn-ME'))

  let qy = sb.from('competence_attempts')
    .select('id, taken_at, employee_card_id, employee_name, audience, kind, score_pct, passed, critical_failed, answers, taken_by', { count: 'exact' })

  if (f.department) {
    const cards = Array.from(deptOf.entries()).filter(([, d]) => d === f.department).map(([c]) => c)
    if (cards.length === 0) return { rows: [], total: 0, page: f.page, pageSize: f.pageSize, departments }
    qy = qy.in('employee_card_id', cards)
  }
  if (f.q) qy = qy.or(`employee_name.ilike.%${f.q}%,employee_card_id.ilike.%${f.q}%`)
  if (f.from) qy = qy.gte('taken_at', zonedDayStart(f.from))
  if (f.to) qy = qy.lt('taken_at', zonedDayStart(f.to, 1))
  if (f.outcome === 'PASSED') qy = qy.eq('passed', true)
  if (f.outcome === 'FAILED') qy = qy.eq('passed', false)
  if (f.kind) qy = qy.eq('kind', f.kind)

  qy = qy.order(f.sort, { ascending: f.dir === 'asc' })
  if (f.sort !== 'taken_at') qy = qy.order('taken_at', { ascending: false })
  const from = (f.page - 1) * f.pageSize
  const { data, count, error } = await qy.range(from, from + f.pageSize - 1)
  if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? 'Baza nije ažurirana (migracije 041 do 044).' : error.message)

  const rows: ResultRow[] = (data ?? []).map((a: any) => {
    const answers: any[] = Array.isArray(a.answers) ? a.answers : []
    return {
      id: a.id, takenAt: a.taken_at, name: a.employee_name, cardId: a.employee_card_id,
      department: deptOf.get(String(a.employee_card_id).toUpperCase()) ?? '',
      kind: a.kind, audience: a.audience, scorePct: a.score_pct, passed: !!a.passed, criticalFailed: !!a.critical_failed,
      right: answers.filter((x) => x?.ok).length, total: answers.length, takenBy: a.taken_by ?? null,
    }
  })
  return { rows, total: count ?? rows.length, page: f.page, pageSize: f.pageSize, departments }
}

// ---------- detalji pokušaja ----------

export interface DetailItem {
  n: number
  topic: string
  question: string
  options: string[]
  chosen: number // -1 = bez odgovora
  correct: number
  critical: boolean
  ok: boolean
  missing: boolean // pitanje više ne postoji, a nema snimka
}
export interface SupervisedShift { date: string; mentor: string; equipment: string | null }
export interface AttemptDetail {
  id: string
  takenAt: string
  name: string
  cardId: string
  department: string
  audience: string
  kind: string
  scorePct: number
  passPct: number | null
  passed: boolean
  criticalFailed: boolean
  takenBy: string | null
  items: DetailItem[]
  snapshot: boolean // true = tekst iz snimka u trenutku testa; false = rekonstruisano iz banke pitanja
  status: string | null
  supervisedRequired: number
  supervisedDone: number
  shifts: SupervisedShift[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function loadAttemptDetail(id: string): Promise<AttemptDetail | null> {
  if (!UUID.test(String(id))) return null
  const sb = createServiceClient()
  const { data: a } = await sb.from('competence_attempts').select('*').eq('id', id).maybeSingle()
  if (!a) return null

  const answers: any[] = Array.isArray(a.answers) ? a.answers : []
  const snap: any[] | null = Array.isArray(a.questions) && a.questions.length > 0 ? a.questions : null
  let items: DetailItem[]
  if (snap) {
    const byId = new Map(snap.map((s) => [s.id, s]))
    items = answers.map((x, i) => {
      const s: any = byId.get(x.id) ?? {}
      return {
        n: i + 1, topic: s.topic ?? '', question: s.question ?? '', options: Array.isArray(s.options) ? s.options : [],
        chosen: Number(x.chosen ?? s.chosen ?? -1), correct: Number(x.correct ?? s.correctIndex ?? -1), critical: !!(x.critical ?? s.critical), ok: !!x.ok, missing: !s.question,
      }
    })
  } else {
    const ids = answers.map((x) => x.id)
    const { data: qs } = ids.length ? await sb.from('competence_questions').select('id, topic, question, options').in('id', ids) : { data: [] as any[] }
    const byId = new Map((qs ?? []).map((q: any) => [q.id, q]))
    items = answers.map((x, i) => {
      const q: any = byId.get(x.id)
      return {
        n: i + 1, topic: q?.topic ?? '', question: q?.question ?? '', options: Array.isArray(q?.options) ? q.options : [],
        chosen: Number(x.chosen ?? -1), correct: Number(x.correct ?? -1), critical: !!x.critical, ok: !!x.ok, missing: !q,
      }
    })
  }

  const card = String(a.employee_card_id)
  const [{ data: emp }, { data: st }, { data: log }, { data: others }] = await Promise.all([
    sb.from('employees').select('department').eq('card_id', card).maybeSingle(),
    sb.from('competence_status').select('status, supervised_required, supervised_done').eq('employee_card_id', card).maybeSingle(),
    sb.from('competence_supervised_log').select('shift_date, mentor_name, equipment_code, signed_at').eq('employee_card_id', card).order('shift_date', { ascending: true }),
    sb.from('competence_attempts').select('taken_at').eq('employee_card_id', card).order('taken_at', { ascending: true }),
  ])

  // Nadzirane smjene koje se odnose na ovaj pokušaj: poslije pada (do sljedećeg pokušaja) i/ili prije ponovnog testa (od prethodnog pokušaja)
  const times = (others ?? []).map((o: any) => String(o.taken_at))
  const idx = times.indexOf(String(a.taken_at))
  const prev = idx > 0 ? times[idx - 1] : null
  const next = idx >= 0 && idx < times.length - 1 ? times[idx + 1] : null
  const t = (s: string) => new Date(s).getTime()
  const shifts = (log ?? []).filter((s: any) => {
    const at = t(s.signed_at)
    const afterFail = !a.passed && at >= t(a.taken_at) && (next === null || at < t(next))
    const beforeRetest = a.kind === 'RETEST' && at <= t(a.taken_at) && (prev === null || at >= t(prev))
    return afterFail || beforeRetest
  }).map((s: any) => ({ date: s.shift_date, mentor: s.mentor_name, equipment: s.equipment_code ?? null }))

  return {
    id: a.id, takenAt: a.taken_at, name: a.employee_name, cardId: card, department: emp?.department ?? '', audience: a.audience, kind: a.kind,
    scorePct: a.score_pct, passPct: a.pass_pct ?? null, passed: !!a.passed, criticalFailed: !!a.critical_failed, takenBy: a.taken_by ?? null,
    items, snapshot: !!snap, status: st?.status ?? null, supervisedRequired: st?.supervised_required ?? 3, supervisedDone: st?.supervised_done ?? 0, shifts,
  }
}

// ---------- CSV ----------

const fmtDate = (iso: string) => new Intl.DateTimeFormat('sr-Latn-ME', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
const fmtTime = (iso: string) => new Intl.DateTimeFormat('sr-Latn-ME', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
export const fmtDateTime = (iso: string) => `${fmtDate(iso)} ${fmtTime(iso)}`

/** CSV ćelija; vodeći = + - @ se neutrališu (Excel formule), a ; " i novi red se escape-uju. */
export function csvCell(v: unknown): string {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function resultsToCsv(rows: ResultRow[]): string {
  const head = ['Datum', 'Vrijeme', 'Ime i prezime', 'ID kartica', 'Služba', 'Vrsta provjere', 'Tačnih', 'Pogrešnih', 'Pitanja', 'Rezultat %', 'Ishod', 'Pad na sigurnosnom pitanju', 'Zadao']
  const lines = [head.map(csvCell).join(';')]
  for (const r of rows) {
    lines.push([
      fmtDate(r.takenAt), fmtTime(r.takenAt), r.name, r.cardId, r.department, KIND_LABEL[r.kind] ?? r.kind,
      r.right, r.total - r.right, r.total, r.scorePct, r.passed ? 'Položio' : 'Pao', r.criticalFailed ? 'Da' : 'Ne', r.takenBy === 'SELF' || !r.takenBy ? 'Radnik (kartica)' : r.takenBy,
    ].map(csvCell).join(';'))
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}
