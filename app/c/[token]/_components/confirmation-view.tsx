'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, Loader2 } from 'lucide-react'
import type { ConfirmationView } from '@/lib/confirmation-service'
import { CancelSheet } from './cancel-sheet'

interface ConfirmationViewClientProps {
  token: string
  initialView: ConfirmationView
}

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: (delay: number) => ({ opacity: 1, y: 0, transition: { duration: 0.24, delay, ease: 'easeOut' } }),
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-[100dvh] bg-[#0A0A0B] text-zinc-100">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-6 py-10">
        {children}
        <p className="mt-10 text-center text-[11px] text-zinc-700">Calenvo</p>
      </div>
    </div>
  )
}

function StatusScreen({ title, description }: { title: string; description?: string }) {
  return (
    <Shell>
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="text-center">
        <h1 className="text-2xl font-medium tracking-tight text-zinc-50">{title}</h1>
        {description && <p className="mt-3 text-sm leading-relaxed text-zinc-500">{description}</p>}
      </motion.div>
    </Shell>
  )
}

export function ConfirmationViewClient({ token, initialView }: ConfirmationViewClientProps) {
  const [view, setView] = useState(initialView)
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (view.state === 'INVALID') {
    return <StatusScreen title="Link inválido" description="Este link não é válido. Verifique se copiou o endereço completo." />
  }
  if (view.state === 'UNAVAILABLE') {
    return <StatusScreen title="Agendamento não está mais ativo" description="Fale com o negócio se precisar de mais informações." />
  }
  if (view.state === 'PAST') {
    return <StatusScreen title="Este horário já passou" />
  }
  if (view.state === 'CANCELLED') {
    return <StatusScreen title="Agendamento cancelado" description={`Quando quiser remarcar, é só falar com ${view.businessName}.`} />
  }
  if (view.state === 'CANCEL_REQUESTED') {
    return <StatusScreen title={`Avisamos ${view.businessName}`} description="Eles vão te retornar sobre o cancelamento." />
  }

  const date = new Date(view.dateISO)
  const weekday = format(date, 'EEEE', { locale: ptBR })
  const dayMonth = format(date, "d 'de' MMMM", { locale: ptBR })
  const time = format(date, 'HH:mm', { locale: ptBR })
  const dateLabel = `${weekday}, ${time}`

  async function handleConfirm() {
    setError(null)
    setConfirming(true)
    try {
      const res = await fetch(`/api/c/${token}/confirm`, { method: 'POST' })
      const data = await res.json()
      if (data?.view) setView(data.view)
      if (!data?.ok) setError(data?.error || 'Não foi possível confirmar. Tente novamente.')
    } catch {
      setError('Não foi possível confirmar. Verifique sua conexão.')
    } finally {
      setConfirming(false)
    }
  }

  async function handleCancelSubmit(reason: string) {
    setError(null)
    setCancelling(true)
    try {
      const res = await fetch(`/api/c/${token}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      if (data?.view) setView(data.view)
      if (!data?.ok) setError(data?.error || 'Não foi possível cancelar. Tente novamente.')
    } catch {
      setError('Não foi possível cancelar. Verifique sua conexão.')
    } finally {
      setCancelling(false)
      setSheetOpen(false)
    }
  }

  return (
    <Shell>
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="mb-8 flex items-center gap-3">
        {view.businessLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/logo?key=${view.businessLogo}`} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-sm font-medium text-zinc-400">
            {view.businessName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-xs text-zinc-500">{view.businessName}</p>
          <h1 className="text-xl font-medium tracking-tight text-zinc-50">
            {view.state === 'CONFIRMED' ? 'Presença confirmada' : `Olá, ${view.clientFirstName}`}
          </h1>
        </div>
        {view.state === 'CONFIRMED' && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 14, stiffness: 260 }}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
          >
            <Check className="h-4 w-4" />
          </motion.div>
        )}
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0.06}
        className={`rounded-2xl border px-5 py-5 ${
          view.state === 'CONFIRMED' ? 'border-emerald-500/25 bg-emerald-500/[0.04]' : 'border-white/[0.08] bg-[#141416]'
        }`}
      >
        <p className="text-xs capitalize text-zinc-500">{dayMonth}</p>
        <p className="mt-1 text-4xl font-medium tabular-nums tracking-tight text-zinc-50">{time}</p>
        <div className="mt-4 space-y-1 border-t border-white/[0.06] pt-4 text-sm text-zinc-400">
          <p>{view.serviceName}</p>
          {view.professionalFirstName && <p>com {view.professionalFirstName}</p>}
        </div>
      </motion.div>

      {error && (
        <p className="mt-4 text-center text-sm text-red-400">{error}</p>
      )}

      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0.12} className="mt-8 space-y-4">
        {view.canConfirm && (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-violet-600 text-base font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
          >
            {confirming ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar presença'}
          </button>
        )}

        {(view.canCancel || view.cancelBlockedReason !== null) && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="w-full text-center text-sm text-zinc-500 underline-offset-4 hover:underline"
          >
            Não vou poder ir
          </button>
        )}
      </motion.div>

      <CancelSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleCancelSubmit}
        loading={cancelling}
        dateLabel={dateLabel}
        blocked={view.cancelBlockedReason !== null}
        businessName={view.businessName}
        cancellationHours={view.cancellationHours}
      />
    </Shell>
  )
}
