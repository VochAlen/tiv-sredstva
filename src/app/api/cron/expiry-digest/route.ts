// Dnevni pregled rokova (30 dana unaprijed + već istekli).
// Vercel cron: vidi vercel.json. Šalje JEDNU poruku po kanalu, i to samo ako ima šta da javi.
import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/auth-mode'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { collectExpiring } from '@/lib/expiry-data'
import { formatExpiryDigest } from '@/lib/expiry'
import { sendWebhookNotification } from '@/lib/webhook-notify'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (process.env.CRON_SECRET && request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  if (!isDemoMode() && !hasServiceClient()) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY nije postavljen' }, { status: 503 })
  }
  try {
    const rows = await collectExpiring(isDemoMode() ? null : createServiceClient(), 30)
    if (rows.length > 0) {
      await sendWebhookNotification('triggerExpiryDigest', formatExpiryDigest(rows), { count: rows.length })
    }
    return NextResponse.json({ expiring: rows.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'greška' }, { status: 500 })
  }
}
