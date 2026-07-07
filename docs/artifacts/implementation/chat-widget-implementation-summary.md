# Chat de IA Embedável em Sites de Terceiros - Implementation Summary

**Date**: July 7, 2026
**Status**: ✅ Código completo e testado localmente | ⏳ Depende de conta OpenAI para funcionar de ponta a ponta
**Build Status**: ✅ Passing (`npm run build`, `tsc --noEmit` sem novos erros)

---

## 📋 Executive Summary

Novo chat de agendamento com IA, embedável em qualquer site externo, com duas formas de instalação (script-tag com bolha flutuante animada, ou iframe manual para sites com restrição de scripts). A IA roda direto no backend do Calenvo via OpenAI, **sem depender do n8n**, e usa as mesmas regras de negócio (limite de plano, conflito de horário, disponibilidade) já compartilhadas com a API pública do Item 2.

**O que funciona:**
- ✅ `ChatWidgetConfig` (Prisma) — cada tenant liga/desliga o widget, define mensagem de boas-vindas, cor e posição
- ✅ `/dashboard/chat-widget` — tela de configuração com os dois snippets de instalação prontos para copiar (link adicionado no menu lateral e no "Mais" mobile)
- ✅ `app/widget/chat/[slug]/page.tsx` — UI do chat (bolha flutuante → painel expandido, com mensagem de boas-vindas, histórico e input), hospedada como página Next.js normal, sem chrome do dashboard
- ✅ `public/widget-loader.js` — loader vanilla JS (sem build separado) que injeta um iframe fixo no canto da página host e anima abrir/fechar via `postMessage`
- ✅ Opção de iframe manual (sem loader) para sites que não aceitam `<script>` custom — mesma URL, sem a automação de resize
- ✅ `lib/ai/chat-agent.ts` — OpenAI (Chat Completions API) com tool-calling (`list_services`, `check_availability`, `create_appointment`), reaproveitando **em código, sem round-trip HTTP** o `lib/appointment-service.ts` (checagem de quota/conflito) e o novo `lib/availability-service.ts` (cálculo de horários livres)
- ✅ `lib/availability-service.ts` — lógica de disponibilidade extraída de `app/api/booking/[slug]/available-slots` para ser reaproveitada pela IA sem duplicar código; a rota original foi refatorada para usar a mesma função
- ✅ `lib/tenant-resolver.ts` — resolução de tenant por slug extraída (antes só existia inline em `booking/[slug]/create`), agora compartilhada entre booking público e widget
- ✅ CORS liberado **apenas** nas rotas do widget (`/api/widget/[slug]/*`) — o resto da API continua same-origin only
- ✅ Rate limiting por tenant reaproveitando a mesma solução Upstash do Item 2 (mesmo fallback gracioso sem a conta configurada)
- ✅ Fallback gracioso sem `OPENAI_API_KEY`: o widget responde "assistente temporariamente indisponível" em vez de quebrar
- ✅ Testado localmente: `widget-loader.js` serve 200, config de slug inexistente retorna 404, página do widget carrega 200

**O que está pendente (fora do código, depende de ação humana):**
- ⏳ Criar conta na OpenAI e configurar `OPENAI_API_KEY` — sem isso, o chat responde só a mensagem de indisponibilidade
- ⏳ Testar uma conversa real de ponta a ponta (consultar serviço → checar disponibilidade → criar agendamento) com uma chave válida
- ⏳ Validar o embed em um site de terceiro de verdade (fora do domínio da Calenvo) para confirmar que não há bloqueio de iframe em produção

---

## 🏗️ O que mudou

### Banco de dados
- Novo modelo `ChatWidgetConfig` (`userId` único, `enabled`, `welcomeMessage`, `primaryColor`, `position`) — migration `20251003070000_add_chat_widget_config`

### Camadas de serviço compartilhadas (reuso, não duplicação)
- `lib/availability-service.ts` — `getAvailableSlots({scheduleId, serviceId, date})`, extraída de `app/api/booking/[slug]/available-slots/route.ts` (que foi refatorada para chamá-la)
- `lib/tenant-resolver.ts` — `resolveTenantBySlug(slug)`, extraída de `app/api/booking/[slug]/create/route.ts` (refatorada também)
- `lib/ai/chat-agent.ts` chama essas funções **diretamente em código**, e não via HTTP — evita round-trips desnecessários e garante que a IA nunca tenha uma visão de disponibilidade diferente da que o cliente vê no formulário de booking público

### Agente de IA (`lib/ai/chat-agent.ts`)
- Modelo padrão: `gpt-4o-mini` (configurável via `OPENAI_CHAT_MODEL`) — escolhido pelo custo/latência baixos, adequado para um chat de alto volume; pode ser trocado para um modelo maior se a qualidade das respostas precisar melhorar
- 3 ferramentas: `list_services`, `check_availability`, `create_appointment` — a IA só cria o agendamento depois que o próprio modelo decide que tem confirmação explícita do cliente (instruído via system prompt), nunca antes de checar disponibilidade real
- Loop de até 5 rodadas de tool-calling por mensagem (evita loop infinito em caso de comportamento inesperado do modelo)

### Rotas do widget (`app/api/widget/[slug]/`)
- `GET /config` — dados públicos (nome do negócio, mensagem, cor, posição, se está habilitado) — sem autenticação, consumido pelo próprio iframe
- `POST /chat` — recebe o histórico de mensagens do cliente (mantido no próprio navegador, sem persistência no servidor — ver "Fast-follow"), roda o agente, retorna a resposta; CORS liberado, rate limit por tenant

### UI (`app/widget/chat/[slug]/page.tsx` + `public/widget-loader.js`)
- A mesma página serve os dois métodos de instalação — só muda como ela é embedada
- `postMessage({type:'calenvo-widget-resize', open})` do iframe para o `window.parent`, que o loader usa para animar o tamanho do container (bolha 64×64 ↔ painel 380×600, tela cheia em mobile)
- Instalação via iframe manual não tem a animação de resize (documentado na própria tela de configuração)

### Painel (`/dashboard/chat-widget`)
- Liga/desliga o widget, edita mensagem/cor/posição, mostra os 2 snippets prontos (com o slug do tenant já preenchido) e botão de copiar
- Restrito a usuários MASTER (`canManageSettings`), mesmo padrão do Item 2

---

## ⏳ Pendências (ação humana necessária)

### 1. Criar conta OpenAI
Gerar uma API key em [platform.openai.com](https://platform.openai.com) e preencher `OPENAI_API_KEY` no `.env`/Netlify. Opcionalmente ajustar `OPENAI_CHAT_MODEL` se quiser um modelo diferente do `gpt-4o-mini` padrão.

### 2. Ativar rate limiting real (mesma pendência do Item 2)
Se ainda não configurado, `UPSTASH_REDIS_REST_URL`/`TOKEN` protegem tanto a API pública quanto o widget contra abuso — sem isso, funciona sem limite de requisições.

### 3. Teste ponta a ponta com chave real
1. `/dashboard/chat-widget` → ativar o chat, copiar o snippet de script
2. Colar em uma página HTML de teste (fora do domínio da Calenvo, para validar iframe cross-origin de verdade)
3. Conversar: pedir para agendar um serviço, confirmar disponibilidade, informar nome/telefone, confirmar
4. Verificar se o agendamento aparece no dashboard com a nota "Criado via chat de IA (widget)"

---

## 🚧 Fast-follow (não bloqueante, sinalizado para decisão futura)

- **Sem persistência de conversa**: o histórico do chat vive só no navegador do visitante (state em memória) — se a pessoa recarregar a página, a conversa reinicia. Suficiente para o caso de uso de agendamento (curto, direto ao ponto), mas não permite retomar conversas ou gerar analytics/relatórios de leads. Adicionar um modelo `ChatSession`/`ChatMessage` seria o próximo passo natural se isso vier a ser necessário.
- **Sem captura de lead antes da IA responder**: hoje a IA só pede nome/telefone quando o cliente já decidiu o horário. Se o objetivo for capturar contato mesmo de quem não fecha um agendamento, seria necessário um fluxo adicional.
- **Validação de iframe em produção**: como sinalizado na pesquisa original, não há bloqueio de `X-Frame-Options`/CSP hoje, mas isso nunca foi testado embedado num domínio de terceiro real — vale validar antes de divulgar a feature amplamente.

---

## 📁 Arquivos-chave

- `prisma/schema.prisma` (`ChatWidgetConfig`), `prisma/migrations/20251003070000_add_chat_widget_config/`
- `lib/ai/chat-agent.ts`, `lib/availability-service.ts`, `lib/tenant-resolver.ts`
- `app/api/widget/[slug]/chat/route.ts`, `app/api/widget/[slug]/config/route.ts`
- `app/widget/chat/[slug]/page.tsx`, `public/widget-loader.js`
- `app/api/dashboard/chat-widget/route.ts`, `app/dashboard/chat-widget/page.tsx`
- `app/api/booking/[slug]/available-slots/route.ts`, `app/api/booking/[slug]/create/route.ts` (refatorados)
- `components/dashboard/dashboard-sidebar.tsx`, `app/dashboard/mais/page.tsx`
- `.env.example`
