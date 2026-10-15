// Zajednički tipovi za GSE Control sistem

export type EquipmentStatus = 'AVAILABLE' | 'ASSIGNED' | 'OUT_OF_SERVICE' | 'MAINTENANCE'
export type EquipmentType =
  | 'TOW_TRACTOR'
  | 'GPU'
  | 'BELT_LOADER'
  | 'PUSHBACK'
  | 'STAIRS'
  | 'DOLLY'
  | 'LAVATORY'
  | 'WATER'
  | 'BUS'
  | 'OTHER'

// Služba kojoj sredstvo pripada (Equipment.department). null/nedefinisano se
// tretira kao TEHNICKA_SLUZBA - isto kao u dnevnim pregledima i štampi obrazaca.
export type EquipmentDepartment = 'TEHNICKA_SLUZBA' | 'SLUZBA_PO'

export const EQUIPMENT_DEPARTMENT_ORDER: EquipmentDepartment[] = ['TEHNICKA_SLUZBA', 'SLUZBA_PO']

export const EQUIPMENT_DEPARTMENT_LABELS: Record<EquipmentDepartment, string> = {
  TEHNICKA_SLUZBA: 'Tehnička služba',
  SLUZBA_PO: 'Služba zemaljskog opsluživanja (P/O)',
}

export type ActionType = 'CHECK_OUT' | 'CHECK_IN'
export type InspectionResult = 'OK' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE' | 'OUT_OF_SERVICE'
export type DamageSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL'
export type DamageStatus = 'OPEN' | 'IN_REPAIR' | 'RESOLVED'

// Kategorija kvara - određuje koji radnik radionice (po kvalifikaciji) smije
// preuzeti popravku. Vidi maintenance_skills i damage_reports.category.
export type ChecklistCategory = 'MEHANIKA' | 'ELEKTRIKA' | 'HIDRAULIKA' | 'BEZBJEDNOST' | 'OPSTE'

export const CHECKLIST_CATEGORY_ORDER: ChecklistCategory[] = [
  'MEHANIKA', 'ELEKTRIKA', 'HIDRAULIKA', 'BEZBJEDNOST', 'OPSTE',
]

export const CHECKLIST_CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  MEHANIKA: 'Mehanika',
  ELEKTRIKA: 'Elektrika',
  HIDRAULIKA: 'Hidraulika',
  BEZBJEDNOST: 'Bezbjednosna oprema',
  OPSTE: 'Opšte',
}

// Težina neispravne stavke u semafor evaluaciji (vidi checklist-evaluation.ts):
// BLOCKING -> zaduživanje odbijeno, RESTRICTIVE -> zaduženje uz ograničenje upotrebe
export type ChecklistSeverity = 'BLOCKING' | 'RESTRICTIVE'

// Aktivno ograničenje upotrebe sredstva (Equipment.activeRestrictions, JSON niz)
export interface RestrictionFlag {
  code: string
  label: string
  source: string // id stavke čeklista koja je izazvala ograničenje
  since: string // ISO datum
}

export interface ChecklistItem {
  id: string
  label: string
  passed: boolean | null // null = nije odgovoreno
  /** Težina neispravnosti - ako nije zadano, vrijedi staro polje `blocking` */
  severity?: ChecklistSeverity
  /** Kategorija kvara kad stavka padne (zadano: OPSTE) */
  category?: ChecklistCategory
  /** Šifra i opis ograničenja kad je severity RESTRICTIVE */
  restrictionCode?: string
  restrictionLabel?: string
  /** Grupa lokacije provjere (1/2/3) - iz papirnog obrasca "Dnevna čeklista" */
  group?: 1 | 2 | 3
  /** Period provjere - u papirnom obrascu uvijek "Dnevno" za ovu čeklistu */
  period?: string
  /** Da li je stavka blokirajuća (sredstvo se ne može zadužiti ako je neispravna) */
  blocking?: boolean
}

// Standardni AHM 340 pre-use inspection checklist - koristi se za tipove
// opreme za koje ne postoji poseban papirni obrazac (fallback).
export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'tires', label: 'Gume i pneumatski u good stanju (bez oštećenja, odgovarajući pritisak)', passed: null, group: 3 },
  { id: 'body', label: 'Karoserija bez novih oštećenja', passed: null, group: 2 },
  { id: 'lights', label: 'Svjetla', passed: null, group: 3 },
  { id: 'brakes', label: 'Kočioni sistem funkcionalan', passed: null, group: 3, blocking: true },
  { id: 'steering', label: 'Volan/upravljanje bez nenormalnih zvukova', passed: null, group: 3 },
  { id: 'hydraulics', label: 'Hidraulični sistem bez curenja', passed: null, group: 2 },
  { id: 'fluids', label: 'Nivo ulja i rashladne tečnosti OK', passed: null, group: 2 },
  { id: 'safety', label: 'Sigurnosni znakovi i reflektori prisutni', passed: null, group: 3 },
  { id: 'fire-ext', label: 'PP aparat (protivpožarni aparat) prisutan i ispravan', passed: null, group: 3 },
  { id: 'clean', label: 'Vozilo čisto, bez stranih predmeta', passed: null, group: 2 },
]

// =====================================================
// Dnevne čekliste po tipu sredstva - prepisano IDENTIČNO sa papirnih
// obrazaca ("Dnevna čeklista ... Aviogei/Bliss-Fox") koje koristi
// Tehnička služba. Ista čeklista vrijedi za sve jedinice istog tipa
// (npr. H103/H104/H105 za BELT_LOADER), jer su papirni obrasci
// identični po jedinici - razlikuje se samo naziv jedinice na vrhu.
// "Grupa lokacije provjere" (1/2/3) i "Period provjere" (Dnevno)
// prepisani tačno iz obrasca, radi usklađenosti sa PRG.03.02 / EASA ADR.
// =====================================================

// STEPENICE (Aviogei) - "Dnevna čeklista stepenica Aviogei H21/H22/H23"
const STAIRS_CHECKLIST: ChecklistItem[] = [
  { id: 'vital', label: 'Ispitati sve vitalne funkcije vozila', passed: null, group: 1, period: 'Dnevno', blocking: true },
  { id: 'fluid-leak', label: 'Provjeriti vozilo na prisustvo curenja fluida', passed: null, group: 2, period: 'Dnevno' },
  { id: 'chassis', label: 'Provjeriti oštećenja na šasiji', passed: null, group: 2, period: 'Dnevno' },
  { id: 'door-hinges', label: 'Provjeriti šarke, ručke i graničnike na vratima', passed: null, group: 2, period: 'Dnevno' },
  { id: 'glass-mirrors', label: 'Provjeriti stanje stakala i retrovizora', passed: null, group: 2, period: 'Dnevno' },
  { id: 'canopy-bumpers', label: 'Provjeriti stanje nadstrešnice i odbojnika na platformi', passed: null, group: 2, period: 'Dnevno' },
  { id: 'tires-steering', label: 'Provjeriti stanje pneumatika i upravljačku pokretljivost', passed: null, group: 3, period: 'Dnevno', blocking: true },
  { id: 'dash-lights', label: 'Provjeriti funkcionalnost lampi na komandnoj tabli', passed: null, group: 3, period: 'Dnevno' },
  { id: 'foot-brake', label: 'Provjeriti efikasnost nožnih kočnica', passed: null, group: 3, period: 'Dnevno', blocking: true },
  { id: 'hand-brake', label: 'Provjeriti efikasnost ručne kočnice', passed: null, group: 3, period: 'Dnevno', blocking: true },
  { id: 'wipers', label: 'Provjeriti funkciju brisača', passed: null, group: 3, period: 'Dnevno' },
  { id: 'signal-lights', label: 'Provjeriti funkciju signalizacije i rasvjete', passed: null, group: 3, period: 'Dnevno' },
  { id: 'fire-ext', label: 'Provjeriti PP aparat (protivpožarni aparat)', passed: null, group: 3, period: 'Dnevno' },
]

// ELEVATOR / BELT LOADER (Aviogei) - "Dnevna čeklista elevatora Aviogei H103/H104/H105"
const BELT_LOADER_CHECKLIST: ChecklistItem[] = [
  { id: 'vital', label: 'Ispitati sve vitalne funkcije vozila', passed: null, group: 1, period: 'Dnevno', blocking: true },
  { id: 'fluid-leak', label: 'Provjeriti vozilo na prisustvo curenja fluida', passed: null, group: 2, period: 'Dnevno' },
  { id: 'chassis-bumpers', label: 'Provjeriti oštećenja na šasiji / odbojni točkovi', passed: null, group: 2, period: 'Dnevno' },
  { id: 'door-hinges', label: 'Provjeriti šarke, ručke i graničnike na vratima', passed: null, group: 2, period: 'Dnevno' },
  { id: 'glass-mirrors', label: 'Provjeriti stanje stakala i retrovizora', passed: null, group: 2, period: 'Dnevno' },
  { id: 'tires-steering', label: 'Provjeriti stanje pneumatika i upravljačku pokretljivost', passed: null, group: 3, period: 'Dnevno', blocking: true },
  { id: 'dash-lights', label: 'Provjeriti funkcionalnost lampi na komandnoj tabli', passed: null, group: 3, period: 'Dnevno' },
  { id: 'foot-brake', label: 'Provjeriti efikasnost nožnih kočnica', passed: null, group: 3, period: 'Dnevno', blocking: true },
  { id: 'hand-brake', label: 'Provjeriti efikasnost ručne kočnice', passed: null, group: 3, period: 'Dnevno', blocking: true },
  { id: 'wipers', label: 'Provjeriti funkciju brisača', passed: null, group: 3, period: 'Dnevno' },
  { id: 'signal-lights', label: 'Provjeriti funkciju signalizacije i rasvjete', passed: null, group: 3, period: 'Dnevno' },
  { id: 'fire-ext', label: 'Provjeriti PP aparat (protivpožarni aparat)', passed: null, group: 3, period: 'Dnevno' },
]

// TEGLJAČ (Bliss-Fox) - "Dnevna čeklista tegljača Bliss-Fox H7/H8/H9/H10"
const TOW_TRACTOR_CHECKLIST: ChecklistItem[] = [
  { id: 'vital', label: 'Provjeriti ispravnost vitalnih funkcija', passed: null, group: 1, period: 'Dnevno', blocking: true },
  { id: 'fluid-leak', label: 'Provjeriti vozilo na prisustvo curenja fluida', passed: null, group: 2, period: 'Dnevno' },
  { id: 'door-hinges', label: 'Provjeriti šarke, ručke i graničnike na vratima', passed: null, group: 2, period: 'Dnevno' },
  { id: 'glass', label: 'Provjeriti sva stakla na vozilu', passed: null, group: 2, period: 'Dnevno' },
  { id: 'battery', label: 'Provjeriti napunjenost baterije – vizuelno', passed: null, group: 2, period: 'Dnevno' },
  { id: 'tires-steering', label: 'Provjeriti stanje pneumatika i sistem upravljanja', passed: null, group: 3, period: 'Dnevno', blocking: true },
  { id: 'display', label: 'Provjeriti funkciju displeja', passed: null, group: 3, period: 'Dnevno' },
  { id: 'brakes', label: 'Provjeriti kočioni sistem', passed: null, group: 3, period: 'Dnevno', blocking: true },
  { id: 'signal-lights-horn', label: 'Provjeriti funkciju signalizacije, rasvjete i sirene', passed: null, group: 3, period: 'Dnevno' },
  { id: 'wipers', label: 'Provjeriti funkciju brisača', passed: null, group: 3, period: 'Dnevno' },
  { id: 'fire-ext', label: 'Provjeriti PP aparat (protivpožarni aparat)', passed: null, group: 3, period: 'Dnevno' },
]

/**
 * Vraća dnevnu pre-use čeklistu za dati tip sredstva, identičnu
 * odgovarajućem papirnom obrascu. Za tipove bez posebnog obrasca
 * koristi se opšta (DEFAULT_CHECKLIST) čeklista.
 */
export function getChecklistForType(type: string): ChecklistItem[] {
  const map: Partial<Record<string, ChecklistItem[]>> = {
    STAIRS: STAIRS_CHECKLIST,
    BELT_LOADER: BELT_LOADER_CHECKLIST,
    TOW_TRACTOR: TOW_TRACTOR_CHECKLIST,
  }
  const list = map[type] ?? DEFAULT_CHECKLIST
  return list.map((i) => ({ ...i, passed: null }))
}

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  TOW_TRACTOR: 'Tow Tractor',
  GPU: 'GPU',
  BELT_LOADER: 'Belt Loader',
  PUSHBACK: 'Pushback',
  STAIRS: 'Putničke stepenice',
  DOLLY: 'Dolly',
  LAVATORY: 'Lavatory Service',
  WATER: 'Water Service',
  BUS: 'Putnički bus',
  OTHER: 'Ostalo',
}

export const STATUS_LABELS: Record<EquipmentStatus, string> = {
  AVAILABLE: 'Dostupno',
  ASSIGNED: 'Zaduženo',
  OUT_OF_SERVICE: 'Neispravno',
  MAINTENANCE: 'Na održavanju',
}

export const STATUS_COLORS: Record<EquipmentStatus, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  ASSIGNED: 'bg-amber-100 text-amber-800 border-amber-300',
  OUT_OF_SERVICE: 'bg-red-100 text-red-800 border-red-300',
  MAINTENANCE: 'bg-purple-100 text-purple-800 border-purple-300',
}

export const INSPECTION_RESULT_LABELS: Record<InspectionResult, string> = {
  OK: 'Ispravno',
  MINOR_DAMAGE: 'Manje oštećenje',
  MAJOR_DAMAGE: 'Veće oštećenje',
  OUT_OF_SERVICE: 'Neispravno',
}
