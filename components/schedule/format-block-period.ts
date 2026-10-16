import { format, isSameMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/** Período de um bloqueio como a API entrega: dias "YYYY-MM-DD" e horários "HH:mm" já no fuso do negócio. */
export interface BlockPeriod {
  isAllDay?: boolean
  firstDay: string
  lastDay: string
  startTime: string | null
  endTime: string | null
}

// "YYYY-MM-DD" sem horário é lido como meia-noite LOCAL — o dia nunca desloca com o fuso do navegador.
const formatDay = (day: string) => format(parseISO(day), "d 'de' MMMM 'de' yyyy", { locale: ptBR })

export function formatBlockPeriod(block: BlockPeriod): string {
  try {
    if (block.isAllDay === false || block.startTime) {
      return `${formatDay(block.firstDay)} · ${block.startTime}–${block.endTime}`
    }
    if (block.firstDay === block.lastDay) return formatDay(block.firstDay)

    const first = parseISO(block.firstDay)
    const last = parseISO(block.lastDay)
    return isSameMonth(first, last)
      ? `${format(first, 'd')} a ${formatDay(block.lastDay)}`
      : `${formatDay(block.firstDay)} a ${formatDay(block.lastDay)}`
  } catch {
    return `${block.firstDay} – ${block.lastDay}`
  }
}
