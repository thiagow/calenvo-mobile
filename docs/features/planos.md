# Planos - Gestão de Planos e Assinaturas

## 📋 Descrição

Sistema de gerenciamento de planos de assinatura com integração ao Stripe, controle de limites e upgrade/downgrade.

## 📍 Localização no Código

### Páginas
- **Planos**: `/dashboard/plans` → `app/dashboard/plans/page.tsx`

### APIs
- `GET /api/stripe/plans` - Listar planos disponíveis
- `POST /api/stripe/checkout` - Criar sessão de checkout
- `POST /api/stripe/portal` - Portal de gerenciamento
- `POST /api/stripe/webhook` - Webhook do Stripe
- `GET /api/user/plan` - Plano atual do usuário
- `PATCH /api/user/plan` - Atualizar plano

## 🗄️ Modelo de Dados

```prisma
enum PlanType {
  FREEMIUM
  STANDARD
  PREMIUM
}

model User {
  // ... outros campos
  planType      PlanType  @default(FREEMIUM)
  stripeCustomerId String?
  subscriptionId String?
  subscriptionStatus String?
  // ... 
  planUsage     PlanUsage?
}

model PlanUsage {
  id                 String   @id @default(cuid())
  appointmentsCount  Int      @default(0)
  currentPeriodStart DateTime @default(now())
  currentPeriodEnd   DateTime
  resetAt            DateTime
  
  userId             String   @unique
  user               User     @relation(fields: [userId], references: [id])
}
```

## 🎯 Planos Disponíveis

### FREEMIUM (Gratuito)
```typescript
{
  name: "Freemium",
  price: 0,
  currency: "BRL",
  interval: "month",
  features: {
    appointmentsPerMonth: 50,
    professionals: 1,
    schedules: 2,
    services: 10,
    clients: 100,
    whatsapp: false,
    reports: "basic",
    support: "email",
    customBranding: false,
  }
}
```

### STANDARD (Padrão)
```typescript
{
  name: "Standard",
  price: 49.90,
  currency: "BRL",
  interval: "month",
  features: {
    appointmentsPerMonth: 200,
    professionals: 5,
    schedules: 10,
    services: 50,
    clients: 1000,
    whatsapp: true,
    reports: "advanced",
    support: "priority",
    customBranding: true,
  }
}
```

### PREMIUM (Premium)
```typescript
{
  name: "Premium",
  price: 99.90,
  currency: "BRL",
  interval: "month",
  features: {
    appointmentsPerMonth: -1, // Ilimitado
    professionals: -1,
    schedules: -1,
    services: -1,
    clients: -1,
    whatsapp: true,
    reports: "full",
    support: "24/7",
    customBranding: true,
    api: true,
    multiLocation: true,
  }
}
```

## 🔐 Validações e Limites

### Verificar Limite
```typescript
async function checkPlanLimit(userId: string, resource: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { planUsage: true },
  })
  
  const limits = PLAN_LIMITS[user.planType]
  
  switch (resource) {
    case 'appointments':
      if (limits.appointmentsPerMonth === -1) return true
      return user.planUsage.appointmentsCount < limits.appointmentsPerMonth
      
    case 'professionals':
      const profCount = await prisma.user.count({
        where: { masterId: userId, role: 'PROFESSIONAL' }
      })
      return limits.professionals === -1 || profCount < limits.professionals
      
    // ... outros recursos
  }
}
```

### Incrementar Uso
```typescript
async function incrementAppointmentUsage(userId: string) {
  const planUsage = await prisma.planUsage.findUnique({
    where: { userId },
  })
  
  // Verificar se período resetou
  if (new Date() > planUsage.resetAt) {
    await prisma.planUsage.update({
      where: { userId },
      data: {
        appointmentsCount: 1,
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), 1),
        resetAt: addMonths(new Date(), 1),
      },
    })
  } else {
    await prisma.planUsage.update({
      where: { userId },
      data: {
        appointmentsCount: { increment: 1 },
      },
    })
  }
}
```

## 💻 Integração com Stripe

### Criar Checkout Session
```typescript
async function createCheckoutSession(userId: string, planType: PlanType) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  
  // Criar ou recuperar customer no Stripe
  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    })
    customerId = customer.id
    
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    })
  }
  
  // Buscar price ID do plano
  const priceId = STRIPE_PRICE_IDS[planType]
  
  // Criar sessão de checkout
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price: priceId,
      quantity: 1,
    }],
    success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard/plans?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/dashboard/plans?canceled=true`,
  })
  
  return session
}
```

### Processar Webhook
```typescript
async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session
      await activateSubscription(session)
      break
      
    case 'customer.subscription.updated':
      const subscription = event.data.object as Stripe.Subscription
      await updateSubscriptionStatus(subscription)
      break
      
    case 'customer.subscription.deleted':
      const cancelled = event.data.object as Stripe.Subscription
      await handleCancellation(cancelled)
      break
  }
}

async function activateSubscription(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionId: session.subscription as string,
      subscriptionStatus: 'active',
      planType: session.metadata?.planType as PlanType,
    },
  })
}
```

## 🎨 Interface

### Página de Planos
```tsx
<PlansPage>
  <Header>
    <h1>Planos e Assinaturas</h1>
    {currentPlan && (
      <CurrentPlanBadge plan={currentPlan} />
    )}
  </Header>
  
  <UsageStats>
    <StatCard 
      title="Agendamentos este mês" 
      value={`${usage.appointmentsCount} / ${limit}`}
      progress={usage.appointmentsCount / limit * 100}
    />
  </UsageStats>
  
  <PlansGrid>
    {plans.map(plan => (
      <PlanCard 
        key={plan.type}
        plan={plan}
        current={plan.type === currentPlan}
        onSelect={() => handleSelectPlan(plan.type)}
      />
    ))}
  </PlansGrid>
  
  {hasActiveSubscription && (
    <Button onClick={openStripePortal}>
      Gerenciar Assinatura
    </Button>
  )}
</PlansPage>
```

### Card de Plano
```tsx
<PlanCard>
  <PlanName>{plan.name}</PlanName>
  <PlanPrice>
    {plan.price === 0 ? 'Gratuito' : `R$ ${plan.price}/mês`}
  </PlanPrice>
  
  <FeaturesList>
    <Feature>
      ✓ {plan.features.appointmentsPerMonth === -1 
        ? 'Agendamentos ilimitados' 
        : `${plan.features.appointmentsPerMonth} agendamentos/mês`}
    </Feature>
    <Feature>
      ✓ {plan.features.professionals === -1 
        ? 'Profissionais ilimitados' 
        : `Até ${plan.features.professionals} profissionais`}
    </Feature>
    {/* ... */}
  </FeaturesList>
  
  <Button 
    onClick={handleSelectPlan}
    disabled={isCurrent}
  >
    {isCurrent ? 'Plano Atual' : 'Selecionar'}
  </Button>
</PlanCard>
```

## 🎯 Casos de Uso

### 1. Upgrade de Plano
**Fluxo**:
1. Usuário acessa `/dashboard/plans`
2. Vê plano atual e uso
3. Clica em "Selecionar" no plano superior
4. Redirecionado para checkout Stripe
5. Preenche dados de pagamento
6. Confirma
7. Webhook atualiza plano no sistema
8. Limites aumentados imediatamente

### 2. Atingir Limite do Plano
**Fluxo**:
1. Usuário tenta criar 51º agendamento (Freemium)
2. Sistema verifica limite
3. Bloqueia ação e exibe modal
4. "Você atingiu o limite. Faça upgrade!"
5. Botão para página de planos
6. Pode fazer upgrade ou aguardar reset mensal

### 3. Cancelamento de Assinatura
**Fluxo**:
1. Usuário acessa gerenciamento
2. Clica em "Gerenciar Assinatura"
3. Redirecionado ao Stripe Portal
4. Cancela assinatura
5. Webhook recebido
6. Plano ativo até fim do período pago
7. Depois volta para Freemium automaticamente

## 📊 Métricas de Planos

### MRR (Monthly Recurring Revenue)
```typescript
async function calculateMRR() {
  const activeSubscriptions = await prisma.user.count({
    where: {
      subscriptionStatus: 'active',
      planType: { not: 'FREEMIUM' },
    },
    groupBy: ['planType'],
  })
  
  const mrr = activeSubscriptions.reduce((total, sub) => {
    return total + (PLAN_PRICES[sub.planType] * sub._count)
  }, 0)
  
  return mrr
}
```

### Churn Rate
```typescript
async function calculateChurnRate(period: 'month' | 'year') {
  const startOfPeriod = period === 'month' 
    ? startOfMonth(new Date()) 
    : startOfYear(new Date())
  
  const cancelledSubs = await prisma.user.count({
    where: {
      subscriptionStatus: 'cancelled',
      updatedAt: { gte: startOfPeriod },
    },
  })
  
  const totalSubs = await prisma.user.count({
    where: { planType: { not: 'FREEMIUM' } },
  })
  
  return (cancelledSubs / totalSubs) * 100
}
```

## 🚀 Melhorias Futuras

- [ ] Planos anuais (desconto)
- [ ] Add-ons (recursos extras)
- [ ] Trial period (período de teste)
- [ ] Cupons de desconto
- [ ] Programa de afiliados
- [ ] Planos customizados (enterprise)
- [ ] Multi-moeda
- [ ] Pagamento via PIX/Boleto
- [ ] Créditos de agendamento
- [ ] Rollover de limites não usados
