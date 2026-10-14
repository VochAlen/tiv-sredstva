// Email obavještenja šefu tehničke službe (samo server; NIJE 'use server' - poziva se iz drugih server akcija i cron-a).
// Radi i iz javnog worker toka (nema sesije) - zato koristi service-role klijent kad je dostupan.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { sendMail, parseEmails, type MailResult } from '@/lib/mailer'

export const CHIEF_EMAILS_KEY = 'tech_chief_emails'

export const appUrl = () =>
  (process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).replace(/\/$/, '')

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

/** Adrese iz podešavanja (baza) + opciono TECH_CHIEF_EMAIL iz env-a. */
export async function getTechChiefEmails(): Promise<string[]> {
  let stored: string | null = null
  try {
    if (isDemoMode()) {
      stored = (await db.notificationSetting.findUnique({ where: { key: CHIEF_EMAILS_KEY } }))?.value ?? null
    } else if (hasServiceClient()) {
      const { data } = await createServiceClient().from('notification_settings').select('value').eq('key', CHIEF_EMAILS_KEY).maybeSingle()
      stored = data?.value ?? null
    }
  } catch {
    /* tabela još ne postoji (032 nije pokrenuta) - koristi env */
  }
  return [...new Set([...parseEmails(stored), ...parseEmails(process.env.TECH_CHIEF_EMAIL)])]
}

export interface ExternalEquipment {
  id: string
  code: string
  name: string
  externallyMaintained: boolean
  provider: string | null
  phone: string | null
  email: string | null
}

export async function loadExternalInfo(by: { id?: string; code?: string }): Promise<ExternalEquipment | null> {
  try {
    if (isDemoMode()) {
      const e = by.id ? await db.equipment.findUnique({ where: { id: by.id } }) : by.code ? await db.equipment.findUnique({ where: { code: by.code } }) : null
      return e ? { id: e.id, code: e.code, name: e.name, externallyMaintained: e.externallyMaintained, provider: e.serviceProvider, phone: e.serviceProviderPhone, email: e.serviceProviderEmail } : null
    }
    if (!hasServiceClient()) return null
    const q = createServiceClient().from('equipment').select('id,code,name,externally_maintained,service_provider,service_provider_phone,service_provider_email')
    const { data } = await (by.id ? q.eq('id', by.id) : q.eq('code', by.code ?? '')).maybeSingle()
    return data ? { id: data.id, code: data.code, name: data.name, externallyMaintained: !!data.externally_maintained, provider: data.service_provider, phone: data.service_provider_phone, email: data.service_provider_email } : null
  } catch {
    return null // kolone još ne postoje (032) - nema obavještenja, ali ni greške u toku prijave
  }
}

export function providerBlock(e: Pick<ExternalEquipment, 'provider' | 'phone' | 'email'>): string[] {
  if (!e.provider && !e.phone && !e.email) return ['Eksterni serviser: nije upisan kontakt (dopunite u Servisni plan > Plan).']
  return [`Eksterni serviser: ${e.provider ?? '—'}`, `Telefon: ${e.phone ?? '—'}`, `Email: ${e.email ?? '—'}`]
}

function render(title: string, lines: string[], link?: string): { text: string; html: string } {
  const text = [title, '', ...lines, ...(link ? ['', `Otvori aplikaciju: ${link}`] : []), '', '— GSE Control (automatska poruka)'].join('\n')
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;max-width:620px">
<h2 style="margin:0 0 12px;color:#b91c1c;font-size:17px">${esc(title)}</h2>
${lines.map((l) => (l ? `<div style="margin:2px 0">${esc(l)}</div>` : '<div style="height:8px"></div>')).join('')}
${link ? `<p style="margin-top:16px"><a href="${esc(link)}" style="background:#0b2a4a;color:#fff;padding:9px 14px;border-radius:6px;text-decoration:none">Otvori GSE Control</a></p>` : ''}
<p style="color:#6b7280;font-size:12px;margin-top:20px">GSE Control — automatska poruka</p></div>`
  return { text, html }
}

export interface FaultInfo {
  equipmentId?: string
  code?: string
  source: 'DAMAGE' | 'INSPECTION'
  severity?: string // CRITICAL | MAJOR | MINOR
  result?: string // FIT | CONDITIONAL | UNFIT (pregled)
  description: string
  reporter: string
}

/** Šefu tehničke službe ako je sredstvo na eksternom održavanju. Nikad ne baca grešku. */
export async function notifyExternalFault(f: FaultInfo): Promise<MailResult | null> {
  try {
    const eq = await loadExternalInfo({ id: f.equipmentId, code: f.code })
    if (!eq || !eq.externallyMaintained) return null
    const to = await getTechChiefEmails()
    if (!to.length) return { ok: false, provider: 'none', error: 'Šef tehničke službe nema upisanu email adresu' }
    const sev = f.severity === 'CRITICAL' ? 'KRITIČAN' : f.severity === 'MAJOR' ? 'veći' : f.severity === 'MINOR' ? 'manji' : ''
    const res = f.result === 'UNFIT' ? 'NEISPRAVNO (ne smije u upotrebu)' : f.result === 'CONDITIONAL' ? 'USLOVNO ISPRAVNO' : ''
    const title = `Kvar na sredstvu ${eq.code} — ${eq.name}`
    const lines = [
      `Sredstvo: ${eq.code} — ${eq.name}`,
      f.source === 'DAMAGE' ? `Prijava kvara${sev ? ` (${sev})` : ''}` : `Dnevni pregled${res ? `: ${res}` : ''}`,
      `Opis: ${f.description.slice(0, 600)}`,
      `Prijavio/la: ${f.reporter}`,
      '',
      'Ovo sredstvo održava isključivo eksterni serviser — potrebno ga je kontaktirati.',
      ...providerBlock(eq),
    ]
    const { text, html } = render(title, lines, appUrl() || undefined)
    return await sendMail({ to, subject: `[GSE] ${title} (eksterni serviser${eq.provider ? `: ${eq.provider}` : ''})`, text, html })
  } catch (e) {
    return { ok: false, provider: 'none', error: e instanceof Error ? e.message : 'Greška' }
  }
}

export async function sendServiceDigest(subject: string, title: string, lines: string[]): Promise<MailResult> {
  const to = await getTechChiefEmails()
  if (!to.length) return { ok: false, provider: 'none', error: 'Šef tehničke službe nema upisanu email adresu' }
  const { text, html } = render(title, lines, appUrl() ? `${appUrl()}/dashboard` : undefined)
  return sendMail({ to, subject, text, html })
}
