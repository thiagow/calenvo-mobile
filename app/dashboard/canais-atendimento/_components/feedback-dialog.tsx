'use client';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle2, XCircle } from 'lucide-react';

interface FeedbackDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    success: boolean;
    title?: string;
    description?: string;
}

export function FeedbackDialog({
    open,
    onOpenChange,
    success,
    title,
    description,
}: FeedbackDialogProps) {
    const defaultTitle = success ? 'Mensagem enviada com sucesso!' : 'Erro ao enviar mensagem';
    const defaultDescription = success
        ? 'A mensagem de teste foi enviada para o número informado.'
        : 'Não foi possível enviar essa mensagem. Verifique se o número do destinatário está correto ou solicite o suporte.';

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <div className="flex items-center gap-3">
                        {success ? (
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                        ) : (
                            <XCircle className="h-6 w-6 text-destructive" />
                        )}
                        <AlertDialogTitle>{title || defaultTitle}</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription>
                        {description || defaultDescription}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => onOpenChange(false)}>
                        OK
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
