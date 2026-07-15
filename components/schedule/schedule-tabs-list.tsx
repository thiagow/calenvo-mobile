'use client'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Calendar, Ban } from 'lucide-react'

interface ScheduleTabsListProps {
  disableExtraTabs?: boolean
}

export function ScheduleTabsList({ disableExtraTabs = false }: ScheduleTabsListProps) {
  return (
    <TabsList className="grid w-full grid-cols-3 h-auto">
      <TabsTrigger value="basic" className="flex items-center gap-1 px-2 py-2 text-xs sm:text-sm">
        <Settings className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
        <span className="truncate">Config. Básicas</span>
      </TabsTrigger>
      <TabsTrigger value="custom-hours" className="flex items-center gap-1 px-2 py-2 text-xs sm:text-sm" disabled={disableExtraTabs}>
        <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
        <span className="truncate">Horários</span>
      </TabsTrigger>
      <TabsTrigger value="blocks" className="flex items-center gap-1 px-2 py-2 text-xs sm:text-sm" disabled={disableExtraTabs}>
        <Ban className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
        <span className="truncate">Bloqueios</span>
      </TabsTrigger>
    </TabsList>
  )
}
