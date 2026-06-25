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

export type ActionType = 'CHECK_OUT' | 'CHECK_IN'
export type InspectionResult = 'OK' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE' | 'OUT_OF_SERVICE'
export type DamageSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL'
export type DamageStatus = 'OPEN' | 'IN_REPAIR' | 'RESOLVED'

export interface ChecklistItem {
  id: string
  label: string
  passed: boolean | null // null = nije odgovoreno
}

// Standardni AHM 340 pre-use inspection checklist
export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'tires', label: 'Gume i pneumatski u good stanju (bez oštećenja, odgovarajući pritisak)', passed: null },
  { id: 'body', label: 'Karoserija bez novih oštećenja', passed: null },
  { id: 'lights', label: 'Svjetla (farovi, žmigavci, kočiona) rade', passed: null },
  { id: 'brakes', label: 'Kočioni sistem funkcionalan', passed: null },
  { id: 'steering', label: 'Volan/upravljanje bez nenormalnih zvukova', passed: null },
  { id: 'hydraulics', label: 'Hidraulični sistem bez curenja', passed: null },
  { id: 'fluids', label: 'Nivo ulja i rashladne tečnosti OK', passed: null },
  { id: 'safety', label: 'Sigurnosni znakovi i reflektori prisutni', passed: null },
  { id: 'clean', label: 'Vozilo čisto, bez stranih predmeta', passed: null },
]

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
