'use client'

// =====================================================
// HELP BUTTON — plutajuće dugme "?" koje otvara kratko, jednostavno
// objašnjenje za TRENUTNI ekran/korak (jedan klik za otvaranje).
//
// Namjerno jednostavno i statično (nema API poziva, nema baze) -
// sadržaj dolazi iz src/lib/help-content.ts i isporučuje se kao dio
// JS bundle-a, pa ne dodaje nikakvo Vercel serverless opterećenje.
// =====================================================

import { useState } from 'react'
import { HelpCircle, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getHelpTopic } from '@/lib/help-content'

export function HelpButton({ helpKey, className }: { helpKey: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const topic = getHelpTopic(helpKey)

  if (!topic) return null

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Pomoć"
        onClick={() => setOpen(true)}
        className={`fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full shadow-lg border-2 bg-background print:hidden ${className ?? ''}`}
      >
        <HelpCircle className="h-7 w-7 text-primary" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-left">
              <HelpCircle className="h-5 w-5 text-primary flex-shrink-0" />
              {topic.title}
            </DialogTitle>
            <DialogDescription className="text-left">{topic.summary}</DialogDescription>
          </DialogHeader>

          <ol className="space-y-3 text-sm">
            {topic.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>

          {topic.tip && (
            <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{topic.tip}</span>
            </div>
          )}

          <Button onClick={() => setOpen(false)} className="w-full mt-1">
            Razumijem
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
