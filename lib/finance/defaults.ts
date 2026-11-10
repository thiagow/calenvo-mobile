import type { FinanceCategoryKind, PaymentMethodType, Prisma } from '@prisma/client'

/**
 * Valores iniciais criados na primeira ativação do módulo. Formas de pagamento
 * vêm com taxa zero de propósito: a taxa varia por operadora e só o dono sabe a dele.
 */

type Locale = 'pt' | 'en'

interface DefaultPaymentMethod {
  type: PaymentMethodType
  name: Record<Locale, string>
}

export const DEFAULT_PAYMENT_METHODS: DefaultPaymentMethod[] = [
  { type: 'CASH', name: { pt: 'Dinheiro', en: 'Cash' } },
  { type: 'PIX', name: { pt: 'Pix', en: 'Pix' } },
  { type: 'DEBIT', name: { pt: 'Cartão de débito', en: 'Debit card' } },
  { type: 'CREDIT', name: { pt: 'Cartão de crédito', en: 'Credit card' } }
]

/**
 * Categorias de sistema: usadas pelos lançamentos automáticos (comanda,
 * pacote, acerto). Identificadas por `systemKey`, nunca pelo nome.
 */
export const SYSTEM_CATEGORY_KEYS = {
  services: 'services',
  packages: 'packages',
  commissions: 'commissions'
} as const

export type SystemCategoryKey = (typeof SYSTEM_CATEGORY_KEYS)[keyof typeof SYSTEM_CATEGORY_KEYS]

interface DefaultCategory {
  kind: FinanceCategoryKind
  name: Record<Locale, string>
  systemKey?: SystemCategoryKey
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { kind: 'INCOME', systemKey: 'services', name: { pt: 'Serviços', en: 'Services' } },
  { kind: 'INCOME', systemKey: 'packages', name: { pt: 'Pacotes', en: 'Packages' } },
  { kind: 'INCOME', name: { pt: 'Produtos', en: 'Products' } },
  { kind: 'INCOME', name: { pt: 'Outras receitas', en: 'Other income' } },
  { kind: 'EXPENSE', systemKey: 'commissions', name: { pt: 'Comissões', en: 'Commissions' } },
  { kind: 'EXPENSE', name: { pt: 'Aluguel', en: 'Rent' } },
  { kind: 'EXPENSE', name: { pt: 'Insumos e produtos', en: 'Supplies' } },
  { kind: 'EXPENSE', name: { pt: 'Água, luz e internet', en: 'Utilities' } },
  { kind: 'EXPENSE', name: { pt: 'Impostos', en: 'Taxes' } },
  { kind: 'EXPENSE', name: { pt: 'Marketing', en: 'Marketing' } },
  { kind: 'EXPENSE', name: { pt: 'Outras despesas', en: 'Other expenses' } }
]

function resolveLocale(locale: string | null | undefined): Locale {
  return locale?.toLowerCase().startsWith('en') ? 'en' : 'pt'
}

/**
 * Idempotente. Formas de pagamento e categorias comuns só são semeadas se o
 * tenant ainda não tiver nenhuma (para não recriar o que o dono renomeou ou
 * desativou). As categorias de sistema são sempre garantidas pelo `systemKey`.
 */
export async function ensureFinanceDefaults(
  tx: Prisma.TransactionClient,
  tenantId: string,
  localeRaw: string | null | undefined
): Promise<void> {
  const locale = resolveLocale(localeRaw)

  const [methodCount, categoryCount] = await Promise.all([
    tx.paymentMethod.count({ where: { userId: tenantId } }),
    tx.financeCategory.count({ where: { userId: tenantId } })
  ])

  if (methodCount === 0) {
    await tx.paymentMethod.createMany({
      data: DEFAULT_PAYMENT_METHODS.map((m, index) => ({
        userId: tenantId,
        type: m.type,
        name: m.name[locale],
        sortOrder: index
      })),
      skipDuplicates: true
    })
  }

  if (categoryCount === 0) {
    await tx.financeCategory.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({
        userId: tenantId,
        kind: c.kind,
        name: c.name[locale],
        systemKey: c.systemKey ?? null,
        isSystem: Boolean(c.systemKey)
      })),
      skipDuplicates: true
    })
    return
  }

  for (const category of DEFAULT_CATEGORIES.filter((c) => c.systemKey)) {
    const systemKey = category.systemKey!
    const existing = await tx.financeCategory.findUnique({
      where: { userId_systemKey: { userId: tenantId, systemKey } },
      select: { id: true }
    })
    if (existing) {
      await tx.financeCategory.update({ where: { id: existing.id }, data: { isActive: true } })
      continue
    }
    // Se o dono já criou uma categoria com o mesmo nome, ela passa a ser a de sistema.
    const name = category.name[locale]
    await tx.financeCategory.upsert({
      where: { userId_kind_name: { userId: tenantId, kind: category.kind, name } },
      update: { systemKey, isSystem: true, isActive: true },
      create: { userId: tenantId, kind: category.kind, name, systemKey, isSystem: true }
    })
  }
}
