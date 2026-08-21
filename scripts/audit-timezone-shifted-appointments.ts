/**
 * Auditoria SOMENTE-LEITURA de agendamentos gravados com o fuso errado.
 *
 * Contexto: até a correção do motor de disponibilidade, o booking público e o
 * chat de IA montavam o instante do agendamento com métodos locais do PROCESSO.
 * Em produção (Netlify Functions) o processo roda em UTC, então "15:00"
 * escolhido pelo cliente virava 15:00Z — 12:00 no fuso do salão. Todo
 * agendamento criado por esses dois canais ficou 3h adiantado.
 *
 * Detecção: o registro é suspeito quando a hora de parede correta (instante
 * lido no fuso do negócio) cai FORA do expediente da agenda, mas a hora lida
 * como se o instante fosse hora de parede (o "errado") cai DENTRO. Isso
 * praticamente elimina falso positivo — um agendamento legítimo não fica fora
 * do horário de funcionamento.
 *
 *   npx tsx scripts/audit-timezone-shifted-appointments.ts
 *
 * Este script NÃO escreve nada. A correção dos dados, se for o caso, é uma
 * decisão separada e precisa da lista revisada em mãos.
 */
import { PrismaClient } from '@prisma/client'
import { DEFAULT_TIMEZONE, calendarDateInZone } from '../lib/timezone'

const prisma = new PrismaClient()

/** "HH:MM" do instante no fuso dado. */
function wallClockInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).format(instant)
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

async function main() {
  const appointments = await prisma.appointment.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      scheduleId: { not: null },
    },
    select: {
      id: true,
      date: true,
      duration: true,
      createdAt: true,
      client: { select: { name: true, phone: true } },
      service: { select: { name: true } },
      schedule: { select: { name: true, startTime: true, endTime: true } },
      user: {
        select: {
          email: true,
          businessName: true,
          businessConfig: { select: { timezone: true } },
        },
      },
    },
    orderBy: { date: 'asc' },
  })

  const suspects = appointments.filter((a) => {
    if (!a.schedule) return false
    const timeZone = a.user.businessConfig?.timezone || DEFAULT_TIMEZONE

    const open = toMinutes(a.schedule.startTime)
    const close = toMinutes(a.schedule.endTime)

    // Hora correta: o instante lido no fuso do negócio.
    const actual = toMinutes(wallClockInZone(a.date, timeZone))
    // Hora que o cliente provavelmente escolheu: o instante lido como se ele
    // próprio já fosse a hora de parede (a interpretação do código com bug).
    const intended = toMinutes(wallClockInZone(a.date, 'UTC'))

    const actualInHours = actual >= open && actual < close
    const intendedInHours = intended >= open && intended < close

    return !actualInHours && intendedInHours && actual !== intended
  })

  const now = new Date()
  const future = suspects.filter((a) => a.date >= now)

  console.log(`Agendamentos ativos analisados: ${appointments.length}`)
  console.log(`Suspeitos de deslocamento de fuso: ${suspects.length} (${future.length} ainda no futuro)\n`)

  if (suspects.length === 0) {
    console.log('Nenhum registro suspeito. Nada a corrigir.')
    return
  }

  const byTenant = new Map<string, typeof suspects>()
  for (const a of suspects) {
    const key = `${a.user.businessName || '(sem nome)'} <${a.user.email}>`
    byTenant.set(key, [...(byTenant.get(key) ?? []), a])
  }

  for (const [tenant, rows] of byTenant) {
    console.log(`\n=== ${tenant} — ${rows.length} registro(s) ===`)
    for (const a of rows) {
      const timeZone = a.user.businessConfig?.timezone || DEFAULT_TIMEZONE
      const day = calendarDateInZone(a.date, timeZone)
      const actual = wallClockInZone(a.date, timeZone)
      const intended = wallClockInZone(a.date, 'UTC')
      const flag = a.date >= now ? 'FUTURO' : 'passado'
      console.log(
        `  [${flag}] ${day}  gravado ${actual}  provável escolha ${intended}  ` +
          `| ${a.schedule!.name} (${a.schedule!.startTime}-${a.schedule!.endTime})` +
          ` | ${a.service?.name ?? '—'} | ${a.client.name} ${a.client.phone}` +
          ` | id=${a.id}`
      )
    }
  }

  console.log(
    '\nNenhum dado foi alterado. Revise a lista antes de decidir corrigir — ' +
      'reescrever `date` em massa é irreversível.'
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
