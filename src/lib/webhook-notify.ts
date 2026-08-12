// src/lib/webhook-notify.ts
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'

type WebhookTrigger =
  | 'triggerCriticalDamage'
  | 'triggerDamageResolved'
  | 'triggerOutOfService'
  | 'triggerInspectionOverdue'

/**
 * Ako u projektu već postoji slična funkcija (npr. lib/webhooks.ts), spoji ih —
 * ovo je samostalna implementacija koja čita WebhookSetting model iz schema.prisma
 * i šalje POST na registrovani webhookUrl za dati trigger tip.
 */
export async function sendWebhookNotification(trigger: WebhookTrigger, message: string, extra?: Record<string, any>) {
  let settings: any[] = []

  if (isDemoMode()) {
    settings = await db.webhookSetting.findMany({ where: { enabled: true, [trigger]: true } })
  } else {
    const supabase = await createSupabaseClient()
    // triggerInspectionOverdue -> trigger_inspection_overdue
    const dbColumn = trigger.replace(/([A-Z])/g, '_$1').toLowerCase()
    const { data } = await supabase.from('webhook_settings').select('*').eq('enabled', true).eq(dbColumn, true)
    settings = data ?? []
  }

  const results = await Promise.allSettled(
    settings.map(async (s) => {
      const url = s.webhookUrl ?? s.webhook_url
      const type = s.webhookType ?? s.webhook_type
      const body = type === 'SLACK' ? { text: message, ...extra } : { message, ...extra }
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    })
  )

  return results
}