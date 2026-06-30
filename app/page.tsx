
import { Calendar, Users, Clock, Shield, CheckCircle, ArrowRight, Star, Zap, Bot, MessageCircle, BarChart3, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import Image from 'next/image'
import { PLAN_CONFIGS } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

export default function LandingPage() {
  const segments = [
    { name: 'Salões de Beleza', icon: '💇', color: 'bg-pink-50 text-pink-600' },
    { name: 'Barbearias', icon: '✂️', color: 'bg-blue-50 text-blue-600' },
    { name: 'Clínicas de Estética', icon: '✨', color: 'bg-purple-50 text-purple-600' },
    { name: 'Odontologia', icon: '🦷', color: 'bg-indigo-50 text-indigo-600' },
    { name: 'Fisioterapia', icon: '🏥', color: 'bg-green-50 text-green-600' },
    { name: 'Nutrição', icon: '🥗', color: 'bg-orange-50 text-orange-600' },
    { name: 'Clínicas de Terapias', icon: '🧘', color: 'bg-red-50 text-red-600' },
    { name: 'Pet Shops', icon: '🐾', color: 'bg-teal-50 text-teal-600' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center space-x-2">
              <div className="relative h-10 w-10">
                <Image
                  src="/calenvo-logo.png"
                  alt="Calenvo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-xl calenvo-gradient">Calenvo</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="ghost" className="text-gray-600 hover:text-blue-600">
                  Entrar
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Começar Grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">
              🚀 Plataforma Completa de Agendamento
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Sistema de
              <span className="text-blue-600"> agendamento </span>
              e fidelização de clientes
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Gestão completa de agendas, equipe multiprofissional, notificações automáticas e muito mais. A solução ideal para o seu negócio crescer.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6">
                  Experimente Grátis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Segments Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Perfeito para Diversos Segmentos
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Uma plataforma flexível que se adapta às necessidades específicas do seu negócio
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {segments.map((segment, index) => (
              <div
                key={index}
                className={`${segment.color} rounded-xl p-6 text-center hover:shadow-lg transition-all duration-200 hover:scale-105`}
              >
                <div className="text-4xl mb-3">{segment.icon}</div>
                <h3 className="font-semibold text-sm">{segment.name}</h3>
              </div>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <p className="text-gray-600">
              E muitos outros segmentos que trabalham com agendamento de horários e gestão de clientes
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Recursos Completos para Gestão e Fidelização
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Tudo o que você precisa para automatizar agendamentos e melhorar a experiência dos seus clientes
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Calendar,
                title: 'Multi Agenda e Multi Profissionais',
                description: 'Gerencie várias agendas e profissionais em uma única plataforma com visualização completa'
              },
              {
                icon: Users,
                title: 'Gestão Completa de Clientes',
                description: 'Cadastro detalhado com histórico de atendimentos e preferências personalizadas'
              },
              {
                icon: Clock,
                title: 'Página Pública de Agendamento',
                description: 'Seus clientes podem agendar online 24/7 com interface intuitiva e responsiva'
              },
              {
                icon: MessageCircle,
                title: 'Notificações WhatsApp',
                description: 'Confirmações, lembretes e atualizações automáticas via WhatsApp integrado'
              },
              {
                icon: Bot,
                title: 'Agente de Atendimento IA',
                description: 'Assistente virtual inteligente que responde dúvidas e auxilia no agendamento via WhatsApp (em breve)'
              },
              {
                icon: Zap,
                title: 'Automação Inteligente',
                description: 'Processos automatizados que economizam tempo e reduzem falhas humanas'
              },
              {
                icon: BarChart3,
                title: 'Relatórios e Análises',
                description: 'Acompanhe métricas importantes e tome decisões baseadas em dados'
              },
              {
                icon: Shield,
                title: 'Seguro e Confiável',
                description: 'Dados protegidos com criptografia e conformidade total com a LGPD'
              }
            ].map((feature, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader>
                  <feature.icon className="h-12 w-12 text-blue-600 mb-4" />
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Planos que crescem com seu negócio
            </h2>
            <p className="text-lg text-gray-600">
              Comece grátis e faça upgrade quando precisar de mais recursos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Freemium */}
            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-xl text-center">
                  {PLAN_CONFIGS.FREEMIUM.name}
                </CardTitle>
                <CardDescription className="text-center">
                  Perfeito para começar
                </CardDescription>
                <div className="text-center py-4">
                  <span className="text-3xl font-bold">Grátis</span>
                  <p className="text-sm text-gray-600 mt-1">Para sempre</p>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {PLAN_CONFIGS.FREEMIUM.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Link href="/signup" className="w-full">
                  <Button className="w-full" variant="outline">
                    Começar Grátis
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Standard */}
            <Card className="relative border-blue-500 shadow-lg scale-105">
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500">
                <Star className="h-3 w-3 mr-1" />
                Mais Popular
              </Badge>
              <CardHeader>
                <CardTitle className="text-xl text-center">
                  {PLAN_CONFIGS.STANDARD.name}
                </CardTitle>
                <CardDescription className="text-center">
                  Para negócios em crescimento
                </CardDescription>
                <div className="text-center py-4">
                  <span className="text-3xl font-bold">
                    {formatCurrency(PLAN_CONFIGS.STANDARD.price)}
                  </span>
                  <p className="text-sm text-gray-600 mt-1">/mês</p>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {PLAN_CONFIGS.STANDARD.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Link href="/signup/standard" className="w-full">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    Assinar Standard
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Premium */}
            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-xl text-center">
                  {PLAN_CONFIGS.PREMIUM.name}
                </CardTitle>
                <CardDescription className="text-center">
                  Para negócios estabelecidos
                </CardDescription>
                <div className="text-center py-4">
                  <span className="text-3xl font-bold">
                    {formatCurrency(PLAN_CONFIGS.PREMIUM.price)}
                  </span>
                  <p className="text-sm text-gray-600 mt-1">/mês</p>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {PLAN_CONFIGS.PREMIUM.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant="outline" disabled>
                  Em breve
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Pronto para revolucionar seu agendamento?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Junte-se a centenas de profissionais que já transformaram seus negócios com o Calenvo
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6">
              Começar Agora - É Grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="relative h-10 w-10">
                  <Image
                    src="/calenvo-logo.png"
                    alt="Calenvo"
                    fill
                    className="object-contain brightness-150"
                  />
                </div>
                <span className="text-xl calenvo-gradient">Calenvo</span>
              </div>
              <p className="text-gray-400">
                Plataforma completa de agendamento e fidelização para diversos segmentos
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Produto</h3>
              <ul className="space-y-2 text-gray-400">
                <li>Funcionalidades</li>
                <li>Segmentos</li>
                <li>Preços</li>
                <li>Suporte</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Contato</h3>
              <p className="text-gray-400">
                contato@calenvo.com.br
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Calenvo. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
