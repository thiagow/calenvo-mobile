/**
 * Diagnóstico SOMENTE-LEITURA: por que um dia aparece sem horários na página pública?
 *
 *   npx tsx scripts/diagnose-day-availability.ts <email-do-dono> "<serviço>" 2026-10-22 [outras datas...]
 *
 * Para cada agenda do tenant que oferece o serviço, mostra a configuração, todos
 * os bloqueios que cobrem o dia, todos os agendamentos que tocam o dia (qualquer
 * status) e o resultado real de `getAvailableSlots`. Só faz SELECT.
 */
import { PrismaClient } from '@prisma/client'
import { getAvailableSlots } from '../lib/availability-service'
import { isDateBlocked, isIntervalBlocked } from '../lib/schedule-blocks'
import {
  DEFAULT_TIMEZONE,
  addCalendarDays,
  dayOfWeekFromDateStr,
  formatInZone,
  tenantCalendarDayWindow,
  todayInZone,
} from '../lib/timezone'

const prisma = new PrismaClient()
const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

async function main() {
  const [email, serviceName, ...dates] = process.argv.slice(2)
  if (!email || !serviceName || dates.length === 0) {
    console.error('Uso: npx tsx scripts/diagnose-day-availability.ts <email> "<serviço>" <YYYY-MM-DD>...')
    process.exit(1)
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, name: true, masterId: true },
  })
  if (!user) throw new Error(`Usuário não encontrado: ${email}`)
  // Profissional pertence a um tenant (o master): agendas e serviços ficam nele.
  const tenantId = user.masterId ?? user.id
  const tenant = await prisma.user.findUniqueOrThrow({
    where: { id: tenantId },
    select: { name: true, businessName: true, businessConfig: { select: { timezone: true } } },
  })
  const tz = tenant.businessConfig?.timezone || DEFAULT_TIMEZONE
  console.log(`Negócio: ${tenant.name} (${tenant.businessName}) · consultado como ${user.name} (${user.id}) · fuso ${tz} · hoje ${todayInZone(tz)}`)

  const services = await prisma.service.findMany({
    where: { userId: tenantId, name: { contains: serviceName, mode: 'insensitive' } },
    select: { id: true, name: true, duration: true },
  })
  if (services.length === 0) throw new Error(`Serviço não encontrado: ${serviceName}`)
  console.log('Serviços:', services.map((s) => `${s.name} (${s.duration}min, ${s.id})`).join(' | '))

  const schedules = await prisma.schedule.findMany({
    where: { userId: tenantId },
    include: {
      dayConfigs: true,
      blocks: true,
      services: { select: { serviceId: true } },
      professionals: { select: { professionalId: true, professional: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })

  for (const date of dates) {
    console.log(`\n================ ${date} (${DOW[dayOfWeekFromDateStr(date)]}) ================`)
    const window = tenantCalendarDayWindow(tz, date)
    const lookback = new Date(window.start.getTime() - 24 * 3600 * 1000)

    for (const schedule of schedules) {
      const offered = services.filter((s) => schedule.services.some((x) => x.serviceId === s.id))
      console.log(
        `\n-- Agenda "${schedule.name}" ${schedule.isActive ? '' : '[INATIVA] '}(${schedule.id}) · serviços compatíveis: ${
          offered.map((s) => s.name).join(', ') || 'nenhum'
        }`
      )
      console.log(
        `   workingDays=${schedule.workingDays.map((d) => DOW[d]).join(',')} · ${schedule.startTime}-${schedule.endTime} · ` +
          `customDayConfig=${schedule.useCustomDayConfig} · passo=${schedule.startInterval}min inteligente=${schedule.smartScheduling} · advance=${schedule.advanceBookingDays}d (até ${addCalendarDays(todayInZone(tz), schedule.advanceBookingDays)}) · minNotice=${schedule.minNoticeHours}h · profissionais=${schedule.professionals.map((p) => p.professional.name).join(', ') || 'nenhum'}`
      )
      if (schedule.useCustomDayConfig) {
        const cfg = schedule.dayConfigs.find((c) => c.dayOfWeek === dayOfWeekFromDateStr(date))
        console.log(`   dayConfig do dia: ${cfg ? JSON.stringify({ isActive: cfg.isActive, timeSlots: cfg.timeSlots }) : 'AUSENTE'}`)
      }

      const covering = schedule.blocks.filter((b) =>
        isIntervalBlocked({ dateStr: date, start: window.start, durationMinutes: 24 * 60, blocks: [b] }) ||
        isDateBlocked(date, [b])
      )
      console.log(`   bloqueios que tocam o dia: ${covering.length}`)
      for (const b of covering) {
        console.log(
          `     • ${b.id} isAllDay=${b.isAllDay} ${b.startDate.toISOString()} → ${b.endDate.toISOString()} group=${b.groupId ?? '-'} profissional=${b.professionalId ?? 'agenda inteira'} motivo=${b.reason ?? '-'}`
        )
      }

      if (schedule.professionals.length > 0) {
        const appts = await prisma.appointment.findMany({
          where: {
            OR: [
              { professionalId: { in: schedule.professionals.map((p) => p.professionalId) } },
              { scheduleId: schedule.id },
            ],
            date: { gte: lookback, lte: window.end },
          },
          select: {
            id: true, date: true, duration: true, status: true, deletedAt: true, scheduleId: true,
            professionalId: true, client: { select: { name: true } },
          },
          orderBy: { date: 'asc' },
        })
        console.log(`   agendamentos (qualquer status, dia ±24h): ${appts.length}`)
        for (const a of appts) {
          const t = formatInZone(a.date, tz)
          const occupies = !['CANCELLED', 'NO_SHOW'].includes(a.status) && !a.deletedAt
          console.log(
            `     • ${t.date} ${t.time} ${a.duration}min ${a.status}${a.deletedAt ? ' [EXCLUÍDO]' : ''} ${a.client.name} · agenda=${a.scheduleId === schedule.id ? 'esta' : a.scheduleId} prof=${a.professionalId} → ${occupies ? 'OCUPA' : 'não ocupa'}`
          )
        }
      }

      for (const service of offered) {
        const slots = await getAvailableSlots({ scheduleId: schedule.id, serviceId: service.id, date, userId: tenantId })
        const free = slots?.filter((s) => s.available).length ?? 0
        console.log(
          `   getAvailableSlots(${service.name}): ${slots === null ? 'null' : `${slots.length} slots, ${free} livres`}` +
            (slots && slots.length > 0 ? ` [${slots.map((s) => `${s.time}${s.available ? '' : '✗'}`).join(' ')}]` : '')
        )
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
