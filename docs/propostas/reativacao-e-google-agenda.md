# Análise e proposta: (1) Reativação de clientes e (2) Integração com Google Agenda

Duas features independentes. Cada uma tem migration, backend e UI próprios e pode ser entregue separadamente. Recomendação de ordem: **1 primeiro**, porque usa só a infra que já existe (WhatsApp, QStash). A 2 depende de configurar um app OAuth no Google Cloud e da verificação do Google.

---

## 1) Reativação de clientes por prazo de retorno

### Contexto
O Calenvo atende negócios locais de vários segmentos cuja receita vem da recorrência, cada um com um ritmo próprio:

| Segmento | Exemplo de serviço | Retorno típico |
|---|---|---|
| Barbearia | corte | 15 a 30 dias |
| Salão | coloração | 45 a 60 dias |
| Nutricionista | consulta de acompanhamento | 30 dias |
| Fisioterapia | reavaliação | 7 a 15 dias |
| Dentista | limpeza ou profilaxia | 180 dias |
| Estética | sessão de manutenção | 21 a 30 dias |

Por isso a regra **não pode ter prazos fixos em dias**: tudo é relativo ao prazo do serviço. Os textos também precisam seguir a terminologia do segmento (Cliente ou Paciente ou Aluno; Serviço ou Procedimento), que já existe em `lib/segment-config.ts` (`terminology.client`, `terminology.service` etc.). Hoje o Calenvo não sabe quando um cliente deveria voltar. Por isso o dono não enxerga quem está sumindo e não tem como agir. A ideia é dar a cada serviço um prazo médio de retorno e, a partir do histórico, mostrar duas listas: **clientes com retorno próximo** e **clientes atrasados**. Pelas duas listas o dono dispara, **manualmente** (decisão do usuário), um WhatsApp de reativação.

### O que existe e será reaproveitado
- `Service` (`prisma/schema.prisma:313`): ainda não tem campo de retorno.
- Fila de WhatsApp com espaçamento anti-spam: `enqueueAccountJobs` em `lib/whatsapp-dispatch-queue.ts`, executada por `app/api/internal/dispatch-whatsapp/route.ts` (assinada pelo QStash). Passo aleatório de 1 a 4s em `lib/whatsapp-throttle.ts`.
- Envio e mensagens com variáveis: `WhatsAppTriggerService` (`lib/whatsapp-trigger.ts`) e `sendText` (`lib/uazapi.ts`).
- UI de mensagens configuráveis: `notification-card.tsx`, `variable-helper.tsx` e `message-preview.tsx` em `app/dashboard/canais-atendimento/_components/`.
- Fuso do tenant: `lib/timezone.ts` (`todayInZone`, `addCalendarDays`).
- Link público: `/booking/[slug]` (`BusinessConfig.publicUrl`).

### Regra de negócio
- Prazo por serviço: `Service.returnIntervalDays Int?`. Se for `null`, o serviço não gera retorno (ex.: um procedimento avulso).
- O que conta como último atendimento, por par cliente+serviço: o agendamento passado mais recente com status diferente de `CANCELLED`/`NO_SHOW` e `deletedAt = null`. Muitos tenants não marcam `COMPLETED`, então exigir esse status esconderia quase todo mundo.
- Retorno previsto = data do último atendimento + `returnIntervalDays`.
- A exclusão por agendamento futuro é **por serviço**. Um par cliente+serviço sai da lista quando já existe agendamento futuro em aberto (`SCHEDULED`/`CONFIRMED`) para aquele mesmo serviço.
  - Exemplo: se o cliente já marcou o corte, mas a coloração está atrasada, a coloração continua na lista.
  - A linha mostra a etiqueta "Tem agendamento em DD/MM" para o dono decidir se ainda envia.
- Classificação:
  - **Próximos**: o retorno previsto cai dentro da janela de antecedência, que é **20% do prazo do serviço, com piso de 3 dias e teto de 30**. Exemplos: corte de 30 dias → avisa a partir de 6 dias antes; limpeza dental de 180 dias → 30 dias antes; fisioterapia de 10 dias → 3 dias antes.
  - **Atrasados**: o retorno previsto já passou. Mostra "atrasado há X dias".
  - **Perdidos**: atraso maior que **2× o prazo do serviço**. Exemplos: corte de 30 dias sem volta há mais de 60 dias de atraso; dentista de 180 dias, mais de 360. Fica numa aba separada para não poluir os atrasados. Valores fixos ("180 dias") quebrariam para dentista ou fisioterapia.
  - Os percentuais vão para constantes em `lib/reactivation-service.ts`, cobertas por testes. Se no futuro algum segmento precisar de outro valor, eles podem virar configuração por serviço.
- **Cliente com vários serviços: uma linha por serviço.** Cada par cliente+serviço que esteja numa faixa (próximo, atrasado ou perdido) vira uma linha própria, com seleção e envio independentes. O dono pode avisar sobre a coloração atrasada e, separadamente, sobre o corte atrasado.
  - Na lista, as linhas do mesmo cliente ficam agrupadas sob o nome dele: cabeçalho com nome e telefone, e uma linha por serviço com o próprio status.
  - O "Selecionar todos" marca todas as linhas, inclusive vários serviços do mesmo cliente.
  - **Cada serviço selecionado gera uma mensagem própria.** Mensagens para o mesmo cliente saem em sequência na fila, com o espaçamento normal de 1 a 4 s, para não parecer rajada.
  - O diálogo de envio avisa quando isso vai acontecer, por exemplo: "3 clientes vão receber mais de uma mensagem".
- Escopo de visualização: o MASTER vê todos os clientes. O PROFESSIONAL vê os clientes cujo último atendimento no serviço foi com ele, **só para consulta**.
- **Envio exclusivo do MASTER.** Na UI, o botão, a seleção e a barra de envio não aparecem para o PROFESSIONAL. No servidor, as rotas de envio e de templates devolvem 403 quando `role !== 'MASTER'`. O bloqueio no servidor é obrigatório e não depende da UI.

### Modelo de dados (migration idempotente, no padrão de `20261009120000_add_booking_appearance`)
- `Service.returnIntervalDays Int?`
- Novo `MessageTemplate` (templates parametrizáveis): `id, userId, kind (REACTIVATION), name, body @db.Text, isDefault Boolean, isActive Boolean, timestamps`.
  - Índice `@@index([userId, kind])`.
  - No máximo um `isDefault` por `userId+kind`, garantido numa transação na rota que marca o padrão.
  - O `kind` é um enum para que o mesmo modelo sirva, no futuro, a outros envios manuais (aniversário, promoção) sem nova tabela.
- `Service.reactivationTemplateId String?` (FK opcional para `MessageTemplate`, `onDelete: SetNull`): template sugerido para aquele serviço. Exemplo: "Retorno de limpeza dental" para o serviço de limpeza.
- Novo `ReactivationMessage`: `id, userId, clientId, serviceId, templateId?, renderedBody @db.Text, status (QUEUED|SENT|FAILED|SKIPPED), error?, sentAt?, createdAt`.
  - Índice `[userId, clientId, serviceId, createdAt]`.
  - O `renderedBody` guarda o texto exato enviado, porque o template pode ser editado depois.
  - Serve para três coisas:
    - histórico ("avisado há 3 dias");
    - trava anti-duplicata: não reenviar **para o mesmo cliente+serviço** em 7 dias, salvo se o dono forçar;
    - métrica de conversão: cliente que agendou aquele serviço depois do `sentAt` conta como "reativado".
- Índice novo em `Appointment`: `@@index([userId, clientId, date])`, para a consulta de último atendimento.
- Aplicar com `migrate deploy`, que já roda no build da Netlify. **Nunca usar `migrate dev`** (ver a memória sobre isso).

### Backend
- `lib/reactivation-service.ts`:
  - `classifyReturn(lastDate, intervalDays, today)` é uma função pura e testável.
  - `listReactivationCandidates(userId, { scope, windowDays, professionalId? })` faz **uma** query SQL com `DISTINCT ON ("clientId","serviceId")`. Ela junta `Service` (retorno não nulo), exclui quem tem agendamento futuro e traz o último `ReactivationMessage`. Não usar N+1 nem varrer o histórico em memória.
- `GET /api/reactivation?scope=overdue|upcoming|lost&window=7` devolve a lista com contadores das três abas. Fluxo: auth → validação Zod → lógica → resposta.
- `GET /api/reactivation/summary` devolve só os contadores, para o card do dashboard e o badge do menu.
- `POST /api/reactivation/send` (somente MASTER):
  - Corpo: `{ items: [{ clientId, serviceId }], templateId?, force? }`.
  - Valida com Zod. Aceita no máximo 200 itens por envio.
  - Confere que clientes, serviços e template pertencem ao tenant (multi-tenancy) e que o WhatsApp está conectado.
  - Recalcula a elegibilidade de cada par no servidor. Não confia na lista vinda do client.
  - **Escolha do template, por item**: o `templateId` enviado no diálogo; senão o `reactivationTemplateId` do serviço; senão o template padrão do tenant; senão a mensagem padrão do sistema.
  - Cria um `ReactivationMessage(QUEUED)` por par e enfileira os jobs.
- **CRUD de templates** em `/api/message-templates` (GET para MASTER e PROFESSIONAL; POST, PATCH e DELETE só para MASTER):
  - valida com Zod (`name` de 1 a 60 caracteres, `body` de 1 a 1000);
  - rejeita variável desconhecida no `body`, por exemplo `{{nomee}}`, com uma mensagem clara;
  - não deixa excluir o último template padrão sem escolher outro.
- **Renderização**: `renderTemplate(body, vars)` é uma função pura em `lib/message-template.ts`. A lista de variáveis permitidas fica num único lugar, compartilhado por validação, prévia e envio.
- `lib/whatsapp-dispatch-queue.ts`: acrescentar `{ kind: 'reactivation'; messageId: string }` ao `DispatchJob`, no arquivo e no `dispatch-whatsapp`.
- No `dispatch-whatsapp`, o handler `dispatchReactivation`:
  1. Relê o registro e verifica de novo se o cliente agendou nesse meio-tempo. Se agendou, marca `SKIPPED`.
  2. Renderiza no momento do enfileiramento (o resultado fica em `renderedBody`) com as variáveis do template: `{{nome}}`, `{{primeiro_nome}}`, `{{servico}}`, `{{ultimo_atendimento}}` (data), `{{dias_desde_ultimo}}`, `{{dias_atraso}}`, `{{profissional}}`, `{{empresa}}` e `{{link_agendamento}}`.
  3. Envia e marca `SENT` ou `FAILED`. Falha relevante vai para o `ErrorLog`.
- O telefone segue o mesmo normalizador já usado (`formatWhatsAppNumber`).

### UI
- **Cadastro e edição de serviço** (`app/dashboard/services/new` e `[id]`): campo "Retorno médio" com atalhos em linguagem humana: 1 semana, 15 dias, 1 mês, 2 meses, 3 meses, 6 meses e 1 ano. Tem também a opção "Personalizado (dias)", de 1 a 730, e "Sem retorno", que é o padrão. Texto de ajuda adaptado à terminologia: "Usado para avisar {{clients}} que estão perto de voltar."
- **Todos os rótulos das telas novas** vêm de `getSegmentConfig(...).terminology`: "Pacientes atrasados", "Retorno de alunos", "Procedimento" no lugar de "Serviço" etc. Nada de texto fixo de salão ou de clínica.
- **Templates de mensagem**, numa nova aba "Modelos de mensagem" em Canais de atendimento, editável só pelo MASTER:
  - Lista de templates com nome, trecho do texto e marca "Padrão". Ações: criar, editar, duplicar, definir como padrão e excluir.
  - Editor com o `variable-helper` (clicar insere a variável no cursor), contador de caracteres e **prévia ao vivo** (`message-preview.tsx`) preenchida com um cliente de exemplo. Variável inválida fica destacada antes de salvar.
  - Na primeira visita, já vêm 2 templates sugeridos e neutros para qualquer segmento:
    - "Lembrete de retorno" (padrão): "Olá {{primeiro_nome}}! Já faz {{dias_desde_ultimo}} dias desde seu último {{servico}} com a {{empresa}}. Que tal agendar seu retorno? {{link_agendamento}}"
    - "Sentimos sua falta": "Oi {{primeiro_nome}}, tudo bem? Faz um tempo que você não vem fazer {{servico}} aqui na {{empresa}}. Separamos horários pra você: {{link_agendamento}}"
  - No cadastro do serviço há o campo opcional "Mensagem de retorno", um select com os templates, logo abaixo do "Retorno médio".
- **Nova tela `/dashboard/clients/retorno`**, acessada por abas na página de Clientes ("Todos | Retorno"):
  - Abas **Atrasados (N)**, **Próximos (N)** e **Perdidos (N)**, com contador no rótulo.
  - Linhas agrupadas por cliente:
    - o cabeçalho do grupo tem avatar com as iniciais, nome, telefone e um checkbox que marca todos os serviços daquele cliente;
    - cada serviço é uma sub-linha com nome do serviço, último atendimento, retorno previsto, chip de urgência ("atrasado há 12 dias" em âmbar ou vermelho por faixa; "em 3 dias" em neutro), "Avisado há X dias" se houver, e checkbox próprio.
  - "Selecionar todos" e uma barra fixa embaixo com "Enviar lembrete (N mensagens · M clientes)". Só aparece para o MASTER.
  - O botão abre um diálogo de envio com:
    - um **seletor de template**, cujo valor inicial é "Usar o template de cada serviço", com opção de forçar um template para todos;
    - a prévia renderizada, navegável entre os destinatários com ‹ ›;
    - um resumo: quantas mensagens, quantos clientes recebem mais de uma, quantas foram puladas por aviso recente (< 7 dias) e a opção "Enviar mesmo assim";
    - o botão de confirmação.
  - Topo da tela: resumo de conversão, por exemplo "Últimos 30 dias: 24 avisados · 7 voltaram (29%)".
  - Estado vazio didático: se nenhum serviço tem prazo, mostra o CTA "Defina o retorno médio dos seus serviços" com link para Serviços.
- **Dashboard inicial**: card "Clientes para reativar", com N atrasados e N próximos, levando à tela.
- **Menu lateral**: badge com o número de atrasados.
- **Canais de atendimento**: a aba "Modelos de mensagem" descrita acima. Não há toggle de automação, porque o envio é manual.

### Testes (Vitest, junto do código)
- `lib/reactivation-service.test.ts`:
  - classificação nas bordas: dia exato, fuso e intervalo nulo;
  - janela proporcional nos três tamanhos: 10 dias (bate no piso), 30 dias e 180 dias (bate no teto);
  - limite de "Perdidos" em 2× o prazo;
  - cliente com 2 serviços atrasados gera 2 itens independentes;
  - agendamento futuro de um serviço não exclui o outro serviço do mesmo cliente.
- `lib/message-template.test.ts`: renderização de todas as variáveis, variável desconhecida rejeitada, nome ausente com fallback.
- Rotas: PROFESSIONAL recebe 403 em envio e no CRUD de templates; a ordem de escolha do template é item enviado → serviço → padrão → sistema.
- Rota de envio: rejeita `clientId`, `serviceId` ou `templateId` de outro tenant; respeita a janela de 7 dias por cliente+serviço e o `force`.
- Dispatch: marca `SKIPPED` se o cliente agendou depois do enfileiramento.

### Verificação
1. `npx tsc --noEmit` e `npm test`.
2. Em dev, criar dois serviços: um de 30 dias e outro de 180 dias (dentista). Criar clientes com estes atendimentos:
   - 40 dias atrás no serviço de 30 dias: deve aparecer em Atrasados;
   - 25 dias atrás no serviço de 30 dias: deve aparecer em Próximos;
   - 100 dias atrás no serviço de 30 dias: deve aparecer em Perdidos;
   - 160 dias atrás no serviço de 180 dias: deve aparecer em Próximos.

   Depois, criar um agendamento futuro para um desses clientes e ver que ele some da lista. Trocar o segmento do tenant para um da área de saúde e conferir que os rótulos viram "Pacientes" e "Procedimento".
3. Dar ao mesmo cliente dois serviços atrasados, conferir as duas sub-linhas e enviar só uma delas. Criar um template, associá-lo a um serviço e conferir que ele é usado. Entrar como PROFESSIONAL e conferir que não aparece botão de envio e que a API devolve 403.
4. Enviar para os dois com o WhatsApp conectado. Conferir as mensagens chegando espaçadas, o "Avisado há 0 dias" e que um novo envio é pulado.

---

## 2) Integração com Google Agenda (Calendar)

> O pedido dizia "Google Maps", mas a descrição ("replicado no Calendário do Google") é do **Google Agenda**. O plano trata do Google Agenda.

### Contexto
Os profissionais vivem no calendário do celular. Hoje precisam abrir o Calenvo para ver a agenda. O objetivo é: ao ativar a integração, **todo agendamento criado, remarcado ou cancelado no Calenvo é replicado automaticamente no Google Agenda**. A conexão é **por profissional** (decisão do usuário): cada um conecta o próprio Google e recebe só os seus agendamentos. O dono, se conectar, pode escolher receber os de todos.

### Decisões técnicas
- **Sincronização só de ida (Calenvo → Google)**. A volta, usar os eventos do Google para bloquear horários, fica para uma fase 2, porque exige webhooks (`watch`) e reconciliação.
- **OAuth próprio, separado do login do NextAuth**: a integração é um vínculo de conta, não um método de login. Usar `access_type=offline`, `prompt=consent` e `state` assinado (HMAC com `NEXTAUTH_SECRET`), amarrado ao `userId` da sessão e guardado também num cookie httpOnly, para proteger contra CSRF.
- **Escopo mínimo: `https://www.googleapis.com/auth/calendar.app.created`**. O Calenvo cria um calendário próprio "Calenvo" na conta do profissional e só consegue mexer nele, sem ler os outros eventos da pessoa. Vantagens: privacidade, um consentimento menos assustador e um calendário que pode ser ligado e desligado e tem cor própria no Google.
- **Sem o pacote `googleapis`** (pesado). Um cliente REST enxuto em `lib/google-calendar.ts`, no mesmo padrão de `lib/uazapi.ts`: troca de code, refresh de token, criação de calendário, insert, patch e delete de evento, e revogação.
- **Segurança**: o `refreshToken` fica criptografado com `encryptSecret`/`decryptSecret` (`lib/crypto.ts`, AES-256-GCM) e nunca vai para o client, com o mesmo cuidado de `omit` aplicado hoje ao `WhatsAppConfig.apiKey`. O access token não é persistido: ele é renovado a cada job.
- **Assíncrono via QStash**: criar um agendamento nunca pode esperar nem falhar por causa do Google. Reaproveitar o cliente QStash que já existe e a verificação de assinatura (`verifySignatureAppRouter`). O QStash cuida de retries.
- **Idempotência**: o job carrega só `appointmentId`. O handler sempre lê o estado atual do agendamento e decide entre criar, atualizar ou apagar o evento. Assim, jobs fora de ordem ou repetidos não geram duplicata nem estado errado.

### Modelo de dados
- `GoogleCalendarConnection`: `id, userId @unique, googleEmail, refreshToken (criptografado), calendarId, syncEnabled Boolean @default(true), includeAllProfessionals Boolean @default(false)` (só tem efeito para o MASTER), `status (ACTIVE|REVOKED|ERROR), lastError?, lastSyncAt?, timestamps`.
- `AppointmentCalendarEvent`: `id, appointmentId, connectionId, googleEventId, updatedAt`, com `@@unique([appointmentId, connectionId])`. Um agendamento pode virar dois eventos, um no calendário do profissional e outro no do dono. A relação usa `onDelete: Cascade` a partir da conexão.

### Backend
- `GET /api/integrations/google/connect`: gera o `state` e redireciona para o consentimento do Google.
- `GET /api/integrations/google/callback`:
  1. Valida o `state` e o cookie.
  2. Troca o `code` pelos tokens e lê o e-mail (via `userinfo` / id_token).
  3. Cria o calendário "Calenvo" com o fuso do tenant e salva a conexão.
  4. Enfileira o **backfill** dos agendamentos futuros dos próximos 90 dias.
- `PATCH /api/integrations/google` liga e desliga o sync e o `includeAllProfessionals`. `DELETE` revoga o token no Google e apaga a conexão. Os eventos no calendário "Calenvo" ficam lá; o usuário pode remover o calendário inteiro.
- `lib/calendar-sync.ts`: `enqueueCalendarSync(appointmentId)` publica um job em `/api/internal/google-calendar-sync`. Se o tenant não tiver nenhuma conexão ativa, nada é publicado.
- **Pontos de disparo**: os mesmos lugares onde hoje chamamos `WhatsAppTriggerService`.
  - Criação: `app/api/appointments/route.ts`, `app/api/booking/[slug]/create/route.ts`, `app/api/v1/appointments/route.ts` e `lib/ai/chat-agent.ts`.
  - Edição, remarcação, cancelamento e exclusão lógica: `app/api/appointments/[id]/route.ts` e `lib/appointment-service.ts`.
  - O `enqueueCalendarSync` entra logo depois do commit da transação, nunca dentro dela.
- `POST /api/internal/google-calendar-sync` (assinado pelo QStash):
  - Calcula as conexões-alvo: a do `professionalId` do agendamento e, se o MASTER tiver `includeAllProfessionals`, também a dele.
  - Se o agendamento estiver `CANCELLED`/`NO_SHOW`/`deletedAt`: apaga os eventos e as linhas de mapeamento.
  - Se não estiver: faz `patch` do evento existente ou `insert` de um novo, e grava o mapeamento.
  - Se o agendamento trocou de profissional, apaga o evento da conexão antiga.
  - Se o Google responder `invalid_grant`: marca a conexão como `REVOKED`, cria uma `Notification` in-app ("Reconecte seu Google Agenda") e não refaz o job.
  - Erro 5xx ou 429: devolve 500 para o QStash tentar de novo.
- **Conteúdo do evento** (`buildCalendarEvent`, função pura):
  - título "Serviço · Nome do cliente";
  - início e fim com o fuso do tenant (`lib/timezone.ts`);
  - descrição com serviço, profissional, observações e link para o agendamento no dashboard;
  - telefone do cliente **só se** o tenant ativar essa opção (LGPD: dado pessoal indo para terceiro, desligado por padrão);
  - `extendedProperties.private.calenvoAppointmentId`, para rastreio.

### UI
- Componente único `GoogleCalendarCard`, usado em dois lugares:
  - MASTER: `/dashboard/settings`, numa nova seção "Integrações";
  - PROFESSIONAL: `/dashboard/profile`. O professional não tem acesso às Configurações, porque a rota `business-config` bloqueia esse papel.
- **Desconectado**: logo do Google, a explicação "Seus agendamentos aparecem automaticamente num calendário 'Calenvo' no seu Google Agenda" e o botão "Conectar Google Agenda".
- **Conectado**:
  - e-mail conectado e o horário da última sincronização;
  - toggle "Sincronizar agendamentos";
  - para o MASTER, o toggle "Receber agendamentos de todos os profissionais";
  - toggle "Incluir telefone do cliente";
  - botão "Desconectar".
- **Revogado ou com erro**: um alerta âmbar com o botão "Reconectar".
- Na volta do OAuth, um toast de sucesso ou erro, via query param `?google=connected|error`.

### Pré-requisitos externos (o usuário precisa fazer)
1. No Google Cloud Console: criar um projeto, ativar a **Google Calendar API**, configurar a tela de consentimento OAuth e criar um Client ID do tipo Web. Redirect URI: `https://calenvo.app/api/integrations/google/callback`, e o equivalente em localhost para dev.
2. Envs novas: `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. Atualizar o `.env.example` e a seção de env vars do `CLAUDE.md`. Sem elas, o card fica oculto (degradação graciosa, como as outras integrações).
3. **Verificação do app no Google**: os escopos de Calendar são "sensíveis". Enquanto o app está em modo *Testing*, há duas limitações: no máximo 100 usuários de teste e **o refresh token expira em 7 dias**. Para produção é preciso publicar e passar pela verificação, que exige política de privacidade, domínio verificado e um vídeo de demonstração, e costuma levar de dias a semanas. Isso deve começar em paralelo com o desenvolvimento.

### Testes
- `lib/google-calendar.test.ts`: montagem do evento (fuso, duração, telefone opcional), assinatura e validação do `state` (expiração, `userId` errado).
- Handler de sync: cria, depois atualiza, depois apaga conforme o estado; troca de profissional apaga o evento antigo; `invalid_grant` marca `REVOKED` sem lançar erro. Tudo com `fetch` mockado.

### Verificação
1. `npx tsc --noEmit` e `npm test`.
2. Em dev, com um Client ID de teste: conectar, ver o calendário "Calenvo" aparecer no Google e os agendamentos futuros serem preenchidos pelo backfill.
3. Criar pelo dashboard e pela página pública, remarcar, trocar o profissional e cancelar. Conferir cada reflexo no Google em segundos.
4. Revogar o acesso em myaccount.google.com, criar um agendamento e ver a conexão como "Reconectar", com a notificação in-app.

---

## Fora de escopo (sugestões para depois)
- Reativação automática agendada (o usuário escolheu só manual por enquanto). A estrutura de `ReactivationMessage` já comporta um cron no futuro.
- Sincronização de volta (Google → Calenvo) para bloquear horários ocupados.
- Outlook e iCloud. A fundação (`AppointmentCalendarEvent` e um sync idempotente) deixa a porta aberta.
