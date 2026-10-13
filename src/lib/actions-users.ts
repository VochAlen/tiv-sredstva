'use server'

// Upravljanje korisnicima (SAMO admin): radnici sa ID karticom + nalozi za prijavu.
//   - služba            = employees.department
//   - radno mjesto      = employees.role
//   - aerodrom          = employees.airport / profiles.airport (TIVAT | PODGORICA) - samo oznaka
//   - pravo pristupa    = profiles.role (operator | engineer | admin)
// "Brisanje" = deaktivacija: istorija zaduženja/pregleda ostaje (ADR evidencija).
// Supabase: sve ide preko service-role klijenta (auth.admin API traži taj ključ).

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/actions-advanced'

export type UserRole = 'operator' | 'engineer' | 'admin'
export type Airport = 'TIVAT' | 'PODGORICA'

export interface UserRow {
  key: string // card_id, ili 'p:<profileId>' za nalog bez radnika
  cardId: string | null
  name: string
  service: string
  jobTitle: string
  airport: Airport
  active: boolean
  hasPin: boolean
  account: { id: string; email: string; role: UserRole; active: boolean } | null
}

export interface UsersData {
  users: UserRow[]
  accountsAvailable: boolean // false u demo modu
  services: string[]
  jobTitles: string[]
  currentUserId: string
}

export interface SaveUserInput {
  originalKey?: string // postojeći red; prazno = novi korisnik
  cardId: string
  name: string
  service: string
  jobTitle: string
  airport: Airport
  pin?: string | null // undefined = ne dirati, '' = obriši
  account?: { email: string; role: UserRole; password?: string } | null // null/undefined = bez naloga (postojeći nalog ostaje)
}

type Result = { ok: boolean; error?: string }

const ROLES: UserRole[] = ['operator', 'engineer', 'admin']
const AIRPORTS: Airport[] = ['TIVAT', 'PODGORICA']
const CARD_RE = /^[A-Z0-9][A-Z0-9._-]{1,29}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const BAN_FOREVER = '876000h'

async function requireAdmin(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (user.role !== 'admin') throw new Error('Nemate dozvolu. Potrebna rola: admin')
  return user
}

function needService() {
  if (!hasServiceClient()) {
    throw new Error('Upravljanje korisnicima traži SUPABASE_SERVICE_ROLE_KEY u Vercel environment varijablama.')
  }
  return createServiceClient()
}

const clean = (s: string | null | undefined, max: number) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

// =====================================================
// Lista
// =====================================================

export async function listUsers(): Promise<UsersData> {
  const admin = await requireAdmin()

  if (isDemoMode()) {
    const emps = await db.employee.findMany({ orderBy: { name: 'asc' } })
    const users: UserRow[] = emps.map((e) => ({
      key: e.cardId, cardId: e.cardId, name: e.name, service: e.department, jobTitle: e.role,
      airport: (AIRPORTS.includes(e.airport as Airport) ? e.airport : 'TIVAT') as Airport,
      active: e.active, hasPin: !!e.pin, account: null,
    }))
    return { users, accountsAvailable: false, services: uniq(users.map((u) => u.service)), jobTitles: uniq(users.map((u) => u.jobTitle)), currentUserId: admin.id }
  }

  const supabase = needService()
  const employees: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('employees').select('id,card_id,name,department,role,airport,active,pin').order('name').range(from, from + 999)
    if (error) throw new Error(error.message)
    employees.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const profiles: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('profiles').select('id,email,full_name,card_id,role,department,airport,active').order('email').range(from, from + 999)
    if (error) throw new Error(error.message)
    profiles.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const byCard = new Map<string, any>()
  for (const p of profiles) if (p.card_id) byCard.set(String(p.card_id).toUpperCase(), p)
  const usedProfiles = new Set<string>()
  const airportOf = (a: unknown): Airport => (AIRPORTS.includes(a as Airport) ? (a as Airport) : 'TIVAT')
  const acct = (p: any) => (p ? { id: p.id as string, email: p.email as string, role: (ROLES.includes(p.role) ? p.role : 'operator') as UserRole, active: p.active !== false } : null)

  const users: UserRow[] = employees.map((e) => {
    const p = byCard.get(String(e.card_id).toUpperCase())
    if (p) usedProfiles.add(p.id)
    return {
      key: e.card_id, cardId: e.card_id, name: e.name, service: e.department ?? '', jobTitle: e.role ?? '',
      airport: airportOf(e.airport), active: e.active !== false, hasPin: !!e.pin, account: acct(p),
    }
  })
  // nalozi bez radnika (nema card_id ili kartica nije u employees)
  for (const p of profiles) {
    if (usedProfiles.has(p.id)) continue
    users.push({
      key: `p:${p.id}`, cardId: p.card_id ?? null, name: p.full_name || p.email, service: p.department ?? '', jobTitle: '',
      airport: airportOf(p.airport), active: p.active !== false, hasPin: false, account: acct(p),
    })
  }
  users.sort((a, b) => a.name.localeCompare(b.name, 'hr'))
  return { users, accountsAvailable: true, services: uniq(users.map((u) => u.service)), jobTitles: uniq(users.map((u) => u.jobTitle)), currentUserId: admin.id }
}

const uniq = (a: string[]) => [...new Set(a.map((x) => x.trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'hr'))

// =====================================================
// Snimanje (novi / izmjena)
// =====================================================

async function countOtherActiveAdmins(supabase: ReturnType<typeof createServiceClient>, exceptId: string): Promise<number> {
  const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
    .eq('role', 'admin').neq('active', false).neq('id', exceptId)
  return count ?? 0
}

export async function saveUser(input: SaveUserInput): Promise<Result> {
  try {
    const admin = await requireAdmin()
    const card = clean(input.cardId, 30).toUpperCase()
    const name = clean(input.name, 100)
    const service = clean(input.service, 60)
    const jobTitle = clean(input.jobTitle, 60)
    const airport = input.airport
    const isNew = !input.originalKey
    const origCard = input.originalKey && !input.originalKey.startsWith('p:') ? input.originalKey : null
    const origProfileId = input.originalKey?.startsWith('p:') ? input.originalKey.slice(2) : null

    if (!CARD_RE.test(card)) return { ok: false, error: 'ID kartica: 2-30 znakova (slova, brojevi, - _ .), npr. EMP-1011' }
    if (name.length < 2) return { ok: false, error: 'Unesite ime i prezime' }
    if (!service) return { ok: false, error: 'Unesite naziv službe' }
    if (!jobTitle) return { ok: false, error: 'Unesite naziv radnog mjesta' }
    if (!AIRPORTS.includes(airport)) return { ok: false, error: 'Izaberite aerodrom' }
    if (origCard && origCard !== card) return { ok: false, error: 'ID kartica se ne može mijenjati (vezana je za istoriju zaduženja). Dodajte novog korisnika.' }
    const pin = input.pin === undefined ? undefined : clean(input.pin, 10)
    if (pin) {
      if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'PIN mora imati tačno 4 cifre' }
    }
    const acc = input.account ?? null
    if (acc) {
      if (!EMAIL_RE.test(acc.email.trim())) return { ok: false, error: 'Unesite ispravan email' }
      if (!ROLES.includes(acc.role)) return { ok: false, error: 'Izaberite pravo pristupa' }
      if (acc.password && acc.password.length < 8) return { ok: false, error: 'Lozinka mora imati najmanje 8 znakova' }
    }

    // ---------- Demo (Prisma): samo radnici ----------
    if (isDemoMode()) {
      if (acc) return { ok: false, error: 'U demo modu nalozi za prijavu su fiksni; mogu se uređivati samo radnici.' }
      if (pin) {
        const clash = await db.employee.findFirst({ where: { pin, NOT: { cardId: card } } })
        if (clash) return { ok: false, error: 'Taj PIN već koristi drugi radnik' }
      }
      const existing = await db.employee.findUnique({ where: { cardId: card } })
      if (isNew && existing) return { ok: false, error: `ID kartica ${card} već postoji` }
      await db.employee.upsert({
        where: { cardId: card },
        update: { name, department: service, role: jobTitle, airport, ...(pin !== undefined && { pin: pin || null }) },
        create: { cardId: card, name, department: service, role: jobTitle, airport, ...(pin ? { pin } : {}) },
      })
      await logAudit(isNew ? 'USER_CREATED' : 'USER_UPDATED', 'employee', card, JSON.stringify({ name, service, jobTitle, airport }))
      revalidatePath('/')
      return { ok: true }
    }

    // ---------- Supabase ----------
    const supabase = needService()

    const { data: existing } = await supabase.from('employees').select('id,card_id').eq('card_id', card).maybeSingle()
    if (isNew && existing) return { ok: false, error: `ID kartica ${card} već postoji` }
    if (origProfileId && existing) {
      // nalog bez radnika dobija karticu koja već pripada drugom radniku
      const { data: other } = await supabase.from('profiles').select('id').eq('card_id', card).neq('id', origProfileId).maybeSingle()
      if (other) return { ok: false, error: `ID karticu ${card} već koristi drugi nalog` }
    }
    if (pin) {
      const { data: clash } = await supabase.from('employees').select('card_id').eq('pin', pin).neq('card_id', card).limit(1)
      if (clash && clash.length) return { ok: false, error: 'Taj PIN već koristi drugi radnik' }
    }

    // trenutni nalog (ako postoji)
    let profile: any = null
    if (origProfileId) {
      const { data } = await supabase.from('profiles').select('*').eq('id', origProfileId).maybeSingle()
      profile = data
    } else {
      const { data } = await supabase.from('profiles').select('*').eq('card_id', card).maybeSingle()
      profile = data
    }

    // zaštite od zaključavanja
    if (profile && acc) {
      if (profile.id === admin.id && acc.role !== 'admin') return { ok: false, error: 'Ne možete sami sebi oduzeti admin pravo.' }
      if (profile.role === 'admin' && acc.role !== 'admin' && (await countOtherActiveAdmins(supabase, profile.id)) < 1) {
        return { ok: false, error: 'Mora ostati bar jedan aktivan admin.' }
      }
    }

    // 1) radnik
    const empRow: Record<string, unknown> = { card_id: card, name, department: service, role: jobTitle, airport }
    if (pin !== undefined) empRow.pin = pin || null
    if (isNew || !existing) empRow.active = true
    const { error: empErr } = await supabase.from('employees').upsert(empRow, { onConflict: 'card_id' })
    if (empErr) return { ok: false, error: empErr.message }

    // 2) nalog za prijavu
    if (acc) {
      const email = acc.email.trim().toLowerCase()
      if (!profile) {
        if (!acc.password) return { ok: false, error: 'Za novi nalog unesite lozinku (najmanje 8 znakova)' }
        const { data: created, error: cErr } = await supabase.auth.admin.createUser({
          email, password: acc.password, email_confirm: true,
          user_metadata: { full_name: name, card_id: card },
        })
        if (cErr || !created?.user) {
          return { ok: false, error: /already|registered|exists/i.test(cErr?.message ?? '') ? 'Taj email već ima nalog' : (cErr?.message ?? 'Nalog nije kreiran') }
        }
        const { error: pErr } = await supabase.from('profiles').upsert({
          id: created.user.id, email, full_name: name, card_id: card, role: acc.role, department: service, airport, active: true,
        }, { onConflict: 'id' })
        if (pErr) return { ok: false, error: `Nalog je kreiran, ali prava nisu snimljena: ${pErr.message}` }
      } else {
        const authPatch: Record<string, unknown> = {}
        if (email !== String(profile.email).toLowerCase()) { authPatch.email = email; authPatch.email_confirm = true }
        if (acc.password) authPatch.password = acc.password
        if (Object.keys(authPatch).length) {
          const { error: aErr } = await supabase.auth.admin.updateUserById(profile.id, authPatch)
          if (aErr) return { ok: false, error: /already|registered|exists/i.test(aErr.message) ? 'Taj email već koristi drugi nalog' : aErr.message }
        }
        const { error: pErr } = await supabase.from('profiles').update({
          email, full_name: name, card_id: card, role: acc.role, department: service, airport,
        }).eq('id', profile.id)
        if (pErr) return { ok: false, error: pErr.message }
      }
    } else if (profile) {
      // bez izmjene naloga, ali služba/aerodrom/ime se prate radnika
      await supabase.from('profiles').update({ full_name: name, card_id: card, department: service, airport }).eq('id', profile.id)
    }

    await logAudit(isNew ? 'USER_CREATED' : 'USER_UPDATED', 'employee', card, JSON.stringify({ name, service, jobTitle, airport, account: acc ? { email: acc.email.trim().toLowerCase(), role: acc.role, passwordChanged: !!acc.password } : undefined }))
    revalidatePath('/')
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Greška pri snimanju' }
  }
}

// =====================================================
// Aktivacija / deaktivacija ("brisanje")
// =====================================================

export async function setUserActive(key: string, active: boolean): Promise<Result> {
  try {
    const admin = await requireAdmin()
    const profileOnly = key.startsWith('p:')
    const card = profileOnly ? null : key

    if (isDemoMode()) {
      if (!card) return { ok: false, error: 'Nije dostupno u demo modu' }
      await db.employee.update({ where: { cardId: card }, data: { active } })
      await logAudit(active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', 'employee', card)
      revalidatePath('/')
      return { ok: true }
    }

    const supabase = needService()
    let profile: any = null
    if (profileOnly) {
      const { data } = await supabase.from('profiles').select('id,role,active').eq('id', key.slice(2)).maybeSingle()
      profile = data
    } else {
      const { data } = await supabase.from('profiles').select('id,role,active').eq('card_id', card!).maybeSingle()
      profile = data
    }

    if (!active && profile) {
      if (profile.id === admin.id) return { ok: false, error: 'Ne možete deaktivirati sopstveni nalog.' }
      if (profile.role === 'admin' && (await countOtherActiveAdmins(supabase, profile.id)) < 1) {
        return { ok: false, error: 'Mora ostati bar jedan aktivan admin.' }
      }
    }

    if (card) {
      const { error } = await supabase.from('employees').update({ active }).eq('card_id', card)
      if (error) return { ok: false, error: error.message }
    }
    if (profile) {
      const { error } = await supabase.from('profiles').update({ active }).eq('id', profile.id)
      if (error) return { ok: false, error: error.message }
      // blokira i prijavu / obnovu sesije na nivou Supabase Auth
      const { error: aErr } = await supabase.auth.admin.updateUserById(profile.id, { ban_duration: active ? 'none' : BAN_FOREVER })
      if (aErr) return { ok: false, error: `Nalog je označen, ali blokada prijave nije primijenjena: ${aErr.message}` }
    }

    await logAudit(active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', 'employee', card ?? key)
    revalidatePath('/')
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Greška' }
  }
}
