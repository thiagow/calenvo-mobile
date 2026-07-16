# Kick-off: Fechamento do MVP + separação do Agente de IA

> Documento de decisão e handoff. Escrito em 2026-07-15 após análise do codebase.
> Serve como contexto inicial para continuar o trabalho em outra sessão.

---

## Contexto para quem está pegando isso agora

O Calenvo é uma plataforma SaaS multi-tenant de agendamento (salões, clínicas de estética,
fisioterapia). O produto está muito mais completo do que parece: 34 telas de dashboard, agenda,
clientes, serviços, profissionais, pacotes, fidelidade, relatórios, Stripe, WhatsApp, i18n e API
pública já construídos.

**O problema não era escopo faltando — era escopo se expandindo.** Clientes começaram a pedir que
a IA fizesse atendimento (avaliação de cabelo, consulta de preço, venda de procedimento, triagem),
e cada conversa comercial adicionava requisito a um produto que nunca foi decidido.

### O diagnóstico

A IA que existe hoje (`lib/ai/chat-agent.ts`, 276 linhas) é um **agente de agendamento**:
três ferramentas (`list_services`, `check_availability`, `create_appointment`), `gpt-4o-mini`,
rodando **apenas no widget da página pública**.

O que os clientes pedem é um **atendente de IA no WhatsApp** — que não existe. Em
`app/api/webhooks/evolution/route.ts` o handler de `messages.upsert` é um `TODO`. O WhatsApp hoje
só envia notificação de saída; não lê nada que chega.

A distância entre os dois não é uma feature. É: inbound de WhatsApp, roteamento de conversa, base de
conhecimento por tenant, catálogo com contexto de venda, handoff para humano, e configuração
self-service por cliente. É um produto, não um incremento.

---

## As decisões tomadas (não reabrir sem motivo novo)

### 1. MVP = agenda + página pública + chat de agendamento

Está construído. **Fecha-se com endurecimento, não com features.**

### 2. A IA do MVP fica congelada em "agendamento por chat"

Nada de venda, triagem ou consulta de procedimento. A promessa muda, o código não:
posicionar como *"agendamento por chat"*, nunca como *"IA de atendimento"*. No momento em que a
promessa é "atendimento", todo cliente tem razão em pedir o que pediu.

**Única alavanca de customização do MVP:** o campo `businessConfig.description` já entra no system
prompt (`lib/ai/chat-agent.ts`, em `buildSystemPrompt`). É texto livre por tenant. Renomear na UI
para algo como *"Sobre o negócio e regras de atendimento"* com um placeholder bom. Isso cobre preço
(`list_services` já devolve `price`), regras de cancelamento e diferenciais — sem abrir um motor de
configuração. Custo: uma label e um placeholder.

### 3. O Agente de Atendimento com IA vira sub-produto

- **Exige Calenvo. Não existe versão standalone.** Sem a agenda por baixo, é um chatbot de WhatsApp
  — commodity que qualquer revendedor de n8n faz. O fosso é justamente `check_availability` +
  `create_appointment`: ele não só responde, ele *fecha o horário*. Standalone também viraria receita
  de agência: não compõe, não escala, não se vende. Com Calenvo como pré-requisito, cada venda de IA
  arrasta uma assinatura e o agente vira o melhor vendedor do Calenvo.
- **Sub-marca**, não marca nova.
- **Comercial:** taxa de configuração + mensalidade separada. A taxa de setup é o que *precifica a
  variância* — o "cada cliente quer diferente" só machucava porque era grátis. Cobrada, filtra quem
  é sério e força o cliente a entregar o insumo (procedimentos, preços, regras), que é onde o custo
  real mora. Não fazer taxa simbólica.
- **COGS:** diferente da agenda, atendente de IA lendo inbound queima token no volume do movimento do
  salão. Precificar com margem sobre consumo e ter **teto por conta desde o primeiro contrato**.
- **Guardrail do modo projeto:** a variância vive em **configuração e dados** (prompt, base de
  conhecimento, catálogo, ferramentas habilitadas — tudo registro no banco), **nunca em código**. Se
  um cliente exige mudança de código, ou se diz não, ou se generaliza para todos. No dia em que
  existir uma branch `agente-salao-do-joao`, são cinco forks e nenhum produto. ~4-5 projetos, achar o
  denominador comum, produtizar.

---

## Trabalho a fazer — em ordem

### P0 — Bloqueadores de lançamento (segurança / custo)

Estes são achados verificados no código, não hipóteses.

**1. Endpoints de debug sem autenticação, vazando dados entre tenants**

- `app/api/debug/whatsapp-config/route.ts` — `GET` público, sem checagem de sessão, retorna
  `whatsAppConfig` de **todos os tenants** (userId, instanceName, phoneNumber, status).
- `app/api/debug/scheduling-data/route.ts` — `GET` público, aceita `?userId=` arbitrário e retorna
  serviços/agendas de qualquer conta. Tem um userId real hardcoded como default.

Ambos estão comentados como `DEBUG ONLY - Remove after diagnosis`. **Deletar.**
`app/api/debug/session/route.ts` tem checagem de sessão (não vaza), mas não deve ir para produção.

**2. Chat do widget: rate limit falha aberto**

`app/api/widget/[slug]/chat/route.ts` é público, sem autenticação, com
`Access-Control-Allow-Origin: *`, e chama a OpenAI a cada request.

Ele chama `checkRateLimit`, mas em `lib/rate-limit.ts` a função **retorna `success: true` quando
`UPSTASH_REDIS_REST_URL`/`TOKEN` não estão configurados**. A decisão de falhar aberto foi deliberada
para não acoplar o lançamento da API pública a uma conta Upstash — razoável para a API autenticada,
perigosa aqui: nesta rota, o que passa direto vira fatura de OpenAI, e a conta é da plataforma, não
do tenant.

Corrigir:
- Falhar **fechado** nesta rota específica (manter o comportamento atual para a API autenticada).
- Cap de caracteres por mensagem e no payload total. Hoje `trimmedMessages` limita o histórico a 30
  mensagens, mas **não há limite de tamanho** — nada impede um POST com 300 KB numa mensagem só.
- Rate limit **por visitante**, além do por-tenant. A chave hoje é `widget:${tenant.id}`, então um
  abusador derruba o chat de todos os visitantes daquele salão.

**3. Varredura de autorização em toda a API**

Dois endpoints escaparam com o mesmo padrão (rota pública lendo dados de tenant sem checar sessão).
Verificar se há um terceiro **antes** de entrar dinheiro de cliente real. Auditar todas as rotas em
`app/api/**` procurando: falta de `getServerSession`, `userId` vindo de query param em vez da sessão,
e queries sem escopo por `userId`.

### P1 — Endurecimento antes do lançamento

- Stripe está em **modo test** (confirmado na auditoria em `docs/features/planos.md`). Migrar para
  live e revalidar os 12 Price IDs.
- `next.config.js` tem `ignoreBuildErrors: true` e ESLint suprimido, **sem nenhum gate de tipo no
  CI**. Nada impede erro de tipo chegar em produção. Adicionar `tsc --noEmit` no CI.
- Zero teste automatizado. Verificação hoje é via scripts manuais em `/scripts/`. No mínimo, cobrir
  os caminhos que mexem com dinheiro e com dados de outro tenant.
- 12 arquivos modificados não commitados no momento desta análise.

### P2 — Melhorias na página pública de agendamento

Escopo ainda não definido pelo fundador. Avaliar contra o padrão de design do projeto
(dark-first, tipografia editorial, referências Apple/Airbnb/Linear/Stripe/Vercel — ver `CLAUDE.md`).

### Fora do MVP — backlog do sub-produto

Registrar aqui todo pedido de cliente que caia em: venda por IA, triagem, avaliação/consulta de
procedimento, atendimento no WhatsApp, FAQ além do `businessConfig.description`. **Não implementar no
MVP.** Esses pedidos não são ruído — são a lista de requisitos e a lista de beta testers do produto 2.

---

## Como continuar

Comece pelo P0 na ordem em que está: os dois endpoints de debug, depois o chat do widget, depois a
varredura de autorização. São independentes entre si e todos são pequenos.

Padrão do projeto e convenções de código estão em `CLAUDE.md` e `/.agent/rules/`. Nada de `any`;
`cn()` para classes condicionais; `lib/db.ts` é o único Prisma client.
