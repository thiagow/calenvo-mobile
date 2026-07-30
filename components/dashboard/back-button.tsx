'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BackButton({ className }: { className?: string }) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={cn('flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors', className)}
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar
    </button>
  )
}
