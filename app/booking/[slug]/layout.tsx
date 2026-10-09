import { cache, type ReactNode } from 'react'
import type { Viewport } from 'next'
import { resolveTenantBySlug } from '@/lib/tenant-resolver'
import { resolveTheme, type ResolvedBookingTheme } from '@/lib/booking-theme'
import { BookingThemeRoot } from './_components/booking-theme-root'
import { bookingSerif } from './_fonts'
import './booking-themes.css'

interface BookingLayoutProps {
  children: ReactNode
  params: { slug: string }
}

/**
 * Resolvido no servidor para que o primeiro paint já saia com o tema do
 * negócio (sem flash da cor padrão). `cache` evita repetir a consulta entre o
 * layout e o generateViewport da mesma requisição.
 */
const loadTheme = cache(async (slug: string): Promise<ResolvedBookingTheme> => {
  try {
    const config = (await resolveTenantBySlug(slug))?.businessConfig
    return resolveTheme({
      template: config?.bookingTemplate,
      bgColor: config?.bookingBgColor,
      textColor: config?.bookingTextColor,
      accentColor: config?.bookingAccentColor,
      coverEnabled: config?.bookingCoverEnabled,
      coverImage: config?.bookingCoverImage,
    })
  } catch (error) {
    // Falha de leitura do tema não pode derrubar o agendamento: cai no padrão.
    console.error('Erro ao carregar tema da página pública:', error)
    return resolveTheme()
  }
})

export async function generateViewport({ params }: { params: { slug: string } }): Promise<Viewport> {
  const theme = await loadTheme(params.slug)
  return { themeColor: theme.colors.background }
}

export default async function BookingLayout({ children, params }: BookingLayoutProps) {
  const theme = await loadTheme(params.slug)

  return (
    <div className={bookingSerif.variable}>
      <BookingThemeRoot theme={theme}>{children}</BookingThemeRoot>
    </div>
  )
}
