# Modelos de Dados - Schema Prisma Explicado

Este documento detalha todos os modelos de dados do Calenvo App e seus relacionamentos.

## 🔑 Models Principais

### User (Usuário)
Representa tanto usuários Master quanto Profissionais.

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String
  password      String
  role          UserRole  @default(MASTER)
  whatsapp      String?
  isActive      Boolean   @default(true)
  
  // Informações do negócio (apenas Master)
  businessName  String?
  phone         String?
  segmentType   SegmentType @default(BEAUTY_SALON)
  
  // Plano e assinatura
  planType      PlanType  @default(FREEMIUM)
  stripeCustomerId String?
  subscriptionId String?
  subscriptionStatus String?
  
  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relacionamento hierárquico
  masterId      String?
  master        User?     @relation("MasterProfessionals", fields: [masterId], references: [id])
  professionals User[]    @relation("MasterProfessionals")
  
  // Relacionamentos
  accounts      Account[]
  sessions      Session[]
  appointments  Appointment[]  // Como master
  professionalAppointments Appointment[] @relation("ProfessionalAppointments")
  clients       Client[]
  businessConfig BusinessConfig?
  planUsage     PlanUsage?
  schedules     Schedule[]
  services      Service[]
  scheduleProfessionals ScheduleProfessional[]
  notifications Notification[]
  whatsappConfig WhatsAppConfig?
  
  @@unique([email, role])
}
```

**Pontos-chave**:
- `role`: Diferencia Master (criador) de Professional (membro da equipe)
- `masterId`: Profissionais têm referência ao Master
- `@@unique([email, role])`: Mesmo email pode ter 2 usuários (Master + Professional)

---

### Client (Cliente)
Clientes/Pacientes do negócio.

```prisma
model Client {
  id          String   @id @default(cuid())
  name        String
  email       String?
  phone       String
  cpf         String?
  birthDate   DateTime?
  address     String?
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userId      String
  user        User     @relation(fields: [userId], references: [id])
  appointments Appointment[]

  @@unique([cpf, userId])
}
```

**Pontos-chave**:
- CPF único por userId (um cliente pode ter CPF repetido em contas diferentes)
- Phone obrigatório (para WhatsApp)

---

### Schedule (Agenda)
Configuração de disponibilidade, similar ao Calendly.

```prisma
model Schedule {
  id                String   @id @default(cuid())
  name              String
  description       String?
  color             String?  @default("#3B82F6")
  isActive          Boolean  @default(true)
  acceptWalkIn      Boolean  @default(false)
  
  // Disponibilidade padrão
  workingDays       Int[]    // [0-6] domingo a sábado
  startTime         String   @default("08:00")
  endTime           String   @default("18:00:")
  slotDuration      Int      @default(30)
  bufferTime        Int      @default(0)
  lunchStart        String?
  lunchEnd          String?
  
  // Configurações de agendamento
  advanceBookingDays Int     @default(30)
  minNoticeHours    Int      @default(2)
  
  // Personalização avançada
  useCustomDayConfig Boolean @default(false)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  userId            String
  user              User     @relation(fields: [userId], references: [id])
  
  services          ScheduleService[]
  appointments      Appointment[]
  professionals     ScheduleProfessional[]
  dayConfigs        ScheduleDayConfig[]
  blocks            ScheduleBlock[]
}
```

**Pontos-chave**:
- `workingDays`: Array de inteiros (0=domingo, 6=sábado)
- `useCustomDayConfig`: Se true, usa ScheduleDayConfig ao invés de horários padrão

---

### ScheduleDayConfig (Config por Dia)
Horários customizados por dia da semana.

```prisma
model ScheduleDayConfig {
  id          String   @id @default(cuid())
  scheduleId  String
  schedule    Schedule @relation(fields: [scheduleId], references: [id])
  
  dayOfWeek   Int      // 0-6
  isActive    Boolean  @default(true)
  timeSlots   Json     // [{startTime: "10:00", endTime: "12:00"}, ...]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([scheduleId, dayOfWeek])
}
```

**Pontos-chave**:
- `timeSlots` (JSON): Permite múltiplos intervalos no mesmo dia
- Exemplo: Manhã 08:00-12:00, Tarde 14:00-18:00

---

### ScheduleBlock (Bloqueio)
Períodos indisponíveis (férias, feriados).

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
  
  @@index([scheduleId, startDate, endDate])
}
```

---

### Service (Serviço)
Serviços/procedimentos oferecidos.

```prisma
model Service {
  id            String   @id @default(cuid())
  name          String
  description   String?
  duration      Int      @default(30)
  price         Float?
  category      String?
  isActive      Boolean  @default(true)
  
  requiresDeposit Boolean  @default(false)
  depositAmount   Float?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  userId        String
  user          User     @relation(fields: [userId], references: [id])
  
  schedules     ScheduleService[]
  appointments  Appointment[]
}
```

---

### ScheduleService (Vinculação)
Relacionamento N:N entre Schedule e Service.

```prisma
model ScheduleService {
  id          String   @id @default(cuid())
  scheduleId  String
  schedule    Schedule @relation(fields: [scheduleId], references: [id])
  serviceId   String
  service     Service  @relation(fields: [serviceId], references: [id])
  
  // Sobrescrever padrões
  customDuration Int?
  customPrice    Float?
  
  createdAt   DateTime @default(now())
  
  @@unique([scheduleId, serviceId])
}
```

**Pontos-chave**:
- Permite customizar duração e preço do serviço por agenda

---

### ScheduleProfessional (Vinculação)
Relacionamento N:N entre Schedule e Professional.

```prisma
model ScheduleProfessional {
  id            String   @id @default(cuid())
  scheduleId    String
  schedule      Schedule @relation(fields: [scheduleId], references: [id])
  professionalId String
  professional  User     @relation(fields: [professionalId], references: [id])
  
  createdAt     DateTime @default(now())
  
  @@unique([scheduleId, professionalId])
}
```

---

### Appointment (Agendamento)
Agendamento propriamente dito.

```prisma
model Appointment {
  id            String      @id @default(cuid())
  date          DateTime
  duration      Int         @default(30)
  status        AppointmentStatus @default(SCHEDULED)
  modality      ModalityType @default(PRESENCIAL)
  
  // Vinculação (novo sistema)
  scheduleId    String?
  schedule      Schedule?   @relation(fields: [scheduleId], references: [id])
  serviceId     String?
  service       Service?    @relation(fields: [serviceId], references: [id])
  professionalId String?
  professionalUser User?    @relation("ProfessionalAppointments", fields: [professionalId], references: [id])
  
  // Campos gerais
  notes         String?
  price         Float?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  userId        String
  user          User        @relation(fields: [userId], references: [id])
  clientId      String
  client        Client      @relation(fields: [clientId], references: [id])
  
  notifications Notification[]
}
```

**Pontos-chave**:
- `userId`: Sempre o Master (dono da conta)
- `professionalId`: Profissional responsável (pode ser null)
- `scheduleId`: Agenda vinculada
- `serviceId`: Serviço vinculado

---

### BusinessConfig (Configuração do Negócio)
Configurações gerais.

```prisma
model BusinessConfig {
  id                String   @id @default(cuid())
  workingDays       Int[]
  startTime         String   @default("08:00")
  endTime           String   @default("18:00")
  defaultDuration   Int      @default(30)
  lunchStart        String?  @default("12:00")
  lunchEnd          String?  @default("13:00")
  timezone          String   @default("America/Sao_Paulo")
  autoConfirm       Boolean  @default(false)
  allowOnlineBooking Boolean @default(true)
  
  // Personalização
  businessLogo      String?
  publicUrl         String?
  
  // Específicos por segmento
  multipleServices  Boolean  @default(false)
  requiresDeposit   Boolean  @default(false)
  cancellationHours Int      @default(24)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])
}
```

---

### PlanUsage (Uso do Plano)
Controle de limites de uso.

```prisma
model PlanUsage {
  id                 String   @id @default(cuid())
  appointmentsCount  Int      @default(0)
  currentPeriodStart DateTime @default(now())
  currentPeriodEnd   DateTime
  resetAt            DateTime
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  userId             String   @unique
  user               User     @relation(fields: [userId], references: [id])
}
```

**Pontos-chave**:
- Reset mensal automático
- `appointmentsCount`: Incrementado a cada agendamento criado

---

### Notification (Notificação)
Notificações internas.

```prisma
model Notification {
  id          String            @id @default(cuid())
  title       String
  message     String
  type        NotificationType
  isRead      Boolean           @default(false)
  readAt      DateTime?
  
  appointmentId String?
  appointment   Appointment?    @relation(fields: [appointmentId], references: [id])
  
  userId      String
  user        User              @relation(fields: [userId], references: [id])
  
  metadata    Json?
  
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  
  @@index([userId, isRead])
  @@index([userId, createdAt])
}
```

**Pontos-chave**:
- `metadata`: JSON para dados adicionais
- Índices para performance em queries frequentes

---

### WhatsAppConfig (Config WhatsApp)
Configuração da integração WhatsApp e templates de mensagens.

```prisma
model WhatsAppConfig {
  id                String   @id @default(cuid())
  instanceName      String   @unique   // Nome da instância na Evolution API
  apiKey            String?  @db.Text
  apiUrl            String
  phoneNumber       String?
  isConnected       Boolean  @default(false)
  qrCode            String?  @db.Text
  
  // Configurações Globais
  enabled           Boolean  @default(false)
  
  // Confirmação de Agendamento (Criação)
  notifyOnCreate    Boolean  @default(true)
  createDelayMinutes Int     @default(0)
  createMessage     String?  @db.Text
  
  // Cancelamento
  notifyOnCancel    Boolean  @default(true)
  cancelDelayMinutes Int     @default(0)
  cancelMessage     String?  @db.Text
  
  // Confirmação de Presença (X dias antes)
  notifyConfirmation Boolean @default(true)
  confirmationDays   Int     @default(1)
  confirmationMessage String? @db.Text
  
  // Lembrete (X horas antes)
  notifyReminder    Boolean  @default(true)
  reminderHours     Int      @default(24)
  reminderMessage   String?  @db.Text
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])
}
```

---

## 📊 Enums

### UserRole
```prisma
enum UserRole {
  MASTER        // Criador da conta
  PROFESSIONAL  // Membro da equipe
}
```

### PlanType
```prisma
enum PlanType {
  FREEMIUM
  STANDARD
  PREMIUM
}
```

### SegmentType
```prisma
enum SegmentType {
  BEAUTY_SALON           // Salões de beleza
  BARBERSHOP            // Barbearias
  AESTHETIC_CLINIC      // Clínicas de estética
  TECH_SAAS             // Tecnologia e SaaS
  PROFESSIONAL_SERVICES // Consultorias
  HR                    // Recursos Humanos
  PHYSIOTHERAPY         // Fisioterapia
  EDUCATION             // Educação
  PET_SHOP              // Pet shops
  OTHER                 // Outros
}
```

### AppointmentStatus
```prisma
enum AppointmentStatus {
  SCHEDULED    // Agendado
  CONFIRMED    // Confirmado
  IN_PROGRESS  // Em andamento
  COMPLETED    // Concluído
  CANCELLED    // Cancelado
  NO_SHOW      // Faltou
}
```

### ModalityType
```prisma
enum ModalityType {
  PRESENCIAL
  TELECONSULTA
}
```

### NotificationType
```prisma
enum NotificationType {
  APPOINTMENT_CREATED
  APPOINTMENT_CONFIRMED
  APPOINTMENT_CANCELLED
  APPOINTMENT_REMINDER
  APPOINTMENT_RESCHEDULED
  APPOINTMENT_COMPLETED
  SYSTEM
}
```

---

## 🔗 Diagrama de Relacionamentos

```
User (Master)
├─┬─ BusinessConfig (1:1)
├─┬─ PlanUsage (1:1)
├─┬─ WhatsAppConfig (1:1)
├─┬─ Schedule (1:N)
│ └─┬─ ScheduleService (N:N com Service)
│   ├─ ScheduleProfessional (N:N com User/Professional)
│   ├─ ScheduleDayConfig (1:N)
│   ├─ ScheduleBlock (1:N)
│   └─ Appointment (1:N)
├─┬─ Service (1:N)
│ └─ ScheduleService (N:N com Schedule)
├─┬─ Client (1:N)
│ └─ Appointment (1:N)
├─┬─ Appointment (1:N como master)
├─┬─ Notification (1:N)
└─┬─ User/Professional (1:N)
  └─┬─ ScheduleProfessional (N:N com Schedule)
    └─ Appointment (1:N como profissional)
```

---

## 🎯 Queries Comuns

### Buscar agendamentos de um profissional
```prisma
const appointments = await prisma.appointment.findMany({
  where: { professionalId: professionalId },
  include: {
    client: true,
    service: true,
    schedule: true,
  },
})
```

### Verificar disponibilidade de uma agenda
```typescript
// 1. Buscar agenda com configs
const schedule = await prisma.schedule.findUnique({
  where: { id: scheduleId },
  include: {
    dayConfigs: true,
    blocks: true,
  },
})

// 2. Buscar agendamentos existentes na data
const appointments = await prisma.appointment.findMany({
  where: {
    scheduleId,
    date: {
      gte: startOfDay(date),
      lte: endOfDay(date),
    },
  },
})

// 3. Calcular slots disponíveis (algoritmo em agenda.md)
```

### Incrementar uso do plano
```prisma
await prisma.planUsage.update({
  where: { userId },
  data: {
    appointmentsCount: { increment: 1 },
  },
})
```
