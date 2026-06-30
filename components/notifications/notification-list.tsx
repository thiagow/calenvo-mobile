
'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock, 
  CalendarClock,
  CheckCheck,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
  appointment?: {
    client: {
      name: string
    }
    service?: {
      name: string
    }
  }
}

interface NotificationListProps {
  onNotificationRead?: () => void
}

const notificationIcons = {
  APPOINTMENT_CREATED: Calendar,
  APPOINTMENT_CONFIRMED: CheckCircle,
  APPOINTMENT_CANCELLED: XCircle,
  APPOINTMENT_REMINDER: Clock,
  APPOINTMENT_RESCHEDULED: CalendarClock,
  APPOINTMENT_COMPLETED: CheckCheck,
  SYSTEM: AlertCircle,
}

const notificationColors = {
  APPOINTMENT_CREATED: 'text-blue-500',
  APPOINTMENT_CONFIRMED: 'text-green-500',
  APPOINTMENT_CANCELLED: 'text-red-500',
  APPOINTMENT_REMINDER: 'text-yellow-500',
  APPOINTMENT_RESCHEDULED: 'text-purple-500',
  APPOINTMENT_COMPLETED: 'text-gray-500',
  SYSTEM: 'text-orange-500',
}

export function NotificationList({ onNotificationRead }: NotificationListProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/notifications')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
      }
    } catch (error) {
      console.error('Erro ao buscar notificações:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      })
      
      if (response.ok) {
        setNotifications(notifications.map(n => 
          n.id === id ? { ...n, isRead: true } : n
        ))
        onNotificationRead?.()
      }
    } catch (error) {
      console.error('Erro ao marcar como lida:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Bell className="h-12 w-12 text-gray-400 mb-2" />
        <p className="text-gray-500">Nenhuma notificação</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="space-y-2">
        {notifications.map((notification) => {
          const Icon = notificationIcons[notification.type as keyof typeof notificationIcons] || AlertCircle
          const iconColor = notificationColors[notification.type as keyof typeof notificationColors] || 'text-gray-500'
          
          return (
            <div
              key={notification.id}
              className={cn(
                "p-4 rounded-lg border transition-colors cursor-pointer",
                notification.isRead 
                  ? "bg-white hover:bg-gray-50" 
                  : "bg-blue-50 hover:bg-blue-100 border-blue-200"
              )}
              onClick={() => !notification.isRead && markAsRead(notification.id)}
            >
              <div className="flex gap-3">
                <div className={cn("flex-shrink-0", iconColor)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={cn(
                      "text-sm font-medium",
                      !notification.isRead && "text-blue-900"
                    )}>
                      {notification.title}
                    </h4>
                    {!notification.isRead && (
                      <span className="flex-shrink-0 h-2 w-2 bg-blue-500 rounded-full" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

function Bell(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
