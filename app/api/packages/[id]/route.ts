import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (session.user as any).id

        // Verify ownership
        const template = await prisma.packageTemplate.findFirst({
            where: {
                id: params.id,
                userId: userId
            }
        })

        if (!template) {
            return NextResponse.json({ error: 'Template not found or unauthorized' }, { status: 404 })
        }

        // Hard delete (because clientPackages are independent objects based on the template)
        // or Soft delete if preferred. Let's do Soft Delete to keep history intact if needed by some future feature.
        await prisma.packageTemplate.update({
            where: { id: params.id },
            data: { isActive: false }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting package template:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
