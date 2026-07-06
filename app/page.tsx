'use client'

import { useState } from 'react'
import { ChevronDown, ArrowRight, Star, Check, Scissors, Cross, Droplets, PersonStanding, CalendarDays, Bell, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PLAN_CONFIGS } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

export default function LandingPage() {
  const [isAnnual, setIsAnnual] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  const testimonials = [
    {
      name: 'Claudia Moreira',
      role: 'Salão de Beleza · São Paulo',
      text: '"Reduzi as faltas em quase 80% com os lembretes automáticos. Meus clientes adoram confirmar pelo WhatsApp. O Calenvo transformou o meu salão completamente."',
      rating: 5,
      initial: 'C',
      color: 'from-pink-500 to-violet-500',
    },
    {
      name: 'Dr. Rafael Souza',
      role: 'Clínica de Fisioterapia · Campinas',
      text: '"Gerencio 6 fisioterapeutas em uma única tela. Os relatórios mostram os horários mais rentáveis e quais profissionais têm mais demanda. Simplesmente indispensável."',
      rating: 5,
      initial: 'R',
      color: 'from-blue-500 to-blue-700',
    },
    {
      name: 'Mariana Teixeira',
      role: 'Spa e Estética · Rio de Janeiro',
      text: '"O programa de fidelidade foi divisor de águas. Clientes que vinham mensalmente agora retornam toda semana. O retorno aumentou 40% em apenas 3 meses."',
      rating: 5,
      initial: 'M',
      color: 'from-violet-500 to-blue-600',
    },
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
    { name: 'Salões e Barbearias', icon: Scissors },
    { name: 'Clínicas e Consultórios', icon: Cross },
    { name: 'Spas e Estética', icon: Droplets },
    { name: 'Fisioterapia', icon: PersonStanding },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-[#7C3AED] border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 flex-shrink-0">
              <svg width="40" height="40" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="52" height="52" rx="13" fill="url(#calenvo_grad)"></rect>
                <rect x="11" y="14" width="30" height="4" rx="2" fill="white" opacity="0.35"></rect>
                <circle cx="18" cy="27" r="2.5" fill="white" opacity="0.45"></circle>
                <circle cx="26" cy="27" r="2.5" fill="white" opacity="0.45"></circle>
                <circle cx="34" cy="27" r="2.5" fill="white" opacity="0.45"></circle>
                <circle cx="18" cy="35" r="2.5" fill="white" opacity="0.45"></circle>
                <circle cx="26" cy="35" r="4" fill="white"></circle>
                <path d="M23.8 35l1.6 1.7 2.8-3" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                <circle cx="34" cy="35" r="2.5" fill="white" opacity="0.45"></circle>
                <defs>
                  <linearGradient id="calenvo_grad" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#8B5CF6"></stop>
                    <stop offset="100%" stopColor="#5B21B6"></stop>
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-xl font-bold text-white">Calenvo</span>
            </Link>

            {/* Center Navigation */}
            <nav className="hidden md:flex items-center space-x-8 bg-[#7C3AED] rounded-full px-8 py-3">
              <a href="#funcionalidades" className="text-white hover:text-violet-100 font-medium text-sm">
                Funcionalidades
              </a>
              <a href="#pricing" className="text-white hover:text-violet-100 font-medium text-sm">
                Planos
              </a>
              <a href="#testimonials" className="text-white hover:text-violet-100 font-medium text-sm">
                Depoimentos
              </a>
              <a href="#faq" className="text-white hover:text-violet-100 font-medium text-sm">
                FAQ
              </a>
            </nav>

            {/* Right Actions */}
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="ghost" className="text-white hover:text-violet-100 font-medium">
                  Entrar
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-[#EDE9FE] hover:bg-violet-200 text-[#7C3AED] font-semibold px-6">
                  Contratar plano
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#FAFAFF] py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-violet-100 text-violet-600 rounded-full text-sm font-medium">
                <span className="w-2 h-2 bg-violet-600 rounded-full"></span>
                Agendamento e fidelização completos
              </div>
              <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                <div>Agende.</div>
                <div>Fidelize.</div>
                <div><span className="text-violet-600">Cresça.</span></div>
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-xl">
                Gestão completa de agendas, equipe multiprofissional, notificações automáticas e muito mais. A solução ideal para o seu negócio crescer.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link href="/signup">
                  <Button className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-8 py-6 rounded-full text-base">
                    Contratar plano
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button variant="outline" className="font-semibold px-8 py-6 rounded-full text-base border-gray-300">
                  Ver funcionalidades
                </Button>
              </div>

              {/* Social Proof */}
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold border-2 border-white">C</div>
                  <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white font-bold border-2 border-white">R</div>
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold border-2 border-white">M</div>
                  <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold border-2 border-white">A</div>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-700 font-medium">+12.000 negócios confiam no Calenvo</p>
              </div>
            </div>

            {/* Right Mockup */}
            <div className="relative">
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-3xl p-8">
                {/* Notification - Top Right */}
                <div className="absolute top-8 right-8 bg-white rounded-2xl shadow-lg p-4 w-72">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                      <span className="text-xl">⭐</span>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">+50 pontos!</p>
                      <p className="text-xs text-gray-600">Carlos atingiu Gold</p>
                    </div>
                  </div>
                </div>

                {/* Agenda Card */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mt-12">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">AGENDA DO DIA</p>
                      <p className="text-lg font-bold text-gray-900">Quinta, 19 de Junho</p>
                    </div>
                    <p className="text-sm text-violet-600 font-semibold">3 agendados</p>
                  </div>

                  <div className="space-y-4">
                    {/* Appointment 1 */}
                    <div className="flex items-center justify-between pb-4 border-b">
                      <div>
                        <p className="text-2xl font-bold text-violet-600">09</p>
                        <p className="text-sm text-violet-600 font-medium">:00</p>
                      </div>
                      <div className="flex-1 ml-4">
                        <p className="font-semibold text-gray-900">Ana Beatriz</p>
                        <p className="text-xs text-gray-600">Corte + Hidratação · 60 min</p>
                      </div>
                      <button className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white">
                        ✓
                      </button>
                    </div>

                    {/* Appointment 2 */}
                    <div className="flex items-center justify-between pb-4 border-b">
                      <div>
                        <p className="text-2xl font-bold text-gray-600">10</p>
                        <p className="text-sm text-gray-600 font-medium">:30</p>
                      </div>
                      <div className="flex-1 ml-4">
                        <p className="font-semibold text-gray-900">Carlos Mendes</p>
                        <p className="text-xs text-gray-600">Barba + Corte · 45 min</p>
                      </div>
                      <button className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-400">
                        ◎
                      </button>
                    </div>

                    {/* Appointment 3 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-green-600">14</p>
                        <p className="text-sm text-green-600 font-medium">:00</p>
                      </div>
                      <div className="flex-1 ml-4">
                        <p className="font-semibold text-gray-900">Mariana Souza</p>
                        <p className="text-xs text-gray-600">Massagem relaxante · 90 min</p>
                      </div>
                      <button className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white">
                        ✓
                      </button>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Notification - Bottom Right */}
                <div className="absolute bottom-8 right-8 bg-white rounded-2xl shadow-lg p-4 w-64">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                      💬
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Ana confirmou!</p>
                      <p className="text-xs text-gray-600">Lembrete via WhatsApp ✓</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-[#F9FAFB] text-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
            <div>
              <div className="text-5xl md:text-6xl font-bold text-violet-600 mb-3">12.000+</div>
              <p className="text-gray-600 text-lg">Negócios</p>
            </div>
            <div>
              <div className="text-5xl md:text-6xl font-bold text-violet-600 mb-3">4M+</div>
              <p className="text-gray-600 text-lg">Agendamentos</p>
            </div>
            <div>
              <div className="text-5xl md:text-6xl font-bold text-violet-600 mb-3">98%</div>
              <p className="text-gray-600 text-lg">Satisfação</p>
            </div>
            <div>
              <div className="text-5xl md:text-6xl font-bold text-violet-600 mb-3">−70%</div>
              <p className="text-gray-600 text-lg">Faltas</p>
            </div>
          </div>
        </div>
      </section>

      {/* Segments */}
      <section className="py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Feito para múltiplos segmentos
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {segments.map((segment) => {
              const Icon = segment.icon
              return (
                <div
                  key={segment.name}
                  className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-full text-gray-700 font-medium hover:border-violet-400 hover:text-violet-600 transition-all text-sm cursor-default"
                >
                  <Icon className="h-4 w-4 text-violet-500 flex-shrink-0" />
                  {segment.name}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 bg-violet-100 text-violet-600 rounded-full text-sm font-medium mb-6">
              Depoimentos
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
              Quem usa, aprova
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-8 flex flex-col gap-6 shadow-sm">
                {/* Stars */}
                <div className="flex items-center gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-gray-700 text-sm leading-relaxed flex-1">
                  {testimonial.text}
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${testimonial.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                    {testimonial.initial}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{testimonial.name}</p>
                    <p className="text-xs text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-24 bg-[#CCCCCC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-violet-100 text-violet-600 rounded-full text-sm font-medium mb-6">
              Funcionalidades
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
              Tudo que você precisa,<br />em um só sistema
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Do agendamento ao programa de fidelidade, o Calenvo cuida de tudo para você focar no que importa.
            </p>
          </div>

          {/* Top row: purple card + white card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Card 1 — Agendamento (purple) */}
            <div className="bg-violet-600 rounded-3xl p-8 flex flex-col gap-6">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-3">Agendamento online 24/7</h3>
                <p className="text-violet-100 text-sm leading-relaxed">
                  Seus clientes agendam quando quiserem pelo celular, sem precisar ligar. Link personalizado, cardápio de serviços e confirmação automática.
                </p>
              </div>
              <ul className="space-y-2">
                {['Link exclusivo de agendamento', 'Equipe multiprofissional', 'Confirmação automática por mensagem'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-violet-100">
                    <Check className="h-4 w-4 text-violet-300 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 2 — Notificações (white) */}
            <div className="bg-white border border-gray-100 rounded-3xl p-8 flex flex-col gap-6">
              <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center">
                <Bell className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Notificações automáticas</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Reduza faltas em até 70%. Envie lembretes automáticos por WhatsApp, SMS e e-mail. Clientes confirmam ou remarcam com um toque, sem precisar ligar.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 px-4 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  WhatsApp
                </span>
                <span className="px-4 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                  SMS
                </span>
                <span className="px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  E-mail
                </span>
              </div>
            </div>
          </div>

          {/* Bottom row: wide fidelidade card */}
          <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left */}
            <div className="flex flex-col gap-6">
              <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center">
                <Star className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Programa de fidelidade e pontos</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Fidelize clientes com um programa de pontos personalizável. Eles acumulam a cada visita e resgatam recompensas — voltando mais vezes e gastando mais.
                </p>
              </div>
            </div>

            {/* Right — mockup */}
            <div className="flex flex-col gap-3">
              {/* Categoria card */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">Categoria atual</p>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-900">Bronze → Prata</p>
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Prata</span>
                </div>
              </div>

              {/* Progress card */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-3">Progresso para resgate</p>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                  <div className="bg-violet-500 h-2 rounded-full" style={{ width: '70%' }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>350 pts</span>
                  <span>500 pts</span>
                </div>
              </div>

              {/* Impact card */}
              <div className="bg-violet-600 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-violet-200 mb-1">Impacto no negócio</p>
                  <p className="text-xl font-bold text-white">+40% de retorno</p>
                </div>
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 bg-white" id="pricing">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-violet-100 text-violet-600 rounded-full text-sm font-medium mb-6">
              Planos
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Simples, transparente, sem surpresas
            </h2>
            <p className="text-gray-500">14 dias grátis em qualquer plano. Sem cartão de crédito.</p>
          </div>

          {/* Toggle */}
          <div className="flex justify-center mb-14">
            <div className="flex items-center bg-gray-100 rounded-full p-1">
              <button
                onClick={() => setIsAnnual(false)}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${!isAnnual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                Mensal
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all ${isAnnual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                Anual
                <span className="bg-violet-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">−20%</span>
              </button>
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center max-w-5xl mx-auto">

            {/* Básico */}
            <div className="bg-white border border-gray-200 rounded-3xl p-8">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">Básico</p>
              <div className="mb-1">
                <span className="text-sm text-gray-500">R$</span>
                <span className="text-5xl font-bold text-gray-900">{isAnnual ? '14' : '19'}</span>
                <span className="text-gray-500">,{isAnnual ? '90' : '90'}/mês</span>
              </div>
              <p className="text-xs text-gray-400 mb-8">Cobrado {isAnnual ? 'anualmente' : 'mensalmente'}</p>
              <Link href="/signup" className="w-full block mb-8">
                <Button variant="outline" className="w-full font-semibold rounded-xl">
                  Contratar Básico
                </Button>
              </Link>
              <ul className="space-y-3">
                {['Até 2 profissionais', '150 agendamentos/mês', 'Notificações por e-mail', 'Link de agendamento próprio', 'Suporte por chat'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-violet-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* PRO — destaque, maior */}
            <div className="bg-violet-600 rounded-3xl p-8 relative shadow-2xl md:-my-4">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap">
                Mais Popular
              </div>
              <p className="text-xs font-bold text-violet-300 uppercase tracking-widest mb-6">PRO</p>
              <div className="mb-1">
                <span className="text-sm text-violet-200">R$</span>
                <span className="text-5xl font-bold text-white">{isAnnual ? '27' : '39'}</span>
                <span className="text-violet-200">,90/mês</span>
              </div>
              <p className="text-xs text-violet-300 mb-8">Cobrado {isAnnual ? 'anualmente' : 'mensalmente'}</p>
              <Link href="/signup/standard" className="w-full block mb-8">
                <Button className="w-full bg-white text-violet-700 hover:bg-gray-100 font-bold rounded-xl">
                  Contratar Pro
                </Button>
              </Link>
              <ul className="space-y-3">
                {['Tudo do Básico', 'Até 8 profissionais', 'WhatsApp + SMS + E-mail ilimitados', 'Programa de fidelidade completo', 'Relatórios e métricas avançadas', 'Suporte prioritário'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-violet-100">
                    <Check className="h-4 w-4 text-violet-300 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Business */}
            <div className="bg-white border border-gray-200 rounded-3xl p-8">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">Business</p>
              <div className="mb-1">
                <span className="text-sm text-gray-500">R$</span>
                <span className="text-5xl font-bold text-gray-900">{isAnnual ? '49' : '69'}</span>
                <span className="text-gray-500">,90/mês</span>
              </div>
              <p className="text-xs text-gray-400 mb-8">Cobrado {isAnnual ? 'anualmente' : 'mensalmente'}</p>
              <Link href="/signup" className="w-full block mb-8">
                <Button variant="outline" className="w-full font-semibold rounded-xl">
                  Contratar Business
                </Button>
              </Link>
              <ul className="space-y-3">
                {['Tudo do Pro', 'Profissionais ilimitados', 'Múltiplas unidades', 'API e integrações avançadas', 'Account manager dedicado', 'SLA garantido'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-violet-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 bg-[#F9FAFB]">
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
          <Link href="#pricing">
            <Button size="lg" className="bg-white text-violet-600 hover:bg-gray-100 font-semibold px-8 py-6 text-lg">
              Escolha Agora Seu Plano
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
                <svg width="40" height="40" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="52" height="52" rx="13" fill="url(#calenvo_grad_footer)"></rect>
                  <rect x="11" y="14" width="30" height="4" rx="2" fill="white" opacity="0.35"></rect>
                  <circle cx="18" cy="27" r="2.5" fill="white" opacity="0.45"></circle>
                  <circle cx="26" cy="27" r="2.5" fill="white" opacity="0.45"></circle>
                  <circle cx="34" cy="27" r="2.5" fill="white" opacity="0.45"></circle>
                  <circle cx="18" cy="35" r="2.5" fill="white" opacity="0.45"></circle>
                  <circle cx="26" cy="35" r="4" fill="white"></circle>
                  <path d="M23.8 35l1.6 1.7 2.8-3" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                  <circle cx="34" cy="35" r="2.5" fill="white" opacity="0.45"></circle>
                  <defs>
                    <linearGradient id="calenvo_grad_footer" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#8B5CF6"></stop>
                      <stop offset="100%" stopColor="#5B21B6"></stop>
                    </linearGradient>
                  </defs>
                </svg>
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
