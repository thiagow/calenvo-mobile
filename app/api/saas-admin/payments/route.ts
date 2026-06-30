export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { requireSaasAdmin } from '@/lib/saas-admin-guard'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'

/**
 * GET /api/saas-admin/payments
 * Lista transações de pagamento do Stripe com dados de tenant
 */
export async function GET(req: NextRequest) {
    try {
        await requireSaasAdmin()

        const { searchParams } = new URL(req.url)

        // Paginação
        const limit = parseInt(searchParams.get('limit') || '20')
        const startingAfter = searchParams.get('starting_after')

        // Filtros
        const status = searchParams.get('status') // paid, open, void, uncollectible

        // Buscar invoices do Stripe
        const invoicesParams: any = {
            limit,
            expand: ['data.customer']
        }

        if (startingAfter) {
            invoicesParams.starting_after = startingAfter
        }

        if (status) {
            invoicesParams.status = status
        }

        const invoices = await stripe.invoices.list(invoicesParams)

        // Buscar dados dos tenants para cruzar com stripeCustomerId
        const customerIds = invoices.data
            .map(inv => typeof inv.customer === 'string' ? inv.customer : inv.customer?.id)
            .filter(Boolean) as string[]

        const tenants = await prisma.user.findMany({
            where: {
                stripeCustomerId: { in: customerIds },
                role: 'MASTER'
            },
            select: {
                id: true,
                name: true,
                email: true,
                businessName: true,
                stripeCustomerId: true
            }
        })

        // Mapear tenants por stripeCustomerId
        const tenantMap = new Map(
            tenants.map(t => [t.stripeCustomerId, t])
        )

        // Enriquecer invoices com dados do tenant
        const enrichedInvoices = invoices.data.map(invoice => {
            const customerId = typeof invoice.customer === 'string'
                ? invoice.customer
                : invoice.customer?.id

            return {
                id: invoice.id,
                amount: invoice.amount_paid / 100, // Converter de centavos para reais
                currency: invoice.currency,
                status: invoice.status,
                created: new Date(invoice.created * 1000),
                periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
                periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
                hostedInvoiceUrl: invoice.hosted_invoice_url,
                tenant: customerId ? tenantMap.get(customerId) : null
            }
        })

        return NextResponse.json({
            payments: enrichedInvoices,
            hasMore: invoices.has_more,
            nextCursor: invoices.has_more && invoices.data.length > 0
                ? invoices.data[invoices.data.length - 1].id
                : null
        })
    } catch (error: any) {
        console.error('Error fetching payments:', error)

        if (error.message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        if (error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        return NextResponse.json(
            { error: 'Erro ao buscar pagamentos' },
            { status: 500 }
        )
    }
}
