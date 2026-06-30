'use client';

import { useState } from 'react';
import { WhatsAppConfig } from '@prisma/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bot, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { toggleAiAgentAction } from '@/app/actions/whatsapp';

interface AiAgentSettingsProps {
    config: WhatsAppConfig;
    onUpdate?: () => void;
}

export function AiAgentSettings({ config, onUpdate }: AiAgentSettingsProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [aiAgentEnabled, setAiAgentEnabled] = useState(config.aiAgentEnabled);

    const handleToggle = async (enabled: boolean) => {
        setIsLoading(true);

        try {
            const result = await toggleAiAgentAction(enabled);

            if (result.success) {
                setAiAgentEnabled(enabled);
                toast.success(
                    enabled
                        ? 'Agente de IA habilitado com sucesso!'
                        : 'Agente de IA desabilitado'
                );
                onUpdate?.();
            } else {
                toast.error(result.error || 'Erro ao atualizar configuração');
            }
        } catch (error) {
            console.error('[AiAgentSettings] Error:', error);
            toast.error('Erro inesperado ao atualizar configuração');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = () => {
        if (isLoading) {
            return (
                <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processando...
                </Badge>
            );
        }

        if (aiAgentEnabled) {
            return (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                    Ativo
                </Badge>
            );
        }

        return (
            <Badge variant="secondary">
                Inativo
            </Badge>
        );
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        <CardTitle>Agente de IA</CardTitle>
                    </div>
                    {getStatusBadge()}
                </div>
                <CardDescription>
                    Habilite o agente de IA para atendimento automático via WhatsApp.
                    O agente responde mensagens, consulta disponibilidade e cria agendamentos automaticamente.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label htmlFor="ai-agent-toggle" className="flex flex-col gap-1">
                        <span className="font-medium">Habilitar Agente de IA</span>
                        <span className="text-sm text-muted-foreground font-normal">
                            O agente funcionará 24 horas para responder seus clientes
                        </span>
                    </Label>
                    <Switch
                        id="ai-agent-toggle"
                        checked={aiAgentEnabled}
                        onCheckedChange={handleToggle}
                        disabled={isLoading}
                    />
                </div>

                {aiAgentEnabled && (
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                        <p className="text-sm font-medium">O agente pode:</p>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                            <li>Informar sobre serviços e horários de funcionamento</li>
                            <li>Consultar disponibilidade de horários</li>
                            <li>Criar agendamentos automaticamente</li>
                            <li>Consultar agendamentos existentes</li>
                            <li>Cancelar agendamentos</li>
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
