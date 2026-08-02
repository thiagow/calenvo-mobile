/** URL base pública da aplicação, sem barra final — usada para montar links e destinos de webhook. */
export function appBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
}
