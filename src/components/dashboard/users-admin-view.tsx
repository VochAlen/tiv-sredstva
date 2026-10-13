'use client'

// Korisnici i prava (SAMO admin): radnici + nalozi za prijavu, služba, radno mjesto, aerodrom.
// "Deaktiviraj" umjesto brisanja - istorija zaduženja i pregleda ostaje.

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Search, UserCheck, UserX, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { listUsers, saveUser, setUserActive, type Airport, type UserRole, type UserRow, type UsersData } from '@/lib/actions-users'

const AIRPORT_LABEL: Record<Airport, string> = { TIVAT: 'Tivat', PODGORICA: 'Podgorica' }
const ROLE_META: Record<UserRole, { label: string; desc: string; cls: string }> = {
  operator: { label: 'Operator', desc: 'Zaduživanje sredstava, dnevni pregledi, prijava kvarova', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  engineer: { label: 'Inženjer', desc: 'Dashboard, kvarovi, popravke, održavanje, izvještaji', cls: 'bg-orange-100 text-orange-800 border-orange-200' },
  admin: { label: 'Admin', desc: 'Sve + korisnici, kvalifikacije, uređivanje sredstava', cls: 'bg-purple-100 text-purple-800 border-purple-200' },
}
const SIZE = 15

export function UsersAdminView() {
  const [data, setData] = useState<UsersData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [airport, setAirport] = useState<'' | Airport>('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null)
  const [toggling, setToggling] = useState<UserRow | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    listUsers()
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(e?.message ?? 'Korisnici nisu učitani'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search, airport, status])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.users ?? []).filter((u) =>
      (!airport || u.airport === airport) &&
      (status === 'all' || (status === 'active' ? u.active : !u.active)) &&
      (!q || `${u.name} ${u.cardId ?? ''} ${u.service} ${u.jobTitle} ${u.account?.email ?? ''}`.toLowerCase().includes(q)),
    )
  }, [data, search, airport, status])

  const pages = Math.max(1, Math.ceil(rows.length / SIZE))
  const cur = Math.min(page, pages - 1)
  const counts = useMemo(() => {
    const us = data?.users ?? []
    return { all: us.length, TIVAT: us.filter((u) => u.airport === 'TIVAT').length, PODGORICA: us.filter((u) => u.airport === 'PODGORICA').length }
  }, [data])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Korisnici i prava</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Dodajte radnika (ID kartica, služba, radno mjesto, aerodrom) i po potrebi nalog za prijavu s pravom pristupa.
                „Deaktiviraj“ blokira korisnika, a istorija zaduženja i pregleda ostaje.
              </p>
            </div>
            <Button onClick={() => setEditing('new')} disabled={!data}><Plus className="h-4 w-4 mr-1" />Dodaj korisnika</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Ime, kartica, služba, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {([['', `Svi (${counts.all})`], ['TIVAT', `Tivat (${counts.TIVAT})`], ['PODGORICA', `Podgorica (${counts.PODGORICA})`]] as const).map(([k, l]) => (
              <Button key={k} size="sm" variant={airport === k ? 'default' : 'outline'} onClick={() => setAirport(k as '' | Airport)}>{l}</Button>
            ))}
            <span className="w-px h-6 bg-border mx-1" />
            {([['active', 'Aktivni'], ['inactive', 'Deaktivirani'], ['all', 'Svi']] as const).map(([k, l]) => (
              <Button key={k} size="sm" variant={status === k ? 'default' : 'outline'} onClick={() => setStatus(k)}>{l}</Button>
            ))}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading && !data ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Učitavanje…</p>
          ) : data && (
            <>
              {!data.accountsAvailable && (
                <p className="text-xs rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">Demo mode: nalozi za prijavu su fiksni; ovdje se uređuju samo radnici.</p>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Korisnik</TableHead><TableHead>Služba / radno mjesto</TableHead><TableHead>Aerodrom</TableHead>
                      <TableHead>Pravo pristupa</TableHead><TableHead>Status</TableHead><TableHead className="w-44" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(cur * SIZE, cur * SIZE + SIZE).map((u) => (
                      <TableRow key={u.key} className={u.active ? '' : 'opacity-60'}>
                        <TableCell>
                          <div className="font-medium text-sm">{u.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{u.cardId ?? '— nema kartice'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{u.service || '—'}</div>
                          <div className="text-xs text-muted-foreground">{u.jobTitle || '—'}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{AIRPORT_LABEL[u.airport]}</Badge></TableCell>
                        <TableCell>
                          {u.account ? (
                            <>
                              <Badge variant="outline" className={ROLE_META[u.account.role].cls}>{ROLE_META[u.account.role].label}</Badge>
                              <div className="text-xs text-muted-foreground mt-0.5 break-all">{u.account.email}</div>
                            </>
                          ) : <span className="text-xs text-muted-foreground">Bez prijave (samo kartica{u.hasPin ? ' / PIN' : ''})</span>}
                        </TableCell>
                        <TableCell className={`text-sm ${u.active ? 'text-emerald-700' : 'text-red-700 font-semibold'}`}>{u.active ? 'Aktivan' : 'Deaktiviran'}</TableCell>
                        <TableCell className="whitespace-nowrap space-x-1">
                          <Button size="sm" variant="outline" onClick={() => setEditing(u)}><Pencil className="h-4 w-4 mr-1" />Uredi</Button>
                          {u.account?.id === data.currentUserId ? null : u.active ? (
                            <Button size="sm" variant="ghost" className="text-red-700" onClick={() => setToggling(u)} title="Deaktiviraj"><UserX className="h-4 w-4" /></Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="text-emerald-700" onClick={() => setToggling(u)} title="Aktiviraj"><UserCheck className="h-4 w-4" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Nema korisnika za izabrane filtere.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              {rows.length > 0 && (
                <div className="flex items-center justify-between pt-1 text-sm">
                  <span className="text-xs text-muted-foreground">{cur * SIZE + 1}–{Math.min(rows.length, (cur + 1) * SIZE)} od {rows.length}</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Prethodna strana"><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-xs">Strana {cur + 1} / {pages}</span>
                    <Button size="sm" variant="outline" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Sljedeća strana"><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {editing && data && (
        <UserDialog
          user={editing === 'new' ? null : editing}
          data={data}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
      {toggling && (
        <ToggleDialog user={toggling} onClose={() => setToggling(null)} onDone={() => { setToggling(null); load() }} />
      )}
    </div>
  )
}

// =====================================================

function ToggleDialog({ user, onClose, onDone }: { user: UserRow; onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition()
  const activate = !user.active
  const run = () => start(async () => {
    const r = await setUserActive(user.key, activate)
    if (!r.ok) { toast.error(r.error ?? 'Greška'); return }
    toast.success(activate ? 'Korisnik aktiviran' : 'Korisnik deaktiviran')
    onDone()
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{activate ? 'Aktivirati korisnika?' : 'Deaktivirati korisnika?'}</DialogTitle>
          <DialogDescription>
            {activate
              ? `${user.name} ponovo može da se identifikuje karticom${user.account ? ' i prijavi u aplikaciju' : ''}.`
              : `${user.name} više ne može da zaduži sredstvo${user.account ? ' ni da se prijavi u aplikaciju' : ''}. Istorija zaduženja i pregleda ostaje.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Otkaži</Button>
          <Button variant={activate ? 'default' : 'destructive'} onClick={run} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{activate ? 'Aktiviraj' : 'Deaktiviraj'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================

function UserDialog({ user, data, onClose, onSaved }: { user: UserRow | null; data: UsersData; onClose: () => void; onSaved: () => void }) {
  const isNew = !user
  const [cardId, setCardId] = useState(user?.cardId ?? '')
  const [name, setName] = useState(user?.name ?? '')
  const [service, setService] = useState(user?.service ?? '')
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '')
  const [airport, setAirport] = useState<Airport>(user?.airport ?? 'TIVAT')
  const [pin, setPin] = useState('')
  const [pinClear, setPinClear] = useState(false)
  const [withAccount, setWithAccount] = useState(!!user?.account)
  const [email, setEmail] = useState(user?.account?.email ?? '')
  const [role, setRole] = useState<UserRole>(user?.account?.role ?? 'operator')
  const [password, setPassword] = useState('')
  const [pending, start] = useTransition()
  const hasAccount = !!user?.account
  const cardLocked = !!user?.cardId
  const isSelf = !!user?.account && user.account.id === data.currentUserId

  const chip = (on: boolean) => `min-h-11 rounded-lg border-2 px-3 text-sm font-semibold text-left ${on ? 'border-primary bg-primary/10' : 'border-border'}`

  const save = () => {
    start(async () => {
      const r = await saveUser({
        originalKey: user?.key,
        cardId, name, service, jobTitle, airport,
        pin: pinClear ? '' : pin ? pin : undefined,
        account: withAccount ? { email, role, password: password || undefined } : null,
      })
      if (!r.ok) { toast.error(r.error ?? 'Greška pri snimanju'); return }
      toast.success(isNew ? 'Korisnik dodan' : 'Izmjene snimljene')
      onSaved()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Dodaj korisnika' : `Uredi: ${user?.name}`}</DialogTitle>
          <DialogDescription>Popunite podatke radnika. Nalog za prijavu je potreban samo onima koji koriste dashboard.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Ime i prezime</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Broj ID kartice</Label>
            <Input value={cardId} disabled={cardLocked} onChange={(e) => setCardId(e.target.value.toUpperCase())} className="font-mono" placeholder="EMP-1011" />
            {cardLocked && <p className="text-[11px] text-muted-foreground">Kartica se ne mijenja (vezana je za istoriju).</p>}
          </div>
          <div className="space-y-1">
            <Label>Naziv službe</Label>
            <Input list="svc-list" value={service} onChange={(e) => setService(e.target.value)} placeholder="npr. Tehnička služba" />
            <datalist id="svc-list">{data.services.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div className="space-y-1">
            <Label>Naziv radnog mjesta</Label>
            <Input list="job-list" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="npr. Mehaničar" />
            <datalist id="job-list">{data.jobTitles.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
        </div>

        <div className="space-y-1">
          <Label>Aerodrom (lokacija)</Label>
          <div className="grid grid-cols-2 gap-2">
            {(['TIVAT', 'PODGORICA'] as Airport[]).map((a) => (
              <button key={a} type="button" onClick={() => setAirport(a)} className={chip(airport === a)}>{airport === a ? '✓ ' : ''}{AIRPORT_LABEL[a]}</button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label>PIN za identifikaciju (opciono, 4 cifre)</Label>
          <div className="flex items-center gap-2">
            <Input inputMode="numeric" maxLength={4} className="w-28 font-mono" value={pin} disabled={pinClear}
              placeholder={user?.hasPin ? '••••' : '----'} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            {user?.hasPin && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={pinClear} onChange={(e) => setPinClear(e.target.checked)} />Ukloni postojeći PIN
              </label>
            )}
          </div>
          {user?.hasPin && !pinClear && <p className="text-[11px] text-muted-foreground">PIN je postavljen. Unesite novi samo ako ga mijenjate.</p>}
        </div>

        <div className="rounded-lg border p-3 space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
            <input type="checkbox" className="h-4 w-4" checked={withAccount} disabled={hasAccount || !data.accountsAvailable} onChange={(e) => setWithAccount(e.target.checked)} />
            Nalog za prijavu u aplikaciju (email + lozinka)
          </label>
          {!data.accountsAvailable && <p className="text-xs text-muted-foreground">Nije dostupno u demo modu.</p>}
          {withAccount && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1">
                  <Label>{hasAccount ? 'Nova lozinka (prazno = ne mijenja se)' : 'Početna lozinka (min. 8 znakova)'}</Label>
                  <Input type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Pravo pristupa</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(['operator', 'engineer', 'admin'] as UserRole[]).map((r) => (
                    <button key={r} type="button" disabled={isSelf && r !== 'admin'} onClick={() => setRole(r)} className={`${chip(role === r)} disabled:opacity-40`}>
                      <div>{role === r ? '✓ ' : ''}{ROLE_META[r].label}</div>
                      <div className="text-[11px] font-normal text-muted-foreground leading-snug">{ROLE_META[r].desc}</div>
                    </button>
                  ))}
                </div>
                {isSelf && <p className="text-[11px] text-muted-foreground">Ne možete sami sebi oduzeti admin pravo.</p>}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Otkaži</Button>
          <Button onClick={save} disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Snimi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
