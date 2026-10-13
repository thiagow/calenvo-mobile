# Manual: alteração de planos e valores

Como mudar o preço, os limites ou o texto de um plano do Calenvo sem quebrar cobrança, checkout ou o plano dos clientes.

> Referência técnica complementar: [`docs/features/planos.md`](../features/planos.md) (tabela de Price IDs atuais).

---

## 1. A ideia central: o valor existe em dois lugares

| | O que controla | Onde fica |
|---|---|---|
| **Vitrine** | O valor que o cliente **vê** (landing, tela de planos, perfil, cadastro, painel admin) | Código: `lib/types.ts` → `PLAN_CONFIGS` |
| **Cobrança** | O valor que a Stripe **cobra de verdade** | Stripe: objeto *Price*, apontado por variáveis `STRIPE_*_PRICE_ID` na Netlify |

O checkout só envia à Stripe o **ID** do Price. O valor sai do cadastro da Stripe, não do código.

**Consequência:** mudou preço → mexe nos dois lugares, no mesmo deploy. Mudar só um deixa a tela mostrando um valor e a Stripe cobrando outro.

**Regra de ouro da Stripe:** o valor de um Price **não pode ser editado**. Para mudar o valor, cria-se um **novo Price** e troca-se o ID na Netlify.

---

## 2. O que muda em cada tipo de alteração

| Quero mudar... | Código (`lib/types.ts`) | Stripe | Netlify |
|---|:-:|:-:|:-:|
| **Preço** de um plano | ✅ | ✅ novo Price | ✅ novo ID |
| **Nome** exibido do plano | ✅ (`name`) | opcional (nome do produto aparece na fatura) | — |
| **Limite** de agendamentos/profissionais | ✅ (`monthlyLimit`, `userLimit`) | — | — |
| **Limite** de agendas/serviços | ✅ `lib/plan-limits.ts` → `PLAN_LIMITS` | — | — |
| **Texto** da lista de benefícios | ✅ (`features`) | — | — |

Só o **preço** envolve a Stripe. Limites e textos são só código.

---

## 3. Como o valor anual é calculado

No código, `priceAnnual` é o **valor mensal equivalente** quando o cliente paga anual (hoje: 20% de desconto). Na Stripe, o Price anual é o **total do ano**.

> `Price anual na Stripe ≈ priceAnnual × 12`

Exemplos atuais: PRO mensal R$ 39,90 → anual R$ 383,10 na Stripe → `priceAnnual: 31.93` no código (383,10 ÷ 12 = 31,925, arredondado).

Mantenha essa relação, senão a tela mostra um "equivalente mensal" que não bate com o que o cliente paga.

---

## 4. Passo a passo: alterar o preço de um plano

Exemplo: **PRO mensal em reais, de R$ 39,90 para R$ 44,90**. Repita para cada combinação que for mudar (mensal/anual × BRL/USD).

### Antes de começar
- Decida se vale **só para novos clientes** ou também para os atuais (seção 5).
- Confirme em qual modo da Stripe está trabalhando. **Test mode e Live mode têm Price IDs diferentes.** A produção usa os IDs do **Live mode**.

### Passo 1: criar o novo Price na Stripe (não afeta nada ainda)
1. Painel da Stripe → **Catálogo de produtos** → abra o produto do plano (ex.: "Plano Pró").
2. **Adicionar outro preço** → tipo *Recorrente* → valor `44,90` → moeda **BRL** → intervalo **Mensal**.
3. Salve e **copie o novo Price ID** (começa com `price_`).
4. Se for mudar também o anual ou o USD, crie um Price para cada um e anote os IDs.

### Passo 2: preparar a Netlify (ainda sem efeito)
1. Netlify → Site configuration → **Environment variables**.
2. Troque o valor da variável correspondente pelo novo ID. Mapa completo na seção 7.
3. **Não faça deploy ainda.** Variáveis só valem em um deploy novo.

### Passo 3: atualizar o código e publicar
1. Em `lib/types.ts`, altere o campo (ex.: `priceMonthly: 44.90` no `PRO`).
2. Atualize a tabela em `docs/features/planos.md` (valores e Price IDs).
3. Faça commit e push. O deploy da Netlify já pega as variáveis novas e o código novo juntos.

### Passo 4: verificar (sem cobrar ninguém)
1. Abra `https://calenvo.app/signup/pro` (e a versão anual, e a em inglês/USD se alterou).
2. Siga até a tela do **Stripe Checkout** e confira o valor mostrado. Não preencha o cartão.
3. Confira a landing (`/`) e **Planos** no dashboard: devem mostrar o valor novo.

### Passo 5: arquivar o Price antigo (só depois de validar)
Na Stripe, abra o Price antigo → **Arquivar**. Isso impede que seja usado em novas vendas. **Assinaturas existentes nele continuam funcionando.**

> Não arquive antes do Passo 4. Se algo der errado, um Price arquivado não aceita novas compras até ser reativado.

---

## 5. Clientes atuais: o que acontece com quem já assina

Quem já assina fica preso ao **Price antigo**. Trocar o ID na Netlify **não muda o valor cobrado deles**. A cobrança continua no valor antigo até você migrar a assinatura na Stripe.

### Opção A: manter os atuais no preço antigo (recomendado para aumento)
O aumento vale só para novos clientes. É a escolha de menor risco.

**Atenção, limitação conhecida:** o sistema reconhece o plano de uma assinatura pelo Price ID configurado na Netlify (`getPlanFromPriceId`). Quem estiver em um Price que não está mais configurado:
- continua com o plano que já tinha, e o status de pagamento continua sincronizando;
- **mas** uma troca de plano feita pelo Portal da Stripe (upgrade/downgrade) **não é reconhecida**, e o plano no Calenvo não muda.

O código hoje guarda **um** Price ID por plano/intervalo/moeda. Para sustentar clientes antigos em paralelo, é necessária uma pequena mudança no código (aceitar uma lista de Price IDs legados). **Se for adotar a Opção A, peça essa mudança antes de arquivar o Price antigo.**

### Opção B: migrar todos para o preço novo
1. Avise os clientes com antecedência e por escrito (e-mail ou WhatsApp). Confira com seu contador/jurídico o prazo adequado ao seu contrato.
2. Na Stripe, troque o Price das assinaturas para o novo (assinatura a assinatura, ou em lote por script). Defina como tratar o proporcional (*proration*): normalmente "sem cobrança proporcional, vale a partir da próxima renovação".
3. O webhook reconhece o novo Price e mantém o plano correto.

---

## 6. Pontos de atenção

- **Painel admin (MRR):** a "receita mensal estimada" em `app/api/saas-admin/stats/route.ts` multiplica o **preço do código** pelo número de clientes de cada plano. Com clientes antigos no preço antigo, o MRR mostrado fica **maior que o real**.
- **Portal de cobrança da Stripe:** se a troca de plano pelo cliente estiver ativada, atualize em Stripe → Configurações → Cobrança → **Portal do cliente** → *Assinaturas* a lista de preços permitidos (inclua os novos).
- **Moedas:** cada moeda tem Price próprio. Mudar R$ não muda US$.
- **Anual:** ao mudar o mensal, decida se o anual acompanha (mantendo os 20% de desconto) e calcule `mensal × 12 × 0,8`.
- **Nome do produto na Stripe:** o plano `BUSINESS` aparece como "Plano Avançado" na Stripe. Não renomeie um lado sem o outro.
- **Comunicação:** se o valor aparece em anúncios, e-mails ou páginas fora do Calenvo, atualize também.

---

## 7. Mapa: variável da Netlify ↔ plano

| Variável | Plano | Intervalo | Moeda |
|---|---|---|---|
| `STRIPE_BASICO_MONTHLY_PRICE_ID` | Básico | Mensal | BRL |
| `STRIPE_BASICO_ANNUAL_PRICE_ID` | Básico | Anual | BRL |
| `STRIPE_BASICO_MONTHLY_PRICE_ID_USD` | Básico | Mensal | USD |
| `STRIPE_BASICO_ANNUAL_PRICE_ID_USD` | Básico | Anual | USD |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | PRO | Mensal | BRL |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | PRO | Anual | BRL |
| `STRIPE_PRO_MONTHLY_PRICE_ID_USD` | PRO | Mensal | USD |
| `STRIPE_PRO_ANNUAL_PRICE_ID_USD` | PRO | Anual | USD |
| `STRIPE_BUSINESS_MONTHLY_PRICE_ID` | Avançado | Mensal | BRL |
| `STRIPE_BUSINESS_ANNUAL_PRICE_ID` | Avançado | Anual | BRL |
| `STRIPE_BUSINESS_MONTHLY_PRICE_ID_USD` | Avançado | Mensal | USD |
| `STRIPE_BUSINESS_ANNUAL_PRICE_ID_USD` | Avançado | Anual | USD |

Campos de preço em `lib/types.ts` (`PLAN_CONFIGS`):

| Campo | Significado |
|---|---|
| `priceMonthly` | R$ por mês (cobrança mensal) |
| `priceAnnual` | R$ por mês equivalente (cobrança anual) |
| `priceMonthlyUSD` | US$ por mês (cobrança mensal) |
| `priceAnnualUSD` | US$ por mês equivalente (cobrança anual) |

---

## 8. Onde o valor do código aparece

Alterar `lib/types.ts` atualiza automaticamente:

- Landing page (`app/[locale]/page.tsx`)
- Cadastro e sucesso (`app/[locale]/signup/...`)
- Tela **Planos** no dashboard (`app/dashboard/plans/page.tsx`)
- **Perfil** (`app/dashboard/profile/page.tsx`)
- Painel **SaaS Admin**: cálculo de receita estimada

Não há valores digitados à mão nessas telas. O único lugar fora do código com valores copiados é a documentação em `docs/`.

---

## 9. Reverter uma alteração

1. Na Netlify, volte a variável para o **Price ID antigo**.
2. Reverta o commit em `lib/types.ts`.
3. Faça deploy.
4. Se já tinha arquivado o Price antigo, **reative-o** na Stripe antes (Catálogo → o preço → *Desarquivar*), senão novas compras falham.

---

## 10. Checklist

**Alteração de preço**
- [ ] Decidido: só novos clientes ou todos? (seção 5)
- [ ] Novo Price criado na Stripe **no modo Live**, com a moeda e o intervalo certos
- [ ] Anual conferido: `mensal × 12 × 0,8`
- [ ] ID novo colocado na variável certa da Netlify
- [ ] `lib/types.ts` atualizado e `docs/features/planos.md` atualizado
- [ ] Deploy concluído
- [ ] Tela do Stripe Checkout mostra o valor novo (mensal, anual, USD se alterou)
- [ ] Landing e tela Planos mostram o valor novo
- [ ] Portal do cliente da Stripe atualizado (se a troca de plano estiver ativa)
- [ ] Price antigo arquivado **depois** de validar
- [ ] Clientes avisados (se aumento para atuais)

**Alteração de limite ou texto**
- [ ] `lib/types.ts` (`monthlyLimit`, `userLimit`, `features`) e/ou `lib/plan-limits.ts`
- [ ] Teste: criar agendamento/profissional além do novo limite e conferir o bloqueio
- [ ] Deploy
