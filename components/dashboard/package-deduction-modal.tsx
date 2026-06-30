'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Package } from 'lucide-react'
import { toast } from 'sonner'

interface PackageDeductionModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    clientId: string
    appointmentId: string
    onConfirm: (clientPackageItemId: string | null) => Promise<void>
}

export function PackageDeductionModal({ isOpen, onOpenChange, onConfirm }: PackageDeductionModalProps) {
    const [submitting, setSubmitting] = useState(false)

    const handleConfirm = async () => {
        setSubmitting(true)
        try {
            await onConfirm(null)
            onOpenChange(false)
        } catch (error) {
            toast.error('Erro ao processar confirmação')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-blue-600" />
                        Confirmar Presença
                    </DialogTitle>
                    <DialogDescription>
                        Este cliente compareceu à consulta. Ao confirmar presença, o sistema considerará o status concluído.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <p className="text-sm text-gray-700 bg-blue-50 p-4 rounded-md border border-blue-100">
                        <strong className="block mb-1 text-blue-800">Detecção Automática de Pacotes</strong>
                        Se o cliente possuir um pacote ativo que englobe este serviço, a sessão será abatida automaticamente de forma transparente.
                    </p>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} disabled={submitting} className="bg-green-600 hover:bg-green-700">
                        {submitting ? 'Salvando...' : 'Confirmar Presença'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
