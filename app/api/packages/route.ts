import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createTemplateSchema = z.object({
    name: z.string().min(1, 'Nome do pacote é obrigatório'),
    price: z.number().nullable().optional(),
    items: z.array(z.object({
        serviceId: z.string().min(1, 'Serviço é obrigatório'),
        totalSessions: z.number().min(1, 'A quantidade de sessões deve ser no mínimo 1')
    })).min(1, 'É necessário pelo menos um serviço no pacote')
})

export async function GET() {
    try {
        const session = await getServerSession(authOptions)

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (session.user as any).id

        const templates = await prisma.packageTemplate.findMany({
            where: {
                userId: userId,
                isActive: true
            },
            include: {
                items: {
                    include: {
                        service: {
                            select: {
                                id: true,
                                name: true,
                                price: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        return NextResponse.json(templates)
    } catch (error) {
        console.error('Error fetching package templates:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (session.user as any).id
        const body = await request.json()

        const validatedData = createTemplateSchema.parse(body)

        const newTemplate = await prisma.packageTemplate.create({
            data: {
                userId: userId,
                name: validatedData.name,
                price: validatedData.price,
                items: {
                    create: validatedData.items.map(item => ({
                        serviceId: item.serviceId,
                        totalSessions: item.totalSessions
                    }))
                }
            },
            include: {
                items: {
                    include: {
                        service: true
                    }
                }
            }
        })

        return NextResponse.json(newTemplate, { status: 201 })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 })
        }

        console.error('Error creating package template:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
