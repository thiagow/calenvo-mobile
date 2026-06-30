
'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { NotificationList } from './notification-list'

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetchUnreadCount()
    
    // Atualiza a contagem a cada 30 segundos
    const interval = setInterval(fetchUnreadCount, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications/count')
      if (response.ok) {
        const data = await response.json()
        setUnreadCount(data.count)
      }
    } catch (error) {
      console.error('Erro ao buscar contagem de notificações:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
      })
      
      if (response.ok) {
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Notificações</SheetTitle>
          <SheetDescription>
            {unreadCount > 0 ? (
              <div className="flex items-center justify-between">
                <span>Você tem {unreadCount} notificação(ões) não lida(s)</span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="text-xs"
                >
                  Marcar todas como lidas
                </Button>
              </div>
            ) : (
              <span>Você não tem notificações não lidas</span>
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <NotificationList 
            onNotificationRead={() => {
              fetchUnreadCount()
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
