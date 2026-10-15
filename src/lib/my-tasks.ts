// Čista logika za "Moj zadatak" — bez I/O, da se može testirati odvojeno.
// Svaka rola vidi ono što čeka NJU; svaki zadatak vodi na jedan tab (1 klik).

export type TaskRole = 'operator' | 'engineer' | 'admin'

import { staleInfo } from '@/lib/workshop'

export interface TaskDamage {
  id: string
  status: string
  severity?: string | null
  equipmentCode?: string | null
  acknowledgedAt?: Date | string | null
  workshopArrivedAt?: Date | string | null
  lastStatusAt?: Date | string | null
}

export interface TaskInspectionRow {
  code: string
  status: string
  inspection: unknown | null
}

export interface MyTask {
  key: string
  title: string
  detail: string
  count: number
  tab: string
  action?: 'inspect'
  tone: 'red' | 'amber' | 'blue'
}

const ROLE_RANK: Record<TaskRole, number> = { operator: 0, engineer: 1, admin: 2 }

export function roleAtLeast(role: string, min: TaskRole): boolean {
  const r = ROLE_RANK[role as TaskRole]
  return r !== undefined && r >= ROLE_RANK[min]
}

function list(codes: (string | null | undefined)[], max = 4): string {
  const c = codes.filter(Boolean) as string[]
  if (c.length <= max) return c.join(', ')
  return `${c.slice(0, max).join(', ')} +${c.length - max}`
}

export function computeMyTasks(
  role: string,
  damages: TaskDamage[],
  inspections: TaskInspectionRow[],
  openFodCount = 0,
  newWildlifeCount = 0,
): MyTask[] {
  const tasks: MyTask[] = []

  // Nepotvrđeni (novi) kvarovi — radionica
  if (roleAtLeast(role, 'engineer')) {
    const fresh = damages.filter((d) => d.status === 'OPEN' && !d.acknowledgedAt)
    if (fresh.length > 0) {
      tasks.push({
        key: 'new-damages',
        title: 'Novi kvarovi čekaju preuzimanje',
        detail: list(fresh.map((d) => d.equipmentCode)),
        count: fresh.length,
        tab: 'maintenance',
        tone: fresh.some((d) => d.severity === 'CRITICAL') ? 'red' : 'amber',
      })
    }
  }

  // Sredstva u radionici bez promjene statusa 3+ dana - upozorenje, obavezan unos statusa
  if (roleAtLeast(role, 'engineer')) {
    const stale = damages.filter((d) => staleInfo(d).due)
    if (stale.length > 0) {
      tasks.unshift({
        key: 'stale-workshop',
        title: 'UPOZORENJE: sredstva predugo u radionici bez statusa',
        detail: list(stale.map((d) => `${d.equipmentCode} (${staleInfo(d).days} d)`)),
        count: stale.length,
        tab: 'maintenance',
        tone: 'red',
      })
    }
  }

  // FOD prijavljen, ali još nije potvrđeno uklanjanje
  if (roleAtLeast(role, 'engineer') && openFodCount > 0) {
    tasks.push({
      key: 'open-fod',
      title: 'FOD čeka uklanjanje',
      detail: 'Označite uklonjeno kad se predmet stvarno ukloni',
      count: openFodCount,
      tab: 'fod-wildlife',
      tone: 'amber',
    })
  }

  // Wildlife prijave koje admin još nije obradio
  if (roleAtLeast(role, 'admin') && newWildlifeCount > 0) {
    tasks.push({
      key: 'new-wildlife',
      title: 'Wildlife prijave čekaju obradu',
      detail: 'Odredite status i preduzetu mjeru',
      count: newWildlifeCount,
      tab: 'fod-wildlife',
      tone: 'amber',
    })
  }

  // Popravke koje čekaju odobrenje — samo šef (admin)
  if (roleAtLeast(role, 'admin')) {
    const waiting = damages.filter((d) => d.status === 'AWAITING_APPROVAL')
    if (waiting.length > 0) {
      tasks.push({
        key: 'awaiting-approval',
        title: 'Popravke čekaju vaše odobrenje',
        detail: list(waiting.map((d) => d.equipmentCode)),
        count: waiting.length,
        tab: 'maintenance',
        tone: 'red',
      })
    }
  }

  // Neobavljeni dnevni pregledi — svi
  const pending = inspections.filter(
    (i) => !i.inspection && i.status !== 'OUT_OF_SERVICE',
  )
  if (pending.length > 0) {
    tasks.push({
      key: 'daily-inspections',
      title: 'Neobavljeni dnevni pregledi',
      detail: list(pending.map((i) => i.code)),
      count: pending.length,
      tab: 'adr',
      action: 'inspect',
      tone: 'blue',
    })
  }

  return tasks
}
