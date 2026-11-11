// Čista logika AI sloja (bez mreže i baze): čišćenje teksta prije slanja, čitanje odgovora modela, validacija.
// AI daje SAMO prijedlog. Sve što vrati prolazi kroz provjeru ovdje, a čovjek potvrđuje prije upotrebe.

import { AUDIENCES, validateQuestionInput, type Audience, type QuestionValue } from '@/lib/competence-logic'

export const DAMAGE_CATEGORIES = ['MEHANIKA', 'ELEKTRIKA', 'HIDRAULIKA', 'BEZBJEDNOST', 'OPSTE'] as const
export type DamageCategory = (typeof DAMAGE_CATEGORIES)[number]

export const DAMAGE_TEXT_MIN = 6
export const DAMAGE_TEXT_MAX = 300
export const SOURCE_TEXT_MAX = 6000
export const QUESTION_DRAFTS_MIN = 3
export const QUESTION_DRAFTS_MAX = 10

/** Skida ono što ne smije u vanjski servis: broj kartice, email, telefon. Skraćuje na najviše `max` znakova. */
export function scrubText(text: string, max: number): string {
  return String(text ?? '')
    .replace(/\bEMP[-_ ]?[A-Z0-9]{2,}\b/gi, '[kartica]')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    .replace(/(\+?\d[\d\s/().-]{7,}\d)/g, '[broj]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** Izvlači JSON iz odgovora modela (model ponekad doda ```json ograde ili uvodnu rečenicu). */
export function extractJson(raw: string): unknown {
  const s = String(raw ?? '').replace(/```(?:json)?/gi, '')
  const open = s.search(/[[{]/)
  if (open < 0) return null
  const closeCh = s[open] === '[' ? ']' : '}'
  const close = s.lastIndexOf(closeCh)
  if (close <= open) return null
  try { return JSON.parse(s.slice(open, close + 1)) } catch { return null }
}

export interface QuestionDraft extends QuestionValue { fromAi: true }

/** Prijedlozi pitanja: nevaljana se odbacuju (ne popravljaju), admin vidi koliko ih je odbačeno. */
export function parseQuestionDrafts(raw: string, audience: Audience, max: number): { drafts: QuestionDraft[]; dropped: number } {
  const j = extractJson(raw)
  const arr = Array.isArray(j) ? j : j && typeof j === 'object' && Array.isArray((j as any).questions) ? (j as any).questions : []
  const drafts: QuestionDraft[] = []
  let dropped = 0
  const seen = new Set<string>()
  for (const x of arr.slice(0, max * 2)) {
    if (drafts.length >= max) break
    const v = validateQuestionInput({
      audience, topic: String(x?.topic ?? 'Opšte'), question: String(x?.question ?? ''),
      options: Array.isArray(x?.options) ? x.options.map(String) : [], correctIndex: Number(x?.correctIndex),
      critical: x?.critical === true, explanation: String(x?.explanation ?? ''),
    })
    const key = v.ok ? v.value.question.toLowerCase() : ''
    if (!v.ok || seen.has(key)) { dropped++; continue }
    seen.add(key)
    drafts.push({ ...v.value, fromAi: true })
  }
  return { drafts, dropped }
}

export interface DamageSuggestion { category: DamageCategory | null; text: string | null }

/** Prijedlog za prijavu kvara: samo poznata kategorija i kratak tekst. Težina se NE predlaže (ona odlučuje o blokadi). */
export function parseDamageSuggestion(raw: string): DamageSuggestion {
  const j: any = extractJson(raw)
  const cat = typeof j?.category === 'string' ? j.category.trim().toUpperCase() : ''
  const category = (DAMAGE_CATEGORIES as readonly string[]).includes(cat) ? (cat as DamageCategory) : null
  const text = typeof j?.text === 'string' ? scrubText(j.text, 200) : ''
  return { category, text: text.length >= 3 ? text : null }
}

export const isAudience = (a: unknown): a is Audience => AUDIENCES.includes(a as Audience)
