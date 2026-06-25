'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, type Language, type TranslationKey } from './i18n'

interface LanguageContextValue {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('hr')

  useEffect(() => {
    const saved = localStorage.getItem('gse-lang') as Language | null
    if (saved === 'hr' || saved === 'en') {
      setLangState(saved)
    }
  }, [])

  const setLang = (newLang: Language) => {
    setLangState(newLang)
    localStorage.setItem('gse-lang', newLang)
  }

  const t = (key: TranslationKey): string => {
    return translations[lang][key] ?? translations.en[key] ?? key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    return {
      lang: 'hr' as Language,
      setLang: (() => {}) as (lang: Language) => void,
      t: ((key: TranslationKey) => translations.hr[key] ?? key) as (key: TranslationKey) => string,
    }
  }
  return ctx
}
