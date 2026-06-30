
'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { 
  Calendar, 
  List, 
  Clock, 
  Grid3X3
} from 'lucide-react'

export type ViewType = 'day' | 'week' | 'month' | 'list' | 'timeline'

interface AgendaViewSelectorProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

const viewOptions = [
  { 
    id: 'day' as ViewType, 
    label: 'Dia', 
    icon: Calendar,
    description: 'Vista diária'
  },
  { 
    id: 'week' as ViewType, 
    label: 'Semana', 
    icon: Grid3X3,
    description: 'Vista semanal'
  },
  { 
    id: 'month' as ViewType, 
    label: 'Mês', 
    icon: Calendar,
    description: 'Vista mensal'
  },
  { 
    id: 'list' as ViewType, 
    label: 'Lista', 
    icon: List,
    description: 'Vista em lista'
  },
  { 
    id: 'timeline' as ViewType, 
    label: 'Timeline', 
    icon: Clock,
    description: 'Vista timeline'
  }
]

export function AgendaViewSelector({ currentView, onViewChange }: AgendaViewSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <>
      {/* Mobile View Selector - Icon-only buttons */}
      <div className="md:hidden flex items-center bg-gray-100 rounded-lg p-0.5">
        {viewOptions.map(({ id, icon: Icon }) => (
          <Button
            key={id}
            variant={currentView === id ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange(id)}
            className={`
              h-7 w-7 p-0 flex items-center justify-center
              ${currentView === id 
                ? "bg-white shadow-sm text-blue-600" 
                : "text-gray-600 hover:text-gray-900"
              }
            `}
            title={id}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}
      </div>

      {/* Desktop View Selector - Horizontal tabs */}
      <div className="hidden md:flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
        {viewOptions.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={currentView === id ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange(id)}
            className={`
              flex items-center space-x-2 h-8 px-3 text-xs
              ${currentView === id 
                ? "bg-white shadow-sm text-blue-600" 
                : "text-gray-600 hover:text-gray-900"
              }
            `}
          >
            <Icon className="h-3 w-3" />
            <span>{label}</span>
          </Button>
        ))}
      </div>
    </>
  )
}
