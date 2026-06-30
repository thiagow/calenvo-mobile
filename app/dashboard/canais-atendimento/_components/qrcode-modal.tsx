'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Smartphone, Clock } from 'lucide-react';
import Image from 'next/image';

/**
 * Properties for the WhatsApp QR Code Modal
 */
interface QRCodeModalProps {
  /** The base64-encoded QR code string or full Data URL */
  qrCode: string;
  /** Whether the modal is currently open */
  open: boolean;
  /** Callback executed when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current countdown value in seconds for the next status check */
  countdown?: number;
  /** Whether a connection status check is currently being performed */
  isChecking?: boolean;
}

/**
 * Optimized QR Code Modal v3.1
 * Features a 2-column responsive layout to ensure visibility on all screens.
 * Left column displays the QR code and visual polling feedback.
 * Right column provides step-by-step instructions for the user.
 */
export function QRCodeModal({ 
  qrCode, 
  open, 
  onOpenChange,
  countdown,
  isChecking = false,
}: QRCodeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Conectar WhatsApp
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR Code abaixo com seu WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - QR Code & Status */}
          <div className="flex flex-col items-center space-y-4">
            {/* QR Code Display */}
            <div className="flex justify-center p-4 bg-white rounded-lg border shadow-sm">
              {qrCode.startsWith('data:image') ? (
                <Image
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  width={200}
                  height={200}
                  className="rounded"
                />
              ) : (
                <Image
                  src={`data:image/png;base64,${qrCode}`}
                  alt="QR Code WhatsApp"
                  width={200}
                  height={200}
                  className="rounded"
                />
              )}
            </div>

            {/* Status Check Countdown */}
            {countdown !== undefined && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border w-full">
                <Clock className={`h-4 w-4 ${isChecking ? 'animate-pulse text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">
                  {isChecking ? (
                    'Verificando conexão...'
                  ) : (
                    `Próxima verificação em ${countdown}s`
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Right Column - Instructions & Info */}
          <div className="space-y-4">
            {/* Instructions */}
            <Alert>
              <AlertDescription>
                <strong>Passo a passo:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-2 text-sm">
                  <li>Abra o <strong>WhatsApp</strong> no seu celular</li>
                  <li>
                    Toque em <strong>Mais opções</strong> ou <strong>Configurações</strong>
                  </li>
                  <li>
                    Selecione <strong>Aparelhos conectados</strong>
                  </li>
                  <li>
                    Toque em <strong>Conectar um aparelho</strong>
                  </li>
                  <li>Aponte o celular para esta tela para escanear o código QR</li>
                </ol>
              </AlertDescription>
            </Alert>

            {/* Expiration Notice */}
            <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
              <p>Este código expira em alguns minutos. Se expirar, feche esta janela e gere um novo código.</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
