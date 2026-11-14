'use client'

// Mobilna navigacija dashboarda (telefon): veliko dugme "Meni" sa tekstom, donja traka sa glavnim
// odredištima i zatvaranje menija čim se izabere stavka. Na desktopu se ništa ne mijenja.
// Sve ovo mora biti unutar <SidebarProvider>.

import type { ComponentType, ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { useSidebar } from '@/components/ui/sidebar'

export interface BarItem { value: string; label: string; icon: ComponentType<{ className?: string }>; badge?: number }

/** Veliko, uočljivo dugme sa riječju "Meni" (ikona sama se na telefonu teško primijeti). */
export function MobileMenuButton({ label = 'Meni' }: { label?: string }) {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={label}
      className="md:hidden inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-sm active:scale-95 transition-transform"
    >
      <Menu className="h-5 w-5" />
      {label}
    </button>
  )
}

/** Na telefonu zatvara bočni meni čim korisnik izabere stavku (inače ostaje otvoren preko sadržaja). */
export function CloseOnPick({ children }: { children: ReactNode }) {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <div
      className="contents"
      onClick={(e) => {
        if (!isMobile) return
        const el = e.target as HTMLElement
        if (el.closest('[data-sidebar="menu-button"]') && !el.closest('[data-keep-open]')) setOpenMobile(false)
      }}
    >
      {children}
    </div>
  )
}

/** Donja traka (samo telefon): 4 glavna odredišta + "Meni" za sve ostalo. */
export function MobileBottomBar({ items, active, onSelect, menuLabel = 'Meni' }: { items: BarItem[]; active: string; onSelect: (v: string) => void; menuLabel?: string }) {
  const { toggleSidebar } = useSidebar()
  const inBar = items.some((i) => i.value === active)
  const base = 'relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] leading-tight transition-colors active:bg-muted'
  return (
    <nav
      aria-label="Glavna navigacija"
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map((i) => {
          const on = i.value === active
          return (
            <button key={i.value} type="button" onClick={() => onSelect(i.value)} aria-current={on ? 'page' : undefined}
              className={`${base} ${on ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
              {on && <span className="absolute inset-x-4 top-0 h-[3px] rounded-b bg-primary" />}
              <span className="relative">
                <i.icon className="h-6 w-6" />
                {!!i.badge && i.badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">{i.badge > 99 ? '99+' : i.badge}</span>
                )}
              </span>
              <span className="max-w-full truncate px-1">{i.label}</span>
            </button>
          )
        })}
        <button type="button" onClick={toggleSidebar} aria-label={menuLabel} className={`${base} ${!inBar ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
          {!inBar && <span className="absolute inset-x-4 top-0 h-[3px] rounded-b bg-primary" />}
          <Menu className="h-6 w-6" />
          <span>{menuLabel}</span>
        </button>
      </div>
    </nav>
  )
}
