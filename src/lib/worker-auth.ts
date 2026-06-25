'use server'

// Javne server akcije za identifikaciju radnika bez login-a
// Koristi se na javnoj / stranici - radnici se identifikuju preko PIN-a ili ID kartice

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createClientAsync as createSupabaseClient } from "@/lib/supabase/server"

export interface IdentifiedWorker {
  cardId: string
  name: string
  department: string
  role: string
}

// Identifikacija radnika preko PIN-a (4-cifreni)
export async function identifyWorkerByPin(pin: string): Promise<{ ok: boolean; worker?: IdentifiedWorker; error?: string }> {
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
  const supabase = await createSupabaseClient()
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
export async function identifyWorkerByCardId(cardId: string): Promise<{ ok: boolean; worker?: IdentifiedWorker; error?: string }> {
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
  const supabase = await createSupabaseClient()
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
