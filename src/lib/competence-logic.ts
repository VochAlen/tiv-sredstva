// Čista logika provjere osposobljenosti (bez baze, bez 'use server'): izbor pitanja, ocjena, rokovi, validacija pitanja.
// Odvojeno od server akcija da se može testirati i održavati bez Supabase-a.

export type Audience = 'DRIVER' | 'SUPERVISOR' | 'ADMIN'
export type AttemptKind = 'INITIAL' | 'RANDOM' | 'PERIODIC' | 'RETEST' | 'SELF'
export type CompetenceState = 'VALID' | 'TRAINING'

export const AUDIENCES: Audience[] = ['DRIVER', 'SUPERVISOR', 'ADMIN']
export const AUDIENCE_LABEL: Record<Audience, string> = {
  DRIVER: 'Vozač / radnik',
  SUPERVISOR: 'Šef / radionica / inženjer',
  ADMIN: 'Administrator',
}

/** Admin upisuje rok u mjesecima (propisi se mogu promijeniti: CAA ili EASA). Prečice za česte rokove. */
export const INTERVAL_MIN = 1
export const INTERVAL_MAX = 120
export const INTERVAL_PRESETS = [3, 6, 12, 24, 36] as const
/** Rok koji važeći propis trenutno dozvoljava (ADR.OPS.B.024(c), ADR.OR.D.017(f)); preko toga aplikacija samo upozorava. */
export const REGULATORY_MAX_MONTHS = 24
export function intervalLabel(m: number): string {
  if (m % 12 === 0) { const y = m / 12; return y === 1 ? '1 godina' : y < 5 ? `${y} godine` : `${y} godina` }
  const last = m % 10, teen = m % 100 >= 11 && m % 100 <= 14
  return `${m} ${last === 1 && !teen ? 'mjesec' : last >= 2 && last <= 4 && !teen ? 'mjeseca' : 'mjeseci'}`
}
export const QUESTIONS_MIN = 3
export const QUESTIONS_MAX = 20
export const PASS_MIN = 50
export const PASS_MAX = 100

export interface CompetenceSettings {
  intervalMonths: number
  questionsPerTest: number
  passPct: number
}

/** Podrazumijevane vrijednosti dok admin ništa ne podesi (isto kao default u migraciji 042). */
export const DEFAULT_SETTINGS: CompetenceSettings = { intervalMonths: 12, questionsPerTest: 10, passPct: 80 }

export function sanitizeSettings(s: Partial<CompetenceSettings> | null | undefined): CompetenceSettings {
  const iv = Number(s?.intervalMonths)
  const n = Number(s?.questionsPerTest)
  const p = Number(s?.passPct)
  return {
    intervalMonths: Number.isInteger(iv) && iv >= INTERVAL_MIN && iv <= INTERVAL_MAX ? iv : DEFAULT_SETTINGS.intervalMonths,
    questionsPerTest: Number.isInteger(n) && n >= QUESTIONS_MIN && n <= QUESTIONS_MAX ? n : DEFAULT_SETTINGS.questionsPerTest,
    passPct: Number.isInteger(p) && p >= PASS_MIN && p <= PASS_MAX ? p : DEFAULT_SETTINGS.passPct,
  }
}

// Pravila koja nisu podesiva iz aplikacije
export const COMPETENCE_RULES = {
  supervisedShiftsRequired: 3, // nadziranih smjena poslije pada, prije ponovnog testa
  pendingDueDays: 7,           // rok za ručno zadanu provjeru i za ponovni test
  /** Test se radniku pojavljuje nasumično u periodu: od 25% do 90% izabranog roka. Krajnji rok je 100%. */
  windowFrom: 0.25,
  windowTo: 0.9,
} as const

export interface PoolQuestion {
  id: string
  topic: string
  question: string
  options: string[]
  correctIndex: number
  critical: boolean
}
/** Pitanje bez tačnog odgovora: ovo ide klijentu. */
export type PublicQuestion = Omit<PoolQuestion, 'correctIndex'>

export interface GivenAnswer { id: string; chosen: number }
export interface GradedAnswer { id: string; chosen: number; correct: number; critical: boolean; ok: boolean }
export interface Grade { scorePct: number; criticalFailed: boolean; passed: boolean; answers: GradedAnswer[] }

/** Fisher-Yates sa ubrizganim RNG-om (testabilno). */
export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Sva kritična pitanja imaju prednost (do n), ostatak se dopunjava nasumično. Redoslijed je izmiješan. */
export function pickQuestions(pool: readonly PoolQuestion[], n: number, rng: () => number = Math.random): PoolQuestion[] {
  const crit = shuffle(pool.filter((q) => q.critical), rng)
  const rest = shuffle(pool.filter((q) => !q.critical), rng)
  const chosen = [...crit.slice(0, n), ...rest].slice(0, n)
  return shuffle(chosen, rng)
}

/** Skida tačan odgovor prije slanja klijentu. */
export function toPublic(q: PoolQuestion): PublicQuestion {
  const { correctIndex: _c, ...rest } = q
  void _c
  return rest
}

/**
 * Ocjena na SERVERU iz baze pitanja (klijent šalje samo id i izabrani indeks).
 * Nepoznat id, ili pitanje koje nije bilo u testu, ne daje bodove. Neodgovoreno = pogrešno.
 */
export function gradeTest(pool: readonly PoolQuestion[], expectedIds: readonly string[], given: readonly GivenAnswer[], passPct: number = DEFAULT_SETTINGS.passPct): Grade {
  const byId = new Map(pool.map((q) => [q.id, q]))
  const givenById = new Map(given.map((g) => [g.id, g.chosen]))
  const answers: GradedAnswer[] = expectedIds.map((id) => {
    const q = byId.get(id)
    const chosen = givenById.has(id) ? Number(givenById.get(id)) : -1
    if (!q) return { id, chosen, correct: -1, critical: false, ok: false }
    return { id, chosen, correct: q.correctIndex, critical: q.critical, ok: chosen === q.correctIndex }
  })
  const total = answers.length || 1
  const right = answers.filter((a) => a.ok).length
  const scorePct = Math.round((right / total) * 100)
  const criticalFailed = answers.some((a) => a.critical && !a.ok)
  return { scorePct, criticalFailed, passed: !criticalFailed && scorePct >= passPct && answers.length > 0, answers }
}

// ---------- datumi ----------
const ymd = (d: Date) => d.toISOString().slice(0, 10)
export function addDays(from: Date, days: number): string { return ymd(new Date(from.getTime() + days * 86_400_000)) }
export function addMonths(from: Date, months: number): string {
  // UTC aritmetika (ne zavisi od vremenske zone servera); 31. + mjesec bez 31. dana ide na zadnji dan mjeseca
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1))
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(from.getUTCDate(), last))
  return ymd(d)
}
export function daysFromNow(days: number, now: Date = new Date()): string { return addDays(now, days) }

/**
 * Raspored sljedećeg testa poslije uspješnog polaganja:
 *  - validUntil: krajnji rok = izabrani period (3/6/12/24 mjeseca)
 *  - nextTestAt: nasumičan dan unutar perioda (od 25% do 90% roka), da radnici ne dolaze na red istog dana
 */
export function scheduleNext(from: Date, intervalMonths: number, rng: () => number = Math.random): { validUntil: string; nextTestAt: string } {
  const validUntil = addMonths(from, intervalMonths)
  const totalDays = Math.max(1, Math.round((new Date(validUntil).getTime() - new Date(ymd(from)).getTime()) / 86_400_000))
  const lo = Math.round(totalDays * COMPETENCE_RULES.windowFrom)
  const hi = Math.max(lo, Math.round(totalDays * COMPETENCE_RULES.windowTo))
  const offset = lo + Math.floor(rng() * (hi - lo + 1))
  return { validUntil, nextTestAt: addDays(from, offset) }
}

export interface StatusRow {
  status: CompetenceState
  supervisedRequired: number
  supervisedDone: number
}

/** Šta se desi sa statusom poslije pokušaja. */
export function applyAttempt(prev: StatusRow | null, passed: boolean, now: Date = new Date(), opts: { intervalMonths?: number; rng?: () => number } = {}): {
  status: CompetenceState
  validUntil: string | null
  nextTestAt: string | null
  supervisedDone: number
  supervisedRequired: number
  note: string
} {
  const req = prev?.supervisedRequired ?? COMPETENCE_RULES.supervisedShiftsRequired
  if (!passed) {
    // Pad: rad samo uz nadzor mentora; brojač nadziranih smjena kreće ispočetka
    return { status: 'TRAINING', validUntil: null, nextTestAt: null, supervisedDone: 0, supervisedRequired: req, note: 'Pad: rad uz nadzor mentora do završetka nadziranih smjena i ponovnog testa.' }
  }
  // Prolaz poslije pada vrijedi tek kad su odrađene sve nadzirane smjene
  if (prev?.status === 'TRAINING' && prev.supervisedDone < prev.supervisedRequired) {
    return { status: 'TRAINING', validUntil: null, nextTestAt: null, supervisedDone: prev.supervisedDone, supervisedRequired: req, note: `Test položen, ali preostaje ${prev.supervisedRequired - prev.supervisedDone} nadziranih smjena.` }
  }
  const next = scheduleNext(now, opts.intervalMonths ?? DEFAULT_SETTINGS.intervalMonths, opts.rng)
  return { status: 'VALID', validUntil: next.validUntil, nextTestAt: next.nextTestAt, supervisedDone: 0, supervisedRequired: req, note: 'Prolaz.' }
}

export interface PendingInput {
  status: string
  last_passed_at: string | null
  valid_until: string | null
  next_test_at?: string | null
  pending_kind?: string | null
  pending_due?: string | null
}

/**
 * Da li radnik ima zadatak (provjeru znanja) i do kada.
 * Računa se iz datuma, bez zakazanog posla:
 *  - ručno zadana provjera ili ponovni test (pending_kind)
 *  - planirani periodični test (next_test_at stigao)
 *  - istekao krajnji rok (valid_until prošao)
 * Radnik u obuci ne dobija periodični zadatak (njegov ponovni test se otvara poslije nadziranih smjena).
 */
export function derivePending(st: PendingInput | null, today: string): { kind: AttemptKind; due: string | null } | null {
  if (!st) return null
  if (st.pending_kind) return { kind: st.pending_kind as AttemptKind, due: st.pending_due ?? null }
  if (st.status === 'TRAINING' || !st.last_passed_at) return null
  if (st.valid_until && st.valid_until < today) return { kind: 'PERIODIC', due: st.valid_until }
  if (st.next_test_at && st.next_test_at <= today) return { kind: 'PERIODIC', due: st.valid_until ?? null }
  return null
}

/**
 * Pri promjeni roka "primijeni i na postojeće": nova vrijednost za radnika koji je već položio.
 * Krajnji rok se računa od datuma polaganja. Ako je planirani datum već prošao, test se pomjera
 * nasumično u narednih 14 dana (da se svi ne pojave istog dana).
 */
export function rescheduleExisting(lastPassedAt: string, intervalMonths: number, today: Date = new Date(), rng: () => number = Math.random): { validUntil: string; nextTestAt: string } {
  const passed = new Date(lastPassedAt)
  const base = scheduleNext(passed, intervalMonths, rng)
  const todayStr = ymd(today)
  if (base.nextTestAt >= todayStr) return base
  return { validUntil: base.validUntil, nextTestAt: addDays(today, 1 + Math.floor(rng() * 14)) }
}

// ---------- validacija pitanja koje piše admin ----------
export interface QuestionInput {
  audience: string
  topic: string
  question: string
  options: string[]
  correctIndex: number
  critical: boolean
  explanation?: string
}
export interface QuestionValue { audience: Audience; topic: string; question: string; options: string[]; correctIndex: number; critical: boolean; explanation: string }

export function validateQuestionInput(q: QuestionInput): { ok: true; value: QuestionValue } | { ok: false; error: string } {
  if (!AUDIENCES.includes(q.audience as Audience)) return { ok: false, error: 'Izaberite ulogu za koju je pitanje' }
  const topic = String(q.topic ?? '').trim()
  if (topic.length < 2 || topic.length > 60) return { ok: false, error: 'Tema mora imati 2 do 60 znakova' }
  const question = String(q.question ?? '').trim()
  if (question.length < 10 || question.length > 500) return { ok: false, error: 'Pitanje mora imati 10 do 500 znakova' }
  const options = (Array.isArray(q.options) ? q.options : []).map((o) => String(o ?? '').trim())
  if (options.length < 2 || options.length > 6) return { ok: false, error: 'Pitanje mora imati 2 do 6 odgovora' }
  if (options.some((o) => o.length === 0)) return { ok: false, error: 'Odgovori ne smiju biti prazni (obrišite prazan red)' }
  if (options.some((o) => o.length > 300)) return { ok: false, error: 'Odgovor je predug (najviše 300 znakova)' }
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return { ok: false, error: 'Dva odgovora su ista' }
  const ci = Number(q.correctIndex)
  if (!Number.isInteger(ci) || ci < 0 || ci >= options.length) return { ok: false, error: 'Označite tačan odgovor' }
  const explanation = String(q.explanation ?? '').trim().slice(0, 600)
  return { ok: true, value: { audience: q.audience as Audience, topic, question, options, correctIndex: ci, critical: !!q.critical, explanation } }
}
