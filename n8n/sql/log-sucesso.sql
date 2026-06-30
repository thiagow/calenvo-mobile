-- ============================================================
-- SQL para o nó PostgreSQL: LOG DE SUCESSO
-- Insere na tabela Notification quando o envio foi bem-sucedido
-- Usado no branch "Sucesso" após o nó Evolution API
-- ============================================================
-- IMPORTANTE: No n8n, use expressões {{ $json.campo }}
-- para referenciar os campos vindos do nó Code (Montar Mensagem)
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
  'Lembrete WhatsApp Enviado',
  '{{ $json.formatted_message }}',
  'APPOINTMENT_REMINDER',
  false,
  '{{ $json.appointment_id }}',
  '{{ $json.user_id }}',
  '{"channel": "whatsapp", "status": "sent", "phone": "{{ $json.formatted_phone }}", "instance": "{{ $json.instance_name }}", "sentAt": "' || NOW()::text || '"}'::jsonb,
  NOW(),
  NOW()
);
