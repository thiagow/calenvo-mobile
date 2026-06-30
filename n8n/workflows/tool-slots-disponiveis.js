/**
 * Tool: Consultar Slots Disponíveis
 * 
 * Calcula os horários disponíveis para agendamento em uma data específica,
 * considerando:
 * - Horário de funcionamento da agenda
 * - Configurações customizadas por dia da semana
 * - Bloqueios de períodos
 * - Agendamentos já existentes
 * - Horário de almoço
 */

// Parâmetros esperados no $json:
// - scheduleId: ID da agenda
// - serviceId: ID do serviço
// - date: Data no formato YYYY-MM-DD
// - userId: ID do tenant

const { scheduleId, serviceId, date, userId } = $json;

if (!scheduleId || !serviceId || !date || !userId) {
    return [{
        json: {
            error: 'Parâmetros obrigatórios: scheduleId, serviceId, date, userId'
        }
    }];
}

// 1. Buscar configuração da agenda
const scheduleQuery = `
  SELECT 
    "workingDays", 
    "startTime", 
    "endTime", 
    "slotDuration", 
    "lunchStart", 
    "lunchEnd",
    "useCustomDayConfig"
  FROM "Schedule"
  WHERE id = '${scheduleId}' AND "userId" = '${userId}' AND "isActive" = true
`;

const scheduleResult = await $('PostgreSQL').first().json;
if (!scheduleResult) {
    return [{ json: { error: 'Agenda não encontrada' } }];
}

const schedule = scheduleResult;

// 2. Buscar duração do serviço
const serviceQuery = `
  SELECT duration
  FROM "Service"
  WHERE id = '${serviceId}' AND "userId" = '${userId}' AND "isActive" = true
`;

const serviceResult = await $('PostgreSQL').first().json;
if (!serviceResult) {
    return [{ json: { error: 'Serviço não encontrado' } }];
}

const serviceDuration = serviceResult.duration;

// 3. Verificar dia da semana
const targetDate = new Date(date);
const dayOfWeek = targetDate.getDay(); // 0 = domingo, 6 = sábado

// 4. Verificar se o dia está nos workingDays
if (!schedule.workingDays.includes(dayOfWeek)) {
    return [{ json: { slots: [], message: 'Agenda não funciona neste dia da semana' } }];
}

// 5. Buscar configuração customizada do dia (se existir)
let dayConfig = null;
if (schedule.useCustomDayConfig) {
    const dayConfigQuery = `
    SELECT "startTime", "endTime", "lunchStart", "lunchEnd"
    FROM "ScheduleDayConfig"
    WHERE "scheduleId" = '${scheduleId}' AND "dayOfWeek" = ${dayOfWeek}
  `;

    dayConfig = await $('PostgreSQL').first().json;
}

// Usar configuração customizada ou padrão
const startTime = dayConfig?.startTime || schedule.startTime;
const endTime = dayConfig?.endTime || schedule.endTime;
const lunchStart = dayConfig?.lunchStart || schedule.lunchStart;
const lunchEnd = dayConfig?.lunchEnd || schedule.lunchEnd;

// 6. Buscar bloqueios para a data
const blocksQuery = `
  SELECT "startTime", "endTime"
  FROM "ScheduleBlock"
  WHERE "scheduleId" = '${scheduleId}' 
    AND "startDate" <= '${date}' 
    AND "endDate" >= '${date}'
`;

const blocks = await $('PostgreSQL').all().json || [];

// 7. Buscar agendamentos existentes para a data
const appointmentsQuery = `
  SELECT date, duration
  FROM "Appointment"
  WHERE "scheduleId" = '${scheduleId}' 
    AND DATE(date) = '${date}'
    AND status IN ('SCHEDULED', 'CONFIRMED')
`;

const appointments = await $('PostgreSQL').all().json || [];

// 8. Gerar slots disponíveis
function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
    const mins = (minutes % 60).toString().padStart(2, '0');
    return `${hours}:${mins}`;
}

const startMinutes = timeToMinutes(startTime);
const endMinutes = timeToMinutes(endTime);
const slotDuration = serviceDuration;

const slots = [];
let currentMinutes = startMinutes;

while (currentMinutes + slotDuration <= endMinutes) {
    const slotStart = minutesToTime(currentMinutes);
    const slotEnd = minutesToTime(currentMinutes + slotDuration);

    // Verificar se está no horário de almoço
    if (lunchStart && lunchEnd) {
        const lunchStartMin = timeToMinutes(lunchStart);
        const lunchEndMin = timeToMinutes(lunchEnd);

        if (currentMinutes >= lunchStartMin && currentMinutes < lunchEndMin) {
            currentMinutes += schedule.slotDuration || 30;
            continue;
        }
    }

    // Verificar se está em algum bloqueio
    const isBlocked = blocks.some(block => {
        const blockStart = timeToMinutes(block.startTime);
        const blockEnd = timeToMinutes(block.endTime);
        return currentMinutes >= blockStart && currentMinutes < blockEnd;
    });

    if (isBlocked) {
        currentMinutes += schedule.slotDuration || 30;
        continue;
    }

    // Verificar se já tem agendamento
    const hasAppointment = appointments.some(apt => {
        const aptDate = new Date(apt.date);
        const aptMinutes = aptDate.getHours() * 60 + aptDate.getMinutes();
        const aptEnd = aptMinutes + apt.duration;

        return (currentMinutes >= aptMinutes && currentMinutes < aptEnd) ||
            (currentMinutes + slotDuration > aptMinutes && currentMinutes + slotDuration <= aptEnd);
    });

    if (!hasAppointment) {
        slots.push({
            start: slotStart,
            end: slotEnd,
            datetime: `${date}T${slotStart}:00`
        });
    }

    currentMinutes += schedule.slotDuration || 30;
}

return [{ json: { slots, date } }];
