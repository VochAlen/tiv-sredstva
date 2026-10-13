// Privilegovani (service-role) Supabase klijent — SAMO za server: cron rute i
// obavještenja koja se pokreću iz anonimnog worker toka (nema sesije, a RLS
// čitanje webhook_settings dozvoljava samo adminu).
// Nikada ne importovati iz 'use client' koda. Ključ NIJE NEXT_PUBLIC_.
import { createClient } from '@supabase/supabase-js'

export function hasServiceClient(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY nije postavljen u Vercel environment varijablama')
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
