import { NextResponse } from 'next/server'

/**
 * GET /api/v1 — documentação mínima da API pública, em JSON.
 * Não requer autenticação.
 */
export async function GET() {
  return NextResponse.json({
    name: 'Calenvo Public API',
    version: 'v1',
    authentication: {
      type: 'Bearer token',
      header: 'Authorization: Bearer cal_live_...',
      howToGenerate: 'Painel do Calenvo → Configurações → Chaves de API',
    },
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/appointments',
        description: 'Lista os agendamentos do negócio dono do token.',
        scopeRequired: 'appointments:read',
        queryParams: {
          dateFrom: 'ISO 8601 (opcional)',
          dateTo: 'ISO 8601 (opcional)',
        },
      },
      {
        method: 'POST',
        path: '/api/v1/appointments',
        description: 'Cria um novo agendamento em nome do negócio dono do token.',
        scopeRequired: 'appointments:write',
        body: {
          scheduleId: 'string (obrigatório)',
          date: 'ISO 8601 (obrigatório)',
          serviceId: 'string (opcional)',
          professionalId: 'string (opcional)',
          duration: 'number, minutos (opcional — usa a duração do serviço se omitido)',
          modality: '"PRESENCIAL" | "TELECONSULTA" (opcional, default PRESENCIAL)',
          notes: 'string (opcional)',
          clientId: 'string — use isto OU (clientName + clientPhone)',
          clientName: 'string',
          clientPhone: 'string',
          clientEmail: 'string (opcional)',
        },
        responses: {
          201: 'Agendamento criado',
          400: 'Payload inválido',
          401: 'Token ausente ou inválido',
          403: 'Token sem escopo necessário, ou limite do plano atingido',
          404: 'Agenda, serviço ou cliente não encontrado',
          409: 'Conflito de horário',
          429: 'Limite de requisições excedido',
        },
      },
    ],
    rateLimit: '60 requisições por minuto por token (quando configurado)',
  })
}
