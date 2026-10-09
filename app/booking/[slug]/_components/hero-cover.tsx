'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { ResolvedBookingTheme } from '@/lib/booking-theme'

interface HeroCoverProps {
  theme: ResolvedBookingTheme
}

export function HeroCover({ theme }: HeroCoverProps) {
  const [failed, setFailed] = useState(false)
  const src = theme.coverImage
    ? `/api/files/logo?key=${encodeURIComponent(theme.coverImage)}`
    : theme.coverPreset

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="bk-cover relative h-48 w-full overflow-hidden rounded-b-[2rem]">
        {failed ? (
          <div className="bk-cover-fallback absolute inset-0" />
        ) : (
          <Image
            src={src}
            alt=""
            fill
            priority
            sizes="(max-width: 512px) 100vw, 512px"
            className="object-cover"
            onError={() => setFailed(true)}
          />
        )}
        <div className="bk-cover-fade absolute inset-0" />
      </div>
    </div>
  )
}
