'use client'

import { useLang } from '@/lib/lang-context'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LanguageToggle() {
  const { lang, setLang } = useLang()

  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg border bg-muted/30">
      <Languages className="h-3.5 w-3.5 text-muted-foreground ml-1.5 mr-0.5" />
      <Button
        size="sm"
        variant={lang === 'hr' ? 'default' : 'ghost'}
        className="h-7 px-2 text-xs font-bold"
        onClick={() => setLang('hr')}
      >
        HR
      </Button>
      <Button
        size="sm"
        variant={lang === 'en' ? 'default' : 'ghost'}
        className="h-7 px-2 text-xs font-bold"
        onClick={() => setLang('en')}
      >
        EN
      </Button>
    </div>
  )
}
