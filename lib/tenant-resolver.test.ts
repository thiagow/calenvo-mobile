import { describe, it, expect, vi, beforeEach } from 'vitest'

// resolveUniqueSlug existe porque publicUrl é @unique no schema, mas nada
// verificava colisão antes de salvar — duas contas com o mesmo nome de
// negócio (ex.: "Clínica Teste") geravam o mesmo slug e o segundo salvamento
// falhava com um 500 genérico do Prisma em vez de resolver a colisão.
let mockTakenSlugs: Record<string, string> = {}

vi.mock('@/lib/db', () => ({
  prisma: {
    businessConfig: {
      findFirst: vi.fn(async ({ where }: any) => {
        const owner = mockTakenSlugs[where.publicUrl]
        if (owner && owner !== where.NOT.userId) {
          return { userId: owner }
        }
        return null
      }),
    },
    user: {
      findFirst: vi.fn(async () => null),
    },
  },
}))

beforeEach(() => {
  mockTakenSlugs = {}
})

describe('resolveUniqueSlug', () => {
  it('retorna o slug base quando ele está livre', async () => {
    const { resolveUniqueSlug } = await import('@/lib/tenant-resolver')

    const slug = await resolveUniqueSlug('clinica-teste', 'tenant-a')

    expect(slug).toBe('clinica-teste')
  })

  it('não considera colisão consigo mesmo (mesma conta já usando o slug)', async () => {
    mockTakenSlugs['clinica-teste'] = 'tenant-a'
    const { resolveUniqueSlug } = await import('@/lib/tenant-resolver')

    const slug = await resolveUniqueSlug('clinica-teste', 'tenant-a')

    expect(slug).toBe('clinica-teste')
  })

  it('acrescenta sufixo numérico quando o slug pertence a outra conta', async () => {
    mockTakenSlugs['clinica-teste'] = 'tenant-b'
    const { resolveUniqueSlug } = await import('@/lib/tenant-resolver')

    const slug = await resolveUniqueSlug('clinica-teste', 'tenant-a')

    expect(slug).toBe('clinica-teste-2')
  })

  it('incrementa o sufixo até achar um slug livre', async () => {
    mockTakenSlugs['clinica-teste'] = 'tenant-b'
    mockTakenSlugs['clinica-teste-2'] = 'tenant-c'
    mockTakenSlugs['clinica-teste-3'] = 'tenant-d'
    const { resolveUniqueSlug } = await import('@/lib/tenant-resolver')

    const slug = await resolveUniqueSlug('clinica-teste', 'tenant-a')

    expect(slug).toBe('clinica-teste-4')
  })
})
