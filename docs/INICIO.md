# Contexto do Projeto Calenvo - LEIAME PRIMEIRO

> **Atenção Agente**: Este é o documento de entrada. Leia-o SEMPRE antes de implementar qualquer funcionalidade.

## 🎯 O que é o Calenvo App?

Sistema de **agendamento e gestão** multi-segmento (salões, clínicas, consultorias), construído com:
- **Next.js 14** (App Router)
- **Prisma** (PostgreSQL)
- **NextAuth.js** (Autenticação)
- **Stripe** (Pagamentos)
- **Evolution API** (WhatsApp)

## 📚 Documentação Completa

### 📖 Documentos Principais (LEIA ANTES DE IMPLEMENTAR)

1. **[feature-mapping.md](./feature-mapping.md)** ⭐ **COMECE AQUI**
   - Mapeamento de termos → features → arquivos
   - Guia de navegação rápida
   - Checklists e fluxos

2. **[architecture-overview.md](./architecture-overview.md)**
   - Stack tecnológica
   - Estrutura de diretórios
   - Padrões de arquitetura

3. **[api-reference.md](./api-reference.md)**
   - Todos os endpoints REST
   - Request/Response schemas
   - Query params e bodies

4. **[data-models.md](./data-models.md)**
   - Schema Prisma completo
   - Relacionamentos
   - Enums e validações

### 🎯 Features Documentadas

Cada feature tem documentação completa em `docs/features/`:

| Feature | Arquivo | O que faz |
|---------|---------|-----------|
| **Dashboard** | [dashboard.md](./features/dashboard.md) | Visão geral, métricas, home |
| **Agendamento** | [agendamento.md](./features/agendamento.md) | CRUD de appointments, status, filtros |
| **Agenda** | [agenda.md](./features/agenda.md) | Configuração de schedules, disponibilidade, bloqueios |
| **Cliente** | [cliente.md](./features/cliente.md) | Gestão de clientes/pacientes |
| **Notificações** | [notificacoes.md](./features/notificacoes.md) | Sistema interno + WhatsApp |
| **Relatórios** | [relatorios.md](./features/relatorios.md) | Analytics, KPIs, exportação |
| **Planos** | [planos.md](./features/planos.md) | Assinaturas, limites, Stripe |
| **Configurações** | [configuracoes.md](./features/configuracoes.md) | Settings do negócio |
| **Serviços** | [servicos.md](./features/servicos.md) | Catálogo de serviços/procedimentos |
| **Profissionais** | [profissionais.md](./features/profissionais.md) | Gestão de equipe |
| **Autenticação** | [autenticacao.md](./features/autenticacao.md) | Login, cadastro, sessões |
| **Booking** | [booking.md](./features/booking.md) | Agendamento público (cliente) |
| **WhatsApp** | [whatsapp.md](./features/whatsapp.md) | Integração Evolution API |

## 🚀 Workflow Obrigatório

### Quando receber uma solicitação:

```
1️⃣ Identifique o termo/conceito na solicitação
   (ex: "adicionar agendamento", "listar clientes")

2️⃣ Consulte feature-mapping.md
   → Encontre a feature correspondente
   → Veja os arquivos relacionados

3️⃣ Leia docs/features/[feature].md
   → Entenda o contexto completo
   → Veja padrões existentes
   → Identifique APIs e modelos

4️⃣ Se necessário, consulte:
   → api-reference.md (para APIs)
   → data-models.md (para banco de dados)
   → architecture-overview.md (para padrões)

5️⃣ Implemente seguindo:
   → .agent/rules/architecture-standards.md
   → .agent/rules/coding-standards.md
   → Padrões da feature existente

6️⃣ Teste conforme:
   → .agent/rules/testing-standards.md
```

## 📂 Estrutura Rápida

```
calenvoapp/
├── docs/                     ← VOCÊ ESTÁ AQUI
│   ├── README.md            ← Este arquivo
│   ├── feature-mapping.md   ← **COMECE AQUI**
│   ├── architecture-overview.md
│   ├── api-reference.md
│   ├── data-models.md
│   └── features/            ← Documentação de cada feature
│       ├── dashboard.md
│       ├── agendamento.md
│       ├── agenda.md
│       └── ...
│
├── app/                     ← Rotas Next.js e APIs
│   ├── api/                 ← Backend (REST endpoints)
│   ├── dashboard/           ← Páginas protegidas
│   ├── booking/             ← Página pública
│   └── ...
│
├── components/              ← Componentes React
│   ├── ui/                  ← Shadcn/UI (base)
│   ├── agenda/              ← Visualizações de agenda
│   ├── dashboard/           ← Dashboard components
│   └── ...
│
├── prisma/                  ← Banco de dados
│   └── schema.prisma        ← Schema completo
│
├── lib/                     ← Utilitários e configs
│   ├── auth.ts              ← NextAuth config
│   ├── prisma.ts            ← Prisma client
│   └── ...
│
└── .agent/                  ← Regras do agente
    ├── rules/               ← Standards e protocols
    └── workflows/           ← Workflows pré-definidos
```

## 🎯 Casos de Uso Comuns

### "Preciso modificar/adicionar funcionalidade em agendamentos"
```
1. Leia: docs/feature-mapping.md (busque "agendamento")
2. Leia: docs/features/agendamento.md
3. Veja arquivos: app/dashboard/appointments/, app/api/appointments/
4. Implemente seguindo padrões existentes
```

### "Preciso criar um novo endpoint de API"
```
1. Verifique: docs/api-reference.md (endpoint já existe?)
2. Se não existir:
   - Veja padrões em api-reference.md
   - Siga architecture-standards.md
   - Adicione à api-reference.md ao criar
```

### "Preciso modificar o banco de dados"
```
1. Leia: docs/data-models.md
2. Verifique relacionamentos existentes
3. Edite: prisma/schema.prisma
4. Execute: npx prisma migrate dev
5. Atualize: docs/data-models.md
```

### "Não sei onde fica X no código"
```
1. Abra: docs/feature-mapping.md
2. Use Ctrl+F para buscar o termo
3. Veja a tabela "Mapeamento de Termos → Features"
4. Navegue para os arquivos indicados
```

## 🔥 Atalhos Importantes

| Preciso de... | Vá para... |
|---------------|------------|
| **Mapeamento rápido** | `docs/feature-mapping.md` |
| **Listar todas as APIs** | `docs/api-reference.md` |
| **Ver modelo de dados** | `docs/data-models.md` |
| **Entender arquitetura** | `docs/architecture-overview.md` |
| **Documentação de feature** | `docs/features/[nome].md` |
| **Regras de código** | `.agent/rules/coding-standards.md` |
| **Regras de arquitetura** | `.agent/rules/architecture-standards.md` |

## ⚠️ Regras de Ouro

### ❌ NUNCA:
1. ~~Implementar sem ler a documentação da feature~~
2. ~~Criar API sem verificar se já existe~~
3. ~~Modificar schema sem consultar data-models.md~~
4. ~~Assumir localização de arquivos~~

### ✅ SEMPRE:
1. ✓ Comece por **feature-mapping.md**
2. ✓ Leia a documentação da feature ANTES de implementar
3. ✓ Siga os padrões existentes no código
4. ✓ Consulte api-reference.md para APIs
5. ✓ Consulte data-models.md para banco de dados

## 🎨 Padrões do Projeto

### Stack
- **Frontend**: React 18, Next.js 14 (App Router), Tailwind CSS, Shadcn/UI
- **Backend**: Next.js API Routes, Server Actions
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js (Credentials Provider)
- **Payments**: Stripe
- **Messaging**: Evolution API (WhatsApp)

### Convenções
- **Arquivos**: kebab-case (`dashboard-header.tsx`)
- **Componentes**: PascalCase (`DashboardHeader`)
- **Funções**: camelCase (`getUserData`)
- **Constantes**: UPPER_SNAKE_CASE (`API_BASE_URL`)

### Server vs Client
- **Server Components**: Padrão (fetching, metadata)
- **Client Components**: `"use client"` (interatividade, hooks)
- **Server Actions**: Preferidos para mutations

## 📊 Hierarquia de Dados

```
User (Master)
├── BusinessConfig           (1:1)
├── PlanUsage               (1:1)
├── WhatsAppConfig          (1:1)
├── Schedule[]              (1:N)
│   ├── ScheduleService[]   (N:N com Service)
│   ├── ScheduleProfessional[] (N:N com Professional)
│   └── Appointment[]       (1:N)
├── Service[]               (1:N)
├── Client[]                (1:N)
│   └── Appointment[]       (1:N)
├── Professional[]          (1:N)
└── Notification[]          (1:N)
```

## 🎯 Próximos Passos

1. **Se é sua primeira vez**: Leia `architecture-overview.md`
2. **Se vai implementar algo**: Leia `feature-mapping.md` → `features/[nome].md`
3. **Se vai usar API**: Leia `api-reference.md`
4. **Se vai mexer no banco**: Leia `data-models.md`

---

**Lembre-se**: Esta documentação existe para economizar seu tempo e garantir consistência. Use-a! 🚀

**Última atualização**: Janeiro 2026
