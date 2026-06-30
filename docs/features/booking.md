# Booking - Agendamento Público (Cliente)

## 📋 Descrição

Página pública de agendamento onde clientes podem fazer agendamentos online sem necessidade de login, similar ao Calendly.

## 📍 Localização no Código

### Páginas
- **Booking**: `/booking/[slug]` → `app/booking/[slug]/page.tsx`

### APIs
- `GET /api/booking/[slug]` - Buscar configurações públicas
- `GET /api/booking/[slug]/schedules` - Listar agendas disponíveis
- `GET /api/booking/[slug]/services` - Listar serviços
- `GET /api/booking/[slug]/availability` - Verificar horários disponíveis
- `POST /api/booking/[slug]/appointment` - Criar agendamento público

## 🎯 Funcionalidades

### URL Pública
```
https://calenvo.app/booking/nome-do-negocio
```

- Slug único por conta
- Configurável em Settings
- Pode ser customizado
- Compartilhável (WhatsApp, redes sociais, email)

### Fluxo de Agendamento

#### 1. Seleção de Serviço
- Lista de serviços ativos
- Exibe nome, descrição, duração e preço
- Cards visuais com cores
- Filtro por categoria (opcional)

#### 2. Seleção de Profissional
- Lista profissionais vinculados ao serviço/agenda
- Opção "Qualquer profissional"
- Foto e nome do profissional
- Se apenas 1, pula esta etapa

#### 3. Escolha de Data e Horário
- Calendário visual
- Apenas dias disponíveis clicáveis
- Lista de horários disponíveis no dia
- Considera bloqueios e agendamentos existentes
- Respeita minNoticeHours da agenda

#### 4. Dados do Cliente
- Nome completo
- Telefone (WhatsApp)
- Email (opcional)
- Observações (opcional)

#### 5. Confirmação
- Resumo do agendamento
- Detalhes: serviço, profissional, data/hora
- Local (se configurado)
- Botão "Confirmar Agendamento"

#### 6. Conclusão
- Mensagem de sucesso
- Envio de confirmação por WhatsApp
- Opção de adicionar ao calendário (iCal)
- Compartilhar nas redes

## 💻 Exemplos de Uso

### Buscar Disponibilidade
```typescript
async function getAvailability(
  slug: string,
  scheduleId: string,
  serviceId: string,
  professionalId: string | null,
  date: Date
) {
  const params = new URLSearchParams({
    scheduleId,
    serviceId,
    date: format(date, 'yyyy-MM-dd'),
  })
  
  if (professionalId) {
    params.append('professionalId', professionalId)
  }
  
  const response = await fetch(
    `/api/booking/${slug}/availability?${params}`
  )
  
  const data = await response.json()
  
  // Retorna: { slots: ["09:00", "09:30", "10:00", ...] }
  return data.slots
}
```

### Criar Agendamento Público
```typescript
async function createPublicAppointment(data: PublicAppointmentData) {
  const response = await fetch(`/api/booking/${data.slug}/appointment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scheduleId: data.scheduleId,
      serviceId: data.serviceId,
      professionalId: data.professionalId,
      date: data.date,
      time: data.time,
      
      // Dados do cliente
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      clientEmail: data.clientEmail,
      notes: data.notes,
    }),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message)
  }
  
  return response.json()
}
```

## 🎨 Interface

### Página de Booking
```tsx
<BookingPage slug={slug}>
  <Header>
    <BusinessLogo src={config.businessLogo} />
    <h1>{config.businessName}</h1>
    <p>{config.description}</p>
  </Header>
  
  {step === 'service' && (
    <ServiceSelection
      services={services}
      onSelect={handleServiceSelect}
    />
  )}
  
  {step === 'professional' && (
    <ProfessionalSelection
      professionals={professionals}
      onSelect={handleProfessionalSelect}
      onSkip={handleSkipProfessional}
    />
  )}
  
  {step === 'datetime' && (
    <DateTimeSelection
      schedule={selectedSchedule}
      service={selectedService}
      professional={selectedProfessional}
      onSelect={handleDateTimeSelect}
    />
  )}
  
  {step === 'details' && (
    <ClientDetailsForm
      onSubmit={handleSubmit}
    />
  )}
  
  {step === 'confirmation' && (
    <ConfirmationScreen
      appointment={appointment}
      onAddToCalendar={handleAddToCalendar}
    />
  )}
  
  <StepIndicator currentStep={step} totalSteps={4} />
</BookingPage>
```

### Seleção de Data/Hora
```tsx
<DateTimeSelection>
  <Calendar
    minDate={new Date()}
    maxDate={addDays(new Date(), config.advanceBookingDays)}
    disabledDays={getDisabledDays()}
    onSelect={handleDateSelect}
  />
  
  {selectedDate && (
    <TimeSlotGrid>
      {availableSlots.map(slot => (
        <TimeSlot
          key={slot}
          time={slot}
          onClick={() => handleTimeSelect(slot)}
        />
      ))}
      
      {availableSlots.length === 0 && (
        <EmptyState>
          Nenhum horário disponível neste dia.
          Tente outra data.
        </EmptyState>
      )}
    </TimeSlotGrid>
  )}
</DateTimeSelection>
```

## 🔐 Validações

### Backend
```typescript
async function validatePublicBooking(data: BookingData) {
  // 1. Verificar se agendamento online está habilitado
  const config = await getBusinessConfigBySlug(data.slug)
  if (!config.allowOnlineBooking) {
    throw new Error('Agendamento online desabilitado')
  }
  
  // 2. Verificar disponibilidade real
  const isAvailable = await checkAvailability({
    scheduleId: data.scheduleId,
    date: data.date,
    time: data.time,
    duration: data.service.duration,
  })
  
  if (!isAvailable) {
    throw new Error('Horário não disponível')
  }
  
  // 3. Verificar limite do plano
  const canBook = await checkPlanLimit(config.userId, 'appointments')
  if (!canBook) {
    throw new Error('Limite de agendamentos atingido')
  }
  
  // 4. Verificar se já existe cliente com mesmo telefone
  let client = await prisma.client.findFirst({
    where: {
      phone: data.clientPhone,
      userId: config.userId,
    },
  })
  
  // 5. Criar cliente se não existir
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: data.clientName,
        phone: data.clientPhone,
        email: data.clientEmail,
        userId: config.userId,
      },
    })
  }
  
  return client
}
```

## 🎯 Casos de Uso

### 1. Cliente Agenda Corte de Cabelo
**Fluxo**:
1. Cliente recebe link: `calenvo.app/booking/barbearia-silva`
2. Vê página com logo e serviços
3. Seleciona "Corte Masculino"
4. Escolhe barbeiro "João"
5. Vê calendário, seleciona amanhã
6. Escolhe horário "14:00"
7. Preenche nome e telefone
8. Confirma agendamento
9. Recebe WhatsApp de confirmação

### 2. Cliente Agenda sem Profissional Específico
**Fluxo**:
1. Acessa página de booking
2. Seleciona serviço
3. Clica em "Qualquer profissional"
4. Sistema atribui automaticamente
5. Prossegue com data/hora
6. Agendamento criado

### 3. Reagendamento (Futuro)
**Fluxo**:
1. Cliente recebe link de gerenciamento
2. Acessa e vê agendamento existente
3. Clica em "Reagendar"
4. Escolhe nova data/hora
5. Confirma alteração
6. Recebe notificação

## 🎨 Personalização (Branding)

### Configurações de Aparência
```typescript
interface BookingPageConfig {
  // Branding
  businessLogo: string
  businessName: string
  primaryColor: string
  backgroundColor: string
  
  // Conteúdo
  welcomeMessage: string
  description: string
  address: string
  phone: string
  
  // SEO
  metaTitle: string
  metaDescription: string
  
  // Features
  showProfessionalPhotos: boolean
  showPrices: boolean
  requireEmail: boolean
  termsAndConditionsUrl?: string
}
```

### Exemplo Customizado
```tsx
<BookingPage
  style={{
    '--primary-color': config.primaryColor,
    '--background-color': config.backgroundColor,
  }}
>
  <StyledHeader backgroundColor={config.backgroundColor}>
    <img src={config.businessLogo} alt={config.businessName} />
    <h1 style={{ color: config.primaryColor }}>
      {config.businessName}
    </h1>
  </StyledHeader>
  {/* ... */}
</BookingPage>
```

## 🔗 Compartilhamento

### Métodos
- **Link direto**: Copiar URL
- **QR Code**: Gerar e imprimir
- **WhatsApp**: Compartilhar link
- **Redes sociais**: Facebook, Instagram
- **Email**: Enviar para lista de clientes
- **Widget**: Embed em site próprio

### Widget Embed
```html
<!-- Código para incorporar em site -->
<iframe 
  src="https://calenvo.app/booking/nome-do-negocio"
  width="100%"
  height="800px"
  frameborder="0"
></iframe>
```

## 📊 Analytics (Futuro)

### Métricas de Booking
- Taxa de conversão (visitas → agendamentos)
- Abandono por etapa
- Serviços mais populares
- Horários mais escolhidos
- Origem do tráfego

## 🚀 Melhorias Futuras

- [ ] Pagamento online (depósito/total)
- [ ] Múltiplos serviços em um agendamento
- [ ] Agendamento recorrente
- [ ] Lista de espera
- [ ] Cupons de desconto
- [ ] Programa de indicação
- [ ] Cancelamento/reagendamento pelo cliente
- [ ] Avaliação pós-atendimento
- [ ] Chat ao vivo
- [ ] Multi-idioma
- [ ] Temas personalizados
- [ ] A/B testing
