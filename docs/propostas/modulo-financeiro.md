# Análise e proposta: Módulo Financeiro opcional

Módulo **opcional**, com direito de uso por tenant. Ele cobre contas a receber (manual e automática pela conclusão de agendamentos), contas a pagar, caixa com fechamento e acerto de comissões com os profissionais. **Com o módulo desligado, o Calenvo funciona exatamente como hoje.** Ele é entregue em 6 fases independentes (ver o fim do documento).

## Status

| Etapa | Situação |
|---|---|
| Correção do `PUT/GET/DELETE /api/appointments/[id]` para PROFESSIONAL | ✅ Feito e em produção |
| Fase 1: Fundação | ✅ Feito e em produção (migration `20261110120000_add_finance_foundation`) |
| Fases 2 a 6: comanda, contas a receber, caixa, comissões e acertos, contas a pagar, pacotes, relatórios, add-on Stripe | ✅ Código pronto. Migration `20261110180000_add_finance_operations` |

Verificação ponta a ponta contra o banco, sempre desfeita no fim: `npx tsx scripts/finance-flow-check.ts <tenantId>`.

Para cobrar o add-on, configure `STRIPE_FINANCE_ADDON_PRICE_ID` (e `_USD`). Sem essas variáveis, o módulo só é liberado pelo SaaS Admin.

---|---|
| Correção do `PUT/GET/DELETE /api/appointments/[id]` para PROFESSIONAL | ✅ Feito, com testes em `app/api/appointments/[id]/route.test.ts` |
| Fase 1: Fundação | ✅ Código pronto. Migration `20261110120000_add_finance_foundation` ainda não aplicada no banco |
| Fases 2 a 6 | Pendentes |

---

## Contexto

O Calenvo não tem nenhuma camada financeira:
- `Appointment` guarda só um `price Float?` (`prisma/schema.prisma:418`) e um único `serviceId`.
- Não existem forma de pagamento, status de pagamento nem data de pagamento.
- O único número de receita é o LTV (`app/api/reports/ltv/route.ts`), a soma de `price` dos agendamentos `COMPLETED`.

O cliente-alvo (salões, barbearias, clínicas) trabalha quase sempre com profissionais **comissionados**, e hoje o acerto é feito em planilha ou caderno. O módulo precisa:

1. Lançar automaticamente no **contas a receber** e no **caixa** cada atendimento concluído, pelo preço dos serviços executados.
2. Aceitar recebíveis **manuais** (venda avulsa, produto) e um **contas a pagar** (aluguel, insumos, impostos).
3. Ter **caixa** com abertura, suprimento, sangria e **fechamento com conferência**.
4. Fazer o **acerto com cada profissional**, com comissão **fixa ou percentual**, no fechamento do caixa ou por período.

## Decisões de produto

| Tema | Decisão |
|---|---|
| Habilitação | **Direito de uso + chave liga/desliga.** O direito de uso vem de um add-on pago (Stripe) ou de uma liberação do SaaS Admin. Com ele, o MASTER liga e desliga o módulo em Configurações. |
| Base da comissão | **Configurável.** O padrão é o valor cobrado depois dos descontos. O MASTER pode optar por descontar também a taxa da forma de pagamento (maquininha). |
| Regra de comissão | **Hierarquia:** `profissional × serviço` > `padrão do profissional` > sem comissão. Cada regra é percentual ou valor fixo. Exemplo: 40% no corte, 30% na química, R$ 15 fixos na barba. |
| Pacotes | **A receita entra na venda do pacote.** Cada sessão concluída gera comissão sobre o valor proporcional da sessão, sem cobrar o cliente de novo. |

## O que existe e será reaproveitado

- **Conclusão de agendamento:** o único caminho no servidor é `PUT /api/appointments/[id]` (`app/api/appointments/[id]/route.ts:271-396`). Ali já rodam, sem bloquear a resposta, a dedução de pacote (`processPackageDeduction`, `app/actions/packages.ts`) e a fidelidade (`processLoyaltyEarn`, `app/actions/loyalty.ts`). O financeiro entra no mesmo lugar e segue o mesmo padrão.
- **Profissional:** é um `User` com `role = PROFESSIONAL` e `masterId`. `Appointment.userId` é sempre o MASTER (tenant) e `Appointment.professionalId` é o profissional.
- **Escopo do tenant:** `getSessionScope({ requireMaster })` (`lib/session-scope.ts:12`) e `resolveTenantScope` (`lib/reactivation-service.ts:173`).
- **Fuso e moeda:** `lib/timezone.ts` define o dia do caixa e `User.currency` define a moeda.
- **Menu:** "Mais" (`app/dashboard/mais/page.tsx:25-51`), filtrado por `hooks/use-user-permissions.ts`.
- **Testes:** libs puras com teste ao lado (`lib/reactivation-service.ts`, `lib/dashboard-stats.ts`) e testes de rota (`app/api/dashboard/stats/route.test.ts`).

### Achados que afetam o módulo

- **Bug em `/api/appointments/[id]` (corrigido).** GET, PUT e DELETE buscavam o agendamento com `userId: session.user.id`. Para um PROFESSIONAL isso devolvia 404, porque o agendamento pertence ao MASTER. Com isso o profissional não conseguia abrir, editar, concluir nem excluir o próprio atendimento. Havia ainda um segundo efeito: o fuso horário do reagendamento era lido do `BusinessConfig` do profissional, que não existe, e caía no fuso padrão.
  - Agora as três rotas usam `getSessionScope`. O tenant é o master, e o PROFESSIONAL fica restrito aos atendimentos em que é o responsável, a mesma regra da listagem.
  - O fuso vem do negócio, e a permissão de encaixe continua sendo a do usuário logado.
- **Hoje todo valor em dinheiro é `Float`.** Nas tabelas novas o dinheiro fica em **centavos inteiros (`Int`)** e o percentual em **basis points** (`Int`, 4000 = 40%). Ponto flutuante não serve para caixa nem para comissão, porque o erro de arredondamento se acumula e o fechamento não bate. Os `Float` atuais não são migrados agora: entram no financeiro convertidos uma única vez com `toCents()`.
- **Um serviço por agendamento.** Não existe tabela de serviços do agendamento, e `BusinessConfig.multipleServices` não é usado. O módulo resolve os "serviços executados" na **comanda** (`SaleItem`), sem mexer no modelo de agendamento.

---

## Arquitetura

### Princípio: acoplado por ganchos, nunca espalhado

Todo o código do módulo fica em `lib/finance/` e `app/api/finance/`. O núcleo do sistema conhece apenas três ganchos, em `lib/finance/hooks.ts`:

- `onAppointmentCompleted(appointmentId)`
- `onAppointmentUncompleted(appointmentId)`
- `onPackageSold(clientPackageId)`

Regras dos ganchos:
- Cada um verifica primeiro `isFinanceEnabled(tenantId)` e **não faz nada** se o módulo estiver desligado.
- São **idempotentes**: `Sale.appointmentId @unique` impede comanda duplicada se o agendamento for concluído duas vezes.
- **Não bloqueiam** o agendamento: try/catch com registro em `ErrorLog`, como a fidelidade.
- Uma **tela de pendências** lista os concluídos sem comanda e reconcilia o que falhar.

### Habilitação: `lib/features.ts` (genérico, serve para módulos futuros)

- `TenantFeature { userId, feature: FeatureKey (FINANCE), source: ADDON | GRANT | PLAN, status: ACTIVE | CANCELED, stripeSubscriptionItemId?, expiresAt? }`, com `@@unique([userId, feature])`.
- `hasFeature(tenantId, 'FINANCE')` diz se o tenant tem direito de uso. `isFinanceEnabled(tenantId)` exige o direito de uso **e** `FinanceConfig.isActive`.
- O guard `requireFinance(scope)` protege todas as rotas `/api/finance/*`. Responde 404 sem direito de uso e 403 sem permissão. A checagem é **sempre no servidor**.
- O item "Financeiro" só aparece no menu com o módulo ligado. A flag vai junto com as permissões em `use-user-permissions`.
- Na v1 quem libera o módulo é o SaaS Admin. O add-on no Stripe entra na Fase 6, como subscription item na assinatura atual, sincronizado pelo webhook que já existe.

### Modelo de dados

A migration é SQL idempotente, aplicada **sem `prisma migrate dev`** (o histórico de migrations tem uma migration órfã e o `migrate dev` pode apagar dados).

| Modelo | Papel | Campos-chave |
|---|---|---|
| `FinanceConfig` | Configuração do tenant | `isActive`, `commissionBase` (AFTER_DISCOUNT \| AFTER_FEES), `requireOpenCashSession` (padrão true), `settleOnlyPaidCommissions` (padrão true) |
| `PaymentMethod` | Formas de pagamento | `name`, `type` (CASH, PIX, DEBIT, CREDIT, TRANSFER, OTHER), `feeBps`, `feeFixedCents`, `isActive`. Vem com padrões cadastrados |
| `FinanceCategory` | Plano de contas simples | `kind` INCOME \| EXPENSE, `name`, `isSystem`. Padrões: Serviços, Pacotes, Produtos, Aluguel, Insumos, Comissões, Impostos |
| `Sale` (comanda) | O que foi vendido | `origin` APPOINTMENT \| PACKAGE \| MANUAL, `appointmentId? @unique`, `clientPackageId? @unique`, `clientId?`, `subtotalCents`, `discountCents`, `totalCents`, `status` OPEN \| CLOSED \| CANCELLED |
| `SaleItem` | Serviço executado | `serviceId?`, `description`, `professionalId?`, `qty`, `unitPriceCents`, `discountCents`, `totalCents`, `clientPackageItemId?`, `commissionBaseCents` |
| `Receivable` | Contas a receber | `saleId?` (null = manual), `clientId?`, `categoryId`, `description`, `amountCents`, `paidCents`, `dueDate`, `status` OPEN \| PARTIAL \| PAID \| CANCELLED |
| `Payable` | Contas a pagar | `categoryId`, `supplier?`, `description`, `amountCents`, `paidCents`, `dueDate`, `status`, `seriesId?`, `installment` / `ofInstallments` |
| `FinancialTransaction` | **Livro-razão imutável**: a única fonte da verdade sobre dinheiro | `direction` IN \| OUT, `kind` (RECEIPT, PAYMENT, SUPPLY, WITHDRAWAL, COMMISSION_PAYOUT, REVERSAL), `amountCents`, `feeCents`, `paymentMethodId`, `cashSessionId?`, `receivableId?`, `payableId?`, `settlementId?`, `reversesId?`, `occurredAt`, `createdById` |
| `CashSession` | Caixa | `openedById` / `openedAt`, `openingCents`, `closedById` / `closedAt`, `expectedCashCents`, `countedCashCents`, `differenceCents`, `status` OPEN \| CLOSED, `notes`. **Índice único parcial `WHERE status = 'OPEN'`**: um caixa aberto por tenant |
| `CommissionRule` | Regra de comissão | `professionalId`, `serviceId?` (null = padrão do profissional), `type` PERCENT \| FIXED, `valueBps?`, `valueCents?`, `@@unique([professionalId, serviceId])` |
| `Commission` | Comissão gerada | `saleItemId @unique`, `professionalId`, `baseCents`, snapshot da regra (`ruleType`, `ruleValue`), `amountCents`, `status` PENDING \| SETTLED \| CANCELLED, `settlementId?` |
| `ProfessionalAdjustment` | Vales, adiantamentos, bônus e descontos | `professionalId`, `kind` ADVANCE \| BONUS \| DEDUCTION, `amountCents`, `description`, `settlementId?` |
| `CommissionSettlement` | Acerto | `professionalId`, `periodStart` / `periodEnd`, `cashSessionId?`, `commissionsCents`, `adjustmentsCents`, `netCents`, `status` DRAFT \| CONFIRMED \| PAID \| CANCELLED, `paidTransactionId?` |

Mudanças em modelos que já existem:
- `ClientPackageItem.sessionValueCents Int?`: valor proporcional da sessão, gravado na venda do pacote.
- `User.canOperateCash Boolean @default(false)`: deixa um profissional (ex.: recepção) operar o caixa. Segue o padrão de `canForceOverbook`.

Todos os modelos novos têm `userId` (tenant) e índices `[userId, status, dueDate]` ou `[userId, occurredAt]`, conforme o caso.

**Por que um livro-razão imutável?** Caixa, fluxo de caixa e DRE saem da mesma tabela, então os relatórios nunca divergem entre si. Erro se corrige com lançamento de estorno (`REVERSAL`), nunca com `UPDATE` ou `DELETE`. Isso dá auditoria completa de quem lançou o quê e quando.

---

## Regras de negócio

### Concluir um agendamento
- O gancho `onAppointmentCompleted` cria a `Sale` com um item padrão:
  - Preço: `appointment.price ?? scheduleService.customPrice ?? service.price`.
  - Profissional: `appointment.professionalId`.
- Com o módulo ligado, concluir pela UI abre a folha **"Fechar comanda"**. Nela é possível:
  - Adicionar outros serviços executados, cada um com o seu profissional.
  - Dar desconto por item ou na comanda.
  - **Receber agora**, com uma ou mais formas de pagamento (pagamento dividido).
  - **Deixar em aberto**, como saldo devedor ("fiado") em Contas a receber.
- Se a conclusão vier por outro caminho (ex.: a ação rápida na lista), o servidor cria a comanda padrão com o recebível em aberto. **Nenhum atendimento concluído fica fora do financeiro.**
- Cada `Sale` gera um `Receivable`, e cada item com profissional gera uma `Commission`.

### Comissão (função pura em `lib/finance/commission.ts`)
- Usa a regra mais específica e calcula sobre `commissionBaseCents`.
- **Grava um snapshot da regra.** Mudar a regra depois não altera comissões já geradas.
- No modo `AFTER_FEES`, a taxa da forma de pagamento é rateada entre os itens no momento do recebimento, e as comissões ainda PENDING são recalculadas.
- Comissão SETTLED fica congelada.

### Pacotes
- **Venda:** gera uma `Sale` com origin PACKAGE e o seu `Receivable`.
- **Valor da sessão:** `sessionValueCents` sai proporcional ao preço de tabela de cada serviço: `preçoPacote × (preçoServiço × sessões) / Σ(preço × sessões) ÷ sessões`. Sem preço de tabela, o valor é dividido igualmente.
  - Exemplo: pacote de R$ 300 com 4 cortes (R$ 50) e 2 barbas (R$ 25). O total de tabela é R$ 250. Cada corte vale R$ 60 e cada barba R$ 30.
- **Sessão concluída:** gera um `SaleItem` com `totalCents = 0` e `commissionBaseCents = sessionValueCents`, sem recebível.

### Recebimento
- Gera uma `FinancialTransaction` IN ligada ao caixa aberto e atualiza `Receivable.paidCents` e o `status`, tudo na mesma `$transaction`.
- Com `requireOpenCashSession` ligado, receber pelo dashboard exige caixa aberto. A UI oferece "Abrir caixa" na hora.

### Caixa
- Operações: abrir (com troco inicial), suprimento, sangria e fechar.
- No fechamento:
  - **Dinheiro esperado** = abertura + entradas em dinheiro − saídas em dinheiro.
  - Mostra os totais por forma de pagamento e por profissional.
  - O operador informa o valor contado, e a diferença fica registrada.
- Caixa fechado não aceita lançamento.

### Acerto com o profissional
- Pode ser feito **no fechamento do caixa** ("Acertar profissionais deste caixa") ou **por período** (semanal ou quinzenal), na tela de Comissões.
- **Líquido** = comissões PENDING + bônus − vales e descontos. Com `settleOnlyPaidCommissions` ligado, entram só as comissões de comandas já pagas.
- Ao confirmar:
  - As comissões viram SETTLED.
  - O pagamento gera uma `FinancialTransaction` OUT do tipo `COMMISSION_PAYOUT`. Se for em dinheiro, sai do caixa.
- **Proteção contra pagar duas vezes:** dentro da transação, `updateMany ... where settlementId IS NULL`, conferindo se a contagem bate.
- O acerto gera um comprovante, com o resumo por atendimento, que pode ser compartilhado com o profissional.

### Estorno e reabertura
- Tirar um agendamento de COMPLETED cancela a comanda quando ainda não há pagamento.
- Se já houver pagamento, é preciso um estorno explícito (`REVERSAL`). Nada é apagado.
- Comissão PENDING é cancelada. Comissão já SETTLED vira um `ProfessionalAdjustment` DEDUCTION no próximo acerto.

### Permissões (verificadas no servidor)

| Ação | MASTER | PROFESSIONAL | PROFESSIONAL com `canOperateCash` |
|---|---|---|---|
| Ver "Meus ganhos" (próprias comissões, vales e acertos) | ✓ | ✓ (só leitura) | ✓ |
| Fechar comanda / receber | ✓ | — | ✓ |
| Abrir, movimentar e fechar o caixa | ✓ | — | ✓ |
| Contas a pagar, regras de comissão, acertos, configurações | ✓ | — | — |

---

## Estrutura de código

- `lib/finance/money.ts`: `toCents`, `formatMoney(cents, currency, locale)` e rateio sem perda de centavo (maior resto).
- Funções puras, todas com testes: `lib/finance/commission.ts`, `package-session-value.ts`, `cash-session.ts` (cálculo do esperado) e `settlement.ts`.
- `lib/finance/service.ts`: operações transacionais (`createSaleFromAppointment`, `registerReceipt`, `openCash`, `closeCash`, `createSettlement`, …).
- `lib/finance/hooks.ts`, `lib/finance/guard.ts` e `lib/features.ts`.
- `app/api/finance/{config,payment-methods,categories,sales,receivables,payables,cash-sessions,commission-rules,commissions,adjustments,settlements,reports}/route.ts`. Toda rota segue auth → `requireFinance` → Zod → lógica.
- UI em `app/dashboard/financeiro/` (dark-first e mobile-first, como o resto do dashboard):
  - Visão geral: saldo do dia, a receber e a pagar nos próximos 7 dias, estado do caixa.
  - Caixa.
  - A receber.
  - A pagar.
  - Comissões e Acertos.
  - Configurações: ativação, formas de pagamento, categorias e regras de comissão.
  - O componente `close-sale-sheet.tsx` entra no fluxo de conclusão quando o módulo está ligado.

---

## Entrega em fases

Cada fase pode ser entregue sozinha.

1. **Fundação**
   - `TenantFeature` + `lib/features.ts`, `FinanceConfig`, guard e item de menu condicional.
   - `PaymentMethod` e `FinanceCategory` com valores padrão; `money.ts`.
   - Liberação pelo SaaS Admin.
   - Correção do `PUT /api/appointments/[id]` para PROFESSIONAL, com teste.
2. **Comanda + Contas a receber**
   - Ganchos de conclusão e reversão, `close-sale-sheet`, recebíveis manuais e recebimento com pagamento dividido.
   - Tela de pendências: concluídos sem comanda desde a ativação, com o botão "gerar comanda".
3. **Caixa:** abrir, suprimento, sangria, fechar com conferência e relatório do fechamento por forma de pagamento e por profissional.
4. **Comissões + Acertos:** regras em hierarquia, geração e recálculo, vales e bônus, acerto por caixa ou por período, comprovante e "Meus ganhos".
5. **Contas a pagar:** lançamento, parcelas e recorrência (série gerada de antemão), baixa total ou parcial, categorias.
6. **Pacotes, Relatórios e Add-on no Stripe**
   - Venda de pacote como receita e sessão como base de comissão.
   - Fluxo de caixa projetado (recebíveis × pagáveis por vencimento).
   - DRE simplificado, nos regimes de caixa e de competência.
   - Add-on no Stripe (`STRIPE_FINANCE_ADDON_PRICE_ID[_USD]`), sincronizado pelo webhook.

## Verificação

- **Testes unitários (Vitest):**
  - `commission`: hierarquia, percentual e fixo, desconto, taxa e arredondamento.
  - `money`: rateio sem perder centavo.
  - `package-session-value`: valor proporcional e divisão igual.
  - `cash-session`: valor esperado e diferença.
  - `settlement`: líquido com vales e a opção de só comandas pagas.
- **Testes de rota:**
  - 404 sem direito de uso; 403 para PROFESSIONAL em contas a pagar e acertos.
  - Idempotência quando o agendamento é concluído duas vezes.
  - Acertos concorrentes não pagam a mesma comissão duas vezes.
  - O PROFESSIONAL consegue concluir o próprio agendamento.
- **CI:** `npx tsc --noEmit` e `npm test`.
- **Teste ponta a ponta manual,** num tenant de teste com o módulo liberado:
  1. Abrir o caixa com R$ 100.
  2. Concluir dois atendimentos de profissionais diferentes: um com serviço extra e desconto, outro deixado em aberto.
  3. Receber o primeiro com PIX + dinheiro.
  4. Fazer uma sangria.
  5. Fechar o caixa e conferir o valor esperado.
  6. Acertar um profissional, com um vale descontado.
  7. Entrar como o profissional e conferir "Meus ganhos".
  8. Desligar o módulo e confirmar que a conclusão de agendamento volta ao comportamento atual.
