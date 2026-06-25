// Tipovi za napredne funkcije

export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'INSPECTION' | 'OVERHAUL'
export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type QualificationLevel = 'OPERATOR' | 'SENIOR' | 'INSTRUCTOR'
export type WebhookType = 'SLACK' | 'TEAMS' | 'GENERIC' | 'EMAIL'

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  PREVENTIVE: 'Preventivno',
  CORRECTIVE: 'Korektivno',
  INSPECTION: 'Inspekcija',
  OVERHAUL: 'Generalni remont',
}

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  SCHEDULED: 'Zakazano',
  IN_PROGRESS: 'U toku',
  COMPLETED: 'Završeno',
  CANCELLED: 'Otkazano',
}

export const MAINTENANCE_STATUS_COLORS: Record<MaintenanceStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800 border-blue-300',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 border-amber-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-300',
}

export const QUALIFICATION_LEVEL_LABELS: Record<QualificationLevel, string> = {
  OPERATOR: 'Operator',
  SENIOR: 'Senior',
  INSTRUCTOR: 'Instruktor',
}

export interface Stats {
  total: number
  available: number
  assigned: number
  outOfService: number
  maintenance: number
  openDamages: number
  inspectionOverdue: number
  inspectionDueSoon: number
  totalCheckouts: number
  totalCheckins: number
  complianceRate: number
  mtbfHours: number
  mttrHours: number
  utilizationRate: number
}

export interface ActivityByDay {
  date: string
  checkouts: number
  checkins: number
  damages: number
}

export interface EquipmentUtilization {
  code: string
  name: string
  type: string
  checkouts: number
  utilizationRate: number
  damages: number
  lastActivity: string | null
}
