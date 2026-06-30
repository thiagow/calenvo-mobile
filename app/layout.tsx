import type { Metadata } from "next"
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Providers } from '@/components/providers/session-provider'
import { DialogProvider } from '@/components/providers/dialog-provider'
import { Toaster as ShadcnToaster } from '@/components/ui/toaster'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "Calenvo - Sistema de Agendamento Inteligente",
  description: "Plataforma completa de agendamento com templates personalizados para diferentes tipos de negócios no Brasil",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
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