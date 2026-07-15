---
trigger: feature_implementation
description: Ative ao receber solicitação de implementação ou ajuste de funcionalidade. Garante que o agente consulte a documentação de contexto antes de qualquer ação.
---

# Feature Navigation \u0026 Context

## 🎯 Objetivo
Garantir que o agente sempre consulte a documentação de contexto antes de implementar ou ajustar funcionalidades, evitando retrabalho e mantendo consistência com padrões existentes.

## 📋 Protocolo Obrigatório

### 1. ANTES de qualquer implementação/ajuste

```
SEMPRE siga esta ordem:
1. Identificar a feature principal na solicitação
2. Consultar docs/feature-mapping.md para localizar arquivos
3. Ler a documentação específica em docs/features/[nome].md
4. Verificar API reference em docs/api-reference.md (se aplicável)
5. Verificar modelo de dados em docs/data-models.md (se aplicável)
6. SÓ ENTÃO começar a implementação
```

### 2. Mapeamento de Termos

Use `docs/feature-mapping.md` para converter termos do usuário em features:

| Se o usuário menciona | Consulte |
|----------------------|----------|
| "agendamento", "appointment", "consulta" | `docs/features/agendamento.md` |
| "agenda", "schedule", "disponibilidade" | `docs/features/agenda.md` |
| "cliente", "paciente" | `docs/features/cliente.md` |
| "notificação", "whatsapp" | `docs/features/notificacoes.md` |
| "relatório", "analytics" | `docs/features/relatorios.md` |
| "plano", "assinatura" | `docs/features/planos.md` |
| "configuração", "settings" | `docs/features/configuracoes.md` |
| "serviço", "procedimento" | `docs/features/servicos.md` |
| "profissional", "equipe" | `docs/features/profissionais.md` |
| "login", "cadastro" | `docs/features/autenticacao.md` |
| "booking", "link público" | `docs/features/booking.md` |

### 3. Estrutura de Arquivos

Cada documentação de feature contém:

```markdown
## 📍 Localização no Código
### Páginas - rotas Next.js
### Componentes - componentes React
### APIs - endpoints REST

## 🎯 Funcionalidades
- Descrição completa do que a feature faz

## 🗄️ Modelo de Dados
- Schema Prisma relacionado

## 💻 Exemplos de Uso
- Code snippets práticos

## 🔐 Permissões
- Regras por role (Master/Professional)

## 🎯 Casos de Uso
- Fluxos completos
```

## 🚨 Regras Críticas

### ❌ NUNCA faça:
1. ~~Implementar sem consultar docs/features/~~
2. ~~Criar nova API sem verificar se já existe em api-reference.md~~
3. ~~Modificar schema Prisma sem verificar data-models.md~~
4. ~~Assumir estrutura de arquivos sem consultar feature-mapping.md~~

### ✅ SEMPRE faça:
1. ✓ Leia a documentação da feature ANTES de implementar
2. ✓ Use os padrões já estabelecidos no código existente
3. ✓ Siga a mesma estrutura de arquivos das features similares
4. ✓ Mantenha consistência com APIs e modelos existentes
5. ✓ Atualize a documentação se adicionar algo novo

## 📁 Arquivos de Referência Rápida

### Visão Geral
- `docs/README.md` - Índice de toda documentação
- `docs/architecture-overview.md` - Arquitetura do sistema
- `docs/feature-mapping.md` - **Mapeamento rápido** (USE SEMPRE)

### Features
- `docs/features/dashboard.md`
- `docs/features/agendamento.md`
- `docs/features/agenda.md`
- `docs/features/cliente.md`
- `docs/features/notificacoes.md`
- `docs/features/relatorios.md`
- `docs/features/planos.md`
- `docs/features/configuracoes.md`
- `docs/features/servicos.md`
- `docs/features/profissionais.md`
- `docs/features/autenticacao.md`
- `docs/features/booking.md`
- `docs/features/whatsapp.md`

### Referências Técnicas
- `docs/api-reference.md` - Todos os endpoints
- `docs/data-models.md` - Todos os modelos Prisma

## 🔄 Workflow de Implementação

```
REQUEST RECEBIDO
    ↓
[1] Ler feature-mapping.md
    ↓ (identificar feature)
[2] Ler docs/features/[feature].md
    ↓ (entender contexto completo)
[3] Verificar api-reference.md (se criar/usar API)
    ↓
[4] Verificar data-models.md (se modificar banco)
    ↓
[5] Seguir architecture-standards.md e coding-standards.md
    ↓
[6] Implementar conforme padrões
    ↓
[7] Testar conforme testing-standards.md
    ↓
[8] Atualizar documentação (se necessário)
```

## 🎯 Exemplos Práticos

### Exemplo 1: "Adicionar campo CPF ao cliente"
```
1. Consultar: docs/feature-mapping.md → Cliente
2. Ler: docs/features/cliente.md
   - Ver modelo atual
   - Ver validações existentes
3. Ler: docs/data-models.md
   - Verificar schema do Client
   - Ver que CPF já existe!
   - @@unique([cpf, userId])
4. Verificar código: app/api/clients/
5. Constatar que campo já existe, apenas não estava sendo usado no frontend
6. Implementar UI para CPF (seguindo padrão)
```

### Exemplo 2: "Criar notificação de lembrete"
```
1. Consultar: docs/feature-mapping.md → Notificações
2. Ler: docs/features/notificacoes.md
   - Ver tipos existentes: APPOINTMENT_REMINDER já existe!
   - Ver templates de mensagem
   - Ver automações (cron job)
3. Ler: docs/data-models.md
   - Verificar enum NotificationType
4. Verificar: app/api/whatsapp/
5. Implementar seguindo padrão existente
```

## 📍 Localização no Código

### Mapeamento Prático
- **Agendamentos**: `app/dashboard/appointments/`, `app/api/appointments/`
- **Agendas**: `app/dashboard/schedules/`, `app/api/schedules/`, `components/agenda/`
- **Clientes**: `app/dashboard/clients/`, `app/api/clients/`
- **Notificações**: `app/dashboard/notifications/`, `app/api/notifications/`
- **Relatórios**: `app/dashboard/reports/`, `app/api/reports/`
- **Planos**: `app/dashboard/plans/`, `app/api/stripe/`
- **Configurações**: `app/dashboard/settings/`, `app/api/settings/`
- **Serviços**: `app/dashboard/services/`, `app/api/services/`
- **Profissionais**: `app/dashboard/professionals/`, `app/api/professionals/`
- **Booking**: `app/booking/[slug]/`, `app/api/booking/`
- **WhatsApp**: `app/api/whatsapp/`

## 💡 Dicas de Eficiência

1. **Use Ctrl+F na documentação** para encontrar termos específicos rapidamente
2. **Consulte feature-mapping.md PRIMEIRO** - economiza tempo
3. **Veja os "Exemplos de Uso"** na documentação - eles têm código pronto
4. **Casos de Uso** mostram fluxos completos - use como referência
5. **API Reference** tem todos os contratos - evita duplicação

## ⚠️ Avisos Importantes

### Ao modificar Schema Prisma
- Sempre consulte `docs/data-models.md` antes
- Verifique relacionamentos existentes
- Considere impacto em outras features
- Execute migration após alteração

### Ao criar Nova API
- Verifique `docs/api-reference.md` se já existe
- Siga padrão de resposta estabelecido
- Adicione à api-reference.md ao criar
- Use validação com Zod

### Ao criar Novo Componente
- Veja componentes similares em `components/`
- Use Shadcn/UI como base (`components/ui/`)
- Mantenha consistência de estilo
- Prefira reutilização à criação

---

**Regra de Ouro**: Se você não consultou a documentação antes de implementar, você está fazendo errado. 🚨
