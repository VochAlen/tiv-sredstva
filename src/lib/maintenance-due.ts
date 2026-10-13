// Čist (client-safe) helper - filtrira već učitane inspekcijske alerte
// (iz getInspectionAlerts()) na one koji dospijevaju OVOG kalendarskog
// mjeseca ili su već isteklog (overdue). Koristi se za kompaktan
// "Dospijeva ovog mjeseca" presjek na Overview i Održavanje tabovima,
// da se planira unaprijed umjesto reaktivno na isteklu inspekciju.

export interface InspectionAlertLike {
  id: string
  code: string
  name: string
  type: string
  nextInspectionDate: string | null
  daysUntilDue: number | null
  status: 'OVERDUE' | 'DUE_SOON' | 'OK'
}

export function filterDueThisMonth<T extends InspectionAlertLike>(alerts: T[]): T[] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  return alerts
    .filter((a) => {
      if (a.status === 'OVERDUE') return true
      if (!a.nextInspectionDate) return false
      const d = new Date(a.nextInspectionDate)
      return d.getFullYear() === year && d.getMonth() === month
    })
    .sort((a, b) => (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999))
}
