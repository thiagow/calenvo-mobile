import type { Metadata } from 'next'
import { resolveConfirmationView } from '@/lib/confirmation-service'
import { ConfirmationViewClient } from './_components/confirmation-view'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Confirmação de agendamento',
  robots: { index: false, follow: false },
}

export default async function ConfirmationPage({ params }: { params: { token: string } }) {
  const view = await resolveConfirmationView(params.token)
  return <ConfirmationViewClient token={params.token} initialView={view} />
}
