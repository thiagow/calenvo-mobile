'use client'

import { useState } from 'react'
import { ChevronDown, ArrowRight, Star, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { PLAN_CONFIGS } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

export default function LandingPage() {
  const [isAnnual, setIsAnnual] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  const testimonials = [
    {
      name: 'Marina Silva',
      role: 'Proprietária de Salão',
      text: 'Calenvo transformou completamente meu negócio. Faltas reduziram em 70% com lembretes automáticos.',
      rating: 5,
      avatar: '👩‍💼'
    },
    {
      name: 'Carlos Santos',
      role: 'Fisioterapeuta',
      text: 'A integração com WhatsApp é perfeita. Meus pacientes adoram e o agendamento ficou muito mais fácil.',
      rating: 5,
      avatar: '👨‍⚕️'
    },
    {
      name: 'Beatriz Costa',
      role: 'Donos de Clínica de Estética',
      text: 'O programa de fidelidade integrado aumentou nossas vendas cruzadas em 40%. Excelente investimento.',
      rating: 5,
      avatar: '💄'
    }
  ]

  const faqItems = [
    {
      question: 'Como funciona o agendamento online?',
      answer: 'Seus clientes acessam uma página pública personalizada e podem agendar disponibilidades em tempo real, diretamente na sua agenda. Sem intermediários.'
    },
    {
      question: 'Posso usar com múltiplos profissionais?',
      answer: 'Sim! Calenvo foi construído para gerenciar múltiplas agendas e profissionais em uma única plataforma com sincronização completa.'
    },
    {
      question: 'Como funciona o programa de fidelidade?',
      answer: 'Configure pacotes, cupons e bônus automáticos que seus clientes acumulam com cada compra. Totalmente integrado ao agendamento.'
    },
    {
      question: 'O WhatsApp é enviado automaticamente?',
      answer: 'Sim. Confirmações, lembretes e atualizações são enviados automaticamente via WhatsApp para reduzir faltas e melhorar a experiência.'
    },
    {
      question: 'Quais são os prazos de suporte?',
      answer: 'Oferecemos suporte por email. Planos pagos têm prioridade. Nossa comunidade também ajuda com boas práticas.'
    }
  ]

  const segments = [
    { name: 'Salões de Beleza', icon: '💇' },
    { name: 'Barbearias', icon: '✂️' },
    { name: 'Clínicas de Estética', icon: '✨' },
    { name: 'Fisioterapia', icon: '🏥' }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
              <span className="text-xl calenvo-gradient font-bold">Calenvo</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="ghost" className="text-gray-700 hover:text-violet-600">
                  Entrar
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-violet-600 hover:bg-violet-700 text-white">
                  Começar Grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-block mb-6 px-4 py-2 bg-white/20 text-white rounded-full text-sm font-medium backdrop-blur-sm">
                ✨ Plataforma Completa de Agendamento
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                Agende. Fidelize. Cresça.
              </h1>
              <p className="text-xl text-violet-100 mb-8 leading-relaxed">
                A solução completa para agendamento online, automação de notificações e programa de fidelidade integrado. Idealizada para salões, clínicas e consultórios.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/signup">
                  <Button size="lg" className="bg-white text-violet-600 hover:bg-gray-100 font-semibold px-8 py-6 text-lg">
                    Experimente Grátis
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Mockup */}
            <div className="relative h-96 md:h-full flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-400/20 to-purple-400/20 rounded-3xl blur-2xl" />
              <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-gray-900">Agendamentos</h3>
                  <span className="text-2xl">📅</span>
                </div>
                <div className="space-y-3">
                  <div className="bg-violet-50 rounded-lg p-4 border-l-4 border-violet-600">
                    <p className="font-medium text-sm text-gray-900">Marina Silva</p>
                    <p className="text-xs text-gray-600">Hoje, 14:30</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-600">
                    <p className="font-medium text-sm text-gray-900">Carlos Santos</p>
                    <p className="text-xs text-gray-600">Amanhã, 10:00</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-600">
                    <p className="font-medium text-sm text-gray-900">Beatriz Costa</p>
                    <p className="text-xs text-gray-600">30 jun, 15:45</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-violet-400">12.000+</div>
              <p className="text-gray-300 mt-2">Negócios</p>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-violet-400">4M+</div>
              <p className="text-gray-300 mt-2">Agendamentos</p>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-violet-400">98%</div>
              <p className="text-gray-300 mt-2">Satisfação</p>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-violet-400">−70%</div>
              <p className="text-gray-300 mt-2">Faltas</p>
            </div>
          </div>
        </div>
      </section>

      {/* Segments */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Para diversos segmentos
            </h2>
            <p className="text-lg text-gray-600">
              Uma plataforma que se adapta às necessidades do seu negócio
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {segments.map((segment) => (
              <div
                key={segment.name}
                className="px-6 py-3 bg-gray-50 rounded-full text-gray-900 font-medium hover:bg-violet-50 hover:text-violet-600 transition-colors text-sm md:text-base"
              >
                <span className="mr-2">{segment.icon}</span>
                {segment.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Tudo que você precisa
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 - Purple */}
            <div className="bg-violet-600 text-white rounded-2xl p-8">
              <div className="text-4xl mb-4">📅</div>
              <h3 className="text-2xl font-bold mb-3">Agendamento 24/7</h3>
              <p className="text-violet-100">
                Seus clientes agendam online a qualquer hora. Sem intermediários, sem surpresas.
              </p>
            </div>

            {/* Feature 2 - White */}
            <div className="bg-white border border-gray-200 rounded-2xl p-8">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Notificações WhatsApp</h3>
              <p className="text-gray-600">
                Confirmações, lembretes e atualizações automáticas. Reduz faltas em até 70%.
              </p>
            </div>

            {/* Feature 3 - Wide */}
            <div className="md:col-span-3 lg:col-span-1 bg-white border border-gray-200 rounded-2xl p-8">
              <div className="text-4xl mb-4">🎁</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Programa de Fidelidade</h3>
              <p className="text-gray-600">
                Pacotes, cupons e bônus automáticos integrados ao agendamento.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Confiem em nós
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-8">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6">{testimonial.text}</p>
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{testimonial.avatar}</div>
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 bg-gray-50" id="pricing">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
              Planos que crescem com você
            </h2>

            {/* Toggle */}
            <div className="flex justify-center items-center gap-4 mb-12">
              <span className={`font-medium ${!isAnnual ? 'text-gray-900' : 'text-gray-600'}`}>
                Mensal
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className="relative inline-flex h-8 w-14 items-center rounded-full bg-gray-300 transition-colors"
                style={{
                  backgroundColor: isAnnual ? '#7C3AED' : '#d1d5db'
                }}
              >
                <span
                  className="inline-block h-6 w-6 transform rounded-full bg-white transition-transform"
                  style={{
                    transform: isAnnual ? 'translateX(28px)' : 'translateX(2px)'
                  }}
                />
              </button>
              <span className={`font-medium ${isAnnual ? 'text-gray-900' : 'text-gray-600'}`}>
                Anual <span className="text-violet-600 font-bold">−20%</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Freemium */}
            <div className="bg-white border border-gray-200 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{PLAN_CONFIGS.FREEMIUM.name}</h3>
              <p className="text-gray-600 mb-6">Perfeito para começar</p>
              <div className="mb-8">
                <span className="text-4xl font-bold text-gray-900">Grátis</span>
                <p className="text-gray-600 mt-1">Para sempre</p>
              </div>
              <Link href="/signup" className="w-full">
                <Button variant="outline" className="w-full mb-8">
                  Começar Grátis
                </Button>
              </Link>
              <ul className="space-y-4">
                {PLAN_CONFIGS.FREEMIUM.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-violet-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Standard - Highlighted */}
            <div className="bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-2xl p-8 relative transform md:scale-105 md:shadow-2xl">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-sm font-bold">
                ⭐ Mais Popular
              </div>
              <h3 className="text-2xl font-bold mb-2">{PLAN_CONFIGS.STANDARD.name}</h3>
              <p className="text-violet-100 mb-6">Para negócios em crescimento</p>
              <div className="mb-8">
                <span className="text-4xl font-bold">
                  {isAnnual
                    ? formatCurrency((PLAN_CONFIGS.STANDARD.price * 12 * 0.8) / 12)
                    : formatCurrency(PLAN_CONFIGS.STANDARD.price)}
                </span>
                <p className="text-violet-100 mt-1">/mês{isAnnual ? ' (faturado anualmente)' : ''}</p>
              </div>
              <Link href="/signup/standard" className="w-full">
                <Button className="w-full mb-8 bg-white text-violet-600 hover:bg-gray-100 font-semibold">
                  Assinar Standard
                </Button>
              </Link>
              <ul className="space-y-4">
                {PLAN_CONFIGS.STANDARD.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-violet-50">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Premium */}
            <div className="bg-white border border-gray-200 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{PLAN_CONFIGS.PREMIUM.name}</h3>
              <p className="text-gray-600 mb-6">Para negócios estabelecidos</p>
              <div className="mb-8">
                <span className="text-4xl font-bold text-gray-900">
                  {isAnnual
                    ? formatCurrency((PLAN_CONFIGS.PREMIUM.price * 12 * 0.8) / 12)
                    : formatCurrency(PLAN_CONFIGS.PREMIUM.price)}
                </span>
                <p className="text-gray-600 mt-1">/mês{isAnnual ? ' (faturado anualmente)' : ''}</p>
              </div>
              <Button disabled className="w-full mb-8 bg-gray-200 text-gray-600">
                Em breve
              </Button>
              <ul className="space-y-4">
                {PLAN_CONFIGS.PREMIUM.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-violet-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Perguntas Frequentes
            </h2>
          </div>

          <div className="space-y-4">
            {faqItems.map((item, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 text-left">{item.question}</h3>
                  <ChevronDown
                    className="h-5 w-5 text-gray-600 flex-shrink-0 transition-transform"
                    style={{
                      transform: faqOpen === idx ? 'rotate(180deg)' : 'rotate(0)'
                    }}
                  />
                </button>
                {faqOpen === idx && (
                  <div className="px-6 pb-6 text-gray-600 border-t border-gray-200">
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="bg-gradient-to-r from-violet-600 to-purple-600 text-white py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para crescer?
          </h2>
          <p className="text-lg text-violet-100 mb-8">
            Junte-se a milhares de negócios que já transformaram seu agendamento com Calenvo
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-white text-violet-600 hover:bg-gray-100 font-semibold px-8 py-6 text-lg">
              Começar Agora - É Grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
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
                <span className="text-lg font-bold text-white">Calenvo</span>
              </div>
              <p className="text-sm">
                Plataforma completa de agendamento e fidelização para diversos segmentos
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Produto</h3>
              <ul className="space-y-2 text-sm">
                <li>Funcionalidades</li>
                <li>Segmentos</li>
                <li>Preços</li>
                <li>Suporte</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Contato</h3>
              <p className="text-sm">contato@calenvo.com.br</p>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2024 Calenvo. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
