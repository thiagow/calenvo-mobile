# Remoção do Plano Free + Planos Pagos (Básico/PRO/Business) - Implementation Summary

**Date**: July 6, 2026
**Status**: ✅ Código completo | ⏳ Configuração externa pendente (Stripe + env vars de produção)
**Build Status**: ✅ Passing (`npm run build`, `tsc --noEmit` sem novos erros)

---

## 📋 Executive Summary

Removido o plano gratuito (Freemium) da Calenvo. Todo plano agora exige cadastro pago via Stripe antes de criar conta. O enum interno `PlanType` foi renomeado de `FREEMIUM/STANDARD/PREMIUM` para `BASICO/PRO/BUSINESS`, os preços foram reconciliados com os valores reais da landing page, o fluxo de cadastro foi consolidado em uma rota dinâmica com suporte a cobrança mensal/anual, e foi adicionado um mecanismo de suspensão de conta (em vez de reverter para um plano grátis) e um fluxo de cadastro manual isento de pagamento para uso do administrador.

**O que funciona:**
- ✅ Enum `PlanType` renomeado (`BASICO/PRO/BUSINESS`), com migration segura que preserva dados existentes
- ✅ `PLAN_CONFIGS` (`lib/types.ts`) com preços e limites idênticos à landing page
- ✅ Checkout consolidado em `/signup/[plan]?interval=monthly|annual` (substitui os antigos `/signup` grátis e `/signup/standard`)
- ✅ `app/api/stripe/create-checkout` genérico para os 3 planos × 2 intervalos, com erro amigável (503) para combinações sem Price ID configurado
- ✅ Webhook do Stripe atualizado: `planType` só muda por um novo checkout; cancelamento/falha de pagamento marca `subscriptionStatus` em vez de reverter para plano grátis
- ✅ Bloqueio de dashboard para contas suspensas (`app/dashboard/layout.tsx` → redirect para `/account/suspended`), com botão de reativação via Stripe Customer Portal (`/api/stripe/portal`)
- ✅ Cadastro manual isento de pagamento pelo admin (`/saas-admin/tenants/new` + `POST /api/saas-admin/tenants`), com toggle de isenção em tenants existentes
- ✅ Identidade visual nova (logo SVG compartilhado, `#7C3AED`, fundo `#FAFAFF`/`#F9FAFB`) aplicada em todas as telas de cadastro
- ✅ Gate de WhatsApp ajustado: recurso PRO+ (bloqueado no Básico), consistente entre UI e API
- ✅ Varredura completa de todas as referências antigas ao enum (~16 arquivos: dashboard, saas-admin, whatsapp, seed, notification-service)

**O que está pendente (fora do código, depende de ação humana):**
- ⏳ Criar 5 Price IDs reais no Stripe (só existe 1 hoje: PRO mensal)
- ⏳ Configurar variáveis de ambiente de produção (Netlify)
- ⏳ Ativar/configurar o Stripe Customer Portal
- ⏳ Confirmar eventos de webhook assinados no Stripe Dashboard
- ⏳ Testes ponta a ponta em modo Stripe test
- ⏳ Commit e push das mudanças

---

## 🏗️ O que mudou

### Banco de dados (`prisma/schema.prisma`)
- `enum PlanType`: `FREEMIUM → BASICO`, `STANDARD → PRO`, `PREMIUM → BUSINESS`
- Novo `enum BillingInterval { MONTHLY ANNUAL }` + campo `User.billingInterval`
- Novo campo `User.isPaymentExempt Boolean @default(false)`
- Migration em `prisma/migrations/20251003040000_rename_plan_enum_billing_interval_payment_exempt/` — usa `ALTER TYPE ... RENAME VALUE` (não destrutivo, preserva dados de usuários existentes). Aplicada manualmente via `prisma db execute` + `prisma migrate resolve --applied` porque a shadow database do `prisma migrate dev` estava com drift pré-existente não relacionado a este trabalho (colunas/tabela de uma integração Asaas fora do controle do Prisma — não tocadas).

### Preços e limites (`lib/types.ts`, `lib/plan-limits.ts`)
| Plano | Mensal | Anual | Profissionais | Agendamentos/mês |
|---|---|---|---|---|
| Básico | R$19,90 | R$14,90 | 2 | 150 |
| PRO | R$39,90 | R$27,90 | 8 | Ilimitado |
| Business | R$69,90 | R$49,90 | Ilimitado | Ilimitado |

### Checkout consolidado
- `app/signup/[plan]/page.tsx` (rota dinâmica) substitui `app/signup/page.tsx` (grátis) e `app/signup/standard/page.tsx` (só PRO)
- `components/auth/paid-signup-form.tsx` — formulário único, sempre envia para `/api/stripe/create-checkout`
- `app/signup/page.tsx` agora é um redirect para `/signup/basico?interval=monthly` (compatibilidade com links antigos)
- `lib/stripe.ts` — `STRIPE_PRICE_IDS` (mapa server-only de Price ID por plano/intervalo), separado de `PLAN_CONFIGS` para nunca vazar Price IDs no bundle do client
- `app/signup/success/page.tsx` — passa a ler `?plan=&interval=` e renderizar dados reais do plano contratado

### Suspensão de conta (sem plano grátis de fallback)
- `app/api/stripe/webhook/route.ts`: `handleSubscriptionUpdated`/`handleSubscriptionDeleted` gravam `subscriptionStatus` (não mexem mais em `planType`)
- `app/dashboard/layout.tsx`: verifica `subscriptionStatus`/`isPaymentExempt` a cada acesso e redireciona para `/account/suspended` se `canceled`/`unpaid`/`past_due`
- `app/account/suspended/page.tsx` + `components/account/reactivate-button.tsx` + `app/api/stripe/portal/route.ts`: tela de reativação via Stripe Customer Portal

### Cadastro isento pelo Admin
- `app/saas-admin/tenants/new/page.tsx` + `POST /api/saas-admin/tenants`: cria tenant (MASTER + profissional + BusinessConfig) com `isPaymentExempt: true`, sem chamar o Stripe
- `PATCH /api/saas-admin/tenants/[id]` aceita `isPaymentExempt` para revogar/conceder isenção em conta existente

### Identidade visual
- `components/brand/logo.tsx` — componente `LogoIcon`/`Logo` compartilhado (SVG inline, gradiente `#8B5CF6→#5B21B6`), reaproveitado em landing, cadastro e telas de sucesso/suspensão

---

## ⏳ Pendências (ação humana necessária)

### 1. Criar Price IDs no Stripe
Hoje só existe **1 Price ID real** (PRO mensal, migrado de `STRIPE_STANDARD_PRICE_ID`). Faltam 5:

| Variável | Plano | Intervalo |
|---|---|---|
| `STRIPE_BASICO_MONTHLY_PRICE_ID` | Básico | Mensal |
| `STRIPE_BASICO_ANNUAL_PRICE_ID` | Básico | Anual |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | PRO | Anual |
| `STRIPE_BUSINESS_MONTHLY_PRICE_ID` | Business | Mensal |
| `STRIPE_BUSINESS_ANNUAL_PRICE_ID` | Business | Anual |

Até serem preenchidos, o checkout dessas combinações responde com erro amigável (503) em vez de quebrar — mas ninguém consegue contratar Básico, Business ou PRO anual.

### 2. Variáveis de ambiente de produção (Netlify)
Replicar a mudança feita no `.env` local: remover `STRIPE_STANDARD_PRICE_ID`, adicionar as 6 variáveis `STRIPE_BASICO_*` / `STRIPE_PRO_*` / `STRIPE_BUSINESS_*`.

### 3. Stripe Customer Portal
`/api/stripe/portal` (usado na tela de conta suspensa) depende do Customer Portal estar ativado em Stripe Dashboard → Settings → Billing → Customer Portal.

### 4. Eventos de webhook no Stripe Dashboard
Confirmar que `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` e `invoice.payment_failed` estão assinados para o endpoint de produção — `customer.subscription.updated/deleted` agora são a fonte de verdade para suspensão de conta.

### 5. Decisão de produto em aberto
Limite de agendamentos do plano PRO foi definido como **ilimitado** por padrão (a landing não especifica um teto). Confirmar se é isso mesmo ou se deve haver um número.

### 6. Testes ponta a ponta (Stripe test mode, cartão `4242 4242 4242 4242`)
- Contratação de cada plano (assim que os Price IDs existirem)
- Cancelamento de assinatura de teste → conta deve ficar suspensa, não reverter para "grátis"
- Reativação via botão "Atualizar Pagamento" em `/account/suspended`
- Cadastro de cliente isento pelo admin em `/saas-admin/tenants/new`

### 7. Commit e push
Mudanças ainda não commitadas no momento em que este documento foi escrito.

---

## 🚧 Fast-follow (não bloqueante, já sinalizado no código)

- `app/dashboard/plans/page.tsx`: botão de upgrade dentro do dashboard ainda é um stub (toast simulado, sem chamada real ao Stripe). Trocar de plano com assinatura já ativa exige `stripe.subscriptions.update()` com proration — fluxo diferente do checkout de um cadastro novo. Marcado com `// TODO` no código.

---

## 📁 Arquivos-chave

- `prisma/schema.prisma`, `prisma/migrations/20251003040000_.../migration.sql`
- `lib/types.ts`, `lib/plan-limits.ts`, `lib/stripe.ts`, `lib/temporary-storage.ts`
- `app/signup/[plan]/page.tsx`, `components/auth/paid-signup-form.tsx`, `app/signup/success/page.tsx`
- `app/api/stripe/create-checkout/route.ts`, `app/api/stripe/webhook/route.ts`, `app/api/stripe/portal/route.ts`
- `app/dashboard/layout.tsx`, `app/account/suspended/page.tsx`, `components/account/reactivate-button.tsx`
- `app/saas-admin/tenants/new/page.tsx`, `app/api/saas-admin/tenants/route.ts`, `app/api/saas-admin/tenants/[id]/route.ts`
- `components/brand/logo.tsx`
- `app/page.tsx` (CTAs e copy da landing)
- `.env.example`
