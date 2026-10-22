/**
 * Geração de "adicionar ao calendário" para o cliente final (link do Google Agenda e .ics).
 *
 * Helpers puros, sem I/O. Todos os instantes são UTC — o fuso do negócio só entra
 * como `ctz` (exibição) no link do Google; o .ics usa horário UTC absoluto.
 */

export interface CalendarEventInput {
  /** Identificador estável (id do agendamento) — reimportar o .ics não duplica o evento. */
  uid: string
  title: string
  startUtc: Date
  durationMin: number
  location?: string | null
  description?: string | null
  /** SCHEDULED (aguardando confirmação do negócio) vira evento provisório. */
  tentative?: boolean
  /** Fuso IANA do negócio, usado só para exibição no Google Agenda. */
  timezone?: string | null
}

const ICS_UID_DOMAIN = 'calenvo.com'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** `YYYYMMDDTHHmmssZ` — formato aceito por Google Agenda e iCalendar. */
export function formatCalendarUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

function endOf(input: Pick<CalendarEventInput, 'startUtc' | 'durationMin'>): Date {
  return new Date(input.startUtc.getTime() + input.durationMin * 60_000)
}

export function buildGoogleCalendarUrl(input: CalendarEventInput): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${formatCalendarUtc(input.startUtc)}/${formatCalendarUtc(endOf(input))}`,
  })
  if (input.description) params.set('details', input.description)
  if (input.location) params.set('location', input.location)
  if (input.timezone) params.set('ctz', input.timezone)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

/** Dobra linhas em 75 octetos (RFC 5545 §3.1) sem partir caracteres multibyte. */
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line

  const parts: string[] = []
  let current = ''
  let currentBytes = 0
  // A primeira linha tem 75 octetos úteis; as continuações perdem 1 para o espaço inicial.
  let limit = 75
  for (const char of line) {
    const size = encoder.encode(char).length
    if (currentBytes + size > limit) {
      parts.push(current)
      current = ''
      currentBytes = 0
      limit = 74
    }
    current += char
    currentBytes += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export function buildIcs(input: CalendarEventInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calenvo//Agendamento//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.uid}@${ICS_UID_DOMAIN}`,
    `DTSTAMP:${formatCalendarUtc(new Date())}`,
    `DTSTART:${formatCalendarUtc(input.startUtc)}`,
    `DTEND:${formatCalendarUtc(endOf(input))}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ]
  if (input.description) lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`)
  if (input.location) lines.push(`LOCATION:${escapeIcsText(input.location)}`)
  lines.push(
    `STATUS:${input.tentative ? 'TENTATIVE' : 'CONFIRMED'}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(input.title)}`,
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  )
  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}
