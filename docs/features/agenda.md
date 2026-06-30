# Agenda (Schedules) - Sistema de Agendas e Disponibilidade

## 📋 Descrição

Sistema de configuração de agendas (schedules), permitindo definir horários de trabalho, bloqueios, vincular serviços e profissionais. Similar ao Calendly, cada agenda tem suas próprias regras de disponibilidade.

## 📍 Localização no Código

### Páginas
- **Listagem**: `/dashboard/schedules` → `app/dashboard/schedules/page.tsx`
- **Nova**: `/dashboard/schedules/new` → `app/dashboard/schedules/new/page.tsx`
- **Editar**: `/dashboard/schedules/[id]` → `app/dashboard/schedules/[id]/page.tsx`
- **Visualização**: `/dashboard/agenda` → `app/dashboard/agenda/page.tsx`

### Componentes
- `components/schedule/` - Componentes de configuração de agendas
- `components/agenda/` - Componentes de visualização de agenda
  - `agenda-day-view.tsx` - Visualização diária
  - `agenda-week-view.tsx` - Visualização semanal
  - `agenda-month-view.tsx` - Visualização mensal
  - `agenda-timeline-view.tsx` - Visualização em timeline
  - `agenda-list-view.tsx` - Visualização em lista
  - `agenda-view-selector.tsx` - Seletor de visualizações
  - `agenda-filters.tsx` - Filtros da agenda
  - `date-navigation.tsx` - Navegação de datas

### APIs
- `GET /api/schedules` - Listar agendas
- `GET /api/schedules/[id]` - Buscar agenda específica
- `POST /api/schedules` - Criar nova agenda
- `PUT /api/schedules/[id]` - Atualizar agenda
- `DELETE /api/schedules/[id]` - Deletar agenda
- `GET /api/schedules/[id]/availability` - Verificar disponibilidade
- `POST /api/schedules/[id]/blocks` - Criar bloqueio
- `GET /api/schedules/[id]/appointments` - Agendamentos da agenda

## 🎯 Funcionalidades

### Configuração de Agenda

#### 1. Informações Básicas
- Nome da agenda (ex: "Consultas Cardiologia")
- Descrição
- Cor para identificação visual
- Status (ativa/inativa)
- Aceitar encaixe (walk-in)

#### 2. Disponibilidade Padrão
```typescript
{
  workingDays: number[]      // [1,2,3,4,5] = Segunda a Sexta
  startTime: string          // "08:00"
  endTime: string            // "18:00"
  slotDuration: number       // 30 minutos
  bufferTime: number         // 0 minutos entre agendamentos
  lunchStart?: string        // "12:00"
  lunchEnd?: string          // "13:00"
}
```

#### 3. Configurações Avançadas
- **Dias da semana específicos**: Configurar horários diferentes por dia
- **Antecedência**: Quantos dias no futuro permitir agendamento
- **Aviso mínimo**: Horas mínimas de antecedência
- **Bloqueios**: Períodos indisponíveis (férias, feriados)

#### 4. Vinculações
- **Serviços**: Quais serviços podem ser agendados nesta agenda
- **Profissionais**: Quais profissionais atendem nesta agenda

### Visualizações de Agenda

#### Day View (Visualização Diária)
- Grid de horários do dia
- Agendamentos exibidos como blocos
- Cores por agenda/serviço
- Clique para criar/editar agendamento

#### Week View (Visualização Semanal)
- 7 dias em colunas
- Agendamentos distribuídos
- Navegação entre semanas

#### Month View (Visualização Mensal)
- Calendário tradicional
- Indicadores de agendamentos por dia
- Clique no dia para ver detalhes

#### Timeline View (Timeline)
- Visualização horizontal por profissional
- Útil para ver disponibilidade da equipe

#### List View (Visualização em Lista)
- Lista cronológica de agendamentos
- Filtros e busca
- Melhor para mobile

### Bloqueios de Período (Schedule Blocks)
- Data/hora de início e fim
- Motivo do bloqueio
- Bloqueio de dia inteiro ou parcial

## 🗄️ Modelo de Dados

### Schedule (Agenda)
```prisma
model Schedule {
  id                String   @id @default(cuid())
  name              String
  description       String?
  color             String?  @default("#3B82F6")
  isActive          Boolean  @default(true)
  acceptWalkIn      Boolean  @default(false)
  
  // Disponibilidade padrão
  workingDays       Int[]    // [0-6]
  startTime         String   @default("08:00")
  endTime           String   @default("18:00")
  slotDuration      Int      @default(30)
  bufferTime        Int      @default(0)
  lunchStart        String?
  lunchEnd          String?
  
  // Configurações de agendamento
  advanceBookingDays Int     @default(30)
  minNoticeHours    Int      @default(2)
  
  // Personalização avançada
  useCustomDayConfig Boolean @default(false)
  
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  
  services          ScheduleService[]
  appointments      Appointment[]
  professionals     ScheduleProfessional[]
  dayConfigs        ScheduleDayConfig[]
  blocks            ScheduleBlock[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### ScheduleDayConfig (Configuração por Dia)
```prisma
model ScheduleDayConfig {
  id          String   @id @default(cuid())
  scheduleId  String
  schedule    Schedule @relation(fields: [scheduleId], references: [id])
  
  dayOfWeek   Int      // 0-6
  isActive    Boolean  @default(true)
  
  // Múltiplos intervalos no mesmo dia
  timeSlots   Json     // [{startTime: "10:00", endTime: "12:00"}, ...]
  
  @@unique([scheduleId, dayOfWeek])
}
```

### ScheduleBlock (Bloqueio)
```prisma
model ScheduleBlock {
  id          String   @id @default(cuid())
  scheduleId  String
  schedule    Schedule @relation(fields: [scheduleId], references: [id])
  
  startDate   DateTime
  endDate     DateTime
  reason      String?
  isAllDay    Boolean  @default(true)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### ScheduleService (Vinculação com Serviços)
```prisma
model ScheduleService {
  id          String   @id @default(cuid())
  scheduleId  String
  schedule    Schedule @relation(fields: [scheduleId], references: [id])
  serviceId   String
  service     Service  @relation(fields: [serviceId], references: [id])
  
  // Sobrescrever configurações do serviço
  customDuration Int?
  customPrice    Float?
  
  @@unique([scheduleId, serviceId])
}
```

### ScheduleProfessional (Vinculação com Profissionais)
```prisma
model ScheduleProfessional {
  id            String   @id @default(cuid())
  scheduleId    String
  schedule      Schedule @relation(fields: [scheduleId], references: [id])
  professionalId String
  professional  User     @relation(fields: [professionalId], references: [id])
  
  @@unique([scheduleId, professionalId])
}
```

## 💻 Exemplos de Uso

### Criar Agenda Simples
```typescript
async function createSchedule(data: CreateScheduleData) {
  const response = await fetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: "Consultas Cardiologia",
      description: "Agenda para consultas cardíacas",
      color: "#3B82F6",
      workingDays: [1, 2, 3, 4, 5], // Segunda a Sexta
      startTime: "08:00",
      endTime: "18:00",
      slotDuration: 60,
      lunchStart: "12:00",
      lunchEnd: "13:00",
      advanceBookingDays: 30,
      minNoticeHours: 24,
    }),
  })
  
  return response.json()
}
```

### Verificar Disponibilidade
```typescript
async function getAvailability(scheduleId: string, date: Date) {
  const params = new URLSearchParams({
    date: date.toISOString().split('T')[0],
  })
  
  const response = await fetch(
    `/api/schedules/${scheduleId}/availability?${params}`
  )
  
  const data = await response.json()
  
  // Retorna: { availableSlots: ["08:00", "09:00", "10:00", ...] }
  return data
}
```

### Criar Bloqueio
```typescript
async function createBlock(scheduleId: string, block: BlockData) {
  const response = await fetch(`/api/schedules/${scheduleId}/blocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startDate: block.startDate,
      endDate: block.endDate,
      reason: "Férias",
      isAllDay: true,
    }),
  })
  
  return response.json()
}
```

### Configurar Horário Customizado por Dia
```typescript
async function setCustomDayConfig(scheduleId: string, config: DayConfig) {
  const response = await fetch(`/api/schedules/${scheduleId}/day-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dayOfWeek: 1, // Segunda-feira
      isActive: true,
      timeSlots: [
        { startTime: "08:00", endTime: "12:00" },
        { startTime: "14:00", endTime: "18:00" },
      ],
    }),
  })
  
  return response.json()
}
```

## 🎨 Interface de Usuário

### Formulário de Configuração
```tsx
<ScheduleConfigForm>
  <BasicInfo>
    <Input name="name" label="Nome da Agenda" />
    <Textarea name="description" label="Descrição" />
    <ColorPicker name="color" label="Cor" />
    <Switch name="isActive" label="Ativa" />
  </BasicInfo>
  
  <AvailabilitySection>
    <WeekdaySelector name="workingDays" />
    <TimePicker name="startTime" label="Início" />
    <TimePicker name="endTime" label="Fim" />
    <NumberInput name="slotDuration" label="Duração do Slot (min)" />
    <NumberInput name="bufferTime" label="Intervalo (min)" />
  </AvailabilitySection>
  
  <LunchBreak>
    <TimePicker name="lunchStart" label="Início do Almoço" />
    <TimePicker name="lunchEnd" label="Fim do Almoço" />
  </LunchBreak>
  
  <BookingSettings>
    <NumberInput name="advanceBookingDays" label="Dias de Antecedência" />
    <NumberInput name="minNoticeHours" label="Aviso Mínimo (horas)" />
  </BookingSettings>
  
  <ServicesSection>
    <MultiSelect 
      options={services} 
      label="Serviços Vinculados"
    />
  </ServicesSection>
  
  <ProfessionalsSection>
    <MultiSelect 
      options={professionals} 
      label="Profissionais Vinculados"
    />
  </ProfessionalsSection>
</ScheduleConfigForm>
```

### Visualização de Agenda (Day View)
```tsx
<AgendaDayView date={currentDate}>
  <DateNavigation 
    onPrevious={handlePrevDay}
    onNext={handleNextDay}
    onToday={handleToday}
  />
  
  <AgendaFilters
    schedules={schedules}
    professionals={professionals}
    onFilterChange={handleFilterChange}
  />
  
  <TimeGrid>
    {timeSlots.map(slot => (
      <TimeSlot 
        key={slot} 
        time={slot}
        appointments={getAppointmentsAtTime(slot)}
        onClick={() => handleCreateAppointment(slot)}
      />
    ))}
  </TimeGrid>
</AgendaDayView>
```

## 🔐 Validações e Regras

### Ao Criar/Editar Agenda
```typescript
// Validações
- Nome obrigatório
- Pelo menos 1 dia da semana selecionado
- startTime < endTime
- slotDuration >= 15 minutos
- slotDuration <= 480 minutos (8 horas)
- Se lunchStart definido, lunchEnd também deve ser
- lunchStart < lunchEnd
- advanceBookingDays >= 0
- minNoticeHours >= 0
```

### Ao Verificar Disponibilidade
```typescript
// Considerar:
1. Dias da semana (workingDays)
2. Horário de funcionamento (startTime/endTime)
3. Horário de almoço (lunchStart/lunchEnd)
4. Configurações customizadas por dia (ScheduleDayConfig)
5. Bloqueios (ScheduleBlock)
6. Agendamentos existentes
7. slotDuration e bufferTime
8. advanceBookingDays e minNoticeHours
```

## 🎯 Casos de Uso

### 1. Criar Agenda para Barbearia
**Fluxo**:
1. Master acessa `/dashboard/schedules/new`
2. Define nome "Cortes Masculinos"
3. Seleciona dias: Segunda a Sábado
4. Define horário: 09:00 - 19:00
5. Slot de 30 minutos
6. Vincula serviços: "Corte", "Barba", "Combo"
7. Vincula profissionais: João, Pedro
8. Salva agenda

### 2. Bloquear Período para Férias
**Fluxo**:
1. Acessa configuração da agenda
2. Clica em "Adicionar Bloqueio"
3. Seleciona período: 20/12 a 05/01
4. Define motivo: "Férias de Fim de Ano"
5. Marca como dia inteiro
6. Salva bloqueio
7. Período fica indisponível para agendamentos

### 3. Configurar Horários Diferentes por Dia
**Fluxo**:
1. Edita agenda
2. Ativa "Usar configuração customizada por dia"
3. Configura Segunda: 08:00-12:00 e 14:00-18:00
4. Configura Terça: 10:00-20:00
5. Salva configurações
6. Sistema respeita horários específicos

### 4. Visualizar Agenda da Semana
**Fluxo**:
1. Acessa `/dashboard/agenda`
2. Seleciona visualização "Semana"
3. Aplica filtros (agenda, profissional)
4. Visualiza todos os agendamentos
5. Pode criar novo agendamento clicando em horário vazio

## 🔗 Integrações

### Com Agendamentos (Appointments)
- Base para validação de disponibilidade
- Define regras de slots e intervalos
- Agendamentos aparecem na visualização

### Com Serviços (Services)
- Serviços vinculados podem ser agendados
- Duração e preço podem ser customizados por agenda

### Com Profissionais (Users)
- Profissionais vinculados atendem nesta agenda
- Filtros por profissional na visualização

### Com Booking Público
- URL pública usa configurações da agenda
- Clientes veem apenas horários disponíveis

## 📊 Algoritmo de Cálculo de Disponibilidade

```typescript
function calculateAvailableSlots(
  schedule: Schedule,
  date: Date
): string[] {
  // 1. Verificar se dia da semana está em workingDays
  const dayOfWeek = date.getDay()
  if (!schedule.workingDays.includes(dayOfWeek)) {
    return []
  }
  
  // 2. Buscar configuração customizada do dia (se existir)
  const dayConfig = schedule.dayConfigs.find(dc => dc.dayOfWeek === dayOfWeek)
  
  // 3. Definir intervalos de tempo
  const timeRanges = dayConfig 
    ? dayConfig.timeSlots 
    : [{ startTime: schedule.startTime, endTime: schedule.endTime }]
  
  // 4. Gerar slots
  const slots: string[] = []
  for (const range of timeRanges) {
    let current = parseTime(range.startTime)
    const end = parseTime(range.endTime)
    
    while (current < end) {
      // Pular horário de almoço
      if (isLunchTime(current, schedule)) {
        current = addMinutes(current, schedule.slotDuration)
        continue
      }
      
      slots.push(formatTime(current))
      current = addMinutes(current, schedule.slotDuration + schedule.bufferTime)
    }
  }
  
  // 5. Remover slots bloqueados
  const blocks = getBlocksForDate(schedule.id, date)
  const availableSlots = slots.filter(slot => !isBlocked(slot, blocks))
  
  // 6. Remover slots já agendados
  const appointments = getAppointmentsForDate(schedule.id, date)
  const freeSlots = availableSlots.filter(slot => !isBooked(slot, appointments))
  
  // 7. Aplicar minNoticeHours
  const now = new Date()
  const minTime = addHours(now, schedule.minNoticeHours)
  const validSlots = freeSlots.filter(slot => {
    const slotDateTime = combineDateTime(date, slot)
    return slotDateTime >= minTime
  })
  
  return validSlots
}
```

## 🚀 Melhorias Futuras

- [ ] Template de agendas (duplicar configuração)
- [ ] Agendas compartilhadas entre usuários
- [ ] Integração com Google Calendar/Outlook
- [ ] Sincronização bidirecional
- [ ] Regras de recorrência para bloqueios
- [ ] Agendas por localização física
- [ ] Capacidade máxima de atendimentos simultâneos
- [ ] Priorização de clientes VIP
