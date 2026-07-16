'use client'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Ban } from 'lucide-react'

export function ScheduleTabsList() {
  return (
    <TabsList className="grid w-full grid-cols-2 h-auto">
      <TabsTrigger value="basic" className="flex items-center gap-1 px-2 py-2 text-xs sm:text-sm">
        <Settings className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
        <span className="truncate">Config. Básicas</span>
      </TabsTrigger>
      <TabsTrigger value="blocks" className="flex items-center gap-1 px-2 py-2 text-xs sm:text-sm">
        <Ban className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
        <span className="truncate">Bloqueios</span>
      </TabsTrigger>
    </TabsList>
  )
}
