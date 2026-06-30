# Agendamento (Appointments) - Gestão de Agendamentos

## 📋 Descrição

Sistema completo de gerenciamento de agendamentos (appointments), permitindo criar, visualizar, editar e cancelar compromissos entre clientes e profissionais.

## 📍 Localização no Código

### Páginas
- **Listagem**: `/dashboard/appointments` → `app/dashboard/appointments/page.tsx`
- **Novo**: `/dashboard/appointments/new` → `app/dashboard/appointments/new/page.tsx`
- **Layout**: `app/dashboard/appointments/layout.tsx`

### Componentes
- `components/agenda/edit-appointment-dialog.tsx` - Modal de edição
- `components/dashboard/appointments-list.tsx` - Lista de agendamentos
- Componentes de agenda também exibem appointments (ver [agenda.md](./agenda.md))

### APIs
- `GET /api/appointments` - Listar agendamentos
- `GET /api/appointments/[id]` - Buscar agendamento específico
- `POST /api/appointments` - Criar novo agendamento
- `PUT /api/appointments/[id]` - Atualizar agendamento
- `DELETE /api/appointments/[id]` - Deletar agendamento
- `PATCH /api/appointments/[id]/status` - Atualizar status

## 🎯 Funcionalidades

### CRUD Completo
1. **Create**: Criar novo agendamento
2. **Read**: Visualizar detalhes e listagem
3. **Update**: Editar informações
4. **Delete**: Cancelar/deletar agendamento

### Gestão de Status
```typescript
enum AppointmentStatus {
  SCHEDULED    // Agendado (inicial)
  CONFIRMED    // Confirmado pelo cliente
  IN_PROGRESS  // Em andamento
  COMPLETED    // Concluído
  CANCELLED    // Cancelado
  NO_SHOW      // Cliente faltou
}
```

### Filtros e Busca
- Filtrar por status
- Filtrar por profissional
- Filtrar por serviço
- Filtrar por cliente
- Filtrar por período (data/hora)
- Busca por nome do cliente

### Funcionalidades Avançadas
- **Reagendamento**: Mover para nova data/hora
- **Confirmação automática**: Via WhatsApp
- **Lembretes**: Notificações antes do horário
- **Histórico**: Ver alterações do agendamento
- **Notas**: Observações sobre o atendimento

## 🗄️ Modelo de Dados

### Schema Prisma
```prisma
model Appointment {
  id            String      @id @default(cuid())
  date          DateTime
  duration      Int         @default(30) // minutos
  status        AppointmentStatus @default(SCHEDULED)
  modality      ModalityType @default(PRESENCIAL)
  
  // Novo sistema (vinculação com Agenda e Serviço)
  scheduleId    String?
  schedule      Schedule?   @relation(fields: [scheduleId], references: [id])
  serviceId     String?
  service       Service?    @relation(fields: [serviceId], references: [id])
  professionalId String?
  professionalUser User?    @relation("ProfessionalAppointments", fields: [professionalId], references: [id])
  
  // Campos gerais
  notes         String?
  price         Float?      // Preço final
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  userId        String
  user          User        @relation(fields: [userId], references: [id])
  clientId      String
  client        Client      @relation(fields: [clientId], references: [id])
  
  notifications Notification[]
}
```

### Tipos TypeScript
```typescript
interface AppointmentData {
  id: string
  date: Date
  duration: number
  status: AppointmentStatus
  modality: 'PRESENCIAL' | 'TELECONSULTA'
  
  // Relacionamentos
  schedule?: {
    id: string
    name: string
    color: string
  }
  
  service?: {
    id: string
    name: string
    price: number
    duration: number
  }
  
  professional?: {
    id: string
    name: string
    email: string
  }
  
  client: {
    id: string
    name: string
    phone: string
    email?: string
  }
  
  notes?: string
  price?: number
  createdAt: Date
  updatedAt: Date
}
```

## 💻 Exemplos de Uso

### Criar Novo Agendamento
```typescript
async function createAppointment(data: CreateAppointmentData) {
  const response = await fetch('/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: data.clientId,
      scheduleId: data.scheduleId,
      serviceId: data.serviceId,
      professionalId: data.professionalId,
      date: data.date,
      duration: data.duration,
      modality: data.modality,
      notes: data.notes,
    }),
  })
  
  if (!response.ok) {
    throw new Error('Erro ao criar agendamento')
  }
  
  return response.json()
}
```

### Listar Agendamentos com Filtros
```typescript
async function getAppointments(filters: AppointmentFilters) {
  const params = new URLSearchParams()
  
  if (filters.status) params.append('status', filters.status)
  if (filters.professionalId) params.append('professionalId', filters.professionalId)
  if (filters.startDate) params.append('startDate', filters.startDate.toISOString())
  if (filters.endDate) params.append('endDate', filters.endDate.toISOString())
  
  const response = await fetch(`/api/appointments?${params}`)
  return response.json()
}
```

### Atualizar Status
```typescript
async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const response = await fetch(`/api/appointments/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  
  return response.json()
}
```

### Cancelar Agendamento
```typescript
async function cancelAppointment(id: string, reason?: string) {
  const response = await fetch(`/api/appointments/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      status: 'CANCELLED',
      notes: reason 
    }),
  })
  
  return response.json()
}
```

## 🔐 Permissões e Validações

### Usuário Master
- Criar agendamentos para qualquer profissional
- Editar todos os agendamentos da conta
- Cancelar qualquer agendamento
- Ver todos os agendamentos

### Profissional
- Criar agendamentos para si mesmo
- Editar apenas seus agendamentos
- Cancelar apenas seus agendamentos
- Ver apenas seus agendamentos

### Validações
```typescript
// Validações no backend
- Data/hora não pode ser no passado
- Não permitir agendamentos em horários ocupados
- Verificar disponibilidade da agenda
- Respeitar workingDays e horários da agenda
- Respeitar bloqueios (ScheduleBlock)
- Validar duração mínima/máxima
- Verificar limite do plano (PlanUsage)
```

## 🎨 Interface de Usuário

### Formulário de Criação
```tsx
<AppointmentForm>
  <ClientSelect />         {/* Buscar/criar cliente */}
  <ScheduleSelect />       {/* Selecionar agenda */}
  <ServiceSelect />        {/* Selecionar serviço */}
  <ProfessionalSelect />   {/* Selecionar profissional */}
  <DateTimePicker />       {/* Data e hora */}
  <ModalityRadio />        {/* Presencial/Teleconsulta */}
  <NotesTextarea />        {/* Observações */}
  <PriceInput />           {/* Preço (opcional) */}
</AppointmentForm>
```

### Lista de Agendamentos
```tsx
<AppointmentsTable>
  <Filters />              {/* Filtros */}
  <SearchBar />            {/* Busca */}
  
  <Table>
    <TableHeader>
      <Row>
        <Cell>Data/Hora</Cell>
        <Cell>Cliente</Cell>
        <Cell>Serviço</Cell>
        <Cell>Profissional</Cell>
        <Cell>Status</Cell>
        <Cell>Ações</Cell>
      </Row>
    </TableHeader>
    
    <TableBody>
      {appointments.map(apt => (
        <AppointmentRow 
          key={apt.id} 
          appointment={apt}
          onEdit={handleEdit}
          onCancel={handleCancel}
          onChangeStatus={handleChangeStatus}
        />
      ))}
    </TableBody>
  </Table>
</AppointmentsTable>
```

## 🔔 Notificações Automáticas

### Criação
```typescript
// Ao criar agendamento
- Notificação interna para master
- Notificação interna para profissional
- WhatsApp para cliente (se habilitado)
```

### Confirmação
```typescript
// Ao confirmar agendamento
- Notificação interna para profissional
- WhatsApp para profissional (opcional)
```

### Lembretes
```typescript
// X horas antes (configurável)
- WhatsApp para cliente
- Notificação interna para profissional
```

### Cancelamento
```typescript
// Ao cancelar
- Notificação interna para todas as partes
- WhatsApp para cliente (se aplicável)
```

## 🎯 Casos de Uso

### 1. Criar Agendamento (Master)
**Fluxo**:
1. Acessa `/dashboard/appointments/new`
2. Seleciona ou cria cliente
3. Escolhe agenda e serviço
4. Escolhe profissional (opcional)
5. Seleciona data/hora disponível
6. Define modalidade
7. Adiciona observações
8. Confirma criação
9. Sistema valida disponibilidade
10. Cria agendamento
11. Envia notificações

### 2. Reagendar Compromisso
**Fluxo**:
1. Acessa lista de agendamentos
2. Clica em "Editar" no agendamento
3. Altera data/hora
4. Sistema valida nova disponibilidade
5. Salva alterações
6. Envia notificação de reagendamento

### 3. Marcar como Concluído
**Fluxo**:
1. Profissional acessa agendamento
2. Clica em "Concluir atendimento"
3. Opcionalmente adiciona notas
4. Status alterado para COMPLETED
5. Notificação enviada ao master

### 4. Cliente Faltou (No-Show)
**Fluxo**:
1. Profissional/master marca como NO_SHOW
2. Status atualizado
3. Estatística de no-show incrementada
4. Pode ser usado em relatórios

## 🔗 Integrações

### Com Agendas (Schedules)
- Agendamento vinculado a uma agenda específica
- Respeita disponibilidade e configurações da agenda
- Usa cores da agenda para visualização

### Com Serviços (Services)
- Duração padrão do serviço
- Preço padrão do serviço
- Pode sobrescrever valores

### Com Clientes (Clients)
- Histórico de agendamentos do cliente
- Dados de contato para notificações

### Com Notificações
- Criação automática de notificações
- Integração com WhatsApp

## 📊 Relatórios e Métricas

### Métricas Calculadas
- Total de agendamentos por período
- Taxa de confirmação (%)
- Taxa de no-show (%)
- Receita gerada
- Agendamentos por profissional
- Agendamentos por serviço
- Horários mais populares

## 🚀 Melhorias Futuras

- [ ] Agendamento recorrente
- [ ] Lista de espera
- [ ] Confirmação por SMS
- [ ] Integração com Google Calendar
- [ ] Pagamento online no agendamento
- [ ] Avaliação pós-atendimento
- [ ] Histórico médico (para clínicas)
- [ ] Upload de documentos/anexos
