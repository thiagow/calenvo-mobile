# Documentação de Contexto - Calenvo App

> 🚀 **Novo aqui?** Comece por **[INICIO.md](./INICIO.md)** - Guia rápido com tudo que você precisa saber!

## 📖 Visão Geral

Esta pasta contém a documentação de contexto completa das funcionalidades existentes na aplicação Calenvo. O objetivo é facilitar a navegação, compreensão e manutenção das features do sistema.

## 📂 Estrutura de Documentação

- **[architecture-overview.md](./architecture-overview.md)** - Visão geral da arquitetura e organização do código
- **[features/](./features/)** - Documentação detalhada de cada funcionalidade
  - [dashboard.md](./features/dashboard.md) - Dashboard e visão geral
  - [agendamento.md](./features/agendamento.md) - Sistema de agendamentos (Appointments)
  - [agenda.md](./features/agenda.md) - Sistema de agendas (Schedules)
  - [cliente.md](./features/cliente.md) - Gestão de clientes
  - [notificacoes.md](./features/notificacoes.md) - Sistema de notificações
  - [relatorios.md](./features/relatorios.md) - Relatórios e estatísticas
  - [planos.md](./features/planos.md) - Gestão de planos e assinaturas
  - [configuracoes.md](./features/configuracoes.md) - Configurações do sistema
  - [servicos.md](./features/servicos.md) - Gestão de serviços
  - [profissionais.md](./features/profissionais.md) - Gestão de profissionais
  - [autenticacao.md](./features/autenticacao.md) - Sistema de autenticação
  - [booking.md](./features/booking.md) - Agendamento público
  - [whatsapp.md](./features/whatsapp.md) - Integração WhatsApp
- **[data-models.md](./data-models.md)** - Modelos de dados e relacionamentos
- **[api-reference.md](./api-reference.md)** - Referência de APIs e endpoints

## 🎯 Como Usar Esta Documentação

### Para Desenvolvedores
1. **Entender uma funcionalidade**: Acesse o arquivo correspondente em `features/`
2. **Compreender o modelo de dados**: Consulte `data-models.md`
3. **Verificar APIs disponíveis**: Use `api-reference.md`

### Para o Agente
- Ao receber uma solicitação de implementação/ajuste, consulte primeiro o arquivo relevante em `features/`
- Verifique os padrões definidos em `.agent/rules/`
- Siga os workflows definidos em `.agent/workflows/`

## 🔗 Navegação Rápida por Cenário

| Cenário | Arquivo Principal | Componentes | APIs |
|---------|------------------|-------------|------|
| Dashboard | [dashboard.md](./features/dashboard.md) | `components/dashboard/` | `/api/dashboard`, `/api/stats` |
| Agendamentos | [agendamento.md](./features/agendamento.md) | `components/agenda/` | `/api/appointments` |
| Agendas | [agenda.md](./features/agenda.md) | `components/schedule/` | `/api/schedules` |
| Clientes | [cliente.md](./features/cliente.md) | - | `/api/clients` |
| Notificações | [notificacoes.md](./features/notificacoes.md) | `components/notifications/` | `/api/notifications` |
| Relatórios | [relatorios.md](./features/relatorios.md) | - | `/api/reports` |
| Planos | [planos.md](./features/planos.md) | - | `/api/stripe` |
| Configurações | [configuracoes.md](./features/configuracoes.md) | `components/settings/` | `/api/settings` |

## 📝 Convenções

- Todos os arquivos usam **Markdown** para formatação
- Exemplos de código incluem **sintaxe destacada**
- Links internos facilitam a navegação entre documentos
- Cada feature documenta: Descrição, Componentes, APIs, Fluxos e Casos de uso
