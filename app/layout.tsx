import type { Metadata, Viewport } from "next"
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Providers } from '@/components/providers/session-provider'
import { DialogProvider } from '@/components/providers/dialog-provider'
import { Toaster as ShadcnToaster } from '@/components/ui/toaster'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#09090b',
}

export const metadata: Metadata = {
  title: "Calenvo - Agendamento Inteligente",
  description: "Sistema de agendamento para salões, clínicas e empreendedores",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Calenvo',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="apple-touch-icon" href="/calenvo-logo.png" />
      </head>
      <body className={inter.className}>
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <DialogProvider>
              {children}
              <Toaster />
              <ShadcnToaster />
            </DialogProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
