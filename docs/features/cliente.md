# Cliente (Clients) - Gestão de Clientes/Pacientes

## 📋 Descrição

Sistema de gerenciamento de clientes (anteriormente chamados de "patients"), permitindo cadastrar, visualizar, editar e manter o histórico de atendimentos.

## 📍 Localização no Código

### Páginas
- **Listagem**: `/dashboard/clients` → `app/dashboard/clients/page.tsx`

### APIs
- `GET /api/clients` - Listar clientes
- `GET /api/clients/[id]` - Buscar cliente específico
- `POST /api/clients` - Criar novo cliente
- `PUT /api/clients/[id]` - Atualizar cliente
- `DELETE /api/clients/[id]` - Deletar cliente

## 🗄️ Modelo de Dados

```prisma
model Client {
  id          String   @id @default(cuid())
  name        String
  email       String?
  phone       String
  cpf         String?
  birthDate   DateTime?
  address     String?
  notes       String?   // Observações gerais
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userId      String
  user        User     @relation(fields: [userId], references: [id])
  appointments Appointment[]

  @@unique([cpf, userId])
}
```

## 🎯 Funcionalidades

### CRUD Completo
- **Create**: Cadastrar novo cliente
- **Read**: Visualizar detalhes e listagem
- **Update**: Editar informações
- **Delete**: Remover cliente (soft delete recomendado)

### Informações Armazenadas
- Nome completo
- Email (opcional)
- Telefone/WhatsApp
- CPF (opcional, único por usuário)
- Data de nascimento
- Endereço completo
- Observações/notas

### Funcionalidades Adicionais
- **Histórico de agendamentos**: Ver todos os atendimentos anteriores
- **Busca rápida**: Por nome, telefone ou email
- **Filtros**: Por status, período de cadastro
- **Exportação**: CSV/Excel da lista de clientes

## 💻 Exemplos de Uso

### Criar Cliente
```typescript
async function createClient(data: ClientData) {
  const response = await fetch('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      phone: data.phone,
      cpf: data.cpf,
      birthDate: data.birthDate,
      address: data.address,
      notes: data.notes,
    }),
  })
  
  return response.json()
}
```

### Buscar Cliente com Histórico
```typescript
async function getClientWithHistory(id: string) {
  const response = await fetch(`/api/clients/${id}?include=appointments`)
  const data = await response.json()
  
  return {
    client: data.client,
    appointments: data.appointments,
    stats: {
      totalAppointments: data.appointments.length,
      completedAppointments: data.appointments.filter(a => a.status === 'COMPLETED').length,
      noShows: data.appointments.filter(a => a.status === 'NO_SHOW').length,
    }
  }
}
```

## 🎨 Interface

### Formulário
```tsx
<ClientForm>
  <Input name="name" label="Nome Completo" required />
  <Input name="phone" label="Telefone" required type="tel" />
  <Input name="email" label="Email" type="email" />
  <Input name="cpf" label="CPF" mask="999.999.999-99" />
  <DatePicker name="birthDate" label="Data de Nascimento" />
  <Textarea name="address" label="Endereço" />
  <Textarea name="notes" label="Observações" />
</ClientForm>
```

### Lista de Clientes
```tsx
<ClientsTable>
  <SearchBar placeholder="Buscar por nome, telefone..." />
  <Table>
    <TableHeader>
      <Cell>Nome</Cell>
      <Cell>Telefone</Cell>
      <Cell>Email</Cell>
      <Cell>Total de Agendamentos</Cell>
      <Cell>Ações</Cell>
    </TableHeader>
    <TableBody>
      {clients.map(client => (
        <ClientRow key={client.id} client={client} />
      ))}
    </TableBody>
  </Table>
</ClientsTable>
```

## 🔐 Validações

```typescript
// Validações
- Nome obrigatório (min 3 caracteres)
- Telefone obrigatório (formato válido)
- CPF único por usuário (se fornecido)
- Email válido (se fornecido)
- Data de nascimento não pode ser futura
```

## 🎯 Casos de Uso

### 1. Cadastro Rápido Durante Agendamento
**Fluxo**:
1. Master cria novo agendamento
2. Cliente não existe ainda
3. Clica em "Novo Cliente" no formulário
4. Preenche apenas nome e telefone
5. Salva e vincula ao agendamento

### 2. Visualizar Histórico do Cliente
**Fluxo**:
1. Acessa lista de clientes
2. Clica em cliente específico
3. Vê perfil completo
4. Vê histórico de todos os agendamentos
5. Pode agendar novo compromisso

### 3. Atualizar Dados de Contato
**Fluxo**:
1. Cliente informa novo telefone
2. Master edita cadastro
3. Atualiza informações
4. Novos agendamentos usam contato atualizado

## 🔗 Integrações

### Com Agendamentos
- Cada agendamento vinculado a um cliente
- Histórico completo de atendimentos
- Estatísticas do cliente

### Com Notificações/WhatsApp
- Usa telefone do cliente para envio
- Email para confirmações

## 🚀 Melhorias Futuras

- [ ] Fotos de perfil
- [ ] Tags/categorias de clientes
- [ ] Aniversariantes do mês
- [ ] Programas de fidelidade
- [ ] Notas médicas/fichas (clínicas)
- [ ] Assinatura digital (LGPD)
- [ ] Importação em lote (CSV)
- [ ] Integração com CRM
