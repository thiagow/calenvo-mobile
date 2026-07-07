# Versão em Inglês/USD (i18n) - Implementation Summary

**Date**: July 7, 2026
**Status**: ✅ Landing + checkout + e-mails traduzidos e funcionando | ⏳ Price IDs USD e dashboard pendentes
**Build Status**: ✅ Passing (`npm run build`, `tsc --noEmit` sem novos erros)

---

## 📋 Executive Summary

Adicionado suporte a inglês/dólar na landing page, no fluxo de cadastro pago e nos e-mails transacionais, usando `next-intl` com roteamento por prefixo de URL (`/` = português/BRL, `/en` = inglês/USD). Mesmo produto, mesmo repositório, mesmo deploy Netlify — sem fork. Detecção automática de idioma por geolocalização (com fallback para Accept-Language) na primeira visita, com seletor manual persistido em cookie.

**O que funciona:**
- ✅ `next-intl` configurado (`i18n/routing.ts`, `i18n/navigation.ts`, `i18n/request.ts`) com `localePrefix: 'as-needed'` — `pt` continua servido em URLs sem prefixo (`/`, `/signup/...`), `en` em `/en/...`
- ✅ Landing page (`app/[locale]/page.tsx`) e fluxo de cadastro (`app/[locale]/signup/...`) totalmente traduzidos via dicionários `messages/pt.json` / `messages/en.json`
- ✅ Dimensão de moeda nos planos: `lib/types.ts` (`PLAN_CONFIGS` com `priceMonthlyUSD`/`priceAnnualUSD`, helper `getPlanPrice`), `lib/stripe.ts` (`STRIPE_PRICE_IDS` agora indexado por moeda também)
- ✅ `formatCurrencyByCurrency` (`lib/utils.ts`) formata BRL (`pt-BR`) ou USD (`en-US`) conforme o locale
- ✅ Checkout (`/api/stripe/create-checkout`) e webhook (`/api/stripe/webhook`) propagam `locale`/`currency` ponta a ponta — da URL de cadastro até o Price ID do Stripe, o registro do usuário e o e-mail de boas-vindas
- ✅ Novos campos `User.currency` e `User.locale` (Prisma) para saber em que moeda/idioma cada cliente foi cadastrado
- ✅ E-mails transacionais (`lib/email-templates.ts`) com versões PT/EN completas (corrigido também um bug pré-existente: o e-mail de boas-vindas mostrava "180/mês" e "Até 3 usuários" fixos, independente do plano real contratado — agora usa os limites reais do plano)
- ✅ Middleware (`middleware.ts`) mescla a lógica de auth existente com o roteamento de locale do `next-intl`, escopado apenas às rotas públicas (`/`, `/en`, `/signup*`, `/en/signup*`) — dashboard, saas-admin, login, booking público e todas as rotas de API continuam exatamente como estavam, sem qualquer prefixo de idioma
- ✅ Detecção de país via headers de CDN (`x-country`, `x-vercel-ip-country`, ou decodificação de `x-nf-geo` do Netlify) redireciona `/` → `/en` na primeira visita se o país não for `BR`; seletor de idioma manual (`components/brand/language-switcher.tsx`) no header sobrescreve isso via cookie `NEXT_LOCALE`
- ✅ Build gera corretamente as variantes estáticas `/pt` (servido em `/`) e `/en` para landing, signup e signup/success; testado manualmente (`curl`) confirmando PT renderiza "Agende." com preços em `R$ 19,90` e EN renderiza "Book." com preços em `$19`

**O que está pendente (fora do código, depende de ação humana):**
- ⏳ Criar 6 Price IDs em USD no Stripe (hoje todos vazios — checkout em inglês vai retornar erro 503 amigável até serem preenchidos)
- ⏳ Confirmar o header de geolocalização real disponível no ambiente de produção Netlify
- ⏳ Traduzir dashboard interno e página de booking público (fora do escopo aprovado nesta rodada — ver "Fast-follow")

---

## 🏗️ O que mudou

### Infraestrutura de i18n
- `next-intl@3.26.5` instalado; `next.config.js` envolvido com `withNextIntl(...)`
- `i18n/routing.ts`: locales `['pt', 'en']`, default `pt`, `localePrefix: 'as-needed'`
- `i18n/navigation.ts`: `Link`, `redirect`, `usePathname`, `useRouter` locale-aware (substituem os equivalentes de `next/link`/`next/navigation` nas rotas localizadas)
- `i18n/request.ts`: carrega `messages/{locale}.json` por requisição
- `app/[locale]/layout.tsx`: layout aninhado (não é o root — `app/layout.tsx` continua sendo o único `<html>/<body>` de todo o app) que injeta `NextIntlClientProvider`

### Reestruturação de rotas (escopo deliberadamente limitado)
Apenas as rotas de aquisição/conversão foram movidas para `app/[locale]/`:
- `app/page.tsx` → `app/[locale]/page.tsx` (landing)
- `app/signup/page.tsx` → `app/[locale]/signup/page.tsx` (redirect)
- `app/signup/[plan]/page.tsx` → `app/[locale]/signup/[plan]/page.tsx`
- `app/signup/success/page.tsx` → `app/[locale]/signup/success/page.tsx`

**Deliberadamente fora do `[locale]`**: `/dashboard`, `/saas-admin`, `/login`, `/account`, `/booking/[slug]`, todas as rotas `/api/*` — continuam funcionando exatamente como antes, sem nenhuma mudança de comportamento ou URL.

### Moeda
- `lib/types.ts`: `PlanConfig` ganhou `priceMonthlyUSD`/`priceAnnualUSD`; novo helper `getPlanPrice(plan, interval, currency)`
- `lib/stripe.ts`: `STRIPE_PRICE_IDS` virou `Record<Currency, Record<PlanType, Record<BillingInterval, string>>>`; `getStripePriceId(plan, interval, currency)`
- `lib/utils.ts`: novo `formatCurrencyByCurrency(value, currency)` (mantém `formatCurrency` original intocado para não quebrar as ~20 chamadas já existentes no dashboard, que continuam BRL-only por enquanto)
- `prisma/schema.prisma`: `enum Currency { BRL USD }`, `User.currency @default(BRL)`, `User.locale @default("pt")` — migration `20251003050000_add_currency_and_locale` (aditiva, sem impacto em dados existentes)

### Middleware
`middleware.ts` agora combina duas responsabilidades num único arquivo (Next.js só permite um middleware por projeto):
1. Para caminhos localizados (`/`, `/en`, `/signup*`, `/en/signup*`): delega para `createIntlMiddleware(routing)`, com um passo extra de detecção de país por geo-header **apenas na primeira visita à raiz sem cookie de preferência salvo**
2. Para todo o resto: lógica de auth/role original, inalterada

---

## ⏳ Pendências (ação humana necessária)

### 1. Criar 6 Price IDs em USD no Stripe
Variáveis já preparadas em `.env`/`.env.example` (vazias):

| Variável | Plano | Intervalo |
|---|---|---|
| `STRIPE_BASICO_MONTHLY_PRICE_ID_USD` | Básico | Mensal ($19) |
| `STRIPE_BASICO_ANNUAL_PRICE_ID_USD` | Básico | Anual ($15/mês) |
| `STRIPE_PRO_MONTHLY_PRICE_ID_USD` | PRO | Mensal ($39) |
| `STRIPE_PRO_ANNUAL_PRICE_ID_USD` | PRO | Anual ($29/mês) |
| `STRIPE_BUSINESS_MONTHLY_PRICE_ID_USD` | Business | Mensal ($69) |
| `STRIPE_BUSINESS_ANNUAL_PRICE_ID_USD` | Business | Anual ($49/mês) |

**Os valores em dólar (`priceMonthlyUSD`/`priceAnnualUSD` em `lib/types.ts`) foram definidos usando os mesmos números do BRL, sem conversão cambial real** — é uma decisão de produto pendente de validação sua: manter paridade numérica (comum em SaaS global, ex. Notion) ou fazer conversão/precificação específica para o mercado americano.

### 2. Variáveis de ambiente de produção (Netlify)
Replicar as 6 variáveis USD acima nas configurações de ambiente do Netlify (mesma ação já necessária para as 5 variáveis BRL pendentes documentadas no resumo de implementação de planos pagos).

### 3. Validar o header de geolocalização em produção
A detecção de país tenta `x-country`, `x-vercel-ip-country` e `x-nf-geo` (Netlify, base64), nessa ordem. Como o projeto roda no Netlify com `@netlify/plugin-nextjs`, **é preciso confirmar em produção qual desses headers (se algum) o Netlify realmente injeta** no Next.js Middleware — não há como testar isso localmente. Se nenhum estiver disponível, a detecção cai automaticamente para Accept-Language do navegador (comportamento padrão do `next-intl`), então não há risco de quebra, só de a detecção por país ficar menos precisa até isso ser confirmado/ajustado.

### 4. Escopo de tradução: dashboard e booking público ficaram de fora
Por decisão já validada (ver plano aprovado), o dashboard interno (uso do próprio dono do negócio) e a página pública de agendamento (`/booking/[slug]`) não foram traduzidos nesta rodada — só a superfície de aquisição (landing → cadastro → e-mail de boas-vindas). Isso é esperado, não é um bug.

---

## 🚧 Fast-follow (não bloqueante, sinalizado para decisão futura)

- Traduzir o dashboard interno (fase 2, conforme o plano original já previa)
- Traduzir `/booking/[slug]` (página pública de agendamento) — hoje um cliente americano que reserva horário com um profissional cadastrado no Brasil ainda veria essa página em português
- Reavaliar os preços em USD com uma estratégia de precificação real para o mercado americano, em vez da paridade numérica atual

---

## 📁 Arquivos-chave

- `i18n/routing.ts`, `i18n/navigation.ts`, `i18n/request.ts`
- `messages/pt.json`, `messages/en.json`
- `app/[locale]/layout.tsx`, `app/[locale]/page.tsx`, `app/[locale]/signup/**`
- `components/auth/paid-signup-form.tsx`, `components/brand/language-switcher.tsx`
- `lib/types.ts`, `lib/stripe.ts`, `lib/utils.ts`, `lib/temporary-storage.ts`
- `lib/email-templates.ts`
- `app/api/stripe/create-checkout/route.ts`, `app/api/stripe/webhook/route.ts`
- `middleware.ts`
- `prisma/schema.prisma`, `prisma/migrations/20251003050000_add_currency_and_locale/`
- `.env.example`
