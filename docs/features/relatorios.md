# Relatórios - Analytics e Estatísticas

## 📋 Descrição

Sistema de relatórios e analytics para visualização de métricas de negócio, performance e insights.

## 📍 Localização no Código

### Páginas
- **Relatórios**: `/dashboard/reports` → `app/dashboard/reports/page.tsx`

### APIs
- `GET /api/reports` - Relatório geral
- `GET /api/reports/appointments` - Relatório de agendamentos
- `GET /api/reports/revenue` - Relatório de receita
- `GET /api/reports/clients` - Relatório de clientes
- `GET /api/reports/professionals` - Relatório por profissional
- `GET /api/reports/services` - Relatório por serviço
- `POST /api/reports/export` - Exportar relatório

## 🎯 Funcionalidades

### Tipos de Relatório

#### 1. Relatório de Agendamentos
```typescript
interface AppointmentsReport {
  period: { start: Date; end: Date }
  
  summary: {
    total: number
    scheduled: number
    confirmed: number
    completed: number
    cancelled: number
    noShow: number
  }
  
  byStatus: Record<AppointmentStatus, number>
  byDay: Array<{ date: string; count: number }>
  byHour: Array<{ hour: number; count: number }>
  byProfessional: Array<{ name: string; count: number }>
  byService: Array<{ name: string; count: number }>
  
  trends: {
    weekOverWeek: number  // % mudança
    monthOverMonth: number
  }
}
```

#### 2. Relatório de Receita
```typescript
interface RevenueReport {
  period: { start: Date; end: Date }
  
  summary: {
    total: number
    average: number
    projected: number  // Baseado em agendamentos futuros
  }
  
  byService: Array<{
    serviceName: string
    count: number
    total: number
    average: number
  }>
  
  byProfessional: Array<{
    professionalName: string
    total: number
    count: number
  }>
  
  byMonth: Array<{
    month: string
    revenue: number
  }>
  
  trends: {
    growthRate: number  // Taxa de crescimento (%)
  }
}
```

#### 3. Relatório de Clientes
```typescript
interface ClientsReport {
  period: { start: Date; end: Date }
  
  summary: {
    total: number
    new: number
    returning: number
    active: number  // Com agendamento nos últimos 30 dias
  }
  
  retention: {
    rate: number  // Taxa de retorno (%)
    churnRate: number  // Taxa de abandono (%)
  }
  
  byAcquisition: Array<{
    month: string
    newClients: number
  }>
  
  topClients: Array<{
    name: string
    appointmentsCount: number
    totalSpent: number
  }>
}
```

#### 4. Relatório por Profissional
```typescript
interface ProfessionalReport {
  professionalId: string
  period: { start: Date; end: Date }
  
  summary: {
    appointmentsCount: number
    completedCount: number
    cancelledCount: number
    noShowCount: number
    revenue: number
  }
  
  performance: {
    completionRate: number  // Taxa de conclusão (%)
    cancellationRate: number
    noShowRate: number
    averageRating?: number  // Se houver avaliações
  }
  
  availability: {
    totalHours: number
    bookedHours: number
    utilizationRate: number  // % ocupação
  }
}
```

### Filtros Disponíveis
- **Período**: Hoje, Semana, Mês, Ano, Customizado
- **Profissional**: Todos ou específico
- **Serviço**: Todos ou específico
- **Status**: Filtrar por status de agendamento
- **Modalidade**: Presencial, Teleconsulta ou ambos

### Visualizações
- **Gráficos de linha**: Tendências ao longo do tempo
- **Gráficos de barras**: Comparações
- **Gráficos de pizza**: Distribuição percentual
- **Tabelas**: Dados detalhados
- **Cards de métricas**: KPIs principais

### Exportação
- **PDF**: Relatório formatado
- **CSV**: Dados brutos para análise
- **Excel**: Planilha com múltiplas abas

## 💻 Exemplos de Uso

### Buscar Relatório de Agendamentos
```typescript
async function getAppointmentsReport(filters: ReportFilters) {
  const params = new URLSearchParams({
    startDate: filters.startDate.toISOString(),
    endDate: filters.endDate.toISOString(),
    professionalId: filters.professionalId || '',
    serviceId: filters.serviceId || '',
  })
  
  const response = await fetch(`/api/reports/appointments?${params}`)
  return response.json()
}
```

### Exportar Relatório
```typescript
async function exportReport(type: 'pdf' | 'csv' | 'excel', data: ReportData) {
  const response = await fetch('/api/reports/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      reportType: 'appointments',
      data,
    }),
  })
  
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `relatorio-${Date.now()}.${type}`
  a.click()
}
```

## 🎨 Interface

### Página de Relatórios
```tsx
<ReportsPage>
  <Header>
    <h1>Relatórios</h1>
    <PeriodSelector onChange={handlePeriodChange} />
  </Header>
  
  <Tabs>
    <Tab value="overview">Visão Geral</Tab>
    <Tab value="appointments">Agendamentos</Tab>
    <Tab value="revenue">Receita</Tab>
    <Tab value="clients">Clientes</Tab>
    <Tab value="professionals">Profissionais</Tab>
  </Tabs>
  
  <Filters>
    <Select label="Profissional" options={professionals} />
    <Select label="Serviço" options={services} />
    <Button onClick={handleExport}>Exportar</Button>
  </Filters>
  
  <ReportContent>
    <MetricsGrid>
      <MetricCard title="Total" value={data.summary.total} />
      <MetricCard title="Receita" value={formatCurrency(data.summary.revenue)} />
      {/* ... */}
    </MetricsGrid>
    
    <ChartsGrid>
      <LineChart data={data.byDay} title="Agendamentos por Dia" />
      <BarChart data={data.byService} title="Por Serviço" />
      <PieChart data={data.byStatus} title="Por Status" />
    </ChartsGrid>
    
    <DataTable data={data.details} />
  </ReportContent>
</ReportsPage>
```

## 🔐 Permissões

### Master
- Acesso a todos os relatórios
- Exportação ilimitada
- Visualização de toda a equipe

### Profissional
- Apenas seus próprios relatórios
- Exportação limitada
- Dados agregados ocultos

## 🎯 Casos de Uso

### 1. Análise Mensal de Performance
**Fluxo**:
1. Master acessa relatórios
2. Seleciona período "Mês Anterior"
3. Visualiza métricas principais
4. Compara com mês anterior
5. Identifica tendências
6. Exporta PDF para apresentação

### 2. Avaliação de Profissional
**Fluxo**:
1. Seleciona relatório "Por Profissional"
2. Escolhe profissional específico
3. Analisa taxa de conclusão
4. Verifica taxa de no-show
5. Compara com média da equipe
6. Define metas de melhoria

### 3. Identificar Serviços Populares
**Fluxo**:
1. Acessa relatório de receita
2. Ordena por "Total"
3. Identifica top 3 serviços
4. Analisa margem de cada um
5. Decide estratégia de precificação

## 📊 KPIs Principais

### Operacionais
- Taxa de ocupação (%)
- Taxa de conclusão (%)
- Taxa de no-show (%)
- Tempo médio de atendimento

### Financeiros
- Receita total
- Receita média por agendamento
- Ticket médio
- Crescimento mês a mês (%)

### Clientes
- Total de clientes
- Novos clientes
- Taxa de retorno (%)
- Lifetime value (LTV)

## 🚀 Melhorias Futuras

- [ ] Relatórios personalizados (criar próprio)
- [ ] Agendamento de relatórios (envio automático)
- [ ] Comparação com benchmarks do setor
- [ ] Previsões com machine learning
- [ ] Dashboards interativos
- [ ] Integração com Google Analytics
- [ ] Alertas automáticos (KPI abaixo da meta)
- [ ] Relatórios em tempo real
