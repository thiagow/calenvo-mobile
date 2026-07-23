export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, password } = body

    if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Token e nova senha são obrigatórios' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const verification = await prisma.verificationToken.findUnique({
      where: { token: hashedToken }
    })

    if (!verification || verification.expires < new Date()) {
      if (verification) {
        await prisma.verificationToken.delete({ where: { token: hashedToken } }).catch(() => {})
      }
      return NextResponse.json(
        { error: 'Link inválido ou expirado. Solicite um novo.' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const now = new Date()

    // updateMany: contas criadas pelo admin geram um registro MASTER e um PROFESSIONAL
    // com o mesmo e-mail e senha — o reset mantém os dois sincronizados.
    await prisma.user.updateMany({
      where: { email: verification.identifier },
      data: { password: hashedPassword, passwordChangedAt: now }
    })

    // Invalida qualquer outro token pendente para esse e-mail (não só o usado agora)
    await prisma.verificationToken.deleteMany({ where: { identifier: verification.identifier } })

    return NextResponse.json({ message: 'Senha redefinida com sucesso.' })
  } catch (error) {
    console.error('❌ Erro em reset-password:', error)
    return NextResponse.json({ error: 'Erro ao redefinir senha' }, { status: 500 })
  }
}
