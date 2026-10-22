# Configurações - Configurações do Sistema e Negócio

## 📋 Descrição

Sistema de configurações gerais do negócio, incluindo horários de funcionamento, personalização, integrações e preferências.

## 📍 Localização no Código

### Páginas
- **Configurações Gerais**: `/dashboard/settings` → `app/dashboard/settings/page.tsx`
- **Chaves de API**: seção "Integrações (API)" de `/dashboard/settings#api` → `components/settings/api-keys-section.tsx` (só MASTER; `/dashboard/api-keys` redireciona para lá)
- **Segmento**: não é mais alterado pelo painel do negócio — só pelo SaaS Admin (`app/saas-admin/tenants/[id]`)
- **Perfil**: `/dashboard/profile` → `app/dashboard/profile/page.tsx`

### Componentes
- `components/settings/` - Componentes de configurações

### APIs
- `GET /api/settings` - Buscar configurações
- `PUT /api/settings` - Atualizar configurações
- `GET /api/user/profile` - Perfil do usuário
- `PUT /api/user/profile` - Atualizar perfil

## 🗄️ Modelo de Dados

```prisma
model BusinessConfig {
  id                String   @id @default(cuid())
  workingDays       Int[]    // [1,2,3,4,5] = Seg-Sex
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
  publicUrl         String?  // Slug único para booking
  
  // Específicos por segmento
  multipleServices  Boolean  @default(false)
  requiresDeposit   Boolean  @default(false)
  cancellationHours Int      @default(24)
  
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])
}

model User {
  // ... outros campos
  businessName  String?
  phone         String?
  segmentType   SegmentType @default(BEAUTY_SALON)
}

enum SegmentType {
  BEAUTY_SALON           // Salões de beleza
  BARBERSHOP            // Barbearias
  AESTHETIC_CLINIC      // Clínicas de estética
  TECH_SAAS             // Tecnologia e SaaS
  PROFESSIONAL_SERVICES // Consultorias e Mentorias
  HR                    // Recursos Humanos
  PHYSIOTHERAPY         // Clínicas de fisioterapia
  EDUCATION             // Aulas e Educação
  PET_SHOP              // Pet shops
  OTHER                 // Outros
}
```

## 🎯 Seções de Configuração

### 1. Informações do Negócio
```typescript
interface BusinessInfo {
  businessName: string
  segmentType: SegmentType
  phone: string
  email: string
  address?: string
  businessLogo?: string
}
```

### 2. Horário de Funcionamento
```typescript
interface BusinessHours {
  workingDays: number[]      // [0-6]
  startTime: string          // "08:00"
  endTime: string            // "18:00"
  defaultDuration: number    // 30 minutos
  lunchStart?: string
  lunchEnd?: string
  timezone: string
}
```

### 3. Configurações de Agendamento
```typescript
interface BookingSettings {
  autoConfirm: boolean              // Confirmar automaticamente
  allowOnlineBooking: boolean       // Permitir agendamento público
  publicUrl?: string                // calenvo.app/book/seu-negocio
  cancellationHours: number         // Horas mínimas para cancelar
  requiresDeposit: boolean          // Exigir sinal/depósito
  multipleServices: boolean         // Permitir múltiplos serviços
}
```

### 4. Notificações e Integrações
```typescript
interface IntegrationsSettings {
  // WhatsApp (Ver notificacoes.md)
  whatsapp: WhatsAppConfig
  
  // Email
  emailNotifications: boolean
  
  // Stripe
  stripeConnected: boolean
  
  // AWS S3
  awsS3Configured: boolean
}
```

### 5. Preferências do Usuário
```typescript
interface UserPreferences {
  language: string           // pt-BR, en-US
  theme: 'light' | 'dark'
  dateFormat: string         // dd/MM/yyyy
  timeFormat: '12h' | '24h'
  currency: string           // BRL, USD
}
```

## 💻 Exemplos de Uso

### Buscar Configurações
```typescript
async function getBusinessConfig() {
  const response = await fetch('/api/settings')
  const config = await response.json()
  return config
}
```

### Atualizar Configurações
```typescript
async function updateBusinessConfig(data: Partial<BusinessConfig>) {
  const response = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  
  return response.json()
}
```

### Atualizar Perfil
```typescript
async function updateProfile(data: ProfileData) {
  const response = await fetch('/api/user/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      phone: data.phone,
      businessName: data.businessName,
    }),
  })
  
  return response.json()
}
```

### Upload de Logo
```typescript
async function uploadLogo(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })
  
  const { url } = await response.json()
  
  // Atualizar config com URL do logo
  await updateBusinessConfig({ businessLogo: url })
  
  return url
}
```

## 🎨 Interface

### Página de Configurações
```tsx
<SettingsPage>
  <Tabs>
    <Tab value="general">Geral</Tab>
    <Tab value="business">Negócio</Tab>
    <Tab value="booking">Agendamento</Tab>
    <Tab value="notifications">Notificações</Tab>
    <Tab value="integrations">Integrações</Tab>
  </Tabs>
  
  <TabContent value="general">
    <ProfileSection>
      <AvatarUpload />
      <Input name="name" label="Nome" />
      <Input name="email" label="Email" />
      <Input name="phone" label="Telefone" />
    </ProfileSection>
    
    <PreferencesSection>
      <Select name="language" label="Idioma" />
      <Select name="theme" label="Tema" />
      <Select name="timezone" label="Fuso Horário" />
    </PreferencesSection>
  </TabContent>
  
  <TabContent value="business">
    <BusinessInfoSection>
      <ImageUpload name="businessLogo" label="Logo" />
      <Input name="businessName" label="Nome do Negócio" />
      <Select name="segmentType" label="Segmento" />
      <Input name="phone" label="Telefone Comercial" />
      <Textarea name="address" label="Endereço" />
    </BusinessInfoSection>
    
    <BusinessHoursSection>
      <WeekdaySelector name="workingDays" />
      <TimePicker name="startTime" label="Início" />
      <TimePicker name="endTime" label="Fim" />
      <TimePicker name="lunchStart" label="Almoço (início)" />
      <TimePicker name="lunchEnd" label="Almoço (fim)" />
    </BusinessHoursSection>
  </TabContent>
  
  <TabContent value="booking">
    <Switch 
      name="allowOnlineBooking" 
      label="Permitir agendamento online"
    />
    
    {allowOnlineBooking && (
      <PublicUrlSection>
        <Input 
          name="publicUrl" 
          label="URL Pública"
          prefix="calenvo.app/book/"
        />
        <CopyButton value={fullUrl} />
      </PublicUrlSection>
    )}
    
    <Switch name="autoConfirm" label="Confirmar automaticamente" />
    <Switch name="requiresDeposit" label="Exigir sinal/depósito" />
    <NumberInput 
      name="cancellationHours" 
      label="Horas mínimas para cancelamento"
    />
  </TabContent>
  
  <TabContent value="notifications">
    <WhatsAppSettings />
    <EmailSettings />
  </TabContent>
  
  <TabContent value="integrations">
    <StripeIntegration />
    <AWSS3Integration />
  </TabContent>
</SettingsPage>
```

## 🔐 Permissões

### Master
- Acesso completo a todas as configurações
- Pode alterar configurações críticas
- Gerenciar integrações

### Profissional
- Apenas perfil pessoal
- Preferências de interface
- Sem acesso a configurações do negócio

## 🎯 Casos de Uso

### 1. Configurar Negócio Inicial
**Fluxo**:
1. Usuário faz cadastro
2. É direcionado para configurações
3. Preenche informações do negócio
4. Define horários de funcionamento
5. Escolhe segmento
6. Upload de logo
7. Configurações básicas salvas

### 2. Ativar Agendamento Online
**Fluxo**:
1. Acessa configurações de agendamento
2. Ativa "Permitir agendamento online"
3. Define URL personalizada
4. Sistema valida disponibilidade do slug
5. Salva e ativa URL pública
6. Pode compartilhar link com clientes

### 3. Configurar WhatsApp
**Fluxo**:
1. Acessa "Notificações"
2. Clica em "Configurar WhatsApp"
3. Insere dados da Evolution API
4. Escaneia QR Code
5. Conexão estabelecida
6. Configura tipos de notificação
7. Define horário dos lembretes

### 4. Alterar Horário de Funcionamento
**Fluxo**:
1. Acessa aba "Negócio"
2. Altera horário de fim para 20:00
3. Salva alterações
4. Sistema valida agendamentos futuros
5. Ajusta disponibilidade das agendas

## 🔄 Validações

### Horários
```typescript
// Validações
- startTime < endTime
- lunchStart < lunchEnd (se definidos)
- lunchStart >= startTime
- lunchEnd <= endTime
- Pelo menos 1 dia da semana selecionado
```

### URL Pública
```typescript
// Validações
- Slug único (não pode estar em uso)
- Apenas letras, números e hífens
- Mínimo 3 caracteres
- Máximo 50 caracteres
- Não pode ser palavra reservada (admin, api, etc)
```

### Logo/Imagens
```typescript
// Validações
- Formato: JPG, PNG, WebP
- Tamanho máximo: 5MB
- Dimensões recomendadas: 500x500px (quadrado)
```

## 📊 Configurações por Segmento

### Salão de Beleza / Barbearia
```typescript
{
  multipleServices: true,       // Pode agendar corte + barba
  requiresDeposit: false,
  defaultDuration: 60,
  features: ['produtos', 'profissional_preferido']
}
```

### Clínica (Médica, Estética, Fisio)
```typescript
{
  multipleServices: false,
  requiresDeposit: false,
  defaultDuration: 60,
  features: ['prontuario', 'convenio', 'especialidade']
}
```

### Consultoria / Mentoria
```typescript
{
  multipleServices: false,
  requiresDeposit: true,
  defaultDuration: 90,
  features: ['teleconsulta', 'contrato']
}
```

## 🚀 Melhorias Futuras

- [ ] Temas personalizados (cores)
- [ ] Multi-localização (várias unidades)
- [ ] Configurações por profissional
- [ ] Templates de mensagens customizáveis
- [ ] Backup e restauração
- [ ] Auditoria de alterações
- [ ] Configurações avançadas de privacidade (LGPD)
- [ ] Integração com mais gateways de pagamento
- [ ] API pública (webhooks)
