import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { appBaseUrl } from '@/lib/app-url'
import { DEFAULT_TIMEZONE, addCalendarDays, calendarDateInZone, todayInZone } from '@/lib/timezone'

/**
 * Reativação de clientes por prazo de retorno.
 *
 * Toda regra é RELATIVA ao prazo do serviço (`Service.returnIntervalDays`):
 * o Calenvo atende de barbearia (retorno em ~20 dias) a dentista (~180), então
 * qualquer limiar fixo em dias quebraria algum segmento.
 */
export const REACTIVATION_RULES = {
  /** "Próximo" começa a X% do prazo antes do retorno previsto... */
  LEAD_RATIO: 0.2,
  /** ...com piso... */
  LEAD_MIN_DAYS: 3,
  /** ...e teto. */
  LEAD_MAX_DAYS: 30,
  /** Atraso acima de N× o prazo vira "perdido". */
  LOST_MULTIPLIER: 2,
  /** Não reenviar ao mesmo cliente+serviço dentro desta janela (salvo `force`). */
  RESEND_COOLDOWN_DAYS: 7,
  /** Teto de mensagens por envio manual. */
  MAX_ITEMS_PER_SEND: 200,
} as const

export type ReturnBucket = 'upcoming' | 'overdue' | 'lost'

export interface ReturnClassification {
  bucket: ReturnBucket | null
  /** "YYYY-MM-DD" no calendário do tenant */
  expectedDate: string
  daysSinceLast: number
  /** Positivo = ainda faltam dias; negativo = atrasado */
  daysUntilDue: number
  daysOverdue: number
}

/** Diferença em dias de calendário entre duas datas "YYYY-MM-DD" (b - a). */
export function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000)
}

export function leadDays(intervalDays: number): number {
  const raw = Math.round(intervalDays * REACTIVATION_RULES.LEAD_RATIO)
  return Math.min(REACTIVATION_RULES.LEAD_MAX_DAYS, Math.max(REACTIVATION_RULES.LEAD_MIN_DAYS, raw))
}

/**
 * Classifica um par cliente+serviço a partir da data (no calendário do tenant)
 * do último atendimento. O próprio dia previsto conta como "próximo" (vence
 * hoje); "atrasado" começa no dia seguinte.
 */
export function classifyReturn(lastDate: string, intervalDays: number, today: string): ReturnClassification {
  const expectedDate = addCalendarDays(lastDate, intervalDays)
  const daysUntilDue = daysBetween(today, expectedDate)
  const daysOverdue = Math.max(0, -daysUntilDue)
  const daysSinceLast = daysBetween(lastDate, today)

  let bucket: ReturnBucket | null = null
  if (daysUntilDue < 0) {
    bucket = daysOverdue > intervalDays * REACTIVATION_RULES.LOST_MULTIPLIER ? 'lost' : 'overdue'
  } else if (daysUntilDue <= leadDays(intervalDays)) {
    bucket = 'upcoming'
  }

  return { bucket, expectedDate, daysSinceLast, daysUntilDue, daysOverdue }
}

/** Linha crua da consulta: último atendimento de cada par cliente+serviço com prazo de retorno. */
export interface CandidateRow {
  clientId: string
  clientName: string
  clientPhone: string
  serviceId: string
  serviceName: string
  returnIntervalDays: number
  reactivationTemplateId: string | null
  lastDate: Date
  professionalId: string | null
  professionalName: string | null
  /** Próximo agendamento em aberto do MESMO serviço — se existir, o par sai da lista. */
  nextSameServiceAt: Date | null
  /** Próximo agendamento em aberto de QUALQUER serviço — só informativo na UI. */
  nextAnyAt: Date | null
  lastNotifiedAt: Date | null
}

export interface ReactivationItem extends ReturnClassification {
  clientId: string
  clientName: string
  clientPhone: string
  serviceId: string
  serviceName: string
  returnIntervalDays: number
  reactivationTemplateId: string | null
  lastDate: string
  professionalId: string | null
  professionalName: string | null
  nextAppointmentDate: string | null
  lastNotifiedAt: string | null
  /** Avisado dentro da janela de RESEND_COOLDOWN_DAYS — o envio pula, salvo `force`. */
  recentlyNotified: boolean
  bucket: ReturnBucket
}

/**
 * Transforma as linhas cruas em itens classificados (um por cliente+serviço,
 * nunca agrupados — cada serviço atrasado é avisado independentemente),
 * ordenados do mais urgente para o menos urgente.
 */
export function toReactivationItems(rows: CandidateRow[], timeZone: string, now: Date = new Date()): ReactivationItem[] {
  const today = todayInZone(timeZone, now)
  const items: ReactivationItem[] = []

  for (const row of rows) {
    if (row.nextSameServiceAt) continue
    if (!row.returnIntervalDays || row.returnIntervalDays <= 0) continue

    const lastDate = calendarDateInZone(row.lastDate, timeZone)
    const classification = classifyReturn(lastDate, row.returnIntervalDays, today)
    if (!classification.bucket) continue

    const recentlyNotified =
      !!row.lastNotifiedAt &&
      daysBetween(calendarDateInZone(row.lastNotifiedAt, timeZone), today) < REACTIVATION_RULES.RESEND_COOLDOWN_DAYS

    items.push({
      ...classification,
      bucket: classification.bucket,
      clientId: row.clientId,
      clientName: row.clientName,
      clientPhone: row.clientPhone,
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      returnIntervalDays: row.returnIntervalDays,
      reactivationTemplateId: row.reactivationTemplateId,
      lastDate,
      professionalId: row.professionalId,
      professionalName: row.professionalName,
      nextAppointmentDate: row.nextAnyAt ? calendarDateInZone(row.nextAnyAt, timeZone) : null,
      lastNotifiedAt: row.lastNotifiedAt ? row.lastNotifiedAt.toISOString() : null,
      recentlyNotified,
    })
  }

  return items.sort((a, b) => a.daysUntilDue - b.daysUntilDue || a.clientName.localeCompare(b.clientName))
}

export function countByBucket(items: ReactivationItem[]): Record<ReturnBucket, number> {
  const counts: Record<ReturnBucket, number> = { upcoming: 0, overdue: 0, lost: 0 }
  for (const item of items) counts[item.bucket]++
  return counts
}

// ---------------------------------------------------------------------------
// Acesso a dados
// ---------------------------------------------------------------------------

export interface TenantScope {
  /** Dono dos dados (User MASTER) */
  tenantId: string
  isMaster: boolean
  /** Presente só para PROFESSIONAL: restringe aos pares cujo último atendimento foi com ele */
  professionalId: string | null
}

export function resolveTenantScope(user: { id: string; role?: string; masterId?: string | null }): TenantScope | null {
  if (user.role === 'PROFESSIONAL') {
    if (!user.masterId) return null
    return { tenantId: user.masterId, isMaster: false, professionalId: user.id }
  }
  if (user.role === 'MASTER') return { tenantId: user.id, isMaster: true, professionalId: null }
  return null
}

/**
 * Uma única consulta: DISTINCT ON pega o último atendimento válido (passado,
 * não cancelado/faltou, não excluído) de cada par cliente+serviço que tenha
 * prazo de retorno, e os subselects trazem próximo agendamento e último aviso.
 * Sem N+1 e sem varrer histórico em memória.
 */
export function candidateRowsQuery(scope: TenantScope, now: Date = new Date()): Prisma.Sql {
  const professionalFilter = scope.professionalId
    ? Prisma.sql`WHERE l."professionalId" = ${scope.professionalId}`
    : Prisma.empty

  return Prisma.sql`
    WITH last AS (
      SELECT DISTINCT ON (a."clientId", a."serviceId")
        a."clientId", a."serviceId", a."date" AS "lastDate", a."professionalId"
      FROM "Appointment" a
      JOIN "Service" s ON s."id" = a."serviceId"
      WHERE a."userId" = ${scope.tenantId}
        AND a."deletedAt" IS NULL
        AND a."status" NOT IN ('CANCELLED', 'NO_SHOW')
        AND a."date" < ${now}
        AND s."returnIntervalDays" IS NOT NULL
        AND s."returnIntervalDays" > 0
      ORDER BY a."clientId", a."serviceId", a."date" DESC
    )
    SELECT
      l."clientId",
      c."name" AS "clientName",
      c."phone" AS "clientPhone",
      l."serviceId",
      s."name" AS "serviceName",
      s."returnIntervalDays",
      s."reactivationTemplateId",
      l."lastDate",
      l."professionalId",
      p."name" AS "professionalName",
      (
        SELECT MIN(f."date") FROM "Appointment" f
        WHERE f."userId" = ${scope.tenantId} AND f."clientId" = l."clientId" AND f."serviceId" = l."serviceId"
          AND f."deletedAt" IS NULL AND f."status" IN ('SCHEDULED', 'CONFIRMED') AND f."date" >= ${now}
      ) AS "nextSameServiceAt",
      (
        SELECT MIN(f."date") FROM "Appointment" f
        WHERE f."userId" = ${scope.tenantId} AND f."clientId" = l."clientId"
          AND f."deletedAt" IS NULL AND f."status" IN ('SCHEDULED', 'CONFIRMED') AND f."date" >= ${now}
      ) AS "nextAnyAt",
      (
        SELECT MAX(r."createdAt") FROM "ReactivationMessage" r
        WHERE r."userId" = ${scope.tenantId} AND r."clientId" = l."clientId" AND r."serviceId" = l."serviceId"
          AND r."status" IN ('QUEUED', 'SENT')
      ) AS "lastNotifiedAt"
    FROM last l
    JOIN "Client" c ON c."id" = l."clientId"
    JOIN "Service" s ON s."id" = l."serviceId"
    LEFT JOIN "User" p ON p."id" = l."professionalId"
    ${professionalFilter}
  `
}

export async function fetchCandidateRows(scope: TenantScope, now: Date = new Date()): Promise<CandidateRow[]> {
  return prisma.$queryRaw<CandidateRow[]>(candidateRowsQuery(scope, now))
}

export async function getTenantTimeZone(tenantId: string): Promise<string> {
  const config = await prisma.businessConfig.findUnique({ where: { userId: tenantId }, select: { timezone: true } })
  return config?.timezone || DEFAULT_TIMEZONE
}

export async function listReactivationItems(scope: TenantScope, now: Date = new Date()): Promise<ReactivationItem[]> {
  const [rows, timeZone] = await Promise.all([fetchCandidateRows(scope, now), getTenantTimeZone(scope.tenantId)])
  return toReactivationItems(rows, timeZone, now)
}

export interface ConversionStats {
  windowDays: number
  notified: number
  returned: number
}

/**
 * "Voltou" = depois do aviso, o cliente agendou (createdAt > sentAt) o mesmo
 * serviço e o agendamento não foi cancelado/excluído.
 */
export function conversionStatsQuery(tenantId: string, since: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT
      COUNT(*) AS "notified",
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "Appointment" a
        WHERE a."userId" = r."userId" AND a."clientId" = r."clientId" AND a."serviceId" = r."serviceId"
          AND a."createdAt" > r."sentAt" AND a."deletedAt" IS NULL AND a."status" <> 'CANCELLED'
      )) AS "returned"
    FROM "ReactivationMessage" r
    WHERE r."userId" = ${tenantId} AND r."status" = 'SENT' AND r."sentAt" >= ${since}
  `
}

export async function getConversionStats(tenantId: string, windowDays = 30, now: Date = new Date()): Promise<ConversionStats> {
  const since = new Date(now.getTime() - windowDays * 86_400_000)
  const [row] = await prisma.$queryRaw<{ notified: bigint; returned: bigint }[]>(conversionStatsQuery(tenantId, since))
  return { windowDays, notified: Number(row?.notified ?? 0), returned: Number(row?.returned ?? 0) }
}

/** Mesmo slug que a página pública resolve (`lib/tenant-resolver.ts`): publicUrl ou prefixo do id. */
export function bookingLink(tenantId: string, publicUrl: string | null | undefined): string {
  return `${appBaseUrl()}/booking/${publicUrl || tenantId.substring(0, 8)}`
}
