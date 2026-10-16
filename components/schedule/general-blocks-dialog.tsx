'use client'

import { Layers } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GeneralBlocksList } from './general-blocks-list'

interface GeneralBlocksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GeneralBlocksDialog({ open, onOpenChange }: GeneralBlocksDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Bloqueios gerais
          </DialogTitle>
          <DialogDescription>
            Bloqueios criados para mais de uma agenda de uma vez e bloqueios pessoais de profissionais. Remover aqui
            libera o período em todas as agendas do bloqueio. Bloqueios de uma agenda só ficam na aba Bloqueios da
            própria agenda.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {/* Monta só aberto: recarrega a cada abertura */}
          {open && <GeneralBlocksList emptyText="Nenhum bloqueio geral ativo" />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default GeneralBlocksDialog
