export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
// Plan usage tracking can be added later if needed

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, name, businessName, segmentType, phone } = body

    // Validate required fields
    console.log('Signup request data:', { 
      email, 
      password: password ? '***' : undefined, 
      name, 
      businessName, 
      phone,
      segmentType 
    })
    
    // Email and password are always required
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }
    
    // Name and businessName can be defaulted for testing
    const userName = name || email.split('@')[0]
    const userBusinessName = businessName || 'Meu Negócio'

    // Check if user already exists (check for MASTER role since we're creating a master user)
    const existingUser = await prisma.user.findUnique({
      where: { 
        email_role: {
          email,
          role: 'MASTER'
        }
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { message: 'Este e-mail já está cadastrado' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user (MASTER)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: userName,
        businessName: userBusinessName,
        segmentType: segmentType || 'BEAUTY_SALON',
        phone: phone || null,
        planType: 'FREEMIUM',
        role: 'MASTER'
      }
    })

    console.log('✅ Usuário master criado:', user.id)

    // Criar automaticamente um profissional com os dados do usuário master
    const professional = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        name: userName,
        businessName: userBusinessName,
        segmentType: segmentType || 'BEAUTY_SALON',
        phone: phone || null,
        whatsapp: phone || null,
        role: 'PROFESSIONAL',
        masterId: user.id,
        isActive: true,
        planType: 'FREEMIUM'
      }
    })

    console.log('✅ Profissional master criado automaticamente:', professional.id)

    // Create business config with default values
    await prisma.businessConfig.create({
      data: {
        userId: user.id,
        workingDays: [1, 2, 3, 4, 5], // Segunda a sexta
        startTime: '08:00',
        endTime: '18:00',
        defaultDuration: 30,
        lunchStart: '12:00',
        lunchEnd: '13:00',
        multipleServices: false,
        requiresDeposit: false,
        cancellationHours: 24
      }
    })

    console.log('✅ Configuração de negócio criada')

    // Plan usage will be tracked automatically via middleware or scheduled tasks

    return NextResponse.json(
      { 
        message: 'Conta criada com sucesso!', 
        userId: user.id,
        professionalId: professional.id
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { message: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
