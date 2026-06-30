# Serviços - Gestão de Serviços/Procedimentos

## 📋 Descrição

Sistema de cadastro e gerenciamento de serviços/procedimentos oferecidos pelo negócio (cortes, consultas, procedimentos, etc.).

## 📍 Localização no Código

### Páginas
- **Listagem**: `/dashboard/services` → `app/dashboard/services/page.tsx`
- **Novo**: `/dashboard/services/new` → `app/dashboard/services/new/page.tsx`
- **Editar**: `/dashboard/services/[id]` → `app/dashboard/services/[id]/page.tsx`

### APIs
- `GET /api/services` - Listar serviços
- `GET /api/services/[id]` - Buscar serviço específico
- `POST /api/services` - Criar novo serviço
- `PUT /api/services/[id]` - Atualizar serviço
- `DELETE /api/services/[id]` - Deletar serviço

## 🗄️ Modelo de Dados

```prisma
model Service {
  id            String   @id @default(cuid())
  name          String   // Ex: "Corte Masculino", "Consulta Cardiologia"
  description   String?
  duration      Int      @default(30) // em minutos
  price         Float?
  category      String?  // Ex: "Consultas", "Cortes", "Coloração"
  isActive      Boolean  @default(true)
  
  // Específicos por segmento
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

## 🎯 Funcionalidades

### CRUD Completo
- **Create**: Cadastrar novo serviço
- **Read**: Visualizar detalhes e listagem
- **Update**: Editar informações
- **Delete**: Remover ou desativar serviço

### Informações do Serviço
- Nome (obrigatório)
- Descrição detalhada
- Duração padrão (minutos)
- Preço
- Categoria/tipo
- Status (ativo/inativo)
- Requer depósito
- Valor do depósito

### Organização
- **Categorias**: Agrupar serviços similares
- **Filtros**: Por categoria, status, preço
- **Busca**: Por nome ou descrição
- **Ordenação**: Por nome, preço, duração

## 💻 Exemplos de Uso

### Criar Serviço
```typescript
async function createService(data: ServiceData) {
  const response = await fetch('/api/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      duration: data.duration,
      price: data.price,
      category: data.category,
      requiresDeposit: data.requiresDeposit,
      depositAmount: data.depositAmount,
    }),
  })
  
  return response.json()
}
```

### Listar Serviços com Filtros
```typescript
async function getServices(filters?: ServiceFilters) {
  const params = new URLSearchParams()
  
  if (filters?.category) params.append('category', filters.category)
  if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive))
  
  const response = await fetch(`/api/services?${params}`)
  return response.json()
}
```

## 🎨 Interface

### Formulário
```tsx
<ServiceForm>
  <Input name="name" label="Nome do Serviço" required />
  <Textarea name="description" label="Descrição" />
  
  <Grid cols={2}>
    <NumberInput 
      name="duration" 
      label="Duração (min)" 
      min={15} 
      step={15}
    />
    <CurrencyInput name="price" label="Preço" />
  </Grid>
  
  <Select name="category" label="Categoria" createable />
  
  <Switch name="isActive" label="Serviço Ativo" />
  
  <Switch name="requiresDeposit" label="Requer Depósito/Sinal" />
  
  {requiresDeposit && (
    <CurrencyInput name="depositAmount" label="Valor do Depósito" />
  )}
</ServiceForm>
```

### Lista de Serviços
```tsx
<ServicesTable>
  <Toolbar>
    <SearchBar placeholder="Buscar serviços..." />
    <CategoryFilter categories={categories} />
    <Button href="/dashboard/services/new">Novo Serviço</Button>
  </Toolbar>
  
  <Table>
    <TableHeader>
      <Cell>Nome</Cell>
      <Cell>Categoria</Cell>
      <Cell>Duração</Cell>
      <Cell>Preço</Cell>
      <Cell>Status</Cell>
      <Cell>Ações</Cell>
    </TableHeader>
    
    <TableBody>
      {services.map(service => (
        <ServiceRow 
          key={service.id} 
          service={service}
          onEdit={handleEdit}
          onToggleStatus={handleToggleStatus}
        />
      ))}
    </TableBody>
  </Table>
</ServicesTable>
```

## 🔐 Validações

```typescript
// Validações
- Nome obrigatório (mín 3 caracteres)
- Duração >= 15 minutos
- Duração <= 480 minutos (8 horas)
- Preço >= 0 (se fornecido)
- depositAmount requerido se requiresDeposit = true
- depositAmount <= price (se ambos definidos)
```

## 🎯 Casos de Uso

### 1. Cadastrar Serviços Iniciais (Barbearia)
**Fluxo**:
1. Master acessa `/dashboard/services/new`
2. Cria "Corte Masculino" - 30min - R$ 40,00 - Categoria: Cortes
3. Cria "Barba" - 20min - R$ 25,00 - Categoria: Barba
4. Cria "Combo Corte + Barba" - 45min - R$ 60,00 - Categoria: Combos
5. Vincula serviços às agendas

### 2. Serviço com Depósito (Coloração)
**Fluxo**:
1. Cria serviço "Coloração Completa"
2. Define duração: 180 minutos
3. Define preço: R$ 300,00
4. Ativa "Requer Depósito"
5. Define depósito: R$ 100,00 (33%)
6. Ao criar agendamento, sistema solicita depósito

### 3. Organizar por Categorias
**Fluxo**:
1. Cria categorias: "Cortes", "Coloração", "Tratamentos"
2. Atribui cada serviço a uma categoria
3. Na listagem, filtra por categoria
4. Facilita navegação e seleção

## 🔗 Integrações

### Com Agendas (Schedules)
- Serviços vinculados a agendas específicas
- Pode ter duração/preço customizado por agenda
- Apenas serviços vinculados aparecem no booking

### Com Agendamentos (Appointments)
- Serviço selecionado determina duração padrão
- Preço pode ser sobrescrito no agendamento
- Estatísticas por serviço

### Com Relatórios
- Serviços mais populares
- Receita por serviço
- Tempo médio de execução

## 📊 Exemplos por Segmento

### Salão de Beleza
```typescript
[
  { name: "Corte Feminino", duration: 60, price: 80, category: "Cortes" },
  { name: "Escova", duration: 45, price: 50, category: "Tratamentos" },
  { name: "Coloração", duration: 180, price: 200, category: "Coloração" },
  { name: "Manicure", duration: 45, price: 40, category: "Estética" },
]
```

### Clínica Médica
```typescript
[
  { name: "Consulta Cardiologia", duration: 60, price: 350, category: "Consultas" },
  { name: "Eletrocardiograma", duration: 30, price: 150, category: "Exames" },
  { name: "Retorno", duration: 30, price: 200, category: "Consultas" },
]
```

### Consultoria
```typescript
[
  { name: "Sessão de Mentoria", duration: 90, price: 500, category: "Mentoria" },
  { name: "Consultoria Empresarial", duration: 120, price: 1200, category: "Consultoria" },
  { name: "Workshop", duration: 240, price: 800, category: "Treinamentos" },
]
```

## 🚀 Melhorias Futuras

- [ ] Pacotes de serviços (bundles)
- [ ] Serviços recorrentes
- [ ] Precificação dinâmica (horários de pico)
- [ ] Descontos e promoções
- [ ] Imagens dos serviços
- [ ] Requisitos/pré-requisitos
- [ ] Comissões por serviço
- [ ] Tempo de preparo/limpeza
- [ ] Materiais/produtos necessários
- [ ] Níveis de experiência (júnior, pleno, sênior)
