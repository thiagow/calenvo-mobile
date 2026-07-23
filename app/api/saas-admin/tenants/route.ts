export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSaasAdmin } from '@/lib/saas-admin-guard'
import bcrypt from 'bcryptjs'
import { PlanType, SegmentType } from '@prisma/client'

const VALID_PLANS: PlanType[] = ['BASICO', 'PRO', 'BUSINESS']
const VALID_INTERVALS = ['MONTHLY', 'ANNUAL']
const VALID_SEGMENTS: SegmentType[] = [
    'BEAUTY_SALON', 'BARBERSHOP', 'AESTHETIC_CLINIC', 'TECH_SAAS',
    'PROFESSIONAL_SERVICES', 'HR', 'PHYSIOTHERAPY', 'EDUCATION', 'PET_SHOP', 'OTHER'
]

/**
 * GET /api/saas-admin/tenants
 * Lista todos os donos de negócio (MASTER) com filtros e paginação
 */
export async function GET(req: NextRequest) {
    try {
        await requireSaasAdmin()

        const { searchParams } = new URL(req.url)

        // Paginação
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const skip = (page - 1) * limit

        // Filtros
        const planType = searchParams.get('planType')
        const segmentType = searchParams.get('segmentType')
        const isActive = searchParams.get('isActive')
        const search = searchParams.get('search')

        // Construir where clause
        const where: any = {
            role: 'MASTER'
        }

        if (planType) {
            where.planType = planType
        }

        if (segmentType) {
            where.segmentTypes = { has: segmentType }
        }

        if (isActive !== null && isActive !== undefined) {
            where.isActive = isActive === 'true'
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { businessName: { contains: search, mode: 'insensitive' } }
            ]
        }

        // Buscar tenants com contagem de profissionais
        const [tenants, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    businessName: true,
                    segmentTypes: true,
                    planType: true,
                    isActive: true,
                    isPaymentExempt: true,
                    createdAt: true,
                    stripeCustomerId: true,
                    _count: {
                        select: {
                            professionals: true
                        }
                    }
                },
                skip,
                take: limit,
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            prisma.user.count({ where })
        ])

        return NextResponse.json({
            tenants,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        })
    } catch (error: any) {
        console.error('Error fetching tenants:', error)

        if (error.message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        if (error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        return NextResponse.json(
            { error: 'Erro ao buscar tenants' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/saas-admin/tenants
 * Cria manualmente um novo tenant (MASTER + profissional master + BusinessConfig)
 * com isenção de pagamento, sem passar pelo Stripe. Uso: cortesias, parcerias, contas de teste.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await requireSaasAdmin()
        const body = await req.json()
        const { name, email, password, businessName, segmentTypes, phone, planType, billingInterval, isPaymentExempt } = body

        if (!name || !email || !password || !businessName || !phone || !Array.isArray(segmentTypes) || segmentTypes.length === 0) {
            return NextResponse.json(
                { error: 'Todos os campos são obrigatórios (selecione ao menos um segmento)' },
                { status: 400 }
            )
        }

        if (!segmentTypes.every((s: string) => VALID_SEGMENTS.includes(s as SegmentType))) {
            return NextResponse.json({ error: 'Segmento inválido' }, { status: 400 })
        }

        if (!VALID_PLANS.includes(planType)) {
            return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
        }

        if (!VALID_INTERVALS.includes(billingInterval)) {
            return NextResponse.json({ error: 'Intervalo de cobrança inválido' }, { status: 400 })
        }

        const phoneDigits = String(phone).replace(/\D/g, '')
        if (phoneDigits.length < 10 || phoneDigits.length > 11) {
            return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 })
        }

        const paymentExempt = isPaymentExempt !== false

        const existingUser = await prisma.user.findUnique({
            where: { email_role: { email, role: 'MASTER' } }
        })

        if (existingUser) {
            return NextResponse.json(
                { error: 'Este e-mail já está cadastrado' },
                { status: 400 }
            )
        }

        const hashedPassword = await bcrypt.hash(password, 12)

        const { user, professional } = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    businessName,
                    segmentTypes: segmentTypes as SegmentType[],
                    phone,
                    planType: planType as PlanType,
                    billingInterval,
                    isPaymentExempt: paymentExempt,
                    role: 'MASTER',
                }
            })

            const professional = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    businessName,
                    segmentTypes: segmentTypes as SegmentType[],
                    phone,
                    whatsapp: phone,
                    role: 'PROFESSIONAL',
                    masterId: user.id,
                    isActive: true,
                    planType: planType as PlanType,
                    billingInterval,
                    isPaymentExempt: paymentExempt,
                }
            })

            await tx.businessConfig.create({
                data: {
                    userId: user.id,
                    workingDays: [1, 2, 3, 4, 5],
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

            return { user, professional }
        })

        await prisma.adminAuditLog.create({
            data: {
                action: paymentExempt ? 'TENANT_CREATED_PAYMENT_EXEMPT' : 'TENANT_CREATED',
                adminId: (session.user as any).id,
                targetId: user.id,
                details: {
                    tenantEmail: user.email,
                    tenantName: user.name,
                    planType,
                    billingInterval
                },
                ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined
            }
        })

        return NextResponse.json({ success: true, tenant: { id: user.id, professionalId: professional.id } }, { status: 201 })
    } catch (error: any) {
        console.error('Error creating exempt tenant:', error)

        if (error.message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        if (error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        return NextResponse.json(
            { error: 'Erro ao criar tenant' },
            { status: 500 }
        )
    }
}
