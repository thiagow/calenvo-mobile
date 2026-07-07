import { redirect } from '@/i18n/navigation'

export default function SignupPage({ params }: { params: { locale: string } }) {
  redirect({ href: '/signup/basico?interval=monthly', locale: params.locale })
}
