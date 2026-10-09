'use client'

import Image from 'next/image'
import { CalendarPlus, CalendarSearch, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResolvedBookingTheme } from '@/lib/booking-theme'
import { HeroCover } from './hero-cover'

interface EntryScreenProps {
  theme: ResolvedBookingTheme
  businessName: string
  /** Chave de storage do logo (servido por /api/files/logo). */
  businessLogo: string | null
  onNewBooking?: () => void
  onExistingBooking?: () => void
}

/**
 * Tela inicial da página pública. Compartilhada entre a página real e o
 * preview do editor, então o que o dono vê ao personalizar é o que o cliente vê.
 */
export function EntryScreen({
  theme,
  businessName,
  businessLogo,
  onNewBooking,
  onExistingBooking,
}: EntryScreenProps) {
  const hasCover = theme.coverEnabled

  return (
    <div className="pb-10">
      {hasCover && <HeroCover theme={theme} />}

      <div className={cn('mx-auto max-w-lg px-4', hasCover ? '-mt-14' : 'pt-12')}>
        <div className="flex justify-center">
          <div className="bk-logo relative h-28 w-28 overflow-hidden rounded-full">
            {businessLogo ? (
              <Image
                src={`/api/files/logo?key=${encodeURIComponent(businessLogo)}`}
                alt={businessName}
                fill
                priority
                sizes="112px"
                className="object-contain p-1"
              />
            ) : (
              <span className="bk-heading flex h-full w-full items-center justify-center text-4xl text-primary">
                {businessName.trim().charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <h1 className="bk-heading mt-5 text-balance text-center text-3xl font-semibold leading-tight">
          {businessName}
        </h1>

        <div className="mt-8 space-y-3">
          <EntryCard
            icon={<CalendarPlus className="h-5 w-5" />}
            title="Novo agendamento"
            subtitle="Escolher serviço, horário e agendar"
            onClick={onNewBooking}
          />
          <EntryCard
            icon={<CalendarSearch className="h-5 w-5" />}
            title="Já tenho agenda"
            subtitle="Ver ou cancelar meu agendamento"
            onClick={onExistingBooking}
          />
        </div>
      </div>
    </div>
  )
}

interface EntryCardProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick?: () => void
}

function EntryCard({ icon, title, subtitle, onClick }: EntryCardProps) {
  return (
    <button type="button" onClick={onClick} className="bk-entry-card">
      <span className="bk-entry-icon">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="bk-entry-sub block text-xs">{subtitle}</span>
      </span>
      <ChevronRight className="bk-entry-sub h-4 w-4 shrink-0" />
    </button>
  )
}
