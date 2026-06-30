

'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

export function ThemeToggle() {
  const [isDark, setIsDark] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  // Ensure component is mounted on client to avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('theme')
    const html = document.documentElement
    const isDarkMode = html.classList.contains('dark') || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setIsDark(isDarkMode)
  }, [])

  const handleToggle = () => {
    // Only execute if mounted
    if (!mounted) return
    
    const html = document.documentElement
    const classList = html.classList
    
    if (isDark) {
      // Switch to light
      classList.remove('dark')
      classList.add('light')
      html.style.colorScheme = 'light'
      localStorage.setItem('theme', 'light')
      setIsDark(false)
      toast.success('Tema claro ativado')
    } else {
      // Switch to dark
      classList.remove('light')
      classList.add('dark')
      html.style.colorScheme = 'dark'
      localStorage.setItem('theme', 'dark')
      setIsDark(true)
      toast.success('Tema escuro ativado')
    }
  }

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={handleToggle} 
      aria-label={mounted ? (isDark ? 'Ativar tema claro' : 'Ativar tema escuro') : 'Alternar tema'}
      title={mounted ? (isDark ? 'Ativar tema claro' : 'Ativar tema escuro') : 'Alternar tema'}
      className="relative"
    >
      {!mounted ? (
        <>
          <Sun className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Alternar tema</span>
        </>
      ) : isDark ? (
        <>
          <Moon className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Tema escuro ativo - Clique para alternar para tema claro</span>
        </>
      ) : (
        <>
          <Sun className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Tema claro ativo - Clique para alternar para tema escuro</span>
        </>
      )}
    </Button>
  )
}
