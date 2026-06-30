'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Smartphone, Send, Loader2 } from 'lucide-react';

interface TestMessageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSend: (phoneNumber: string) => Promise<void>;
    loading?: boolean;
    defaultPhone?: string;
    typeLabel: string;
}

export function TestMessageDialog({
    open,
    onOpenChange,
    onSend,
    loading = false,
    defaultPhone = '',
    typeLabel
}: TestMessageDialogProps) {
    const [phone, setPhone] = useState(defaultPhone);

    // Reset phone when dialog opens
    useEffect(() => {
        if (open && defaultPhone) {
            setPhone(defaultPhone);
        }
    }, [open, defaultPhone]);

    const handleSend = async () => {
        if (!phone || phone.length < 10) return;
        await onSend(phone);
        // Dialog closing is handled by the parent or usually kept open/closed based on success
        // ensuring we don't close it prematurely if loading
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Apenas números
        const value = e.target.value.replace(/\D/g, '');
        setPhone(value);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Smartphone className="h-5 w-5 text-primary" />
                        Enviar Teste: {typeLabel}
                    </DialogTitle>
                    <DialogDescription>
                        Informe o número do WhatsApp para receber a mensagem de teste.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="test-phone">Número do WhatsApp (com DDD)</Label>
                        <Input
                            id="test-phone"
                            placeholder="Ex: 11999999999"
                            value={phone}
                            onChange={handlePhoneChange}
                            maxLength={11}
                            disabled={loading}
                            autoFocus
                        />
                        <p className="text-xs text-muted-foreground">
                            Informe apenas números (DDD + Telefone)
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={loading || phone.length < 10}
                        className="gap-2"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                        {loading ? 'Enviando...' : 'Enviar Teste'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
