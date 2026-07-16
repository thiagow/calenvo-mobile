import { describe, it, expect, vi } from 'vitest'

// Regressão para o IDOR corrigido em app/api/notifications/[id]/read:
// markAsRead não pode mais atualizar uma notificação sem confirmar que ela
// pertence ao userId do tenant autenticado, senão qualquer sessão válida
// consegue ler/mutar notificações (e os dados de cliente/venda nelas) de
// outro tenant só adivinhando o id.
const updateManyMock = vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
  const belongsToTenant = where.id === 'notif-1' && where.userId === 'tenant-a'
  return { count: belongsToTenant ? 1 : 0 }
})

vi.mock('@/lib/db', () => ({
  prisma: {
    notification: {
      updateMany: updateManyMock,
    },
  },
}))

describe('NotificationService.markAsRead', () => {
  it('escopa o update por id E userId do tenant', async () => {
    const { NotificationService } = await import('@/lib/notification-service')

    await NotificationService.markAsRead('notif-1', 'tenant-a')

    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notif-1', userId: 'tenant-a' },
      })
    )
  })

  it('retorna false (não atualiza) quando a notificação pertence a outro tenant', async () => {
    const { NotificationService } = await import('@/lib/notification-service')

    const updated = await NotificationService.markAsRead('notif-1', 'tenant-b')

    expect(updated).toBe(false)
  })

  it('retorna true quando a notificação pertence ao tenant correto', async () => {
    const { NotificationService } = await import('@/lib/notification-service')

    const updated = await NotificationService.markAsRead('notif-1', 'tenant-a')

    expect(updated).toBe(true)
  })
})
