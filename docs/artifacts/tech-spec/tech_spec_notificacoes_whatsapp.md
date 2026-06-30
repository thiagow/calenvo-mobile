# DESIGN TÉCNICO: Notificações WhatsApp

## 1. Constraint Analysis

### Padrões de Arquitetura (`.agent/rules/architecture-standards.md`)
- **Schema-First**: Modificações no banco devem começar pelo `schema.prisma`.
- **Server Actions**: Serão utilizadas para todas as mutações (criar instância, salvar configs, conectar).
- **Client Components**: Apenas para interatividade (QR Code, Preview de mensagem, Toggles).
- **Zod Validation**: Obrigatório para todas as Server Actions.

### Impacto no Schema
- O modelo `WhatsAppConfig` já existe, mas precisará ser expandido para suportar os novos campos de templates e delays.
- A relação com `User` é 1:1, mantendo a simplicidade.

---

## 2. Schema Design (Prisma)

Ajuste no modelo `WhatsAppConfig` para suportar templates e delays customizáveis.

```prisma
// prisma/schema.prisma

model WhatsAppConfig {
  id                String   @id @default(cuid())
  instanceName      String   @unique
  apiKey            String?  @db.Text
  apiUrl            String
  phoneNumber       String?
  isConnected       Boolean  @default(false)
  qrCode            String?  @db.Text
  
  enabled           Boolean  @default(false)
  
  // Confirmação de Agendamento (Criado)
  notifyOnCreate    Boolean  @default(true)
  createDelayMinutes Int     @default(0)
  createMessage     String?  @db.Text // Template: "Olá {{nome}}, seu agendamento..."
  
  // Cancelamento
  notifyOnCancel    Boolean  @default(true)
  cancelDelayMinutes Int     @default(0)
  cancelMessage     String?  @db.Text
  
  // Confirmação de Presença (Dias antes)
  notifyConfirmation Boolean @default(true)
  confirmationDays   Int     @default(1)
  confirmationMessage String? @db.Text
  
  // Lembrete (Horas antes)
  notifyReminder    Boolean  @default(true)
  reminderHours     Int      @default(24)
  reminderMessage   String?  @db.Text
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 3. Interface Design (Server Actions)

Local: `app/actions/whatsapp.ts`

### 3.1. Gerenciamento de Instância
```typescript
// Criar instância na Evolution API
async function createInstanceAction(phoneNumber: string): Promise<ActionState<WhatsAppConfig>>

// Buscar QR Code atual (conecta se necessário)
async function getQRCodeAction(): Promise<ActionState<{ qrcode: string }>>

// Deletar instância (logout)
async function deleteInstanceAction(): Promise<ActionState<void>>

// Verificar status (pooling manual ou refresh)
async function checkConnectionStatusAction(): Promise<ActionState<{ isConnected: boolean }>>
```

### 3.2. Configurações
```typescript
// Salvar configurações de notificação
const WhatsAppSettingsSchema = z.object({
  notifyOnCreate: z.boolean(),
  createDelayMinutes: z.number().min(0),
  createMessage: z.string().max(120),
  // ... outros campos
})

async function updateWhatsAppSettingsAction(data: z.infer<typeof WhatsAppSettingsSchema>): Promise<ActionState<WhatsAppConfig>>

// Enviar mensagem de teste
async function sendTestMessageAction(type: NotificationType, phone: string): Promise<ActionState<void>>
```

---

## 4. Component Architecture

### 4.1. Estrutura de Diretórios
```
app/dashboard/settings/notifications/
├── page.tsx                  (Server Component: Layout principal + Fetch dados)
├── _components/
    ├── whatsapp-connection.tsx (Client: Gerencia estado conexão, QR Code modal)
    ├── notification-card.tsx   (Client: Configuração individual de cada tipo)
    ├── message-preview.tsx     (Client: Renderiza preview com variáveis)
    └── variable-helper.tsx     (Client: Lista de variáveis disponíveis)
```

### 4.2. Fluxo de Dados
1. `page.tsx` carrega `WhatsAppConfig` do usuário via Prisma.
2. `whatsapp-connection.tsx` exibe status. Se desconectado, permite criar instância.
   - Usa `createInstanceAction` -> exibe QR Code em Dialog.
   - Polling ou espera webhook para atualizar status para "Conectado".
3. `notification-card.tsx` recebe as props de configuração.
   - `onChange` atualiza estado local (preview imediato).
   - `onSave` chama `updateWhatsAppSettingsAction`.

---

## 5. Webhooks & Integração

### 5.1. Rota de Webhook
Local: `app/api/webhooks/evolution/route.ts`

- **Método**: POST
- **Payload**: Eventos da Evolution API (`connection.update`).
- **Lógica**:
  1. Verifica autenticação/segredo do webhook.
  2. Identifica instância pelo `instanceName`.
  3. Atualiza `isConnected` no banco.
  4. (Opcional) Invalida cache do Next.js (revalidatePath).

### 5.2. Serviço Evolution
Local: `lib/evolution.ts`

- Classe/Funções para encapsular chamadas HTTP (Axios) para a Evolution API.
- Tratamento de erros e Timeouts.

### 5.3. Integração n8n (Disparos)
Os gatilhos de disparo serão implementados nos Services existentes:
- `lib/notification-service.ts` ou novo `lib/whatsapp-trigger.ts`.
- Ao criar/cancelar Agendamento -> Envia payload para URL do n8n (definida em ENV).

---

## 6. Implementation Plan

### Fase 1: Backend & Schema
1. **Migration**: Atualizar `schema.prisma` e rodar `prisma migrate`.
2. **Service**: Criar `lib/evolution.ts` com métodos básicos.
3. **Webhook**: Criar route handler para receber status da conexão.
4. **Server Actions**: Implementar ações de CRUD e Conexão.

### Fase 2: Interface de Conexão
1. **UI**: Criar componente `WhatsAppConnection`.
2. **Flow**: Implementar criação de instância e exibição de QR Code.
3. **Status**: Implementar feedback visual de conexão.

### Fase 3: Configuração de Notificações
1. **UI**: Criar `NotificationCard` e `MessagePreview`.
2. **Logic**: Implementar substituição de variáveis no preview.
3. **Integration**: Conectar formulário à Server Action `updateWhatsAppSettings`.
4. **Bloqueio**: Implementar verificação de Plano Free (disable inputs).

### Fase 4: Integração de Disparo
1. **Triggers**: Adicionar chamadas ao n8n/Evolution nos eventos de Agendamento.
2. **Testes**: Verificar fluxo completo (Agendamento -> Webhook -> Mensagem).

---

## 7. Security & Privacy
- **API Keys**: Armazenar chaves da Evolution de forma segura (considerar criptografia se sensível, mas `instanceName` costuma ser público na API, o token que importa).
- **Segregação**: Garantir que um usuário não possa manipular instância de outro (validar `userId` em todas as actions).
- **Sanitização**: Validar inputs de mensagens para evitar injeção ou quebra de layout, embora seja texto simples.

---
**Status:** ✅ Aprovado
**Data:** 23/01/2026
