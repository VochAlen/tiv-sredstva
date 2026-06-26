// Konstante za manuals (izdvojeno iz 'use server' fajla)
// 'use server' fajlovi mogu izvoziti samo async funkcije

export const MANUAL_TYPE_LABELS: Record<string, string> = {
  OPERATING: 'Uputstvo za upotrebu',
  MAINTENANCE: 'Uputstvo za održavanje',
  SAFETY: 'Sigurnosno uputstvo',
  PARTS: 'Katalog dijelova',
}

export const MANUAL_TYPE_LABELS_EN: Record<string, string> = {
  OPERATING: 'Operating Manual',
  MAINTENANCE: 'Maintenance Manual',
  SAFETY: 'Safety Manual',
  PARTS: 'Parts Catalog',
}

export interface EquipmentManualData {
  id: string
  equipmentId: string | null
  equipmentCode: string | null
  equipmentName: string | null
  equipmentType: string
  title: string
  manualUrl: string
  manualType: string
  language: string
  fileSize: number | null
  uploadedBy: string | null
  version: string | null
  active: boolean
  createdAt: Date
}

// Default daily inspection checklist (ADR.OPS.C.007 specific)
export const DAILY_INSPECTION_CHECKLIST = [
  { id: 'fluids', label: 'Nivo ulja i rashladne tečnosti', passed: false },
  { id: 'tires', label: 'Vizuelni pregled guma (pritisak, oštećenja)', passed: false },
  { id: 'lights', label: 'Svjetla (farovi, žmigavci, kočiona)', passed: false },
  { id: 'brakes', label: 'Test kočionog sistema', passed: false },
  { id: 'steering', label: 'Provjera upravljačkog sistema', passed: false },
  { id: 'horn', label: 'Sirena signalizacija', passed: false },
  { id: 'mirrors', label: 'Retrovizori i vidljivost', passed: false },
  { id: 'body', label: 'Karoserija - vizuelni pregled na oštećenja', passed: false },
  { id: 'safety', label: 'Sigurnosna oprema (rogalj, znak, prva pomoć)', passed: false },
  { id: 'clean', label: 'Čistoća vozila', passed: false },
]
