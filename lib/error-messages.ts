export const USER_FRIENDLY_ERRORS = {
    WHATSAPP_NOT_CONNECTED: 'WhatsApp não está conectado. Configure a conexão primeiro.',
    WHATSAPP_INSTANCE_NOT_FOUND: 'Instância do WhatsApp não encontrada no servidor. Verifique a configuração ou reconecte.',
    WHATSAPP_SEND_FAILED: 'Não foi possível enviar a mensagem no momento. Tente novamente em instantes.',
    WHATSAPP_INVALID_NUMBER: 'O número de telefone informado parece inválido ou não possui WhatsApp.',
    WHATSAPP_NETWORK_ERROR: 'Ocorreu um erro de comunicação com o servidor n8n/WhatsApp.',
    UNKNOWN_ERROR: 'Ocorreu um erro inesperado. Por favor, tente novamente.',
} as const;

export function parseWhatsAppError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not exist') || message.includes('404') || message.includes('instance')) {
        return USER_FRIENDLY_ERRORS.WHATSAPP_INSTANCE_NOT_FOUND;
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('refused')) {
        return USER_FRIENDLY_ERRORS.WHATSAPP_NETWORK_ERROR;
    }

    if (message.includes('number') || message.includes('jid') || message.includes('phone')) {
        return USER_FRIENDLY_ERRORS.WHATSAPP_INVALID_NUMBER;
    }

    return USER_FRIENDLY_ERRORS.WHATSAPP_SEND_FAILED;
}
