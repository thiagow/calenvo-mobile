-- ============================================================
-- SQL para o nó PostgreSQL: LOG DE ERRO
-- Insere na tabela Notification quando o envio falhou
-- Usado no branch "Erro" após o nó Evolution API
-- ============================================================
-- IMPORTANTE: No n8n, use expressões {{ $json.campo }}
-- para referenciar os campos vindos do nó anterior
-- ============================================================

INSERT INTO "Notification" (
  id,
  title,
  message,
  type,
  "isRead",
  "appointmentId",
  "userId",
  metadata,
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid()::text,
  'Falha no Lembrete WhatsApp',
  'Falha ao enviar lembrete para {{ $json.client_name }}',
  'APPOINTMENT_REMINDER',
  false,
  '{{ $json.appointment_id }}',
  '{{ $json.user_id }}',
  '{"channel": "whatsapp", "status": "error", "phone": "{{ $json.formatted_phone }}", "instance": "{{ $json.instance_name }}", "error": "{{ $json.error_message }}", "failedAt": "' || NOW()::text || '"}'::jsonb,
  NOW(),
  NOW()
);
