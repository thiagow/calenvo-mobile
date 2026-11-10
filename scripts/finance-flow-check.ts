/**
 * Verificação ponta a ponta do Módulo Financeiro contra o banco real, SEM
 * deixar rastro: tudo roda numa única transação que é SEMPRE desfeita no fim.
 * Exercita SQL de verdade (FKs, CHECKs, índices parciais, FOR UPDATE).
 *
 *   npx tsx scripts/finance-flow-check.ts <tenantId>
 *
 * O tenant precisa ter o Financeiro liberado e ativo e não pode ter caixa aberto.
 */
import 'dotenv/config'
import { prisma } from '@/lib/db'
import { upsertSaleForAppointment, cancelSaleForAppointment } from '@/lib/finance/sales'
import { registerReceipt, reverseTransaction } from '@/lib/finance/receipts'
import { addCashMovement, cashSessionReport, closeCashSession, openCashSession } from '@/lib/finance/cash'
import { createAdjustment, createSettlement, previewSettlement, upsertCommissionRule } from '@/lib/finance/commissions'
import { createPayables } from '@/lib/finance/payables'
import { incomeStatement, projectedCashFlow } from '@/lib/finance/reports'
import { getFinanceStatus } from '@/lib/finance/status'

const ROLLBACK = new Error('ROLLBACK_SENTINEL')

function check(condition: unknown, message: string) {
  if (!condition) throw new Error(`FALHOU: ${message}`)
  console.log(`  ✓ ${message}`)
}

async function main() {
  const tenantId = process.argv[2]
  if (!tenantId) throw new Error('Uso: npx tsx scripts/finance-flow-check.ts <tenantId>')

  const status = await getFinanceStatus(tenantId)
  if (!status.active) throw new Error('Financeiro não está ativo neste tenant')

  try {
    await prisma.$transaction(
      async (tx) => {
        const owner = await tx.user.findUniqueOrThrow({ where: { id: tenantId } })
        const professional = await tx.user.findFirstOrThrow({ where: { masterId: tenantId, role: 'PROFESSIONAL' } })
        const methods = await tx.paymentMethod.findMany({ where: { userId: tenantId, isActive: true } })
        const pix = methods.find((m) => m.type === 'PIX')!
        const cash = methods.find((m) => m.type === 'CASH')!
        check(pix && cash, 'formas de pagamento Pix e Dinheiro existem')

        // --- Cadastro temporário ---
        const client = await tx.client.create({ data: { userId: tenantId, name: 'Cliente Verificação', phone: `000${Date.now()}` } })
        const service = await tx.service.create({ data: { userId: tenantId, name: 'Serviço Verificação', price: 150, duration: 30 } })
        await upsertCommissionRule(tx, { tenantId, professionalId: professional.id, serviceId: null, type: 'PERCENT', valueBps: 4000 })
        await upsertCommissionRule(tx, { tenantId, professionalId: professional.id, serviceId: service.id, type: 'FIXED', valueCents: 3000 })

        const appointment = await tx.appointment.create({
          data: { userId: tenantId, clientId: client.id, serviceId: service.id, professionalId: professional.id, date: new Date(), status: 'COMPLETED' }
        })

        console.log('Comanda')
        const sale = await upsertSaleForAppointment(tx, { tenantId, appointmentId: appointment.id, actorId: owner.id })
        const again = await upsertSaleForAppointment(tx, { tenantId, appointmentId: appointment.id, actorId: owner.id })
        check(sale.id === again.id, 'idempotente: concluir duas vezes não duplica a comanda')
        check(sale.totalCents === 15000, 'total vem do preço do serviço (R$ 150)')
        const receivable = await tx.receivable.findUniqueOrThrow({ where: { saleId: sale.id } })
        check(receivable.amountCents === 15000 && receivable.status === 'OPEN', 'conta a receber criada em aberto')
        const commission = await tx.commission.findFirstOrThrow({ where: { saleItem: { saleId: sale.id } } })
        check(commission.amountCents === 3000 && commission.ruleType === 'FIXED', 'regra do serviço (R$ 30 fixo) vence a padrão (40%)')

        console.log('Caixa e recebimento')
        await openCashSession(tx, { tenantId, actorId: owner.id, openingCents: 20000 })
        await registerReceipt(tx, {
          tenantId,
          receivableId: receivable.id,
          actorId: owner.id,
          payments: [
            { paymentMethodId: pix.id, amountCents: 10000 },
            { paymentMethodId: cash.id, amountCents: 5000 }
          ]
        })
        const paid = await tx.receivable.findUniqueOrThrow({ where: { id: receivable.id } })
        check(paid.status === 'PAID' && paid.paidCents === 15000, 'pagamento dividido Pix + dinheiro quita a conta')
        check((await tx.sale.findUniqueOrThrow({ where: { id: sale.id } })).status === 'CLOSED', 'comanda fecha quando quitada')

        await addCashMovement(tx, { tenantId, actorId: owner.id, kind: 'WITHDRAWAL', amountCents: 3000 })
        await createAdjustment(tx, { tenantId, actorId: owner.id, professionalId: professional.id, kind: 'ADVANCE', amountCents: 1000, description: 'Vale teste', paymentMethodId: cash.id })
        const session = (await tx.cashSession.findFirstOrThrow({ where: { userId: tenantId, status: 'OPEN' } }))
        const live = await cashSessionReport(tx, tenantId, session.id)
        check(live.summary.expectedCashCents === 20000 + 5000 - 3000 - 1000, 'gaveta = troco + dinheiro − sangria − vale (R$ 210)')
        check(live.byProfessional.some((p) => p.professionalId === professional.id && p.receivedCents === 15000), 'recebido atribuído ao profissional')

        console.log('Acerto')
        const preview = await previewSettlement(tx, { tenantId, professionalId: professional.id })
        check(preview.totals.netCents === preview.totals.commissionsCents - 1000, 'líquido = comissões − vale')
        await createSettlement(tx, { tenantId, actorId: owner.id, professionalId: professional.id, paymentMethodId: pix.id })
        check((await tx.commission.findUniqueOrThrow({ where: { id: commission.id } })).status === 'SETTLED', 'comissão fica acertada')
        let doubleBlocked = false
        try {
          await createSettlement(tx, { tenantId, actorId: owner.id, professionalId: professional.id, paymentMethodId: pix.id })
        } catch {
          doubleBlocked = true
        }
        check(doubleBlocked, 'não acerta a mesma comissão duas vezes')

        console.log('Estorno e reabertura')
        const pixReceipt = await tx.financialTransaction.findFirstOrThrow({ where: { receivableId: receivable.id, paymentMethodId: pix.id, kind: 'RECEIPT' } })
        await reverseTransaction(tx, { tenantId, transactionId: pixReceipt.id, actorId: owner.id })
        const reversed = await tx.receivable.findUniqueOrThrow({ where: { id: receivable.id } })
        check(reversed.status === 'PARTIAL' && reversed.paidCents === 5000, 'estorno reabre o saldo sem apagar o lançamento')
        check((await cancelSaleForAppointment(tx, { tenantId, appointmentId: appointment.id, actorId: owner.id })) === 'blocked_has_payments', 'reabrir atendimento com pagamento mantém a comanda')

        console.log('Contas a pagar e relatórios')
        const category = await tx.financeCategory.findFirstOrThrow({ where: { userId: tenantId, kind: 'EXPENSE', isSystem: false } })
        const { count } = await createPayables(tx, { tenantId, actorId: owner.id, categoryId: category.id, description: 'Aluguel teste', amountCents: 100000, firstDueDate: new Date(), mode: 'INSTALLMENTS', count: 3 })
        check(count === 3, 'conta parcelada em 3')
        const now = new Date()
        const statement = await incomeStatement(tx, tenantId, new Date(now.getTime() - 86_400_000), new Date(now.getTime() + 86_400_000))
        check(statement.cash.incomeCents === 5000, 'DRE caixa: receita líquida após estorno (R$ 50)')
        const flow = await projectedCashFlow(tx, tenantId, 30)
        check(flow.days.length === 30, 'fluxo projetado com 30 dias')

        console.log('Fechamento')
        const closed = await closeCashSession(tx, { tenantId, actorId: owner.id, countedCashCents: 21000 })
        check(closed.differenceCents === 0, 'fechamento bate (diferença zero)')

        console.log('Garantias do banco')
        await openCashSession(tx, { tenantId, actorId: owner.id, openingCents: 0 })
        let uniqueBlocked = false
        try {
          // Burla a checagem do código para provar o índice parcial do banco.
          await tx.cashSession.create({ data: { userId: tenantId, openedById: owner.id, openingCents: 0 } })
        } catch {
          uniqueBlocked = true
        }
        check(uniqueBlocked, 'banco impede dois caixas abertos (índice único parcial)')

        throw ROLLBACK
      },
      { timeout: 120_000, maxWait: 10_000 }
    )
  } catch (error) {
    if (error !== ROLLBACK) throw error
  }
  console.log('\nTudo certo. Transação desfeita: nenhum dado foi gravado.')
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
