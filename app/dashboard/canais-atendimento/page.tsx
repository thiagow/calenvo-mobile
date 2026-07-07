import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Lock, MessageSquare, Bot } from 'lucide-react'
import Link from 'next/link'
import { WhatsAppConnection } from './_components/whatsapp-connection'
import { NotificationSettings } from './_components/notification-settings'
import { AiAgentSettings } from './_components/ai-agent-settings'

interface ExtendedUser { id: string; email: string; planType?: string }
interface ExtendedSession { user: ExtendedUser }

export default async function CanaisAtendimentoPage() {
  const session = (await getServerSession(authOptions)) as ExtendedSession | null
  if (!session?.user?.id) redirect('/auth/signin')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, planType: true, businessName: true },
  })
  if (!user) redirect('/auth/signin')

  const isWhatsappGated = user.planType === 'BASICO'
  const hasAccess = !isWhatsappGated

  let whatsAppConfig = null
  if (hasAccess) {
    whatsAppConfig = await prisma.whatsAppConfig.findUnique({ where: { userId: user.id } })
  }

  return (
    <div className="space-y-4">
      {/* Plano Básico — bloqueio */}
      {isWhatsappGated && (
        <Card className="border border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Lock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Recurso PRO</p>
                <p className="text-xs text-muted-foreground">Disponível nos planos PRO e Avançado</p>
              </div>
            </div>

            <ul className="text-xs text-muted-foreground space-y-1.5 pl-1">
              {[
                'Lembretes automáticos pelo WhatsApp',
                'Agente IA respondendo clientes 24/7',
                'Confirmações de agendamento instantâneas',
                'Mensagens personalizadas com variáveis',
              ].map(b => (
                <li key={b} className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  {b}
                </li>
              ))}
            </ul>

            <Link href="/dashboard/plans" className="block">
              <Button className="w-full">Fazer Upgrade</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Plano pago */}
      {hasAccess && (
        <div className="space-y-4">
          {/* Conexão WhatsApp — sempre visível */}
          <WhatsAppConnection config={whatsAppConfig} />

          {/* Configurações — só se conectado */}
          {whatsAppConfig?.isConnected ? (
            <div className="space-y-4">
              {/* Notificações */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Notificações por WhatsApp</p>
                    <p className="text-xs text-muted-foreground">Mensagens automáticas de confirmação e lembrete</p>
                  </div>
                </div>
                <NotificationSettings config={whatsAppConfig} disabled={!whatsAppConfig.isConnected} />
              </div>

              {/* Agente IA */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Bot className="h-3.5 w-3.5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Agente IA de Atendimento</p>
                    <p className="text-xs text-muted-foreground">IA que responde clientes pelo n8n, 24/7</p>
                  </div>
                </div>
                <AiAgentSettings config={whatsAppConfig} />
              </div>
            </div>
          ) : (
            <Card className="border border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Conecte seu WhatsApp acima para liberar Notificações e Agente IA
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
