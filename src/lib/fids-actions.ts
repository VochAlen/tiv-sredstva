'use server'

// Akcije za public FIDS stranicu (anon read - nema auth potrebnog)
// Koristi Supabase ako je konfigurisan, inače Prisma fallback (dev mode)

import { createClientAsync } from './supabase/server'
import { isDemoMode } from './auth-mode'
import { db } from './db'

export type FidsEquipment = {
  id: string
  code: string
  name: string
  type: string
  serial_number: string | null
  location: string
  status: string
  in_use: boolean
}

export async function fetchFidsData(): Promise<FidsEquipment[]> {
  if (isDemoMode()) {
    // Dev fallback - Prisma/SQLite
    const data = await db.equipment.findMany({
      orderBy: [{ status: 'asc' }, { code: 'asc' }],
    })
    return data.map((e) => ({
      id: e.id,
      code: e.code,
      name: e.name,
      type: e.type,
      serial_number: e.serialNumber,
      location: e.location,
      status: e.status,
      in_use: e.status === 'ASSIGNED',
    }))
  }

  // Pravi Supabase - koristi anon read (RLS dozvoljava public read na equipment)
  const supabase = await createClientAsync()
  const { data, error } = await supabase
    .from('equipment')
    .select('id, code, name, type, serial_number, location, status')
    .order('status', { ascending: true })
    .order('code', { ascending: true })

  if (error) {
    console.error('FIDS fetch error:', error)
    return []
  }

  return (data ?? []).map((e) => ({
    id: e.id,
    code: e.code,
    name: e.name,
    type: e.type,
    serial_number: e.serial_number,
    location: e.location,
    status: e.status,
    in_use: e.status === 'ASSIGNED',
  }))
}
