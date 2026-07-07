'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { Globe } from 'lucide-react'
import { useState } from 'react'

const LOCALES = ['pt', 'en'] as const

interface LanguageSwitcherProps {
  className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const t = useTranslations('LanguageSwitcher')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleSelect = (nextLocale: string) => {
    setOpen(false)
    router.replace(pathname, { locale: nextLocale })
  }

  return (
    <div className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 text-sm font-medium text-white hover:text-violet-100"
      >
        <Globe className="h-4 w-4" />
        {locale === 'en' ? 'EN' : 'PT'}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
          {LOCALES.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => handleSelect(loc)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-violet-50 ${loc === locale ? 'text-violet-600 font-semibold' : 'text-gray-700'}`}
            >
              {t(loc)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
