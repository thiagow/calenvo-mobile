export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'
import { sendResetPasswordEmail } from '@/lib/email-templates'

const GENERIC_MESSAGE = 'Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha.'
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hora

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, locale } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'E-mail é obrigatório' }, { status: 400 })
    }

    const ip = getClientIp(req)
    const [ipRate, emailRate] = await Promise.all([
      checkRateLimit(`forgot-password:ip:${ip}`, { failClosed: true }),
      checkRateLimit(`forgot-password:email:${email.toLowerCase()}`, { failClosed: true }),
    ])

    if (!ipRate.success || !emailRate.success) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um instante e tente novamente.' },
        { status: 429 }
      )
    }

    // SAAS_ADMIN não usa o fluxo público de recuperação de senha (só reset manual).
    const users = await prisma.user.findMany({
      where: { email, role: { in: ['MASTER', 'PROFESSIONAL'] } }
    })

    if (users.length > 0) {
      const rawToken = crypto.randomBytes(32).toString('hex')
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')
      const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS)

      // Remove qualquer token pendente anterior para esse e-mail antes de criar um novo
      await prisma.verificationToken.deleteMany({ where: { identifier: email } })
      await prisma.verificationToken.create({
        data: { identifier: email, token: hashedToken, expires }
      })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://calenvo.app'
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`

      await sendResetPasswordEmail({
        name: users[0].name || 'usuário',
        email,
        resetUrl,
        locale,
      })
    }

    return NextResponse.json({ message: GENERIC_MESSAGE })
  } catch (error) {
    console.error('❌ Erro em forgot-password:', error)
    // Mantém a mensagem genérica mesmo em erro, para não vazar existência de conta
    return NextResponse.json({ message: GENERIC_MESSAGE })
  }
}
