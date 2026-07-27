'use client'

import { useEffect, useState } from 'react'
import { X, Share, SquarePlus } from 'lucide-react'
import { LogoIcon } from '@/components/brand/logo'

const DISMISSED_KEY = 'calenvo:ios-install-dismissed'

function isIos(): boolean {
  const ua = window.navigator.userAgent
  const isIphoneOrIpod = /iPhone|iPod/.test(ua)
  // iPadOS 13+ reporta o user-agent como Mac, mas tem suporte a touch (diferente de um Mac real)
  const isIpad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  return isIphoneOrIpod || isIpad
}

function isStandalone(): boolean {
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export function IosInstallBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (!isIos()) return
    if (localStorage.getItem(DISMISSED_KEY) === 'true') return

    setVisible(true)
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-x-0 z-50 px-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
    >
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card shadow-lg p-4 flex items-start gap-3">
        <LogoIcon size={40} gradientId="ios-install-banner-logo" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Instale o Calenvo no seu iPhone</p>
          <p className="text-xs text-muted-foreground mt-1">
            Toque em <Share className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom" /> Compartilhar e depois em{' '}
            <SquarePlus className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom" /> "Adicionar à Tela de Início".
          </p>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fechar"
          className="text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
