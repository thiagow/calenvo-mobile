# Roadmap — Calenvo

> Lista de possíveis novas funcionalidades em avaliação. Nenhum item aqui está implementado ou com data definida — este documento serve para registrar, priorizar e detalhar ideias antes de virarem trabalho de fato.

## Como usar este documento

- **Status**: `💡 Ideia` (só o essencial capturado) → `🔍 Em análise` (escopo sendo desenhado) → `📋 Planejado` (plano aprovado, pronto pra implementar) → `🚧 Em andamento` → `✅ Concluído`
- Ao decidir avançar um item, criar um plano de implementação dedicado (via `/plan` ou equivalente) referenciando a seção correspondente aqui.
- Ao concluir, mover o item para uma seção "Concluído" no fim do documento com a data e o link do commit/PR, em vez de apagar.

---

## 1. Integração nativa com Google Calendar

**Status:** 💡 Ideia

Sincronizar agendamentos do Calenvo com o Google Calendar do profissional/negócio — bidirecional (bloqueios criados no Google Calendar impedem novos agendamentos no Calenvo) ou, no mínimo, unidirecional (agendamento no Calenvo cria evento no Google Calendar).

**Pontos a decidir:**
- Direção da sincronização: só exportar (Calenvo → Google) ou bidirecional (exige polling/webhooks do Google e resolução de conflito).
- Escopo OAuth do Google Calendar API, armazenamento seguro de tokens de acesso/refresh por usuário.
- Como isso interage com o sistema de disponibilidade já existente (`lib/availability-service.ts`) — eventos do Google precisam entrar no cálculo de horários livres.
- Se é por profissional (múltiplos calendários por conta) ou só por conta.

---

## 2. Webhook para integração com outras plataformas

**Status:** 💡 Ideia

Permitir que o negócio configure um endpoint próprio (webhook de saída) que recebe eventos do Calenvo — criação/cancelamento/confirmação de agendamento, novo cliente, etc. — para integrar com CRMs, planilhas, Zapier/Make, sistemas internos do cliente.

**Pontos a decidir:**
- Quais eventos disparam webhook (reaproveitar o mesmo catálogo de triggers já usado pelo WhatsApp em `lib/whatsapp-trigger.ts` como referência de "pontos de disparo" existentes no sistema).
- Formato do payload, versionamento do contrato, assinatura HMAC para autenticidade.
- Reentrega com backoff em caso de falha (o padrão de retry exponencial já existe em `lib/whatsapp-trigger.ts` para outro caso e pode servir de referência).
- Tela de configuração: URL do webhook, segredo, log das últimas entregas (sucesso/falha) para o usuário depurar a própria integração.

---

## 3. Ordenação da tela de Clientes

**Status:** 💡 Ideia — baixa complexidade

Hoje a listagem em `app/dashboard/clients/page.tsx` não tem controle de ordenação explícito. Adicionar:
- Ordenação padrão por nome (A-Z).
- Seletor de ordenação: nome (A-Z / Z-A), mais recentes / mais antigos (`createdAt`), talvez "mais agendamentos" já que `appointmentsCount` já é calculado.

Candidato natural a ser o primeiro item implementado — escopo pequeno e bem definido, sem dependências externas.

---

## 4. Cancelamento de agendamento pelo cliente (página pública e chat)

**Status:** ✅ Concluído — ver seção "Concluído" no fim do documento.

---

## 5. Wizard de configuração no primeiro acesso

**Status:** 💡 Ideia

Fluxo guiado (multi-step) para um novo usuário configurar o essencial logo após o cadastro: nome/segmento do negócio, primeiro serviço, horário de atendimento (Schedule), logomarca, e opcionalmente já conectar o WhatsApp — hoje o usuário cai direto no dashboard vazio e precisa descobrir cada tela sozinho.

**Pontos a decidir:**
- Quantos passos, quais são obrigatórios vs. puláveis.
- Persistir progresso (permitir sair e voltar depois) — provavelmente um campo tipo `onboardingCompletedAt`/`onboardingStep` no `User`.
- Reaproveitar os formulários/telas já existentes (Serviços, Agendas, Configurações) dentro do wizard, em vez de duplicar lógica.

---

## 6. Recorte de imagem da logomarca em Configurações

**Status:** 💡 Ideia — baixa/média complexidade

Hoje o upload de logomarca (em Configurações) provavelmente aceita a imagem como está, sem controle de enquadramento. Adicionar um crop (recorte) antes do upload final — usuário ajusta zoom/posição num círculo ou quadrado antes de salvar, garantindo consistência visual com os lugares onde a logo aparece (círculo no header do dashboard, círculo na página pública de booking — ver item já implementado no `app/booking/[slug]/page.tsx`).

**Pontos a decidir:**
- Biblioteca de crop client-side (ex.: `react-easy-crop` ou similar) — avaliar contra o padrão de dependências já aprovado no projeto.
- Formato de saída (quadrado? circular com fundo transparente?) e resolução mínima/máxima.
- Fluxo: cortar no client antes de enviar pro endpoint de upload (`app/api/files/logo` ou equivalente), evitando reprocessar no servidor.

---

## 7. Confirmação automática — ajuste para chat e página pública

**Status:** 🔍 A analisar

O toggle "Confirmação automática" em Configurações hoje aparentemente controla o status inicial do agendamento de forma genérica (`autoConfirm` em `BusinessConfig`, usado em `lib/ai/chat-agent.ts` no momento da criação: `initialStatus = tenant.businessConfig.autoConfirm ? 'CONFIRMED' : 'SCHEDULED'`). O ajuste pedido é separar o comportamento especificamente para agendamentos vindos do **chat** e da **página pública**:

- Quando a confirmação automática estiver **desligada** para esses canais: o agendamento é criado como `SCHEDULED` (pendente), o cliente recebe uma mensagem avisando que o agendamento **precisa de confirmação** do negócio, e a notificação normal de "agendamento confirmado" só é enviada **depois** que o negócio confirmar manualmente pelo dashboard.
- Hoje, pelo fluxo do dashboard, ao marcar como `CONFIRMED` já dispara `WhatsAppTriggerService.onAppointmentConfirmed` (`app/api/appointments/[id]/route.ts`) — esse caminho já serve para a "confirmação após revisão manual"; o que falta é a mensagem inicial diferenciada avisando que está pendente, no momento da criação via chat/página pública.

**Pontos a analisar:**
- Novo template de mensagem "Agendamento recebido, aguardando confirmação" — key nova no `WhatsAppConfig` (mesmo padrão de `notifyOnCreate`/`createMessage` etc.) ou reaproveitar a mensagem de criação existente com uma variante condicional.
- Escopo do toggle: hoje é uma configuração única (`autoConfirm`); avaliar se vira duas configs independentes (confirmação automática para chat vs. para página pública) ou uma só que cobre "reservas feitas por canais públicos" como conceito único.

---

## 8. Sinal de depósito em Serviços — regra de confirmação e aviso de pagamento

**Status:** 🔍 A analisar

O toggle "Sinal de depósito" (por serviço, tela de Serviços) precisa passar a acionar uma regra de negócio quando o agendamento vem da página pública ou do chat:

- Agendamento entra como pendente de confirmação (mesmo mecanismo do item 7).
- Cliente é avisado, no momento do agendamento, que: (a) o agendamento precisa de confirmação, (b) o negócio entrará em contato com os dados de pagamento do sinal, e (c) a agenda só é confirmada de fato após o pagamento.
- Configuração do valor do sinal: **valor fixo (R$) ou percentual (%)** sobre o preço do serviço — precisa de um campo de tipo (`FIXED` | `PERCENTAGE`) e o valor correspondente no modelo `Service`.

**Pontos a analisar:**
- Cobrança em si está fora de escopo deste item (não é integração de pagamento automática) — é só cálculo do valor do sinal + aviso ao cliente + trava de confirmação manual. Definir se/quando entra um fluxo de pagamento automatizado (Stripe já é usado no projeto para assinaturas — avaliar se cabe reaproveitar para cobrança de sinal, como iniciativa separada).
- Cálculo do valor do sinal quando percentual: sobre o preço do serviço (`Service.price`) — o que fazer se o serviço não tiver preço definido ou preço "a partir de" (feature de preço já implementada, ver `showPriceOnBooking`/`priceIsStartingFrom` em `lib/types.ts`)?
- Mensagem ao cliente precisa deixar claro o valor calculado do sinal no momento do agendamento (chat e página pública).
- Interação com o item 7: um serviço com sinal ativado deveria sempre exigir confirmação manual, independente do toggle geral de confirmação automática?

---

## 9. Comando de voz e respostas em voz (admin)

**Status:** 💡 Ideia — maior complexidade/risco

Permitir que o dono da conta consulte e insira agendamentos por comando de voz, com resposta também em voz, dentro do dashboard.

**Pontos a decidir:**
- Speech-to-text (captura do comando) e text-to-speech (resposta) — client-side (Web Speech API, com suporte inconsistente entre navegadores/dispositivos) vs. serviço de terceiro (ex.: OpenAI Whisper/TTS, já que o projeto já integra IA via `lib/ai/chat-agent.ts` para o chat de clientes — dá pra avaliar reaproveitar a mesma infraestrutura de agente/tools para consulta e criação de agendamento por voz do admin).
- Reaproveitar as mesmas "tools" de agendamento já existentes no agente de IA do chat (`lib/ai/chat-agent.ts`) como camada de execução, trocando só a interface de entrada/saída (voz em vez de texto), em vez de duplicar lógica de negócio.
- Latência aceitável para uma interação por voz fluida, custo por chamada em escala.
- Este é o item de maior incerteza técnica da lista — recomenda-se uma prova de conceito isolada antes de comprometer com uma UI completa.

---

## Concluído

### 4. Cancelamento de agendamento pelo cliente (página pública e chat)

**Concluído em:** 2026-07-30 — commit `0443282` ("feat: allow clients to self-cancel appointments (public booking + chat widget)")

Business owner pode habilitar auto-cancelamento com prazo mínimo de antecedência configurável (`BusinessConfig.allowClientCancellation` / `cancellationHours`). Disponível tanto na página pública de booking (fluxo "Já sou cliente": telefone → agendamentos em aberto → cancelar) quanto no chat via IA (`list_my_appointments`/`cancel_appointment` em `lib/ai/chat-agent.ts`), compartilhando a mesma regra de elegibilidade em `lib/appointment-service.ts` para os dois canais não poderem contornar a regra do negócio. Profissional pode ser notificado por WhatsApp quando o cliente cancela sozinho.
