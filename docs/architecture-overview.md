# Visão Geral da Arquitetura - Calenvo App

## 🏗️ Stack Tecnológica

### Frontend
- **Framework**: Next.js 14.2 (App Router)
- **Linguagem**: TypeScript 5.2
- **UI Library**: React 18+
- **Estilização**: Tailwind CSS + Shadcn/UI
- **Gerenciamento de Estado**: 
  - Zustand (estado global)
  - Jotai (estado atômico)
  - React Query (data fetching e caching)

### Backend
- **Runtime**: Node.js 20.x+
- **API**: Next.js API Routes (REST)
- **ORM**: Prisma
- **Banco de Dados**: PostgreSQL
- **Autenticação**: NextAuth.js

### Integrações
- **WhatsApp**: Evolution API
- **Pagamentos**: Stripe
- **Storage**: AWS S3 (upload de arquivos)

## 📂 Estrutura de Diretórios

```
calenvoapp/
│
├── .agent/                          # Configurações do agente AI
│   ├── rules/                       # Regras de desenvolvimento
│   └── workflows/                   # Workflows pré-definidos
│
├── app/                             # Next.js App Router
│   ├── api/                         # Backend API Routes
│   │   ├── appointments/            # APIs de agendamentos
│   │   ├── auth/                    # Autenticação
│   │   ├── booking/                 # Agendamento público
│   │   ├── clients/                 # Gestão de clientes
│   │   ├── dashboard/               # Dados do dashboard
│   │   ├── notifications/           # Notificações
│   │   ├── professionals/           # Profissionais
│   │   ├── reports/                 # Relatórios
│   │   ├── schedules/               # Agendas
│   │   ├── services/                # Serviços
│   │   ├── settings/                # Configurações
│   │   ├── stats/                   # Estatísticas
│   │   ├── stripe/                  # Integração Stripe
│   │   ├── user/                    # Usuário
│   │   └── whatsapp/                # Integração WhatsApp
│   │
│   ├── dashboard/                   # Páginas do dashboard (protegidas)
│   │   ├── agenda/                  # Visualização de agenda
│   │   ├── appointments/            # Gerenciamento de agendamentos
│   │   ├── notifications/           # Central de notificações
│   │   ├── patients/                # Gestão de clientes (legado: patients)
│   │   ├── plans/                   # Planos e assinaturas
│   │   ├── professionals/           # Gestão de equipe
│   │   ├── profile/                 # Perfil do usuário
│   │   ├── reports/                 # Relatórios
│   │   ├── schedules/               # Configuração de agendas
│   │   ├── services/                # Configuração de serviços
│   │   ├── settings/                # Configurações gerais
│   │   ├── segment-settings/        # Configurações por segmento
│   │   └── specialties/             # Especialidades (legado)
│   │
│   ├── booking/[slug]/              # Página pública de agendamento
│   ├── login/                       # Página de login
│   ├── signup/                      # Fluxo de cadastro
│   ├── layout.tsx                   # Layout raiz
│   ├── page.tsx                     # Landing page
│   └── globals.css                  # Estilos globais
│
├── components/                      # Componentes React reutilizáveis
│   ├── ui/                          # Componentes base (Shadcn)
│   ├── agenda/                      # Componentes de visualização de agenda
│   ├── auth/                        # Componentes de autenticação
│   ├── dashboard/                   # Componentes do dashboard
│   ├── notifications/               # Componentes de notificações
│   ├── schedule/                    # Componentes de configuração de agendas
│   ├── settings/                    # Componentes de configurações
│   └── providers/                   # Context Providers
│
├── contexts/                        # React Context (estado global)
│
├── hooks/                           # Custom React Hooks
│   └── use-*.ts                     # Hooks customizados
│
├── lib/                             # Utilitários e lógica de negócio
│   ├── prisma.ts                    # Cliente Prisma
│   ├── auth.ts                      # Configuração NextAuth
│   ├── utils.ts                     # Funções utilitárias
│   └── ...                          # Outros módulos
│
├── prisma/                          # Configuração do banco de dados
│   ├── schema.prisma                # Schema do Prisma
│   └── migrations/                  # Migrações do banco
│
├── public/                          # Assets estáticos
│
├── scripts/                         # Scripts de automação
│   └── ...
│
├── docs/                            # Documentação (este diretório)
│
├── .env                             # Variáveis de ambiente (não versionado)
├── .env.example                     # Template de variáveis
├── next.config.js                   # Configuração Next.js
├── tailwind.config.ts               # Configuração Tailwind
├── tsconfig.json                    # Configuração TypeScript
└── package.json                     # Dependências do projeto
```

## 🎨 Padrões de Arquitetura

### 1. App Router (Next.js 14)
- **Server Components por padrão**: Componentes renderizados no servidor
- **Client Components**: Marcados com `"use client"` quando necessário (interatividade, hooks)
- **Server Actions**: Mutações de dados seguras no servidor

### 2. Separação de Responsabilidades

#### Camada de Apresentação (Components)
- Componentes reutilizáveis
- Lógica de UI
- Estados locais

#### Camada de Lógica (Hooks + Lib)
- Custom hooks para lógica reutilizável
- Utilitários e helpers
- Validações

#### Camada de Dados (API Routes + Prisma)
- Endpoints REST
- Validação de dados
- Acesso ao banco de dados
- Business logic

### 3. Design Patterns Utilizados

#### Repository Pattern
```typescript
// lib/repositories/appointment-repository.ts
export class AppointmentRepository {
  async findById(id: string) { }
  async create(data: AppointmentData) { }
  // ...
}
```

#### Adapter Pattern
```typescript
// Integração com serviços externos
// lib/adapters/whatsapp-adapter.ts
// lib/adapters/stripe-adapter.ts
```

#### Compound Components
```typescript
// Componentes complexos de UI
<Select>
  <Select.Trigger />
  <Select.Content>
    <Select.Item />
  </Select.Content>
</Select>
```

## 🔐 Fluxo de Autenticação

```
1. Usuário acessa /login
2. NextAuth autentica credenciais
3. Sessão criada e armazenada (JWT + Database)
4. Middleware protege rotas /dashboard/*
5. Server Components acessam sessão via getServerSession()
6. Client Components acessam via useSession()
```

## 🗄️ Modelo de Dados (Hierarquia)

```
User (Master)
├── BusinessConfig        # Configurações do negócio
├── PlanUsage            # Uso do plano
├── WhatsAppConfig       # Config WhatsApp
├── Schedules[]          # Agendas criadas
├── Services[]           # Serviços criados
├── Clients[]            # Clientes/pacientes
├── Appointments[]       # Agendamentos como master
├── Professionals[]      # Profissionais da equipe
└── Notifications[]      # Notificações

Schedule (Agenda)
├── Services[]           # Serviços vinculados
├── Professionals[]      # Profissionais vinculados
├── DayConfigs[]         # Configurações por dia
├── Blocks[]             # Bloqueios de período
└── Appointments[]       # Agendamentos desta agenda

Appointment (Agendamento)
├── User (Master)        # Dono da conta
├── Professional (User)  # Profissional responsável
├── Client               # Cliente
├── Schedule             # Agenda vinculada
├── Service              # Serviço vinculado
└── Notifications[]      # Notificações relacionadas
```

## 🚀 Fluxos Principais

### Fluxo de Agendamento (Cliente)
```
1. Cliente acessa /booking/[slug]
2. Seleciona serviço e profissional
3. Escolhe horário disponível
4. Preenche dados pessoais
5. Confirma agendamento
6. Sistema cria Appointment
7. Notificações são enviadas (interno + WhatsApp)
```

### Fluxo de Gestão (Dashboard)
```
1. Master/Professional faz login
2. Acessa dashboard
3. Visualiza agenda/appointments
4. Pode criar/editar/cancelar appointments
5. Pode gerenciar schedules e services
6. Pode configurar sistema
```

## 📱 Responsividade

- **Mobile-first**: Design otimizado para mobile
- **Breakpoints Tailwind**: 
  - sm: 640px
  - md: 768px
  - lg: 1024px
  - xl: 1280px
  - 2xl: 1536px

## 🔄 Estado e Cache

### Server State (React Query)
- Cache de dados do servidor
- Revalidação automática
- Otimistic updates

### Client State (Zustand/Jotai)
- Estado global leve
- Preferência de UI
- Estados temporários

### Server Session (NextAuth)
- Sessão do usuário
- Tokens de autenticação
- Dados persistentes

## 🧪 Convenções de Código

### Nomenclatura
- **Arquivos**: kebab-case (`dashboard-header.tsx`)
- **Componentes**: PascalCase (`DashboardHeader`)
- **Funções/variáveis**: camelCase (`getUserData`)
- **Constantes**: UPPER_SNAKE_CASE (`API_BASE_URL`)

### Organização de Imports
```typescript
// 1. React/Next
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 2. Bibliotecas externas
import { format } from 'date-fns'
import { z } from 'zod'

// 3. Componentes
import { Button } from '@/components/ui/button'

// 4. Hooks/Utils
import { useAppointments } from '@/hooks/use-appointments'
import { cn } from '@/lib/utils'

// 5. Types
import type { Appointment } from '@prisma/client'
```

## 🎯 Próximos Passos

Para entender funcionalidades específicas, consulte os documentos em `docs/features/`.
