# Referência de APIs - Endpoints Disponíveis

Este documento lista todos os endpoints da API REST do Calenvo App, organizados por funcionalidade.

## 🔐 Autenticação

Todos os endpoints (exceto públicos) requerem autenticação via NextAuth.js session.

### Headers Necessários
```
Cookie: next-auth.session-token=<token>
Content-Type: application/json
```

---

## 📅 Appointments (Agendamentos)

### `GET /api/appointments`
Lista agendamentos com filtros.

**Query Params**:
- `status`: AppointmentStatus (opcional)
- `professionalId`: string (opcional)
- `startDate`: ISO date (opcional)
- `endDate`: ISO date (opcional)
- `clientId`: string (opcional)

**Response**: `Appointment[]`

### `GET /api/appointments/[id]`
Busca agendamento específico.

**Response**: `Appointment`

### `POST /api/appointments`
Cria novo agendamento.

**Body**:
```typescript
{
  clientId: string
  scheduleId: string
  serviceId: string
  professionalId?: string
  date: ISO date
  duration: number
  modality: 'PRESENCIAL' | 'TELECONSULTA'
  notes?: string
  price?: number
}
```

**Response**: `Appointment`

### `PUT /api/appointments/[id]`
Atualiza agendamento.

**Body**: Partial de Appointment

**Response**: `Appointment`

### `PATCH /api/appointments/[id]/status`
Atualiza apenas status.

**Body**:
```typescript
{
  status: AppointmentStatus
}
```

**Response**: `Appointment`

### `DELETE /api/appointments/[id]`
Cancela/deleta agendamento.

**Response**: `{ success: boolean }`

---

## 📆 Schedules (Agendas)

### `GET /api/schedules`
Lista agendas do usuário.

**Response**: `Schedule[]`

### `GET /api/schedules/[id]`
Busca agenda específica.

**Response**: `Schedule` (com relacionamentos)

### `POST /api/schedules`
Cria nova agenda.

**Body**:
```typescript
{
  name: string
  description?: string
  color?: string
  workingDays: number[]
  startTime: string
  endTime: string
  slotDuration: number
  serviceIds?: string[]
  professionalIds?: string[]
}
```

**Response**: `Schedule`

### `PUT /api/schedules/[id]`
Atualiza agenda.

**Body**: Partial de Schedule

**Response**: `Schedule`

### `DELETE /api/schedules/[id]`
Deleta agenda.

**Response**: `{ success: boolean }`

### `GET /api/schedules/[id]/availability`
Verifica disponibilidade.

**Query Params**:
- `date`: YYYY-MM-DD
- `serviceId`: string (opcional)

**Response**:
```typescript
{
  availableSlots: string[]  // ["09:00", "09:30", ...]
}
```

### `POST /api/schedules/[id]/blocks`
Cria bloqueio de período.

**Body**:
```typescript
{
  startDate: ISO date
  endDate: ISO date
  reason?: string
  isAllDay: boolean
}
```

**Response**: `ScheduleBlock`

---

## 👥 Clients (Clientes)

### `GET /api/clients`
Lista clientes.

**Query Params**:
- `search`: string (opcional)

**Response**: `Client[]`

### `GET /api/clients/[id]`
Busca cliente específico.

**Query Params**:
- `include`: 'appointments' (opcional)

**Response**: `Client` (+ appointments se solicitado)

### `POST /api/clients`
Cria novo cliente.

**Body**:
```typescript
{
  name: string
  phone: string
  email?: string
  cpf?: string
  birthDate?: ISO date
  address?: string
  notes?: string
}
```

**Response**: `Client`

### `PUT /api/clients/[id]`
Atualiza cliente.

**Body**: Partial de Client

**Response**: `Client`

### `DELETE /api/clients/[id]`
Deleta cliente.

**Response**: `{ success: boolean }`

---

## 💼 Services (Serviços)

### `GET /api/services`
Lista serviços.

**Query Params**:
- `category`: string (opcional)
- `isActive`: boolean (opcional)

**Response**: `Service[]`

### `GET /api/services/[id]`
Busca serviço específico.

**Response**: `Service`

### `POST /api/services`
Cria novo serviço.

**Body**:
```typescript
{
  name: string
  description?: string
  duration: number
  price?: number
  category?: string
  requiresDeposit?: boolean
  depositAmount?: number
}
```

**Response**: `Service`

### `PUT /api/services/[id]`
Atualiza serviço.

**Body**: Partial de Service

**Response**: `Service`

### `DELETE /api/services/[id]`
Deleta serviço.

**Response**: `{ success: boolean }`

---

## 👨‍💼 Professionals (Profissionais)

### `GET /api/professionals`
Lista profissionais da equipe.

**Response**: `User[]` (role: PROFESSIONAL)

### `GET /api/professionals/[id]`
Busca profissional específico.

**Response**: `User`

### `POST /api/professionals`
Cria novo profissional.

**Body**:
```typescript
{
  name: string
  email: string
  password: string
  whatsapp?: string
  scheduleIds?: string[]
}
```

**Response**: `User`

### `PUT /api/professionals/[id]`
Atualiza profissional.

**Body**: Partial de User

**Response**: `User`

### `DELETE /api/professionals/[id]`
Desativa profissional.

**Response**: `{ success: boolean }`

### `GET /api/professionals/available`
Busca profissionais disponíveis.

**Query Params**:
- `scheduleId`: string
- `date`: ISO date

**Response**: `User[]`

---

## 🔔 Notifications (Notificações)

### `GET /api/notifications`
Lista notificações do usuário.

**Query Params**:
- `unread`: boolean (opcional)
- `limit`: number (opcional)

**Response**: `Notification[]`

### `POST /api/notifications`
Cria notificação (interno).

**Body**:
```typescript
{
  userId: string
  type: NotificationType
  title: string
  message: string
  appointmentId?: string
}
```

**Response**: `Notification`

### `PATCH /api/notifications/[id]/read`
Marca como lida.

**Response**: `Notification`

### `PATCH /api/notifications/mark-all-read`
Marca todas como lidas.

**Response**: `{ success: boolean, count: number }`

### `DELETE /api/notifications/[id]`
Deleta notificação.

**Response**: `{ success: boolean }`

---

## 📊 Reports (Relatórios)

### `GET /api/reports`
Relatório geral.

**Query Params**:
- `startDate`: ISO date
- `endDate`: ISO date

**Response**: Dados agregados

### `GET /api/reports/appointments`
Relatório de agendamentos.

**Response**: AppointmentsReport

### `GET /api/reports/revenue`
Relatório de receita.

**Response**: RevenueReport

### `GET /api/reports/clients`
Relatório de clientes.

**Response**: ClientsReport

### `POST /api/reports/export`
Exporta relatório.

**Body**:
```typescript
{
  type: 'pdf' | 'csv' | 'excel'
  reportType: string
  data: any
}
```

**Response**: File (blob)

---

## ⚙️ Settings (Configurações)

### `GET /api/settings`
Busca configurações do negócio.

**Response**: `BusinessConfig`

### `PUT /api/settings`
Atualiza configurações.

**Body**: Partial de BusinessConfig

**Response**: `BusinessConfig`

---

## 👤 User (Usuário)

### `GET /api/user/profile`
Busca perfil do usuário logado.

**Response**: `User`

### `PUT /api/user/profile`
Atualiza perfil.

**Body**:
```typescript
{
  name?: string
  email?: string
  phone?: string
  businessName?: string
}
```

**Response**: `User`

### `GET /api/user/plan`
Busca plano atual.

**Response**:
```typescript
{
  planType: PlanType
  usage: PlanUsage
  limits: PlanLimits
}
```

---

## 💳 Stripe (Pagamentos)

### `GET /api/stripe/plans`
Lista planos disponíveis.

**Response**: `Plan[]`

### `POST /api/stripe/checkout`
Cria sessão de checkout.

**Body**:
```typescript
{
  planType: 'STANDARD' | 'PREMIUM'
}
```

**Response**:
```typescript
{
  checkoutUrl: string
}
```

### `POST /api/stripe/portal`
Redireciona para portal do cliente.

**Response**:
```typescript
{
  portalUrl: string
}
```

### `POST /api/stripe/webhook`
Webhook do Stripe (eventos).

**Body**: Stripe Event

**Response**: `{ received: boolean }`

---

## 💬 WhatsApp

### `POST /api/whatsapp/connect`
Inicia conexão.

**Body**:
```typescript
{
  apiUrl: string
  apiKey: string
}
```

**Response**:
```typescript
{
  qrCode: string
  instanceName: string
}
```

### `GET /api/whatsapp/qrcode`
Busca QR Code.

**Response**:
```typescript
{
  qrCode: string
}
```

### `POST /api/whatsapp/send`
Envia mensagem.

**Body**:
```typescript
{
  to: string  // Número com DDD
  message: string
  appointmentId?: string
}
```

**Response**: `{ success: boolean, messageId: string }`

### `GET /api/whatsapp/status`
Status da conexão.

**Response**:
```typescript
{
  isConnected: boolean
  phoneNumber?: string
}
```

### `POST /api/whatsapp/disconnect`
Desconecta instância.

**Response**: `{ success: boolean }`

---

## 🌐 Booking (Público)

### `GET /api/booking/[slug]`
Busca configurações públicas.

**Response**:
```typescript
{
  businessName: string
  businessLogo?: string
  allowOnlineBooking: boolean
}
```

### `GET /api/booking/[slug]/schedules`
Lista agendas públicas.

**Response**: `Schedule[]`

### `GET /api/booking/[slug]/services`
Lista serviços públicos.

**Response**: `Service[]`

### `GET /api/booking/[slug]/availability`
Verifica disponibilidade.

**Query Params**:
- `scheduleId`: string
- `serviceId`: string
- `professionalId`: string (opcional)
- `date`: YYYY-MM-DD

**Response**:
```typescript
{
  slots: string[]
}
```

### `POST /api/booking/[slug]/appointment`
Cria agendamento público.

**Body**:
```typescript
{
  scheduleId: string
  serviceId: string
  professionalId?: string
  date: ISO date
  time: string
  clientName: string
  clientPhone: string
  clientEmail?: string
  notes?: string
}
```

**Response**: `Appointment`

---

## 📈 Dashboard/Stats

### `GET /api/dashboard`
Dados do dashboard.

**Response**:
```typescript
{
  stats: DashboardStats
  recentAppointments: Appointment[]
  upcomingAppointments: Appointment[]
  notifications: Notification[]
  chartData: ChartData
}
```

### `GET /api/stats`
Estatísticas detalhadas.

**Query Params**:
- `period`: 'day' | 'week' | 'month' | 'year'

**Response**: `StatsData`

---

## 📤 Upload

### `POST /api/upload`
Upload de arquivo (imagem).

**Body**: FormData (multipart/form-data)
- `file`: File

**Response**:
```typescript
{
  url: string
  key: string
}
```

---

## 🔒 Auth (NextAuth)

### `POST /api/auth/signin`
Login (gerenciado por NextAuth).

### `POST /api/auth/signout`
Logout (gerenciado por NextAuth).

### `POST /api/signup`
Criar conta.

**Body**:
```typescript
{
  name: string
  email: string
  password: string
  businessName?: string
  segmentType: SegmentType
}
```

**Response**: `User`

---

## 📝 Notas

- Todas as datas devem ser em formato ISO 8601
- Erros retornam status HTTP apropriado (400, 401, 403, 404, 500)
- Paginação pode ser adicionada futuramente com query params `page` e `limit`
