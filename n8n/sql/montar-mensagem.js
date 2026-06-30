// ============================================================
// Código JavaScript para o nó "Code" do n8n
// Nó: Montar Mensagem (substituir variáveis Mustache)
// Posição no fluxo: Após o Wait de 5s, antes do Enviar Texto
// Modo: Run Once for Each Item
// ============================================================

const item = $input.item.json;

// Formatar data e hora no padrão brasileiro
const date = new Date(item.appointment_date);
const dateFormatted = date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo'
});
const timeFormatted = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
});

// Template padrão caso a mensagem não esteja configurada
const defaultMessage = 'Olá {{nome_cliente}}! Lembrete: seu agendamento é em {{data}} às {{hora}}. Te esperamos!';

// Pegar o template configurado pelo dono do negócio
let message = item.reminder_message || defaultMessage;

// Substituir todas as variáveis Mustache
message = message
    .replace(/\{\{nome_cliente\}\}/g, item.client_name || 'Cliente')
    .replace(/\{\{data\}\}/g, dateFormatted)
    .replace(/\{\{hora\}\}/g, timeFormatted)
    .replace(/\{\{servico\}\}/g, item.service_name || 'Agendamento')
    .replace(/\{\{profissional\}\}/g, item.professional_name || 'Equipe')
    .replace(/\{\{empresa\}\}/g, item.business_name || 'Nossa Empresa');

// Formatar telefone (garantir DDI 55 para Brasil)
let phone = (item.client_phone || '').replace(/\D/g, '');
if (!phone.startsWith('55')) {
    phone = '55' + phone;
}

// Retornar item enriquecido com mensagem formatada
return {
    // Dados originais (passados adiante para os nós de log)
    appointment_id: item.appointment_id,
    appointment_date: item.appointment_date,
    client_id: item.client_id,
    client_name: item.client_name,
    user_id: item.user_id,
    user_name: item.user_name,
    business_name: item.business_name,
    service_name: item.service_name || 'Agendamento',
    professional_name: item.professional_name || 'Equipe',
    instance_name: item.instance_name,
    reminder_hours: item.reminder_hours,

    // Campos processados (usados pelo nó Evolution e pelos logs)
    formatted_message: message,
    formatted_phone: phone,

    // Metadados para debug
    date_formatted: dateFormatted,
    time_formatted: timeFormatted
};
