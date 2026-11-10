'use server'

// JAVNA akcija (radnik nije prijavljen): sredstva koja je ovaj radnik zadužio i još nije razdužio.
// Koristi se za veliko dugme "Vrati" na početnom ekranu. Vraća samo šifru, naziv, zadnje brojilo i vrijeme zaduženja.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { rateAllowed } from '@/lib/rate-limit'

export interface ActiveAssignment {
  code: string
  name: string
  since: string
  km: number
  hours: number
}

export async function getMyActiveAssignments(cardId: string): Promise<ActiveAssignment[]> {
  const card = String(cardId ?? '').trim().toUpperCase().slice(0, 40)
  if (card.length < 3) return []
  if (!(await rateAllowed('card'))) return []
  // zaduženja starija od 3 dana ne nude se kao "Vrati" (vjerovatno zaboravljena, rješava šef)
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000)
  try {
    if (isDemoMode()) {
      const rows = await db.assignment.findMany({
        where: { employeeCardId: card, action: 'CHECK_OUT', timestamp: { gte: since } },
        orderBy: { timestamp: 'desc' },
        take: 10,
      })
      const out: ActiveAssignment[] = []
      const seen = new Set<string>()
      for (const a of rows) {
        if (seen.has(a.equipmentId)) continue
        seen.add(a.equipmentId)
        const eq = await db.equipment.findUnique({ where: { id: a.equipmentId } })
        if (!eq || eq.status !== 'ASSIGNED') continue
        const last = await db.assignment.findFirst({ where: { equipmentId: a.equipmentId }, orderBy: { timestamp: 'desc' } })
        if (!last || last.id !== a.id) continue
        out.push({ code: eq.code, name: eq.name, since: a.timestamp.toISOString(), km: Number(eq.totalKm ?? 0), hours: Number(eq.totalOperatingHours ?? 0) })
      }
      return out
    }
    if (!hasServiceClient()) return []
    const sb = createServiceClient()
    const { data: rows } = await sb
      .from('assignments')
      .select('id,equipment_id,timestamp')
      .eq('employee_card_id', card)
      .eq('action', 'CHECK_OUT')
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: false })
      .limit(10)
    const out: ActiveAssignment[] = []
    const seen = new Set<string>()
    for (const a of rows ?? []) {
      if (seen.has(a.equipment_id)) continue
      seen.add(a.equipment_id)
      const { data: eq } = await sb.from('equipment').select('code,name,status,total_km,total_operating_hours').eq('id', a.equipment_id).maybeSingle()
      if (!eq || eq.status !== 'ASSIGNED') continue
      const { data: last } = await sb.from('assignments').select('id').eq('equipment_id', a.equipment_id).order('timestamp', { ascending: false }).limit(1).maybeSingle()
      if (!last || last.id !== a.id) continue
      out.push({ code: eq.code, name: eq.name, since: a.timestamp, km: Number(eq.total_km ?? 0), hours: Number(eq.total_operating_hours ?? 0) })
    }
    return out
  } catch (e) {
    console.error('getMyActiveAssignments', e)
    return []
  }
}
