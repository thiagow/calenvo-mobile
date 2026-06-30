# Notificações - Sistema de Notificações Interno e WhatsApp

## 📋 Descrição

Sistema dual de notificações: notificações internas (sino) e integração com WhatsApp via Evolution API.

## 📍 Localização no Código

### Páginas
- **Central**: `/dashboard/notifications` → `app/dashboard/notifications/page.tsx`

### Componentes
- `components/notifications/` - Componentes de notificações

### APIs
- `GET /api/notifications` - Listar notificações do usuário
- `POST /api/notifications` - Criar notificação
- `PATCH /api/notifications/[id]/read` - Marcar como lida
- `PATCH /api/notifications/mark-all-read` - Marcar todas como lidas
- `DELETE /api/notifications/[id]` - Deletar notificação
- `POST /api/whatsapp/send` - Enviar mensagem WhatsApp

## 🗄️ Modelo de Dados

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

enum NotificationChannel {
  INTERNAL     // Notificação interna (sino)
  WHATSAPP     // WhatsApp via Evolution API
  BOTH         // Ambos
}

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

## 🎯 Funcionalidades

### Notificações Internas
- **Centro de notificações**: Badge com contador
- **Dropdown**: Últimas notificações
- **Página dedicada**: Histórico completo
- **Marcar como lida**: Individual ou em lote
- **Sons e badges**: Alertas visuais/sonoros

### Tipos de Notificação

#### 1. APPOINTMENT_CREATED
```
Título: "Novo Agendamento"
Mensagem: "Agendamento criado para {cliente} em {data} às {hora}"
Para: Master + Profissional responsável
```

#### 2. APPOINTMENT_CONFIRMED
```
Título: "Agendamento Confirmado"
Mensagem: "{cliente} confirmou o agendamento para {data} às {hora}"
Para: Master + Profissional
```

#### 3. APPOINTMENT_CANCELLED
```
Título: "Agendamento Cancelado"
Mensagem: "Agendamento de {cliente} em {data} foi cancelado"
Para: Master + Profissional + Cliente (WhatsApp)
```

#### 4. APPOINTMENT_REMINDER
```
Título: "Lembrete de Agendamento"
Mensagem: "Lembrete: Agendamento com {cliente} em {X} horas"
Para: Profissional + Cliente (WhatsApp)
```

### WhatsApp (Evolution API)

#### Configuração
```prisma
model WhatsAppConfig {
  id                String   @id @default(cuid())
  instanceName      String   @unique
  apiKey            String?
  apiUrl            String
  phoneNumber       String?
  isConnected       Boolean  @default(false)
  qrCode            String?  @db.Text
  
  // Configurações de notificações
  enabled           Boolean  @default(false)
  notifyOnCreate    Boolean  @default(true)
  notifyOnConfirm   Boolean  @default(true)
  notifyOnCancel    Boolean  @default(true)
  notifyReminder    Boolean  @default(true)
  reminderHours     Int      @default(24)
  
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])
}
```

#### Mensagens Template
```typescript
const templates = {
  APPOINTMENT_CREATED: `
    Olá {clientName}! 
    Seu agendamento foi confirmado:
    📅 {date}
    🕐 {time}
    💼 {service}
    👤 {professional}
    
    Local: {businessName}
    Endereço: {address}
  `,
  
  APPOINTMENT_REMINDER: `
    Olá {clientName}!
    Lembrete: Você tem um agendamento amanhã:
    🕐 {time} - {service}
    
    Para cancelar, responda CANCELAR
  `,
  
  APPOINTMENT_CANCELLED: `
    Olá {clientName},
    Seu agendamento para {date} às {time} foi cancelado.
    
    Para reagendar, acesse: {bookingUrl}
  `,
}
```

## 💻 Exemplos de Uso

### Criar Notificação Interna
```typescript
async function createNotification(data: NotificationData) {
  await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: data.userId,
      type: 'APPOINTMENT_CREATED',
      title: 'Novo Agendamento',
      message: `Agendamento criado para ${data.clientName}`,
      appointmentId: data.appointmentId,
    }),
  })
}
```

### Enviar WhatsApp
```typescript
async function sendWhatsApp(data: WhatsAppMessage) {
  await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: data.phoneNumber, // Formato: 5511999999999
      message: data.message,
      appointmentId: data.appointmentId,
    }),
  })
}
```

### Enviar Notificação Dual (Interno + WhatsApp)
```typescript
async function notifyAppointmentCreated(appointment: Appointment) {
  // 1. Notificação interna para master
  await createNotification({
    userId: appointment.userId,
    type: 'APPOINTMENT_CREATED',
    title: 'Novo Agendamento',
    message: `Criado para ${appointment.client.name}`,
    appointmentId: appointment.id,
  })
  
  // 2. Notificação interna para profissional
  if (appointment.professionalId) {
    await createNotification({
      userId: appointment.professionalId,
      type: 'APPOINTMENT_CREATED',
      title: 'Novo Agendamento',
      message: `Você tem um novo agendamento com ${appointment.client.name}`,
      appointmentId: appointment.id,
    })
  }
  
  // 3. WhatsApp para cliente (se habilitado)
  const config = await getWhatsAppConfig(appointment.userId)
  if (config?.enabled && config?.notifyOnCreate) {
    const message = formatTemplate('APPOINTMENT_CREATED', {
      clientName: appointment.client.name,
      date: format(appointment.date, 'dd/MM/yyyy'),
      time: format(appointment.date, 'HH:mm'),
      service: appointment.service?.name,
      professional: appointment.professionalUser?.name,
      businessName: appointment.user.businessName,
    })
    
    await sendWhatsApp({
      phoneNumber: appointment.client.phone,
      message,
      appointmentId: appointment.id,
    })
  }
}
```

## 🎨 Interface

### Badge de Notificações (Header)
```tsx
<NotificationBell>
  {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
  
  <DropdownMenu>
    <NotificationList>
      {notifications.slice(0, 5).map(notif => (
        <NotificationItem 
          key={notif.id}
          notification={notif}
          onRead={handleMarkAsRead}
        />
      ))}
    </NotificationList>
    
    <Button variant="link" href="/dashboard/notifications">
      Ver todas
    </Button>
  </DropdownMenu>
</NotificationBell>
```

### Página de Notificações
```tsx
<NotificationsPage>
  <Header>
    <h1>Notificações</h1>
    <Button onClick={markAllAsRead}>
      Marcar todas como lidas
    </Button>
  </Header>
  
  <Tabs>
    <Tab value="all">Todas</Tab>
    <Tab value="unread">Não lidas</Tab>
  </Tabs>
  
  <NotificationList>
    {notifications.map(notif => (
      <NotificationCard 
        key={notif.id}
        notification={notif}
      />
    ))}
  </NotificationList>
</NotificationsPage>
```

### Configuração WhatsApp
```tsx
<WhatsAppSettings>
  <ConnectionStatus status={config.isConnected} />
  
  {!config.isConnected && (
    <QRCode value={config.qrCode} />
  )}
  
  <Switch 
    name="enabled" 
    label="Enviar notificações via WhatsApp"
  />
  
  <CheckboxGroup label="Enviar em:">
    <Checkbox name="notifyOnCreate" label="Criação de agendamento" />
    <Checkbox name="notifyOnConfirm" label="Confirmação" />
    <Checkbox name="notifyOnCancel" label="Cancelamento" />
    <Checkbox name="notifyReminder" label="Lembretes" />
  </CheckboxGroup>
  
  <NumberInput 
    name="reminderHours" 
    label="Enviar lembrete (horas antes)"
  />
</WhatsAppSettings>
```

## 🔄 Automações

### Agendamento de Lembretes
```typescript
// Script executado periodicamente (cron job)
async function sendReminders() {
  const reminderTime = new Date()
  reminderTime.setHours(reminderTime.getHours() + 24) // 24h antes
  
  const appointments = await prisma.appointment.findMany({
    where: {
      date: {
        gte: reminderTime,
        lte: new Date(reminderTime.getTime() + 3600000), // +1 hora
      },
      status: {
        in: ['SCHEDULED', 'CONFIRMED'],
      },
    },
    include: { client: true, user: true, professionalUser: true },
  })
  
  for (const apt of appointments) {
    await notifyAppointmentReminder(apt)
  }
}
```

## 🎯 Casos de Uso

### 1. Cliente Recebe Confirmação
**Fluxo**:
1. Master cria agendamento
2. Sistema cria notificação interna
3. Sistema verifica config WhatsApp
4. Envia mensagem de confirmação para cliente
5. Cliente recebe WhatsApp com detalhes

### 2. Profissional Recebe Alerta
**Fluxo**:
1. Novo agendamento atribuído
2. Notificação aparece no sino (badge)
3. Profissional clica e vê detalhes
4. Marca como lida após visualizar

### 3. Lembrete Automático
**Fluxo**:
1. Cron job roda a cada hora
2. Identifica agendamentos nas próximas 24h
3. Envia WhatsApp para clientes
4. Cria notificação interna para profissional

## 🚀 Melhorias Futuras

- [ ] Notificações push (web push)
- [ ] Personalização de templates
- [ ] Multi-idioma
- [ ] SMS como canal adicional
- [ ] Email como canal
- [ ] Webhooks para integração
- [ ] Analytics de entrega
- [ ] Respostas automáticas (chatbot)
