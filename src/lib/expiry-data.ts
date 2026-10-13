// Prikupljanje rokova iz baze. `client` = Supabase klijent (korisnički ili
// service-role za cron); u demo modu (Prisma) se ignoriše.
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { selectExpiring, type ExpiryItem } from '@/lib/expiry'

const iso = (v: unknown): string | null => {
  if (!v) return null
  const d = new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export async function collectExpiring(client: any | null, days: number) {
  const items: ExpiryItem[] = []
  const add = (kind: ExpiryItem['kind'], who: string, date: unknown, detail?: string) => {
    const d = iso(date)
    if (d) items.push({ kind, who, detail, date: d })
  }

  if (isDemoMode()) {
    const [drv, qual, skills, docs] = await Promise.all([
      db.driverAuthorization.findMany({ where: { active: true } }),
      db.equipmentQualification.findMany(),
      db.maintenanceSkill.findMany(),
      db.controlledDocument.findMany({ where: { status: 'PUBLISHED' } }),
    ])
    drv.forEach((d) => { add('DRIVER_LICENCE', d.employeeName, d.validUntil, d.licenseNumber ?? undefined); add('DRIVER_TRAINING', d.employeeName, d.trainingExpiry) })
    qual.forEach((q) => add('EQUIPMENT_QUALIFICATION', q.employeeName, q.validUntil, q.equipmentType))
    skills.forEach((s) => add('WORKSHOP_SKILL', s.employeeName, s.validUntil, s.category))
    docs.forEach((d) => add('DOCUMENT_REVIEW', `${d.docId} ${d.title}`, d.nextReviewDate))
  } else {
    const limit = new Date(Date.now() + (days + 1) * 86_400_000).toISOString()
    const [drv, qual, skills, docs] = await Promise.all([
      client.from('driver_authorizations').select('employee_name,license_number,valid_until,training_expiry').eq('active', true),
      client.from('equipment_qualifications').select('employee_name,equipment_type,valid_until').lte('valid_until', limit),
      client.from('maintenance_skills').select('employee_name,category,valid_until').lte('valid_until', limit),
      client.from('controlled_documents').select('doc_id,title,next_review_date').eq('status', 'PUBLISHED').lte('next_review_date', limit),
    ])
    for (const r of [drv, qual, skills, docs]) if (r.error) throw r.error
    ;(drv.data ?? []).forEach((d: any) => { add('DRIVER_LICENCE', d.employee_name, d.valid_until, d.license_number ?? undefined); add('DRIVER_TRAINING', d.employee_name, d.training_expiry) })
    ;(qual.data ?? []).forEach((q: any) => add('EQUIPMENT_QUALIFICATION', q.employee_name, q.valid_until, q.equipment_type))
    ;(skills.data ?? []).forEach((s: any) => add('WORKSHOP_SKILL', s.employee_name, s.valid_until, s.category))
    ;(docs.data ?? []).forEach((d: any) => add('DOCUMENT_REVIEW', `${d.doc_id} ${d.title}`, d.next_review_date))
  }
  return selectExpiring(items, days)
}
