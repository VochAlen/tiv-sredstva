'use server'

// Javne server akcije za identifikaciju radnika bez login-a
// Koristi se na javnoj / stranici - radnici se identifikuju preko PIN-a ili ID kartice

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { createClientAsync as createSupabaseClient } from "@/lib/supabase/server"
import { rateAllowed, rateFail, RATE_MSG } from '@/lib/rate-limit'

export interface IdentifiedWorker {
  cardId: string
  name: string
  department: string
  role: string
}

// Identifikacija radnika preko PIN-a (4-cifreni)
async function pinInner(pin: string): Promise<{ ok: boolean; worker?: IdentifiedWorker; error?: string }> {
  if (!pin || pin.length < 3) {
    return { ok: false, error: 'PIN mora imati najmanje 3 cifre' }
  }

  if (isDemoMode()) {
    const employee = await db.employee.findFirst({
      where: { pin, active: true },
    })
    if (!employee) {
      return { ok: false, error: 'Radnik sa ovim PIN-om nije pronađen' }
    }
    return {
      ok: true,
      worker: {
        cardId: employee.cardId,
        name: employee.name,
        department: employee.department,
        role: employee.role,
      },
    }
  }

  // Supabase
  // Radnik na javnoj stranici nije prijavljen, a RLS dozvoljava čitanje 'employees' samo prijavljenima - zato service klijent
  const supabase = hasServiceClient() ? createServiceClient() : await createSupabaseClient()
  const { data, error } = await supabase
    .from('employees')
    .select('card_id, name, department, role')
    .eq('pin', pin)
    .eq('active', true)
    .single()

  if (error || !data) {
    return { ok: false, error: 'Radnik sa ovim PIN-om nije pronađen' }
  }

  return {
    ok: true,
    worker: {
      cardId: data.card_id,
      name: data.name,
      department: data.department,
      role: data.role,
    },
  }
}

// Identifikacija radnika preko card_id (skener ID kartice)
async function cardInner(cardId: string): Promise<{ ok: boolean; worker?: IdentifiedWorker; error?: string }> {
  if (!cardId) {
    return { ok: false, error: 'ID kartica nije skenirana' }
  }

  const normalizedCardId = cardId.trim().toUpperCase()

  if (isDemoMode()) {
    const employee = await db.employee.findUnique({
      where: { cardId: normalizedCardId },
    })
    if (!employee || !employee.active) {
      return { ok: false, error: 'Radnik nije pronađen' }
    }
    return {
      ok: true,
      worker: {
        cardId: employee.cardId,
        name: employee.name,
        department: employee.department,
        role: employee.role,
      },
    }
  }

  // Supabase
  // Radnik na javnoj stranici nije prijavljen, a RLS dozvoljava čitanje 'employees' samo prijavljenima - zato service klijent
  const supabase = hasServiceClient() ? createServiceClient() : await createSupabaseClient()
  const { data, error } = await supabase
    .from('employees')
    .select('card_id, name, department, role')
    .eq('card_id', normalizedCardId)
    .eq('active', true)
    .single()

  if (error || !data) {
    return { ok: false, error: 'Radnik nije pronađen' }
  }

  return {
    ok: true,
    worker: {
      cardId: data.card_id,
      name: data.name,
      department: data.department,
      role: data.role,
    },
  }
}

// Javne akcije sa ograničenjem pogrešnih pokušaja po IP adresi (pogađanje PIN-a / broja kartice)
export async function identifyWorkerByPin(pin: string): Promise<{ ok: boolean; worker?: IdentifiedWorker; error?: string; rateLimited?: boolean }> {
  if (!(await rateAllowed('pin'))) return { ok: false, error: RATE_MSG, rateLimited: true }
  const r = await pinInner(pin)
  if (!r.ok) await rateFail('pin', 15)
  return r
}

export async function identifyWorkerByCardId(cardId: string): Promise<{ ok: boolean; worker?: IdentifiedWorker; error?: string; rateLimited?: boolean }> {
  if (!(await rateAllowed('card'))) return { ok: false, error: RATE_MSG, rateLimited: true }
  const r = await cardInner(cardId)
  // pri kucanju broja kartice nepotpuni unosi daju "nije pronađen", zato je granica veća
  if (!r.ok) await rateFail('card', 60)
  return r
}
