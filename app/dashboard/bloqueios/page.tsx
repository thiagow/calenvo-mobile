'use client'

import { useEffect, useState } from 'react'
import { BackButton } from '@/components/dashboard/back-button'
import { BlocksList } from '@/components/schedule/blocks-list'
import { CreateBlockDialog } from '@/components/schedule/create-block-dialog'
import { useUserRole } from '@/hooks/use-user-role'

// Bloqueios: tudo o que está fechado para novos agendamentos, num lugar só.
// Administrador gerencia todos; profissional bloqueia o próprio tempo (férias, curso,
// consulta pessoal) sem afetar os colegas nem a agenda inteira.
export default function BlocksPage() {
  const { isProfessional } = useUserRole()
  const [refreshKey, setRefreshKey] = useState(0)
  const [initialScheduleId, setInitialScheduleId] = useState<string>()

  // "Ver bloqueios desta agenda" (/dashboard/bloqueios?agenda=<id>) abre a lista já filtrada.
  useEffect(() => {
    const agenda = new URLSearchParams(window.location.search).get('agenda')
    if (agenda) setInitialScheduleId(agenda)
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <BackButton />
        <CreateBlockDialog onCreated={() => setRefreshKey((k) => k + 1)} />
      </div>

      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Bloqueios</h1>
        <p className="text-sm text-muted-foreground">
          {isProfessional
            ? 'Dias e horários em que você não atende. Valem só para você, em todas as suas agendas; seus colegas continuam disponíveis. Agendamentos já marcados são mantidos.'
            : 'Dias e horários em que não haverá atendimento (férias, feriados, eventos). Agendamentos já marcados são mantidos; o bloqueio vale só para novos agendamentos.'}
        </p>
      </div>

      <BlocksList
        refreshKey={refreshKey}
        initialScheduleId={initialScheduleId}
        showProfessionalFilter={!isProfessional}
      />
    </div>
  )
}
