/**
 * Conversão de fuso horário sem dependência extra — só `date-fns` (sem
 * timezone support) está instalado, e `date-fns-tz` não vale a pena para
 * este único uso. Usa Intl.DateTimeFormat, disponível no runtime Node do
 * Netlify sem nenhum pacote adicional.
 */

interface WallTimeParts {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
}

function getWallTimeInZone(instant: Date, timeZone: string): WallTimeParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts: Record<string, string> = {}
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = part.value
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/** Offset (ms) tal que `hora local = hora UTC + offset`, no instante e fuso dados. */
function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const wall = getWallTimeInZone(instant, timeZone)
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
  return asUtc - instant.getTime()
}

/** Converte um horário de parede (ano/mês/dia/hora local) num fuso específico para o instante UTC correspondente. */
function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second)
  // duas iterações bastam mesmo em fusos com DST — o offset estabiliza rápido
  for (let i = 0; i < 2; i++) {
    const offset = getTimeZoneOffsetMs(new Date(guess), timeZone)
    guess = Date.UTC(year, month - 1, day, hour, minute, second) - offset
  }
  return new Date(guess)
}

export interface TenantDayWindow {
  start: Date
  end: Date
}

/**
 * Janela [00:00:00.000, 23:59:59.999] do dia local do tenant (hoje + daysAhead),
 * convertida para instantes UTC. Usada pelo cron de confirmação para achar
 * agendamentos "daqui a N dias" no calendário do próprio negócio, não em UTC.
 */
export function tenantDayWindow(timeZone: string, daysAhead: number, now: Date = new Date()): TenantDayWindow {
  const today = getWallTimeInZone(now, timeZone)
  // Aritmética de calendário em UTC só para achar a data-alvo — o Date normaliza
  // mês/ano automaticamente; a hora não importa aqui, é descartada em seguida.
  const targetUtc = new Date(Date.UTC(today.year, today.month - 1, today.day + daysAhead))
  const targetYear = targetUtc.getUTCFullYear()
  const targetMonth = targetUtc.getUTCMonth() + 1
  const targetDay = targetUtc.getUTCDate()

  const start = zonedWallTimeToUtc(targetYear, targetMonth, targetDay, 0, 0, 0, timeZone)
  const nextDayStart = zonedWallTimeToUtc(targetYear, targetMonth, targetDay + 1, 0, 0, 0, timeZone)
  const end = new Date(nextDayStart.getTime() - 1)

  return { start, end }
}
