'use client'

import { Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { BookingProfessional } from './types'

interface ProfessionalStepProps {
  professionals: BookingProfessional[]
  loading: boolean
  onSelect: (professional: BookingProfessional | null) => void
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ProfessionalStep({ professionals, loading, onSelect }: ProfessionalStepProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Card
        className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
        onClick={() => onSelect(null)}
      >
        <CardContent className={cn('flex items-center gap-3 p-4')}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Qualquer profissional</p>
            <p className="text-xs text-muted-foreground">Deixe com a gente escolher para você</p>
          </div>
        </CardContent>
      </Card>

      {professionals.map((professional) => (
        <Card
          key={professional.id}
          className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
          onClick={() => onSelect(professional)}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <Avatar className="h-11 w-11">
              {professional.image && <AvatarImage src={professional.image} alt={professional.name || ''} />}
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {getInitials(professional.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{professional.name || 'Profissional'}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
