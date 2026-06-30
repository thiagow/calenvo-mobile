import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, MessageSquare, Bot } from 'lucide-react';
import Link from 'next/link';
import { WhatsAppConnection } from './_components/whatsapp-connection';
import { NotificationSettings } from './_components/notification-settings';
import { AiAgentSettings } from './_components/ai-agent-settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ExtendedUser {
    id: string;
    email: string;
    planType?: string;
}

interface ExtendedSession {
    user: ExtendedUser;
}

export default async function CanaisAtendimentoPage() {
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;

    if (!session?.user?.id) {
        redirect('/auth/signin');
    }

    // Get user with plan type
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            planType: true,
            businessName: true,
        },
    });

    if (!user) {
        redirect('/auth/signin');
    }

    const isPlanFree = user.planType === 'FREEMIUM';
    const hasAccess = !isPlanFree;

    // Get WhatsApp config if has access
    let whatsAppConfig = null;
    if (hasAccess) {
        whatsAppConfig = await prisma.whatsAppConfig.findUnique({
            where: { userId: user.id },
        });
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Canais de Atendimento</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                    Gerencie suas conexões de WhatsApp, notificações de agendamento e o Agente IA de atendimento.
                </p>
            </div>

            {/* Content */}
            <div className="space-y-6">
                {/* Free Plan Blocker */}
                {isPlanFree && (
                    <Card className="border-amber-200 bg-amber-50/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Lock className="h-5 w-5" />
                                Recurso Premium
                            </CardTitle>
                            <CardDescription>
                                Os Canais de Atendimento (WhatsApp e Agente IA) estão disponíveis apenas para planos Standard e Premium
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Alert>
                                <AlertDescription>
                                    <strong>Benefícios das Integrações:</strong>
                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li>Reduza ausências com lembretes automáticos pelo WhatsApp</li>
                                        <li>Utilize Inteligência Artificial para responder clientes 24/7</li>
                                        <li>Confirme agendamentos instantaneamente</li>
                                        <li>Personalize mensagens com variáveis dinâmicas</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>

                            <div className="pt-2">
                                <Link href="/dashboard/plans">
                                    <Button size="lg" className="w-full sm:w-auto">
                                        Fazer Upgrade do Plano
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* WhatsApp Connection & Configs (Only for paid plans) */}
                {hasAccess && (
                    <>
                        {/* COMPONENTE DE CONEXÃO FIXO NO TOPO */}
                        <WhatsAppConnection config={whatsAppConfig} />

                        {/* Configurações (Apenas visível se conectado) */}
                        {whatsAppConfig && whatsAppConfig.isConnected ? (

                            <Tabs defaultValue="notifications" className="w-full mt-6">
                                <TabsList className="flex flex-col h-auto w-full gap-1 p-1 bg-muted rounded-md mb-6 md:mb-0 md:grid md:grid-cols-2">
                                    <TabsTrigger value="notifications" className="w-full justify-start md:justify-center py-2 gap-2">
                                        <MessageSquare className="h-4 w-4" /> Notificações Transacionais
                                    </TabsTrigger>
                                    <TabsTrigger value="ai_agent" className="w-full justify-start md:justify-center py-2 gap-2">
                                        <Bot className="h-4 w-4" /> Atendimento de IA
                                    </TabsTrigger>
                                </TabsList>

                                {/* ABA 1: NOTIFICAÇÕES (LEMBRETES DE AGENDAMENTO, CANCELAMENTO, ETC) */}
                                <TabsContent value="notifications" className="mt-6">
                                    <div className="mb-4">
                                        <h2 className="text-xl font-bold text-gray-900">Notificações por WhatsApp</h2>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Configure em quais momentos o sistema envia mensagens automáticas para o cliente (agendamento criado, cancelado ou lembretes).
                                        </p>
                                    </div>
                                    <NotificationSettings
                                        config={whatsAppConfig}
                                        disabled={!whatsAppConfig.isConnected}
                                    />
                                </TabsContent>

                                {/* ABA 2: AGENTE DE IA (RESPOSTAS AUTOMATIZADAS VIA N8N) */}
                                <TabsContent value="ai_agent" className="mt-6">
                                    <div className="mb-4">
                                        <h2 className="text-xl font-bold text-gray-900">Agente IA de Atendimento</h2>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Conecte seu fluxo do n8n para que uma IA responda clientes baseado nas suas regras de negócio e informações configuradas no sistema.
                                        </p>
                                    </div>
                                    <AiAgentSettings
                                        config={whatsAppConfig}
                                    />
                                </TabsContent>

                            </Tabs>

                        ) : (
                            /* Info when not connected */
                            <Card>
                                <CardContent className="py-8">
                                    <div className="text-center space-y-2">
                                        <p className="text-muted-foreground">
                                            Conecte seu WhatsApp acima para liberar as configurações de Notificações e Atendimento IA.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
