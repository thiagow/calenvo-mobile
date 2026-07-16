'use client'

import { useMemo, useState } from 'react'
import { Search, Sparkles, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import type { BookingService } from './types'

interface ServiceStepProps {
  services: BookingService[]
  onSelect: (service: BookingService) => void
}

export function ServiceStep({ services, onSelect }: ServiceStepProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return services
    return services.filter((s) => s.name.toLowerCase().includes(term))
  }, [services, search])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar procedimentos..."
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {services.length === 0 ? 'Nenhum serviço disponível para agendamento no momento.' : 'Nenhum serviço encontrado.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((service) => (
            <Card
              key={service.id}
              className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
              onClick={() => onSelect(service)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{service.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {service.duration}min
                    {service.price ? ` · ${formatCurrency(service.price)}` : ''}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
