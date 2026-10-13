// src/app/api/cron/document-review-overdue/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { sendWebhookNotification } from '@/lib/webhook-notify'

// Raspored je u vercel.json.
// (ponedjeljkom 06:00 UTC — sedmicna provjera je dovoljna za document review, za razliku
// od dnevne aerodrome inspekcije koja treba dnevnu provjeru)
//
// NAPOMENA: Ovaj cron koristi isti 'triggerInspectionOverdue' flag iz WebhookSetting kao i
// aerodrome inspection cron. Ako zelis odvojen webhook kanal samo za document review,
// dodaj novo bool polje u WebhookSetting (npr. triggerDocumentReviewOverdue) i zamijeni
// string ispod.

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  if (!isDemoMode() && !hasServiceClient()) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY nije postavljen' }, { status: 503 })
  }

  // cron nema korisničku sesiju → direktan upit (service-role u Supabase modu)
  let docs: any[]
  if (isDemoMode()) {
    docs = await db.controlledDocument.findMany({ where: { status: 'PUBLISHED' } })
  } else {
    const { data, error } = await createServiceClient()
      .from('controlled_documents')
      .select('doc_id,title,status,next_review_date')
      .eq('status', 'PUBLISHED')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    docs = (data ?? []).map((d: any) => ({ docId: d.doc_id, title: d.title, status: d.status, nextReviewDate: d.next_review_date }))
  }
  const today = new Date()

  const overdue = docs.filter(
    (d: any) => d.nextReviewDate && new Date(d.nextReviewDate) < today && d.status === 'PUBLISHED'
  )

  if (overdue.length > 0) {
    const list = overdue.map((d: any) => `${d.docId} (${d.title})`).slice(0, 10).join(', ')
    await sendWebhookNotification(
      'triggerInspectionOverdue',
      `GSE Control — ${overdue.length} kontrolisan(og) dokument(a) ima prekoracen review rok (EASA Part-145.A.65): ${list}${overdue.length > 10 ? '...' : ''}`,
      { overdueCount: overdue.length, docIds: overdue.map((d: any) => d.docId) }
    )
  }

  return NextResponse.json({ checked: docs.length, overdue: overdue.length })
}