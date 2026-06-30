
'use client'

import { Button } from '@/components/ui/button'
import { 
  ChevronLeft, 
  ChevronRight,
  Calendar
} from 'lucide-react'

export type NavigationType = 'day' | 'week' | 'month'

interface DateNavigationProps {
  currentDate: Date
  navigationType: NavigationType
  onDateChange: (date: Date) => void
  appointmentCount?: number
}

export function DateNavigation({ 
  currentDate, 
  navigationType, 
  onDateChange,
  appointmentCount = 0
}: DateNavigationProps) {
  
  const goToPrevious = () => {
    const newDate = new Date(currentDate)
    
    switch (navigationType) {
      case 'day':
        newDate.setDate(currentDate.getDate() - 1)
        break
      case 'week':
        newDate.setDate(currentDate.getDate() - 7)
        break
      case 'month':
        newDate.setMonth(currentDate.getMonth() - 1)
        break
    }
    
    onDateChange(newDate)
  }

  const goToNext = () => {
    const newDate = new Date(currentDate)
    
    switch (navigationType) {
      case 'day':
        newDate.setDate(currentDate.getDate() + 1)
        break
      case 'week':
        newDate.setDate(currentDate.getDate() + 7)
        break
      case 'month':
        newDate.setMonth(currentDate.getMonth() + 1)
        break
    }
    
    onDateChange(newDate)
  }

  const goToToday = () => {
    onDateChange(new Date())
  }

  const formatCurrentDate = () => {
    switch (navigationType) {
      case 'day':
        return currentDate.toLocaleDateString('pt-BR', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      case 'week':
        const startOfWeek = new Date(currentDate)
        const day = startOfWeek.getDay()
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
        startOfWeek.setDate(diff)
        
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        
        if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
          return `${startOfWeek.getDate()} - ${endOfWeek.getDate()} de ${startOfWeek.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
        } else {
          return `${startOfWeek.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${endOfWeek.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
        }
      case 'month':
        return currentDate.toLocaleDateString('pt-BR', { 
          month: 'long', 
          year: 'numeric' 
        })
      default:
        return currentDate.toLocaleDateString('pt-BR')
    }
  }

  const formatCurrentDateMobile = () => {
    switch (navigationType) {
      case 'day':
        return currentDate.toLocaleDateString('pt-BR', { 
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
      case 'week':
        const startOfWeek = new Date(currentDate)
        const day = startOfWeek.getDay()
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
        startOfWeek.setDate(diff)
        
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        
        return `${startOfWeek.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${endOfWeek.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
      case 'month':
        return currentDate.toLocaleDateString('pt-BR', { 
          month: 'short', 
          year: 'numeric' 
        })
      default:
        return currentDate.toLocaleDateString('pt-BR')
    }
  }

  const isToday = () => {
    const today = new Date()
    switch (navigationType) {
      case 'day':
        return currentDate.toDateString() === today.toDateString()
      case 'week':
        const startOfWeek = new Date(currentDate)
        const day = startOfWeek.getDay()
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
        startOfWeek.setDate(diff)
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        return today >= startOfWeek && today <= endOfWeek
      case 'month':
        return currentDate.getMonth() === today.getMonth() && 
               currentDate.getFullYear() === today.getFullYear()
      default:
        return false
    }
  }

  return (
    <div className="space-y-3">
      {/* Main Navigation Row */}
      <div className="flex items-center justify-between gap-3">
        {/* Navigation Controls */}
        <div className="flex items-center space-x-1">
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToPrevious}
            className="hover:bg-gray-100 h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToToday}
            disabled={isToday()}
            className={`
              px-2 sm:px-3 hover:bg-gray-100 h-8 text-xs sm:text-sm
              ${isToday() ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            Hoje
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToNext}
            className="hover:bg-gray-100 h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Date Display with Appointment Count */}
        <div className="flex-1 flex flex-col items-end">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
            {/* Mobile view */}
            <h2 className="block sm:hidden text-sm font-semibold text-gray-900 capitalize">
              {formatCurrentDateMobile()}
            </h2>
            {/* Desktop view */}
            <h2 className="hidden sm:block text-base md:text-lg font-semibold text-gray-900 capitalize">
              {formatCurrentDate()}
            </h2>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            {appointmentCount} consulta{appointmentCount !== 1 ? 's' : ''} agendada{appointmentCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
