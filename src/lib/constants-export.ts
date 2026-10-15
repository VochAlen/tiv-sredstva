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

// ADR.OPS.B.016 — FOD tipovi predmeta
export const FOD_ITEM_TYPE_LABELS: Record<string, string> = {
  AIRCRAFT_PART: 'Dio vazduhoplova', TOOL: 'Alat', CATERING: 'Catering otpad',
  PERSONAL_ITEM: 'Lični predmet', PAVEMENT: 'Dio kolovoza', CONSTRUCTION: 'Građevinski materijal',
  PLASTIC: 'Plastika/ambalaža', OTHER: 'Ostalo',
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
//
// Težina neispravne stavke određuje šta se desi sa sredstvom:
//  BLOCKING    -> sredstvo je NEISPRAVNO (van upotrebe), automatski se otvara prijava kvara
//  RESTRICTIVE -> sredstvo je ISPRAVNO SA OGRANIČENJEM (npr. ne u uslovima smanjene vidljivosti), otvara se prijava kvara
//  MINOR       -> sredstvo ostaje ispravno, otvara se prijava manjeg kvara za radionicu
// Ovo je jedino mjesto gdje se te odluke mijenjaju; server uvijek uzima težinu odavde (ne od klijenta).
export type DailyItemSeverity = 'BLOCKING' | 'RESTRICTIVE' | 'MINOR'

export interface DailyChecklistDef {
  id: string
  label: string
  passed: boolean
  severity: DailyItemSeverity
  category: 'MEHANIKA' | 'ELEKTRIKA' | 'HIDRAULIKA' | 'BEZBJEDNOST' | 'OPSTE'
  /** Težina prijave kvara kad je stavka BLOCKING (zadano MAJOR) */
  damageSeverity?: 'MINOR' | 'MAJOR' | 'CRITICAL'
  restrictionCode?: string
  restrictionLabel?: string
}

export const DAILY_INSPECTION_CHECKLIST: DailyChecklistDef[] = [
  { id: 'fluids', label: 'Nivo ulja i rashladne tečnosti', passed: false, severity: 'BLOCKING', category: 'MEHANIKA' },
  { id: 'tires', label: 'Vizuelni pregled guma (pritisak, oštećenja)', passed: false, severity: 'BLOCKING', category: 'MEHANIKA' },
  { id: 'lights', label: 'Svjetla', passed: false, severity: 'RESTRICTIVE', category: 'ELEKTRIKA',
    restrictionCode: 'DAYTIME_ONLY', restrictionLabel: 'Ne koristiti u uslovima smanjene vidljivosti' },
  { id: 'wipers', label: 'Brisači vjetrobranskog stakla', passed: false, severity: 'RESTRICTIVE', category: 'ELEKTRIKA',
    restrictionCode: 'FAIR_WEATHER_ONLY', restrictionLabel: 'Koristiti samo po lijepom vremenu (ne po kiši)' },
  { id: 'brakes', label: 'Test kočionog sistema', passed: false, severity: 'BLOCKING', category: 'MEHANIKA', damageSeverity: 'CRITICAL' },
  { id: 'steering', label: 'Provjera upravljačkog sistema', passed: false, severity: 'BLOCKING', category: 'MEHANIKA', damageSeverity: 'CRITICAL' },
  // Minimum dnevnih provjera po AMC1 ADR.OPS.C.007(a)(1): upozorenja, komunikacija, pričvršćena oprema, curenje
  { id: 'warnings', label: 'Kontrolne lampe i upozorenja na instrument tabli (bez kvarova)', passed: false, severity: 'BLOCKING', category: 'ELEKTRIKA' },
  { id: 'comms', label: 'Radio-veza i komunikacioni uređaji (transponder, ako je ugrađen)', passed: false, severity: 'RESTRICTIVE', category: 'ELEKTRIKA',
    restrictionCode: 'NO_MOVEMENT_AREA', restrictionLabel: 'Ne koristiti na manevarskoj površini (nema ispravne radio-veze)' },
  { id: 'secured', label: 'Oprema na vozilu je pričvršćena / osigurana', passed: false, severity: 'MINOR', category: 'BEZBJEDNOST' },
  { id: 'leaks', label: 'Nema curenja (ulje, gorivo, rashladna tečnost, hidraulika)', passed: false, severity: 'MINOR', category: 'MEHANIKA' },
  { id: 'horn', label: 'Sirena signalizacija', passed: false, severity: 'MINOR', category: 'ELEKTRIKA' },
  { id: 'mirrors', label: 'Vanjski retrovizori i vidljivost', passed: false, severity: 'MINOR', category: 'OPSTE' },
  { id: 'body', label: 'Nova vanjska oštećenja vozila (vizuelni pregled)', passed: false, severity: 'MINOR', category: 'OPSTE' },
  { id: 'safety', label: 'Sigurnosna oprema (rogalj, znak, prva pomoć)', passed: false, severity: 'MINOR', category: 'BEZBJEDNOST' },
  { id: 'fire-ext', label: 'PP aparat (protivpožarni aparat)', passed: false, severity: 'MINOR', category: 'BEZBJEDNOST' },
  { id: 'clean', label: 'Čistoća vozila', passed: false, severity: 'MINOR', category: 'OPSTE' },
]
