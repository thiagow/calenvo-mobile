'use client'

import type { ResolvedBookingTheme } from '@/lib/booking-theme'
import { BookingThemeRoot } from '@/app/booking/[slug]/_components/booking-theme-root'
import { EntryScreen } from '@/app/booking/[slug]/_components/entry-screen'
import { bookingSerif } from '@/app/booking/[slug]/_fonts'

// A tela é renderizada em largura de celular real e reduzida: o preview usa o
// mesmo componente da página pública, então o que se vê aqui é o que o cliente vê.
const DEVICE_WIDTH = 390
const DEVICE_HEIGHT = 780
const SCALE = 0.72

interface PhonePreviewProps {
  theme: ResolvedBookingTheme
  businessName: string
  businessLogo: string | null
}

export function PhonePreview({ theme, businessName, businessLogo }: PhonePreviewProps) {
  return (
    <div
      className="mx-auto rounded-[2.25rem] border-[6px] border-neutral-900 bg-neutral-900 shadow-xl dark:border-neutral-700 dark:bg-neutral-700"
      style={{ width: DEVICE_WIDTH * SCALE + 12 }}
    >
      <div
        className="relative overflow-hidden rounded-[1.75rem]"
        style={{ width: DEVICE_WIDTH * SCALE, height: DEVICE_HEIGHT * SCALE }}
      >
        <div
          className={bookingSerif.variable}
          style={{
            width: DEVICE_WIDTH,
            height: DEVICE_HEIGHT,
            transform: `scale(${SCALE})`,
            transformOrigin: 'top left',
          }}
        >
          <BookingThemeRoot theme={theme} scope="preview" className="h-full overflow-hidden">
            <div className="pointer-events-none select-none" aria-hidden>
              <EntryScreen theme={theme} businessName={businessName} businessLogo={businessLogo} />
            </div>
          </BookingThemeRoot>
        </div>
      </div>
    </div>
  )
}
