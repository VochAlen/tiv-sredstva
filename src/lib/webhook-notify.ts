// src/lib/webhook-notify.ts
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'

export type WebhookTrigger =
  | 'triggerCriticalDamage'
  | 'triggerDamageResolved'
  | 'triggerOutOfService'
  | 'triggerInspectionOverdue'
  | 'triggerNewDamage'
  | 'triggerRepairAwaitingApproval'
  | 'triggerExpiryDigest'

/**
 * Šalje poruku na sve uključene kanale (Slack/Teams/generic webhook) za dati događaj.
 * Nikad ne baca grešku — obavještenje ne smije srušiti glavni tok (npr. zaduženje).
 * U Supabase modu čita postavke preko service-role ključa (anonimni radnik i cron
 * nemaju sesiju, a RLS dozvoljava čitanje webhook_settings samo adminu); bez ključa
 * pada na korisnički klijent, što radi samo kad je prijavljen admin.
 */
export async function sendWebhookNotification(trigger: WebhookTrigger, message: string, extra?: Record<string, any>) {
  try {
    let settings: any[] = []

    if (isDemoMode()) {
      settings = await db.webhookSetting.findMany({ where: { enabled: true, [trigger]: true } })
    } else {
      const supabase = hasServiceClient() ? createServiceClient() : await createSupabaseClient()
      // triggerInspectionOverdue -> trigger_inspection_overdue
      const dbColumn = trigger.replace(/([A-Z])/g, '_$1').toLowerCase()
      const { data } = await supabase.from('webhook_settings').select('*').eq('enabled', true).eq(dbColumn, true)
      settings = data ?? []
    }

    return await Promise.allSettled(
      settings.map(async (s) => {
        const url = s.webhookUrl ?? s.webhook_url
        const type = s.webhookType ?? s.webhook_type
        // Teams (incoming webhook) i Slack očekuju polje "text"; generic dobija "message"
        const body = type === 'SLACK' || type === 'TEAMS' ? { text: message } : { message, ...extra }
        return fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000),
        })
      })
    )
  } catch (e) {
    console.error('sendWebhookNotification failed (ignored):', e)
    return []
  }
}
