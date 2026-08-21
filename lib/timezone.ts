/**
 * Conversão de fuso horário sem dependência extra — só `date-fns` (sem
 * timezone support) está instalado, e `date-fns-tz` não vale a pena para
 * este único uso. Usa Intl.DateTimeFormat, disponível no runtime Node do
 * Netlify sem nenhum pacote adicional.
 */

export interface WallTimeParts {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
}

export function getWallTimeInZone(instant: Date, timeZone: string): WallTimeParts {
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
export function zonedWallTimeToUtc(
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

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo'

/** Quebra "YYYY-MM-DD" nos componentes de calendário, sem construir Date nenhum. */
function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number)
  return { year, month, day }
}

/**
 * Dia da semana (0=domingo) de uma data de calendário "YYYY-MM-DD".
 *
 * Independente do fuso do processo E do fuso do tenant: um dia de calendário
 * cai no mesmo dia da semana em qualquer fuso, então basta aritmética em UTC.
 */
export function dayOfWeekFromDateStr(dateStr: string): number {
  const { year, month, day } = parseDateParts(dateStr)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/**
 * Converte hora de parede do negócio ("2026-08-21" + "15:00" em
 * America/Sao_Paulo) para o instante absoluto correspondente (18:00Z).
 *
 * Ponto único de verdade dessa conversão em todo o sistema. Antes, cada
 * caminho de escrita fazia a sua: o dashboard montava a data no fuso do
 * NAVEGADOR e o booking público/chat/motor de slots no fuso do PROCESSO — que
 * em produção (Netlify Functions) é UTC. As duas convenções divergiam em 3h,
 * o que fazia a grade exibir como livre um horário que o guard de conflito
 * recusava na escrita, e gravava todo agendamento do booking público 3h cedo.
 */
export function wallTimeToInstant(dateStr: string, timeStr: string, timeZone: string): Date {
  const { year, month, day } = parseDateParts(dateStr)
  const [hour, minute] = timeStr.split(':').map(Number)
  return zonedWallTimeToUtc(year, month, day, hour, minute, 0, timeZone)
}

/** Data de calendário ("YYYY-MM-DD") em que um instante cai, no fuso dado. */
export function calendarDateInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(instant)
}

/** "Hoje" no calendário do tenant, em "YYYY-MM-DD" — comparável lexicograficamente. */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  return calendarDateInZone(now, timeZone)
}

/** Soma dias a uma data de calendário "YYYY-MM-DD", devolvendo outra "YYYY-MM-DD". */
export function addCalendarDays(dateStr: string, days: number): string {
  const { year, month, day } = parseDateParts(dateStr)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

export interface TenantDayWindow {
  start: Date
  end: Date
}

/**
 * Janela [00:00:00.000, 23:59:59.999] de um dia de calendário específico do
 * tenant ("YYYY-MM-DD"), em instantes UTC. Irmã de `tenantDayWindow`, que
 * trabalha em offset a partir de hoje.
 */
export function tenantCalendarDayWindow(timeZone: string, dateStr: string): TenantDayWindow {
  const { year, month, day } = parseDateParts(dateStr)
  const start = zonedWallTimeToUtc(year, month, day, 0, 0, 0, timeZone)
  const nextDayStart = zonedWallTimeToUtc(year, month, day + 1, 0, 0, 0, timeZone)
  return { start, end: new Date(nextDayStart.getTime() - 1) }
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
