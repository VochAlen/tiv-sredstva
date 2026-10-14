// Slanje emaila (samo server). Nikad ne baca grešku - vraća { ok, error }.
// Podržano: SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) ili Resend (RESEND_API_KEY).
// Pošiljalac: MAIL_FROM (npr. "GSE Control <gse@aerodrom.me>").

import nodemailer from 'nodemailer'

export interface MailInput { to: string[]; subject: string; text: string; html?: string }
export interface MailResult { ok: boolean; provider: 'smtp' | 'resend' | 'none'; error?: string }

export function mailConfigured(): 'smtp' | 'resend' | null {
  if (process.env.SMTP_HOST && process.env.MAIL_FROM) return 'smtp'
  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) return 'resend'
  return null
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/
export function parseEmails(raw: string | null | undefined): string[] {
  return [...new Set((raw ?? '').split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter((s) => EMAIL_RE.test(s)))]
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const to = input.to.filter((e) => EMAIL_RE.test(e))
  if (!to.length) return { ok: false, provider: 'none', error: 'Nema ispravne primaoce' }
  const provider = mailConfigured()
  if (!provider) return { ok: false, provider: 'none', error: 'Email nije podešen (SMTP_HOST ili RESEND_API_KEY, i MAIL_FROM)' }
  const from = process.env.MAIL_FROM as string
  try {
    if (provider === 'smtp') {
      const port = Number(process.env.SMTP_PORT || 587)
      const tr = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port, secure: port === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000,
      })
      await tr.sendMail({ from, to, subject: input.subject, text: input.text, html: input.html })
      return { ok: true, provider }
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: input.subject, text: input.text, html: input.html }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return { ok: false, provider, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` }
    return { ok: true, provider }
  } catch (e) {
    return { ok: false, provider, error: e instanceof Error ? e.message : 'Slanje nije uspjelo' }
  }
}
