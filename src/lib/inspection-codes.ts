// Digitalna zamjena za K1-K26 kodovnik iz PRG.03.02 (Program tehničkog
// održavanja operativne površine..., Tabela 5) - umjesto ručno kucane
// sintakse tipa "K18 (3/8/L/A101-B104)", radnik bira kategoriju iz liste i
// popunjava strukturirana polja; sistem sam sastavlja isti smisao podatka
// (i po potrebi može generisati identičan tekstualni kod za papirni trag).

export interface DefectMeasurement {
  field: 'lengthM' | 'maxWidthCm' | 'maxDepthCm'
  label: string
}

export interface DefectCategoryDef {
  code: string // K1..K26, radi trag sa papirnim sistemom
  category: string // vrijednost upisana u InspectionFinding.category
  label: string
  measurements: DefectMeasurement[]
  needsLocationCode?: boolean
  needsFenceStub?: boolean
  markable?: boolean // da li se markira crvenom bojom na terenu (isMarked)
}

// K1-K20 - kolovozni zastor, oznake, sistemi (periodični pregledi - MING)
export const PAVEMENT_DEFECT_CATEGORIES: DefectCategoryDef[] = [
  { code: 'K1', category: 'CRACK_LONGITUDINAL', label: 'Uzdužna pukotina', measurements: [{ field: 'lengthM', label: 'Dužina pukotine (m)' }, { field: 'maxWidthCm', label: 'Max širina (cm)' }], needsLocationCode: true, markable: true },
  { code: 'K2', category: 'CRACK_MESH', label: 'Mrežasta pukotina', measurements: [{ field: 'lengthM', label: 'Površina (m²)' }, { field: 'maxWidthCm', label: 'Max širina (cm)' }], needsLocationCode: true, markable: true },
  { code: 'K3', category: 'DEPRESSION_MINOR', label: 'Ulegnuće < 3cm (na 3m ravnjači)', measurements: [{ field: 'lengthM', label: 'Površina (m²)' }, { field: 'maxDepthCm', label: 'Max dubina (cm)' }], needsLocationCode: true },
  { code: 'K4', category: 'DEPRESSION_MAJOR', label: 'Ulegnuće > 3cm (na 3m ravnjači)', measurements: [{ field: 'lengthM', label: 'Površina (m²)' }, { field: 'maxDepthCm', label: 'Max dubina (cm)' }], needsLocationCode: true },
  { code: 'K5', category: 'BUMP_MINOR', label: 'Izbočina < 1.25cm', measurements: [{ field: 'lengthM', label: 'Površina (m²)' }, { field: 'maxDepthCm', label: 'Max visina (cm)' }], needsLocationCode: true },
  { code: 'K6', category: 'BUMP_MAJOR', label: 'Izbočina > 1.25cm', measurements: [{ field: 'lengthM', label: 'Površina (m²)' }, { field: 'maxDepthCm', label: 'Max visina (cm)' }], needsLocationCode: true },
  { code: 'K7', category: 'SHARP_EDGE', label: 'Izbočina oštrih ivica', measurements: [{ field: 'lengthM', label: 'Dužina oštre ivice (m)' }, { field: 'maxDepthCm', label: 'Max visina (cm)' }], needsLocationCode: true },
  { code: 'K8', category: 'SPALLING', label: 'Ljuspanje', measurements: [{ field: 'lengthM', label: 'Površina (m²)' }], needsLocationCode: true },
  { code: 'K9', category: 'SEALANT_CRACKED', label: 'Ispucala zaptivna masa', measurements: [], needsLocationCode: true },
  { code: 'K10', category: 'SEALANT_MISSING', label: 'Ispala zaptivna masa', measurements: [{ field: 'lengthM', label: 'Dužina otvora (m)' }, { field: 'maxWidthCm', label: 'Max širina (cm)' }], needsLocationCode: true },
  { code: 'K11', category: 'SEALANT_ABOVE', label: 'Zaptivna masa iznad nivoa pukotine', measurements: [{ field: 'lengthM', label: 'Dužina ispupčenja (m)' }, { field: 'maxDepthCm', label: 'Max visina (cm)' }], needsLocationCode: true },
  { code: 'K12', category: 'SEALANT_BELOW', label: 'Zaptivna masa ispod nivoa pukotine', measurements: [{ field: 'lengthM', label: 'Dužina udubljenja (m)' }, { field: 'maxWidthCm', label: 'Max širina (cm)' }, { field: 'maxDepthCm', label: 'Max dubina (cm)' }], needsLocationCode: true },
  { code: 'K13', category: 'OIL_STAIN', label: 'Naslage ulja i/ili maziva', measurements: [{ field: 'lengthM', label: 'Površina (m²)' }], needsLocationCode: true },
  { code: 'K14', category: 'FOREIGN_OBJECT', label: 'Prisutnost stranih predmeta (FOD)', measurements: [{ field: 'lengthM', label: 'Površina (m²)' }], needsLocationCode: true },
  { code: 'K15', category: 'VEGETATION_BLOCKING', label: 'Trava/rastinje zaklanja sijalicu/oznaku/uređaj', measurements: [], needsLocationCode: true },
  { code: 'K16', category: 'VEGETATION_LOW', label: 'Trava/rastinje < 30 cm', measurements: [], needsLocationCode: true },
  { code: 'K17', category: 'VEGETATION_HIGH', label: 'Trava/rastinje ≥ 30 cm', measurements: [], needsLocationCode: true },
  { code: 'K18', category: 'EROSION', label: 'Erozija terena', measurements: [{ field: 'lengthM', label: 'Površina (m²)' }, { field: 'maxDepthCm', label: 'Dubina (cm)' }], needsLocationCode: true },
  { code: 'K19', category: 'MARKING_VISIBILITY_OK', label: 'Uočljivost horizontalnih oznaka > 30%', measurements: [], needsLocationCode: true },
  { code: 'K20', category: 'MARKING_VISIBILITY_LOW', label: 'Uočljivost horizontalnih oznaka < 30%', measurements: [], needsLocationCode: true },
]

// K21-K26 - žičana ograda (dnevna FTO patrola + periodični pregledi)
export const FENCE_DEFECT_CATEGORIES: DefectCategoryDef[] = [
  { code: 'K21', category: 'FENCE_HOLE', label: 'Otvor/rupa na ogradi', measurements: [], needsFenceStub: true },
  { code: 'K22', category: 'FENCE_CUT', label: 'Presječena ograda', measurements: [], needsFenceStub: true },
  { code: 'K23', category: 'FENCE_GROUND_GAP', label: 'Rupa između mreže i zemljane površine', measurements: [], needsFenceStub: true },
  { code: 'K24', category: 'FENCE_POST_BENT', label: 'Iskrivljen stub', measurements: [], needsFenceStub: true },
  { code: 'K25', category: 'FENCE_VEGETATION', label: 'Rastinje uz ogradu (3m pojas)', measurements: [{ field: 'maxDepthCm', label: 'Visina rastinja (cm)' }], needsFenceStub: true },
  { code: 'K26', category: 'FENCE_WIRE_MISSING', label: 'Pokidana/nedostaje bodljikava žica', measurements: [], needsFenceStub: true },
  { code: 'K-GATE', category: 'FENCE_GATE_DAMAGE', label: 'Oštećena kapija na ogradi', measurements: [], needsFenceStub: true },
  { code: 'K-SIGN', category: 'FENCE_SIGN_MISSING', label: 'Otkačena/nedostaje tabla ili pločica sa brojem stuba', measurements: [], needsFenceStub: true },
]

export const ALL_DEFECT_CATEGORIES: DefectCategoryDef[] = [...PAVEMENT_DEFECT_CATEGORIES, ...FENCE_DEFECT_CATEGORIES]

export function getDefectCategoryDef(category: string): DefectCategoryDef | undefined {
  return ALL_DEFECT_CATEGORIES.find((c) => c.category === category)
}

// Tabela 6 - Kodovnik za opis lokacije
export const LOCATION_CODES: Array<{ code: string; label: string }> = [
  { code: 'L', label: 'Lijeva (Left)' },
  { code: 'C', label: 'Centar (Center)' },
  { code: 'R', label: 'Desna (Right)' },
  { code: 'S', label: 'Spoljašnja (Outer)' },
  { code: 'U', label: 'Unutrašnja (Inner)' },
]

// Tabela 7 - Kodovnik za ocjenu stanja
export const CONDITION_RATINGS: Array<{ code: string; label: string; hint: string }> = [
  { code: 'E', label: 'Odlično (Excellent)', hint: 'Bez nedostataka' },
  { code: 'G', label: 'Zadovoljava (Good)', hint: 'Zadovoljava sigurnosne uslove' },
  { code: 'A', label: 'Prihvatljivo (Acceptable)', hint: 'Na granici sigurnosnih uslova - potrebno češće praćenje' },
  { code: 'NA', label: 'Neprihvatljivo (Not Acceptable)', hint: 'Isključenje površine - potreban NOTAM' },
]
