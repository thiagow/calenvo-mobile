-- =========================================================================================================
-- BANCO DE QUERIES PARA O AGENTE DE IA (N8N) - COM VARIÁVEIS DO AGENTE
-- =========================================================================================================
-- Instruções:
-- 1. Copie e cole cada query abaixo no campo "Query" do nó Postgres correspondente no n8n.
-- 2. IMPORTANTE: Antes de colar, ative a opção "Expression" (ícone de engrenagem ou clipe) no campo da Query.
-- 3. userId é pego do contexto global ($json.userId).
-- 4. Os demais parâmetros são pegos da IA ($fromAI).
-- =========================================================================================================


-- ---------------------------------------------------------------------------------------------------------
-- TOOL 1: CONSULTAR SERVIÇOS
-- ---------------------------------------------------------------------------------------------------------
-- Objetivo: Listar os serviços disponíveis da empresa.

SELECT 
    id, 
    name, 
    description, 
    duration as "duracao_minutos", 
    price as "preco", 
    category
FROM "Service"
WHERE "userId" = '{{ $json.userId }}'
  AND "isActive" = true
ORDER BY name ASC;


-- ---------------------------------------------------------------------------------------------------------
-- TOOL 2: CONSULTAR AGENDA COM DATAS PRÓXIMAS (Disponibilidade Inteligente)
-- ---------------------------------------------------------------------------------------------------------
-- Parâmetros esperados da IA:
-- - serviceId: ID do serviço escolhido
-- - scheduleId: ID da agenda (opcional, pode ser NULL)
-- - date: Data no formato YYYY-MM-DD

WITH RECURSIVE 
params AS (
    SELECT 
        '{{ $json.userId }}'::text as p_user_id,
        '{{ $fromAI("serviceId") }}'::text as p_service_id,
        '{{ $fromAI("scheduleId") }}'::text as p_schedule_id, 
        '{{ $fromAI("date") }}'::date as p_start_date,
        3 as p_days_to_check
),
config AS (
    SELECT 
        s.id as schedule_id,
        s."workingDays",
        s."startTime"::time as start_time,
        s."endTime"::time as end_time,
        COALESCE(s."slotDuration", 30) as slot_duration,
        svc.duration as service_duration
    FROM "Schedule" s
    JOIN "Service" svc ON svc.id = (select p_service_id from params)
    WHERE s.id = (select p_schedule_id from params)
      AND s."isActive" = true
),
dates_series AS (
    SELECT (select p_start_date from params) as dt, 0 as offset_day
    UNION ALL
    SELECT dt + 1, offset_day + 1
    FROM dates_series
    WHERE offset_day < (select p_days_to_check from params)
),
raw_slots AS (
    SELECT 
        d.dt,
        (d.dt + (t * interval '1 minute')) as slot_datetime_start,
        (d.dt + ((t + c.service_duration) * interval '1 minute')) as slot_datetime_end
    FROM dates_series d
    CROSS JOIN config c
    CROSS JOIN generate_series(
        EXTRACT(EPOCH FROM c.start_time)/60, 
        EXTRACT(EPOCH FROM c.end_time)/60 - c.service_duration, 
        c.slot_duration::numeric
    ) t
    WHERE 
        EXTRACT(DOW FROM d.dt) = ANY(c."workingDays")
),
occupied AS (
    SELECT 
        (date AT TIME ZONE COALESCE((SELECT timezone FROM "BusinessConfig" WHERE "userId" = (select p_user_id from params)), 'America/Sao_Paulo')) as start_time,
        (date AT TIME ZONE COALESCE((SELECT timezone FROM "BusinessConfig" WHERE "userId" = (select p_user_id from params)), 'America/Sao_Paulo')) + (duration * interval '1 minute') as end_time
    FROM "Appointment"
    WHERE "scheduleId" = (select p_schedule_id from params)
      AND status IN ('SCHEDULED', 'CONFIRMED')
      AND date >= (select p_start_date from params)
      AND date <= (select p_start_date from params) + interval '5 days'
)
SELECT 
    to_char(r.slot_datetime_start, 'YYYY-MM-DD') as data,
    to_char(r.slot_datetime_start, 'HH24:MI') as horario_inicio,
    to_char(r.slot_datetime_end, 'HH24:MI') as horario_fim
FROM raw_slots r
WHERE NOT EXISTS (
    SELECT 1 FROM occupied o
    WHERE 
        (r.slot_datetime_start >= o.start_time AND r.slot_datetime_start < o.end_time)
        OR 
        (r.slot_datetime_end > o.start_time AND r.slot_datetime_end <= o.end_time)
        OR
        (r.slot_datetime_start <= o.start_time AND r.slot_datetime_end >= o.end_time)
)
ORDER BY r.slot_datetime_start ASC
LIMIT 15;


-- ---------------------------------------------------------------------------------------------------------
-- TOOL 3: INFORMAÇÕES DA EMPRESA
-- ---------------------------------------------------------------------------------------------------------

SELECT 
    u."businessName" as nome_empresa,
    u.phone as telefone,
    u.whatsapp,
    u."segmentType" as segmento,
    bc."workingDays" as dias_funcionamento,
    to_char(bc."startTime", 'HH24:MI') as abertura,
    to_char(bc."endTime", 'HH24:MI') as fechamento,
    bc.address as endereco,
    bc.description as descricao
FROM "User" u
LEFT JOIN "BusinessConfig" bc ON bc."userId" = u.id
WHERE u.id = '{{ $json.userId }}';


-- ---------------------------------------------------------------------------------------------------------
-- TOOL 4: CRIAR AGENDAMENTO
-- ---------------------------------------------------------------------------------------------------------
-- Parâmetros esperados da IA:
-- - clientName: Nome do cliente
-- - clientPhone: Telefone do cliente
-- - scheduleId: ID da agenda
-- - serviceId: ID do serviço
-- - date: Data e Hora ISO 8601 (ex: '2024-02-20T14:30:00')

WITH upsert_client AS (
    INSERT INTO "Client" (
        id, 
        name, 
        phone, 
        "userId", 
        "updatedAt", 
        "createdAt"
    )
    VALUES (
        gen_random_uuid()::text, 
        '{{ $fromAI("clientName") }}',
        '{{ $fromAI("clientPhone") }}',
        '{{ $json.userId }}', -- userId vem do contexto
        NOW(),
        NOW()
    )
    ON CONFLICT (phone, "userId") 
    DO UPDATE SET 
        name = EXCLUDED.name, 
        "updatedAt" = NOW()
    RETURNING id, name
),
service_info AS (
    SELECT duration FROM "Service" WHERE id = '{{ $fromAI("serviceId") }}'
),
prof_info AS (
    SELECT u.id, u.name 
    FROM "ScheduleProfessional" sp
    JOIN "User" u ON sp."userId" = u.id
    WHERE sp."scheduleId" = '{{ $fromAI("scheduleId") }}'
    LIMIT 1
),
new_appointment AS (
    INSERT INTO "Appointment" (
        id, 
        "userId", 
        "clientId", 
        "scheduleId", 
        "serviceId", 
        "professionalId",
        professional,
        date, 
        duration, 
        status, 
        modality, 
        "createdAt", 
        "updatedAt"
    )
    SELECT 
        gen_random_uuid()::text,
        '{{ $json.userId }}',
        (SELECT id FROM upsert_client),
        '{{ $fromAI("scheduleId") }}',
        '{{ $fromAI("serviceId") }}',
        (SELECT id FROM prof_info),
        (SELECT name FROM prof_info),
        ('{{ $fromAI("date") }}'::timestamp AT TIME ZONE COALESCE((SELECT timezone FROM "BusinessConfig" WHERE "userId" = '{{ $json.userId }}'), 'America/Sao_Paulo')),
        (SELECT duration FROM service_info),
        'SCHEDULED',
        'PRESENCIAL',
        NOW(),
        NOW()
    RETURNING id, date, status, "professionalId", professional
)
SELECT 
    a.id as agendamento_id,
    to_char(a.date, 'DD/MM/YYYY HH24:MI') as data_formatada,
    a.status,
    c.name as cliente_nome,
    a.professional as profissional_nome
FROM new_appointment a, upsert_client c;
