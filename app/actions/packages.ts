'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const createPackageSchema = z.object({
    clientId: z.string().min(1, 'Cliente é obrigatório'),
    name: z.string().min(1, 'Nome do pacote é obrigatório'),
    price: z.number().nullable().optional(),
    items: z.array(z.object({
        serviceId: z.string().min(1, 'Serviço é obrigatório'),
        totalSessions: z.number().min(1, 'A quantidade de sessões deve ser no mínimo 1')
    })).min(1, 'É necessário pelo menos um serviço no pacote')
})

export async function createClientPackage(data: z.infer<typeof createPackageSchema>) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user) {
            return { success: false, error: 'Não autorizado' }
        }

        const userId = (session.user as any).id

        const validatedData = createPackageSchema.parse(data)

        const newPackage = await prisma.clientPackage.create({
            data: {
                clientId: validatedData.clientId,
                userId: userId,
                name: validatedData.name,
                price: validatedData.price,
                status: 'ACTIVE',
                items: {
                    create: validatedData.items.map(item => ({
                        serviceId: item.serviceId,
                        totalSessions: item.totalSessions,
                        usedSessions: 0
                    }))
                }
            },
            include: {
                items: true
            }
        })

        revalidatePath(`/dashboard/patients/${validatedData.clientId}`)
        return { success: true, data: newPackage }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.errors[0].message }
        }
        console.error('Error creating package:', error)
        return { success: false, error: 'Erro interno ao criar pacote' }
    }
}

export async function processPackageDeduction(appointmentId: string, packageItemId: string, userId: string) {
    try {
        const packageItem = await prisma.clientPackageItem.findUnique({
            where: { id: packageItemId },
            include: { clientPackage: { include: { items: true, client: true } } }
        })

        if (!packageItem) return { success: false, error: 'Item de pacote não encontrado' }
        if (packageItem.clientPackage.userId !== userId) return { success: false, error: 'Não autorizado' }

        if (packageItem.usedSessions >= packageItem.totalSessions) {
            return { success: false, error: 'Este pacote já teve todas as sessões utilizadas para este serviço' }
        }

        // Increment used sessions
        await prisma.clientPackageItem.update({
            where: { id: packageItemId },
            data: { usedSessions: { increment: 1 } }
        })

        // Check if the entire package is exhausted
        const packageData = await prisma.clientPackage.findUnique({
            where: { id: packageItem.clientPackageId },
            include: { items: true, client: true }
        })

        let isExhausted = false
        let isAlmostExhausted = false

        if (packageData && packageData.items) {
            const allItemsExhausted = packageData.items.every((i: any) => i.usedSessions >= i.totalSessions)

            // Verifica se está "Perto do fim" (Ex: resta apenas 1 sessão no montante total daquele pacote)
            const sessionsUsed = packageData.items.reduce((acc: number, i: any) => acc + i.usedSessions, 0)
            const sessionsTotal = packageData.items.reduce((acc: number, i: any) => acc + i.totalSessions, 0)

            if (allItemsExhausted) {
                await prisma.clientPackage.update({
                    where: { id: packageData.id },
                    data: { status: 'EXHAUSTED' }
                })
                isExhausted = true
            } else if (sessionsTotal - sessionsUsed === 1) {
                isAlmostExhausted = true
            }
        }

        return {
            success: true,
            isExhausted,
            isAlmostExhausted,
            packageData
        }
    } catch (error) {
        console.error('Error processing package deduction:', error)
        return { success: false, error: 'Erro ao processar dedução do pacote' }
    }
}
