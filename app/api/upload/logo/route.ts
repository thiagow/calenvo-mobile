export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { uploadFile } from '@/lib/s3'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar usuário (MASTER user who owns the logo)
    const user = await prisma.user.findFirst({
      where: {
        email: session.user.email,
        role: 'MASTER'
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Extrair arquivo do FormData
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Validações
    if (file.size > 5 * 1024 * 1024) { // 5MB
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 5MB' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Apenas imagens são permitidas' }, { status: 400 })
    }

    // Converter para Buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload para S3
    const cloud_storage_path = await uploadFile(buffer, file.name)

    // Salvar no banco de dados
    await prisma.businessConfig.upsert({
      where: { userId: user.id },
      update: { businessLogo: cloud_storage_path },
      create: {
        userId: user.id,
        businessLogo: cloud_storage_path,
        workingDays: [1, 2, 3, 4, 5],
        startTime: '08:00',
        endTime: '18:00',
        defaultDuration: 30
      }
    })

    return NextResponse.json({
      success: true,
      cloud_storage_path,
      message: 'Logo enviado com sucesso!'
    })
  } catch (error: any) {
    console.error('Erro no upload logo completa:', Object.getOwnPropertyNames(error).reduce((obj: Record<string, any>, key) => {
      obj[key] = error[key];
      return obj;
    }, {}));

    return NextResponse.json(
      {
        error: 'Erro ao fazer upload do logo',
        details: error?.message || 'Erro desconhecido',
        cause: error?.cause?.message
      },
      { status: 500 }
    )
  }
}
