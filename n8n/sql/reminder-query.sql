-- ============================================================
-- SQL para o nó "Execute a SQL query" do n8n
-- Workflow: disparo-mensagens-calenvo
-- Objetivo: Buscar agendamentos que necessitam de lembrete WhatsApp
-- Frequência: 1x por dia (sugestão: 08:00 horário de Brasília)
-- Multi-tenant: Busca de TODOS os donos de negócio (SaaS)
-- ============================================================

SELECT 
  -- Dados do agendamento
  a.id                    AS appointment_id,
  a.date                  AS appointment_date,
  a.duration              AS appointment_duration,
  a.status                AS appointment_status,
  a.notes                 AS appointment_notes,

  -- Dados do cliente (destinatário)
  c.id                    AS client_id,
  c.name                  AS client_name,
  c.phone                 AS client_phone,

  -- Dados do serviço
  s.name                  AS service_name,

  -- Dados do profissional responsável
  p.name                  AS professional_name,

  -- Dados do dono da conta (empresa / tenant)
  u.id                    AS user_id,
  u.name                  AS user_name,
  u."businessName"        AS business_name,

  -- Configuração WhatsApp (para envio)
  wc."instanceName"       AS instance_name,
  wc."reminderHours"      AS reminder_hours,
  wc."reminderMessage"    AS reminder_message

FROM "Appointment" a
  INNER JOIN "Client" c             ON c.id = a."clientId"
  INNER JOIN "User" u               ON u.id = a."userId"
  INNER JOIN "WhatsAppConfig" wc    ON wc."userId" = u.id
  LEFT  JOIN "Service" s            ON s.id = a."serviceId"
  LEFT  JOIN "User" p               ON p.id = a."professionalId"

WHERE 
  -- 1. WhatsApp globalmente ativado e conectado
  wc.enabled = true
  AND wc."isConnected" = true

  -- 2. Lembrete (Reminder) ativado pelo dono do negócio
  AND wc."notifyReminder" = true

  -- 3. Apenas agendamentos válidos (não cancelados/concluídos)
  AND a.status IN ('SCHEDULED', 'CONFIRMED')

  -- 4. Cliente possui telefone para receber WhatsApp
  AND c.phone IS NOT NULL
  AND c.phone <> ''

  -- 5. Janela de lembrete para execução DIÁRIA:
  --    Busca agendamentos entre AGORA e as próximas X horas (reminderHours)
  --    Ex: Se roda às 08:00 com reminderHours=24, busca até 08:00 do dia seguinte
  AND a.date > NOW()
  AND a.date <= NOW() + (wc."reminderHours" * INTERVAL '1 hour')

  -- 6. Anti-duplicata: não envia se já existe notificação de lembrete
  AND NOT EXISTS (
    SELECT 1 
    FROM "Notification" n 
    WHERE n."appointmentId" = a.id 
      AND n.type = 'APPOINTMENT_REMINDER'
  )

ORDER BY a.date ASC;
