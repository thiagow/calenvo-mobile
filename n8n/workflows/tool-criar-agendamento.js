/**
 * Tool: Criar Agendamento
 * 
 * Cria um novo agendamento no sistema.
 * Se o cliente não existir, cria automaticamente (multi-tenant aware).
 */

// Parâmetros esperados no $json:
// - clientName: Nome do cliente
// - clientPhone: Telefone do cliente
// - scheduleId: ID da agenda
// - serviceId: ID do serviço
// - date: Data e hora do agendamento (ISO 8601)
// - userId: ID do tenant

const { clientName, clientPhone, scheduleId, serviceId, date, userId } = $json;

if (!clientName || !clientPhone || !scheduleId || !serviceId || !date || !userId) {
    return [{
        json: {
            success: false,
            error: 'Parâmetros obrigatórios: clientName, clientPhone, scheduleId, serviceId, date, userId'
        }
    }];
}

// 1. Buscar ou criar cliente (multi-tenant aware)
const findClientQuery = `
  SELECT id, name, phone
  FROM "Client"
  WHERE phone LIKE '%${clientPhone}%' AND "userId" = '${userId}'
  LIMIT 1
`;

let client = await $('PostgreSQL').first().json;

if (!client) {
    // Cliente não existe - criar novo
    const createClientQuery = `
    INSERT INTO "Client" (id, name, phone, "userId", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid()::text,
      '${clientName}',
      '${clientPhone}',
      '${userId}',
      NOW(),
      NOW()
    )
    RETURNING id, name, phone
  `;

    client = await $('PostgreSQL').first().json;

    if (!client) {
        return [{
            json: {
                success: false,
                error: 'Falha ao criar cliente'
            }
        }];
    }
}

const clientId = client.id;

// 2. Buscar duração do serviço
const serviceQuery = `
  SELECT duration
  FROM "Service"
  WHERE id = '${serviceId}' AND "userId" = '${userId}' AND "isActive" = true
`;

const service = await $('PostgreSQL').first().json;

if (!service) {
    return [{
        json: {
            success: false,
            error: 'Serviço não encontrado'
        }
    }];
}

const duration = service.duration;

// 3. Validar se o slot está disponível
const appointmentDate = new Date(date);
const appointmentMinutes = appointmentDate.getHours() * 60 + appointmentDate.getMinutes();
const appointmentEnd = appointmentMinutes + duration;

const conflictQuery = `
  SELECT id
  FROM "Appointment"
  WHERE "scheduleId" = '${scheduleId}'
    AND DATE(date) = DATE('${date}')
    AND status IN ('SCHEDULED', 'CONFIRMED')
    AND (
      (EXTRACT(HOUR FROM date) * 60 + EXTRACT(MINUTE FROM date) < ${appointmentEnd})
      AND
      (EXTRACT(HOUR FROM date) * 60 + EXTRACT(MINUTE FROM date) + duration > ${appointmentMinutes})
    )
  LIMIT 1
`;

const conflict = await $('PostgreSQL').first().json;

if (conflict) {
    return [{
        json: {
            success: false,
            error: 'Horário não disponível - já existe um agendamento neste período'
        }
    }];
}

// 4. Criar agendamento
const createAppointmentQuery = `
  INSERT INTO "Appointment" (
    id, 
    date, 
    duration, 
    status, 
    modality,
    "scheduleId", 
    "serviceId", 
    "userId", 
    "clientId",
    "createdAt", 
    "updatedAt"
  )
  VALUES (
    gen_random_uuid()::text,
    '${date}',
    ${duration},
    'SCHEDULED',
    'PRESENCIAL',
    '${scheduleId}',
    '${serviceId}',
    '${userId}',
    '${clientId}',
    NOW(),
    NOW()
  )
  RETURNING id, date, duration, status
`;

const appointment = await $('PostgreSQL').first().json;

if (!appointment) {
    return [{
        json: {
            success: false,
            error: 'Falha ao criar agendamento'
        }
    }];
}

// 5. Retornar sucesso
return [{
    json: {
        success: true,
        appointment: {
            id: appointment.id,
            date: appointment.date,
            duration: appointment.duration,
            status: appointment.status,
            client: {
                id: clientId,
                name: clientName,
                phone: clientPhone
            }
        }
    }
}];
