'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import en from '@/lib/locales/en.json'
import te from '@/lib/locales/te.json'

export type Lang = 'en' | 'te'

type Translations = typeof en

const locales: Record<Lang, Translations> = { en, te }

interface LangContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: Translations
}

const LangContext = createContext<LangContextType>({
  lang: 'en',
  setLang: () => {},
  t: en,
})

export function LangProvider({ children, initialLang = 'en' }: { children: React.ReactNode, initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    // Only set font class on mount, since lang comes from URL now
    document.body.classList.toggle('font-telugu', lang === 'te')
  }, [lang])

  const setLang = (l: Lang) => {
    // We keep this function to update context quickly before router finishes navigating
    setLangState(l)
    document.body.classList.toggle('font-telugu', l === 'te')
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: locales[lang] }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
