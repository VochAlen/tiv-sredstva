// SAMO za server (nije 'use server', pa funkcije NISU dostupne klijentu kao endpointi).
// Pomoćne funkcije provjere osposobljenosti: potpisani test, kapija pri zaduživanju, evidencija nadzornih smjena.
// Sve radi kroz service-role klijent, jer se radnik identifikuje karticom (nema sesije).

import { createHmac, timingSafeEqual } from 'crypto'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { isDemoMode } from '@/lib/auth-mode'
import type { Audience, AttemptKind } from '@/lib/competence-logic'

export const normCard = (c: unknown) => String(c ?? '').trim().toUpperCase()

/** Datum smjene po lokalnom vremenu aerodroma (YYYY-MM-DD). */
export function localDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Podgorica', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

// ---------- potpisani test ----------
// Klijent šalje nazad samo id-eve odgovora; token garantuje da je test izdao server (isti broj i izbor pitanja,
// ista kartica, rok trajanja). Bez ovoga bi radnik mogao poslati samo lakša pitanja.
function secret(): string {
  return process.env.COMPETENCE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export interface TestClaims { card: string; audience: Audience; kind: AttemptKind; ids: string[]; exp: number; by: string }

export function signTest(claims: TestClaims): string {
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const sig = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyTest(token: string): TestClaims | null {
  try {
    if (!secret()) return null
    const [body, sig] = String(token).split('.')
    if (!body || !sig) return null
    const expected = createHmac('sha256', secret()).update(body).digest('base64url')
    const a = Buffer.from(sig), b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TestClaims
    if (!claims.exp || Date.now() > claims.exp) return null
    return claims
  } catch { return null }
}

// ---------- kapija pri zaduživanju ----------
export interface GateResult {
  ok: boolean
  error?: string
  /** UI treba da zatraži karticu mentora */
  mentorRequired?: boolean
  /** Ako je zaduživanje uspjelo, treba upisati nadziranu smjenu */
  supervised?: { mentorCardId: string; mentorName: string }
}

/**
 * Radnik koji nije prošao provjeru (status TRAINING) smije raditi samo uz nadzor mentora:
 * pri zaduživanju mora unijeti karticu imenovanog mentora (druga osoba, aktivan mentor, sam nije u obuci).
 * Radnici koji nikad nisu testirani, ili im je rok istekao, NISU blokirani (samo dobijaju zadatak).
 * Ako tabele ne postoje (migracija 041 nije pokrenuta) ili baza ne odgovori, kapija propušta i bilježi grešku:
 * evidencija osposobljenosti ne smije zaustaviti operativu zbog tehničke greške.
 */
export async function competenceGate(cardIdRaw: string, mentorCardIdRaw?: string): Promise<GateResult> {
  if (isDemoMode() || !hasServiceClient()) return { ok: true }
  const card = normCard(cardIdRaw)
  try {
    const sb = createServiceClient()
    const { data: st, error } = await sb.from('competence_status').select('status').eq('employee_card_id', card).maybeSingle()
    if (error) { console.error('competenceGate: status read failed:', error.message); return { ok: true } }
    if (!st || st.status !== 'TRAINING') return { ok: true }

    const mentorCard = normCard(mentorCardIdRaw)
    if (!mentorCard) {
      return { ok: false, mentorRequired: true, error: 'Niste prošli provjeru znanja: rad je dozvoljen samo uz nadzor mentora. Mentor unosi svoju ID karticu.' }
    }
    if (mentorCard === card) return { ok: false, mentorRequired: true, error: 'Mentor mora biti druga osoba, ne vi.' }

    const { data: mentor } = await sb.from('competence_mentors').select('name, active').eq('employee_card_id', mentorCard).maybeSingle()
    if (!mentor || !mentor.active) return { ok: false, mentorRequired: true, error: 'Ta kartica nije imenovani mentor. Pozovite mentora ili šefa.' }
    const { data: mst } = await sb.from('competence_status').select('status').eq('employee_card_id', mentorCard).maybeSingle()
    if (mst?.status === 'TRAINING') return { ok: false, mentorRequired: true, error: 'Taj mentor trenutno sam nije prošao provjeru znanja.' }

    return { ok: true, supervised: { mentorCardId: mentorCard, mentorName: mentor.name } }
  } catch (e) {
    console.error('competenceGate failed (allowing):', e)
    return { ok: true }
  }
}

/** Upisuje nadziranu smjenu (jedna po radniku i danu) i povećava brojač. Greška ne poništava zaduženje. */
export async function logSupervisedShift(cardIdRaw: string, sup: { mentorCardId: string; mentorName: string }, equipmentCode: string): Promise<void> {
  try {
    const card = normCard(cardIdRaw)
    const sb = createServiceClient()
    const { error } = await sb.from('competence_supervised_log').insert({
      employee_card_id: card, mentor_card_id: sup.mentorCardId, mentor_name: sup.mentorName,
      shift_date: localDate(), equipment_code: equipmentCode,
    })
    if (error) {
      if (error.code !== '23505') console.error('logSupervisedShift failed:', error.message) // 23505 = ta smjena je već upisana
      return
    }
    const { data: st } = await sb.from('competence_status').select('supervised_done, supervised_required, employee_name').eq('employee_card_id', card).maybeSingle()
    if (!st) return
    const done = Math.min((st.supervised_done ?? 0) + 1, st.supervised_required ?? 3)
    const patch: Record<string, unknown> = { supervised_done: done, updated_at: new Date().toISOString() }
    // Čim su sve nadzirane smjene odrađene, otvara se ponovni test
    if (done >= (st.supervised_required ?? 3)) { patch.pending_kind = 'RETEST'; patch.pending_due = localDate(new Date(Date.now() + 7 * 86_400_000)) }
    await sb.from('competence_status').update(patch).eq('employee_card_id', card)
  } catch (e) {
    console.error('logSupervisedShift failed:', e)
  }
}
