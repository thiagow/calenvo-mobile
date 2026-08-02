'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

const REASON_CHIPS = ['Imprevisto', 'Problema de saúde', 'Vou remarcar', 'Não preciso mais', 'Outro']

interface CancelSheetProps {
  open: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
  loading: boolean
  dateLabel: string
  blocked: boolean
  businessName: string
  cancellationHours: number
}

export function CancelSheet({ open, onClose, onSubmit, loading, dateLabel, blocked, businessName, cancellationHours }: CancelSheetProps) {
  const [step, setStep] = useState<'reason' | 'confirm'>('reason')
  const [selectedChip, setSelectedChip] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')

  const reason = (freeText.trim() || selectedChip || '').slice(0, 280)
  const canAdvance = Boolean(selectedChip)

  function handleClose() {
    setStep('reason')
    setSelectedChip(null)
    setFreeText('')
    onClose()
  }

  function handleSubmit() {
    onSubmit(reason)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={handleClose}
          />
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/[0.08] bg-[#141416] px-5 pb-8 pt-3"
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" />

            {step === 'reason' ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-medium tracking-tight text-zinc-50">Não vai poder ir?</h2>
                  <p className="mt-1 text-sm text-zinc-500">Conta pra gente o motivo — leva 1 toque.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {REASON_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setSelectedChip(chip)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        selectedChip === chip
                          ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                          : 'border-white/10 text-zinc-300 hover:border-white/20'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {selectedChip === 'Outro' && (
                  <textarea
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value.slice(0, 280))}
                    placeholder="Se quiser, conte mais..."
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
                  />
                )}

                <button
                  type="button"
                  disabled={!canAdvance}
                  onClick={() => setStep('confirm')}
                  className="h-14 w-full rounded-2xl bg-white/10 text-base font-medium text-zinc-100 transition-colors disabled:opacity-40"
                >
                  Continuar
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {blocked ? (
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-zinc-50">Avisar {businessName}?</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                      {businessName} só aceita cancelamentos até {cancellationHours}h antes. Vamos avisar que você não
                      poderá vir — se precisar remarcar, fale direto com eles.
                    </p>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-zinc-50">Cancelar seu horário?</h2>
                    <p className="mt-2 text-sm text-zinc-400">{dateLabel}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('reason')}
                    disabled={loading}
                    className="h-14 flex-1 rounded-2xl border border-white/10 text-base font-medium text-zinc-300 disabled:opacity-40"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-red-500/90 text-base font-medium text-white disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : blocked ? 'Avisar o salão' : 'Sim, cancelar'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
