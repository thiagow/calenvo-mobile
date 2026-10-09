'use client'

import { createContext, useContext, useEffect, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ResolvedBookingTheme } from '@/lib/booking-theme'

const BookingThemeContext = createContext<ResolvedBookingTheme | null>(null)

export function useBookingTheme(): ResolvedBookingTheme {
  const theme = useContext(BookingThemeContext)
  if (!theme) throw new Error('useBookingTheme deve ser usado dentro de <BookingThemeRoot>')
  return theme
}

interface BookingThemeRootProps {
  theme: ResolvedBookingTheme
  /**
   * 'page': página pública (ocupa a tela e propaga as variáveis ao <body>, para
   * que portais Radix — calendário, popovers — herdem o tema).
   * 'preview': miniatura no editor do dashboard, isolada do resto da página.
   */
  scope?: 'page' | 'preview'
  className?: string
  children: ReactNode
}

export function BookingThemeRoot({ theme, scope = 'page', className, children }: BookingThemeRootProps) {
  useEffect(() => {
    if (scope !== 'page') return
    const body = document.body
    const names = Object.keys(theme.cssVars)
    for (const name of names) body.style.setProperty(name, theme.cssVars[name])
    body.classList.toggle('dark', theme.isDark)
    return () => {
      for (const name of names) body.style.removeProperty(name)
      body.classList.remove('dark')
    }
  }, [scope, theme])

  return (
    <BookingThemeContext.Provider value={theme}>
      <div
        data-template={theme.template}
        data-heading-font={theme.headingFont}
        style={theme.cssVars as CSSProperties}
        className={cn(
          'bk-root bg-background text-foreground',
          theme.isDark && 'dark',
          scope === 'page' && 'min-h-screen',
          className
        )}
      >
        {children}
      </div>
    </BookingThemeContext.Provider>
  )
}
