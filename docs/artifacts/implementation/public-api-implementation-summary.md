# API Pública de Agendamento com Token - Implementation Summary

**Date**: July 7, 2026
**Status**: ✅ Código completo e testado localmente | ⏳ Rate limiting real depende de conta Upstash
**Build Status**: ✅ Passing (`npm run build`, `tsc --noEmit` sem novos erros)

---

## 📋 Executive Summary

Nova API pública (`/api/v1/appointments`) para parceiros externos e agentes de IA criarem/consultarem agendamentos, autenticada por token Bearer gerado pelo próprio dono do negócio no painel (`/dashboard/api-keys`). A lógica de checagem de limite de plano e conflito de horário — antes duplicada entre a rota do dashboard e a de booking público — foi extraída para `lib/appointment-service.ts` e agora é compartilhada pelas três entradas.

**Escopo confirmado com você**: o agente de IA do WhatsApp (n8n, hoje com acesso direto ao Postgres) **não foi migrado** para esta API — continua como está.

**O que funciona:**
- ✅ Modelo `ApiToken` (Prisma) — token só existe em texto puro no momento da criação, armazenado como hash SHA-256
- ✅ `/dashboard/api-keys` — tela para gerar, listar e revogar chaves (link adicionado no menu lateral e no menu "Mais" mobile, restrito a usuários MASTER)
- ✅ `POST/GET /api/v1/appointments` — autenticado por `Authorization: Bearer cal_live_...`, com escopos (`appointments:read`/`appointments:write`)
- ✅ `GET /api/v1` — documentação da API em JSON (pública, sem autenticação)
- ✅ `lib/appointment-service.ts` — `checkAppointmentQuota` e `checkScheduleConflict` compartilhados entre dashboard (`/api/appointments`), booking público (`/api/booking/[slug]/create`) e a nova API v1 — nenhuma das três entradas tem mais regra de negócio divergente das outras
- ✅ Rate limiting via Upstash Redis, com **fallback gracioso**: sem as variáveis de ambiente configuradas, a API funciona normalmente (só sem limite de requisições) em vez de quebrar
- ✅ Testado localmente: requisição sem token → 401, token inválido → 401, docs endpoint → 200 com JSON

**Efeito colateral positivo**: ao trocar a checagem de conflito "exata" do booking público pela versão por sobreposição (mais robusta, já usada no dashboard), o booking público agora pega conflitos parciais de horário que antes passavam despercebidos — é uma correção estrita, não uma mudança de comportamento visível para o usuário final.

**O que está pendente (fora do código, depende de ação humana):**
- ⏳ Criar conta Upstash (Redis) e configurar `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` para ativar o rate limiting de verdade (60 req/min por token)
- ⏳ Testar a geração de uma chave real via UI logada e uma chamada real de ponta a ponta (não foi possível simular login completo neste ambiente de teste)

---

## 🏗️ O que mudou

### Banco de dados
- Novo modelo `ApiToken` (`id`, `userId`, `name`, `tokenHash` único, `tokenPrefix`, `scopes[]`, `lastUsedAt`, `revokedAt`, `createdAt`) — migration `20251003060000_add_api_token`
- Relação `User.apiTokens`

### Camada de serviço compartilhada (`lib/appointment-service.ts`)
- `checkAppointmentQuota(userId, planType)` — conta agendamentos do mês e verifica limite do plano (idêntico ao que já existia duplicado em 2 lugares)
- `checkScheduleConflict({ scheduleId, professionalId?, date, duration, excludeAppointmentId? })` — checagem por sobreposição de horário (a versão mais robusta, que já existia só no dashboard)
- `app/api/appointments/route.ts` (dashboard) e `app/api/booking/[slug]/create/route.ts` (booking público) foram refatorados para chamar essas funções em vez de duplicar a lógica inline

### Autenticação por token (`lib/api-auth.ts`)
- `generateApiToken()` — gera token no formato `cal_live_<48 hex>`, retorna o texto puro (uma vez) + hash SHA-256 + prefixo exibível
- `authenticateApiRequest(req)` — lê `Authorization: Bearer`, valida hash contra `ApiToken`, rejeita se ausente/inválido/revogado, atualiza `lastUsedAt` de forma assíncrona (não bloqueia a resposta)

### Rate limiting (`lib/rate-limit.ts`)
- Upstash `Ratelimit.slidingWindow(60, '1 m')` por token
- Se `UPSTASH_REDIS_REST_URL`/`TOKEN` não estiverem definidos, `checkRateLimit` sempre retorna `success: true` (com aviso no log) — a API nunca fica bloqueada por falta de infraestrutura de rate limit

### API pública (`app/api/v1/`)
- `GET /api/v1` — documentação em JSON (endpoints, autenticação, formato do payload, códigos de resposta)
- `GET /api/v1/appointments` — lista agendamentos do tenant (escopo `appointments:read`), filtros `dateFrom`/`dateTo`
- `POST /api/v1/appointments` — cria agendamento (escopo `appointments:write`); aceita `clientId` OU `clientName`+`clientPhone` (cria o cliente se não existir, mesmo padrão do booking público); dispara as mesmas notificações internas e de WhatsApp que o dashboard dispara

### Gestão de chaves (`/dashboard/api-keys`)
- `GET/POST /api/dashboard/api-keys`, `DELETE /api/dashboard/api-keys/[id]` — restritos a `role === 'MASTER'` (mesmo padrão já usado em `app/api/professionals/route.ts`)
- Tela mostra o token completo **uma única vez**, na criação, com botão de copiar — depois disso só o prefixo (`cal_live_ab12...`) fica visível na listagem
- Link adicionado em `components/dashboard/dashboard-sidebar.tsx` e `app/dashboard/mais/page.tsx`, sob a permissão `canManageSettings` (MASTER-only)

---

## ⏳ Pendências (ação humana necessária)

### 1. Ativar rate limiting real
Criar uma conta gratuita em [upstash.com](https://upstash.com) (Redis serverless), criar um banco, e preencher no `.env`/Netlify:
```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```
Até lá, a API funciona sem limite de requisições por token — funcional, porém sem essa proteção contra abuso.

### 2. Teste ponta a ponta com login real
Recomendo, com um usuário de teste:
1. Logar no dashboard → `/dashboard/api-keys` → criar uma chave → copiar o token exibido
2. `curl -X POST https://.../api/v1/appointments -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"scheduleId":"...","date":"2026-08-01T14:00:00.000Z","clientName":"Teste","clientPhone":"11999999999"}'`
3. Confirmar que o agendamento aparece no dashboard e que a notificação interna foi criada
4. Revogar a chave e confirmar que a mesma chamada passa a retornar 401

---

## 📁 Arquivos-chave

- `prisma/schema.prisma` (`ApiToken`), `prisma/migrations/20251003060000_add_api_token/`
- `lib/appointment-service.ts`, `lib/api-auth.ts`, `lib/rate-limit.ts`
- `app/api/v1/route.ts`, `app/api/v1/appointments/route.ts`
- `app/api/dashboard/api-keys/route.ts`, `app/api/dashboard/api-keys/[id]/route.ts`
- `app/dashboard/api-keys/page.tsx`
- `app/api/appointments/route.ts`, `app/api/booking/[slug]/create/route.ts` (refatorados)
- `components/dashboard/dashboard-sidebar.tsx`, `app/dashboard/mais/page.tsx`
- `.env.example`
