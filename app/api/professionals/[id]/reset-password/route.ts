
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (session.user as any).id
        const { id } = params // ID do profissional

        // Verificar se o usuário logado é MASTER e dono do profissional
        const professional = await prisma.user.findFirst({
            where: {
                id: id,
                masterId: userId
            }
        })

        if (!professional) {
            return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 })
        }

        const defaultPassword = '@@Senha123'
        const hashedPassword = await bcrypt.hash(defaultPassword, 12)

        // Atualizar a senha do profissional
        await prisma.user.update({
            where: { id: id },
            data: {
                password: hashedPassword
            }
        })

        return NextResponse.json({
            message: 'Senha reiniciada com sucesso',
            tempPassword: defaultPassword
        })
    } catch (error) {
        console.error('Error resetting password:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
