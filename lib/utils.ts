
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTime(date: Date | string, includeTime = true): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date

  if (isToday(dateObj)) {
    return includeTime ? `Hoje às ${format(dateObj, 'HH:mm')}` : 'Hoje'
  }

  if (isTomorrow(dateObj)) {
    return includeTime ? `Amanhã às ${format(dateObj, 'HH:mm')}` : 'Amanhã'
  }

  if (isThisWeek(dateObj)) {
    return includeTime
      ? format(dateObj, 'EEEE às HH:mm', { locale: ptBR })
      : format(dateObj, 'EEEE', { locale: ptBR })
  }

  return includeTime
    ? format(dateObj, 'dd/MM/yyyy às HH:mm', { locale: ptBR })
    : format(dateObj, 'dd/MM/yyyy', { locale: ptBR })
}

export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return format(dateObj, 'dd/MM/yyyy', { locale: ptBR })
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  const match = cleaned.match(/^(\d{2})(\d{4,5})(\d{4})$/)
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`
  }
  return phone
}

/**
 * Função reativa para onChange de inputs de Telefone Celular/WhatsApp (BR)
 * Máscara dinâmica: (99) 99999-9999
 */
export function applyPhoneMask(value: string): string {
  if (!value) return ''
  // 1. Remove qualquer caractere que não seja número
  let v = value.replace(/\D/g, '')

  // 2. Limita a 11 dígitos nativos do Brasil
  if (v.length > 11) v = v.slice(0, 11)

  // 3. Aplica máscara gradualmente
  if (v.length <= 2) {
    return v.replace(/^(\d{0,2})/, '($1')
  }
  if (v.length <= 6) {
    return v.replace(/^(\d{2})(\d{0,4})/, '($1) $2')
  }
  if (v.length <= 10) {
    // Para número de 8 dígitos sem o nono digito
    return v.replace(/^(\d{2})(\d{0,4})(\d{0,4})/, '($1) $2-$3')
  }

  // Exatamente 11 para celulares modernos
  return v.replace(/^(\d{2})(\d{0,5})(\d{0,4})/, '($1) $2-$3')
}

/**
 * Formats a phone number for WhatsApp sending.
 * Ensures the '55' DDI is present for Brazilian numbers.
 * @param phone - Raw phone number string
 */
export function formatWhatsAppNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // If it's empty, return as is
  if (!cleaned) return '';

  // If it doesn't start with 55 and has 10 or 11 digits (DDD + number), add 55
  if (!cleaned.startsWith('55') && (cleaned.length === 10 || cleaned.length === 11)) {
    return `55${cleaned}`;
  }

  return cleaned;
}

export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '')
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{3})(\d{2})$/)
  if (match) {
    return `${match[1]}.${match[2]}.${match[3]}-${match[4]}`
  }
  return cpf
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '')
  if (cleaned.length !== 11) return false

  // Check if all digits are the same
  if (/^(\d)\1{10}$/.test(cleaned)) return false

  // Validate check digits
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i)
  }
  let checkDigit = 11 - (sum % 11)
  if (checkDigit === 10 || checkDigit === 11) checkDigit = 0
  if (parseInt(cleaned.charAt(9)) !== checkDigit) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i)
  }
  checkDigit = 11 - (sum % 11)
  if (checkDigit === 10 || checkDigit === 11) checkDigit = 0
  if (parseInt(cleaned.charAt(10)) !== checkDigit) return false

  return true
}

export function generateTimeSlots(startTime: string, endTime: string, duration: number, lunchStart?: string, lunchEnd?: string): string[] {
  const slots: string[] = []
  const start = new Date(`1970-01-01T${startTime}:00`)
  const end = new Date(`1970-01-01T${endTime}:00`)
  const lunchStartTime = lunchStart ? new Date(`1970-01-01T${lunchStart}:00`) : null
  const lunchEndTime = lunchEnd ? new Date(`1970-01-01T${lunchEnd}:00`) : null

  let current = new Date(start)

  while (current < end) {
    const timeString = current.toTimeString().slice(0, 5)

    // Skip lunch break
    if (lunchStartTime && lunchEndTime && current >= lunchStartTime && current < lunchEndTime) {
      current = new Date(lunchEndTime)
      continue
    }

    slots.push(timeString)
    current.setMinutes(current.getMinutes() + duration)
  }

  return slots
}

export function getWeekDays(): { value: number; label: string }[] {
  return [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Segunda-feira' },
    { value: 2, label: 'Terça-feira' },
    { value: 3, label: 'Quarta-feira' },
    { value: 4, label: 'Quinta-feira' },
    { value: 5, label: 'Sexta-feira' },
    { value: 6, label: 'Sábado' }
  ]
}

/**
 * Generates URL-friendly slug from business name
 * @param businessName - Original business name
 * @returns URL-safe slug (lowercase, no accents, hyphenated)
 * @example
 * generateSlug("Fernanda Guimarães Studio") // "fernanda-guimaraes-studio"
 * generateSlug("Clínica São José") // "clinica-sao-jose"
 */
export function generateSlug(businessName: string): string {
  if (!businessName || typeof businessName !== 'string') {
    return ''
  }

  return businessName
    .toLowerCase()
    .normalize('NFD')                      // Decompose accents
    .replace(/[\u0300-\u036f]/g, '')      // Remove accent marks
    .replace(/[^a-z0-9\s-]/g, '')         // Remove special characters
    .replace(/\s+/g, '-')                  // Replace spaces with hyphens
    .replace(/-+/g, '-')                   // Replace multiple hyphens
    .replace(/^-|-$/g, '')                 // Trim hyphens from ends
    .trim()
}
