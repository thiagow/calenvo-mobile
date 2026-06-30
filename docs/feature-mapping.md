# Feature Mapping - Guia Rápido de Navegação


Este documento mapeia termos e conceitos para as funcionalidades e arquivos do sistema, facilitando a navegação do agente.

## 🗺️ Mapeamento de Termos → Features

| Termo / Conceito | Feature Principal | Documentação | Arquivos-chave |
|------------------|-------------------|--------------|----------------|
| Agendamento, Appointment, Consulta, Atendimento | Agendamento | [agendamento.md](./features/agendamento.md) | `app/dashboard/appointments/`, `app/api/appointments/` |
| Agenda, Schedule, Calendário, Disponibilidade | Agenda | [agenda.md](./features/agenda.md) | `app/dashboard/schedules/`, `app/api/schedules/`, `components/agenda/` |
| Cliente, Paciente, Patient | Cliente | [cliente.md](./features/cliente.md) | `app/dashboard/patients/`, `app/api/clients/` |
| Notificação, Sino, WhatsApp | Notificações | [notificacoes.md](./features/notificacoes.md) | `app/dashboard/notifications/`, `app/api/notifications/`, `app/api/whatsapp/` |
| Relatório, Analytics, Estatísticas, Métricas | Relatórios | [relatorios.md](./features/relatorios.md) | `app/dashboard/reports/`, `app/api/reports/` |
| Plano, Assinatura, Stripe, Pagamento | Planos | [planos.md](./features/planos.md) | `app/dashboard/plans/`, `app/api/stripe/` |
| Configuração, Settings, Preferências | Configurações | [configuracoes.md](./features/configuracoes.md) | `app/dashboard/settings/`, `app/api/settings/` |
| Serviço, Procedimento, Service | Serviços | [servicos.md](./features/servicos.md) | `app/dashboard/services/`, `app/api/services/` |
| Profissional, Equipe, Team | Profissionais | [profissionais.md](./features/profissionais.md) | `app/dashboard/professionals/`, `app/api/professionals/` |
| Login, Cadastro, Auth, Autenticação | Autenticação | [autenticacao.md](./features/autenticacao.md) | `app/login/`, `app/signup/`, `app/api/auth/`, `lib/auth.ts` |
| Booking, Agendamento Público, Link Público | Booking | [booking.md](./features/booking.md) | `app/booking/[slug]/`, `app/api/booking/` |
| Dashboard, Home, Visão Geral | Dashboard | [dashboard.md](./features/dashboard.md) | `app/dashboard/page.tsx`, `components/dashboard/` |

## 📂 Mapeamento de Fluxos → Localização

### Fluxo de Criação de Agendamento
```
1. Página: app/dashboard/appointments/new/page.tsx
2. API: app/api/appointments/route.ts (POST)
3. Validação: lib/validations/appointment.ts
4. Notificação: app/api/notifications/route.ts
5. WhatsApp Trigger: lib/whatsapp-trigger.ts
6. Evolution API Service: lib/evolution.ts
```

### Fluxo de Notificações WhatsApp
```
1. Configuração: app/dashboard/settings/notifications/page.tsx
2. Webhook: app/api/webhooks/evolution/route.ts
3. Trigger: lib/whatsapp-trigger.ts
4. Envio: n8n Webhook -> Evolution API
```

## 🎯 Mapeamento de Funcionalidades → APIs

| Funcionalidade | Endpoint Principal | Método | Documentação |
|----------------|-------------------|--------|--------------|
| Listar agendamentos | `/api/appointments` | GET | [api-reference.md](./api-reference.md#appointments) |
| Criar agendamento | `/api/appointments` | POST | [api-reference.md](./api-reference.md#appointments) |
| Config WhatsApp | `/app/actions/whatsapp.ts` | Server Action | [whatsapp.md](./features/whatsapp.md) |
| Webhook Evolution | `/api/webhooks/evolution` | POST | [whatsapp.md](./features/whatsapp.md) |
| Criar agenda | `/api/schedules` | POST | [api-reference.md](./api-reference.md#schedules) |
| Listar clientes | `/api/clients` | GET | [api-reference.md](./api-reference.md#clients) |
| Enviar WhatsApp | `/api/whatsapp/send` | POST | [api-reference.md](./api-reference.md#whatsapp) |
| Gerar relatório | `/api/reports/appointments` | GET | [api-reference.md](./api-reference.md#reports) |
| Atualizar plano | `/api/stripe/checkout` | POST | [api-reference.md](./api-reference.md#stripe) |
| Criar profissional | `/api/professionals` | POST | [api-reference.md](./api-reference.md#professionals) |
| Booking público | `/api/booking/[slug]/appointment` | POST | [api-reference.md](./api-reference.md#booking) |

## 🗃️ Mapeamento de Entidades → Modelos

| Entidade | Model Prisma | Schema | Documentação |
|----------|--------------|--------|--------------|
| Usuário (Master/Professional) | `User` | UserRole enum | [data-models.md](./data-models.md#user) |
| Cliente | `Client` | - | [data-models.md](./data-models.md#client) |
| Agendamento | `Appointment` | AppointmentStatus enum | [data-models.md](./data-models.md#appointment) |
| Agenda | `Schedule` | - | [data-models.md](./data-models.md#schedule) |
| Serviço | `Service` | - | [data-models.md](./data-models.md#service) |
| Notificação | `Notification` | NotificationType enum | [data-models.md](./data-models.md#notification) |
| Config do Negócio | `BusinessConfig` | SegmentType enum | [data-models.md](./data-models.md#businessconfig) |
| Uso do Plano | `PlanUsage` | PlanType enum | [data-models.md](./data-models.md#planusage) |
| Config WhatsApp | `WhatsAppConfig` | - | [data-models.md](./data-models.md#whatsappconfig) |

## 🧩 Mapeamento de Componentes → Features

| Componente | Feature | Localização |
|------------|---------|-------------|
| `dashboard-overview.tsx` | Dashboard | `components/dashboard/` |
| `appointments-list.tsx` | Dashboard / Agendamento | `components/dashboard/` |
| `agenda-*-view.tsx` | Agenda | `components/agenda/` |
| `edit-appointment-dialog.tsx` | Agendamento | `components/agenda/` |
| `whatsapp-connection.tsx` | Notificações | `app/dashboard/settings/notifications/_components/` |
| `notification-settings.tsx` | Notificações | `app/dashboard/settings/notifications/_components/` |
| UI components | Todos | `components/ui/` (Shadcn) |

## 🎨 Estilos por Feature

| Feature | Estilo Principal | Cor Primária |
|---------|------------------|--------------|
| Agendamento | Cards com status | Azul (#3B82F6) |
| Agenda | Grid de horários | Verde (#10B981) |
| Notificações | Badge com contador | Vermelho (#EF4444) |
| Dashboard | Cards de métricas | Múltiplas |

## 📋 Checklists Rápidos

### Ao implementar nova feature
```
☐ Criar modelo no Prisma (se necessário)
☐ Criar API routes
☐ Criar componentes de UI
☐ Criar página (se necessário)
☐ Adicionar validações
☐ Adicionar permissões
☐ Documentar em docs/features/
☐ Atualizar api-reference.md
☐ Atualizar data-models.md (se aplicável)
☐ Atualizar este arquivo (feature-mapping.md)
```

### Ao debugar um problema
```
1. Identifique a feature pelo termo/conceito
2. Consulte a documentação da feature
3. Verifique o mapeamento de arquivos neste documento
4. Verifique a API reference
5. Verifique o modelo de dados (se relacionado ao banco)
6. Consulte o código nos arquivos identificados
```

## 🔍 Busca Rápida por Palavra-chave

| Keyword | Onde procurar |
|---------|---------------|
| "horário", "disponível", "slot" | Agenda ([agenda.md](./features/agenda.md)) |
| "confirmar", "cancelar", "status" | Agendamento ([agendamento.md](./features/agendamento.md)) |
| "mensagem", "Evolution API", "QR Code" | WhatsApp ([whatsapp.md](./features/whatsapp.md)) |
| "plano", "limite", "upgrade", "Stripe" | Planos ([planos.md](./features/planos.md)) |
| "receita", "gráfico", "KPI" | Relatórios ([relatorios.md](./features/relatorios.md)) |
| "login", "senha", "session" | Autenticação ([autenticacao.md](./features/autenticacao.md)) |
| "slug", "público", "link" | Booking ([booking.md](./features/booking.md)) |

## 🚀 Casos de Uso Comuns

### "Preciso adicionar um novo status de agendamento"
```
1. Editar: prisma/schema.prisma (enum AppointmentStatus)
2. Migração: npx prisma migrate dev
3. Atualizar: docs/data-models.md
4. Atualizar lógica em: app/api/appointments/
5. Atualizar UI em: components/agenda/
```

### "Preciso criar um novo tipo de notificação"
```
1. Editar: prisma/schema.prisma (enum NotificationType)
2. Migração: npx prisma migrate dev
3. Criar template em: app/api/notifications/ ou app/api/whatsapp/
4. Documentar em: docs/features/notificacoes.md
```

### "Cliente quer personalizar a página de booking"
```
1. Consultar: docs/features/booking.md
2. Editar configurações em: app/dashboard/settings/
3. Modelo: BusinessConfig (publicUrl, businessLogo, etc)
4. Página: app/booking/[slug]/page.tsx
```

## 📞 Suporte e Referências

- **Dúvidas de Arquitetura**: [architecture-overview.md](./architecture-overview.md)
- **Dúvidas de API**: [api-reference.md](./api-reference.md)
- **Dúvidas de Dados**: [data-models.md](./data-models.md)
- **Dúvidas de Features**: `docs/features/*.md`

---

**Última atualização**: Janeiro 2026  
**Versão**: 1.0
