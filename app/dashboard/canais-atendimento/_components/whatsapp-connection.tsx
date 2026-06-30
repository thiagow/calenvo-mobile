'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WhatsAppConfig } from '@prisma/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Smartphone, Trash2, RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDialog } from '@/components/providers/dialog-provider';
import {
  createInstanceAction,
  checkConnectionStatusAction,
  deleteInstanceAction,
  refreshQRCodeAction
} from '@/app/actions/whatsapp';
import { QRCodeModal } from './qrcode-modal';
import { useStatusPolling } from './use-status-polling';

/**
 * Properties for the WhatsApp Connection component
 */
interface WhatsAppConnectionProps {
  /** Existing WhatsApp configuration from the database */
  config: WhatsAppConfig | null;
}

/**
 * Main WhatsApp Connection Management Component v3.1
 * 
 * Handles the entire lifecycle of a WhatsApp instance connection:
 * 1. Initial configuration and phone number entry
 * 2. QR Code generation and display in a responsive modal
 * 3. Automatic background polling (30s interval) with countdown
 * 4. Manual status synchronization
 * 5. Instance deletion (disconnection)
 * 
 * Includes sessionStorage persistence to maintain modal state across reloads.
 */
export function WhatsAppConnection({ config: initialConfig }: WhatsAppConnectionProps) {
  const [config, setConfig] = useState(initialConfig);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [refreshingQR, setRefreshingQR] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [connectionToastShown, setConnectionToastShown] = useState(false);
  const { toast } = useToast();
  const { confirm } = useDialog();

  const isConnected = config?.isConnected ?? false;
  const hasConfig = !!config;

  // Check if QR code is expired
  const isQRExpired = config?.qrCodeExpiresAt
    ? new Date(config.qrCodeExpiresAt) < new Date()
    : false;

  // Determine visual state
  type VisualState = 'none' | 'pending' | 'expired' | 'connected' | 'error';
  const getVisualState = (): VisualState => {
    if (!config) return 'none';
    if (config.isConnected) return 'connected';
    if (isQRExpired) return 'expired';
    if (config.qrCode && config.qrCode.length > 0) return 'pending';
    return 'error';
  };

  const visualState = getVisualState();

  // Modal persistence using sessionStorage
  useEffect(() => {
    // Restore modal state on mount
    const savedModalState = sessionStorage.getItem('whatsapp_qr_modal');
    const savedQrCode = sessionStorage.getItem('whatsapp_qr_code');

    if (savedModalState === 'open' && savedQrCode && !isConnected) {
      setQrCode(savedQrCode);
      setShowQRModal(true);
      console.log('[WhatsAppConnection] Restored QR modal from sessionStorage');
    }
  }, [isConnected]);

  // Persist modal state when it changes
  useEffect(() => {
    if (showQRModal && qrCode) {
      sessionStorage.setItem('whatsapp_qr_modal', 'open');
      sessionStorage.setItem('whatsapp_qr_code', qrCode);
      console.log('[WhatsAppConnection] Saved QR modal to sessionStorage');
    } else {
      sessionStorage.removeItem('whatsapp_qr_modal');
      sessionStorage.removeItem('whatsapp_qr_code');
      console.log('[WhatsAppConnection] Cleared QR modal from sessionStorage');
    }
  }, [showQRModal, qrCode]);

  // Status check callback for polling
  const handlePollingCheck = useCallback(async () => {
    console.log('[WhatsAppConnection] Polling check triggered');
    try {
      const result = await checkConnectionStatusAction();

      if (result.success && result.data) {
        const nowConnected = result.data.isConnected;

        // Only show toast and reload if status changed to connected
        if (nowConnected && !isConnected && !connectionToastShown) {
          console.log('[WhatsAppConnection] Connection established!');

          setConnectionToastShown(true);

          toast({
            title: 'Conectado ✓',
            description: 'WhatsApp conectado com sucesso!',
          });

          // Close modal and reload after toast is visible
          setShowQRModal(false);
          sessionStorage.removeItem('whatsapp_qr_modal');
          sessionStorage.removeItem('whatsapp_qr_code');

          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      }
    } catch (error) {
      console.error('[WhatsAppConnection] Polling check error:', error);
      // Silent failure during polling - don't disrupt user
    }
  }, [isConnected, connectionToastShown, toast]);

  // Status polling hook - only active when modal is open
  const { countdown, isChecking, triggerCheck } = useStatusPolling({
    enabled: showQRModal && !isConnected,
    intervalMs: 30000, // 30 seconds
    onCheck: handlePollingCheck,
  });

  const handleConnect = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        title: 'Erro',
        description: 'Informe um número de telefone válido',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await createInstanceAction(phoneNumber);

      if (result.success && result.data) {
        setQrCode(result.data.qrCode);
        setShowQRModal(true);
        setConnectionToastShown(false); // Reset toast flag

        toast({
          title: 'QR Code gerado',
          description: 'Escaneie o QR Code com seu WhatsApp',
        });

        // No automatic reload - polling will handle it
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Falha ao gerar QR Code',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao conectar WhatsApp',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    // Manual check - only works when modal is closed
    if (showQRModal) {
      console.log('[WhatsAppConnection] Manual check blocked - modal is open');
      return;
    }

    setCheckingStatus(true);
    try {
      const result = await checkConnectionStatusAction();

      if (result.success && result.data) {
        const wasConnected = isConnected;
        const nowConnected = result.data.isConnected;

        // Only show toast and reload if state changed
        if (wasConnected !== nowConnected) {
          toast({
            title: nowConnected ? 'Conectado' : 'Desconectado',
            description: nowConnected
              ? 'WhatsApp está conectado'
              : 'WhatsApp não está conectado',
            variant: nowConnected ? 'default' : 'destructive',
          });

          // Reload to update UI
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          // Silent success - no state change
          console.log('[WhatsAppConnection] Status unchanged:', nowConnected ? 'connected' : 'disconnected');
        }
      } else {
        // Show error toast
        toast({
          title: 'Erro',
          description: result.error || 'Falha ao verificar status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Status check error:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao verificar status',
        variant: 'destructive',
      });
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = await confirm({
      title: 'Desconectar WhatsApp',
      description: 'Deseja realmente desconectar o WhatsApp? As notificações automáticas serão desativadas.',
      variant: 'destructive',
      confirmText: 'Desconectar'
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      const result = await deleteInstanceAction();

      if (result.success) {
        toast({
          title: 'Desconectado',
          description: 'WhatsApp desconectado com sucesso',
        });
        window.location.reload();
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Falha ao desconectar',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao desconectar WhatsApp',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshQR = async () => {
    setRefreshingQR(true);
    try {
      const result = await refreshQRCodeAction();

      if (result.success && result.data) {
        setQrCode(result.data.qrCode);
        setShowQRModal(true);
        setConnectionToastShown(false); // Reset toast flag

        toast({
          title: 'QR Code atualizado',
          description: 'Escaneie o novo QR Code com seu WhatsApp',
        });

        // No automatic reload - polling will handle it
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Falha ao atualizar QR Code',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Refresh QR error:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar QR Code',
        variant: 'destructive',
      });
    } finally {
      setRefreshingQR(false);
    }
  };

  // Check status on initial load (silent - no reload to avoid loops)
  useEffect(() => {
    const checkInitialStatus = async () => {
      if (hasConfig) {
        try {
          await checkConnectionStatusAction();
          // DB is updated by the action if status changed.
          // No reload here - user can use "Verificar Status" button manually.
        } catch (error) {
          console.error('Initial status check failed:', error);
        }
      }
    };

    checkInitialStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Conexão WhatsApp
          </CardTitle>
          <CardDescription>
            Conecte seu número do WhatsApp Business para enviar notificações automáticas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-3">
              {visualState === 'connected' && (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              {visualState === 'pending' && (
                <Clock className="h-5 w-5 text-yellow-600" />
              )}
              {visualState === 'expired' && (
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              )}
              {visualState === 'error' && (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {visualState === 'none' && (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">
                  {visualState === 'connected' && 'Conectado'}
                  {visualState === 'pending' && 'Aguardando Conexão'}
                  {visualState === 'expired' && 'QR Code Expirado'}
                  {visualState === 'error' && 'Erro de Configuração'}
                  {visualState === 'none' && 'Não Conectado'}
                </p>
                {config?.phoneNumber && (
                  <p className="text-sm text-muted-foreground">
                    {config.phoneNumber}
                  </p>
                )}
                {visualState === 'pending' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Escaneie o QR Code que foi gerado
                  </p>
                )}
                {visualState === 'expired' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    O código expirou, clique em atualizar
                  </p>
                )}
                {visualState === 'error' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Estado inconsistente, desconecte e tente novamente
                  </p>
                )}
              </div>
            </div>
            <Badge variant={
              visualState === 'connected' ? 'default' :
                visualState === 'pending' ? 'secondary' :
                  visualState === 'expired' ? 'outline' :
                    'destructive'
            }>
              {visualState === 'connected' && 'Ativo'}
              {visualState === 'pending' && 'Pendente'}
              {visualState === 'expired' && 'Expirado'}
              {visualState === 'error' && 'Erro'}
              {visualState === 'none' && 'Inativo'}
            </Badge>
          </div>

          {/* Not Connected - Show Connection Form */}
          {!isConnected && (
            <div className="space-y-4">
              {/* Show specific alerts based on visual state */}
              {visualState === 'expired' && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>QR Code expirado!</strong> O código QR gerado anteriormente expirou.
                    Clique em "Atualizar QR Code" para gerar um novo.
                  </AlertDescription>
                </Alert>
              )}

              {visualState === 'pending' && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Aguardando conexão...</strong> Um QR Code foi gerado anteriormente.
                    Escaneie-o para conectar ou clique em "Atualizar QR Code" para gerar um novo.
                  </AlertDescription>
                </Alert>
              )}

              {visualState === 'error' && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Erro de configuração!</strong> A instância está em um estado inconsistente.
                    Por favor, desconecte e tente criar uma nova conexão.
                  </AlertDescription>
                </Alert>
              )}

              {visualState === 'none' && (
                <Alert>
                  <AlertDescription>
                    <strong>Como conectar:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                      <li>Digite o número do WhatsApp Business (com DDD)</li>
                      <li>Clique em "Gerar QR Code"</li>
                      <li>Abra o WhatsApp no celular</li>
                      <li>Vá em Configurações → Aparelhos conectados</li>
                      <li>Escaneie o QR Code que aparecerá na tela</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              )}

              {/* Show appropriate button based on state */}
              {(visualState === 'pending' || visualState === 'expired' || visualState === 'error') ? (
                <div className="flex gap-2">
                  <Button
                    onClick={handleRefreshQR}
                    disabled={refreshingQR || loading}
                    className="flex-1"
                    variant="default"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshingQR ? 'animate-spin' : ''}`} />
                    {refreshingQR ? 'Atualizando...' : 'Atualizar QR Code'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDisconnect}
                    disabled={loading || refreshingQR}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Número do WhatsApp (com DDD)</Label>
                    <Input
                      id="phoneNumber"
                      placeholder="Ex: 11999999999"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      maxLength={11}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Informe apenas números, sem espaços ou caracteres especiais
                    </p>
                  </div>

                  <Button
                    onClick={handleConnect}
                    disabled={loading || !phoneNumber}
                    className="w-full"
                  >
                    {loading ? 'Gerando QR Code...' : 'Gerar QR Code'}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Connected - Show Actions */}
          {isConnected && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCheckStatus}
                disabled={checkingStatus || showQRModal}
                className="flex-1"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${checkingStatus ? 'animate-spin' : ''}`} />
                {checkingStatus ? 'Verificando...' : 'Verificar Status'}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={loading || checkingStatus}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Desconectar
              </Button>
            </div>
          )}

          {/* Manual Status Check - Always visible when not connected */}
          {!isConnected && hasConfig && (
            <Button
              variant="outline"
              onClick={handleCheckStatus}
              disabled={checkingStatus || showQRModal}
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${checkingStatus ? 'animate-spin' : ''}`} />
              {checkingStatus ? 'Verificando...' : 'Verificar Status Manualmente'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      {qrCode && (
        <QRCodeModal
          qrCode={qrCode}
          open={showQRModal}
          onOpenChange={setShowQRModal}
          countdown={countdown}
          isChecking={isChecking}
        />
      )}
    </>
  );
}
