// Pravilo: sredstvo se smije zadužiti samo ako je DANAS (lokalno vrijeme aerodroma) urađen dnevni pregled
// sa rezultatom FIT ili CONDITIONAL. Nepregledano sredstvo se ne nudi za zaduživanje, a server ga i odbija.
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { dayBounds, localDate } from '@/lib/local-day'

export const NOT_INSPECTED_MSG = 'Sredstvo danas nije pregledano. Dnevni pregled (provjera ispravnosti) mora biti urađen prije zaduživanja. Obavijestite nadležnog radnika ili šefa smjene.'

export async function wasInspectedToday(equipmentId: string): Promise<boolean> {
  const { start, end } = dayBounds(localDate(new Date()))
  try {
    if (isDemoMode()) {
      const n = await db.dailyInspection.count({ where: { equipmentId, inspectionDate: { gte: start, lte: end }, result: { in: ['FIT', 'CONDITIONAL'] } } })
      return n > 0
    }
    const sb = hasServiceClient() ? createServiceClient() : await createSupabaseClient()
    const { count, error } = await sb.from('daily_inspections').select('id', { count: 'exact', head: true })
      .eq('equipment_id', equipmentId).gte('inspection_date', start.toISOString()).lte('inspection_date', end.toISOString()).in('result', ['FIT', 'CONDITIONAL'])
    if (error) { console.error('wasInspectedToday', error.message); return false }
    return (count ?? 0) > 0
  } catch (e) {
    console.error('wasInspectedToday', e)
    return false
  }
}
