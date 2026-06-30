'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

/**
 * Processa acúmulo de pontos ao concluir um agendamento.
 * Chamado dentro do PUT /api/appointments/[id] quando status === 'COMPLETED'.
 */
export async function processLoyaltyEarn(appointmentId: string, userId: string) {
    try {
        // 1. Buscar config de fidelidade do tenant
        const config = await prisma.loyaltyConfig.findUnique({
            where: { userId }
        })

        if (!config || !config.isActive) {
            return { success: true, skipped: true }
        }

        // 2. Buscar dados do agendamento
        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: {
                service: { select: { price: true, name: true } },
                client: { select: { id: true, name: true } }
            }
        })

        if (!appointment || !appointment.client) {
            return { success: false, error: 'Agendamento não encontrado' }
        }

        // 3. Calcular pontos baseado no modo
        let points = 0
        let description = ''

        if (config.mode === 'FREQUENCY') {
            points = 1
            description = `+1 ponto por agendamento concluído`
        } else {
            // VALUE mode
            const price = appointment.price || appointment.service?.price || 0
            points = Math.floor(price * config.pointsPerCurrency)
            description = `+${points} pontos (R$ ${price.toFixed(2)} × ${config.pointsPerCurrency})`
        }

        if (points <= 0) {
            return { success: true, skipped: true, reason: 'Nenhum ponto a acumular' }
        }

        // 4. Transação atômica: criar transaction + upsert balance
        const result = await prisma.$transaction(async (tx) => {
            // Criar registro de transação
            await tx.loyaltyTransaction.create({
                data: {
                    type: 'EARN',
                    points,
                    description,
                    clientId: appointment.client!.id,
                    userId,
                    appointmentId
                }
            })

            // Upsert no saldo
            const balance = await tx.loyaltyBalance.upsert({
                where: {
                    clientId_userId: {
                        clientId: appointment.client!.id,
                        userId
                    }
                },
                create: {
                    clientId: appointment.client!.id,
                    userId,
                    totalEarned: points,
                    currentBalance: points,
                    totalRedeemed: 0
                },
                update: {
                    totalEarned: { increment: points },
                    currentBalance: { increment: points }
                }
            })

            return balance
        })

        return {
            success: true,
            pointsEarned: points,
            newBalance: result.currentBalance,
            clientName: appointment.client.name
        }
    } catch (error) {
        console.error('Erro ao processar fidelidade (earn):', error)
        return { success: false, error: 'Erro ao processar pontos de fidelidade' }
    }
}

/**
 * Processa resgate de pontos de fidelidade.
 */
export async function processLoyaltyRedeem(
    clientId: string,
    userId: string,
    pointsToRedeem: number,
    appointmentId?: string
) {
    try {
        // 1. Buscar config
        const config = await prisma.loyaltyConfig.findUnique({
            where: { userId }
        })

        if (!config || !config.isActive) {
            return { success: false, error: 'Programa de fidelidade não está ativo' }
        }

        // 2. Verificar saldo
        const balance = await prisma.loyaltyBalance.findUnique({
            where: {
                clientId_userId: { clientId, userId }
            }
        })

        if (!balance || balance.currentBalance < pointsToRedeem) {
            return { success: false, error: 'Saldo insuficiente de pontos' }
        }

        // 3. Calcular valor do desconto
        const discountValue = (pointsToRedeem / config.pointsToReward) * config.rewardValue

        // 4. Transação atômica
        const result = await prisma.$transaction(async (tx) => {
            // Criar registro de resgate
            await tx.loyaltyTransaction.create({
                data: {
                    type: 'REDEEM',
                    points: pointsToRedeem,
                    description: `-${pointsToRedeem} pontos resgatados (desconto R$ ${discountValue.toFixed(2)})`,
                    clientId,
                    userId,
                    appointmentId: appointmentId || null
                }
            })

            // Atualizar saldo
            const updatedBalance = await tx.loyaltyBalance.update({
                where: {
                    clientId_userId: { clientId, userId }
                },
                data: {
                    totalRedeemed: { increment: pointsToRedeem },
                    currentBalance: { decrement: pointsToRedeem }
                }
            })

            return updatedBalance
        })

        return {
            success: true,
            pointsRedeemed: pointsToRedeem,
            discountValue,
            remainingBalance: result.currentBalance
        }
    } catch (error) {
        console.error('Erro ao processar fidelidade (redeem):', error)
        return { success: false, error: 'Erro ao processar resgate de pontos' }
    }
}
