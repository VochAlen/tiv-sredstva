'use client'

import { useEffect, useState, useTransition } from 'react'
import { Bell, Trash2, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { getWebhooks, createWebhook, deleteWebhook, sendTestWebhook } from '@/lib/actions-advanced'

type Hook = Awaited<ReturnType<typeof getWebhooks>>[number]

export function NotificationsView() {
  const [hooks, setHooks] = useState<Hook[]>([])
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState<'SLACK' | 'TEAMS' | 'GENERIC'>('TEAMS')
  const [pending, startTransition] = useTransition()

  const load = () => getWebhooks().then(setHooks).catch(() => toast.error('Kanali nisu učitani'))
  useEffect(() => { load() }, [])

  const add = () => {
    if (!name.trim() || !/^https:\/\//.test(url.trim())) {
      toast.error('Unesite naziv i https:// adresu kanala')
      return
    }
    startTransition(async () => {
      try {
        await createWebhook({ name: name.trim(), webhookUrl: url.trim(), webhookType: type })
        setName(''); setUrl('')
        toast.success('Kanal dodat')
        load()
      } catch (e: any) { toast.error(e?.message ?? 'Greška') }
    })
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" />Obavještenja (Teams / Slack)</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Na svaki kanal stižu: novi kvarovi, popravke koje čekaju odobrenje, dnevni pregled rokova koji ističu i
            kašnjenje dnevnih pregleda. Adresu (Incoming Webhook) dobijate u Teams/Slack kanalu.
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <div className="space-y-1"><Label>Naziv</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Radionica" /></div>
            <div className="space-y-1"><Label>Adresa webhook-a</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
            <div className="space-y-1">
              <Label>Vrsta</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEAMS">Teams</SelectItem>
                  <SelectItem value="SLACK">Slack</SelectItem>
                  <SelectItem value="GENERIC">Drugo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={add} disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Dodaj kanal</Button>
        </CardContent>
      </Card>

      {hooks.map((h) => (
        <Card key={h.id}>
          <CardContent className="py-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{h.name}</div>
              <div className="text-xs text-muted-foreground">{h.webhookType}</div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" variant="outline" onClick={async () => {
                const r = await sendTestWebhook(h.id)
                if (r.ok) toast.success('Probna poruka poslata')
                else toast.error(r.error ?? 'Greška')
              }}><Send className="h-4 w-4 mr-1" />Test</Button>
              <Button size="sm" variant="outline" aria-label="Obriši" onClick={async () => { await deleteWebhook(h.id); load() }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
