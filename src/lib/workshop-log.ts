// Upis događaja u istoriju popravke (repair_status_log). Nikad ne baca grešku - istorija je dopuna, ne uslov.
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'

export type RepairEventKind = 'TAKEN' | 'ARRIVED' | 'STATUS' | 'CHIEF_OK' | 'CHIEF_FAILED' | 'HANDOVER' | 'EXTERNAL_SENT' | 'EXTERNAL_BACK'

export async function logRepairEvent(e: { damageId: string; kind: RepairEventKind; text?: string | null; byName: string; byCardId?: string | null; warned?: boolean }): Promise<void> {
  try {
    if (isDemoMode()) {
      await db.repairStatusLog.create({ data: { damageId: e.damageId, kind: e.kind, text: e.text ?? null, byName: e.byName, byCardId: e.byCardId ?? null, warned: !!e.warned } })
      return
    }
    const sb = await createSupabaseClient()
    await sb.from('repair_status_log').insert({ damage_id: e.damageId, kind: e.kind, text: e.text ?? null, by_name: e.byName, by_card_id: e.byCardId ?? null, warned: !!e.warned })
  } catch (err) {
    console.error('logRepairEvent', err)
  }
}
