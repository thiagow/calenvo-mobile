import { redirect } from 'next/navigation'

// As chaves de API agora ficam em Configurações → Integrações (API). Mantém links antigos funcionando.
export default function ApiKeysRedirectPage() {
  redirect('/dashboard/settings#api')
}
