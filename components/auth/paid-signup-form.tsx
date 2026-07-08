'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import toast from 'react-hot-toast'
import { AVAILABLE_SEGMENTS } from '@/lib/types'
import { PlanType, SegmentType } from '@prisma/client'
import { Loader2, User, Mail, Lock, Building, Phone, Briefcase, CreditCard } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

interface PaidSignupFormProps {
  plan: PlanType
  interval: 'MONTHLY' | 'ANNUAL'
}

export function PaidSignupForm({ plan, interval }: PaidSignupFormProps) {
  const t = useTranslations('Signup')
  const tSegments = useTranslations('Segments')
  const locale = useLocale()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    businessName: '',
    segmentType: 'BEAUTY_SALON' as SegmentType,
    phone: ''
  })

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!formData.name || !formData.email || !formData.password || !formData.businessName || !formData.phone || !formData.segmentType) {
      toast.error(t('requiredFieldsError'))
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, plan, interval, locale })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || t('checkoutError'))
      }

      window.location.href = data.url
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('checkoutError'))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-gray-700">{t('fieldName')}</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            id="name"
            type="text"
            placeholder={t('fieldNamePlaceholder')}
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="pl-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-gray-700">{t('fieldEmail')}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            id="email"
            type="email"
            placeholder={t('fieldEmailPlaceholder')}
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="pl-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-gray-700">{t('fieldPassword')}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            id="password"
            type="password"
            placeholder={t('fieldPasswordPlaceholder')}
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            className="pl-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
            required
            minLength={6}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="businessName" className="text-gray-700">{t('fieldBusinessName')}</Label>
        <div className="relative">
          <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            id="businessName"
            type="text"
            placeholder={t('fieldBusinessNamePlaceholder')}
            value={formData.businessName}
            onChange={(e) => handleChange('businessName', e.target.value)}
            className="pl-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="segmentType" className="text-gray-700">{t('fieldSegment')}</Label>
        <div className="relative">
          <Briefcase className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
          <Select
            value={formData.segmentType}
            onValueChange={(value) => handleChange('segmentType', value)}
          >
            <SelectTrigger className="pl-10 bg-white border-gray-200 text-gray-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200">
              {AVAILABLE_SEGMENTS.map((segment) => (
                <SelectItem
                  key={segment.value}
                  value={segment.value}
                  className="text-gray-900 focus:bg-violet-50 focus:text-violet-900"
                >
                  {tSegments(segment.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="text-gray-700">{t('fieldPhone')}</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            id="phone"
            type="tel"
            placeholder={t('fieldPhonePlaceholder')}
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="pl-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
            required
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full bg-violet-600 hover:bg-violet-700 text-white text-lg py-6 rounded-xl"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('processing')}
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-5 w-5" />
            {t('submitButton')}
          </>
        )}
      </Button>

      <p className="text-xs text-center text-gray-500 mt-4">
        {t('disclaimer')}
      </p>
    </form>
  )
}
