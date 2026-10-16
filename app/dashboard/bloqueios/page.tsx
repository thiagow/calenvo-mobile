'use client'

import { useState } from 'react'
import { BackButton } from '@/components/dashboard/back-button'
import { CreateBlockDialog } from '@/components/schedule/create-block-dialog'
import { GeneralBlocksList } from '@/components/schedule/general-blocks-list'

// Meus bloqueios: o profissional bloqueia o próprio tempo (férias, curso, consulta pessoal)
// sem afetar os colegas nem a agenda inteira. Administrador usa Agendas → Bloqueios.
export default function MyBlocksPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <BackButton />
        <CreateBlockDialog onCreated={() => setRefreshKey((k) => k + 1)} />
      </div>

      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Meus bloqueios</h1>
        <p className="text-sm text-muted-foreground">
          Dias e horários em que você não atende. Valem só para você, em todas as suas agendas; seus colegas continuam
          disponíveis. Agendamentos já marcados são mantidos.
        </p>
      </div>

      <GeneralBlocksList refreshKey={refreshKey} emptyText="Você não tem bloqueios ativos" />
    </div>
  )
}
