'use server'

// Provjera osposobljenosti osoblja (ADR.OR.D.017, ADR.OPS.B.024).
// Radi SAMO uz Supabase bazu (migracija 041). U demo modu vraća jasnu poruku.
// Javne akcije (kartica): getCompetenceForCard, startCompetenceTest, submitCompetenceTest.
// Akcije za šefa/inženjera/admina traže prijavu i rolu.

import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import {
  AUDIENCES, COMPETENCE_RULES, DEFAULT_SETTINGS, QUESTIONS_MIN, applyAttempt, daysFromNow, derivePending, gradeTest, pickQuestions,
  rescheduleExisting, sanitizeSettings, toPublic, validateQuestionInput,
  type Audience, type AttemptKind, type CompetenceSettings, type GivenAnswer, type PoolQuestion, type PublicQuestion, type QuestionInput,
} from '@/lib/competence-logic'
import { localDate, normCard, signTest, verifyTest } from '@/lib/competence-server'

const NOT_AVAILABLE = 'Provjera osposobljenosti radi samo uz Supabase bazu (migracija 041).'
const unavailable = () => isDemoMode() || !hasServiceClient()

export type CompetenceState = 'NONE' | 'VALID' | 'DUE' | 'TRAINING'

export interface CardCompetence {
  ok: boolean
  error?: string
  name?: string
  state?: CompetenceState
  validUntil?: string | null
  pendingKind?: string | null
  pendingDue?: string | null
  nextTestAt?: string | null
  supervisedDone?: number
  supervisedRequired?: number
}

function stateOf(st: { status: string; last_passed_at: string | null; valid_until: string | null } | null): CompetenceState {
  if (!st) return 'NONE'
  if (st.status === 'TRAINING') return 'TRAINING'
  if (!st.last_passed_at) return 'NONE'
  if (st.valid_until && st.valid_until < localDate()) return 'DUE'
  return 'VALID'
}

const missingTable = (m: string) => /does not exist|schema cache/i.test(m)

/** Postavke za ulogu iz baze; ako tabela/red ne postoji (migracija 042 nije pokrenuta) vrijede podrazumijevane. */
async function loadSettings(sb: ReturnType<typeof createServiceClient>, audience: Audience): Promise<CompetenceSettings> {
  try {
    const { data, error } = await sb.from('competence_settings').select('interval_months, questions_per_test, pass_pct').eq('audience', audience).maybeSingle()
    if (error || !data) return DEFAULT_SETTINGS
    return sanitizeSettings({ intervalMonths: data.interval_months, questionsPerTest: data.questions_per_test, passPct: data.pass_pct })
  } catch {
    return DEFAULT_SETTINGS
  }
}

function pendingOf(st: any) {
  return derivePending(st ? { status: st.status, last_passed_at: st.last_passed_at, valid_until: st.valid_until, next_test_at: st.next_test_at, pending_kind: st.pending_kind, pending_due: st.pending_due } : null, localDate())
}

async function requireStaff(adminOnly = false) {
  const u = await getCurrentUser()
  if (!u) throw new Error('Morate biti ulogovani')
  if (adminOnly ? u.role !== 'admin' : (u.role !== 'admin' && u.role !== 'engineer')) {
    throw new Error(adminOnly ? 'Nemate dozvolu (potrebna rola: administrator)' : 'Nemate dozvolu (potrebna rola: inženjer ili administrator)')
  }
  return u
}

/** JAVNO: stanje osposobljenosti za karticu (bez ocjena i bez pitanja). */
export async function getCompetenceForCard(cardIdRaw: string): Promise<CardCompetence> {
  const card = normCard(cardIdRaw)
  if (card.length < 3) return { ok: false, error: 'Unesite broj ID kartice' }
  if (unavailable()) return { ok: false, error: NOT_AVAILABLE }
  try {
    const sb = createServiceClient()
    const { data: emp } = await sb.from('employees').select('name, active').eq('card_id', card).maybeSingle()
    if (!emp || emp.active === false) return { ok: false, error: 'ID kartica nije pronađena u evidenciji aktivnih radnika.' }
    const { data: st, error } = await sb.from('competence_status').select('*').eq('employee_card_id', card).maybeSingle()
    if (error) return { ok: false, error: /does not exist|schema cache/i.test(error.message) ? 'Baza nije ažurirana (migracija 041).' : 'Greška pri čitanju' }
    const pend = pendingOf(st)
    return {
      ok: true, name: emp.name, state: stateOf(st), validUntil: st?.valid_until ?? null,
      pendingKind: pend?.kind ?? null, pendingDue: pend?.due ?? null, nextTestAt: st?.next_test_at ?? null,
      supervisedDone: st?.supervised_done ?? 0, supervisedRequired: st?.supervised_required ?? COMPETENCE_RULES.supervisedShiftsRequired,
    }
  } catch (e) {
    console.error('getCompetenceForCard failed:', e)
    return { ok: false, error: 'Greška pri čitanju' }
  }
}

export interface StartedTest {
  ok: boolean
  error?: string
  name?: string
  audience?: Audience
  kind?: AttemptKind
  token?: string
  questions?: PublicQuestion[]
}

/** JAVNO (kartica): izdaje potpisan test. Odgovori se ocjenjuju na serveru. */
export async function startCompetenceTest(params: { cardId: string }): Promise<StartedTest> {
  const card = normCard(params?.cardId)
  if (card.length < 3) return { ok: false, error: 'Unesite broj ID kartice' }
  if (unavailable()) return { ok: false, error: NOT_AVAILABLE }
  try {
    const sb = createServiceClient()
    const { data: emp } = await sb.from('employees').select('name, active').eq('card_id', card).maybeSingle()
    if (!emp || emp.active === false) return { ok: false, error: 'ID kartica nije pronađena u evidenciji aktivnih radnika.' }

    // Uloga: prijavljeni korisnik sa ovom karticom polaže test za svoju ulogu; ostali polažu test za vozače/radnike
    let audience: Audience = 'DRIVER'
    const user = await getCurrentUser().catch(() => null)
    if (user && normCard(user.card_id) === card) audience = user.role === 'admin' ? 'ADMIN' : user.role === 'engineer' ? 'SUPERVISOR' : 'DRIVER'

    const { data: st } = await sb.from('competence_status').select('*').eq('employee_card_id', card).maybeSingle()
    if (st?.status === 'TRAINING' && (st.supervised_done ?? 0) < (st.supervised_required ?? COMPETENCE_RULES.supervisedShiftsRequired)) {
      const left = (st.supervised_required ?? COMPETENCE_RULES.supervisedShiftsRequired) - (st.supervised_done ?? 0)
      return { ok: false, error: `Ponovni test je moguć poslije nadziranih smjena. Preostalo: ${left}.` }
    }
    const kind: AttemptKind = pendingOf(st)?.kind ?? (!st || !st.last_passed_at ? 'INITIAL' : 'SELF')

    const { data: rows, error } = await sb.from('competence_questions')
      .select('id, topic, question, options, correct_index, critical').eq('audience', audience).eq('active', true)
    if (error) return { ok: false, error: /does not exist|schema cache/i.test(error.message) ? 'Baza nije ažurirana (migracija 041).' : 'Greška pri čitanju pitanja' }
    const pool: PoolQuestion[] = (rows ?? []).map((r: any) => ({ id: r.id, topic: r.topic, question: r.question, options: r.options as string[], correctIndex: r.correct_index, critical: !!r.critical }))
    if (pool.length < QUESTIONS_MIN) return { ok: false, error: 'Banka pitanja za ovu ulogu je prazna ili premala. Obavijestite administratora.' }

    const settings = await loadSettings(sb, audience)
    const picked = pickQuestions(pool, Math.min(settings.questionsPerTest, pool.length))
    const token = signTest({ card, audience, kind, ids: picked.map((q) => q.id), exp: Date.now() + 45 * 60_000, by: user?.full_name ?? 'SELF' })
    return { ok: true, name: emp.name, audience, kind, token, questions: picked.map(toPublic) }
  } catch (e) {
    console.error('startCompetenceTest failed:', e)
    return { ok: false, error: 'Test nije moguće pokrenuti. Pokušajte ponovo.' }
  }
}

export interface ReviewItem { question: string; yourAnswer: string; correctAnswer: string; explanation: string; critical: boolean }
export interface SubmittedTest {
  ok: boolean
  error?: string
  scorePct?: number
  passed?: boolean
  criticalFailed?: boolean
  state?: 'VALID' | 'TRAINING'
  note?: string
  validUntil?: string | null
  review?: ReviewItem[]
}

/** JAVNO: predaja testa. Ocjenjuje server iz baze pitanja. Token vrijedi za jedan pokušaj. */
export async function submitCompetenceTest(params: { token: string; answers: GivenAnswer[] }): Promise<SubmittedTest> {
  if (unavailable()) return { ok: false, error: NOT_AVAILABLE }
  const claims = verifyTest(params?.token)
  if (!claims) return { ok: false, error: 'Test je istekao ili nije važeći. Pokrenite novi.' }
  try {
    const sb = createServiceClient()
    const issuedAt = new Date(claims.exp - 45 * 60_000).toISOString()

    // Jedan token = jedan pokušaj (inače bi se ista pitanja mogla ponavljati dok se ne nauče odgovori)
    const { data: already } = await sb.from('competence_attempts').select('id').eq('employee_card_id', claims.card).gte('taken_at', issuedAt).limit(1)
    if (already && already.length > 0) return { ok: false, error: 'Ovaj test je već predat. Pokrenite novi.' }

    const { data: rows } = await sb.from('competence_questions').select('id, topic, question, options, correct_index, critical, explanation').in('id', claims.ids)
    const pool: PoolQuestion[] = (rows ?? []).map((r: any) => ({ id: r.id, topic: r.topic, question: r.question, options: r.options as string[], correctIndex: r.correct_index, critical: !!r.critical }))
    const given: GivenAnswer[] = Array.isArray(params.answers) ? params.answers.map((a) => ({ id: String(a.id), chosen: Number(a.chosen) })) : []
    // Pitanje obrisano dok je test bio otvoren ne kvari ocjenu radniku
    const foundIds = new Set(pool.map((q) => q.id))
    const expected = claims.ids.filter((id) => foundIds.has(id))
    if (expected.length === 0) return { ok: false, error: 'Test više nije važeći. Pokrenite novi.' }
    const settings = await loadSettings(sb, claims.audience)
    const grade = gradeTest(pool, expected, given, settings.passPct)

    const { data: emp } = await sb.from('employees').select('name').eq('card_id', claims.card).maybeSingle()
    const name = emp?.name ?? claims.card
    const { data: prev } = await sb.from('competence_status').select('*').eq('employee_card_id', claims.card).maybeSingle()
    const next = applyAttempt(prev ? { status: prev.status, supervisedRequired: prev.supervised_required, supervisedDone: prev.supervised_done } : null, grade.passed, new Date(), { intervalMonths: settings.intervalMonths })

    const { error: insErr } = await sb.from('competence_attempts').insert({
      employee_card_id: claims.card, employee_name: name, audience: claims.audience, kind: claims.kind,
      score_pct: grade.scorePct, critical_failed: grade.criticalFailed, passed: grade.passed, answers: grade.answers, taken_by: claims.by,
    })
    if (insErr) { console.error('competence attempt insert failed:', insErr.message); return { ok: false, error: 'Rezultat nije snimljen. Pokušajte ponovo.' } }

    const patch: Record<string, unknown> = {
      employee_card_id: claims.card, employee_name: name, audience: claims.audience, status: next.status,
      last_result_pct: grade.scorePct, valid_until: next.validUntil, next_test_at: next.nextTestAt,
      supervised_required: next.supervisedRequired, supervised_done: next.supervisedDone,
      pending_kind: null, pending_due: null, updated_at: new Date().toISOString(),
    }
    if (next.status === 'VALID') patch.last_passed_at = new Date().toISOString()
    const { error: upErr } = await sb.from('competence_status').upsert(patch, { onConflict: 'employee_card_id' })
    if (upErr) console.error('competence status upsert failed:', upErr.message)

    // Povratna informacija: samo za pogrešne odgovore (tačan odgovor + objašnjenje), da test služi i kao obuka
    const byId = new Map((rows ?? []).map((r: any) => [r.id, r]))
    const review: ReviewItem[] = grade.answers.filter((a) => !a.ok).map((a) => {
      const r: any = byId.get(a.id)
      const opts: string[] = r?.options ?? []
      return { question: r?.question ?? '', yourAnswer: opts[a.chosen] ?? '(bez odgovora)', correctAnswer: opts[a.correct] ?? '', explanation: r?.explanation ?? '', critical: a.critical }
    })

    return { ok: true, scorePct: grade.scorePct, passed: grade.passed, criticalFailed: grade.criticalFailed, state: next.status, note: next.note, validUntil: next.validUntil, review }
  } catch (e) {
    console.error('submitCompetenceTest failed:', e)
    return { ok: false, error: 'Rezultat nije snimljen. Pokušajte ponovo.' }
  }
}

// ======================= šef / inženjer / admin =======================

export interface OverviewRow {
  cardId: string; name: string; department: string
  state: CompetenceState; validUntil: string | null
  lastPct: number | null; lastAt: string | null; lastPassed: boolean | null
  pendingKind: string | null; pendingDue: string | null; nextTestAt: string | null
  supervisedDone: number; supervisedRequired: number
  isMentor: boolean
}
export interface CompetenceOverview {
  rows: OverviewRow[]
  mentors: Array<{ cardId: string; name: string; active: boolean }>
  counts: { total: number; none: number; valid: number; due: number; training: number; pending: number }
}

export async function getCompetenceOverview(): Promise<CompetenceOverview> {
  await requireStaff()
  if (unavailable()) throw new Error(NOT_AVAILABLE)
  const sb = createServiceClient()
  const [emps, sts, ments, atts] = await Promise.all([
    sb.from('employees').select('card_id, name, department, active').eq('active', true).order('name'),
    sb.from('competence_status').select('*'),
    sb.from('competence_mentors').select('*'),
    sb.from('competence_attempts').select('employee_card_id, score_pct, passed, taken_at').order('taken_at', { ascending: false }).limit(2000),
  ])
  for (const r of [sts, ments, atts]) if (r.error) throw new Error(/does not exist|schema cache/i.test(r.error.message) ? 'Baza nije ažurirana (pokrenite migraciju 041).' : r.error.message)

  const stBy = new Map((sts.data ?? []).map((s: any) => [s.employee_card_id, s]))
  const mentorBy = new Map((ments.data ?? []).map((m: any) => [m.employee_card_id, m]))
  const lastBy = new Map<string, any>()
  for (const a of atts.data ?? []) if (!lastBy.has((a as any).employee_card_id)) lastBy.set((a as any).employee_card_id, a)

  const rows: OverviewRow[] = (emps.data ?? []).map((e: any) => {
    const st: any = stBy.get(e.card_id) ?? null
    const last: any = lastBy.get(e.card_id) ?? null
    const pend = pendingOf(st)
    return {
      cardId: e.card_id, name: e.name, department: e.department ?? '', state: stateOf(st), validUntil: st?.valid_until ?? null,
      lastPct: last?.score_pct ?? st?.last_result_pct ?? null, lastAt: last?.taken_at ?? null, lastPassed: last ? !!last.passed : null,
      pendingKind: pend?.kind ?? null, pendingDue: pend?.due ?? null, nextTestAt: st?.next_test_at ?? null,
      supervisedDone: st?.supervised_done ?? 0, supervisedRequired: st?.supervised_required ?? COMPETENCE_RULES.supervisedShiftsRequired,
      isMentor: !!mentorBy.get(e.card_id)?.active,
    }
  })
  const count = (s: CompetenceState) => rows.filter((r) => r.state === s).length
  return {
    rows,
    mentors: (ments.data ?? []).map((m: any) => ({ cardId: m.employee_card_id, name: m.name, active: !!m.active })),
    counts: { total: rows.length, none: count('NONE'), valid: count('VALID'), due: count('DUE'), training: count('TRAINING'), pending: rows.filter((r) => r.pendingKind).length },
  }
}

export async function setCompetenceMentor(params: { cardId: string; active: boolean }): Promise<{ ok: boolean; error?: string }> {
  try {
    const u = await requireStaff(true)
    if (unavailable()) return { ok: false, error: NOT_AVAILABLE }
    const card = normCard(params.cardId)
    const sb = createServiceClient()
    const { data: emp } = await sb.from('employees').select('name, active').eq('card_id', card).maybeSingle()
    if (!emp || emp.active === false) return { ok: false, error: 'Radnik nije pronađen' }
    if (params.active) {
      const { data: st } = await sb.from('competence_status').select('status').eq('employee_card_id', card).maybeSingle()
      if (st?.status === 'TRAINING') return { ok: false, error: 'Radnik koji je u obuci ne može biti mentor.' }
    }
    const { error } = await sb.from('competence_mentors').upsert({ employee_card_id: card, name: emp.name, active: params.active, appointed_by: u.full_name, appointed_at: new Date().toISOString() }, { onConflict: 'employee_card_id' })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Greška' }
  }
}

/** Šef/inženjer zadaje provjeru radniku (npr. poslije incidenta, ili početna provjera). */
export async function assignCompetenceTest(params: { cardId: string; kind?: 'RANDOM' | 'PERIODIC' | 'INITIAL' }): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireStaff()
    if (unavailable()) return { ok: false, error: NOT_AVAILABLE }
    const card = normCard(params.cardId)
    const sb = createServiceClient()
    const { data: emp } = await sb.from('employees').select('name, active').eq('card_id', card).maybeSingle()
    if (!emp || emp.active === false) return { ok: false, error: 'Radnik nije pronađen' }
    const { data: st } = await sb.from('competence_status').select('*').eq('employee_card_id', card).maybeSingle()
    if (st?.status === 'TRAINING') return { ok: false, error: 'Radnik je u obuci. Ponovni test se otvara poslije nadziranih smjena.' }
    const kind = params.kind ?? (!st || !st.last_passed_at ? 'INITIAL' : 'PERIODIC')
    const { error } = await sb.from('competence_status').upsert({
      employee_card_id: card, employee_name: emp.name, pending_kind: kind, pending_due: daysFromNow(COMPETENCE_RULES.pendingDueDays), updated_at: new Date().toISOString(),
    }, { onConflict: 'employee_card_id', ignoreDuplicates: false })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Greška' }
  }
}

export interface AttemptRow { takenAt: string; kind: string; scorePct: number; passed: boolean; criticalFailed: boolean; takenBy: string | null }
export async function getCompetenceAttempts(cardId: string): Promise<AttemptRow[]> {
  await requireStaff()
  if (unavailable()) throw new Error(NOT_AVAILABLE)
  const { data } = await createServiceClient().from('competence_attempts').select('taken_at, kind, score_pct, passed, critical_failed, taken_by')
    .eq('employee_card_id', normCard(cardId)).order('taken_at', { ascending: false }).limit(20)
  return (data ?? []).map((a: any) => ({ takenAt: a.taken_at, kind: a.kind, scorePct: a.score_pct, passed: !!a.passed, criticalFailed: !!a.critical_failed, takenBy: a.taken_by ?? null }))
}

// ======================= samo ADMINISTRATOR: postavke i banka pitanja =======================

export interface BankQuestion { id: string; audience: Audience; topic: string; question: string; options: string[]; correctIndex: number; critical: boolean; explanation: string; active: boolean }
const toBank = (r: any): BankQuestion => ({ id: r.id, audience: r.audience, topic: r.topic, question: r.question, options: r.options, correctIndex: r.correct_index, critical: !!r.critical, explanation: r.explanation ?? '', active: !!r.active })

export async function listCompetenceQuestions(): Promise<BankQuestion[]> {
  await requireStaff(true)
  if (unavailable()) throw new Error(NOT_AVAILABLE)
  const { data, error } = await createServiceClient().from('competence_questions').select('*').order('audience').order('topic').order('created_at')
  if (error) throw new Error(missingTable(error.message) ? 'Baza nije ažurirana (pokrenite migracije 041 i 042).' : error.message)
  return (data ?? []).map(toBank)
}

export interface AudienceSettings extends CompetenceSettings { audience: Audience; activeQuestions: number; employees: number }

export async function getCompetenceSettings(): Promise<AudienceSettings[]> {
  await requireStaff(true)
  if (unavailable()) throw new Error(NOT_AVAILABLE)
  const sb = createServiceClient()
  const [set, qs, sts] = await Promise.all([
    sb.from('competence_settings').select('*'),
    sb.from('competence_questions').select('audience').eq('active', true),
    sb.from('competence_status').select('audience'),
  ])
  if (qs.error) throw new Error(missingTable(qs.error.message) ? 'Baza nije ažurirana (pokrenite migracije 041 i 042).' : qs.error.message)
  const by = new Map((set.data ?? []).map((r: any) => [r.audience, r]))
  return AUDIENCES.map((a) => {
    const r: any = by.get(a)
    const s = r ? sanitizeSettings({ intervalMonths: r.interval_months, questionsPerTest: r.questions_per_test, passPct: r.pass_pct }) : DEFAULT_SETTINGS
    return {
      audience: a, ...s,
      activeQuestions: (qs.data ?? []).filter((q: any) => q.audience === a).length,
      employees: (sts.data ?? []).filter((x: any) => x.audience === a).length,
    }
  })
}

/** Admin upisuje rok (mjeseci, 1 do 120), broj pitanja (3 do 20) i prag prolaza. applyToExisting: pomjera datume već položenih. */
export async function saveCompetenceSettings(params: { audience: Audience; intervalMonths: number; questionsPerTest: number; passPct: number; applyToExisting?: boolean }): Promise<{ ok: boolean; error?: string; rescheduled?: number }> {
  try {
    const u = await requireStaff(true)
    if (unavailable()) return { ok: false, error: NOT_AVAILABLE }
    if (!AUDIENCES.includes(params.audience)) return { ok: false, error: 'Nepoznata uloga' }
    const clean = sanitizeSettings(params)
    if (clean.intervalMonths !== Number(params.intervalMonths)) return { ok: false, error: 'Rok mora biti cijeli broj mjeseci od 1 do 120' }
    if (clean.questionsPerTest !== Number(params.questionsPerTest)) return { ok: false, error: 'Broj pitanja mora biti od 3 do 20' }
    if (clean.passPct !== Number(params.passPct)) return { ok: false, error: 'Prag prolaza mora biti od 50 do 100 posto' }

    const sb = createServiceClient()
    const { error } = await sb.from('competence_settings').upsert({
      audience: params.audience, interval_months: clean.intervalMonths, questions_per_test: clean.questionsPerTest, pass_pct: clean.passPct,
      updated_by: u.full_name, updated_at: new Date().toISOString(),
    }, { onConflict: 'audience' })
    if (error) return { ok: false, error: missingTable(error.message) ? 'Baza nije ažurirana (pokrenite migraciju 042).' : error.message }

    let rescheduled = 0
    if (params.applyToExisting) {
      const { data: rows } = await sb.from('competence_status').select('employee_card_id, last_passed_at').eq('audience', params.audience).eq('status', 'VALID').not('last_passed_at', 'is', null)
      for (const r of rows ?? []) {
        const n = rescheduleExisting(String((r as any).last_passed_at), clean.intervalMonths)
        const { error: e2 } = await sb.from('competence_status').update({ valid_until: n.validUntil, next_test_at: n.nextTestAt }).eq('employee_card_id', (r as any).employee_card_id)
        if (!e2) rescheduled++
      }
    }
    return { ok: true, rescheduled }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Greška' }
  }
}

export async function createCompetenceQuestion(input: QuestionInput): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const u = await requireStaff(true)
    if (unavailable()) return { ok: false, error: NOT_AVAILABLE }
    const v = validateQuestionInput(input)
    if (!v.ok) return { ok: false, error: v.error }
    const { data, error } = await createServiceClient().from('competence_questions').insert({
      audience: v.value.audience, topic: v.value.topic, question: v.value.question, options: v.value.options,
      correct_index: v.value.correctIndex, critical: v.value.critical, explanation: v.value.explanation, active: true,
    }).select('id').single()
    if (error) return { ok: false, error: error.message }
    void u
    return { ok: true, id: data?.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Greška' }
  }
}

export async function updateCompetenceQuestion(params: { id: string } & QuestionInput): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireStaff(true)
    if (unavailable()) return { ok: false, error: NOT_AVAILABLE }
    const v = validateQuestionInput(params)
    if (!v.ok) return { ok: false, error: v.error }
    const { error } = await createServiceClient().from('competence_questions').update({
      audience: v.value.audience, topic: v.value.topic, question: v.value.question, options: v.value.options,
      correct_index: v.value.correctIndex, critical: v.value.critical, explanation: v.value.explanation,
    }).eq('id', params.id)
    return error ? { ok: false, error: error.message } : { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Greška' }
  }
}

export async function deleteCompetenceQuestion(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireStaff(true)
    if (unavailable()) return { ok: false, error: NOT_AVAILABLE }
    const { error } = await createServiceClient().from('competence_questions').delete().eq('id', id)
    return error ? { ok: false, error: error.message } : { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Greška' }
  }
}

export async function setCompetenceQuestionActive(params: { id: string; active: boolean }): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireStaff(true)
    if (unavailable()) return { ok: false, error: NOT_AVAILABLE }
    const { error } = await createServiceClient().from('competence_questions').update({ active: params.active }).eq('id', params.id)
    return error ? { ok: false, error: error.message } : { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Greška' }
  }
}
