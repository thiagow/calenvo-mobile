'use client'

import { useState } from 'react'
import { ChevronDown, ArrowRight, Star, Check, Scissors, Cross, Droplets, PersonStanding, CalendarDays, Bell, TrendingUp, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { PLAN_CONFIGS, getPlanPrice, type Currency } from '@/lib/types'
import { formatCurrencyByCurrency } from '@/lib/utils'
import { LogoIcon } from '@/components/brand/logo'
import { LanguageSwitcher } from '@/components/brand/language-switcher'
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle } from '@/components/ui/sheet'

export default function LandingPage() {
  const [isAnnual, setIsAnnual] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const t = useTranslations('Landing')
  const locale = useLocale()
  const currency: Currency = locale === 'en' ? 'USD' : 'BRL'
  const interval = isAnnual ? 'ANNUAL' : 'MONTHLY'

  const testimonials = [
    { key: 'item1', initial: 'C', color: 'from-pink-500 to-violet-500', name: 'Claudia Moreira', rating: 5 },
    { key: 'item2', initial: 'R', color: 'from-blue-500 to-blue-700', name: 'Dr. Rafael Souza', rating: 5 },
    { key: 'item3', initial: 'M', color: 'from-violet-500 to-blue-600', name: 'Mariana Teixeira', rating: 5 },
  ] as const

  const faqItems = ['item1', 'item2', 'item3', 'item4', 'item5'] as const

  const segments = [
    { key: 'beauty', icon: Scissors },
    { key: 'clinics', icon: Cross },
    { key: 'spas', icon: Droplets },
    { key: 'physio', icon: PersonStanding },
  ] as const

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-[#7C3AED] border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 flex-shrink-0">
              <LogoIcon gradientId="calenvo_grad_header" />
              <span className="text-xl font-bold text-white">Calenvo</span>
            </Link>

            {/* Center Navigation */}
            <nav className="hidden md:flex items-center space-x-8 bg-[#7C3AED] rounded-full px-8 py-3">
              <a href="#funcionalidades" className="text-white hover:text-violet-100 font-medium text-sm">
                {t('nav.funcionalidades')}
              </a>
              <a href="#pricing" className="text-white hover:text-violet-100 font-medium text-sm">
                {t('nav.planos')}
              </a>
              <a href="#testimonials" className="text-white hover:text-violet-100 font-medium text-sm">
                {t('nav.depoimentos')}
              </a>
              <a href="#faq" className="text-white hover:text-violet-100 font-medium text-sm">
                {t('nav.faq')}
              </a>
            </nav>

            {/* Right Actions — desktop */}
            <div className="hidden md:flex items-center space-x-4">
              <LanguageSwitcher />
              <Link href="/login">
                <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10 font-medium">
                  {t('nav.entrar')}
                </Button>
              </Link>
              <Link href="#pricing">
                <Button className="bg-[#EDE9FE] hover:bg-violet-200 text-[#7C3AED] font-semibold px-6">
                  {t('nav.contratarPlano')}
                </Button>
              </Link>
            </div>

            {/* Right Actions — mobile */}
            <div className="flex md:hidden items-center gap-3 flex-shrink-0">
              <LanguageSwitcher />
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    aria-label="Abrir menu"
                    className="flex items-center justify-center h-10 w-10 rounded-full text-white hover:bg-white/10 transition-colors flex-shrink-0"
                  >
                    <Menu className="h-6 w-6" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="flex flex-col gap-6">
                  <SheetTitle className="flex items-center gap-2">
                    <LogoIcon size={32} gradientId="calenvo_grad_mobile_menu" />
                    <span className="text-lg font-bold text-gray-900">Calenvo</span>
                  </SheetTitle>

                  <nav className="flex flex-col gap-1">
                    <SheetClose asChild>
                      <a href="#funcionalidades" className="px-2 py-3 text-gray-700 hover:text-violet-600 font-medium border-b border-gray-100">
                        {t('nav.funcionalidades')}
                      </a>
                    </SheetClose>
                    <SheetClose asChild>
                      <a href="#pricing" className="px-2 py-3 text-gray-700 hover:text-violet-600 font-medium border-b border-gray-100">
                        {t('nav.planos')}
                      </a>
                    </SheetClose>
                    <SheetClose asChild>
                      <a href="#testimonials" className="px-2 py-3 text-gray-700 hover:text-violet-600 font-medium border-b border-gray-100">
                        {t('nav.depoimentos')}
                      </a>
                    </SheetClose>
                    <SheetClose asChild>
                      <a href="#faq" className="px-2 py-3 text-gray-700 hover:text-violet-600 font-medium border-b border-gray-100">
                        {t('nav.faq')}
                      </a>
                    </SheetClose>
                  </nav>

                  <div className="flex flex-col gap-3 mt-auto">
                    <SheetClose asChild>
                      <Link href="/login" className="w-full">
                        <Button variant="outline" className="w-full border-gray-200 text-gray-900 hover:bg-gray-50 font-medium">
                          {t('nav.entrar')}
                        </Button>
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="#pricing" className="w-full">
                        <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold">
                          {t('nav.contratarPlano')}
                        </Button>
                      </Link>
                    </SheetClose>
                  </div>
                </SheetContent>
              </Sheet>
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
                {t('hero.badge')}
              </div>
              <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                <div>{t('hero.titleLine1')}</div>
                <div>{t('hero.titleLine2')}</div>
                <div><span className="text-violet-600">{t('hero.titleLine3')}</span></div>
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-xl">
                {t('hero.description')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link href="#pricing" className="w-full sm:w-auto">
                  <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold px-10 py-7 rounded-full text-lg">
                    {t('hero.ctaPrimary')}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button variant="outline" className="w-full sm:w-auto font-semibold px-8 py-6 rounded-full text-base border-gray-300">
                  {t('hero.ctaSecondary')}
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
                <p className="text-sm text-gray-700 font-medium">{t('hero.socialProof')}</p>
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
                      <p className="font-bold text-gray-900">{t('mockup.pointsNotification')}</p>
                      <p className="text-xs text-gray-600">{t('mockup.pointsSubtitle')}</p>
                    </div>
                  </div>
                </div>

                {/* Agenda Card */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mt-12">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">{t('mockup.agendaLabel')}</p>
                      <p className="text-lg font-bold text-gray-900">{t('mockup.agendaDate')}</p>
                    </div>
                    <p className="text-sm text-violet-600 font-semibold">{t('mockup.agendedCount')}</p>
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
                        <p className="text-xs text-gray-600">{t('mockup.service1')}</p>
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
                        <p className="text-xs text-gray-600">{t('mockup.service2')}</p>
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
                        <p className="text-xs text-gray-600">{t('mockup.service3')}</p>
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
                      <p className="font-semibold text-gray-900">{t('mockup.whatsappConfirmed')}</p>
                      <p className="text-xs text-gray-600">{t('mockup.whatsappSubtitle')}</p>
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
              <p className="text-gray-600 text-lg">{t('stats.negocios')}</p>
            </div>
            <div>
              <div className="text-5xl md:text-6xl font-bold text-violet-600 mb-3">4M+</div>
              <p className="text-gray-600 text-lg">{t('stats.agendamentos')}</p>
            </div>
            <div>
              <div className="text-5xl md:text-6xl font-bold text-violet-600 mb-3">98%</div>
              <p className="text-gray-600 text-lg">{t('stats.satisfacao')}</p>
            </div>
            <div>
              <div className="text-5xl md:text-6xl font-bold text-violet-600 mb-3">−70%</div>
              <p className="text-gray-600 text-lg">{t('stats.faltas')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Segments */}
      <section id="segmentos" className="py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              {t('segments.title')}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {segments.map((segment) => {
              const Icon = segment.icon
              return (
                <div
                  key={segment.key}
                  className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-full text-gray-700 font-medium hover:border-violet-400 hover:text-violet-600 transition-all text-sm cursor-default"
                >
                  <Icon className="h-4 w-4 text-violet-500 flex-shrink-0" />
                  {t(`segments.${segment.key}`)}
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
              {t('testimonials.badge')}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
              {t('testimonials.title')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <div key={testimonial.key} className="bg-white border border-gray-100 rounded-2xl p-8 flex flex-col gap-6 shadow-sm">
                {/* Stars */}
                <div className="flex items-center gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-gray-700 text-sm leading-relaxed flex-1">
                  {t(`testimonials.${testimonial.key}.text`)}
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${testimonial.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                    {testimonial.initial}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{testimonial.name}</p>
                    <p className="text-xs text-gray-500">{t(`testimonials.${testimonial.key}.role`)}</p>
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
              {t('features.badge')}
            </span>
            <h2
              className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight"
              dangerouslySetInnerHTML={{ __html: t.raw('features.title') }}
            />
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              {t('features.subtitle')}
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
                <h3 className="text-2xl font-bold text-white mb-3">{t('features.card1.title')}</h3>
                <p className="text-violet-100 text-sm leading-relaxed">
                  {t('features.card1.description')}
                </p>
              </div>
              <ul className="space-y-2">
                {['bullet1', 'bullet2', 'bullet3'].map((key) => (
                  <li key={key} className="flex items-center gap-2 text-sm text-violet-100">
                    <Check className="h-4 w-4 text-violet-300 flex-shrink-0" />
                    {t(`features.card1.${key}`)}
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
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('features.card2.title')}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {t('features.card2.description')}
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
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('features.card3.title')}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {t('features.card3.description')}
                </p>
              </div>
            </div>

            {/* Right — mockup */}
            <div className="flex flex-col gap-3">
              {/* Categoria card */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{t('features.card3.categoryLabel')}</p>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-900">{t('features.card3.categoryValue')}</p>
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{t('features.card3.categoryBadge')}</span>
                </div>
              </div>

              {/* Progress card */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-3">{t('features.card3.progressLabel')}</p>
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
                  <p className="text-xs text-violet-200 mb-1">{t('features.card3.impactLabel')}</p>
                  <p className="text-xl font-bold text-white">{t('features.card3.impactValue')}</p>
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
              {t('pricing.badge')}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              {t('pricing.title')}
            </h2>
            <p className="text-gray-500">{t('pricing.subtitle')}</p>
          </div>

          {/* Toggle */}
          <div className="flex justify-center mb-14">
            <div className="flex items-center bg-gray-100 rounded-full p-1">
              <button
                onClick={() => setIsAnnual(false)}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${!isAnnual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                {t('pricing.toggleMonthly')}
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all ${isAnnual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                {t('pricing.toggleAnnual')}
                <span className="bg-violet-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{t('pricing.discountBadge')}</span>
              </button>
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center max-w-5xl mx-auto">

            {/* Básico */}
            <div className="bg-white border border-gray-200 rounded-3xl p-8">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">{t('pricing.basico.name')}</p>
              <div className="mb-1">
                <span className="text-5xl font-bold text-gray-900">
                  {formatCurrencyByCurrency(getPlanPrice('BASICO', interval, currency), currency)}
                </span>
                <span className="text-gray-500">{t('pricing.perMonth')}</span>
              </div>
              <p className="text-xs text-gray-400 mb-8">{isAnnual ? t('pricing.billedAnnual') : t('pricing.billedMonthly')}</p>
              <Link href={`/signup/basico?interval=${isAnnual ? 'annual' : 'monthly'}`} className="w-full block mb-8">
                <Button variant="outline" className="w-full font-semibold rounded-xl">
                  {t('pricing.basico.cta')}
                </Button>
              </Link>
              <ul className="space-y-3">
                {['feature1', 'feature2', 'feature3', 'feature4', 'feature5'].map((key) => (
                  <li key={key} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-violet-500 flex-shrink-0" />
                    {t(`pricing.basico.${key}`)}
                  </li>
                ))}
              </ul>
            </div>

            {/* PRO — destaque, maior */}
            <div className="bg-violet-600 rounded-3xl p-8 relative shadow-2xl md:-my-4">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap">
                {t('pricing.popularBadge')}
              </div>
              <p className="text-xs font-bold text-violet-300 uppercase tracking-widest mb-6">{t('pricing.pro.name')}</p>
              <div className="mb-1">
                <span className="text-5xl font-bold text-white">
                  {formatCurrencyByCurrency(getPlanPrice('PRO', interval, currency), currency)}
                </span>
                <span className="text-violet-200">{t('pricing.perMonth')}</span>
              </div>
              <p className="text-xs text-violet-300 mb-8">{isAnnual ? t('pricing.billedAnnual') : t('pricing.billedMonthly')}</p>
              <Link href={`/signup/pro?interval=${isAnnual ? 'annual' : 'monthly'}`} className="w-full block mb-8">
                <Button className="w-full bg-white text-violet-700 hover:bg-gray-100 font-bold rounded-xl">
                  {t('pricing.pro.cta')}
                </Button>
              </Link>
              <ul className="space-y-3">
                {['feature1', 'feature2', 'feature3', 'feature4', 'feature5', 'feature6'].map((key) => (
                  <li key={key} className="flex items-center gap-2 text-sm text-violet-100">
                    <Check className="h-4 w-4 text-violet-300 flex-shrink-0" />
                    {t(`pricing.pro.${key}`)}
                  </li>
                ))}
              </ul>
            </div>

            {/* Business */}
            <div className="bg-white border border-gray-200 rounded-3xl p-8">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">{t('pricing.business.name')}</p>
              <div className="mb-1">
                <span className="text-5xl font-bold text-gray-900">
                  {formatCurrencyByCurrency(getPlanPrice('BUSINESS', interval, currency), currency)}
                </span>
                <span className="text-gray-500">{t('pricing.perMonth')}</span>
              </div>
              <p className="text-xs text-gray-400 mb-8">{isAnnual ? t('pricing.billedAnnual') : t('pricing.billedMonthly')}</p>
              <Link href={`/signup/business?interval=${isAnnual ? 'annual' : 'monthly'}`} className="w-full block mb-8">
                <Button variant="outline" className="w-full font-semibold rounded-xl">
                  {t('pricing.business.cta')}
                </Button>
              </Link>
              <ul className="space-y-3">
                {['feature1', 'feature2', 'feature3', 'feature4', 'feature5', 'feature6'].map((key) => (
                  <li key={key} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-violet-500 flex-shrink-0" />
                    {t(`pricing.business.${key}`)}
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
              {t('faq.title')}
            </h2>
          </div>

          <div className="space-y-4">
            {faqItems.map((key, idx) => (
              <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 text-left">{t(`faq.${key}.question`)}</h3>
                  <ChevronDown
                    className="h-5 w-5 text-gray-600 flex-shrink-0 transition-transform"
                    style={{
                      transform: faqOpen === idx ? 'rotate(180deg)' : 'rotate(0)'
                    }}
                  />
                </button>
                {faqOpen === idx && (
                  <div className="px-6 pb-6 text-gray-600 border-t border-gray-200">
                    {t(`faq.${key}.answer`)}
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
            {t('ctaFooter.title')}
          </h2>
          <p className="text-lg text-violet-100 mb-8">
            {t('ctaFooter.subtitle')}
          </p>
          <Link href="#pricing">
            <Button size="lg" className="bg-white text-violet-600 hover:bg-gray-100 font-semibold px-8 py-6 text-lg">
              {t('ctaFooter.cta')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <LogoIcon gradientId="calenvo_grad_footer" />
                <span className="text-lg font-bold text-white">Calenvo</span>
              </div>
              <p className="text-sm">
                {t('footer.description')}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">{t('footer.productTitle')}</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#funcionalidades" className="hover:text-white transition-colors">
                    {t('footer.productLink1')}
                  </a>
                </li>
                <li>
                  <a href="#segmentos" className="hover:text-white transition-colors">
                    {t('footer.productLink2')}
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white transition-colors">
                    {t('footer.productLink3')}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>{t('footer.copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
