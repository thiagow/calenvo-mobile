# Profissionais - Gestão de Equipe

## 📋 Descrição

Sistema de gerenciamento de profissionais da equipe, permitindo ao Master adicionar, configurar e gerenciar usuários com role PROFESSIONAL.

## 📍 Localização no Código

### Páginas
- **Listagem**: `/dashboard/professionals` → `app/dashboard/professionals/page.tsx`
- **Novo**: `/dashboard/professionals/new` → `app/dashboard/professionals/new/page.tsx`
- **Editar**: `/dashboard/professionals/[id]` → `app/dashboard/professionals/[id]/page.tsx`

### APIs
- `GET /api/professionals` - Listar profissionais
- `GET /api/professionals/[id]` - Buscar profissional específico
- `POST /api/professionals` - Criar novo profissional
- `PUT /api/professionals/[id]` - Atualizar profissional
- `DELETE /api/professionals/[id]` - Deletar/desativar profissional

## 🗄️ Modelo de Dados

```prisma
enum UserRole {
  MASTER        // Usuário que criou a conta
  PROFESSIONAL  // Profissional da equipe
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String
  password      String
  role          UserRole  @default(MASTER)
  whatsapp      String?
  isActive      Boolean   @default(true)
  
  // Relacionamento hierárquico
  masterId      String?   // ID do master (para profissionais)
  master        User?     @relation("MasterProfessionals", fields: [masterId], references: [id])
  professionals User[]    @relation("MasterProfessionals")
  
  // Agendamentos como profissional
  professionalAppointments Appointment[] @relation("ProfessionalAppointments")
  
  // Agendas vinculadas
  scheduleProfessionals ScheduleProfessional[]
  
  @@unique([email, role])
}
```

## 🎯 Funcionalidades

### Gestão de Profissionais (Apenas Master)

#### Criar Profissional
```typescript
interface CreateProfessionalData {
  name: string
  email: string
  password: string
  whatsapp?: string
  scheduleIds?: string[]  // Agendas vinculadas
}
```

#### Informações do Profissional
- Nome completo
- Email (login único por role)
- Senha (gerada ou definida)
- WhatsApp
- Status (ativo/inativo)
- Agendas vinculadas
- Estatísticas

### Permissões

#### Master pode:
- Criar profissionais
- Editar profissionais
- Desativar profissionais
- Vincular a agendas
- Ver estatísticas de todos

#### Profissional pode:
- Ver apenas seus dados
- Ver apenas seus agendamentos
- Editar seu perfil (limitado)
- Não pode criar outros profissionais

### Vinculação com Agendas
- Profissional vinculado a uma ou mais agendas
- Pode atender agendamentos dessas agendas
- Horários respeitam configuração da agenda

## 💻 Exemplos de Uso

### Criar Profissional
```typescript
async function createProfessional(data: CreateProfessionalData) {
  const response = await fetch('/api/professionals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      password: data.password, // Será hasheado no backend
      whatsapp: data.whatsapp,
      scheduleIds: data.scheduleIds,
    }),
  })
  
  return response.json()
}
```

### Vincular a Agendas
```typescript
async function linkProfessionalToSchedules(
  professionalId: string, 
  scheduleIds: string[]
) {
  const response = await fetch(`/api/professionals/${professionalId}/schedules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduleIds }),
  })
  
  return response.json()
}
```

### Buscar Profissionais Disponíveis
```typescript
async function getAvailableProfessionals(scheduleId: string, date: Date) {
  const params = new URLSearchParams({
    scheduleId,
    date: date.toISOString(),
  })
  
  const response = await fetch(`/api/professionals/available?${params}`)
  return response.json()
}
```

## 🎨 Interface

### Formulário
```tsx
<ProfessionalForm>
  <Input name="name" label="Nome Completo" required />
  <Input name="email" label="Email" type="email" required />
  <Input name="password" label="Senha" type="password" required />
  <Input name="whatsapp" label="WhatsApp" />
  
  <Switch name="isActive" label="Profissional Ativo" />
  
  <MultiSelect 
    name="scheduleIds" 
    label="Agendas Vinculadas"
    options={schedules}
  />
</ProfessionalForm>
```

### Lista de Profissionais
```tsx
<ProfessionalsTable>
  <Toolbar>
    <SearchBar />
    <Button href="/dashboard/professionals/new">
      Novo Profissional
    </Button>
  </Toolbar>
  
  <Table>
    <TableHeader>
      <Cell>Nome</Cell>
      <Cell>Email</Cell>
      <Cell>WhatsApp</Cell>
      <Cell>Agendas</Cell>
      <Cell>Agendamentos (mês)</Cell>
      <Cell>Status</Cell>
      <Cell>Ações</Cell>
    </TableHeader>
    
    <TableBody>
      {professionals.map(pro => (
        <ProfessionalRow 
          key={pro.id} 
          professional={pro}
          onEdit={handleEdit}
          onToggleStatus={handleToggleStatus}
        />
      ))}
    </TableBody>
  </Table>
</ProfessionalsTable>
```

### Perfil do Profissional
```tsx
<ProfessionalProfile professionalId={id}>
  <Header>
    <Avatar src={professional.image} />
    <div>
      <h1>{professional.name}</h1>
      <Badge>{professional.isActive ? 'Ativo' : 'Inativo'}</Badge>
    </div>
  </Header>
  
  <Stats>
    <StatCard title="Agendamentos (mês)" value={stats.appointmentsCount} />
    <StatCard title="Taxa de Conclusão" value={`${stats.completionRate}%`} />
    <StatCard title="Receita Gerada" value={formatCurrency(stats.revenue)} />
  </Stats>
  
  <SchedulesSection>
    <h2>Agendas Vinculadas</h2>
    <SchedulesList schedules={professional.schedules} />
  </SchedulesSection>
  
  <AppointmentsSection>
    <h2>Próximos Agendamentos</h2>
    <AppointmentsList appointments={upcomingAppointments} />
  </AppointmentsSection>
</ProfessionalProfile>
```

## 🔐 Validações e Regras

### Ao Criar/Editar
```typescript
// Validações
- Nome obrigatório
- Email único (considerando role)
- Senha mínima 8 caracteres (na criação)
- WhatsApp formato válido (se fornecido)
- Pelo menos 1 agenda vinculada (recomendado)
- Verificar limite do plano (número de profissionais)
```

### Hierarquia
```typescript
// Regras
- Master pode gerenciar todos os profissionais
- Profissional só vê seus próprios dados
- Profissional não pode criar outros profissionais
- Profissional não pode se auto-deletar
- Ao deletar profissional, agendamentos futuros devem ser tratados
```

## 🎯 Casos de Uso

### 1. Adicionar Profissional à Equipe
**Fluxo**:
1. Master acessa `/dashboard/professionals/new`
2. Preenche dados do profissional
3. Define senha inicial
4. Vincula a agendas específicas
5. Salva profissional
6. Sistema cria usuário com role PROFESSIONAL
7. Profissional recebe email com credenciais

### 2. Profissional Faz Login
**Fluxo**:
1. Profissional acessa `/login`
2. Insere email e senha
3. Sistema autentica e identifica role
4. Redirecionado ao dashboard
5. Vê apenas seus agendamentos
6. Acesso limitado às funcionalidades

### 3. Atribuir Agendamento a Profissional
**Fluxo**:
1. Master cria agendamento
2. Seleciona agenda
3. Sistema lista profissionais vinculados àquela agenda
4. Seleciona profissional disponível
5. Agendamento atribuído
6. Profissional recebe notificação

### 4. Desativar Profissional
**Fluxo**:
1. Profissional sai da equipe
2. Master desativa profissional
3. Sistema verifica agendamentos futuros
4. Opções: Reatribuir ou cancelar
5. Profissional não pode mais fazer login
6. Dados históricos mantidos

## 📊 Relatórios por Profissional

### Métricas Individuais
```typescript
interface ProfessionalMetrics {
  appointmentsTotal: number
  appointmentsCompleted: number
  appointmentsCancelled: number
  noShowCount: number
  completionRate: number
  averageRating?: number
  revenueGenerated: number
  hoursWorked: number
  utilizationRate: number  // % do tempo ocupado
}
```

### Comparação de Equipe
```typescript
// Ranking de profissionais
- Por número de atendimentos
- Por receita gerada
- Por taxa de conclusão
- Por avaliação média
```

## 🔗 Integrações

### Com Agendas
- Profissional vinculado a agendas
- Disponibilidade baseada na agenda

### Com Agendamentos
- Agendamentos atribuídos ao profissional
- Histórico de atendimentos

### Com Notificações
- Profissional recebe notificações de seus agendamentos
- WhatsApp (opcional)

## 🚀 Melhorias Futuras

- [ ] Especialidades/competências
- [ ] Certificações e documentos
- [ ] Avaliações de clientes
- [ ] Comissões personalizadas
- [ ] Metas individuais
- [ ] Férias e folgas
- [ ] Controle de ponto
- [ ] Permissões granulares
- [ ] Multi-localização
- [ ] Portfólio de trabalhos
