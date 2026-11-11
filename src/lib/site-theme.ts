'use client'

// Zajednička tema javnih stranica (/, /features, /about): "operations console at night".
// Tamni tarmac + amber beacon, sa svijetlom varijantom. Isti ključ u localStorage kao na početnoj,
// pa izbor teme prati korisnika kroz sve javne stranice.

import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'
export const THEME_STORAGE_KEY = 'gse-landing-theme'

export const BEACON = '#F2A516'
export const TARMAC = '#0B0E11'
export const GO = '#3FB27F'
export const STOP = '#E3473F'
export const TAXIWAY = '#4C8DF2'

export const DARK = {
  pageBg: '#0B0E11',
  text: '#EDEFF2',
  textMuted: '#AEB6BF',
  textFaint: '#8A94A0',
  headerBg: 'rgba(11,14,17,0.92)',
  sectionBg: '#12161B',
  sectionBorder: 'rgba(255,255,255,0.06)',
  cardBg: '#12161B',
  cardBorder: 'rgba(255,255,255,0.06)',
  footerBorder: 'rgba(255,255,255,0.08)',
  footerText: '#6B7480',
  btnBorder: 'rgba(255,255,255,0.15)',
  btnBg: 'rgba(255,255,255,0.05)',
  btnHoverBg: 'rgba(255,255,255,0.1)',
  heroOverlayVertical: 'linear-gradient(to bottom, rgba(11,14,17,0.55) 0%, rgba(11,14,17,0.72) 45%, rgba(11,14,17,0.93) 100%)',
  heroOverlayHorizontal: 'linear-gradient(to right, rgba(11,14,17,0.88) 0%, rgba(11,14,17,0.55) 48%, rgba(11,14,17,0.22) 100%)',
  heroText: '#EDEFF2',
  heroTextMuted: '#D7DBE0',
  heroTagBg: 'rgba(11,14,17,0.55)',
  grid: 'rgba(255,255,255,0.035)',
  glow: 'rgba(242,165,22,0.14)',
}

export const LIGHT: typeof DARK = {
  pageBg: '#F4F5F7',
  text: '#12161B',
  textMuted: '#495057',
  textFaint: '#6B7480',
  headerBg: 'rgba(244,245,247,0.92)',
  sectionBg: '#FFFFFF',
  sectionBorder: 'rgba(11,14,17,0.08)',
  cardBg: '#FFFFFF',
  cardBorder: 'rgba(11,14,17,0.08)',
  footerBorder: 'rgba(11,14,17,0.08)',
  footerText: '#8A94A0',
  btnBorder: 'rgba(11,14,17,0.14)',
  btnBg: 'rgba(11,14,17,0.03)',
  btnHoverBg: 'rgba(11,14,17,0.08)',
  heroOverlayVertical: 'linear-gradient(to bottom, rgba(244,245,247,0.5) 0%, rgba(244,245,247,0.72) 45%, rgba(244,245,247,0.95) 100%)',
  heroOverlayHorizontal: 'linear-gradient(to right, rgba(244,245,247,0.94) 0%, rgba(244,245,247,0.62) 48%, rgba(244,245,247,0.25) 100%)',
  heroText: '#12161B',
  heroTextMuted: '#3C4248',
  heroTagBg: 'rgba(244,245,247,0.8)',
  grid: 'rgba(11,14,17,0.045)',
  glow: 'rgba(242,165,22,0.18)',
}

export type ThemeTokens = typeof DARK

/** Tema javnih stranica: pamti izbor u localStorage (otporno na blokiran storage). */
export function useSiteTheme() {
  const [theme, setTheme] = useState<Theme>('dark')
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    } catch { /* ostaje zadana tema */ }
  }, [])
  const toggle = useCallback(() => {
    setTheme((cur) => {
      const next: Theme = cur === 'dark' ? 'light' : 'dark'
      try { window.localStorage.setItem(THEME_STORAGE_KEY, next) } catch { /* prekidač radi i bez čuvanja */ }
      return next
    })
  }, [])
  return { theme, toggle, c: theme === 'dark' ? DARK : LIGHT }
}
