# Dashboard - Visão Geral e Estatísticas

## 📋 Descrição

O Dashboard é a página inicial após o login, fornecendo uma visão consolidada de todas as atividades, métricas e acesso rápido às principais funções do sistema.

## 📍 Localização no Código

### Páginas
- **Rota**: `/dashboard`
- **Arquivo**: `app/dashboard/page.tsx`
- **Layout**: `app/dashboard/layout.tsx`

### Componentes
- `components/dashboard/dashboard-overview.tsx` - Visão geral com cards de métricas
- `components/dashboard/dashboard-header.tsx` - Cabeçalho do dashboard
- `components/dashboard/dashboard-sidebar.tsx` - Menu lateral
- `components/dashboard/dashboard-layout-client.tsx` - Layout wrapper client-side
- `components/dashboard/appointments-list.tsx` - Lista de agendamentos recentes

### APIs
- `GET /api/dashboard` - Dados gerais do dashboard
- `GET /api/stats` - Estatísticas e métricas

## 🎯 Funcionalidades

### Cards de Métricas
1. **Total de Agendamentos** (hoje/semana/mês)
2. **Taxa de Confirmação** (%)
3. **Receita Projetada** (R$)
4. **Agendamentos Pendentes**
5. **Taxa de No-Show** (%)
6. **Clientes Ativos**

### Widgets
- **Agenda do Dia**: Próximos agendamentos
- **Notificações Recentes**: Últimas 5 notificações
- **Gráfico de Agendamentos**: Visualização semanal/mensal
- **Ações Rápidas**: Botões para criar agendamento, cliente, etc.

### Acesso Rápido
```typescript
// Botões de ação rápida
- Novo Agendamento → /dashboard/appointments/new
- Novo Cliente → /dashboard/clients
- Ver Agenda → /dashboard/agenda
- Notificações → /dashboard/notifications
```

## 🔐 Permissões

### Usuário Master
- Visualiza todos os dados da conta
- Vê métricas consolidadas de toda equipe
- Acesso a todas as funcionalidades

### Profissional
- Visualiza apenas seus próprios dados
- Métricas limitadas aos seus agendamentos
- Acesso restrito às configurações

## 📊 Estrutura de Dados

### Response da API `/api/dashboard`
```typescript
interface DashboardData {
  stats: {
    totalAppointments: number          // Total de agendamentos do período
    confirmedAppointments: number      // Agendamentos confirmados
    cancelledAppointments: number      // Agendamentos cancelados
    revenue: number                    // Receita total
    activeClients: number              // Clientes ativos
    noShowRate: number                 // Taxa de falta (%)
  }
  
  recentAppointments: Appointment[]    // Últimos 10 agendamentos
  
  upcomingAppointments: Appointment[]  // Próximos agendamentos
  
  notifications: Notification[]        // Últimas 5 notificações
  
  chartData: {
    labels: string[]                   // Labels do gráfico (datas)
    datasets: {
      label: string
      data: number[]
      backgroundColor: string
    }[]
  }
}
```

### Response da API `/api/stats`
```typescript
interface StatsData {
  period: 'day' | 'week' | 'month' | 'year'
  
  appointments: {
    total: number
    confirmed: number
    pending: number
    cancelled: number
    completed: number
    noShow: number
  }
  
  revenue: {
    total: number
    average: number
    byService: Record<string, number>
  }
  
  clients: {
    total: number
    new: number
    returning: number
  }
  
  professionals: {
    total: number
    active: number
    appointmentsByPro: Record<string, number>
  }
}
```

## 💻 Exemplo de Uso

### Buscar Dados do Dashboard
```typescript
'use client'

import { useEffect, useState } from 'react'

export function DashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function fetchDashboard() {
      const response = await fetch('/api/dashboard')
      const data = await response.json()
      setData(data)
      setLoading(false)
    }
    
    fetchDashboard()
  }, [])
  
  if (loading) return <DashboardSkeleton />
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard 
        title="Total de Agendamentos" 
        value={data.stats.totalAppointments} 
      />
      <StatCard 
        title="Receita" 
        value={formatCurrency(data.stats.revenue)} 
      />
      {/* ... */}
    </div>
  )
}
```

## 🎨 Layout e Design

### Grid Responsivo
```tsx
<div className="grid gap-4">
  {/* Métricas - 4 colunas no desktop */}
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <StatCard />
  </div>
  
  {/* Conteúdo principal - 2 colunas */}
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
    {/* Agenda do dia - 4 colunas */}
    <div className="col-span-4">
      <AgendaDoDia />
    </div>
    
    {/* Notificações - 3 colunas */}
    <div className="col-span-3">
      <NotificacoesRecentes />
    </div>
  </div>
</div>
```

## 🔄 Atualização em Tempo Real

O dashboard utiliza polling ou websockets para atualização automática:

```typescript
// Polling a cada 30 segundos
useEffect(() => {
  const interval = setInterval(() => {
    fetchDashboardData()
  }, 30000)
  
  return () => clearInterval(interval)
}, [])
```

## 📱 Responsividade

- **Mobile**: Cards empilhados verticalmente, lista simplificada
- **Tablet**: Grid 2 colunas
- **Desktop**: Grid completo 4 colunas + layout de 2 colunas

## 🎯 Casos de Uso

### 1. Visão Rápida do Negócio
**Ator**: Master  
**Fluxo**:
1. Faz login
2. É redirecionado ao dashboard
3. Visualiza métricas principais
4. Identifica tendências (gráficos)
5. Acessa ações rápidas conforme necessário

### 2. Profissional Verifica Agenda
**Ator**: Profissional  
**Fluxo**:
1. Faz login
2. Visualiza dashboard com seus agendamentos
3. Vê próximos compromissos
4. Acessa agenda detalhada se necessário

### 3. Identificar Problemas
**Ator**: Master  
**Fluxo**:
1. Acessa dashboard
2. Observa alta taxa de no-show
3. Clica em "Ver Relatórios" para análise detalhada
4. Toma decisões baseadas nos dados

## 🔗 Navegação

### Do Dashboard para:
- `/dashboard/agenda` - Ver agenda completa
- `/dashboard/appointments` - Gerenciar todos os agendamentos
- `/dashboard/appointments/new` - Criar novo agendamento
- `/dashboard/clients` - Gerenciar clientes
- `/dashboard/reports` - Ver relatórios detalhados
- `/dashboard/notifications` - Central de notificações
- `/dashboard/settings` - Configurações do sistema

## 🚀 Melhorias Futuras

- [ ] Widgets customizáveis (drag & drop)
- [ ] Comparação com períodos anteriores
- [ ] Metas e objetivos
- [ ] Alertas personalizados
- [ ] Exportação de relatórios
- [ ] Integração com BI tools
