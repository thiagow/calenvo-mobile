# Planos - Gestão de Planos e Assinaturas

## 📋 Descrição

Sistema de gerenciamento de planos de assinatura com integração ao Stripe, controle de limites e sincronização automática de plano/status via webhook.

> ⚠️ Esta página foi reescrita em 2026-07-15 para refletir o código real. A versão anterior descrevia um modelo fictício (FREEMIUM/STANDARD/PREMIUM) que nunca existiu na implementação.

## 📍 Localização no Código

### Páginas
- **Planos**: `/dashboard/plans` → `app/dashboard/plans/page.tsx`
- **Conta suspensa**: `/account/suspended` → `app/account/suspended/page.tsx`
- **Signup por plano**: `/[locale]/signup/[plan]` → `app/[locale]/signup/[plan]/page.tsx`

### APIs
- `POST /api/stripe/create-checkout` — cria Stripe Customer + Checkout Session (novo tenant)
- `POST /api/stripe/portal` — cria sessão do Stripe Billing Portal (self-service)
- `POST /api/stripe/webhook` — recebe e processa eventos do Stripe (fonte da verdade)
- `GET /api/user/plan` — plano atual do usuário autenticado
- `GET /api/user/plan-usage` / `GET /api/plans/usage` — uso corrente vs. limites do plano
- `POST /api/saas-admin/tenants` — criação manual de tenant isento de pagamento (sem Stripe)

### Lógica de domínio
- `lib/types.ts` — `PLAN_CONFIGS` (preços e features exibidas na UI)
- `lib/plan-limits.ts` — `PLAN_LIMITS` (limites reais aplicados: profissionais, agendamentos, agendas, serviços)
- `lib/stripe.ts` — `STRIPE_PRICE_IDS`, `getStripePriceId()`, `getPlanFromPriceId()`

## 🗄️ Modelo de Dados

```prisma
enum PlanType {
  BASICO
  PRO
  BUSINESS
}

enum BillingInterval {
  MONTHLY
  ANNUAL
}

enum Currency {
  BRL
  USD
}

model User {
  // ... outros campos
  planType           PlanType?         // null para SAAS_ADMIN; sempre setado explicitamente para MASTER/PROFESSIONAL
  billingInterval    BillingInterval?  @default(MONTHLY)
  currency           Currency          @default(BRL)
  isPaymentExempt    Boolean           @default(false)
  stripeCustomerId   String?
  subscriptionId     String?
  subscriptionStatus String?
  planUsage          PlanUsage?
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

`planType` é opcional no schema porque o `SAAS_ADMIN` não deve carregar um plano (não é um tenant). Todo caminho de criação de usuário `MASTER`/`PROFESSIONAL` (webhook de checkout, criação manual pelo admin, herança pelo profissional) define `planType` explicitamente — nunca fica nulo na prática para essas roles.

## 🎯 Planos Disponíveis (`lib/types.ts` → `PLAN_CONFIGS`)

| Plano | Nome exibido | Profissionais | Agendamentos/mês | R$/mês | R$/mês (anual) | US$/mês | US$/mês (anual) |
|-------|-------------|:-:|:-:|:-:|:-:|:-:|:-:|
| `BASICO` | Básico | 2 | 150 | 19,90 | 15,92 | 9,90 | 7,92 |
| `PRO` | PRO | 8 | Ilimitado | 39,90 | 31,93 | 19,90 | 15,93 |
| `BUSINESS` | Avançado | Ilimitado | Ilimitado | 69,90 | 55,93 | 29,90 | 23,92 |

Limites de agendas e serviços (`lib/plan-limits.ts` → `PLAN_LIMITS`, não exibidos em `PLAN_CONFIGS`):

| Plano | Agendas | Serviços |
|-------|:-:|:-:|
| `BASICO` | 2 | 10 |
| `PRO` | 8 | 50 |
| `BUSINESS` | Ilimitado | Ilimitado |

`-1` no código sempre significa "ilimitado".

## 🔗 Mapeamento PlanType ↔ Stripe (Product IDs / Price IDs)

Fonte da verdade em runtime: `lib/stripe.ts` → `STRIPE_PRICE_IDS`, populado a partir das env vars abaixo. Auditado contra a conta Stripe em 2026-07-15 (modo test) — todos os 12 Price IDs conferem com os produtos ativos.

### Plano Básico — `prod_TjoIVH50jDNyQB`

| Env var | Price ID | Valor | Intervalo |
|---|---|---|---|
| `STRIPE_BASICO_MONTHLY_PRICE_ID` | `price_1Tqg69Ee8DKEFqGiQpF2QDc0` | R$ 19,90 | mensal |
| `STRIPE_BASICO_ANNUAL_PRICE_ID` | `price_1TqgTGEe8DKEFqGitAjqBPI2` | R$ 191,00 | anual |
| `STRIPE_BASICO_MONTHLY_PRICE_ID_USD` | `price_1TqgQtEe8DKEFqGib5hcnZob` | US$ 9,90 | mensal |
| `STRIPE_BASICO_ANNUAL_PRICE_ID_USD` | `price_1TqgTmEe8DKEFqGiIHn1cPkh` | US$ 95,00 | anual |

> Price legado `price_1SmKgHEe8DKEFqGiJwa9jy4T` (R$ 49,90/mês) está **arquivado** (`active: false`) desde antes desta auditoria. A API da Stripe não permite deletar um `Price` que já foi usado — arquivar é o estado final possível, e é o que ele já tem.

### Plano Pró — `prod_UqMt35LBrxAdci`

| Env var | Price ID | Valor | Intervalo |
|---|---|---|---|
| `STRIPE_PRO_MONTHLY_PRICE_ID` | `price_1Tqg9hEe8DKEFqGi7bUL3qVl` | R$ 39,90 | mensal |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | `price_1TqgUqEe8DKEFqGiXcvvzIpd` | R$ 383,10 | anual |
| `STRIPE_PRO_MONTHLY_PRICE_ID_USD` | `price_1TqgAREe8DKEFqGi2IsqIO7m` | US$ 19,90 | mensal |
| `STRIPE_PRO_ANNUAL_PRICE_ID_USD` | `price_1TqgVDEe8DKEFqGikCqWyyyj` | US$ 191,10 | anual |

### Plano Avançado (`PlanType.BUSINESS`) — `prod_UqMxeipvzDMEKx`

| Env var | Price ID | Valor | Intervalo |
|---|---|---|---|
| `STRIPE_BUSINESS_MONTHLY_PRICE_ID` | `price_1TqgD7Ee8DKEFqGifg3nUf42` | R$ 69,90 | mensal |
| `STRIPE_BUSINESS_ANNUAL_PRICE_ID` | `price_1TqgVjEe8DKEFqGiZ9gpYXQP` | R$ 671,10 | anual |
| `STRIPE_BUSINESS_MONTHLY_PRICE_ID_USD` | `price_1TqgDbEe8DKEFqGi64d94C2c` | US$ 29,90 | mensal |
| `STRIPE_BUSINESS_ANNUAL_PRICE_ID_USD` | `price_1TqgWEEe8DKEFqGiAtCQmVpk` | US$ 287,10 | anual |

> ⚠️ Note que o produto na Stripe se chama "Plano Avançado", mas o enum interno é `BUSINESS`. Não renomear um dos dois sem atualizar o outro lado do mapeamento.

Esta tabela é gerada a partir de `STRIPE_PRICE_IDS`. Se um Price ID mudar na Stripe, atualize a env var correspondente — o código não precisa mudar. O mapeamento reverso (Price ID → PlanType/Interval/Currency), usado pelo webhook para sincronizar mudanças de plano feitas fora do checkout (ex.: troca de plano no Billing Portal), fica em `getPlanFromPriceId()` (`lib/stripe.ts`) e é derivado automaticamente desta mesma tabela — não precisa manutenção manual.

## 🔐 Validações e Limites (implementação real)

```typescript
// lib/plan-limits.ts
export function canAddProfessional(planType: string, currentCount: number): boolean
export function canCreateAppointment(planType: string, currentMonthCount: number): boolean
export function getRemainingAppointments(planType: string, currentMonthCount: number): number
export function shouldNotifyLimitApproaching(planType: string, currentMonthCount: number): boolean // avisa quando restam exatamente 5
```

O uso de agendamentos do mês é contado diretamente via `prisma.appointment.count()` filtrando por `userId` e o mês corrente — não depende do modelo `PlanUsage` para essa checagem (esse modelo existe no schema mas seu uso ativo deve ser conferido em `app/api/plans/usage` antes de assumir que está em uso pleno).

## 💻 Integração com Stripe (implementação real)

### 1. Criar Checkout Session — `POST /api/stripe/create-checkout`
Usado no signup de um **novo** tenant (ainda não existe no BD). Cria um Stripe Customer, guarda os dados do formulário em `lib/temporary-storage.ts` (memória, expira em 1h, chave = `session.id`) e cria a Checkout Session com `metadata` contendo email/plano/intervalo/moeda como fallback caso o storage temporário se perca.

```typescript
const priceId = getStripePriceId(plan, interval, currency) // lib/stripe.ts
const session = await stripe.checkout.sessions.create({
  customer: customer.id,
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  metadata: { email, name, businessName, segmentType, phone, customerId, plan, interval, currency, locale },
})
setTemporaryData(session.id, { ...formData, timestamp: Date.now() })
```

### 2. Portal de Billing — `POST /api/stripe/portal`
Requer sessão autenticada com `stripeCustomerId` já setado. Cria uma sessão do Stripe Billing Portal e retorna a URL — não manipula o BD diretamente (a sincronização acontece via webhook quando o usuário altera algo no portal).

### 3. Webhook — `POST /api/stripe/webhook` (`app/api/stripe/webhook/route.ts`)

| Evento | Ação |
|---|---|
| `checkout.session.completed` | Cria `User` MASTER + `User` PROFESSIONAL (mesmo email, `masterId` do master) + `BusinessConfig`. Persiste `stripeCustomerId`, `subscriptionId`, `planType`, `billingInterval`, `currency`. Idempotente (rechecagem por email+role ou por `stripeCustomerId`). Envia email de boas-vindas. |
| `customer.subscription.created` | Apenas log — a criação real do usuário acontece em `checkout.session.completed`. |
| `customer.subscription.updated` | Resolve o plano atual a partir do `price.id` do primeiro item da assinatura via `getPlanFromPriceId()` e sincroniza `planType`/`billingInterval`/`currency` do MASTER **e** de todos os `PROFESSIONAL` vinculados (`masterId`). Sempre atualiza `subscriptionId` e `subscriptionStatus`. Cobre tanto o pós-checkout quanto trocas de plano feitas no Billing Portal. |
| `customer.subscription.deleted` | Marca `subscriptionStatus: 'canceled'`. **Não existe plano gratuito de fallback** — o `planType` anterior é mantido e a conta fica suspensa (ver `/account/suspended`) até uma nova assinatura ser ativada. |
| `invoice.payment_succeeded` | Apenas log. |
| `invoice.payment_failed` | Envia email de falha de pagamento. Não altera `subscriptionStatus` diretamente (isso chega via `customer.subscription.updated`). |

### 4. Criação manual isenta de pagamento — `POST /api/saas-admin/tenants`
Usada pelo SaaS Admin para cortesias/parcerias/contas de teste. Cria MASTER + PROFESSIONAL + BusinessConfig com `isPaymentExempt: true`, sem tocar na Stripe. `planType` e `billingInterval` são obrigatórios no payload e validados contra as listas `VALID_PLANS`/`VALID_INTERVALS`.

## 🎯 Casos de Uso

### 1. Novo tenant via checkout
1. Usuário preenche formulário de signup em `/[locale]/signup/[plan]`
2. `POST /api/stripe/create-checkout` cria Customer + Checkout Session, guarda dados temporários
3. Usuário é redirecionado ao Stripe Checkout e paga
4. Stripe dispara `checkout.session.completed` → webhook cria MASTER + PROFESSIONAL + BusinessConfig
5. Email de boas-vindas enviado

### 2. Troca de plano via Billing Portal
1. Usuário clica em "Gerenciar Assinatura" no dashboard → `POST /api/stripe/portal`
2. Troca de plano dentro do portal hospedado pela Stripe (requer que a "Default configuration" do portal, no Dashboard da Stripe, permita troca de preço — isso é configuração do lado da Stripe, não do código)
3. Stripe dispara `customer.subscription.updated` com o novo `price.id`
4. Webhook resolve o novo `PlanType`/`BillingInterval`/`Currency` via `getPlanFromPriceId()` e propaga para o MASTER e todos os PROFESSIONAL da equipe

### 3. Atingir limite do plano
1. Usuário tenta criar um agendamento além do limite mensal do plano
2. `checkAppointmentQuota()` bloqueia e retorna `code: 'APPOINTMENT_LIMIT_REACHED'`
3. Se restarem exatamente 5 agendamentos antes do limite, `NotificationService.notifyPlanLimitApproaching()` é disparado

### 4. Cancelamento de assinatura
1. Usuário cancela no Billing Portal
2. Webhook `customer.subscription.deleted` marca `subscriptionStatus: 'canceled'`
3. Conta é tratada como suspensa (`/account/suspended`) mantendo o último `planType` contratado
4. Reativação exige nova assinatura ativa (não há downgrade automático para um plano gratuito — não existe plano gratuito no sistema)

## 🧪 Teste de regressão end-to-end

`scripts/test-checkout-e2e.ts` exercita o fluxo completo contra o Stripe real em modo test (`sk_test_...`) e a API local:
1. `POST /api/stripe/create-checkout` (cria Customer real na Stripe)
2. Simula `checkout.session.completed` assinado com `STRIPE_WEBHOOK_SECRET` real → valida criação de MASTER/PROFESSIONAL/BusinessConfig e persistência de `subscriptionId`
3. Simula `customer.subscription.updated` (upgrade de plano) → valida sincronização de `planType` no MASTER e propagação ao PROFESSIONAL
4. Simula `customer.subscription.deleted` → valida `subscriptionStatus: 'canceled'` com `planType` preservado
5. Limpa os dados de teste no BD e remove o Customer criado na Stripe

Rodar com: `npx tsx scripts/test-checkout-e2e.ts` (requer o dev server rodando — porta configurada em `package.json`, atualmente `3001`).

## 🚀 Melhorias Futuras

- [ ] Cupons de desconto
- [ ] Programa de afiliados
- [ ] Planos customizados (enterprise)
- [ ] Pagamento via PIX/Boleto
- [ ] Trial period (período de teste)
