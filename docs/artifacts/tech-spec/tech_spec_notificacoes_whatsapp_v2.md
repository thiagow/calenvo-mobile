# DESIGN TÉCNICO v2.0: Notificações WhatsApp (Refatoração)

**Data**: Janeiro 26, 2026  
**Versão**: 2.0  
**Status**: 🟢 Aprovado  
**Autor**: AI Development Assistant

---

## 📋 Changelog v1.0 → v2.0

### **Problemas Identificados na v1.0:**

1. **Arquitetura Acoplada**: CalenvoApp falava diretamente com Evolution API
2. **Rota Duplicada**: Código de WhatsApp em `/dashboard/notifications/page.tsx` E `/dashboard/settings/notifications/page.tsx`
3. **UX Confusa**: Configurações de WhatsApp em "Settings" quando deveria estar em "Notifications"
4. **Timeout Inadequado**: 10s muito curto para comunicação via n8n

### **Mudanças na v2.0:**

1. ✅ **n8n como Middleware único**: Toda comunicação externa via n8n
2. ✅ **Rota Corrigida**: `/dashboard/notifications/whatsapp/` (sub-rota de notifications)
3. ✅ **Timeout Ajustado**: 60 segundos para operações via n8n
4. ✅ **Código Limpo**: Remoção de duplicação em `/dashboard/notifications/page.tsx`

---

## 1. Constraint Analysis

### Padrões de Arquitetura

- **Schema-First**: Mantido da v1.0 (sem mudanças no schema)
- **Server Actions**: Todas mutações via Server Actions com Zod
- **Client Components**: Apenas para interatividade (estado, eventos)
- **n8n Proxy Pattern**: Toda comunicação externa centralizada

### Impacto no Schema

✅ **Nenhuma mudança necessária** - Schema da v1.0 já atende aos requisitos.

---

## 2. Nova Arquitetura de Sistema

### 2.1. Diagrama de Fluxo

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   CalenvoApp    │         │       n8n        │         │  Evolution API  │
│   (Next.js)     │────────►│   (Middleware)   │────────►│  (WhatsApp)     │
└─────────────────┘         └──────────────────┘         └─────────────────┘
         ▲                            │                            │
         │                            │                            │
         └────────────────────────────┴────────────────────────────┘
                          Webhook Response
```

### 2.2. Comparação v1.0 vs v2.0

| Aspecto | v1.0 (Antigo) | v2.0 (Novo) |
|---------|---------------|-------------|
| **Chamadas API** | Next.js → Evolution API direto | Next.js → n8n → Evolution API |
| **QR Code** | Fetch direto da Evolution API | n8n busca e retorna base64 |
| **Timeout** | 10 segundos | 60 segundos |
| **Rota UI** | `/settings/notifications` | `/notifications/whatsapp` |
| **Dependências** | axios + lib/evolution.ts | Apenas fetch nativo |

---

## 3. Interface n8n (Contrato de API)

### 3.1. Endpoint Único

```
URL: ${N8N_WEBHOOK_URL}
Method: POST
Timeout: 60 segundos
```

### 3.2. Request Format (Next.js → n8n)

```typescript
interface N8nRequest {
  action: 'createInstance' | 'getQRCode' | 'getConnectionState' | 'sendMessage' | 'deleteInstance';
  userId: string;
  payload: {
    instanceName?: string;
    phoneNumber?: string;
    webhookUrl?: string;
    message?: string;
    variables?: Record<string, string>;
  };
}
```

### 3.3. Response Format (n8n → Next.js)

```typescript
interface N8nResponse {
  success: boolean;
  data?: {
    instanceName?: string;
    qrCode?: string;           // Base64 image: data:image/png;base64,...
    state?: 'open' | 'connecting' | 'connected' | 'closed';
    phoneNumber?: string;
  };
  error?: string;
}
```

### 3.4. Exemplos de Payloads

#### **Criar Instância**

```json
{
  "action": "createInstance",
  "userId": "clxxx123",
  "payload": {
    "phoneNumber": "5511999999999",
    "webhookUrl": "https://calenvo.app/api/webhooks/evolution"
  }
}
```

#### **Buscar QR Code**

```json
{
  "action": "getQRCode",
  "userId": "clxxx123",
  "payload": {
    "instanceName": "user_clxxx123"
  }
}
```

#### **Verificar Status de Conexão**

```json
{
  "action": "getConnectionState",
  "userId": "clxxx123",
  "payload": {
    "instanceName": "user_clxxx123"
  }
}
```

---

## 4. Estrutura de Arquivos (Refatoração)

### 4.1. Estrutura Atual (v1.0 - Problema)

```
app/dashboard/
├── notifications/
│   └── page.tsx                    ← DUPLICADO: Lista + Config WhatsApp
└── settings/
    └── notifications/
        ├── page.tsx                ← DUPLICADO: Config WhatsApp
        └── _components/
            ├── whatsapp-connection.tsx
            ├── notification-settings.tsx
            └── ...
```

### 4.2. Estrutura Alvo (v2.0 - Solução)

```
app/dashboard/
└── notifications/
    ├── page.tsx                    ← LIMPO: Apenas lista de notificações internas
    └── whatsapp/
        ├── page.tsx                ← MOVIDO: Config WhatsApp
        └── _components/
            ├── whatsapp-connection.tsx
            ├── notification-settings.tsx
            ├── notification-card.tsx
            ├── message-preview.tsx
            ├── variable-helper.tsx
            └── qrcode-modal.tsx
```

---

## 5. Server Actions (Refatoração)

### 5.1. Mudanças em `app/actions/whatsapp.ts`

#### **Remover:**

- ❌ Importação de `lib/evolution.ts`
- ❌ Chamadas diretas à Evolution API
- ❌ Timeouts de 10 segundos

#### **Adicionar:**

- ✅ Cliente HTTP genérico para n8n
- ✅ Timeout de 60 segundos
- ✅ Tratamento de erros específicos do n8n
- ✅ Validação de resposta n8n

### 5.2. Implementação do Cliente n8n

```typescript
// app/actions/whatsapp.ts

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const N8N_TIMEOUT = 60000; // 60 segundos

async function callN8n(request: N8nRequest): Promise<N8nResponse> {
  if (!N8N_WEBHOOK_URL) {
    throw new Error('N8N_WEBHOOK_URL not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT);

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`n8n returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('n8n timeout after 60s');
    }
    throw error;
  }
}
```

### 5.3. Refatoração das Actions

#### **createInstanceAction**

```typescript
export async function createInstanceAction(
  phoneNumber: string
): Promise<ActionResult<{ qrCode: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  const instanceName = `user_${session.user.id}`;
  
  const response = await callN8n({
    action: 'createInstance',
    userId: session.user.id,
    payload: {
      phoneNumber,
      instanceName,
      webhookUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/evolution`,
    },
  });

  if (!response.success) {
    return { success: false, error: response.error || 'Failed to create instance' };
  }

  // Salvar no banco
  await prisma.whatsAppConfig.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      instanceName,
      phoneNumber,
      apiUrl: N8N_WEBHOOK_URL, // Para referência
      isConnected: false,
    },
    update: {
      phoneNumber,
      qrCode: response.data?.qrCode,
    },
  });

  return {
    success: true,
    data: { qrCode: response.data?.qrCode || '' },
  };
}
```

#### **checkConnectionStatusAction**

```typescript
export async function checkConnectionStatusAction(): Promise<ActionResult<{ isConnected: boolean }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  const config = await prisma.whatsAppConfig.findUnique({
    where: { userId: session.user.id },
  });

  if (!config) {
    return { success: false, error: 'No instance configured' };
  }

  const response = await callN8n({
    action: 'getConnectionState',
    userId: session.user.id,
    payload: { instanceName: config.instanceName },
  });

  if (!response.success) {
    return { success: false, error: response.error || 'Failed to check status' };
  }

  const isConnected = response.data?.state === 'connected' || response.data?.state === 'open';

  // Atualizar no banco se mudou
  if (config.isConnected !== isConnected) {
    await prisma.whatsAppConfig.update({
      where: { userId: session.user.id },
      data: { isConnected },
    });
  }

  return { success: true, data: { isConnected } };
}
```

---

## 6. UI Components (Refatoração)

### 6.1. Mudanças em `whatsapp-connection.tsx`

#### **Timeout de Polling**

```typescript
// ANTES (v1.0):
const POLLING_INTERVAL = 2000; // 2 segundos
const MAX_ATTEMPTS = 60; // 2 minutos

// DEPOIS (v2.0):
const POLLING_INTERVAL = 3000; // 3 segundos (n8n pode ser mais lento)
const MAX_ATTEMPTS = 40; // 2 minutos total
```

#### **Feedback de Loading**

```typescript
// Adicionar estado específico para n8n
const [isWaitingN8n, setIsWaitingN8n] = useState(false);

// Durante operações
{isWaitingN8n && (
  <p className="text-sm text-muted-foreground">
    Comunicando com n8n... isso pode levar até 60 segundos
  </p>
)}
```

### 6.2. Nenhuma Mudança nos Outros Componentes

- `notification-card.tsx` ✅ Mantido
- `message-preview.tsx` ✅ Mantido
- `variable-helper.tsx` ✅ Mantido
- `qrcode-modal.tsx` ✅ Mantido

---

## 7. Variáveis de Ambiente

### 7.1. Remover da `.env.example`

```env
# ❌ REMOVER
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
```

### 7.2. Adicionar/Atualizar na `.env.example`

```env
# n8n Integration (WhatsApp Middleware)
N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/whatsapp-calenvo
N8N_WEBHOOK_SECRET=optional_validation_secret

# Webhook público (para Evolution API callback)
NEXTAUTH_URL=https://calenvo.app
```

---

## 8. Implementation Plan (Refatoração)

### **Fase 1: Limpeza e Preparação** ✅

1. Remover código duplicado de `/dashboard/notifications/page.tsx`
2. Criar diretório `/dashboard/notifications/whatsapp/`
3. Atualizar `.env.example`

### **Fase 2: Migração de Componentes** ✅

1. Mover `page.tsx` de `/settings/notifications` para `/notifications/whatsapp`
2. Mover pasta `_components/` junto
3. Ajustar imports relativos nos componentes

### **Fase 3: Refatoração de Server Actions** ✅

1. Remover `lib/evolution.ts` (não será mais usado)
2. Implementar `callN8n()` em `app/actions/whatsapp.ts`
3. Refatorar todas as actions para usar n8n
4. Ajustar timeouts para 60s

### **Fase 4: Ajustes de UI** ✅

1. Atualizar polling interval em `whatsapp-connection.tsx`
2. Melhorar feedback de loading
3. Adicionar mensagens específicas para n8n

### **Fase 5: Remoção de Arquivos Antigos** ✅

1. Deletar `/dashboard/settings/notifications/` (diretório completo)
2. Deletar `lib/evolution.ts`

### **Fase 6: Documentação** ✅

1. Atualizar `docs/feature-mapping.md`
2. Atualizar `docs/artifacts/whatsapp-implementation-summary.md`
3. Criar este `tech_spec_notificacoes_whatsapp_v2.md`

### **Fase 7: Verificação** ✅

1. `npm run lint`
2. `npm run build`
3. Criar/executar script de verificação
4. Teste manual da UI (com mock n8n opcional)

---

## 9. Testing Strategy

### 9.1. Script de Verificação

Criar `scripts/verify-whatsapp-v2.ts`:

- Verificar que rotas antigas não existem mais
- Verificar que nova rota existe
- Testar callN8n() com mock
- Verificar structure de diretórios

### 9.2. Teste Manual (UI)

1. Navegar para `/dashboard/notifications` → Deve mostrar apenas lista
2. Navegar para `/dashboard/notifications/whatsapp` → Deve mostrar configurações
3. Navegar para `/dashboard/settings/notifications` → Deve retornar 404
4. Testar formulário de conexão (com mock n8n)

---

## 10. Rollback Plan

Se houver problemas na refatoração:

1. **Git**: Reverter commit da refatoração
2. **Banco de Dados**: Schema não mudou, sem necessidade de rollback
3. **ENV**: Restaurar variáveis antigas (EVOLUTION_API_*)
4. **Código**: Restaurar `lib/evolution.ts` do histórico

---

## 11. Security & Performance

### 11.1. Segurança

- ✅ n8n webhook pode ter secret opcional (validação extra)
- ✅ Session validation em todas Server Actions
- ✅ Não expor API keys da Evolution no frontend

### 11.2. Performance

- ✅ Timeout de 60s adequado para n8n
- ✅ Polling reduzido de 2s → 3s (menos carga)
- ✅ Sem cache adicional necessário (n8n gerencia)

---

## 12. Acceptance Criteria

### Must Have (MVP v2.0)

- [ ] Rota `/dashboard/notifications/whatsapp` funcional
- [ ] Rota antiga `/dashboard/settings/notifications` removida
- [ ] `/dashboard/notifications` limpo (sem código WhatsApp)
- [ ] Todas Server Actions chamam n8n (não Evolution direta)
- [ ] Timeout de 60s implementado
- [ ] Build passa sem erros
- [ ] Lint passa sem warnings
- [ ] Script de verificação passa

### Nice to Have

- [ ] Mock server n8n para testes locais
- [ ] Loading states melhorados
- [ ] Logs estruturados de chamadas n8n

---

## 13. Considerações Finais

### Vantagens da v2.0

1. **Desacoplamento**: CalenvoApp não conhece Evolution API
2. **Manutenibilidade**: Mudanças na Evolution não afetam Next.js
3. **Escalabilidade**: n8n pode adicionar retry, queue, etc
4. **UX Melhorada**: Rota intuitiva `/notifications/whatsapp`
5. **Código Limpo**: Sem duplicação

### Próximos Passos Após v2.0

1. Configurar workflow n8n real
2. Implementar notificações agendadas (Reminder/Confirmation)
3. Adicionar logging e monitoring
4. Testes end-to-end com Evolution API real

---

**Status**: 🟢 Aprovado para Implementação  
**Estimativa**: 3-4 horas  
**Prioridade**: Alta  
**Dependências**: Nenhuma (refatoração independente)

---

**Documento Version**: 2.0  
**Last Updated**: Janeiro 26, 2026  
**Review Status**: ✅ Approved
