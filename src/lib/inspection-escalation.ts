// src/lib/inspection-escalation.ts
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'

// EASA/ICAO Annex 19 SMS risk matrix (5x5, pojednostavljeno) — probability x severity -> risk level
function computeRiskLevel(probability: number, severity: number): string {
  const score = probability * severity
  if (score >= 15) return 'CRITICAL'
  if (score >= 9) return 'HIGH'
  if (score >= 4) return 'MEDIUM'
  return 'LOW'
}

const SEVERITY_TO_SCORE: Record<string, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
}

function typeLabel(t: string) {
  const m: Record<string, string> = {
    RUNWAY: 'Runway',
    TAXIWAY: 'Taxiway',
    APRON: 'Apron',
    MOVEMENT_AREA_JOINT: 'Movement Area',
  }
  return m[t] ?? t
}

/**
 * Automatski kreira Hazard zapis (SMS, ICAO Annex 19) iz kritičnog/visokog nalaza
 * dnevne inspekcije. Poziva se iz endpointa za eskalaciju kada je severity >= HIGH.
 *
 * Default initialProbability = 3 (occasional) jer inspektor u polju obično nema
 * vremena/mandat da radi punu SMS risk procjenu — safety officer treba naknadno
 * da potvrdi ili koriguje initialProbability/initialSeverity u SMS modulu.
 */
export async function createHazardFromFinding(params: {
  findingId: string
  category: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
  location?: string | null
  inspectionType: string
  reportedBy: string
  reportedByCardId?: string | null
}) {
  const initialSeverity = SEVERITY_TO_SCORE[params.severity] ?? 3
  const initialProbability = 3
  const initialRiskLevel = computeRiskLevel(initialProbability, initialSeverity)
  const hazardId = `HZ-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`

  const payload = {
    hazardId,
    title: `${params.category} — ${typeLabel(params.inspectionType)} (auto iz inspekcije)`,
    description: params.description,
    category: 'OPERATIONAL',
    source: 'INSPECTION',
    location: params.location ?? null,
    reportedBy: params.reportedBy,
    reportedByCardId: params.reportedByCardId ?? null,
    initialProbability,
    initialSeverity,
    initialRiskLevel,
    status: 'OPEN',
    notes: `Automatski generisano iz nalaza inspekcije (finding ID: ${params.findingId}). Potrebna safety review procjena vjerovatnoće/težine.`,
  }

  if (isDemoMode()) {
    return db.hazard.create({ data: payload })
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('hazards')
    .insert({
      hazard_id: payload.hazardId,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      source: payload.source,
      location: payload.location,
      reported_by: payload.reportedBy,
      reported_by_card_id: payload.reportedByCardId,
      initial_probability: payload.initialProbability,
      initial_severity: payload.initialSeverity,
      initial_risk_level: payload.initialRiskLevel,
      status: payload.status,
      notes: payload.notes,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Priprema draft NOTAM podataka iz kritičnog nalaza. NE upisuje u bazu — vraća
 * objekat koji admin pregleda/koriguje u UI prije konačnog kreiranja preko
 * POST /api/notam. Ovo namjerno nije auto-publish jer NOTAM ima pravne posljedice
 * (ADR.OPS.A.057) i mora proći ljudsku potvrdu.
 */
export function buildNotamDraftFromFinding(params: {
  findingId: string
  inspectionId: string
  category: string
  description: string
  location?: string | null
  inspectionType: string
  runwayCode?: string | null
  taxiwayCode?: string | null
  apronArea?: string | null
}) {
  const subject = params.inspectionType === 'RUNWAY' ? 'RWY' : params.inspectionType === 'TAXIWAY' ? 'TWY' : 'APRON'

  const conditionMap: Record<string, string> = {
    FOD: 'FOD',
    PAVEMENT_DAMAGE: 'SFC DAMAGE',
    MARKINGS: 'MARKING DEFECT',
    LIGHTING: 'LGT U/S',
    WILDLIFE: 'WILDLIFE HAZ',
    DRAINAGE: 'DRAINAGE',
    GSE_PARKING: 'OBST',
    SIGNAGE: 'SIGN DEFECT',
    OTHER: 'OTHER',
  }
  const condition = conditionMap[params.category] ?? 'OTHER'
  const locationRef = params.runwayCode ?? params.taxiwayCode ?? params.apronArea ?? params.location ?? 'N/A'

  return {
    series: 'A',
    qualifier: 'NOTAMN' as const,
    fir: 'LYBA',
    aerodrome: 'LYTV',
    subject,
    condition,
    purpose: 'B',
    scope: 'A',
    traffic: 'IV',
    text: `${subject} ${locationRef} ${condition}: ${params.description}. REF INSPECTION ${params.inspectionId.slice(0, 8)}.`,
    createdFromFindingId: params.findingId,
    createdFromInspectionId: params.inspectionId,
    validFrom: new Date().toISOString(),
    status: 'ACTIVE' as const,
  }
}