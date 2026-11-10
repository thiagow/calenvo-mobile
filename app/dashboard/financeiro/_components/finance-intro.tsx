'use client'

import { ArrowLeftRight, HandCoins, Landmark, Loader2, Lock, Receipt, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CAPABILITIES = [
  {
    icon: Receipt,
    title: 'Contas a receber',
    text: 'Cada atendimento concluído entra sozinho, pelo preço dos serviços executados. Vendas avulsas, à parte.'
  },
  {
    icon: Wallet,
    title: 'Caixa do dia',
    text: 'Abertura, sangria, suprimento e fechamento com conferência do que está na gaveta.'
  },
  {
    icon: HandCoins,
    title: 'Acerto com profissionais',
    text: 'Comissão fixa ou percentual, por profissional e por serviço, com vales descontados.'
  },
  {
    icon: Landmark,
    title: 'Contas a pagar',
    text: 'Aluguel, insumos e impostos com vencimento, parcelas e recorrência.'
  }
]

interface FinanceIntroProps {
  /** Tem direito de uso: mostra o botão de ativar. Sem ele, explica como liberar. */
  entitled: boolean
  activating?: boolean
  onActivate?: () => void
  /** Sem direito de uso, mas pode contratar o add-on pela assinatura. */
  onSubscribe?: () => void
  subscribing?: boolean
}

export function FinanceIntro({ entitled, activating = false, onActivate, onSubscribe, subscribing = false }: FinanceIntroProps) {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 pb-6 pt-7">
        {/* Brilho sutil: dá profundidade sem competir com o conteúdo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="relative space-y-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Módulo opcional</p>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">
              O dinheiro do seu negócio,
              <br />
              no mesmo lugar da agenda.
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              O atendimento termina e o valor já está no caixa, na conta do cliente e na comissão de quem atendeu.
              Sem planilha no fim do dia.
            </p>
          </div>

          {entitled ? (
            <div className="space-y-2 pt-1">
              <Button onClick={onActivate} disabled={activating} className="w-full sm:w-auto">
                {activating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ativar o Financeiro
              </Button>
              <p className="text-xs text-muted-foreground">
                Criamos as formas de pagamento e as categorias mais comuns. Tudo pode ser ajustado depois, e
                desativar não apaga nada.
              </p>
            </div>
          ) : onSubscribe ? (
            <div className="space-y-2 pt-1">
              <Button onClick={onSubscribe} disabled={subscribing} className="w-full sm:w-auto">
                {subscribing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Adicionar o Financeiro à assinatura
              </Button>
              <p className="text-xs text-muted-foreground">
                Entra como add-on na sua assinatura atual, com cobrança proporcional. Cancele quando quiser, sem perder dados.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3">
              <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                O Financeiro ainda não está liberado para a sua conta. Fale com o suporte do Calenvo para ativar.
              </p>
            </div>
          )}
        </div>
      </section>

      <ul className="grid gap-2 sm:grid-cols-2">
        {CAPABILITIES.map(({ icon: Icon, title, text }, index) => (
          <li
            key={title}
            className={cn(
              'flex gap-3 rounded-xl border border-border bg-card p-4',
              'animate-in fade-in slide-in-from-bottom-1 fill-mode-both'
            )}
            style={{ animationDelay: `${index * 60}ms`, animationDuration: '400ms' }}
          >
            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
