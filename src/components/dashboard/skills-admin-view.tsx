'use client'

import { useEffect, useState, useTransition } from 'react'
import { Trash2, Loader2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CHECKLIST_CATEGORY_ORDER, CHECKLIST_CATEGORY_LABELS } from '@/lib/types'
import { getAllMaintenanceSkills, grantMaintenanceSkill, revokeMaintenanceSkill } from '@/lib/actions-maintenance-skills'

// Prisma vraća camelCase, Supabase snake_case — čitamo oba
const f = (s: any, camel: string, snake: string) => s[camel] ?? s[snake]

export function SkillsAdminView() {
  const [rows, setRows] = useState<any[]>([])
  const [cardId, setCardId] = useState('')
  const [name, setName] = useState('')
  const [cats, setCats] = useState<string[]>([])
  const [validUntil, setValidUntil] = useState('')
  const [pending, startTransition] = useTransition()

  const load = () => getAllMaintenanceSkills().then(setRows as any).catch(() => toast.error('Kvalifikacije nisu učitane'))
  useEffect(() => { load() }, [])

  const save = () => {
    if (!cardId.trim() || !name.trim() || cats.length === 0) {
      toast.error('Unesite broj kartice, ime i bar jednu kategoriju')
      return
    }
    startTransition(async () => {
      try {
        for (const category of cats) {
          await grantMaintenanceSkill({
            employeeCardId: cardId, employeeName: name.trim(), category,
            validUntil: validUntil || undefined,
          })
        }
        toast.success('Kvalifikacije upisane')
        setCats([]); setCardId(''); setName(''); setValidUntil('')
        load()
      } catch (e: any) { toast.error(e?.message ?? 'Greška') }
    })
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4" />Kvalifikacije radionice</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">Samo radnik sa važećom kvalifikacijom za kategoriju kvara može označiti popravku završenom. Upišite osobu i označite sve kategorije za koje je kvalifikovana.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1"><Label>Broj ID kartice</Label><Input value={cardId} onChange={(e) => setCardId(e.target.value.toUpperCase())} className="font-mono" /></div>
            <div className="space-y-1"><Label>Ime i prezime</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label>Važi do (opciono)</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {CHECKLIST_CATEGORY_ORDER.map((c) => (
              <button key={c} type="button"
                onClick={() => setCats((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c])}
                className={`min-h-12 rounded-lg border-2 text-sm font-semibold ${cats.includes(c) ? 'border-primary bg-primary/10' : 'border-border'}`}>
                {CHECKLIST_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
          <Button onClick={save} disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Upiši</Button>
        </CardContent>
      </Card>

      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nema upisanih kvalifikacija — dok se ne upišu, niko ne može označiti popravku završenom.</p>}
      {rows.map((s) => (
        <Card key={s.id}>
          <CardContent className="py-3 flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium truncate">{f(s, 'employeeName', 'employee_name')} <span className="font-mono text-xs text-muted-foreground">{f(s, 'employeeCardId', 'employee_card_id')}</span></div>
              <div className="text-xs text-muted-foreground">
                {CHECKLIST_CATEGORY_LABELS[s.category as keyof typeof CHECKLIST_CATEGORY_LABELS] ?? s.category}
                {f(s, 'validUntil', 'valid_until') ? ` · važi do ${String(f(s, 'validUntil', 'valid_until')).slice(0, 10)}` : ''}
              </div>
            </div>
            <Button size="sm" variant="outline" aria-label="Ukloni" onClick={async () => { await revokeMaintenanceSkill(s.id); load() }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
